-- Owner fix list #12 (2026-07-27): every registered person gets a countable
-- referral link, not just approved delegates.
--
-- COLLISION SAFETY: delegate codes are 6 chars from gen_funnel_code's
-- [A-HJKMNP-Z2-9] alphabet and payment references are 'GR-' || 6 chars. Member
-- codes are 'M-' || 6 chars from the same alphabet. A hyphen cannot occur inside a
-- delegate code, so a signup_ref_code can never be ambiguous between the two
-- tables — attribution is exact by construction, not by a cross-table lookup.
--
-- SOURCE VERIFICATION (task-5 execution): register() and cabinet_state() are
-- restated VERBATIM (plus only the insertions noted at each) from the LIVE
-- definitions, confirmed by scanning every migration under supabase/migrations/
-- for `create [or replace] function` against these three names, in timestamp
-- order, and taking the latest hit for each name:
--   register()       -> 20260728100000_personal_id_at_membership.sql:52-111
--   cabinet_state()   -> 20260728100000_personal_id_at_membership.sql:293-374
--   delegate_panel()  -> 20260722120000_r2_ladder_and_numbers.sql:262-290
-- No migration after 20260728100000 (i.e. neither 20260728140000 nor
-- 20260728141000, both already on this branch) redefines any of the three —
-- 20260728141000 only *calls* cabinet_state() from become_member_complete(),
-- it does not redefine it. register()/cabinet_state() restate their grants
-- below (same house style 20260728100000 itself uses for become_member_complete
-- and cabinet_state); delegate_panel()'s own most recent redefinition does not
-- restate grants, so none are added here either — its signature is unchanged
-- and grants already survive a plain create-or-replace.
--
-- protect_profile_columns() CORRECTION + DECISION (Fix 4, owner fix-list round 2):
-- this comment originally claimed `revoke update on profiles from authenticated`
-- (20260715120000 §3) removes ALL client UPDATE privilege on profiles table-wide.
-- That is FALSE and would mislead a future reader: 20260715213000_cabinets.sql:
-- 10-11 re-grants scoped UPDATE on (first_name, last_name, region_id, city_id,
-- employment) to authenticated, and that same migration's own header names
-- protect_profile_columns() as the reason a real client UPDATE path needs
-- independent depth in the first place ("protect_profile_columns() as depth
-- against grant-widening"). The TRUE reason referral_code can't be written by a
-- direct client UPDATE is narrower and purely column-level: that scoped grant's
-- column list does not include referral_code, so naming it in an UPDATE ... SET
-- list is refused with 42501 regardless of RLS or the trigger. DECISION:
-- referral_code IS added to protect_profile_columns()'s guarded list below
-- anyway (the create-or-replace immediately after this column is added) — same
-- treatment as reference_code, its structurally identical sibling (unique,
-- server-minted, immutable). No legitimate codepath ever updates referral_code
-- as anon/authenticated (register() sets it once, as its owner, at insert time;
-- nothing updates it after), so this is pure depth, not a fix to a live gap —
-- but it keeps referral_code covered if a future migration ever widens the
-- scoped grant by mistake, exactly like every other server-managed column this
-- table has gained (reference_code, membership_tier, pending_delegate_id, ...).
--
-- OWNER DECISION (2026-07-29, code review of this same migration, pre-push):
-- referralCount SUMS both codes instead of counting whichever single code is
-- currently "active." The original "one person, one link" design below
-- (SOURCE VERIFICATION section) picks exactly one code per person: an
-- approved delegate's delegate code, or everyone else's own profile code.
-- Review surfaced a real consequence of that design: a member who
-- accumulates N sign-ups on their own M- link and is LATER approved as a
-- delegate would see referralCount silently reset to 0 the instant
-- referralCode switches to the delegate code — those N attributions become
-- permanently invisible, even though the rows are still sitting in
-- profiles.signup_ref_code, unchanged, forever. The owner's decision: keep
-- the DISPLAYED LINK exactly as designed (still the delegate code once
-- approved) but widen referralCount in cabinet_state() and delegate_panel()
-- to count sign-ups matching EITHER the person's own profile referral_code
-- OR (for an approved delegate) their delegate referral_code. Detail and the
-- NULL-handling rationale live at each changed key, below — do not
-- "simplify" this back to a single coalesce()/single code; that would
-- silently reintroduce the exact data loss this decision fixes.
alter table profiles add column referral_code text unique
  check (referral_code ~ '^M-[A-HJKMNP-Z2-9]{6}$');

-- protect_profile_columns(): restates the LIVE body (its latest redefinition,
-- 20260721120000_progressive_registration.sql:54-85) verbatim, plus
-- referral_code in the guarded list — the same house pattern every prior
-- server-managed profiles column followed (signup_role/signup_ref_code/
-- membership_tier/reference_code/registration_completed_at at 20260715120000,
-- pending_delegate_id at 20260721120000). The trigger only fires BEFORE UPDATE
-- (20260712212409_initial_schema.sql:114-115), never INSERT, so this has no
-- effect on register()'s insert or on the service-role DEFAULT added below.
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

create function mint_member_referral_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_code text;
begin
  for i in 1..20 loop
    v_code := 'M-' || public.gen_funnel_code(6);
    if not exists (select 1 from public.profiles where referral_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'referral_code_exhausted';
end $$;

revoke execute on function mint_member_referral_code() from public, anon, authenticated;

-- Backfill every existing profile, one row at a time (Fix 5, owner fix-list
-- round 2). A per-row loop makes each pass monotonically progressive: a
-- collision on one row's draw retries only that row (its own inner attempt,
-- bounded at 20 like mint_member_referral_code()'s own cap), never discarding
-- any other row's already-committed code. The whole-table redraw this replaced
-- does not scale — the reviewer's arithmetic: at ~10k profiles a single
-- whole-table pass collides ~6% of the time; at ~100k it succeeds only ~0.4% of
-- the time, and the fixed 20-pass ceiling would abort the migration outright.
-- The final count below stays as the convergence backstop: it still raises
-- before `set not null` if any row genuinely never got a code (astronomically
-- unlikely against the 31^6 ≈ 887M-code space this alphabet gives 6 characters).
do $$
declare
  r record;
  v_left int;
begin
  for r in select id from public.profiles where referral_code is null loop
    for i in 1..20 loop
      begin
        update public.profiles set referral_code = public.mint_member_referral_code()
         where id = r.id;
        exit;
      exception when unique_violation then
        null; -- this row's draw collided with another row — retry with a fresh one
      end;
    end loop;
  end loop;

  select count(*) into v_left from public.profiles where referral_code is null;
  if v_left <> 0 then
    raise exception 'referral_code backfill did not converge: % rows left', v_left;
  end if;
end $$;

-- Fix 1 (Critical, owner fix-list round 2): nine service-role insert paths never
-- learned about this column — scripts/seed-staging.mjs, scripts/verify-schema.mjs
-- (four call sites), scripts/verify-security-fixes.mjs, scripts/security/arguments.mjs
-- (an upsert — Postgres validates NOT NULL on the row it constructs before an
-- ON CONFLICT branch is even considered, so an upsert is exposed exactly like a
-- plain insert), and e2e/funnel-helpers.ts's seedCompletedMember/seedRegisteredMember
-- (the latter also backs seedPendingDelegate). Only register() was taught to supply
-- referral_code explicitly. With no DEFAULT, every one of those writes would fail
-- 23502 the instant `set not null` below lands. A DEFAULT means a service-role
-- writer never has to know this column exists at all: register()'s own explicit
-- value in its insert list still wins over the DEFAULT unchanged (an explicit
-- INSERT value always overrides a column DEFAULT), so its
-- profiles_referral_code_key retry loop above is unaffected either way.
-- service_role is a role distinct from public/anon/authenticated, so granting it
-- EXECUTE here is additive alongside the revoke above, not a reversal of it — and
-- it is required: evaluating a column DEFAULT runs under the INSERTing role's own
-- privileges, not mint_member_referral_code()'s SECURITY DEFINER context, so
-- service_role needs its own EXECUTE grant to trigger the default at all.
alter table profiles alter column referral_code set default public.mint_member_referral_code();
grant execute on function mint_member_referral_code() to service_role;

alter table profiles alter column referral_code set not null;

-- The count query runs on every cabinet render; the earlier per-status index
-- (20260716140000:89) is partial on a single status value and cannot serve this
-- unfiltered lookup.
create index if not exists profiles_by_signup_ref_code
  on public.profiles (signup_ref_code);

-- Fix 6 (Minor, owner fix-list round 2): profiles_draft_by_ref_code
-- (20260716140000:89-90) indexed the same signup_ref_code column, filtered to
-- one status value; the unfiltered index just above is its superset, so the
-- old partial index is now dead weight on every profile write.
drop index if exists profiles_draft_by_ref_code;

-- 1) register(): same 3-arg signature as the live definition, so create-or-
--    replace — no drop, grants restated below anyway (house style). Body
--    VERBATIM from 20260728100000_personal_id_at_membership.sql:52-111 except:
--    the insert's column/value list gains referral_code /
--    mint_member_referral_code(), AND the single insert + blanket "any
--    unique_violation is profiles_pkey" handler is replaced with a bounded
--    retry loop dispatching on CONSTRAINT_NAME. Reason: the live handler
--    assumes profiles_pkey is the ONLY unique column this insert can collide
--    on — true today, but this migration adds a SECOND one (referral_code).
--    Copying the handler verbatim would silently reintroduce the exact bug
--    class 20260722140000_r2_review_fixes.sql already fixed twice: once for
--    register()'s own personal_id (§1: profiles_personal_id_key vs
--    profiles_pkey dispatch) and once for request_delegacy()'s referral_code
--    (§2: delegates_referral_code_key, retry with a fresh code). The shape
--    below is that same idiom applied to profiles_referral_code_key — a
--    concurrent register() drawing the identical code
--    mint_member_referral_code()'s own pre-check just missed retries with a
--    fresh draw (bounded at 20, matching that function's own attempt cap);
--    profiles_pkey keeps the original double-submit behavior unchanged.
create or replace function register(
  p_first_name text,
  p_last_name text,
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
      insert into public.profiles (id, first_name, last_name, phone, status, signup_ref_code, referral_code)
      values (
        v_uid, btrim(p_first_name, E' \t\r\n'), btrim(p_last_name, E' \t\r\n'),
        v_phone, 'registered', v_ref, public.mint_member_referral_code()
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

grant execute on function register(text, text, text) to authenticated;
revoke execute on function register(text, text, text) from public, anon;

-- 2) cabinet_state(): same signature, create-or-replace, grants restated below
--    (house style). Body VERBATIM from
--    20260728100000_personal_id_at_membership.sql:293-374 except the two new
--    keys inserted right after 'hasPersonalId', PLUS the OWNER DECISION
--    (2026-07-29, see header) reworking referralCount. One person, one LINK:
--    an approved delegate's referralCode stays their delegate code (which
--    also binds delegacy); everyone else's is their own profile code — that
--    part of the design is unchanged. referralCount, however, now SUMS
--    sign-ups matching either code instead of picking one, so a member's
--    sign-ups earned before approval survive their later approval as a
--    delegate. Full detail at the key itself, below.
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
    -- the 'M-' prefix per the check constraint above), so no single p2 row
    -- can satisfy both arms of the OR at once.
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

-- 3) delegate_panel(): same signature, create-or-replace. Body VERBATIM from
--    20260722120000_r2_ladder_and_numbers.sql:262-290 except one new key added
--    after 'registeredCount', PLUS the OWNER DECISION (2026-07-29, see header)
--    widening that new key. registeredCount is UNCHANGED and stays distinct:
--    it counts only status = 'registered' sign-ups via the delegate code.
--    referralCount counts every sign-up the delegate code produced, PLUS
--    every sign-up the delegate's own profile code produced (typically from
--    before they were approved, when their only shareable link was their M-
--    profile code) — the same sum-both-codes decision as cabinet_state()
--    above, and for the same reason: without it, sign-ups earned pre-approval
--    would never appear anywhere a delegate can see them. A profile row for
--    the caller is brought into scope below (same id as v_delegate,
--    guaranteed by the delegates(id) references profiles(id) FK) to read
--    that second code.
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
    -- this migration's own `set not null` above, so unlike cabinet_state()'s
    -- analogous OR, neither side of this comparison can ever be NULL — but
    -- the two codes still can never collide (delegate codes are a bare
    -- 6-char gen_funnel_code draw with no hyphen; profile codes always carry
    -- the 'M-' prefix), so no single row can satisfy both arms and be
    -- double-counted.
    'referralCount', (select count(*)
                        from public.profiles p
                       where p.signup_ref_code = v_delegate.referral_code
                          or p.signup_ref_code = v_profile.referral_code)
  );
end $$;
