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
end
$production_schema_check$;

select
  count(*) filter (where c.relkind in ('r', 'p')) as public_tables,
  count(*) filter (where c.relkind = 'v') as public_views
from pg_catalog.pg_class as c
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public';
