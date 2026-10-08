-- Security audit 2026-10-08 — phone verification hardening (spec
-- docs/superpowers/specs/2026-10-08-security-audit-fixes-design.md; one release, owner order).
--
-- C1 (database half; the exact-time check is in lib/phone-verification/timestamps.ts):
--   1) A superseded challenge gets its own marker. It used to be encoded as
--      consumed_at = expires_at + 1µs, which millisecond JavaScript read as a valid proof and
--      let anyone attach a stranger's phone number without the code.
--   2) The legacy register() is no longer callable by clients. register_google() (SECURITY
--      DEFINER, owner-run) is the only registration path; it checks the Google identity and an
--      exact, consumed proof first. Planned in 2026-08-11 plan Task 9 step 7, never shipped.
-- M1 (decision D4): sends are limited per account, per number and site-wide, and a send only
--   ever cancels the sender's own codes — so nobody can lock a chosen person out:
--     per account: 1 per 60 s, 5 per hour, 10 per day, at most 3 different numbers per day;
--     per number:  1 per 60 s across accounts, 10 per day across accounts, EXCEPT that an
--                  account that has not asked for this number today always gets its first code;
--     site-wide:   1,000 per hour (a backstop for the SMS bill, high enough for a sign-up surge).
--   No rule looks at whether a profile owns the number (no membership signal).

-- 1) Explicit supersede marker -------------------------------------------------------------

alter table public.phone_verification_challenges
  add column superseded_at timestamptz,
  add constraint phone_verification_consumed_or_superseded
    check (consumed_at is null or superseded_at is null);

-- Backfill the old marker. Only a supersede can leave consumed_at > expires_at: a real consume
-- requires expires_at > now(). The real supersede time is unknown, so the backfill time is used.
update public.phone_verification_challenges
   set superseded_at = pg_catalog.now(),
       consumed_at = null
 where consumed_at > expires_at;

create index phone_verification_send_by_created
  on public.phone_verification_send_reservations (created_at);

-- 2) reserve_phone_verification_send(): the M1 limits. Restated from
--    20260811182202_google_verify_phone.sql; the locks, the 24-hour cleanup, the idempotency
--    check and the 60-second gap are unchanged. The shared per-number hourly cap is replaced.
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
     and v_user_phone_day > 0 then
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

-- 3) complete_phone_verification_send(): restated verbatim from
--    20260811182202_google_verify_phone.sql apart from the final supersede UPDATE.
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

-- 4) Attempts and consumption refuse a superseded challenge. Restated verbatim from
--    20260811182202_google_verify_phone.sql plus `and superseded_at is null`.
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
     and superseded_at is null
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
       and superseded_at is null
       and expires_at > pg_catalog.now()
       and verify_attempts between 1 and 5
    returning 1
  )
  select exists(select 1 from consumed);
$$;

revoke execute on function public.consume_phone_verification_challenge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_phone_verification_challenge(uuid, uuid) to service_role;

-- 5) Legacy register(): clients go through register_google() only.
revoke execute on function public.register(text, text, text, text) from public, anon, authenticated;
