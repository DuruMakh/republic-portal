-- Security audit 2026-10-08, C1 — keeps the legacy register() closed whatever order the
-- registration migrations reach a database in.
--
-- 20261008150000_require_privacy_consent.sql (privacy step 2, merged to main before this
-- release) restates register() and grants it to `authenticated`. In filename order that runs
-- before 20261008160000, whose revoke wins — the production case. But staging received
-- 160000..160200 first and 150000 only afterwards (pushed with --include-all), which leaves the
-- grant last there. Repeating the revoke here, after every file that touches register(), makes
-- the end state the same everywhere: a no-op where the revoke already won.
revoke execute on function public.register(text, text, text, text) from public, anon, authenticated, service_role;
