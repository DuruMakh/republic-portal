-- Foreign phone numbers at registration (ADR-055, spec 2026-10-23). Georgian numbers keep
-- Verify.ge; foreign mobiles from the allowed countries get their code from Twilio Verify.
-- Widens the phone checks to E.164, admits the twilio provider and adds a site-wide brake of
-- 100 foreign sends a day. Every other rule of both functions is unchanged from
-- 20261008160000_phone_verification_hardening.sql.

alter table public.phone_verification_challenges
  drop constraint phone_verification_challenges_phone_check,
  add constraint phone_verification_challenges_phone_check
    check (phone ~ '^\+[1-9][0-9]{7,14}$');
alter table public.phone_verification_send_reservations
  drop constraint phone_verification_send_reservations_phone_check,
  add constraint phone_verification_send_reservations_phone_check
    check (phone ~ '^\+[1-9][0-9]{7,14}$');

alter table public.phone_verification_challenges
  drop constraint phone_verification_challenges_provider_check,
  add constraint phone_verification_challenges_provider_check
    check (provider in ('verify_ge', 'twilio', 'test'));

create or replace function public.reserve_phone_verification_send(
  p_user_id uuid,
  p_phone text,
  p_idempotency_key text
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_reservation_id uuid;
  v_user_hour bigint;
  v_user_day bigint;
  v_user_numbers_day bigint;
  v_user_phone_day bigint;
  v_phone_day bigint;
  v_site_hour bigint;
  v_foreign_day bigint;
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

  select pg_catalog.count(*) into v_site_hour
    from public.phone_verification_send_reservations
   where created_at >= v_now - interval '1 hour';
  if v_site_hour >= 1000 then
    return pg_catalog.jsonb_build_object('status', 'limited');
  end if;

  -- ADR-055: foreign SMS is paid per message abroad, so every foreign send shares one daily
  -- brake, serialized so two sends cannot both take the last slot. Georgian numbers
  -- (Verify.ge) never count toward it.
  if p_phone not like '+995%' then
    perform pg_catalog.pg_advisory_xact_lock(8613, 0);
    select pg_catalog.count(*) into v_foreign_day
      from public.phone_verification_send_reservations
     where phone not like '+995%'
       and created_at >= v_now - interval '24 hours';
    if v_foreign_day >= 100 then
      return pg_catalog.jsonb_build_object('status', 'limited');
    end if;
  end if;

  select pg_catalog.count(*) filter (where created_at >= v_now - interval '1 hour'),
         pg_catalog.count(*),
         pg_catalog.count(distinct phone),
         pg_catalog.count(*) filter (where phone = p_phone)
    into v_user_hour, v_user_day, v_user_numbers_day, v_user_phone_day
    from public.phone_verification_send_reservations
   where user_id = p_user_id
     and created_at >= v_now - interval '24 hours';
  if v_user_hour >= 5 or v_user_day >= 10 then
    return pg_catalog.jsonb_build_object('status', 'limited');
  end if;
  if v_user_phone_day = 0
     and v_user_numbers_day >= 3 then
    return pg_catalog.jsonb_build_object('status', 'limited');
  end if;

  select pg_catalog.count(*) into v_phone_day
    from public.phone_verification_send_reservations
   where phone = p_phone
     and created_at >= v_now - interval '24 hours';
  if v_phone_day >= 10
     and v_user_phone_day >= 3 then
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
       and challenge.superseded_at is null
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
           and challenge.superseded_at is null
           and challenge.expires_at > v_now
      ) then
        raise exception 'phone_verification_completion_failed';
      end if;
    else
      if p_provider not in ('verify_ge', 'twilio', 'test')
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

  -- C1: an explicit marker; consumed_at stays null, so a superseded challenge can never be
  -- read as proof. M1: only the sender's own codes are cancelled — another account asking for
  -- the same number no longer cancels the owner's live code.
  update public.phone_verification_challenges
     set superseded_at = v_now
   where purpose = 'registration'
     and consumed_at is null
     and superseded_at is null
     and expires_at > v_now
     and id <> v_challenge_id
     and user_id = p_user_id;

  return pg_catalog.jsonb_build_object(
    'challenge_id', v_challenge_id,
    'expires_at', v_challenge_expires_at
  );
end $$;

revoke execute on function public.complete_phone_verification_send(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.complete_phone_verification_send(uuid, uuid, text, text, timestamptz) to service_role;
