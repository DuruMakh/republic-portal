-- Owner decision (2026-07-29): referralCount in cabinet_state() and
-- delegate_panel() must SUM sign-ups matching EITHER the person's own M-
-- profile code OR (for an approved delegate) their delegate code, instead of
-- counting whichever single code is currently "active." Without this, a
-- member who accumulates N sign-ups on their own M- link and is LATER
-- approved as a delegate would see referralCount silently reset to 0 the
-- instant referralCode switches to the delegate code — those N attributions
-- become permanently invisible, even though the rows are still sitting in
-- profiles.signup_ref_code, unchanged, forever. The displayed link
-- (referralCode, in both functions) is UNCHANGED by this decision — still
-- the delegate code once approved, the profile code otherwise.
--
-- WHY THIS IS ITS OWN MIGRATION, NOT A FOLD-BACK INTO 20260728142000: this
-- decision was made in code review of that same migration, but by the time
-- of this fix 20260728142000 had ALREADY been pushed to and applied on the
-- owner's staging database (confirmed via `npx supabase migration list`:
-- 20260728140000/141000/142000/143000 all show local == remote). Supabase
-- tracks applied migrations by version, so 20260728142000 will never
-- re-run — editing that file in place would leave the file claiming summed
-- behavior while the live database keeps running the old single-code
-- version forever, an invisible file/database divergence. A prior pass on
-- this branch (commit d1c8bc7) mistakenly amended that already-applied file
-- in place; that amendment was reverted (the file now matches byte-for-byte
-- what was pushed) and this migration is the correction, restating the same
-- reviewed SQL and comments as a new, separately-versioned statement instead.
--
-- Both functions keep their existing signatures (returns jsonb, no
-- arguments), so this is a plain create-or-replace for each — no drop, and
-- existing grants on both survive automatically without restatement (see
-- the note at each function below for how this migration handles that).
--
-- Bodies below are copied verbatim from the LIVE definitions — i.e. exactly
-- what 20260728142000_member_referral_codes.sql defines today, which is what
-- is actually running on the database right now (confirmed: no migration
-- after it redefines either function; 20260728143000_admin_members_city.sql,
-- the only later migration on this branch, touches only the admin_members
-- view and admin_export_members()) — with only the two changes described
-- above applied at the referralCount key of each, plus (delegate_panel only)
-- a v_profile lookup so that function can read the caller's own profile
-- referral_code. The reworked referralCount SQL and its NULL-handling /
-- no-double-count comments are reused verbatim from commit d1c8bc7's
-- amendment (already written and reviewed there, before that commit's
-- migration-file edit was reverted for having landed on an already-pushed
-- file); the only edits are to cross-references that assumed same-file
-- placement (e.g. "the check constraint above") — those now name the file
-- they actually point to, since the reused text lives in a different
-- migration file than the constraint/statement it references.

-- 1) cabinet_state(): same signature, create-or-replace, grants restated
--    below — house style for this function every time it has been
--    redefined (20260721120000, 20260728100000, 20260728142000). Body
--    VERBATIM from 20260728142000_member_referral_codes.sql's live
--    definition except the 'referralCount' key, reworked per the owner
--    decision above.
create or replace function cabinet_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate public.delegates%rowtype;
  v_has_delegate boolean := false;
  v_standing text;
  v_referral jsonb;
  v_pending jsonb;
  v_chosen jsonb;
  v_membership_exists boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then return jsonb_build_object('exists', false); end if;

  select * into v_delegate from public.delegates where id = v_uid;
  v_has_delegate := found;
  v_standing := case
    when v_profile.registration_completed_at is not null
      or v_profile.status = 'active_member' then 'member'
    else 'registered'
  end;

  if not v_has_delegate and v_profile.signup_ref_code is not null then
    select jsonb_build_object(
        'firstName', pr.first_name,
        'lastName', pr.last_name,
        'regionNameKa', coalesce(r.name_ka, ''))
      into v_referral
      from public.delegates d
      join public.profiles pr on pr.id = d.id
      left join public.regions r on r.id = pr.region_id
      where d.referral_code = v_profile.signup_ref_code and d.status = 'approved';
  end if;

  if v_profile.pending_delegate_id is not null then
    select jsonb_build_object('id', d.id, 'firstName', pr.first_name, 'lastName', pr.last_name)
      into v_pending
      from public.delegates d
      join public.profiles pr on pr.id = d.id
      where d.id = v_profile.pending_delegate_id;
  end if;

  select true,
         case when m.delegate_id is null then null
              else jsonb_build_object(
                'id', m.delegate_id,
                'firstName', pr.first_name,
                'lastName', pr.last_name) end
    into v_membership_exists, v_chosen
    from public.memberships m
    left join public.profiles pr on pr.id = m.delegate_id
    where m.member_id = v_uid and m.ended_at is null;

  return jsonb_build_object(
    'exists', true,
    'standing', v_standing,
    'status', v_profile.status,
    'role', case when v_has_delegate then 'delegate' else 'member' end,
    'firstName', v_profile.first_name,
    'lastName', v_profile.last_name,
    'personalIdMasked', left(coalesce(v_profile.personal_id, ''), 3) || '********',
    'hasPersonalId', v_profile.personal_id is not null,
    'referralCode', coalesce(
      (select d.referral_code from public.delegates d
        where d.id = v_uid and d.status = 'approved'),
      v_profile.referral_code),
    -- OWNER DECISION (2026-07-29, see header): sum sign-ups matching EITHER
    -- the profile's own referral_code OR the approved-delegate code, instead
    -- of coalescing to a single code the way referralCode above still does.
    -- NULL handling (deliberate): the delegate subselect is NULL for anyone
    -- who is not an approved delegate, and `signup_ref_code = NULL` is NULL
    -- (never TRUE) — so the second OR arm silently contributes zero rows for
    -- non-delegates, leaving the count exactly p2.signup_ref_code =
    -- v_profile.referral_code, same as before this change for that
    -- population. No double-count risk either: a delegate referral_code and
    -- a profile referral_code can never be equal (delegate codes are a bare
    -- 6-char gen_funnel_code draw with no hyphen; profile codes always carry
    -- the 'M-' prefix per the check constraint in
    -- 20260728142000_member_referral_codes.sql), so no single p2 row can
    -- satisfy both arms of the OR at once.
    'referralCount', (select count(*) from public.profiles p2
                       where p2.signup_ref_code = v_profile.referral_code
                          or p2.signup_ref_code = (
                            select d.referral_code from public.delegates d
                              where d.id = v_uid and d.status = 'approved')),
    'birthDate', v_profile.birth_date,
    'regionId', v_profile.region_id,
    'cityId', v_profile.city_id,
    'employment', v_profile.employment,
    'tier', v_profile.membership_tier,
    'referenceCode', v_profile.reference_code,
    'completed', v_standing = 'member',
    'delegateStatus', case when v_has_delegate then v_delegate.status::text end,
    'referral', v_referral,
    'pendingDelegate', v_pending,
    'chosenDelegate', v_chosen,
    'membershipExists', coalesce(v_membership_exists, false),
    'registrationCompletedAt', v_profile.registration_completed_at,
    'createdAt', v_profile.created_at,
    'admin', exists (select 1 from public.admin_roles ar where ar.user_id = v_uid)
  );
end $$;

grant execute on function cabinet_state() to authenticated;
revoke execute on function cabinet_state() from public, anon;

-- 2) delegate_panel(): same signature, create-or-replace. Body VERBATIM from
--    20260728142000_member_referral_codes.sql's live definition except: (a)
--    a v_profile lookup added so the function can read the caller's own
--    profile referral_code, and (b) the 'referralCount' key reworked per the
--    owner decision above. registeredCount is UNRELATED and UNCHANGED —
--    it still counts only status = 'registered' sign-ups via the delegate
--    code alone.
--
--    No grant restatement here: this matches delegate_panel()'s own
--    precedent, not an oversight. Its signature is unchanged, so
--    create-or-replace preserves its existing grants automatically, and
--    every redefinition of this function since its original creation
--    (20260715213000_cabinets.sql:282-283, the only place its grants were
--    ever stated) has relied on exactly that — neither
--    20260722120000_r2_ladder_and_numbers.sql nor
--    20260728142000_member_referral_codes.sql restates them either.
create or replace function delegate_panel() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_delegate from public.delegates where id = v_uid;
  if not found then raise exception 'not_a_delegate'; end if;
  -- delegates.id references profiles(id) on delete cascade
  -- (20260712212409_initial_schema.sql:34), so having just found a
  -- delegates row for v_uid guarantees a profiles row for the same id
  -- exists too — no separate "not found" branch needed for this select.
  select * into v_profile from public.profiles where id = v_uid;

  return jsonb_build_object(
    'status', v_delegate.status::text,
    -- inactive until approval: null for pending/rejected so it can't be shared early
    'referralCode', case when v_delegate.status = 'approved'
                         then v_delegate.referral_code end,
    'activeCount', (select count(*)
                      from public.memberships m
                      join public.profiles p on p.id = m.member_id
                      where m.delegate_id = v_uid and m.ended_at is null
                        and p.status = 'active_member'),
    'totalCount', (select count(*)
                     from public.memberships m
                     where m.delegate_id = v_uid and m.ended_at is null),
    'registeredCount', (select count(*)
                          from public.profiles p
                          where p.signup_ref_code = v_delegate.referral_code
                            and p.status = 'registered'),
    -- OWNER DECISION (2026-07-29, see header and the comment above this
    -- function): sum sign-ups matching EITHER the delegate code OR this
    -- delegate's own profile referral_code. v_delegate.referral_code is
    -- NOT NULL by schema (delegates.referral_code text not null unique,
    -- initial_schema.sql:36) and v_profile.referral_code is NOT NULL by
    -- 20260728142000_member_referral_codes.sql's own `set not null`, so
    -- unlike cabinet_state()'s analogous OR, neither side of this
    -- comparison can ever be NULL — but the two codes still can never
    -- collide (delegate codes are a bare 6-char gen_funnel_code draw with no
    -- hyphen; profile codes always carry the 'M-' prefix), so no single row
    -- can satisfy both arms and be double-counted.
    'referralCount', (select count(*)
                        from public.profiles p
                       where p.signup_ref_code = v_delegate.referral_code
                          or p.signup_ref_code = v_profile.referral_code)
  );
end $$;
