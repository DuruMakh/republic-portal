-- Grants an admin role on PRODUCTION (ADR-045). A template: .github/workflows/production-admin.yml
-- validates the dispatch inputs and fills __EMAIL__ (a plain address, no quotes possible) and
-- __ROLE__ (one of the four roles) before running it. Mirrors admin_grant_role()
-- (20260717150000_admin_crm.sql): only completed members, no-op when the role is already held,
-- otherwise one audit row. The actor is null with a via marker, like scripts/grant-admin.mjs.
do $$
declare
  v_user_ids uuid[];
  v_user_id uuid;
  v_profile public.profiles%rowtype;
  v_inserted int;
begin
  select array_agg(id) into v_user_ids
    from auth.users where lower(email) = lower('__EMAIL__');
  if coalesce(array_length(v_user_ids, 1), 0) <> 1 then
    raise exception 'expected exactly one sign-in account with this email, found %',
      coalesce(array_length(v_user_ids, 1), 0);
  end if;
  v_user_id := v_user_ids[1];

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then
    raise exception 'this account has no profile: the person has not finished registering';
  end if;
  if v_profile.registration_completed_at is null and v_profile.status <> 'active_member' then
    raise exception 'not a completed member: the membership form must be finished first';
  end if;

  insert into public.admin_roles (user_id, role, granted_by)
  values (v_user_id, '__ROLE__', null)
  on conflict (user_id, role) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise notice 'role already held: nothing changed';
    return;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (null, 'admin.grant_role', 'admin_role', v_user_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'role', '__ROLE__',
            'via', 'production-admin.yml'));
  raise notice 'granted';
end $$;
