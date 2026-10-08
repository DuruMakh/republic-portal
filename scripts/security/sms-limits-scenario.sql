-- Staging only. Proves the security audit M1 send limits
-- (20261008160000_phone_verification_hardening.sql) and leaves no trace: everything runs in one
-- transaction that ends in ROLLBACK. Each check is built so exactly one rule decides it — every
-- account stays under its own hourly and daily caps, and all seeded sends are backdated past the
-- 60-second gap. Expected: every `ok` is true.
begin;
-- a001 = the number's real owner; a002..a005 = four attacker accounts
insert into auth.users (id, aud, role, email)
select ('00000000-0000-4000-8000-00000000a00' || g)::uuid, 'authenticated', 'authenticated',
       'r5-' || g || '@example.invalid'
  from pg_catalog.generate_series(1, 5) as g;

-- the attackers have sent the owner's number 10 codes today, 3+3+3+1 (each well under 10/day)
insert into public.phone_verification_send_reservations (user_id, phone, idempotency_key, created_at)
select ('00000000-0000-4000-8000-00000000a00' || (2 + (g - 1) / 3))::uuid, '+995550009999',
       pg_catalog.encode(pg_catalog.sha256(('r5-p' || g)::bytea), 'hex'),
       pg_catalog.now() - ((g + 1) || ' hours')::interval
  from pg_catalog.generate_series(1, 10) as g;

-- 1) per-number cap: a002 (3 sends to it today, so not its first) is refused
select 'number_cap_refuses_repeat_sender' as check,
       public.reserve_phone_verification_send('00000000-0000-4000-8000-00000000a002', '+995550009999',
         pg_catalog.encode(pg_catalog.sha256('r5-c1'::bytea), 'hex')) ->> 'status' = 'limited' as ok;

-- 2) no lockout: the owner's first code today still goes out although the number is at its cap
select 'owner_first_code_goes_out' as check,
       public.reserve_phone_verification_send('00000000-0000-4000-8000-00000000a001', '+995550009999',
         pg_catalog.encode(pg_catalog.sha256('r5-c2'::bytea), 'hex')) ->> 'status' = 'reserved' as ok;

-- 3) different-numbers cap: a003 already has 3 numbers today (+995550009999 plus two more), so a
--    4th new number is refused. It has only 5 sends today and none in the last 30 minutes, so no
--    other rule applies.
insert into public.phone_verification_send_reservations (user_id, phone, idempotency_key, created_at)
select '00000000-0000-4000-8000-00000000a003', '+99555000100' || g,
       pg_catalog.encode(pg_catalog.sha256(('r5-n' || g)::bytea), 'hex'),
       pg_catalog.now() - interval '40 minutes'
  from pg_catalog.generate_series(1, 2) as g;
select 'fourth_new_number_refused' as check,
       public.reserve_phone_verification_send('00000000-0000-4000-8000-00000000a003', '+995550001009',
         pg_catalog.encode(pg_catalog.sha256('r5-c3'::bytea), 'hex')) ->> 'status' = 'limited' as ok;

-- 4) control: the same account may still ask again for a number it already used today
select 'known_number_still_allowed' as check,
       public.reserve_phone_verification_send('00000000-0000-4000-8000-00000000a003', '+995550001001',
         pg_catalog.encode(pg_catalog.sha256('r5-c4'::bytea), 'hex')) ->> 'status' = 'reserved' as ok;
rollback;
