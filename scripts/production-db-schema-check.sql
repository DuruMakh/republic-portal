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
    with expected_view_grants(view_name, grantee, privilege_type) as (
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
      select table_name, grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee in ('anon', 'authenticated')
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
end
$production_schema_check$;

select
  count(*) filter (where c.relkind in ('r', 'p')) as public_tables,
  count(*) filter (where c.relkind = 'v') as public_views
from pg_catalog.pg_class as c
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public';
