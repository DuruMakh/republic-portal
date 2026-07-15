-- Phase 3: cabinets. Spec: docs/superpowers/specs/2026-07-15-phase-3-cabinets-design.md
-- Mixed access model (ADR-013): column-scoped grant for plain profile fields;
-- SECURITY DEFINER RPCs for compound/protected mutations and delegate reads.

-- 1) Scoped profile re-grant (spec §4.1) --------------------------------------
-- Three independent locks: this column list (anything else is 42501), the
-- Phase-0 "own profile updatable" RLS policy (kept dormant by Phase 2 exactly
-- for this), and protect_profile_columns() as depth against grant-widening.
-- No insert/delete grants — profile creation stays funnel-only.
grant update (first_name, last_name, region_id, city_id, employment)
  on profiles to authenticated;

-- 2) funnel_state(): + status, registrationCompletedAt (additive; spec §4.6) --
create or replace function funnel_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate public.delegates%rowtype;
  v_has_delegate boolean := false;
  v_role text;
  v_referral jsonb;
  v_chosen jsonb;
  v_membership_exists boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then return jsonb_build_object('exists', false); end if;

  select * into v_delegate from public.delegates where id = v_uid;
  v_has_delegate := found;
  v_role := case when v_has_delegate then 'delegate' else v_profile.signup_role end;

  if v_role = 'member' and v_profile.signup_ref_code is not null then
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
    'role', v_role,
    'firstName', v_profile.first_name,
    'lastName', v_profile.last_name,
    'personalIdSet', v_profile.personal_id is not null,
    'birthDate', v_profile.birth_date,
    'regionId', v_profile.region_id,
    'cityId', v_profile.city_id,
    'employment', v_profile.employment,
    'tier', v_profile.membership_tier,
    'referenceCode', v_profile.reference_code,
    'completed', v_profile.registration_completed_at is not null
                 or v_profile.status = 'active_member',
    -- Phase 3 (spec §4.6): cabinet needs the raw status + timestamps
    'status', v_profile.status::text,
    'registrationCompletedAt', v_profile.registration_completed_at,
    'createdAt', v_profile.created_at,
    'delegateStatus', case when v_has_delegate then v_delegate.status::text end,
    'referral', v_referral,
    'chosenDelegate', v_chosen,
    'membershipExists', coalesce(v_membership_exists, false)
  );
end $$;

-- 3) funnel_start(): p_ref_code cap rider (spec §4.6) --------------------------
-- Identical to Phase 2 except referral input is charset/length-checked and
-- silently nulled when invalid (matching invalid-referral-degrades-silently).
create or replace function funnel_start(
  p_first_name text,
  p_last_name text,
  p_role text,
  p_ref_code text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_status public.member_status;
  v_completed timestamptz;
  v_ref text := nullif(btrim(coalesce(p_ref_code, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_role is null or p_role not in ('member', 'delegate') then
    raise exception 'invalid_role';
  end if;
  if p_first_name is null or length(btrim(p_first_name)) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name)) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  -- Phase 3 rider (spec §4.6): mirrors lib isReferralCodeCandidate
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9-]{1,32}$' then
    v_ref := null;
  end if;

  select status, registration_completed_at into v_status, v_completed
    from public.profiles where id = v_uid;

  if not found then
    -- canonical phone format is E.164 with '+'; Supabase auth stores it without
    select case
             when u.phone is null then null
             when left(u.phone, 1) = '+' then u.phone
             else '+' || u.phone
           end
      into v_phone
      from auth.users u where u.id = v_uid;
    insert into public.profiles
      (id, first_name, last_name, phone, status, signup_role, signup_ref_code)
    values (
      v_uid, btrim(p_first_name), btrim(p_last_name), v_phone, 'draft', p_role,
      case when p_role = 'member' then v_ref end
    );
  elsif v_completed is null and v_status <> 'active_member' then
    update public.profiles set
      first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      -- path + referral only change while nothing role-specific exists yet (spec §4.3)
      signup_role = case when status = 'draft' then p_role else signup_role end,
      signup_ref_code = case
        when status <> 'draft' then signup_ref_code
        when p_role = 'delegate' then null
        else coalesce(v_ref, signup_ref_code)
      end
    where id = v_uid;
  end if;
  -- completed profiles: no-op; state below routes them onward

  return public.funnel_state();
end $$;

-- 4) member_change_delegate (spec §4.2) ----------------------------------------
create function member_change_delegate(p_delegate_id uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_target uuid;
  v_open_delegate uuid;
  v_has_open boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'not_completed'; end if;
  if v_profile.registration_completed_at is null
     and v_profile.status <> 'active_member' then
    raise exception 'not_completed';
  end if;
  if exists (select 1 from public.delegates d where d.id = v_uid) then
    raise exception 'not_a_member'; -- delegates hold no membership (spec §3.1)
  end if;

  v_target := null;
  if p_delegate_id is not null then
    select d.id into v_target from public.delegates d
      where d.id = p_delegate_id and d.status = 'approved';
    if v_target is null then raise exception 'invalid_delegate'; end if;
  end if;

  select m.delegate_id, true into v_open_delegate, v_has_open
    from public.memberships m
    where m.member_id = v_uid and m.ended_at is null;

  if not coalesce(v_has_open, false) then
    insert into public.memberships (member_id, delegate_id) values (v_uid, v_target);
  elsif v_open_delegate is distinct from v_target then
    -- close-then-open, same pattern as funnel_save_profile: history never deleted
    update public.memberships set ended_at = now()
      where member_id = v_uid and ended_at is null;
    insert into public.memberships (member_id, delegate_id) values (v_uid, v_target);
  end if; -- same target: no-op, no history row minted (spec §4.2)

  return public.funnel_state();
end $$;

-- 5) member_change_tier (spec §4.3) ----------------------------------------------
-- Members AND delegates (both pay). Definer context passes the protect trigger,
-- exactly like funnel_complete. Reference code and completion stamp untouched.
create function member_change_tier(p_tier int) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'not_completed'; end if;
  if v_profile.registration_completed_at is null
     and v_profile.status <> 'active_member' then
    raise exception 'not_completed';
  end if;
  if p_tier is null or p_tier not in (5, 10, 20) then raise exception 'invalid_tier'; end if;

  update public.profiles set membership_tier = p_tier where id = v_uid;
  return public.funnel_state();
end $$;

-- 6) delegate_panel (spec §4.4) ---------------------------------------------------
-- The ONLY client path to the caller's own referral_code — no table grant, no
-- public view exposes it (Phase 2's non-harvestable stance holds).
create function delegate_panel() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_delegate from public.delegates where id = v_uid;
  if not found then raise exception 'not_a_delegate'; end if;

  return jsonb_build_object(
    'status', v_delegate.status::text,
    'referralCode', v_delegate.referral_code,
    'activeCount', (select count(*)
                      from public.memberships m
                      join public.profiles p on p.id = m.member_id
                      where m.delegate_id = v_uid and m.ended_at is null
                        and p.status = 'active_member'),
    'totalCount', (select count(*)
                     from public.memberships m
                     where m.delegate_id = v_uid and m.ended_at is null),
    -- opened the link, started step 1, not yet reached step 2; from step 2 on
    -- they appear in the membership counts instead — no double counting
    'draftCount', (select count(*)
                     from public.profiles p
                     where p.signup_ref_code = v_delegate.referral_code
                       and p.status = 'draft')
  );
end $$;

-- 7) delegate_team (spec §4.5) ------------------------------------------------------
-- Names, dates, statuses only — no phones, no personal IDs, no tiers, no money.
create function delegate_team() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_team jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.delegates d where d.id = v_uid) then
    raise exception 'not_a_delegate';
  end if;

  select coalesce(
      jsonb_agg(jsonb_build_object(
        'firstName', p.first_name,
        'lastName', p.last_name,
        'registeredAt', p.created_at,
        'status', p.status::text
      ) order by p.created_at desc),
      '[]'::jsonb)
    into v_team
    from public.memberships m
    join public.profiles p on p.id = m.member_id
    where m.delegate_id = v_uid and m.ended_at is null;

  return v_team;
end $$;

-- 8) Grants (house pattern: authenticated only; Postgres grants new functions
-- to PUBLIC by default, so the explicit revoke matters) -------------------------
grant execute on function member_change_delegate(uuid) to authenticated;
revoke execute on function member_change_delegate(uuid) from public, anon;
grant execute on function member_change_tier(int) to authenticated;
revoke execute on function member_change_tier(int) from public, anon;
grant execute on function delegate_panel() to authenticated;
revoke execute on function delegate_panel() from public, anon;
grant execute on function delegate_team() to authenticated;
revoke execute on function delegate_team() from public, anon;
-- funnel_state / funnel_start were CREATE OR REPLACEd: existing grants survive
-- replacement (Postgres preserves ACLs on replace), so no re-grant needed.
