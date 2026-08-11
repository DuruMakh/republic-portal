# Production Security Advisor Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize client grants on the 25 intentional owner-executed views and replace the unusable blanket Security Advisor failure with an exact, evidence-producing verification gate.

**Architecture:** A committed JSON access matrix is the reviewed source of truth for the 25 accepted views. One forward-only migration enforces that matrix; a small Node CLI validates advisor JSON against the exact flattened allowlist; the existing SQL verifier and production workflow prove catalog grants, role behavior, and advisor output after apply.

**Tech Stack:** Supabase CLI `2.109.1`, PostgreSQL 17, Node.js 22+, ECMAScript modules, GitHub Actions, Vitest `3.2.7`.

## Global Constraints

- Preserve ADR-014's owner-executed public/admin view behavior; do not set `security_invoker`.
- Create the migration only through `supabase migration new normalize_production_view_grants`.
- Never edit the 31 already-applied migrations.
- The new committed migration baseline is exactly 32 files.
- Do not add a dependency.
- Keep the workflow manual, main-only, serialized, and pinned to Supabase CLI `2.109.1`.
- Keep exactly the existing three GitHub Environment secrets.
- Do not run seed, config push, remote reset, migration repair, or manual production SQL.
- Do not apply the 32nd migration remotely without a fresh dry-run and explicit owner approval.
- Every implementation task follows red-green TDD and ends with a focused commit.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/production-security-view-access.json` | Single reviewed source of truth for six public-read and nineteen signed-in-read views |
| `scripts/verify-production-security-advisors.mjs` | Pure advisor-result verifier plus one-file CLI |
| `lib/production-db-security-gate.test.ts` | Real CLI/verifier, migration, SQL, and workflow contract tests |
| CLI-generated `supabase/migrations/*_normalize_production_view_grants.sql` | Forward-only least-privilege grant normalization |
| `scripts/production-db-schema-check.sql` | Existing required-object/RLS assertions plus exact view/grant assertions |
| `.github/workflows/production-db.yml` | Post-apply role probes, advisor capture, exact verifier, and evidence artifact |
| `lib/production-db-workflow.test.ts` | Existing workflow safety contract updated for the 32-file baseline and new gate ordering |
| `DECISIONS.md` | Append-only ADR-030 documenting the accepted view exception and exact gate |

---

### Task 1: Build the exact advisor verifier with TDD

**Files:**
- Create: `scripts/production-security-view-access.json`
- Create: `scripts/verify-production-security-advisors.mjs`
- Create: `lib/production-db-security-gate.test.ts`

**Interfaces:**
- Consumes: Supabase CLI JSON object `{ results: AdvisorResult[], message?: string }`.
- Produces: `verifyProductionSecurityAdvisors(payload): { acceptedViews: string[] }`; CLI exits `0` only for the exact reviewed 25-result set.

- [ ] **Step 1: Create the reviewed access matrix**

Create `scripts/production-security-view-access.json` exactly as:

```json
{
  "public_read": [
    "public_delegates",
    "public_events",
    "public_news",
    "public_stats",
    "transparency_regions",
    "transparency_stats"
  ],
  "signed_in_read": [
    "admin_admins",
    "admin_audit",
    "admin_delegate_queue",
    "admin_events",
    "admin_finance_stats",
    "admin_members",
    "admin_news",
    "admin_overview",
    "admin_payments",
    "admin_poll_options",
    "admin_polls",
    "admin_region_stats",
    "admin_settings",
    "admin_support_messages",
    "member_event_going_counts",
    "member_news",
    "member_poll_options",
    "member_polls",
    "poll_option_counts"
  ]
}
```

- [ ] **Step 2: Write the failing black-box verifier tests**

Create `lib/production-db-security-gate.test.ts`. Use real temporary JSON files and `spawnSync(process.execPath, [verifierPath, fixturePath])`; do not mock Node process execution.

The fixture helper must construct each accepted result as:

```ts
const advisorResult = (name: string) => ({
  name: "security_definer_view",
  title: "Security Definer View",
  level: "ERROR",
  facing: "EXTERNAL",
  categories: ["SECURITY"],
  description: "accepted fixture",
  detail: `View public.${name} is owner-executed`,
  remediation: "https://supabase.com/docs/guides/database/database-linter",
  metadata: { name, schema: "public", type: "view" },
  cacheKey: `security_definer_view_public_${name}`,
});
```

Add these separate test cases:

```ts
it("accepts exactly the reviewed 25 security-definer views", () => { /* exit 0 */ });
it("rejects malformed JSON", () => { /* exit non-zero */ });
it("rejects a missing allowlisted view", () => { /* remove public_stats */ });
it("rejects an unexpected additional view", () => { /* add surprise_view */ });
it("rejects a duplicate finding", () => { /* duplicate public_stats */ });
it.each([
  ["name", "rls_disabled"],
  ["level", "WARN"],
  ["facing", "INTERNAL"],
  ["schema", "private"],
  ["type", "table"],
])("rejects a changed %s contract field", (field, value) => { /* mutate one result */ });
```

Assert that failure output names the contract violation but never contains the fixture `detail` or `description` text.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- lib/production-db-security-gate.test.ts
```

Expected: FAIL because `scripts/verify-production-security-advisors.mjs` does not exist.

- [ ] **Step 4: Implement the minimal verifier and CLI**

Create `scripts/verify-production-security-advisors.mjs` with:

```js
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const access = JSON.parse(
  readFileSync(new URL("./production-security-view-access.json", import.meta.url), "utf8"),
);
const expectedViews = [...access.public_read, ...access.signed_in_read].sort();

export function verifyProductionSecurityAdvisors(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.results)) {
    throw new Error("Advisor payload must contain a results array.");
  }

  const names = [];
  for (const result of payload.results) {
    if (
      result?.name !== "security_definer_view" ||
      result?.level !== "ERROR" ||
      result?.facing !== "EXTERNAL" ||
      result?.metadata?.schema !== "public" ||
      result?.metadata?.type !== "view" ||
      typeof result?.metadata?.name !== "string"
    ) {
      throw new Error("Unexpected advisor result contract.");
    }
    names.push(result.metadata.name);
  }

  const sorted = [...names].sort();
  if (new Set(sorted).size !== sorted.length) throw new Error("Duplicate advisor view.");
  const missing = expectedViews.filter((name) => !sorted.includes(name));
  const extra = sorted.filter((name) => !expectedViews.includes(name));
  if (missing.length || extra.length) {
    throw new Error(`Advisor view set mismatch; missing=${missing.join(",")}; extra=${extra.join(",")}`);
  }
  return { acceptedViews: sorted };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const path = process.argv[2];
    if (!path) throw new Error("Expected one advisor JSON file path.");
    const payload = JSON.parse(readFileSync(resolve(path), "utf8"));
    const result = verifyProductionSecurityAdvisors(payload);
    process.stdout.write(`Accepted ${result.acceptedViews.length} reviewed advisor findings.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Advisor verification failed."}\n`);
    process.exitCode = 1;
  }
}
```

Keep validation fail-closed. Do not log whole advisor objects.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- lib/production-db-security-gate.test.ts
```

Expected: all verifier cases PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git add scripts/production-security-view-access.json scripts/verify-production-security-advisors.mjs lib/production-db-security-gate.test.ts
git commit -m "test: define production advisor allowlist"
```

---

### Task 2: Normalize all 25 view grants through one forward migration

**Files:**
- Modify: `lib/production-db-security-gate.test.ts`
- Create via Supabase CLI: the single `supabase/migrations/*_normalize_production_view_grants.sql`
- Modify: `DECISIONS.md` by appending ADR-030 only

**Interfaces:**
- Consumes: `scripts/production-security-view-access.json` groups.
- Produces: exact final client grants: public-read views grant only `SELECT` to both client roles; signed-in-read views grant only `SELECT` to `authenticated`.

- [ ] **Step 1: Add the failing migration contract test**

Extend `lib/production-db-security-gate.test.ts` to find exactly one migration whose filename ends with `_normalize_production_view_grants.sql`. Assert:

```ts
expect(matchingMigrations).toHaveLength(1);
expect(migration).toContain("revoke all on");
expect(migration).toContain("from anon, authenticated");
expect(migration).toContain("grant select on");
expect(migration).toContain("to anon, authenticated");
expect(migration).toContain("to authenticated");
expect(revokeIndex).toBeLessThan(publicGrantIndex);
expect(revokeIndex).toBeLessThan(signedInGrantIndex);
```

Parse relation names from the three statements and compare them to the two JSON arrays. Assert there are 32 SQL migration files and no view is present in both access groups.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- lib/production-db-security-gate.test.ts
```

Expected: FAIL because there are still 31 migrations and no matching hardening migration.

- [ ] **Step 3: Generate the migration with the Supabase CLI**

Run exactly:

```powershell
npm.cmd exec -- supabase migration new normalize_production_view_grants
```

Expected: one new timestamped file under `supabase/migrations/`. Resolve it without guessing:

```powershell
$migrationPath = (Get-ChildItem supabase/migrations -Filter '*_normalize_production_view_grants.sql' -File -ErrorAction Stop).FullName
```

- [ ] **Step 4: Write the minimal forward-only SQL**

The migration must contain three statements in this order:

```sql
revoke all on
  public_delegates,
  public_events,
  public_news,
  public_stats,
  transparency_regions,
  transparency_stats,
  admin_admins,
  admin_audit,
  admin_delegate_queue,
  admin_events,
  admin_finance_stats,
  admin_members,
  admin_news,
  admin_overview,
  admin_payments,
  admin_poll_options,
  admin_polls,
  admin_region_stats,
  admin_settings,
  admin_support_messages,
  member_event_going_counts,
  member_news,
  member_poll_options,
  member_polls,
  poll_option_counts
  from anon, authenticated;

grant select on
  public_delegates,
  public_events,
  public_news,
  public_stats,
  transparency_regions,
  transparency_stats
  to anon, authenticated;

grant select on
  admin_admins,
  admin_audit,
  admin_delegate_queue,
  admin_events,
  admin_finance_stats,
  admin_members,
  admin_news,
  admin_overview,
  admin_payments,
  admin_poll_options,
  admin_polls,
  admin_region_stats,
  admin_settings,
  admin_support_messages,
  member_event_going_counts,
  member_news,
  member_poll_options,
  member_polls,
  poll_option_counts
  to authenticated;
```

- [ ] **Step 5: Append ADR-030**

Append a decision recording that the 25 owner-executed views remain intentional, grants are normalized to the two committed profiles, advisor acceptance is exact rather than blanket, and any view-set change requires review. Do not edit ADR-014, ADR-028, or ADR-029.

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
npm.cmd test -- lib/production-db-security-gate.test.ts
```

Expected: all tests PASS and the migration count assertion is 32.

- [ ] **Step 7: Commit Task 2**

```powershell
git add lib/production-db-security-gate.test.ts supabase/migrations DECISIONS.md
git commit -m "fix: normalize production view grants"
```

---

### Task 3: Integrate catalog checks, role probes, and advisor evidence into the workflow

**Files:**
- Modify: `lib/production-db-security-gate.test.ts`
- Modify: `lib/production-db-workflow.test.ts`
- Modify: `scripts/production-db-schema-check.sql`
- Modify: `.github/workflows/production-db.yml`

**Interfaces:**
- Consumes: the access JSON, migration, and advisor verifier from Tasks 1-2.
- Produces: a post-apply gate that fails on grant drift, incorrect role behavior, malformed advisor output, or any advisor-set change; artifact `production-db-security-evidence`.

- [ ] **Step 1: Write failing SQL/workflow contract tests**

Add assertions that:

```ts
expect(workflow).toContain("EXPECTED_MIGRATION_FILE_COUNT: 32");
expect(workflow).toContain("production-db-security-evidence/advisors.json");
expect(workflow).toContain("--fail-on none");
expect(workflow).toContain("verify-production-security-advisors.mjs");
expect(workflow).toContain("production-db-security-evidence");
expect(workflow).toContain("set role anon");
expect(workflow).toContain("set role authenticated");
expect(workflow).toContain("42501");
expect(workflow).toContain("permission denied for function has_any_admin_role");
expect(workflow).not.toContain("--fail-on error");
```

Assert ordering:

```ts
expect(applyIndex).toBeLessThan(schemaCheckIndex);
expect(schemaCheckIndex).toBeLessThan(roleProbeIndex);
expect(roleProbeIndex).toBeLessThan(advisorCaptureIndex);
expect(advisorCaptureIndex).toBeLessThan(advisorVerifyIndex);
```

Extend the SQL test to require `role_table_grants`, all 25 JSON names, and exact `anon`/`authenticated` privilege comparison while retaining the read-only keyword guard.

- [ ] **Step 2: Run targeted tests and verify RED**

```powershell
npm.cmd test -- lib/production-db-security-gate.test.ts lib/production-db-workflow.test.ts
```

Expected: FAIL because the workflow still expects 31, fails advisors directly, has no role probes/artifact, and the SQL verifier has no view-grant assertions.

- [ ] **Step 3: Extend the read-only SQL verifier**

In `scripts/production-db-schema-check.sql`, keep the existing required-relation and RLS assertions. Add an exact two-way set comparison between catalog views and the 25 names, then an exact two-way comparison between `information_schema.role_table_grants` for client roles and these expected tuples:

```sql
-- For each of the six public-read views:
(view_name, 'anon', 'SELECT')
(view_name, 'authenticated', 'SELECT')

-- For each of the nineteen signed-in-read views:
(view_name, 'authenticated', 'SELECT')
```

Use `VALUES` CTEs and `EXCEPT` in both directions. Raise `production view set drifted` or `production view grants drifted` on mismatch. Do not add any mutating statement.

- [ ] **Step 4: Add the post-apply role probes**

After `Verify schema and RLS`, add one `Run production role probes` shell step that:

```bash
set -euo pipefail
mkdir -p production-db-security-evidence

supabase db query --linked \
  "set role anon; select count(*) as anon_public_stats_rows from public.public_stats;" \
  > production-db-security-evidence/anon-public.txt
jq -e '.rows == [{"anon_public_stats_rows":1}]' \
  production-db-security-evidence/anon-public.txt >/dev/null

set +e
supabase db query --linked \
  "set role anon; select count(*) from public.admin_overview;" \
  > production-db-security-evidence/anon-admin.txt 2>&1
ANON_ADMIN_STATUS="$?"
set -e
test "$ANON_ADMIN_STATUS" -ne 0
grep -F "42501" production-db-security-evidence/anon-admin.txt >/dev/null
grep -F "permission denied for function has_any_admin_role" \
  production-db-security-evidence/anon-admin.txt >/dev/null

supabase db query --linked \
  "set role authenticated; select count(*) as authenticated_admin_overview_rows from public.admin_overview;" \
  > production-db-security-evidence/authenticated-non-admin.txt
jq -e '.rows == [{"authenticated_admin_overview_rows":0}]' \
  production-db-security-evidence/authenticated-non-admin.txt >/dev/null
```

The status and both expected denial strings are mandatory so a connection failure cannot pass as an authorization denial.

- [ ] **Step 5: Capture and verify advisors without blanket suppression**

Replace the existing advisor step with:

```yaml
- name: Capture security advisors
  run: |
    set -euo pipefail
    mkdir -p production-db-security-evidence
    supabase db advisors --linked --type security --level error --fail-on none --output-format json \
      > production-db-security-evidence/advisors.json

- name: Verify reviewed security advisor set
  run: node scripts/verify-production-security-advisors.mjs production-db-security-evidence/advisors.json

- name: Upload production security evidence
  if: ${{ always() }}
  uses: actions/upload-artifact@v4
  with:
    name: production-db-security-evidence
    path: production-db-security-evidence
    if-no-files-found: warn
```

Change both `EXPECTED_MIGRATION_FILE_COUNT` values from `31` to `32`. Keep all existing target, evidence-comparison, seed/config/reset, and secret boundaries unchanged.

- [ ] **Step 6: Run targeted tests and verify GREEN**

```powershell
npm.cmd test -- lib/production-db-security-gate.test.ts lib/production-db-workflow.test.ts
```

Expected: both files PASS.

- [ ] **Step 7: Commit Task 3**

```powershell
git add .github/workflows/production-db.yml scripts/production-db-schema-check.sql lib/production-db-security-gate.test.ts lib/production-db-workflow.test.ts
git commit -m "ci: verify reviewed production advisor findings"
```

---

### Task 4: Verify, review, and produce the one-migration production dry-run

**Files:**
- No new production code
- Read-only remote evidence only

**Interfaces:**
- Consumes: Tasks 1-3 at branch HEAD and linked production project `uorvlshbrlbdnbauxsws`.
- Produces: complete local verification, independent code-review findings resolved, and a sanitized dry-run showing exactly the one new grant-normalization migration.

- [ ] **Step 1: Run the focused security contracts**

```powershell
npm.cmd test -- lib/production-db-security-gate.test.ts lib/production-db-workflow.test.ts lib/security/schema-guards.test.ts
```

Expected: all focused tests PASS with zero failures.

- [ ] **Step 2: Run the full repository verification**

Run separately so a timeout cannot hide the failing stage:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
```

Expected: every command exits `0`.

- [ ] **Step 3: Review the branch diff**

Review `git diff 44d19fd...HEAD` and specifically verify:

- no existing migration changed;
- exactly one new migration exists;
- the access JSON contains 6 + 19 unique names;
- advisor verification is exact and fail-closed;
- role-probe failures cannot be mistaken for expected denial;
- workflow still has only three secret names and one non-dry-run `db push`;
- no seed/config/reset/repair path exists.

Address findings through new failing tests and focused commits.

- [ ] **Step 4: Revalidate the linked production identity**

```powershell
Get-Content supabase/.temp/project-ref
npm.cmd exec -- supabase projects list --output-format json
```

Expected: linked ref `uorvlshbrlbdnbauxsws`, project `Georgia Republic`, status `ACTIVE_HEALTHY`.

- [ ] **Step 5: Produce the read-only one-migration dry-run**

Run sequentially:

```powershell
npm.cmd exec -- supabase migration list --linked
npm.cmd exec -- supabase db push --linked --dry-run
```

Expected: the first 31 local/remote versions align; exactly one new local-only migration ends in `_normalize_production_view_grants.sql`; dry-run lists only that file. No seed or configuration change appears.

- [ ] **Step 6: Stop for owner approval**

Present the exact migration filename, target ref, project health, local/remote parity, dry-run output, and plain-language impact. Do not run non-dry-run `db push` until the owner explicitly approves that exact new migration.

