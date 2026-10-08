-- Registration privacy consent, step 1 of 2 (spec 2026-10-08 section 6, ADR-041).
--
-- Additive and backward compatible. register() and register_google() gain an optional
-- p_privacy_version. When it is sent it must be the current policy version, and the new
-- profile is stamped with the date and version. When it is missing the call still works,
-- so the code already live on the real site keeps registering people until step 2
-- (20261008150000_require_privacy_consent.sql) ships with the code that sends it and makes
-- a missing version refuse. The version literal must equal PRIVACY_POLICY_VERSION in
-- lib/privacy.ts (lib/privacy.test.ts checks it).

-- Nullable: existing profiles predate the policy (the two founders' accounts, owner
-- decision 2026-10-08) and are never edited by hand.
alter table public.profiles
  add column privacy_accepted_at timestamptz,
  add column privacy_version text;

-- protect_profile_columns(): restates the LIVE body
-- (20260728142000_member_referral_codes.sql) verbatim, plus the two consent columns in
-- the guarded list, the house pattern for every server-managed profiles column.
create or replace function protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.status is distinct from old.status
      or new.personal_id is distinct from old.personal_id
      or new.phone is distinct from old.phone
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
      or new.signup_ref_code is distinct from old.signup_ref_code
      or new.membership_tier is distinct from old.membership_tier
      or new.reference_code is distinct from old.reference_code
      or new.registration_completed_at is distinct from old.registration_completed_at
      or new.pending_delegate_id is distinct from old.pending_delegate_id
      or new.referral_code is distinct from old.referral_code
      or new.privacy_accepted_at is distinct from old.privacy_accepted_at
      or new.privacy_version is distinct from old.privacy_version
    then
      raise exception 'server-managed profile columns cannot be changed by client roles';
    end if;
    -- Phase 3 hardening rider — keep: value rules on direct client PATCHes
    if new.first_name is distinct from old.first_name
       and length(btrim(coalesce(new.first_name, ''))) not between 1 and 60 then
      raise exception 'invalid_name';
    end if;
    if new.last_name is distinct from old.last_name
       and length(btrim(coalesce(new.last_name, ''))) not between 1 and 60 then
      raise exception 'invalid_name';
    end if;
    if new.employment is distinct from old.employment
       and length(btrim(coalesce(new.employment, ''))) not between 1 and 100 then
      raise exception 'invalid_employment';
    end if;
  end if;
  return new;
end $$;

-- A new argument changes the signature, so drop and recreate (precedent:
-- 20260728100000_personal_id_at_membership.sql): one overload each, never two. The
-- default keeps an old three-argument named call resolvable. Bodies restate the live
-- definitions (register: 20260728142000; register_google: 20260811182202) verbatim
-- apart from the consent lines.
drop function public.register_google(text, text, text);
drop function public.register(text, text, text);

create function register(
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
  -- Privacy consent (spec 2026-10-08 section 6), step 1 of 2: a version that is sent
  -- must be the current one; a missing version is still accepted until step 2.
  if p_privacy_version is not null and p_privacy_version <> '2026-10-v1' then
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
        case when p_privacy_version is null then null else now() end, p_privacy_version
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

create function public.register_google(
  p_first_name text,
  p_last_name text,
  p_ref_code text default null,
  p_privacy_version text default null
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

  return public.register(p_first_name, p_last_name, p_ref_code, p_privacy_version);
end $$;
revoke execute on function public.register_google(text, text, text, text) from public, anon;
grant execute on function public.register_google(text, text, text, text) to authenticated, service_role;
