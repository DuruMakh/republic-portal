-- Security check-up fix wave (Task 12), fix 3 of 5 — finding F3 / LB-3,
-- the CODE half. Disabling the email provider is a Supabase project setting and
-- stays the owner's action (ADR-021, docs/security/LAUNCH-BLOCKERS.md).
--
-- THE PLATFORM'S CORE SYBIL ASSUMPTION IS "one SMS-verified phone, one person",
-- AND IT WAS NOT ENFORCED AT THE MEMBERSHIP BOUNDARY. Live /auth/v1/settings on
-- the hosted project: external.email true, disable_signup false,
-- mailer_autoconfirm true, no captcha — while phone_autoconfirm is false. So
-- phone identity is gated by OTP and email identity is not gated at all. An
-- attacker signs up with email + password, is confirmed without any mail being
-- delivered, and holds a session with NO phone. register() then read
-- auth.users.phone (null) and inserted the profile anyway; profiles.phone is
-- nullable-unique and Postgres permits many NULLs, so the row was legal.
-- become_member_complete() takes it the rest of the way — no payment, no admin
-- — and the account can RSVP and vote.
--
-- Reproduced live before this migration, from a fresh email-only session:
-- register() returned created=true, status 'registered', and left a profiles
-- row behind. Verified in the same run that the session carried no phone.
--
-- WHERE THE GUARD SITS, AND WHY EXACTLY THERE.
--   * AFTER the "profile already exists" early return, so this can never lock
--     an existing account out of its own state read. Any profile created before
--     today keeps working, whatever it was created with.
--   * BEFORE the personal-ID duplicate check, which is the part that matters
--     beyond F3: that check raises `duplicate_personal_id` without writing
--     anything (finding DL-1), so a session can probe an unbounded list of
--     government ID numbers for free. Guarding the phone first means a
--     phone-less session cannot run that oracle either — it is refused before
--     the probe reaches the check. It also strictly shortens the route to F13
--     (personal-ID squatting), which the owner deferred to launch: squatting
--     still needs an account, and one fewer way of getting one now exists.
--
-- `phone_required` is a caller-standing refusal, classified accordingly in
-- lib/security/verdict.ts and rendered by lib/funnel.ts as a sentence of its
-- own — not_authenticated would be wrong and actively unhelpful, because
-- signing in again does not fix it.
--
-- Body otherwise identical to 20260722140000 §1. ACLs survive create-or-replace;
-- grants restated verbatim per house shape.
create or replace function register(
  p_first_name text,
  p_last_name text,
  p_personal_id text,
  p_ref_code text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_ref text := nullif(btrim(coalesce(p_ref_code, ''), E' \t\r\n'), '');
  v_constraint text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    -- duplicate phone after OTP: a state read, never an overwrite (spec §8)
    return public.cabinet_state() || jsonb_build_object('created', false);
  end if;

  select case
           when u.phone is null then null
           when left(u.phone, 1) = '+' then u.phone
           else '+' || u.phone
         end
    into v_phone
    from auth.users u where u.id = v_uid;
  -- F3: no verified phone, no membership. The read moved up from just above the
  -- insert so that this gate precedes the duplicate-ID check below.
  if v_phone is null then raise exception 'phone_required'; end if;

  if p_first_name is null or length(btrim(p_first_name, E' \t\r\n')) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name, E' \t\r\n')) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
    raise exception 'invalid_personal_id';
  end if;
  -- Phase 3 rider parity (20260715213000 §4.6): junk ref codes are silently dropped
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9-]{1,32}$' then
    v_ref := null;
  end if;
  -- every minted code is uppercase (gen_funnel_code alphabet, roster seeds);
  -- lowercase arrivals are hand-retyped links — normalize losslessly so the
  -- case-sensitive attribution joins (admin_members, delegate_panel) match
  v_ref := upper(v_ref);
  if exists (select 1 from public.profiles pr where pr.personal_id = p_personal_id) then
    raise exception 'duplicate_personal_id';
  end if;

  begin
    insert into public.profiles (id, first_name, last_name, phone, personal_id, status, signup_ref_code)
    values (
      v_uid, btrim(p_first_name, E' \t\r\n'), btrim(p_last_name, E' \t\r\n'),
      v_phone, p_personal_id, 'registered', v_ref
    );
  exception when unique_violation then
    get stacked diagnostics v_constraint = CONSTRAINT_NAME;
    if v_constraint = 'profiles_personal_id_key' then
      raise exception 'duplicate_personal_id';
    elsif v_constraint = 'profiles_pkey' then
      return public.cabinet_state() || jsonb_build_object('created', false);
    else
      raise;
    end if;
  end;

  return public.cabinet_state() || jsonb_build_object('created', true);
end $$;

grant execute on function register(text, text, text, text) to authenticated;
revoke execute on function register(text, text, text, text) from public, anon;
