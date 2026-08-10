# Production Supabase Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the isolated Supabase project `uorvlshbrlbdnbauxsws` from the repository's 31 migrations and add a guarded, manually dispatched GitHub Actions path for future production migrations.

**Architecture:** A local named Supabase CLI profile performs the one-time identity check, link, migration dry-run, owner approval checkpoint, bootstrap, and remote verification. A dedicated `production-db` GitHub Environment then supplies secrets to two manual workflow dispatches: Dry-run uploads evidence; the owner reviews it and manually dispatches Apply with that run ID. Apply rejects a different workflow/repository/main commit or pending migration state, repeats the dry-run, requires exact evidence equality, and only then writes migrations.

**Tech Stack:** Supabase CLI `2.109.1`, PostgreSQL 17, GitHub Actions, PowerShell on the owner's Windows workstation, bash on the GitHub runner, Vitest `3.2.7` for workflow-contract tests.

**Spec:** `docs/superpowers/specs/2026-08-11-production-supabase-environment-design.md`

## Global Constraints

- Production candidate project ref is exactly `uorvlshbrlbdnbauxsws`; staging remains `orcxtbedkexoclbfgvzd`.
- The production candidate remains on Supabase Free during the synthetic-test period. No real-person data is permitted under this plan.
- Supabase MCP is not used for authentication, bootstrap, deployment, or verification.
- Pin Supabase CLI to `2.109.1` locally and in GitHub Actions.
- Apply only committed files under `supabase/migrations/`; the bootstrap baseline is 31 files, from `20260712212409_initial_schema.sql` through `20260802120000_support_messages.sql`.
- Never run `supabase db reset --linked`, `supabase db push --include-seed`, `supabase config push`, `scripts/seed-staging.mjs`, or `supabase/seed.sql` against production.
- `supabase/config.toml` remains staging/local configuration and is not pushed to production.
- No access token, database password, connection string, service-role key, or secret value may enter Git, tool arguments, workflow output, screenshots, or chat.
- Rotate the database password previously shared in chat before storing the new value anywhere else.
- Every remote database write has an explicit owner approval checkpoint immediately after a fresh dry-run.
- GitHub delivery is two explicit dispatches: `dry-run` uploads evidence only; a
  separately owner-dispatched `apply` names the reviewed dry-run run ID.
  Apply proves the same workflow/repository/main commit and requires a fresh
  migration-list/dry-run evidence match before `supabase db push --linked`.
- Database state changes only through migrations. Never edit an already-applied migration or repair migration history by hand.
- Every exposed `public` table must have RLS enabled. Required Data API access must be expressed by explicit grants because new Supabase projects no longer auto-expose new tables.
- Work only on `codex/production-supabase-setup`; never push directly to `main` and never merge with failing CI.
- No new npm dependency is added. Append the environment decision to `DECISIONS.md` as ADR-028.
- Full local gate before delivery: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run format:check`, `npm.cmd test`, and `npm.cmd run build` with the existing staging build variables.

## File Structure

| File | Responsibility |
|---|---|
| `.github/workflows/production-db.yml` | Manual, main-only two-dispatch production migration workflow: Dry-run uploads review evidence; Apply verifies the approved run and unchanged state before writing, then runs post-apply checks. |
| `scripts/production-db-schema-check.sql` | Read-only/exception-only SQL asserting required schema objects and RLS on every `public` base/partitioned table. Safe to rerun after every migration. |
| `lib/production-db-workflow.test.ts` | Static contract tests that make unsafe workflow drift fail ordinary CI without needing credentials or network access. |
| `DECISIONS.md` | ADR-028 recording the separate project, Free-plan test boundary, CLI/Actions path, and migration-only rule. |

## Authoritative External References

- Supabase environment management: `https://supabase.com/docs/guides/deployment/managing-environments`
- Supabase CLI reference: `https://supabase.com/docs/reference/cli/getting-started`
- Local migration workflow: `https://supabase.com/docs/guides/local-development/cli-workflows`
- Current breaking changes reviewed on 2026-08-11: `https://supabase.com/changelog?types=breaking-change`

The relevant current changes are: new `public` tables are no longer automatically exposed to Data/GraphQL APIs, and extension version clauses are ignored in favor of the default extension version. The existing migrations explicitly grant intended client access and do not pin extension versions.

---

### Task 1: Build the guarded production migration workflow with TDD

**Files:**
- Create: `lib/production-db-workflow.test.ts`
- Create: `scripts/production-db-schema-check.sql`
- Create: `.github/workflows/production-db.yml`
- Modify: `DECISIONS.md` by appending ADR-028 only

**Interfaces:**
- Consumes: GitHub Environment `production-db` secrets `SUPABASE_ACCESS_TOKEN`, `PRODUCTION_PROJECT_ID`, and `PRODUCTION_DB_PASSWORD`.
- Produces: manually dispatched workflow `production-db.yml`; required inputs
  `operation` and `confirm_project_ref`, plus `approved_dry_run_run_id` for an
  Apply dispatch; reusable read-only SQL file
  `scripts/production-db-schema-check.sql`.

- [ ] **Step 1: Write the failing workflow-contract test** — `lib/production-db-workflow.test.ts`

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

describe("production database delivery contract", () => {
  it("is manual, main-only, serialized, and pinned to the approved project and CLI", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("confirm_project_ref:");
    expect(workflow).not.toMatch(/^\s{2}push:/m);
    expect(workflow).not.toMatch(/^\s{2}pull_request:/m);
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("environment: production-db");
    expect(workflow).toContain("group: production-db-migrations");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("EXPECTED_PRODUCTION_PROJECT_ID: uorvlshbrlbdnbauxsws");
    expect(workflow).toContain("version: 2.109.1");
  });

  it("maps exactly the named environment secrets and checks both supplied refs before linking", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}");
    expect(workflow).toContain("SUPABASE_PROJECT_ID: ${{ secrets.PRODUCTION_PROJECT_ID }}");
    expect(workflow).toContain("SUPABASE_DB_PASSWORD: ${{ secrets.PRODUCTION_DB_PASSWORD }}");
    const secretReferences = workflow.match(/secrets\.[A-Z0-9_]+/g) ?? [];
    expect([...new Set(secretReferences)].sort()).toEqual([
      "secrets.PRODUCTION_DB_PASSWORD",
      "secrets.PRODUCTION_PROJECT_ID",
      "secrets.SUPABASE_ACCESS_TOKEN",
    ]);
    expect(secretReferences).toHaveLength(6);
    expect(workflow).toContain('test "$CONFIRM_PROJECT_REF" = "$EXPECTED_PRODUCTION_PROJECT_ID"');
    expect(workflow).toContain('test "$SUPABASE_PROJECT_ID" = "$EXPECTED_PRODUCTION_PROJECT_ID"');

    const validation = workflow.indexOf("Validate immutable target");
    const linking = workflow.indexOf("Link production project");
    expect(validation).toBeGreaterThan(-1);
    expect(linking).toBeGreaterThan(validation);
  });

  it("requires a reviewed dry-run dispatch before a separate apply dispatch", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("operation:");
    expect(workflow).toContain("- dry-run");
    expect(workflow).toContain("- apply");
    expect(workflow).toContain("approved_dry_run_run_id:");
    expect(workflow).toContain("dry_run:");
    expect(workflow).toContain("apply:");
    expect(workflow).toContain("if: inputs.operation == 'dry-run'");
    expect(workflow).toContain("if: inputs.operation == 'apply'");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain("actions/download-artifact@v5");
    expect(workflow).toContain("run-id: ${{ inputs.approved_dry_run_run_id }}");
    expect(workflow).toContain("test \"$APPROVED_WORKFLOW_REF\" = \"$GITHUB_WORKFLOW_REF\"");
    expect(workflow).toContain("test \"$APPROVED_REPOSITORY\" = \"$GITHUB_REPOSITORY\"");
    expect(workflow).toContain("test \"$APPROVED_REF\" = \"$GITHUB_REF\"");
    expect(workflow).toContain("test \"$APPROVED_SHA\" = \"$GITHUB_SHA\"");

    const dryRun = workflow.indexOf("supabase db push --linked --dry-run");
    const freshDryRun = workflow.indexOf("supabase db push --linked --dry-run", dryRun + 1);
    const evidenceComparison = workflow.indexOf("cmp --silent approved-dry-run-evidence/dry-run.txt fresh-dry-run-evidence/dry-run.txt");
    const apply = workflow.indexOf("run: supabase db push --linked", freshDryRun + 1);
    const schemaCheck = workflow.indexOf("scripts/production-db-schema-check.sql");
    expect(dryRun).toBeGreaterThan(-1);
    expect(freshDryRun).toBeGreaterThan(dryRun);
    expect(evidenceComparison).toBeGreaterThan(freshDryRun);
    expect(apply).toBeGreaterThan(evidenceComparison);
    expect(schemaCheck).toBeGreaterThan(apply);
    expect(workflow.match(/supabase migration list --linked/g)).toHaveLength(3);
    expect(workflow).not.toMatch(/--include-seed|config push|db reset|seed:staging|scripts\/seed-staging\.mjs/);
  });

  it("asserts the committed 31-file migration baseline before each database phase", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("EXPECTED_MIGRATION_FILE_COUNT: 31");
    expect(workflow.match(/Migration file baseline/g)).toHaveLength(2);
    expect(workflow).toContain("find supabase/migrations -maxdepth 1 -type f -name '*.sql'");
    expect(workflow).toContain('test "$ACTUAL_MIGRATION_FILE_COUNT" = "$EXPECTED_MIGRATION_FILE_COUNT"');
  });

  it("keeps the post-apply SQL verifier read-only and checks RLS", () => {
    const sql = readRepoFile("scripts/production-db-schema-check.sql");
    const withoutComments = sql.replace(/--.*$/gm, "");

    expect(sql).toContain("relrowsecurity");
    expect(sql).toContain("public.regions");
    expect(sql).toContain("public.profiles");
    expect(sql).toContain("public.support_messages");
    expect(withoutComments).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create)\b/i);
  });
});
```

- [ ] **Step 2: Run the focused test and prove the one-dispatch workflow fails the two-dispatch contract**

Run: `npm.cmd exec -- vitest run lib/production-db-workflow.test.ts`

Expected: FAIL because the existing workflow has one secret mapping set, no
`operation`/approved-run inputs, no evidence artifact handoff, and no 31-file
baseline assertion.

- [ ] **Step 3: Add the idempotent schema verifier** — `scripts/production-db-schema-check.sql`

```sql
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
```

- [ ] **Step 4: Add the two-dispatch production workflow** — `.github/workflows/production-db.yml`

The workflow is two distinct main-only jobs selected by the required
`operation` choice input (`dry-run` or `apply`), with required
`confirm_project_ref` and optional `approved_dry_run_run_id`. It grants
`contents: read` and `actions: read`, retains
`production-db-migrations` serialization, and gives both jobs the
`production-db` Environment, CLI `2.109.1`, project reference, 31-file
baseline, and exactly the three named environment-secret mappings.

Both jobs reject a non-main ref, empty access token/password, either project
reference mismatch, and a migration-file count other than 31. `dry_run` links
the project, writes `production-db-dry-run-evidence/metadata.env` with workflow
ref/repository/ref/SHA/run ID/count plus `migration-state.txt` and `dry-run.txt`,
then uploads that directory using `actions/upload-artifact@v4` as
`production-db-dry-run-evidence`. It contains no non-dry-run `db push`.

`apply` requires numeric `approved_dry_run_run_id`, downloads that named
artifact with `actions/download-artifact@v5` and that run ID, and proves its
workflow ref, repository, main ref, SHA, and run ID match current context. It
links the project only after that check, creates a fresh migration list and
dry-run evidence, then must run these commands in order before its only write:

```bash
cmp --silent approved-dry-run-evidence/migration-state.txt fresh-dry-run-evidence/migration-state.txt
cmp --silent approved-dry-run-evidence/dry-run.txt fresh-dry-run-evidence/dry-run.txt
supabase db push --linked
```

After the write, it runs migration listing, the read-only schema/RLS verifier,
public-schema lint, and security advisors. Neither phase may use
`--include-seed`, `config push`, `db reset`, `seed:staging`, or
`scripts/seed-staging.mjs`.

- [ ] **Step 5: Append ADR-028 to `DECISIONS.md`**

Append this decision without editing earlier ADRs:

```markdown
## ADR-028 (2026-08-11): Separate production-candidate Supabase, migration-only delivery

The portal now has a separate Supabase production-candidate project,
`uorvlshbrlbdnbauxsws`. Staging remains `orcxtbedkexoclbfgvzd`; no staging data,
users, OTP inbox, Auth/SMS configuration, or seed command crosses that boundary.

The owner accepts Supabase Free for the next several months of synthetic testing.
The project is not approved for real-person data until backup/restore, monitoring,
Auth/SMS delivery, and plan level are reviewed again.

Supabase MCP is not part of delivery. A named local CLI profile performs the
one-time bootstrap; future schema delivery uses a manually dispatched GitHub
Actions workflow with exact-project confirmation, dry-run-before-apply, and a
dedicated `production-db` Environment. `supabase config push`, remote reset, and
production seeding are forbidden by this path. No dependency was added.
```

The ADR text above is preserved as the recorded decision. Its
"dry-run-before-apply" wording is implemented by the two-dispatch contract in
Step 4, never by one job that advances automatically from dry-run to Apply.

- [ ] **Step 6: Run the focused test and verify it passes**

Run: `npm.cmd exec -- vitest run lib/production-db-workflow.test.ts`

Expected: 1 test file passed, 5 tests passed.

- [ ] **Step 7: Run local quality gates**

Run separately:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
```

Expected: all commands exit 0; the full test count is at least the current 803 plus the 5 contract tests.

- [ ] **Step 8: Commit the workflow implementation**

```powershell
git add .github/workflows/production-db.yml scripts/production-db-schema-check.sql lib/production-db-workflow.test.ts DECISIONS.md docs/superpowers/specs/2026-08-11-production-supabase-environment-design.md docs/superpowers/plans/2026-08-11-production-supabase-environment.md
git commit -m "ci: require reviewed production database dry-runs"
```

---

### Task 2: Establish the named CLI profile and produce a read-only bootstrap dry-run

**Files:**
- Local ignored state only: `supabase/.temp/project-ref`
- No tracked file changes

**Interfaces:**
- Consumes: a newly rotated production database password and a Supabase personal access token entered privately by the owner.
- Produces: CLI profile `republic-production`, an isolated worktree link to `uorvlshbrlbdnbauxsws`, remote migration inventory, and exact dry-run output for owner approval.

- [ ] **Step 1: Rotate and store credentials outside chat and Git**

The owner changes the production project's database password in the Supabase dashboard, stores the replacement in a password manager, and creates a personal access token in the production Supabase account. Neither value is pasted into chat or supplied as a command-line argument.

- [ ] **Step 2: Authenticate the named profile through the private terminal prompt**

Run from the isolated worktree:

```powershell
npm.cmd exec -- supabase login --name republic-production --no-browser --profile republic-production
```

Expected: the CLI prompts privately for the personal access token and finishes with `Finished supabase login.`

- [ ] **Step 3: Prove the profile can see the exact project before linking**

Run:

```powershell
npm.cmd exec -- supabase projects list --profile republic-production --output-format json
```

Expected: exactly one returned accessible project has `id` equal to `uorvlshbrlbdnbauxsws`. Stop if it is missing or if the project is not healthy.

- [ ] **Step 4: Link only this isolated worktree**

Run and enter the rotated database password only at the private prompt:

```powershell
npm.cmd exec -- supabase link --project-ref uorvlshbrlbdnbauxsws --profile republic-production
Get-Content supabase/.temp/project-ref
git status --short
```

Expected: the ref file prints only `uorvlshbrlbdnbauxsws`; Git remains clean because `.temp` is ignored. Stop if `supabase link` reports config incompatibility or another project ref.

- [ ] **Step 5: Verify the local migration baseline**

Run:

```powershell
@(Get-ChildItem supabase/migrations -Filter '*.sql').Count
Get-ChildItem supabase/migrations -Filter '*.sql' | Sort-Object Name | Select-Object -First 1 -ExpandProperty Name
Get-ChildItem supabase/migrations -Filter '*.sql' | Sort-Object Name | Select-Object -Last 1 -ExpandProperty Name
```

Expected: count `31`, first `20260712212409_initial_schema.sql`, last `20260802120000_support_messages.sql`.

- [ ] **Step 6: Inspect remote migration history without writing**

Run:

```powershell
npm.cmd exec -- supabase migration list --linked --profile republic-production
```

Expected for a new project: all 31 versions appear only in the local column and none appears as an unexplained remote-only version. Stop and reconcile if any remote migration or user schema already exists.

- [ ] **Step 7: Produce the exact migration dry-run**

Run:

```powershell
npm.cmd exec -- supabase db push --linked --dry-run --profile republic-production
```

Expected: the CLI lists the same 31 migrations in order and does not mention seed/config application. Preserve only sanitized output that contains migration filenames and status; discard any line containing connection details.

- [ ] **Step 8: Owner approval checkpoint — stop before remote write**

Report the target ref, project health, local/remote migration state, migration count, first/last filename, and dry-run result in plain language. Ask the owner to approve applying those exact 31 migrations. Do not continue from silence or an ambiguous acknowledgement.

---

### Task 3: Apply the initial migrations and verify the production candidate

**Files:**
- No tracked file changes

**Interfaces:**
- Consumes: explicit owner approval from Task 2 and the unchanged linked target `uorvlshbrlbdnbauxsws`.
- Produces: production schema at migration `20260802120000`, clean RLS/schema verification, lint/advisor evidence, and an empty user-generated-data baseline.

- [ ] **Step 1: Revalidate target and repeat the dry-run immediately before apply**

Run:

```powershell
Get-Content supabase/.temp/project-ref
npm.cmd exec -- supabase projects list --profile republic-production --output-format json
npm.cmd exec -- supabase db push --linked --dry-run --profile republic-production
```

Expected: exact ref `uorvlshbrlbdnbauxsws`, healthy project, and the same 31 pending migrations approved in Task 2. Any difference invalidates the approval and returns to Task 2 Step 8.

- [ ] **Step 2: Apply the approved migration set**

Run once:

```powershell
npm.cmd exec -- supabase db push --linked --profile republic-production
```

Expected: all 31 migrations apply successfully in order. On failure, stop; do not run migration repair, remote reset, manual SQL repair, or retry blindly.

- [ ] **Step 3: Verify exact migration parity**

Run:

```powershell
npm.cmd exec -- supabase migration list --linked --profile republic-production
npm.cmd exec -- supabase db push --linked --dry-run --profile republic-production
```

Expected: all 31 local/remote versions align and the dry-run reports the linked project is up to date.

- [ ] **Step 4: Verify required objects and RLS with the committed read-only check**

Run:

```powershell
npm.cmd exec -- supabase db query --linked --file scripts/production-db-schema-check.sql --profile republic-production
```

Expected: command exits 0, the three required relations exist, and no `public` base or partitioned table lacks RLS.

- [ ] **Step 5: Verify no staging/user-generated data crossed the boundary**

Run:

```powershell
npm.cmd exec -- supabase db query --linked --profile republic-production "select (select count(*) from auth.users) as auth_users, (select count(*) from public.dev_otp_inbox) as otp_rows, (select count(*) from public.support_messages) as support_rows;"
```

Expected immediately after bootstrap: `auth_users = 0`, `otp_rows = 0`, `support_rows = 0`. Migration-owned reference data such as regions and cities is expected and is not staging seed.

- [ ] **Step 6: Run database lint and security advisors**

Run:

```powershell
npm.cmd exec -- supabase db lint --linked --schema public --level warning --fail-on error --profile republic-production
npm.cmd exec -- supabase db advisors --linked --type security --level error --fail-on error --profile republic-production
```

Expected: both commands exit 0. Record warnings separately; any error-severity finding blocks completion and is fixed forward through a new migration on the feature branch.

- [ ] **Step 7: Report bootstrap evidence**

Provide the owner with the exact migration parity result, RLS/schema-check result, empty-data counts, lint/advisor status, and confirmation that staging/Vercel were not changed. Do not include credentials or raw connection details.

---

### Task 4: Configure the GitHub `production-db` Environment without exposing secrets

**Files:**
- GitHub repository settings only
- No tracked file changes

**Interfaces:**
- Consumes: the Supabase personal access token, rotated database password, and project ref.
- Produces: GitHub Environment `production-db` with the three secret names required by Task 1.

- [ ] **Step 1: Verify GitHub authentication under the real user account**

Run: `gh auth status`

Expected: active account `DuruMakh` is authenticated for `github.com`. If it is not, stop and ask the owner to reauthenticate; do not replace or disable their identity without approval.

- [ ] **Step 2: Create the GitHub Environment**

In `DuruMakh/republic-portal` repository settings, create the environment named exactly `production-db`. Do not add branch patterns or reviewers unless the repository plan exposes those controls and the owner explicitly chooses them.

- [ ] **Step 3: Add the three environment secrets through masked prompts/UI**

Add:

- `SUPABASE_ACCESS_TOKEN` = production Supabase personal access token
- `PRODUCTION_PROJECT_ID` = `uorvlshbrlbdnbauxsws`
- `PRODUCTION_DB_PASSWORD` = rotated production database password

Secret values are entered directly into GitHub's masked fields, never passed in a shell argument or chat.

- [ ] **Step 4: Verify secret names, not values**

Use the GitHub Environment settings page or the GitHub API to confirm that the three names exist. GitHub never returns the values; that is the expected behavior.

---

### Task 5: Review and deliver the branch through the repository's required process

**Files:**
- No additional implementation files unless review finds a defect

**Interfaces:**
- Consumes: green Task 1 code, verified Task 3 bootstrap, and configured Task 4 secrets.
- Produces: reviewed and merged workflow on `main`, with owner-facing preview evidence.

- [ ] **Step 1: Run the full local release gate from a clean worktree**

Run separately:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run build
git diff --check
git status --short
```

For `npm.cmd run build`, provide the existing staging build variables exactly as CI does; do not point the application build at production. Expected: every command exits 0 and Git status contains only intentional committed work.

- [ ] **Step 2: Push the feature branch and open a draft PR**

```powershell
git push -u origin codex/production-supabase-setup
gh pr create --draft --base main --head codex/production-supabase-setup --title "Add production Supabase migration path" --body "Creates the guarded migration-only path for Supabase project uorvlshbrlbdnbauxsws. The initial 31 migrations were dry-run, explicitly approved, applied, and verified. Production seeding and config push are excluded; Vercel and the application still use staging."
```

The PR body states: separate project ref, migration-only scope, no seed/config push, bootstrap verification results, password rotation completed, and Vercel/app still using staging. The prepared body contains no secret values.

- [ ] **Step 3: Wait for required CI and Vercel preview**

Expected: typecheck, lint, format, unit tests, build, Playwright, and deployment checks are green. A failing or queued required check blocks merge.

- [ ] **Step 4: Complete required code reviews**

Run Codex review and request `/codex review` on the PR. Address every actionable finding with TDD and repeat the relevant gates. Resolve conversations only after the fix is pushed and verified.

- [ ] **Step 5: Produce owner sign-off evidence**

Provide a plain-language summary, the Vercel preview URL, a screenshot showing the existing portal still renders, the workflow safety guarantees, and the sanitized production bootstrap results. No code reading is required from the owner.

- [ ] **Step 6: Obtain explicit owner sign-off, mark ready, and merge**

After explicit sign-off and all required checks are green:

```powershell
gh pr ready
gh pr merge --squash --delete-branch
```

Expected: PR merged into `main`; implementation branch deleted remotely. Do not bypass branch protection or required checks.

---

### Task 6: Exercise the merged two-dispatch GitHub workflow

**Files:**
- No tracked file changes

**Interfaces:**
- Consumes: merged workflow on `main`, configured GitHub Environment, and already-bootstrapped production database.
- Produces: reviewable Dry-run evidence and, only after a second owner approval,
  successful Apply evidence proving the same workflow/repository/main commit
  and unchanged pending migration state.

- [ ] **Step 1: Confirm `main` contains the merged workflow**

Run:

```powershell
git fetch origin main
git show origin/main:.github/workflows/production-db.yml
```

Expected: the merged workflow includes CLI `2.109.1`, exact expected project
ref, main-only guards, 31-file baseline, separate `dry-run`/`apply` inputs,
artifact handoff/comparison, and no seed/config/reset command.

- [ ] **Step 2: Obtain explicit owner approval to dispatch Dry-run only**

Explain that this first dispatch cannot apply migrations. It uses production
credentials only to inspect the target, save the migration list and dry-run
output as a review artifact, and fail if the 31-file baseline is wrong. Do not
dispatch without a clear approval.

- [ ] **Step 3: Dispatch Dry-run from `main` with the exact confirmation input**

Run:

```powershell
gh workflow run production-db.yml --ref main -f operation=dry-run -f confirm_project_ref=uorvlshbrlbdnbauxsws
gh run list --workflow production-db.yml --limit 1
```

Expected: one new successful Dry-run run on `main` and a downloadable
`production-db-dry-run-evidence` artifact; no `supabase db push --linked`
without `--dry-run` is executed.

- [ ] **Step 4: Review the exact Dry-run evidence**

Resolve the newest run ID and inspect that exact run:

```powershell
$dryRunId = gh run list --workflow production-db.yml --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $dryRunId --exit-status
gh run download $dryRunId -n production-db-dry-run-evidence -D production-db-dry-run-evidence
Get-Content production-db-dry-run-evidence\metadata.env
Get-Content production-db-dry-run-evidence\migration-state.txt
Get-Content production-db-dry-run-evidence\dry-run.txt
```

Expected: the artifact identifies this exact workflow/repository/main SHA/run ID,
the migration list and dry-run are reviewable, the project ref is correct, and
no secret appears in logs or evidence. Present these exact files to the owner.

- [ ] **Step 5: Obtain owner approval, then dispatch Apply against the reviewed Dry-run**

Do not dispatch Apply until the owner explicitly approves the specific
`$dryRunId` evidence. The separate Apply dispatch is the write authorization;
it must name that run ID and cannot proceed if `main` or remote pending state
has changed.

```powershell
gh workflow run production-db.yml --ref main -f operation=apply -f confirm_project_ref=uorvlshbrlbdnbauxsws -f approved_dry_run_run_id=$dryRunId
$applyRunId = gh run list --workflow production-db.yml --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $applyRunId --exit-status
gh run view $applyRunId --log
```

Expected: Apply verifies the selected artifact's workflow/repository/main SHA,
repeats the migration list and dry-run exactly, only then performs the no-op
apply, and passes post-apply migration list, schema/RLS check, lint, and
security advisors. A mismatch fails and requires a new Dry-run review.

- [ ] **Step 6: Final live verification and handoff**

Run locally one final time:

```powershell
npm.cmd exec -- supabase migration list --linked --profile republic-production
npm.cmd exec -- supabase db push --linked --dry-run --profile republic-production
```

Expected: all 31 bootstrap migrations remain aligned and the project is up to date. Report the merged commit, workflow run URL, production project ref, verification results, known Free-plan limitations, and the remaining pre-launch tasks: Auth/SMS policy, Vercel cutover, backup/restore, monitoring, and real-data approval.
