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
--
-- Every branch is scoped to n.nspname = 'public' — this is the application's
-- own surface (spec §2's stated scope), not Supabase's managed platform
-- schemas. pg_policy and pg_trigger are joined through pg_class/pg_namespace
-- to reach that filter, the same way the view/table branches already do,
-- because (unlike pg_proc/pg_class) neither carries a namespace directly.
-- This was corrected 2026-07-25 after a first live run (unscoped, as
-- originally drafted) returned 2 extra policies and 6 extra triggers, all
-- confirmed via a follow-up query to belong to cron.job, cron.job_run_details,
-- realtime.subscription and storage.buckets/objects — pg_cron, Realtime and
-- Storage internals, never touched by this app's own permission model or any
-- of the 12 actor positions. Left unscoped, they would have inflated the
-- policy/trigger manifest with surfaces nobody's probe runner should ever
-- call. See task-3-report.md for the full evidence trail.
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
select 'policy', pol.polname, null
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
union all
select 'trigger', t.tgname, null
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where not t.tgisinternal and n.nspname = 'public'
order by 1, 2;
