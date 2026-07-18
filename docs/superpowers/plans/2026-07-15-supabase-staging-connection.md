# Supabase Staging Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a healthy `republic-portal-staging` Supabase project in Duru/Frankfurt, connect this repository to it without exposing secrets, deploy the four committed migrations, seed deterministic staging data, and prove the application works against it.

**Architecture:** The existing Next.js Supabase clients and SQL migrations remain unchanged. A new hosted staging project replaces the inaccessible project currently referenced by the ignored `.env.local`; the Supabase CLI deploys committed migration history, while existing repository scripts verify RLS, public views, seed data, and application health.

**Tech Stack:** Supabase hosted Postgres/Auth/Data API, Supabase MCP and CLI 2.109.1, Next.js 16, TypeScript 6 strict, `@supabase/supabase-js`, `@supabase/ssr`, Vitest, ESLint

---

## File Map and Scope

- Modify locally, never commit: `.env.local` — staging project URL, publishable key, server secret, and staging environment marker.
- Generated locally, never commit: `supabase/.temp/` — CLI link metadata for the new project.
- Deploy unchanged: `supabase/migrations/20260712212409_initial_schema.sql` — initial schema, RLS, audit log, and development OTP hook.
- Deploy unchanged: `supabase/migrations/20260712212415_seed_regions.sql` — canonical regions and cities.
- Deploy unchanged: `supabase/migrations/20260713143120_service_role_grants_and_city_region_fk.sql` — server grants and city-region constraint.
- Deploy unchanged: `supabase/migrations/20260713175043_public_read_model.sql` — restricted public read views and grants.
- Execute unchanged: `scripts/verify-schema.mjs` — schema, RLS, grants, views, trigger, and authenticated-role acceptance probes.
- Execute unchanged: `scripts/seed-staging.mjs` — destructive, staging-only deterministic roster seed guarded by project ref.
- No application source, migration, dependency, or Vercel configuration changes are in scope.

### Task 1: Establish a Clean, Reproducible Baseline

**Files:**
- Verify: `package-lock.json`
- Verify ignored: `.env.local`
- Verify ignored: `supabase/.temp/`

- [ ] **Step 1: Confirm the feature branch and preserve unrelated files**

Run:

```powershell
git branch --show-current
git status --short
```

Expected: branch is `codex/connect-supabase-staging`. The pre-existing untracked `AGENTS.md` and `Geo Republic Portal (Standalone).html` may remain; do not stage, edit, or delete them.

- [ ] **Step 2: Prove secret-bearing paths are ignored**

Run:

```powershell
git check-ignore -v .env.local
git check-ignore -v supabase/.temp/project-ref
```

Expected: `.gitignore` matches `.env*` and `supabase/.temp/` respectively.

- [ ] **Step 3: Restore the lockfile-pinned toolchain if the local CLI binary is absent**

Run:

```powershell
if (-not (Test-Path node_modules/.bin/supabase.cmd)) { npm ci }
npx --no-install supabase --version
npx --no-install supabase link --help
npx --no-install supabase db push --help
```

Expected: Supabase CLI reports `2.109.1`; help lists `--project-ref` for `link` and `--dry-run` for `db push`. `npm ci` must not modify `package.json` or `package-lock.json`.

- [ ] **Step 4: Run the code-only baseline gates before changing external state**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all four commands exit successfully. If a pre-existing failure occurs, stop and report it before creating the remote project.

### Task 2: Create the Hosted Staging Project

**External state:**
- Create: Supabase project `republic-portal-staging`
- Organization: `Duru` (`ngtsvkmhznlmmyfmzgei`)
- Region: Frankfurt (`eu-central-1`)
- Confirmed cost: `$0/month`

- [ ] **Step 1: Reconfirm the exact organization and price immediately before creation**

Use the connected Supabase tools to:

1. List organizations and verify ID `ngtsvkmhznlmmyfmzgei` is named `Duru`.
2. Get the project cost for that organization.

Expected: organization is Duru and cost is `0` with monthly recurrence. Stop if either value differs from the approved design.

- [ ] **Step 2: Record the required cost confirmation**

Call the Supabase cost-confirmation tool with:

```text
type: project
recurrence: monthly
amount: 0
```

Expected: a cost-confirmation ID is returned.

- [ ] **Step 3: Create the project using the confirmed values**

Call the Supabase project-creation tool with:

```text
name: republic-portal-staging
organization_id: ngtsvkmhznlmmyfmzgei
region: eu-central-1
confirm_cost_id: the ID returned by Step 2
```

Expected: one new project is returned. Do not create a production project or development branch.

- [ ] **Step 4: Wait for project health**

Poll the Supabase project-details tool using the returned project ID until its status is `ACTIVE_HEALTHY`. Do not poll more frequently than once every 10 seconds.

Expected: name is `republic-portal-staging`, organization is Duru, region is `eu-central-1`, and status is `ACTIVE_HEALTHY`.

### Task 3: Configure Local Credentials Without Exposing Them

**Files:**
- Modify, ignored: `.env.local`
- Do not modify: `.env.example`

- [ ] **Step 1: Retrieve non-secret project connection values**

Use the connected Supabase tools to retrieve:

1. The API URL for `republic-portal-staging`.
2. All publishable keys for the project.

Select an enabled modern key beginning with `sb_publishable_`. Do not select a disabled key.

Expected: the API URL contains the newly returned project ref and one enabled publishable key is available.

- [ ] **Step 2: Obtain the server secret through a secure owner-assisted flow**

If the connected tools do not expose secret keys, open the new project's Supabase **Connect** dialog and have the owner copy the enabled `sb_secret_...` value directly into `.env.local`. Do not paste the value into chat, command arguments, logs, tracked files, or screenshots.

Expected: the server secret is stored only in the ignored local environment file.

- [ ] **Step 3: Replace only the four Supabase staging values in `.env.local`**

The resulting file must contain this key mapping, with real values entered locally and never echoed:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<new-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<enabled-sb_publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<enabled-sb_secret-key>
NEXT_PUBLIC_APP_ENV=staging
```

This is a dynamic credential template, not literal file content: preserve the actual values retrieved in Steps 1–2 and do not retain angle-bracket text.

- [ ] **Step 4: Verify presence and target ref without printing credentials**

Run a masked local check that reports only `present`, `missing`, or the URL-derived project ref. Never output the key values.

Expected: all four variables are present, `NEXT_PUBLIC_APP_ENV` is `staging`, and the URL-derived ref matches the new project ID.

- [ ] **Step 5: Prove the acceptance check fails before migrations**

Run:

```powershell
node --env-file=.env.local scripts/verify-schema.mjs
```

Expected: FAIL because the new database does not yet contain the repository schema, typically reporting that `regions` is not found. This is the required failing-test step; do not seed data yet.

### Task 4: Link the CLI and Deploy Migration History

**Files:**
- Generate, ignored: `supabase/.temp/project-ref`
- Deploy unchanged: `supabase/migrations/*.sql`

- [ ] **Step 1: Authenticate the CLI without exposing a token**

Run:

```powershell
npx --no-install supabase login
```

Expected: the CLI reports successful authentication. If interactive browser authorization is requested, the owner completes that flow; never paste the access token into chat or a tracked file.

- [ ] **Step 2: Link by selecting the new project interactively**

Run:

```powershell
npx --no-install supabase link
```

Select `republic-portal-staging` in Duru when prompted. Expected: link succeeds and `supabase/.temp/project-ref` contains the new project ref.

- [ ] **Step 3: Compare local and remote migration history before writing**

Run:

```powershell
npx --no-install supabase migration list
```

Expected: the remote side is empty and the local side lists exactly:

```text
20260712212409
20260712212415
20260713143120
20260713175043
```

If remote history is not empty, stop. Do not run `migration repair` or edit the dashboard.

- [ ] **Step 4: Dry-run the deployment**

Run:

```powershell
npx --no-install supabase db push --dry-run
```

Expected: the dry run proposes exactly the four migration files listed above, in timestamp order, and no seed data.

- [ ] **Step 5: Apply the committed migrations**

Run:

```powershell
npx --no-install supabase db push
```

Expected: all four migrations apply successfully with no manual SQL or dashboard schema edits.

- [ ] **Step 6: Verify migration history is synchronized**

Run:

```powershell
npx --no-install supabase migration list
```

Expected: local and remote columns both contain the same four timestamps with no divergence.

### Task 5: Verify Schema and Supabase Security

**Files:**
- Execute unchanged: `scripts/verify-schema.mjs`

- [ ] **Step 1: Make the previously failing schema acceptance check pass**

Run:

```powershell
node --env-file=.env.local scripts/verify-schema.mjs
```

Expected: PASS ending with `OK:` and confirming 11 regions, at least 30 cities, RLS holding, public views readable, delegates sealed, and the server-managed trigger enforced.

- [ ] **Step 2: Review Supabase security advisors**

Use the connected Supabase advisor tool for the new project with type `security`.

Expected: review every returned notice. Stop and fix only issues created by the four deployed migrations; report documented, pre-existing design exceptions instead of silently changing schema.

- [ ] **Step 3: Review Supabase performance advisors**

Use the connected Supabase advisor tool for the new project with type `performance`.

Expected: review every returned notice. Do not add speculative indexes or refactor schema outside this connection task.

### Task 6: Seed and Prove the Public Read Model

**Files:**
- Execute unchanged: `scripts/seed-staging.mjs`
- Read unchanged: `scripts/seed-roster.json`

- [ ] **Step 1: Derive the linked ref and run the guarded staging seed**

Run:

```powershell
$projectRef = (Get-Content -Raw 'supabase/.temp/project-ref').Trim()
node --env-file=.env.local scripts/seed-staging.mjs --confirm-ref $projectRef
```

Expected: the script identifies the new staging ref, completes with `SEED OK`, reports 12 approved delegates, 1,636 active members, and `giorgi-maisuradze` as top with 294 active supporters.

- [ ] **Step 2: Re-run schema and access verification after data creation**

Run:

```powershell
node --env-file=.env.local scripts/verify-schema.mjs
```

Expected: PASS with the same RLS, grants, view, trigger, and authenticated-role assertions after seed data exists.

### Task 7: Run Final Application and Secret-Safety Gates

**Files:**
- Verify all tracked files
- Verify ignored: `.env.local`
- Verify ignored: `supabase/.temp/`

- [ ] **Step 1: Run the full application verification stack**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits successfully.

- [ ] **Step 2: Verify tracked-file cleanliness and whitespace**

Run:

```powershell
git diff --check
git status --short
git check-ignore -v .env.local
git check-ignore -v supabase/.temp/project-ref
```

Expected: no secret-bearing file is tracked or staged. Only the implementation plan commit and the pre-existing unrelated untracked files are visible; `.env.local` and CLI link metadata are ignored.

- [ ] **Step 3: Produce plain-language completion evidence**

Report only:

- Project name, organization, region, health, and non-secret project ref.
- Confirmation that all four migration timestamps match local and remote history.
- Schema verifier, advisors, seed, test, type-check, lint, and build results.
- Confirmation that no secret was printed or committed.
- Any owner action still required.

Do not include publishable keys, server secrets, database passwords, access tokens, or screenshots containing credentials.
