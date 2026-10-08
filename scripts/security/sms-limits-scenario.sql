-- Staging only. Proves the security audit M1 send limits
-- (20261008160000_phone_verification_hardening.sql) and leaves no trace.
--
-- House probe pattern (scripts/verify-security-fixes.mjs sqlProbe): one DO block that ALWAYS
-- ends by raising its findings, so the whole transaction rolls back and the result is visible
-- in the CLI error output (`supabase db query --linked` shows only the last statement's result,
-- which a trailing ROLLBACK would leave empty). Expected output:
--   AUDIT-RESULT >> number_cap=ok owner_first=ok fourth_number=ok known_number=ok nine_is_under_cap=ok
-- Any `FAIL(...)` in that line is a finding.
--
-- Each check is built so exactly one rule decides it: every account stays under its own hourly
-- and daily caps, every seeded send is backdated past the 60-second gap, and each number gets
-- at most one successful reservation (now() is fixed inside the transaction, so a second one
-- would hit the per-number 60-second gap instead of the rule under test).
do $probe$
declare
  v_owner uuid := '00000000-0000-4000-8000-00000000a001';
  v_a2 uuid := '00000000-0000-4000-8000-00000000a002';
  v_a3 uuid := '00000000-0000-4000-8000-00000000a003';
  v_a4 uuid := '00000000-0000-4000-8000-00000000a004';
  v_a5 uuid := '00000000-0000-4000-8000-00000000a005';
  v_capped text := '+995550009999'; -- 10 sends today
  v_nine text := '+995550009998';   -- 9 sends today
  v_out text := '';
  v_status text;
begin
  -- a001 = the capped number's real owner; a002..a005 = attacker accounts
  insert into auth.users (id, aud, role, email)
  select ('00000000-0000-4000-8000-00000000a00' || g)::uuid, 'authenticated', 'authenticated',
         'r5-' || g || '@example.invalid'
    from pg_catalog.generate_series(1, 5) as g;

  -- the capped number: 10 codes today, three each from a002/a003/a004 and one from a005
  insert into public.phone_verification_send_reservations (user_id, phone, idempotency_key, created_at)
  select ('00000000-0000-4000-8000-00000000a00' || (2 + (g - 1) / 3))::uuid, v_capped,
         pg_catalog.encode(pg_catalog.sha256(('r5-p' || g)::bytea), 'hex'),
         pg_catalog.now() - ((g + 1) || ' hours')::interval
    from pg_catalog.generate_series(1, 10) as g;

  -- the nine number: 9 codes today, three from a004 and six from a005
  insert into public.phone_verification_send_reservations (user_id, phone, idempotency_key, created_at)
  select case when g <= 3 then v_a4 else v_a5 end, v_nine,
         pg_catalog.encode(pg_catalog.sha256(('r5-q' || g)::bytea), 'hex'),
         pg_catalog.now() - ((g + 1) || ' hours')::interval
    from pg_catalog.generate_series(1, 9) as g;

  -- 1) per-number cap: a002 already used its three codes for the capped number
  v_status := public.reserve_phone_verification_send(v_a2, v_capped,
    pg_catalog.encode(pg_catalog.sha256('r5-c1'::bytea), 'hex')) ->> 'status';
  v_out := v_out || 'number_cap=' || case when v_status = 'limited' then 'ok' else 'FAIL(' || coalesce(v_status, 'null') || ')' end;

  -- 2) no lockout: the owner still gets a code although the number is at its cap
  v_status := public.reserve_phone_verification_send(v_owner, v_capped,
    pg_catalog.encode(pg_catalog.sha256('r5-c2'::bytea), 'hex')) ->> 'status';
  v_out := v_out || ' owner_first=' || case when v_status = 'reserved' then 'ok' else 'FAIL(' || coalesce(v_status, 'null') || ')' end;

  -- 3) different-numbers cap: a003 already has 3 numbers today (the capped one plus two more),
  --    so a 4th new number is refused; it has 5 sends today and none in the last 40 minutes
  insert into public.phone_verification_send_reservations (user_id, phone, idempotency_key, created_at)
  select v_a3, '+99555000100' || g,
         pg_catalog.encode(pg_catalog.sha256(('r5-n' || g)::bytea), 'hex'),
         pg_catalog.now() - interval '40 minutes'
    from pg_catalog.generate_series(1, 2) as g;
  v_status := public.reserve_phone_verification_send(v_a3, '+995550001009',
    pg_catalog.encode(pg_catalog.sha256('r5-c3'::bytea), 'hex')) ->> 'status';
  v_out := v_out || ' fourth_number=' || case when v_status = 'limited' then 'ok' else 'FAIL(' || coalesce(v_status, 'null') || ')' end;

  -- 4) control for 3: the same account may still ask again for a number it already used today
  v_status := public.reserve_phone_verification_send(v_a3, '+995550001001',
    pg_catalog.encode(pg_catalog.sha256('r5-c4'::bytea), 'hex')) ->> 'status';
  v_out := v_out || ' known_number=' || case when v_status = 'reserved' then 'ok' else 'FAIL(' || coalesce(v_status, 'null') || ')' end;

  -- 5) control for 1: the cap is ten, not less — a004 has used three codes for the nine number,
  --    exactly like a002 above, and is still allowed because the number has only 9 today
  v_status := public.reserve_phone_verification_send(v_a4, v_nine,
    pg_catalog.encode(pg_catalog.sha256('r5-c5'::bytea), 'hex')) ->> 'status';
  v_out := v_out || ' nine_is_under_cap=' || case when v_status = 'reserved' then 'ok' else 'FAIL(' || coalesce(v_status, 'null') || ')' end;

  raise exception 'AUDIT-RESULT >> %', v_out;
end
$probe$;
