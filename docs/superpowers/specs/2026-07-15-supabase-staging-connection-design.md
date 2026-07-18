# Supabase Staging Connection Design

**Date:** 2026-07-15  
**Status:** Owner-approved design  
**Scope:** Create and connect one staging Supabase project only

## Goal

Create `republic-portal-staging` in the existing Duru Supabase organization, host it in Frankfurt (`eu-central-1`), apply the repository's committed database migrations, and connect local development to it without committing secrets.

## Decisions

- Create one staging project at the confirmed cost of $0 per month.
- Do not create or configure a production Supabase project in this task.
- Replace the inaccessible staging reference currently stored in the local environment.
- Preserve the existing application architecture and Supabase client code.
- Use the existing environment variable names to avoid an unrelated key-renaming refactor.
- Treat `supabase/migrations/` as the only schema source of truth.
- Do not edit the remote schema manually in the Supabase dashboard.
- Do not commit `.env.local`, database passwords, publishable keys, or server secrets.

## Connection Flow

1. Create `republic-portal-staging` in organization `Duru`, region `eu-central-1`.
2. Wait until Supabase reports the project as healthy.
3. Obtain the project URL, an enabled publishable key, and a server-side secret key.
4. Update only the ignored `.env.local` values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` receives the modern publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` receives the modern server secret
   - `NEXT_PUBLIC_APP_ENV=staging`
5. Link the Supabase CLI to the new project.
6. Dry-run and then apply the four committed migrations in timestamp order.
7. Seed the deterministic staging roster only after schema verification succeeds.

The existing variable names describe legacy Supabase key names, but changing them would touch application code, tests, scripts, and deployment configuration. Supabase's modern publishable and secret keys can serve the same client/server roles, so retaining the variable names is the smallest safe connection change.

## Security Boundaries

- The publishable key may be used by browser and anonymous data clients.
- The server secret remains server-only and must never use a `NEXT_PUBLIC_` prefix.
- Existing RLS policies, explicit grants, and restricted public views are applied only through committed migrations.
- The server secret is never printed in command output or included in sign-off evidence.
- If the connected Supabase tools cannot retrieve the server secret or database password, the owner supplies it through Supabase's secure dashboard flow; it is not pasted into tracked files or chat output.

## Failure Handling

- If project creation fails, inspect the returned organization, quota, billing, or region error before retrying.
- If migration history differs from the repository, stop before applying changes and compare local and remote migration lists. Do not use migration repair without a separate reviewed decision.
- If a migration fails, do not bypass it with dashboard edits. Diagnose the failing migration and keep the repository as the source of truth.
- If schema checks fail, do not seed data or claim the app is connected.

## Verification and Success Criteria

The task is complete only when all of the following are true:

1. Supabase lists `republic-portal-staging` as healthy in Duru and Frankfurt.
2. The local CLI link identifies the new project reference.
3. Remote migration history contains all four committed migrations.
4. `scripts/verify-schema.mjs` succeeds against the new project.
5. Supabase security and performance advisors are reviewed; no task-created critical security issue remains.
6. The deterministic staging seed completes and public read queries return the seeded data.
7. The application test, type-check, lint, and production-build gates pass.
8. Git confirms `.env.local` and all secret-bearing files remain untracked and uncommitted.

## Out of Scope

- Production Supabase creation or deployment
- Vercel environment-variable changes
- Real SMS provider configuration
- New schema, tables, policies, UI, or application behavior
- Renaming the repository's existing Supabase environment variables
