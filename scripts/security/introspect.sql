-- Live inventory of every authorization surface Postgres itself can enumerate.
-- Run through psql (never through the Supabase JS client, which cannot execute
-- arbitrary SQL — and never through a SQL-executing RPC added to work around
-- that; see scripts/security/introspect.mjs's file comment). Output consumed
-- by introspect.mjs, which reconciles it against scripts/security/manifest.json.
--
-- prosecdef marks `security definer`; carried through as an informational
-- third column for functions only (null for every other kind) so the
-- completion report can break the function count into "security definer"
-- vs. "other helper" the same way spec §2 does. reconcile() itself only
-- looks at (kind, name) — the third column plays no role in identity.
--
-- kind literals below are exact SurfaceKind string values (lib/security/types.ts)
-- for every kind introspection can see; the app-layer kinds (action, endpoint,
-- bucket) cannot be queried from the catalog and are enumerated from source
-- instead (see introspect.mjs).
select 'function' as kind, p.proname as name, p.prosecdef as definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
union all
select 'view', c.relname, null from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('v','m')
union all
select 'table', c.relname, null from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
union all
select 'policy', pol.polname, null from pg_policy pol
union all
select 'trigger', t.tgname, null from pg_trigger t where not t.tgisinternal
order by 1, 2;
