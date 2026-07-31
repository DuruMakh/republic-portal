-- Owner fix list #16 (2026-07-27): the member list gains a city filter. The view
-- already exposes city_name_ka for display but not the id the filter needs.
-- create-or-replace may only APPEND columns, so city_id goes last.
--
-- Select list copied VERBATIM from the LIVE definition at
-- 20260722120000_r2_ladder_and_numbers.sql:222-255 (the most recent
-- `create or replace view admin_members` in the migration history — confirmed
-- by grepping every migration for the statement; the three later unpushed
-- migrations from this round, 20260728140000/141000/142000, never redefine
-- this view — 141000 only repeats the standing grant, verbatim, across all
-- nine admin_ views including this one). Only change: p.city_id appended as
-- the last select-list item, immediately before `from profiles p`.
create or replace view admin_members as
select
  p.id,
  p.first_name,
  p.last_name,
  p.phone,
  p.region_id,
  r.name_ka as region_name_ka,
  c.name_ka as city_name_ka,
  m.delegate_id,
  dp.first_name as delegate_first_name,
  dp.last_name as delegate_last_name,
  p.status,
  p.membership_tier,
  p.reference_code,
  p.created_at,
  p.registration_completed_at,
  (d.id is not null) as is_delegate,
  case
    when p.status = 'active_member' then 'active'
    when p.registration_completed_at is not null then 'member'
    else 'registered'
  end as standing,
  sdp.first_name as signup_delegate_first_name,
  sdp.last_name as signup_delegate_last_name,
  p.city_id
from profiles p
left join regions r on r.id = p.region_id
left join cities c on c.id = p.city_id
left join delegates d on d.id = p.id
left join memberships m on m.member_id = p.id and m.ended_at is null
left join profiles dp on dp.id = m.delegate_id
left join delegates sd on sd.referral_code = p.signup_ref_code
left join profiles sdp on sdp.id = sd.id
where has_any_admin_role('super_admin', 'verifier', 'finance');

-- Fix-list round 2 (Task 6 review, Fix 2): the CSV export must never see a
-- different row set than the on-screen list (see the invariant comment at
-- app/(admin)/admin/members/page.tsx's search filter) -- but admin_export_members
-- had no p_city_id, so a city-filtered export silently returned every city.
--
-- Live body copied VERBATIM from the newest `create (or replace)? function
-- admin_export_members` in the migration history -- confirmed by grepping every
-- migration: the original `create function` is 20260717150000_admin_crm.sql:751,
-- superseded by `create or replace function` at
-- 20260721120000_progressive_registration.sql:254-321 (only change there: the
-- p_status whitelist's pre-rename first entry was swapped for 'registered',
-- matching that same migration's member_status enum rename). The one later
-- mention,
-- 20260722120000_r2_ladder_and_numbers.sql:257, is a comment stating "NO
-- change" -- confirmed no redefinition. So 20260721120000:254-321 is the live
-- definition restated below.
--
-- Adding a parameter changes the signature, so `create or replace` would ADD
-- a second overload instead of replacing the 4-arg one -- drop it first, same
-- pattern as 20260728100000_personal_id_at_membership.sql's register()/
-- become_member_save_profile() (drop old signature, `create function` fresh,
-- restate grants -- create-or-replace's ACL-preserving behaviour does not
-- apply once the old overload is gone).
--
-- Only three changes from the verbatim body: (1) `p_city_id int default
-- null` appended to the signature so every existing positional/named caller
-- keeps working unchanged, (2) `and (p_city_id is null or p.city_id =
-- p_city_id)` added to the row filter, applied exactly like p_region_id, (3)
-- `'cityId', p_city_id` added next to the sibling filters already recorded in
-- the audit_log details, so the audit trail for this security definer
-- function keeps naming every filter actually applied to the export it logs
-- -- everything else (gates, search/status logic, the audit insert shape,
-- error tokens) is untouched.
drop function admin_export_members(text, int, text, boolean);

create function admin_export_members(
  p_search text, p_region_id int, p_status text, p_include_ids boolean,
  p_city_id int default null
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
      and (p_city_id is null or p.city_id = p_city_id)
      and (v_status is null or p.status = v_status)
  ) q;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.export', 'profile', null,
          jsonb_build_object(
            'search', v_search, 'regionId', p_region_id, 'cityId', p_city_id, 'status', p_status,
            'includeIds', coalesce(p_include_ids, false), 'rowCount', v_count));
  return v_rows;
end $$;
grant execute on function admin_export_members(text, int, text, boolean, int) to authenticated;
revoke execute on function admin_export_members(text, int, text, boolean, int) from public, anon;
