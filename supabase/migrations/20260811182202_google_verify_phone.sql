-- Server-only ledger for Verify.ge registration proofs. Browser roles receive
-- no table privileges or policies; trusted server actions use service_role.
create table public.phone_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null check (phone ~ '^\+9955[0-9]{8}$'),
  purpose text not null check (purpose = 'registration'),
  provider text not null check (provider in ('verify_ge', 'test')),
  provider_request_id text not null,
  verify_attempts smallint not null default 0 check (verify_attempts between 0 and 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_request_id),
  check (expires_at > created_at)
);

-- These indexes also cover the user_id foreign key and the planned per-user /
-- per-phone rate-limit and cleanup queries.
create index phone_verification_by_user_created
  on public.phone_verification_challenges (user_id, created_at desc);
create index phone_verification_by_phone_created
  on public.phone_verification_challenges (phone, created_at desc);

alter table public.phone_verification_challenges enable row level security;
revoke all on public.phone_verification_challenges from public, anon, authenticated;
grant select, insert, update, delete on public.phone_verification_challenges to service_role;

-- Every attempted provider send is recorded before the external call. This
-- separate ledger keeps failed/config-broken sends in the rate-limit history
-- without ever creating a challenge that could become valid phone proof.
create table public.phone_verification_send_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null check (phone ~ '^\+9955[0-9]{8}$'),
  purpose text not null default 'registration' check (purpose = 'registration'),
  idempotency_key text not null check (idempotency_key ~ '^[a-f0-9]{64}$'),
  challenge_id uuid references public.phone_verification_challenges(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, phone, purpose, idempotency_key)
);

create index phone_verification_send_by_user_created
  on public.phone_verification_send_reservations (user_id, created_at desc);
create index phone_verification_send_by_phone_created
  on public.phone_verification_send_reservations (phone, created_at desc);

alter table public.phone_verification_send_reservations enable row level security;
revoke all on public.phone_verification_send_reservations from public, anon, authenticated;
grant select, insert, update, delete on public.phone_verification_send_reservations to service_role;

-- User and phone locks are always acquired in this order and in separate lock
-- namespaces. Competing sends that share either rate-limit scope therefore
-- serialize before checking and recording the reservation.
create or replace function public.reserve_phone_verification_send(
  p_user_id uuid,
  p_phone text,
  p_idempotency_key text
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_reservation_id uuid;
  v_user_count bigint;
  v_phone_count bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(8611, pg_catalog.hashtext(p_user_id::text));
  perform pg_catalog.pg_advisory_xact_lock(8612, pg_catalog.hashtext(p_phone));

  delete from public.phone_verification_send_reservations
   where created_at < v_now - interval '24 hours'
     and (user_id = p_user_id or phone = p_phone);
  delete from public.phone_verification_challenges
   where created_at < v_now - interval '24 hours'
     and (user_id = p_user_id or phone = p_phone);

  if exists (
    select 1
      from public.phone_verification_send_reservations
     where user_id = p_user_id
       and phone = p_phone
       and purpose = 'registration'
       and idempotency_key = p_idempotency_key
  ) or exists (
    select 1
      from public.phone_verification_send_reservations
     where created_at >= v_now - interval '60 seconds'
       and (user_id = p_user_id or phone = p_phone)
  ) then
    return pg_catalog.jsonb_build_object('status', 'limited');
  end if;

  select pg_catalog.count(*) into v_user_count
    from public.phone_verification_send_reservations
   where user_id = p_user_id
     and created_at >= v_now - interval '1 hour';
  select pg_catalog.count(*) into v_phone_count
    from public.phone_verification_send_reservations
   where phone = p_phone
     and created_at >= v_now - interval '1 hour';
  if v_user_count >= 5 or v_phone_count >= 5 then
    return pg_catalog.jsonb_build_object('status', 'limited');
  end if;

  insert into public.phone_verification_send_reservations (
    user_id, phone, purpose, idempotency_key, created_at
  ) values (
    p_user_id, p_phone, 'registration', p_idempotency_key, v_now
  ) returning id into v_reservation_id;

  return pg_catalog.jsonb_build_object(
    'status', 'reserved',
    'reservation_id', v_reservation_id
  );
end $$;

revoke execute on function public.reserve_phone_verification_send(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_phone_verification_send(uuid, text, text) to service_role;

-- Provider success is bound to its reservation and challenge supersession in
-- one transaction. Shared user/phone scopes use the same lock order as send
-- reservation, so concurrent completions leave exactly one active challenge.
create or replace function public.complete_phone_verification_send(
  p_reservation_id uuid,
  p_user_id uuid,
  p_provider text,
  p_provider_request_id text,
  p_expires_at timestamptz
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_phone text;
  v_linked_challenge_id uuid;
  v_challenge_id uuid;
  v_challenge_expires_at timestamptz;
begin
  select reservation.phone into v_phone
    from public.phone_verification_send_reservations as reservation
   where reservation.id = p_reservation_id
     and reservation.user_id = p_user_id;
  if not found then
    raise exception 'phone_verification_completion_failed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(8611, pg_catalog.hashtext(p_user_id::text));
  perform pg_catalog.pg_advisory_xact_lock(8612, pg_catalog.hashtext(v_phone));

  select reservation.phone, reservation.challenge_id
    into v_phone, v_linked_challenge_id
    from public.phone_verification_send_reservations as reservation
   where reservation.id = p_reservation_id
     and reservation.user_id = p_user_id
   for update;
  if not found then
    raise exception 'phone_verification_completion_failed';
  end if;

  if v_linked_challenge_id is not null then
    select challenge.id, challenge.expires_at
      into v_challenge_id, v_challenge_expires_at
      from public.phone_verification_challenges as challenge
     where challenge.id = v_linked_challenge_id
       and challenge.user_id = p_user_id
       and challenge.phone = v_phone
       and challenge.purpose = 'registration'
       and challenge.provider = p_provider
       and challenge.provider_request_id = p_provider_request_id
       and challenge.consumed_at is null
       and challenge.expires_at > v_now
     for update;
    if not found then
      raise exception 'phone_verification_completion_failed';
    end if;
  else
    select challenge.id, challenge.expires_at
      into v_challenge_id, v_challenge_expires_at
      from public.phone_verification_challenges as challenge
     where challenge.provider = p_provider
       and challenge.provider_request_id = p_provider_request_id
     for update;

    if found then
      if not exists (
        select 1
          from public.phone_verification_challenges as challenge
         where challenge.id = v_challenge_id
           and challenge.user_id = p_user_id
           and challenge.phone = v_phone
           and challenge.purpose = 'registration'
           and challenge.consumed_at is null
           and challenge.expires_at > v_now
      ) then
        raise exception 'phone_verification_completion_failed';
      end if;
    else
      if p_provider not in ('verify_ge', 'test')
         or p_provider_request_id is null
         or p_provider_request_id = ''
         or p_expires_at <= v_now then
        raise exception 'phone_verification_completion_failed';
      end if;

      insert into public.phone_verification_challenges (
        user_id, phone, purpose, provider, provider_request_id, expires_at
      ) values (
        p_user_id, v_phone, 'registration', p_provider, p_provider_request_id, p_expires_at
      ) returning id, expires_at into v_challenge_id, v_challenge_expires_at;
    end if;

    update public.phone_verification_send_reservations
       set challenge_id = v_challenge_id
     where id = p_reservation_id
       and user_id = p_user_id;
  end if;

  update public.phone_verification_challenges
     set consumed_at = expires_at + interval '1 microsecond'
   where purpose = 'registration'
     and consumed_at is null
     and expires_at > v_now
     and id <> v_challenge_id
     and (user_id = p_user_id or phone = v_phone);

  return pg_catalog.jsonb_build_object(
    'challenge_id', v_challenge_id,
    'expires_at', v_challenge_expires_at
  );
end $$;

revoke execute on function public.complete_phone_verification_send(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.complete_phone_verification_send(uuid, uuid, text, text, timestamptz) to service_role;

-- Reserving (incrementing) happens before the provider call. Concurrent UPDATEs
-- serialize on the challenge row, so no more than five callers receive a slot.
create or replace function public.reserve_phone_verification_attempt(
  p_challenge_id uuid,
  p_user_id uuid
) returns smallint
language sql volatile security invoker set search_path = '' as $$
  update public.phone_verification_challenges
     set verify_attempts = verify_attempts + 1
   where id = p_challenge_id
     and user_id = p_user_id
     and consumed_at is null
     and expires_at > pg_catalog.now()
     and verify_attempts < 5
  returning verify_attempts;
$$;

revoke execute on function public.reserve_phone_verification_attempt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_phone_verification_attempt(uuid, uuid) to service_role;

create or replace function public.consume_phone_verification_challenge(
  p_challenge_id uuid,
  p_user_id uuid
) returns boolean
language sql volatile security invoker set search_path = '' as $$
  with consumed as (
    update public.phone_verification_challenges
       set consumed_at = pg_catalog.now()
     where id = p_challenge_id
       and user_id = p_user_id
       and consumed_at is null
       and expires_at > pg_catalog.now()
       and verify_attempts between 1 and 5
    returning 1
  )
  select exists(select 1 from consumed);
$$;

revoke execute on function public.consume_phone_verification_challenge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_phone_verification_challenge(uuid, uuid) to service_role;

-- This narrowly scoped SECURITY DEFINER wrapper must read auth.users and must
-- continue calling public.register after the rollout hardening revokes direct
-- authenticated access to that legacy function. Every identity/proof check is
-- therefore enforced here before the elevated call.
create or replace function public.register_google(
  p_first_name text,
  p_last_name text,
  p_ref_code text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_phone_confirmed_at timestamptz;
  v_has_google boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select case
           when u.phone is null then null
           when pg_catalog.left(u.phone, 1) = '+' then u.phone
           else '+' || u.phone
         end,
         u.phone_confirmed_at,
         coalesce(u.raw_app_meta_data -> 'providers' ? 'google', false)
    into v_phone, v_phone_confirmed_at, v_has_google
    from auth.users as u
   where u.id = v_uid;

  if not v_has_google then
    raise exception 'google_required';
  end if;

  if v_phone is null or v_phone_confirmed_at is null then
    raise exception 'phone_required';
  end if;

  if not exists (
    select 1
      from public.phone_verification_challenges as challenge
     where challenge.user_id = v_uid
       and challenge.phone = v_phone
       and challenge.purpose = 'registration'
       and challenge.consumed_at is not null
       and challenge.consumed_at <= challenge.expires_at
       and challenge.consumed_at between pg_catalog.now() - interval '24 hours'
                                             and pg_catalog.now()
  ) then
    raise exception 'phone_required';
  end if;

  return public.register(p_first_name, p_last_name, p_ref_code);
end $$;

revoke execute on function public.register_google(text, text, text) from public, anon;
grant execute on function public.register_google(text, text, text) to authenticated, service_role;
