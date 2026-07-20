-- Phase 6 R1: progressive registration.
-- Spec: docs/superpowers/specs/2026-07-21-progressive-registration-design.md §4, §6, §7.

-- 1) Staging cleanup (spec §7.1). Two classes of unfinishable rows go away:
--    a) delegate-path mid-registration abandoners: a delegates row with no
--       completion stamp. Under the new model delegacy sits ON TOP of
--       membership; a delegates-row + registered-standing hybrid would bounce
--       between /delegate and the delegate layout's redirect forever. They are
--       abandoned staging signups — remove them (profiles delete cascades the
--       delegates row; nothing references an unapproved delegate: only approved
--       delegates are choosable, and ADR-016 keeps incomplete ones unapprovable).
delete from profiles p
  where p.registration_completed_at is null
    and p.status <> 'active_member'
    and exists (select 1 from delegates d where d.id = p.id);
--    b) old-funnel step-1 abandoners: FUNNEL-created drafts never carry a
--       personal_id (funnel_save_profile set the ID and flipped status in one
--       statement). SEEDED draft rows (service-role, scripts/seed-staging.mjs)
--       DO carry an ID (+ region) — those deliberately survive and become
--       registered people in step 2; Task 8 reseeds staging properly anyway.
delete from profiles where status = 'draft' and personal_id is null;

-- 2) draft → registered. After (1) zero 'draft' rows remain, so this is a pure
--    label change; stored view/trigger expressions reference the enum internally
--    and are unaffected.
alter type member_status rename value 'draft' to 'registered';

-- 3) Wizard-choice column (server-managed; spec §4.3): step A's delegate pick,
--    validated again at completion.
alter table profiles add column pending_delegate_id uuid references delegates(id);

-- 4) Old mid-step-3 abandoners become mid-wizard registered people (spec §7.3):
--    carry the delegate choice over as the wizard prefill, close the premature
--    membership (backing is member-only, D1), reset the standing.
update profiles p set pending_delegate_id = m.delegate_id
  from memberships m
  where m.member_id = p.id and m.ended_at is null
    and p.status = 'profile_completed' and p.registration_completed_at is null;
update memberships m set ended_at = now()
  from profiles p
  where m.member_id = p.id and m.ended_at is null
    and p.status = 'profile_completed' and p.registration_completed_at is null;
update profiles set status = 'registered'
  where status = 'profile_completed' and registration_completed_at is null;

-- 5) No role at the door: signup_role is dead. (Legacy delegates keep their
--    delegates row; that IS the role.) No view references this column.
alter table profiles drop column signup_role;

-- 6) Server-managed column protection: minus signup_role, plus pending_delegate_id.
--    IMPORTANT: based on the LIVE hardened body (20260716140000 §1), which also
--    enforces value rules on the Phase-3 scoped-grant columns (they render on
--    PUBLIC pages) — that rider must survive this replacement.
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

-- 7) The funnel RPC surface is retired.
drop function funnel_start(text, text, text, text);
drop function funnel_save_profile(text, date, int, int, text, uuid, boolean);
drop function funnel_complete(int);
drop function funnel_state();

-- 7b) Late-bound dependents of the dropped/renamed surface (review finding —
--     plpgsql resolves names and enum literals at RUN time, so none of these
--     block the statements above; they would break at first call instead).
--     Recreate each one against the new surface, copying the LIVE body verbatim
--     from the named migration and applying exactly the listed change:
--
--     * member_change_delegate — copy 20260715213000_cabinets.sql §4; change the
--       final `return public.funnel_state();` → `return public.cabinet_state();`
--     * member_change_tier — copy 20260715213000_cabinets.sql §5; same
--       return-value change.
--     * delegate_panel — copy 20260716140000_cabinet_hardening.sql §2; change
--       the draftCount predicate `p.status = 'draft'` → `p.status = 'registered'`
--       (the jsonb key stays `draftCount` — churn control; the stat now honestly
--       means "registered via my code, not yet a member". The partial index
--       profiles_draft_by_ref_code survives the rename by OID and still serves
--       this predicate. The delegate-page LABEL change is Task 6.)
--     * recompute_member_active — copy 20260718100000_admin_crm_hardening.sql §1
--       (the LIVE tbilisi_today() body); change
--       `if not found or v_status = 'draft' then return;` → `... = 'registered' ...`
--       (registered people have no tier/payments — the engine keeps skipping them).
--     * recompute_all_active — copy 20260718100000_admin_crm_hardening.sql §1
--       (the LIVE tbilisi_today() body); change
--       `where p2.status <> 'draft'` → `where p2.status <> 'registered'`.
--     * admin_export_members — copy the live definition; change the p_status
--       whitelist `('draft', 'profile_completed', 'active_member')` →
--       `('registered', 'profile_completed', 'active_member')`.
--
--     All are `create or replace` with unchanged signatures and grants
--     (replacement preserves ACLs, so no re-grants here).

create or replace function member_change_delegate(p_delegate_id uuid default null) returns jsonb
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

  return public.cabinet_state();
end $$;

create or replace function member_change_tier(p_tier int) returns jsonb
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
  return public.cabinet_state();
end $$;

create or replace function delegate_panel() returns jsonb
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
    'draftCount', (select count(*)
                     from public.profiles p
                     where p.signup_ref_code = v_delegate.referral_code
                       and p.status = 'registered')
  );
end $$;

create or replace function recompute_member_active(p_member uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_status public.member_status;
  v_end date;
  v_new public.member_status;
begin
  select status into v_status from public.profiles where id = p_member;
  if not found or v_status = 'registered' then return; end if;
  v_end := public.active_coverage(p_member);
  v_new := case
    when v_end is not null and public.tbilisi_today() <= v_end + public.active_grace_days()
      then 'active_member'::public.member_status
    else 'profile_completed'::public.member_status
  end;
  if v_new is distinct from v_status then
    update public.profiles set status = v_new where id = p_member;
  end if;
end $$;

create or replace function recompute_all_active() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.profiles p set status = sub.new_status
  from (
    select p2.id,
           case
             when c.v_end is not null
                  and public.tbilisi_today() <= c.v_end + public.active_grace_days()
               then 'active_member'::public.member_status
             else 'profile_completed'::public.member_status
           end as new_status
    from public.profiles p2
    cross join lateral (select public.active_coverage(p2.id) as v_end) c
    where p2.status <> 'registered'
  ) sub
  where p.id = sub.id and p.status is distinct from sub.new_status;
end $$;

create or replace function admin_export_members(
  p_search text, p_region_id int, p_status text, p_include_ids boolean
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_status public.member_status;
  v_rows jsonb;
  v_count int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'finance') then
    raise exception 'missing_role';
  end if;
  if coalesce(p_include_ids, false) and not public.has_admin_role('super_admin') then
    raise exception 'missing_role'; -- IDs are super_admin-only (spec decision #6)
  end if;
  if v_search is not null and length(v_search) > 100 then raise exception 'invalid_target'; end if;
  if p_status is not null then
    if p_status not in ('registered', 'profile_completed', 'active_member') then
      raise exception 'invalid_target';
    end if;
    v_status := p_status::public.member_status;
  end if;

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb),
         count(*)::int
    into v_rows, v_count
  from (
    select p.created_at,
           jsonb_build_object(
             'firstName', p.first_name,
             'lastName', p.last_name,
             'phone', p.phone,
             'regionNameKa', r.name_ka,
             'cityNameKa', c.name_ka,
             'delegateName', case when m.delegate_id is null then null
                                  else dp.first_name || ' ' || dp.last_name end,
             'status', p.status::text,
             'tier', p.membership_tier,
             'referenceCode', p.reference_code,
             -- Tbilisi calendar day, fixed offset (house convention)
             'registeredAt', to_char(p.created_at + interval '4 hours', 'YYYY-MM-DD'))
           || case when coalesce(p_include_ids, false)
                   then jsonb_build_object('personalId', p.personal_id)
                   else '{}'::jsonb end as row_data
    from public.profiles p
    left join public.regions r on r.id = p.region_id
    left join public.cities c on c.id = p.city_id
    left join public.memberships m on m.member_id = p.id and m.ended_at is null
    left join public.profiles dp on dp.id = m.delegate_id
    where (v_search is null
           or p.first_name ilike '%' || v_search || '%'
           or p.last_name ilike '%' || v_search || '%'
           or p.phone ilike '%' || v_search || '%'
           or p.reference_code ilike '%' || v_search || '%')
      and (p_region_id is null or p.region_id = p_region_id)
      and (v_status is null or p.status = v_status)
  ) q;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.export', 'profile', null,
          jsonb_build_object(
            'search', v_search, 'regionId', p_region_id, 'status', p_status,
            'includeIds', coalesce(p_include_ids, false), 'rowCount', v_count));
  return v_rows;
end $$;

-- 8) Registered gate (spec §4.2): profile existence IS the registered standing —
--    register() only ever creates complete rows.
create function is_registered() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;
grant execute on function is_registered() to authenticated;
revoke execute on function is_registered() from public, anon;

-- 9) cabinet_state(): the one state read for every cabinet/registration surface.
create function cabinet_state() returns jsonb
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

-- 10) register(): the one-door light registration (spec §4.1). Atomic and
--     idempotent: an existing profile makes this a state read (duplicate phone =
--     the same auth user after OTP — never overwritten).
create function register(
  p_first_name text,
  p_last_name text,
  p_personal_id text,
  p_ref_code text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_ref text := nullif(btrim(coalesce(p_ref_code, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    -- duplicate phone after OTP: a state read, never an overwrite (spec §8)
    return public.cabinet_state() || jsonb_build_object('created', false);
  end if;
  if p_first_name is null or length(btrim(p_first_name)) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name)) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
    raise exception 'invalid_personal_id';
  end if;
  -- Phase 3 rider parity (20260715213000 §4.6): junk ref codes are silently dropped
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9-]{1,32}$' then
    v_ref := null;
  end if;
  if exists (select 1 from public.profiles pr where pr.personal_id = p_personal_id) then
    raise exception 'duplicate_personal_id';
  end if;

  select case
           when u.phone is null then null
           when left(u.phone, 1) = '+' then u.phone
           else '+' || u.phone
         end
    into v_phone
    from auth.users u where u.id = v_uid;

  insert into public.profiles (id, first_name, last_name, phone, personal_id, status, signup_ref_code)
  values (
    v_uid, btrim(p_first_name), btrim(p_last_name), v_phone, p_personal_id, 'registered', v_ref
  );

  return public.cabinet_state() || jsonb_build_object('created', true);
end $$;

-- 11) Wizard step A (spec §4.3): fields + delegate pick; standing stays registered.
--     Stored approved referral wins over the picker — same precedence as Phase 2.
create function become_member_save_profile(
  p_birth_date date,
  p_region_id int,
  p_city_id int,
  p_employment text,
  p_delegate_id uuid default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate uuid;
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

  update public.profiles set
    birth_date = p_birth_date,
    region_id = p_region_id,
    city_id = p_city_id,
    employment = btrim(p_employment),
    pending_delegate_id = v_delegate
  where id = v_uid;

  return public.cabinet_state();
end $$;

-- 12) Wizard step B (spec §4.3): tier → membership row + reference code + member
--     standing, in one transaction. Membership creation lives HERE (D1), not in
--     profile-save. Idempotent like the old funnel_complete.
create function become_member_complete(p_tier int) returns jsonb
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
     or v_profile.city_id is null or v_profile.employment is null then
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

-- 13) Gate widening (spec §4.2, D3): RSVP + going counts are registered-level.
--     Everything else keeps is_completed_member().
create or replace function member_rsvp(p_event_id uuid, p_going boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'not_completed'; end if;
  if p_going is null then raise exception 'invalid_status'; end if;
  select * into v_event from public.events where id = p_event_id;
  if not found or v_event.status = 'draft' then raise exception 'invalid_target'; end if;
  if v_event.status = 'cancelled' or v_event.starts_at <= now() then
    raise exception 'rsvp_closed';
  end if;

  insert into public.event_rsvps (event_id, member_id, status)
  values (p_event_id, v_uid, case when p_going then 'going' else 'cancelled' end)
  on conflict (event_id, member_id)
  do update set status = excluded.status;
end $$;

create or replace view member_event_going_counts as
select e.id as event_id,
       count(r.member_id) filter (where r.status = 'going')::int as going
from events e
left join event_rsvps r on r.event_id = e.id
where e.status in ('published', 'cancelled') and is_registered()
group by e.id;

-- 14) Grants: the new RPC surface is authenticated-only, like everything before it.
grant execute on function cabinet_state() to authenticated;
revoke execute on function cabinet_state() from public, anon;
grant execute on function register(text, text, text, text) to authenticated;
revoke execute on function register(text, text, text, text) from public, anon;
grant execute on function become_member_save_profile(date, int, int, text, uuid) to authenticated;
revoke execute on function become_member_save_profile(date, int, int, text, uuid) from public, anon;
grant execute on function become_member_complete(int) to authenticated;
revoke execute on function become_member_complete(int) from public, anon;
