# Production Security Advisor Gate — Design

**Date:** 2026-08-11  
**Owner decision:** continue with exact allowlisting, live role probes, and least-privilege view grants  
**Status:** approved direction; written spec awaiting owner review

## 1. Objective

Make the production database verification gate both usable and strict after the
initial 31-migration bootstrap. The gate must accept the repository's 25
intentional owner-executed views, reject every unknown Supabase Security Advisor
error, and prove that client roles retain only the view access required by the
application.

This change preserves ADR-014's self-gating admin read model and the fixed-column
public read model. It does not convert the views to `security_invoker`, redesign
the application's data layer, change Auth/SMS settings, seed production, or
switch Vercel to the production candidate.

## 2. Verified problem

The production candidate `uorvlshbrlbdnbauxsws` has all 31 committed migrations
applied and is migration-clean. The post-apply Supabase Security Advisor returns
25 `security_definer_view` findings at `ERROR`, one for every `public` view.
Consequently, the current workflow command

```bash
supabase db advisors --linked --type security --level error --fail-on error
```

always exits non-zero even when the result contains only the view set already
accepted and documented by ADR-014 and the migration comments.

Live production probes established the access distinction the replacement gate
must preserve:

- `anon` selecting an admin view is rejected with PostgreSQL `42501` because the
  role-gate helper is not executable by `anon`;
- `anon` can select the intended public statistics view;
- all 17 `public` base tables have RLS enabled;
- no production user, OTP inbox, or support-message rows exist.

Catalog inspection also found legacy default privileges beyond the required
`SELECT` grants on several views. Those privileges are unnecessary and should
be normalized explicitly.

## 3. Considered approaches

### A. Exact allowlist plus grant normalization and live probes — chosen

Keep the intentional owner-executed views, reduce their client-role privileges
to an explicit matrix, capture advisor JSON without failing early, and validate
that JSON against a committed exact allowlist. Add live role probes so the gate
checks behavior as well as catalog shape.

This preserves the application's current read paths, makes the known exception
reviewable, and still blocks any new advisor error.

### B. Convert all views to `security_invoker` — rejected

This would silence the advisor finding but would change behavior. The public
views intentionally expose safe column projections from otherwise sealed tables,
and the admin views intentionally read protected base tables after self-gating on
the caller's admin role. Converting them without redesigning underlying grants,
RLS policies, and application reads would make valid pages return no data or fail.

### C. Disable or ignore Security Advisor — rejected

Running advisors with no validation would also admit future unrelated findings,
including newly exposed objects or unsafe privileged code. A blanket exception
is not a production gate.

## 4. Database change

Create one forward-only migration using `supabase migration new`. It normalizes
all 25 intentional views to one of two exact client-role grant profiles:

| Access profile | Views | Final client grants |
|---|---|---|
| Public read | `public_delegates`, `public_events`, `public_news`, `public_stats`, `transparency_regions`, `transparency_stats` | `SELECT` to `anon`, `authenticated` |
| Signed-in read | `admin_admins`, `admin_audit`, `admin_delegate_queue`, `admin_events`, `admin_finance_stats`, `admin_members`, `admin_news`, `admin_overview`, `admin_payments`, `admin_poll_options`, `admin_polls`, `admin_region_stats`, `admin_settings`, `admin_support_messages`, `member_event_going_counts`, `member_news`, `member_poll_options`, `member_polls`, `poll_option_counts` | `SELECT` to `authenticated`; none to `anon` |

For each group the migration first revokes all privileges from `anon` and
`authenticated`, then grants back only the listed `SELECT` access. It does not
change view definitions, owners, functions, RLS policies, base-table grants, or
data. The migration must be idempotent at the statement level and must not edit
the 31 already-applied migration files.

The committed migration baseline becomes 32 only after the new migration exists.

## 5. Components and interfaces

| Component | Responsibility |
|---|---|
| New migration generated as `normalize_production_view_grants` | Enforce the two exact view-grant profiles without changing view behavior or data |
| `scripts/verify-production-security-advisors.mjs` | Export a pure `verifyProductionSecurityAdvisors(payload)` function and provide a CLI that validates one JSON file path |
| `scripts/production-db-schema-check.sql` | Retain required-object/RLS assertions and add exact view-set and grant-matrix assertions |
| `.github/workflows/production-db.yml` | Capture advisor JSON, run the verifier and role probes, retain evidence, and enforce the 32-file baseline |
| Vitest contract tests | Prove verifier rejection behavior, migration grant ordering, and safe workflow ordering without credentials |

## 6. Advisor verification component

Add a small repository script that reads the JSON output produced by:

```bash
supabase db advisors --linked --type security --level error --fail-on none --output-format json
```

The CLI is invoked as:

```bash
node scripts/verify-production-security-advisors.mjs production-db-security-evidence/advisors.json
```

It accepts exactly 25 results with all of these properties:

- `name` is `security_definer_view`;
- `level` is `ERROR`;
- `facing` is `EXTERNAL`;
- metadata schema is `public`;
- metadata type is `view`;
- metadata name is one of the committed 25-view allowlist.

It fails on malformed JSON, duplicate findings, a missing allowlisted view, an
extra view, a different advisor type, a different severity/facing/schema/type,
or any additional result. Missing allowlisted findings also fail deliberately:
even a safer change to one view alters the reviewed security contract and must
update the allowlist through code review rather than silently drifting.

The script prints names and counts only. It never prints credentials, connection
strings, or raw database data.

## 7. Live database verification

Extend `scripts/production-db-schema-check.sql` to assert:

1. the catalog contains exactly the 25 allowlisted views;
2. their `anon` and `authenticated` privileges equal the matrix in section 4;
3. all `public` base and partitioned tables still have RLS enabled.

The workflow then runs three separate role probes:

1. `anon` can read exactly one row from `public_stats`;
2. an `anon` read of `admin_overview` exits non-zero and contains SQLSTATE
   `42501` plus `permission denied for view admin_overview`;
3. `authenticated` without a JWT identity reads zero rows from
   `admin_overview`.

The workflow treats any other command failure, SQLSTATE, output shape, or row
count as a failed gate. Connection failures cannot be mistaken for a successful
denial probe.

## 8. Workflow data flow

The existing two-dispatch contract remains unchanged:

1. Dry-run captures migration state and dry-run output for owner review.
2. Apply verifies the approved run, repository, workflow, main commit, and
   byte-identical fresh evidence.
3. Apply runs only the approved migration set.
4. Post-apply verification runs migration parity, schema/RLS checks, lint, the
   grant/role probes, raw advisor capture with `--fail-on none`, and the exact
   advisor verifier.

The raw advisor JSON is retained as a post-apply artifact even when verification
fails, so failures are reviewable without exposing secrets. The workflow remains
manual, main-only, serialized, pinned to CLI `2.109.1`, and restricted to the
existing three `production-db` Environment secrets.

## 9. Tests and review gates

Implementation follows TDD:

- unit tests first cover the advisor verifier's accepted exact set and each
  rejection class;
- workflow-contract tests first fail until the workflow captures JSON, invokes
  the verifier after apply, preserves the three-secret boundary, and expects a
  32-file migration baseline;
- static migration tests first fail until all 25 views are assigned to exactly
  one grant profile and the SQL contains revoke-before-grant ordering;
- existing unit, type, lint, formatting, and build checks remain required;
- a production dry-run must show exactly the single new hardening migration;
- the new remote migration is not applied without a separate explicit owner
  approval after the dry-run evidence is presented.

## 10. Failure and rollback policy

No existing migration is edited and no remote reset or migration repair is
allowed. A failed new migration stops the workflow. A verification failure after
apply is fixed forward with another reviewed migration or workflow change.

Because the database change only removes unnecessary client-role privileges and
regrants required `SELECT`, rollback is not performed by restoring broad default
privileges. If a required read path is unexpectedly denied, the correction is a
new explicit least-privilege grant backed by a failing access test.

## 11. External guidance

- Supabase view security:
  `https://supabase.com/docs/guides/database/tables#view-security`
- Supabase Data API grants and default privileges:
  `https://supabase.com/docs/guides/api/securing-your-api`
- Supabase RLS guidance:
  `https://supabase.com/docs/guides/database/postgres/row-level-security`
