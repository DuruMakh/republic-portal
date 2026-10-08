-- Registration privacy consent, step 2 of 2 (spec 2026-10-08 section 6, ADR-041).
--
-- Ships with the code that always sends p_privacy_version (both join forms and both
-- registration actions), after step 1 (20261008140000_registration_privacy_consent.sql)
-- was applied ahead of it. register() now refuses a missing version as well as a stale
-- one, and stamps every new profile. Body restated verbatim from step 1 apart from the
-- consent check and the stamped values. register_google() is unchanged: it already
-- passes the version through. The version literal must equal PRIVACY_POLICY_VERSION in
-- lib/privacy.ts (lib/privacy.test.ts checks it).

create or replace function register(
  p_first_name text,
  p_last_name text,
  p_ref_code text default null,
  p_privacy_version text default null
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
  -- Privacy consent (spec 2026-10-08 section 6), step 2 of 2: every registration carries
  -- the current policy version; a missing or stale one is refused.
  if p_privacy_version is distinct from '2026-10-v1' then
    raise exception 'privacy_consent_required';
  end if;
  if p_first_name is null or length(btrim(p_first_name, E' \t\r\n')) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name, E' \t\r\n')) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  -- Phase 3 rider parity (20260715213000 §4.6): junk ref codes are silently dropped
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9-]{1,32}$' then
    v_ref := null;
  end if;
  -- every minted code is uppercase (gen_funnel_code alphabet, roster seeds);
  -- lowercase arrivals are hand-retyped links — normalize losslessly so the
  -- case-sensitive attribution joins (admin_members, delegate_panel) match
  v_ref := upper(v_ref);

  select case
           when u.phone is null then null
           when left(u.phone, 1) = '+' then u.phone
           else '+' || u.phone
         end
    into v_phone
    from auth.users u where u.id = v_uid;

  -- ADR-021 null-phone guard (security check-up F3): membership identity is
  -- one SMS-verified phone per person; a phoneless (email-manufactured)
  -- session must not reach 'registered'.
  if v_phone is null then
    raise exception 'phone_required';
  end if;

  for i in 1..20 loop
    begin
      insert into public.profiles (id, first_name, last_name, phone, status, signup_ref_code, referral_code, privacy_accepted_at, privacy_version)
      values (
        v_uid, btrim(p_first_name, E' \t\r\n'), btrim(p_last_name, E' \t\r\n'),
        v_phone, 'registered', v_ref, public.mint_member_referral_code(),
        now(), p_privacy_version
      );
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = CONSTRAINT_NAME;
      if v_constraint = 'profiles_pkey' then
        -- double-submit race — the row now exists, report state
        return public.cabinet_state() || jsonb_build_object('created', false);
      elsif v_constraint = 'profiles_referral_code_key' and i < 20 then
        null; -- referral-code collision: retry with a fresh code
      else
        raise;
      end if;
    end;
  end loop;

  return public.cabinet_state() || jsonb_build_object('created', true);
end $$;
grant execute on function register(text, text, text, text) to authenticated;
revoke execute on function register(text, text, text, text) from public, anon;
