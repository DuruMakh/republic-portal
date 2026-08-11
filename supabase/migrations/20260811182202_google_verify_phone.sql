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

-- Atomic server-only state transitions. SECURITY INVOKER keeps the functions
-- within the service role's deliberately narrow table privileges.
create or replace function public.record_phone_verification_failure(
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

revoke execute on function public.record_phone_verification_failure(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_phone_verification_failure(uuid, uuid) to service_role;

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
       and verify_attempts < 5
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
