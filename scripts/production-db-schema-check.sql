-- Read-only production schema assertions. RAISE stops deployment; no statement
-- in this file creates, alters, or mutates database state.
do $production_schema_check$
begin
  if to_regclass('public.regions') is null then
    raise exception 'required relation public.regions is missing';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'required relation public.profiles is missing';
  end if;

  if to_regclass('public.support_messages') is null then
    raise exception 'required relation public.support_messages is missing';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ) then
    raise exception 'one or more public tables have RLS disabled';
  end if;

  if exists (
    with expected_views(view_name) as (
      values
        ('public_delegates'),
        ('public_events'),
        ('public_news'),
        ('public_stats'),
        ('transparency_regions'),
        ('transparency_stats'),
        ('admin_admins'),
        ('admin_audit'),
        ('admin_delegate_queue'),
        ('admin_events'),
        ('admin_finance_stats'),
        ('admin_members'),
        ('admin_news'),
        ('admin_overview'),
        ('admin_payments'),
        ('admin_poll_options'),
        ('admin_polls'),
        ('admin_region_stats'),
        ('admin_settings'),
        ('admin_support_messages'),
        ('member_event_going_counts'),
        ('member_news'),
        ('member_poll_options'),
        ('member_polls'),
        ('poll_option_counts')
    ),
    catalog_views(view_name) as (
      select c.relname
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'v'
    ),
    view_drift as (
      (select view_name from expected_views except select view_name from catalog_views)
      union all
      (select view_name from catalog_views except select view_name from expected_views)
    )
    select 1 from view_drift
  ) then
    raise exception 'production view set drifted';
  end if;

  if exists (
    with expected_views(view_name) as (
      values
        ('public_delegates'),
        ('public_events'),
        ('public_news'),
        ('public_stats'),
        ('transparency_regions'),
        ('transparency_stats'),
        ('admin_admins'),
        ('admin_audit'),
        ('admin_delegate_queue'),
        ('admin_events'),
        ('admin_finance_stats'),
        ('admin_members'),
        ('admin_news'),
        ('admin_overview'),
        ('admin_payments'),
        ('admin_poll_options'),
        ('admin_polls'),
        ('admin_region_stats'),
        ('admin_settings'),
        ('admin_support_messages'),
        ('member_event_going_counts'),
        ('member_news'),
        ('member_poll_options'),
        ('member_polls'),
        ('poll_option_counts')
    ),
    expected_view_grants(view_name, grantee, privilege_type) as (
      values
        ('public_delegates', 'anon', 'SELECT'),
        ('public_delegates', 'authenticated', 'SELECT'),
        ('public_events', 'anon', 'SELECT'),
        ('public_events', 'authenticated', 'SELECT'),
        ('public_news', 'anon', 'SELECT'),
        ('public_news', 'authenticated', 'SELECT'),
        ('public_stats', 'anon', 'SELECT'),
        ('public_stats', 'authenticated', 'SELECT'),
        ('transparency_regions', 'anon', 'SELECT'),
        ('transparency_regions', 'authenticated', 'SELECT'),
        ('transparency_stats', 'anon', 'SELECT'),
        ('transparency_stats', 'authenticated', 'SELECT'),
        ('admin_admins', 'authenticated', 'SELECT'),
        ('admin_audit', 'authenticated', 'SELECT'),
        ('admin_delegate_queue', 'authenticated', 'SELECT'),
        ('admin_events', 'authenticated', 'SELECT'),
        ('admin_finance_stats', 'authenticated', 'SELECT'),
        ('admin_members', 'authenticated', 'SELECT'),
        ('admin_news', 'authenticated', 'SELECT'),
        ('admin_overview', 'authenticated', 'SELECT'),
        ('admin_payments', 'authenticated', 'SELECT'),
        ('admin_poll_options', 'authenticated', 'SELECT'),
        ('admin_polls', 'authenticated', 'SELECT'),
        ('admin_region_stats', 'authenticated', 'SELECT'),
        ('admin_settings', 'authenticated', 'SELECT'),
        ('admin_support_messages', 'authenticated', 'SELECT'),
        ('member_event_going_counts', 'authenticated', 'SELECT'),
        ('member_news', 'authenticated', 'SELECT'),
        ('member_poll_options', 'authenticated', 'SELECT'),
        ('member_polls', 'authenticated', 'SELECT'),
        ('poll_option_counts', 'authenticated', 'SELECT')
    ),
    catalog_view_grants(view_name, grantee, privilege_type) as (
      select grants.table_name, grants.grantee, grants.privilege_type
      from information_schema.role_table_grants as grants
      join expected_views as expected on expected.view_name = grants.table_name
      where grants.table_schema = 'public'
        and grants.grantee in ('anon', 'authenticated')

      union all

      select grants.table_name, grants.grantee, grants.privilege_type
      from information_schema.table_privileges as grants
      join expected_views as expected on expected.view_name = grants.table_name
      where grants.table_schema = 'public'
        and grants.grantee = 'PUBLIC'
    ),
    grant_drift as (
      (select view_name, grantee, privilege_type from expected_view_grants
       except
       select view_name, grantee, privilege_type from catalog_view_grants)
      union all
      (select view_name, grantee, privilege_type from catalog_view_grants
       except
       select view_name, grantee, privilege_type from expected_view_grants)
    )
    select 1 from grant_drift
  ) then
    raise exception 'production view grants drifted';
  end if;

  if exists (
    with expected_view_access(view_name, anon_can_select, authenticated_can_select) as (
      values
        ('public_delegates', true, true),
        ('public_events', true, true),
        ('public_news', true, true),
        ('public_stats', true, true),
        ('transparency_regions', true, true),
        ('transparency_stats', true, true),
        ('admin_admins', false, true),
        ('admin_audit', false, true),
        ('admin_delegate_queue', false, true),
        ('admin_events', false, true),
        ('admin_finance_stats', false, true),
        ('admin_members', false, true),
        ('admin_news', false, true),
        ('admin_overview', false, true),
        ('admin_payments', false, true),
        ('admin_poll_options', false, true),
        ('admin_polls', false, true),
        ('admin_region_stats', false, true),
        ('admin_settings', false, true),
        ('admin_support_messages', false, true),
        ('member_event_going_counts', false, true),
        ('member_news', false, true),
        ('member_poll_options', false, true),
        ('member_polls', false, true),
        ('poll_option_counts', false, true)
    ),
    effective_view_access as (
      select
        expected.view_name,
        client.role_name,
        client.can_select,
        has_table_privilege(client.role_name::name, c.oid, 'SELECT') as table_select,
        has_any_column_privilege(client.role_name::name, c.oid, 'SELECT') as column_select,
        has_table_privilege(
          client.role_name::name,
          c.oid,
          'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'
        ) as table_write,
        has_any_column_privilege(
          client.role_name::name,
          c.oid,
          'INSERT, UPDATE, REFERENCES'
        ) as column_write
      from expected_view_access as expected
      join pg_catalog.pg_class as c on c.relname = expected.view_name
      join pg_catalog.pg_namespace as n
        on n.oid = c.relnamespace
       and n.nspname = 'public'
      cross join lateral (
        values
          ('anon', expected.anon_can_select),
          ('authenticated', expected.authenticated_can_select)
      ) as client(role_name, can_select)
      where c.relkind = 'v'
    )
    select 1
    from effective_view_access
    where table_select is distinct from can_select
       or column_select is distinct from can_select
       or table_write
       or column_write
  ) then
    raise exception 'production view effective privileges drifted';
  end if;

  if exists (
    with expected_views(view_name) as (
      values
        ('public_delegates'),
        ('public_events'),
        ('public_news'),
        ('public_stats'),
        ('transparency_regions'),
        ('transparency_stats'),
        ('admin_admins'),
        ('admin_audit'),
        ('admin_delegate_queue'),
        ('admin_events'),
        ('admin_finance_stats'),
        ('admin_members'),
        ('admin_news'),
        ('admin_overview'),
        ('admin_payments'),
        ('admin_poll_options'),
        ('admin_polls'),
        ('admin_region_stats'),
        ('admin_settings'),
        ('admin_support_messages'),
        ('member_event_going_counts'),
        ('member_news'),
        ('member_poll_options'),
        ('member_polls'),
        ('poll_option_counts')
    ),
    client_roles(role_oid) as (
      select roles.oid
      from pg_catalog.pg_roles as roles
      where roles.rolname in ('anon', 'authenticated')
    )
    select 1
    from expected_views as expected
    join pg_catalog.pg_class as c on c.relname = expected.view_name
    join pg_catalog.pg_namespace as n
      on n.oid = c.relnamespace
     and n.nspname = 'public'
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = c.oid
     and attribute.attnum > 0
     and not attribute.attisdropped
    cross join lateral pg_catalog.aclexplode(attribute.attacl) as grants
    where grants.grantee = 0
       or exists (
         select 1
         from client_roles
         where grants.grantee = client_roles.role_oid
            or pg_catalog.pg_has_role(client_roles.role_oid, grants.grantee, 'USAGE')
       )
  ) then
    raise exception 'production view column privileges drifted';
  end if;
end
$production_schema_check$;

select
  count(*) filter (where c.relkind in ('r', 'p')) as public_tables,
  count(*) filter (where c.relkind = 'v') as public_views
from pg_catalog.pg_class as c
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public';
