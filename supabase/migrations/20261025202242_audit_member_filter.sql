-- Member category includes completed and active members; direct active_member stays exact.
-- Restate the latest five-argument function, preserving permissions and audit contents.
create or replace function admin_export_members(
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
      and (v_status is null
           or (v_status = 'profile_completed' and p.status in ('profile_completed', 'active_member'))
           or (v_status <> 'profile_completed' and p.status = v_status))
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
