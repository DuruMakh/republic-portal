-- Owner fix list #10 (clarified 2026-07-28): the personal ID moves from first
-- registration (/join) to the become-a-member step. register() stops taking it;
-- become_member_save_profile() takes it (validated, immutable once set);
-- become_member_complete() refuses to mint a member without one. cabinet_state()
-- exposes hasPersonalId so the wizard knows whether to render the field —
-- authenticated cannot SELECT personal_id itself.
--
-- SECURITY: LB-1 (personal-ID squatting, deferred by owner 2026-07-26) is NOT
-- closed by this — the squat window moves to the membership step. The restated
-- register() body ALSO carries the ADR-021 null-phone guard (phone_required):
-- this migration outdates the security branch's register(), and omitting the
-- guard here would revert that branch's fix at merge time. Its PLACEMENT also
-- differs from 20260726121000_register_phone_guard.sql, where it deliberately
-- sat immediately after the already-exists return so it would precede
-- register()'s personal-ID duplicate-check oracle — here it sits after the
-- invalid_name/ref-code checks instead, which stays safe only because that
-- oracle no longer lives in register() at all (it moved to
-- become_member_save_profile below), so no DB read runs unguarded ahead of
-- phone_required in the body that follows.
--
-- CORRECTION (task-9 execution, verified against the actual migration history
-- in this worktree — for the PR body / security-branch reviewer): the ADR-021
-- guard's migration (20260726121000_register_phone_guard.sql) is NOT a still-
-- open, racing branch — it is ALREADY an ancestor of this branch (and of main),
-- so there is no merge-order race to reconcile; this migration simply
-- supersedes it in the normal timestamp sequence. register()'s body below was
-- checked line-by-line against every register() revision between
-- 20260721120000 and 20260726121000 (20260722120000's race-safe
-- CONSTRAINT_NAME dispatch, 20260722140000's whitespace-aware btrim + upper()
-- ref-code normalization, 20260726121000's phone guard): the whitespace/upper
-- fixes and the phone guard all carry forward; the CONSTRAINT_NAME dispatch
-- for a `profiles_personal_id_key` collision does NOT, because it is now
-- unreachable — this register() no longer inserts personal_id at all, so that
-- specific race can no longer occur here (become_member_save_profile's own
-- new unique_violation wrap below covers the same race at its new location).
--
-- NOTE (verification of source line ranges, task-9 execution): the plan's
-- citation for become_member_complete's VERBATIM source range
-- (20260721120000_progressive_registration.sql:529-614) overshoots the actual
-- function body, which ends at line 581 (`end $$;`) — lines 583-614 are the
-- UNRELATED member_rsvp() function + the member_event_going_counts view, not
-- part of become_member_complete. The body restated below is copied from the
-- function's real, unambiguous boundaries (529-581); cabinet_state's citation
-- (333-413) and become_member_save_profile's citation (468-524) were both
-- verified exact against the source file. Flagged for reviewer confirmation.

-- 1) register(): 3-arg replacement. Old 4-arg overload dropped explicitly —
--    create-or-replace with a different signature would ADD an overload and
--    leave the ID door open.
drop function register(text, text, text, text);

create function register(
  p_first_name text,
  p_last_name text,
  p_ref_code text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_ref text := nullif(btrim(coalesce(p_ref_code, ''), E' \t\r\n'), '');
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

  begin
    insert into public.profiles (id, first_name, last_name, phone, status, signup_ref_code)
    values (
      v_uid, btrim(p_first_name, E' \t\r\n'), btrim(p_last_name, E' \t\r\n'),
      v_phone, 'registered', v_ref
    );
  exception when unique_violation then
    -- profiles_pkey: double-submit race — the row now exists, report state
    if exists (select 1 from public.profiles where id = v_uid) then
      return public.cabinet_state() || jsonb_build_object('created', false);
    end if;
    raise;
  end;

  return public.cabinet_state() || jsonb_build_object('created', true);
end $$;

grant execute on function register(text, text, text) to authenticated;
revoke execute on function register(text, text, text) from public, anon;

-- 2) become_member_save_profile(): +p_personal_id. Different signature → drop
--    the old 5-arg version first, restate grants for the new one. Body copied
--    VERBATIM from 20260721120000_progressive_registration.sql:468-524, plus
--    exactly the three insertions below (signature, validation block, update
--    column + race-guard wrap).
drop function become_member_save_profile(date, int, int, text, uuid);

create function become_member_save_profile(
  p_birth_date date,
  p_region_id int,
  p_city_id int,
  p_employment text,
  p_delegate_id uuid default null,
  p_personal_id text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate uuid;
  v_constraint text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;
  if v_profile.registration_completed_at is not null
     or v_profile.status = 'active_member' then
    raise exception 'already_completed';
  end if;

  if p_birth_date is null or p_birth_date >= public.tbilisi_today()
     or p_birth_date < date '1900-01-01' then
    raise exception 'invalid_birth_date';
  end if;
  if p_employment is null or length(btrim(p_employment)) not between 1 and 100 then
    raise exception 'invalid_employment';
  end if;
  if not exists (
    select 1 from public.cities c where c.id = p_city_id and c.region_id = p_region_id
  ) then
    raise exception 'invalid_city';
  end if;

  -- Owner fix #10: the ID is captured here now. Immutable once set — a
  -- provided value for a profile that already has one is IGNORED (idempotent
  -- resume), never overwritten. Uniqueness double-checked at the constraint.
  if v_profile.personal_id is null then
    if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
      raise exception 'invalid_personal_id';
    end if;
    if exists (select 1 from public.profiles pr where pr.personal_id = p_personal_id) then
      raise exception 'duplicate_personal_id';
    end if;
  end if;

  v_delegate := null;
  if v_profile.signup_ref_code is not null then
    select d.id into v_delegate
      from public.delegates d
      where d.referral_code = v_profile.signup_ref_code and d.status = 'approved';
  end if;
  if v_delegate is null and p_delegate_id is not null then
    select d.id into v_delegate
      from public.delegates d
      where d.id = p_delegate_id and d.status = 'approved';
    if v_delegate is null then raise exception 'invalid_delegate'; end if;
  end if;

  begin
    update public.profiles set
      birth_date = p_birth_date,
      region_id = p_region_id,
      city_id = p_city_id,
      employment = btrim(p_employment),
      -- review fix F3: coalesce against the COLUMN, not v_profile.personal_id.
      -- v_profile was snapshotted by the plain `select` above, before this
      -- statement takes the row lock — under a concurrent double-save both
      -- callers' v_profile.personal_id still reads the pre-race null. The
      -- bare column reference is re-evaluated against the row as it stands
      -- once the lock is held (Postgres re-checks UPDATE expressions against
      -- the latest committed version), so whichever caller's write lands
      -- SECOND correctly preserves the FIRST caller's value instead of
      -- clobbering it with its own p_personal_id.
      personal_id = coalesce(personal_id, p_personal_id),
      pending_delegate_id = v_delegate
    where id = v_uid;
  exception when unique_violation then
    -- two save-profile calls racing the same ID past the pre-check above —
    -- dispatch on CONSTRAINT_NAME (register()'s idiom, 20260722140000 §1)
    -- rather than assuming: this UPDATE's SET list only touches one unique
    -- column (personal_id), but re-raising anything else unrecognized keeps
    -- an unrelated future collision from being mislabeled as a duplicate ID.
    get stacked diagnostics v_constraint = CONSTRAINT_NAME;
    if v_constraint = 'profiles_personal_id_key' then
      raise exception 'duplicate_personal_id';
    else
      raise;
    end if;
  end;

  return public.cabinet_state();
end $$;

grant execute on function become_member_save_profile(date, int, int, text, uuid, text) to authenticated;
revoke execute on function become_member_save_profile(date, int, int, text, uuid, text) from public, anon;

-- 3) become_member_complete(): same signature (no drop; grants survive
--    create-or-replace automatically, but restated below anyway per house
--    style — every function this migration touches gets an explicit
--    grant/revoke, same as register() and become_member_save_profile()
--    above). Body copied from become_member_complete's actual, unambiguous
--    boundaries in 20260721120000_progressive_registration.sql (create
--    function ... end $$; at lines 529-581 — see the NOTE at the top of this
--    file), plus exactly the one `or v_profile.personal_id is null` insertion
--    below.
create or replace function become_member_complete(p_tier int) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate uuid;
  v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;
  if v_profile.registration_completed_at is not null then
    return public.cabinet_state();
  end if;
  if v_profile.birth_date is null or v_profile.region_id is null
     or v_profile.city_id is null or v_profile.employment is null
     or v_profile.personal_id is null then
    raise exception 'profile_incomplete';
  end if;
  if p_tier is null or p_tier not in (5, 10, 20) then raise exception 'invalid_tier'; end if;

  -- re-validate the held choice; a delegate who lost approval falls back to central
  select d.id into v_delegate
    from public.delegates d
    where d.id = v_profile.pending_delegate_id and d.status = 'approved';

  if not exists (
    select 1 from public.memberships m where m.member_id = v_uid and m.ended_at is null
  ) then
    begin
      insert into public.memberships (member_id, delegate_id) values (v_uid, v_delegate);
    exception when unique_violation then
      null; -- concurrent double-complete: the partial unique index already holds the row
    end;
  end if;

  loop
    v_code := 'GR-' || public.gen_funnel_code(6);
    begin
      update public.profiles set
        membership_tier = p_tier,
        reference_code = v_code,
        registration_completed_at = now(),
        status = case when status = 'registered' then 'profile_completed' else status end,
        pending_delegate_id = null
      where id = v_uid;
      exit;
    exception when unique_violation then
      -- reference_code collision — regenerate and retry
    end;
  end loop;

  return public.cabinet_state();
end $$;

grant execute on function become_member_complete(int) to authenticated;
revoke execute on function become_member_complete(int) from public, anon;

-- 4) cabinet_state(): same signature (no drop; grants restated below, same
--    house-style reasoning as become_member_complete() above). Body copied
--    VERBATIM from 20260721120000_progressive_registration.sql:333-413, plus
--    exactly the one 'hasPersonalId' key insertion below.
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
