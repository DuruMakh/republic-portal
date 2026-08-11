# Production Supabase environment — design

**Date:** 2026-08-11  
**Owner decision pass:** this conversation  
**Status:** approved for implementation planning

## 1. Objective

Create a separate Supabase project as the production candidate for the Georgian
Republic portal. For the next several months it remains a free-plan,
synthetic-data test environment. It is isolated from staging now so that the
same project can later become production without moving real data out of the
shared staging database.

This design covers database bootstrap and repeatable migration delivery. It
does not switch the live application to the new project.

## 2. Environment contract

| Environment | Project ref | Purpose |
|---|---|---|
| Staging | `orcxtbedkexoclbfgvzd` | Existing development, preview, demo data, and end-to-end testing |
| Production candidate | `uorvlshbrlbdnbauxsws` | Isolated free-plan project, initially for controlled synthetic testing, later eligible for production |

The production candidate belongs to the owner's separate Supabase account. The
developer invitation has been accepted. Staging must remain unchanged while the
new project is bootstrapped.

The free plan is an accepted tradeoff during this test period: the project may
pause after inactivity and does not provide the backup guarantees required for
a real-data launch. Those constraints must be revisited before collecting real
member data.

## 3. Delivery architecture

Supabase MCP is not part of this delivery path. Its OAuth organization scope is
inconvenient for this multi-account setup and it is not needed for repeatable
deployment.

The delivery path has two layers:

1. **One-time bootstrap from the Supabase CLI.** The standard `supabase` cloud
   profile is authenticated for the production account, using the local token
   label `republic-production`, and the repository worktree is explicitly
   linked to the production project. CLI credentials and the active cloud
   profile selector are stored in the user's Supabase configuration, never in
   Git. The CLI's `--profile` flag selects a Supabase backend configuration; it
   is not a name for a stored account credential.
2. **Repeatable delivery from GitHub Actions.** A manually dispatched workflow
   uses a dedicated GitHub Environment named `production-db` in two distinct
   dispatches. The first is dry-run-only and uploads reviewable migration
   evidence. After the owner reviews it, a second Apply dispatch names that
   dry-run run ID, proves the same workflow/repository/main commit, repeats the
   dry-run, requires byte-for-byte evidence equality, and only then applies
   committed migrations to the exact production project.

The implementation pins the verified CLI version `2.109.1` so local and hosted
behavior do not drift silently.

## 4. Migration-only boundary

The initial production bootstrap applies the 31 ordered SQL files currently in
`supabase/migrations/`. Schema history is the source of truth; production data
is never mutated by hand.

The repository's `supabase/config.toml` contains staging-specific behavior,
including permissive test Auth settings, a raised SMS rate limit, and the
development SMS hook. Therefore:

- `supabase config push` is prohibited in this phase;
- Auth, SMS, email, redirect, and session settings are configured only in a
  later, separately reviewed production-auth change;
- `scripts/seed-staging.mjs` and `supabase/seed.sql` are not run against the
  production candidate;
- no staging users, OTP inbox rows, fake membership roster, or staging content
  is copied automatically.

Controlled test accounts or content may be added later, but only through an
explicit test-data plan. The default production candidate starts with the data
that migrations intentionally create and nothing else.

## 5. Secrets and credentials

No credential, access token, database URL, or database password may be written
to a tracked file, workflow log, command transcript committed to Git, or
documentation.

The owner rotates the database password previously shared in chat before it is
installed in GitHub. The resulting credentials are stored as encrypted secrets
on the `production-db` GitHub Environment:

- `SUPABASE_ACCESS_TOKEN`
- `PRODUCTION_PROJECT_ID`
- `PRODUCTION_DB_PASSWORD`

The project ref itself is an identifier, not a secret, but the workflow still
compares the supplied target against the expected ref before any write. Local
bootstrap receives the password interactively or through a temporary process
environment; it is not saved in `.env.local` unless a later task explicitly
requires and reviews that choice.

Vercel receives no new Supabase variables in this phase because application
cutover is out of scope.

## 6. One-time bootstrap sequence

1. Authenticate the standard Supabase CLI cloud profile for the production
   account, label the stored token `republic-production`, and do not expose the
   token in the repository.
2. Link only the isolated production worktree to
   `uorvlshbrlbdnbauxsws`; do not replace the staging link in other worktrees.
3. Verify the remote project identity, region, health, current migration table,
   and whether any user schema objects already exist.
4. Compare the local and remote migration lists and run `supabase db push
   --dry-run` against the linked production candidate.
5. Present the exact dry-run result to the owner. Applying migrations is a
   separate explicit approval checkpoint because it writes to a remote system.
6. Apply the migrations once approved.
7. Verify migration parity and inspect expected tables, functions, views,
   grants, RLS state, and Supabase security advisors.

If the new project is not empty, its state must be explained and reconciled
before step 5. The bootstrap must never use `db reset` on a remote project.

## 7. GitHub Actions workflow contract

The later implementation adds a dedicated production-database workflow with:

- `workflow_dispatch` only during the test period and an `operation` input of
  `dry-run` or `apply`;
- the `production-db` GitHub Environment on both phases and a concurrency group
  that prevents overlapping production migration runs;
- a pinned Supabase CLI version, an exact project-ref assertion, and the exact
  31-file committed migration baseline before either database phase;
- a dry-run-only job that records the workflow reference, repository, main
  ref, commit SHA, run ID, linked migration list, and dry-run output as an
  immutable review artifact;
- an Apply-only job that requires the owner to manually supply the approved
  dry-run run ID in a second dispatch, downloads that artifact, verifies the
  same workflow/repository/main commit, and repeats the migration list and
  dry-run before any database write;
- byte-for-byte equality of the previous and fresh migration-list/dry-run
  evidence; any main-commit or remote pending-state change fails and requires a
  new dry-run review;
- migration apply only after that comparison, followed by a migration-list,
  read-only schema/RLS verifier, schema lint, and security advisors;
- no seed command, no `scripts/seed-staging.mjs`, no configuration push, and no
  remote reset.

The second, owner-reviewed manual Apply dispatch is the required approval
checkpoint immediately after a fresh dry-run; it does not rely on paid GitHub
Environment reviewer features. The workflow must not print secrets or construct
a database URL in a logged shell command. A failed identity check, evidence
comparison, dry-run, or migration stops the job.

Automatic deployment on every merge is intentionally deferred. Manual dispatch
keeps the write boundary visible while the product is still in test mode.

## 8. Failure and recovery

For the empty production candidate, a failed bootstrap stops immediately. The
team diagnoses the failed migration and fixes forward with a new migration;
already-applied migration files are not rewritten.

If initial bootstrap leaves an unusable database and no meaningful test data
exists, recreating the Supabase project may be proposed, but it remains a
separate destructive action requiring owner approval. No remote reset, manual
schema surgery, or migration-history repair is implied by this design.

Before meaningful test data accumulates, establish a manual logical-backup
routine. Before real users or irreplaceable data enter the system, revisit the
plan level, automated backups, restore testing, monitoring, Auth/SMS delivery,
and incident recovery.

## 9. Acceptance criteria

Bootstrap is complete only when all of the following are evidenced:

- the target is exactly `uorvlshbrlbdnbauxsws` and the staging project is
  unchanged;
- the remote migration versions exactly match the 31 committed local
  migrations expected at bootstrap time;
- expected public schema tables, views, functions, grants, and RLS policies are
  present;
- exposed tables have RLS enabled and high-risk security-advisor findings are
  either resolved or explicitly blocked from release;
- no staging seed, staging users, development OTP hook configuration, or fake
  production data was copied;
- no secret appears in Git history, workflow output, or tracked files;
- the GitHub workflow can upload reviewable evidence for a clean no-op dry-run,
  and an owner-reviewed Apply dispatch can only continue when its repeated
  evidence is identical;
- the application and Vercel still point to staging until a separately approved
  cutover.

## 10. Out of scope

- Vercel environment-variable changes or application cutover.
- Production Auth, SMS provider, email, CAPTCHA, redirect, and session policy.
- Real-person data, bank details, or public launch.
- Custom domains, monitoring, alerting, or paid-plan upgrades.
- Automatic staging-to-production data copying.
- Supabase MCP reconnection or organization switching.

Those are later release-readiness tasks. This change creates a safe database
foundation and a controlled migration path only.
