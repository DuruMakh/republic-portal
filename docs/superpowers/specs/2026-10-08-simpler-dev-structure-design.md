# Simpler development structure: one website, throwaway CI database, preview test sign-in

Status: design approved in chat by the owner on 2026-10-08 ("yeap its great"); awaiting review of this
written spec. Implementation plan follows in `docs/superpowers/plans/`.

## 1. Goal

Make the path from a change to a release simpler, cheaper and less flaky, without weakening the protection of
real members' data:

- one website (the real site, `respublika.ge`, Vercel project `georgia-republic`), not two;
- automated checks that run on a fresh database built for each run, not on a shared one;
- preview links the owner can check without Google or phone codes, through a one-click test sign-in;
- the demo site (`republic-portal.vercel.app`) retired at the end. The owner confirmed nobody uses it.

The release path for the real site does not change.

## 2. Where we are (2026-10-08)

| Piece | Today |
|---|---|
| Real site | Vercel `georgia-republic` (prj_pC1U9QvrAQgLpGs2V1nrlsm02ciV), domain respublika.ge, production Supabase `uorvlshbrlbdnbauxsws`. Merge to `main` = release. Its PR previews are skipped by an Ignored Build Step (`test "$VERCEL_ENV" = "preview"`) because its env vars are Production-only. Vercel Authentication protects every deployment except custom domains. |
| Demo site | Vercel `republic-portal` (prj_Js54qkNJPWNv68jAqj6FzNsfWA0P): production site `republic-portal.vercel.app` (demo banner, `Disallow: /`) and every PR preview. Uses staging Supabase `orcxtbedkexoclbfgvzd`. No deployment protection. |
| Test database | Staging Supabase `orcxtbedkexoclbfgvzd` in the owner's Duru org. Holds the canonical seed (`scripts/seed-staging.mjs`), canonical admins `+99550900000{1..4}`, and the owner's real account (approved delegate) plus owner smoke phones. |
| CI | `.github/workflows/ci.yml`, job `quality`: typecheck, lint, format, ka:scan, unit tests, build, Playwright e2e. Build and e2e use the staging secrets. e2e asserts exact facts about the canonical staging seed (12 approved delegates, leaderboard order) and fails when staging drifts. |
| Production DB changes | `production-db.yml` dry-run then apply, dispatched by Claude; `production-admin.yml` for admin grants. Token: scoped `github-production-db-2`. |

Pain this causes (all seen in the last two weeks): every push builds two Vercel projects, so the hobby plan's
100-deployments-a-day limit blocked real-site releases twice on 2026-10-08; e2e fails on staging drift that is
not a code defect; the shared staging SMS/OTP budget ran dry under overlapping CI runs; the owner's real
account lives in a database that test tooling writes to, so staging can never simply be wiped.

## 3. Decisions taken in chat

1. Keep a hosted test database (staging). Supabase branching (per-PR database copies) was considered and
   rejected: its GitHub integration pushes migrations and `config.toml` auth settings to production on every
   merge, Google sign-in needs per-branch setup, and the cost per open PR (about $0.32/day) is no saving.
2. Keep the production release path exactly as it is (merge = release; database changes via the guarded
   `production-db.yml` dry-run/apply).
3. Previews get a one-click test sign-in instead of Google. The owner "almost never" signs in on previews,
   only to check admin-panel changes.
4. The demo site is deleted last, after the replacements are proven.
5. GeoData (the owner's other Supabase project in the Duru org) is out of scope and is never touched.

## 4. Design

### 4.1 CI runs on a throwaway database

The `quality` job starts a local Supabase stack inside the GitHub runner with the Supabase CLI
(`supabase start`, Docker), which applies all migrations in `supabase/migrations/`. The canonical seed then
runs against that local stack, and build + e2e use the local URL and keys that `supabase start` prints. The
stack is discarded with the runner.

- No CI step reads the `STAGING_SUPABASE_*` secrets any more; they are deleted once the switch is proven.
- The seed and guard scripts (`scripts/seed-staging.mjs`, `scripts/staging-guard.mjs`,
  `e2e/cleanup-helpers.ts`, `e2e/otp-helpers.ts`) gain an explicit allow-list entry for the local stack
  (`http://127.0.0.1:54321`), next to the staging ref. The allow-list stays fail-closed: the production ref
  and any unknown host are still refused, and a unit test pins that.
- e2e keeps its exact assertions about the canonical seed. They become reliable, because every run starts from
  the same freshly seeded database.
- The per-run test phone logic and SMS budget workarounds can be simplified, since runs no longer share a
  database. Removing them is optional clean-up, not required for this change.
- Expected cost: about 2 to 3 minutes more per CI run for `supabase start`. No new paid service.

Proven when: a full CI run passes on the local stack, and a second run right after it also passes (no shared
state).

### 4.2 Previews move to the real site's Vercel project

- The real project's Preview environment gets the staging connection settings
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for staging),
  plus `NEXT_PUBLIC_APP_ENV=preview`, `PHONE_VERIFICATION_PROVIDER=test`, `NEXT_PUBLIC_AUTH_MODE=google`.
  Production-scoped variables are untouched.
- The Ignored Build Step is removed so previews build.
- Vercel Authentication on previews stays ON (it already is on this project). Preview links then open only
  for someone signed in to the owner's Vercel team, which matters because a preview offers one-click admin
  sign-in to the test database. The owner signs in to Vercel once per browser. Claude reads protected
  previews with `vercel curl`.
- Constraint: Claude does not handle secret values. Copying the staging keys into the real project's Preview
  environment is done either by a mechanism that moves them without Claude seeing them, or by the owner in
  a guided one-time step. The plan decides which, and asks in chat if a permission check blocks it.
- `lib/env.ts` keeps working unchanged: a preview build points at staging, so `isProductionEnv()` is false.

Proven when: a PR's preview on the real project builds, shows the preview banner, talks to staging (not
production), and the owner can open it.

### 4.3 Preview test sign-in

On preview builds only, `/login` (and `/join`) shows a small panel, „სატესტო შესვლა", with one button per
test person:

| Button | Signs in as |
|---|---|
| ადმინი | canonical super_admin fixture (`+995509000001`) |
| დელეგატი | one approved delegate from the canonical seed |
| წევრი | one active member from the canonical seed |
| ახალი მომხმარებელი | a fixture account reset to "signed in, not yet registered" before each sign-in |

Behaviour:

- A server action signs the chosen fixture in and sets the normal Supabase session cookies. It reuses the
  fixture sign-in mechanism the e2e suite already uses (`fixtureSession` in `e2e/otp-helpers.ts`: placeholder
  `@example.invalid` email + password derived from the service-role key). That logic moves into a shared
  server-only module so the app and e2e use one implementation (no copy-paste).
- The fixed persona list is the whole surface: no free-text phone, no account creation. The only write it
  does is the "new visitor" reset of its own fixture account.
- The panel and the server action are enabled only when the build is connected to an allow-listed test
  database (the staging ref or the local CI stack) AND `NEXT_PUBLIC_APP_ENV` is not `production`. It is an
  allow-list on the database, not a check of an env flag alone, so a mis-set flag on the real site cannot turn
  it on. The server action re-checks this on every call; hiding the panel is UX, the server check is the
  security.
- Guards against regression: unit tests for the gate (production ref, unknown host, missing vars all refuse);
  an e2e test that uses the panel on the CI stack; and a post-release check that `respublika.ge/login` does
  not contain the panel.
- All text is Georgian; the panel reuses existing design-system components (DESIGN.md).
- Recorded as an ADR in DECISIONS.md (number taken from main at merge time).

Proven when: on a preview, each button lands on the right page (admin panel, delegate cabinet, member
cabinet, registration start), and production's `/login` shows no panel.

### 4.4 Staging holds made-up people only

Once the test sign-in works, the owner's real account and smoke phones are no longer needed in staging. With
the owner's explicit yes in chat, they are removed and staging is reseeded from the canonical seed. From then
on staging can be refreshed whenever previews need it, without asking. The "never reseed staging" rule
(memory: staging-owner-account) retires with this step.

Proven when: staging contains only seed and fixture accounts, and previews still work.

### 4.5 Retire the demo site

With previews served by the real project (4.2) and CI off staging (4.1), the `republic-portal` Vercel project
has no remaining job. Steps:

1. Name exactly what goes (the Vercel project, its domain `republic-portal.vercel.app`, its GitHub
   deployment environments, `.vercel/project.json` in the main checkout which links to it) and get the
   owner's explicit yes.
2. Delete the Vercel project. Deletion is permanent; if a permission check blocks Claude, it is one click for
   the owner.
3. Update README, the specs index if any, Claude memory, and the `lib/env.ts` comment where they mention the demo site.

Proven when: a push to a PR creates exactly one Vercel deployment.

## 5. What does not change

- Real-site releases: merge to `main` deploys respublika.ge; verify after every merge.
- Production database changes: `production-db.yml` dry-run then apply; `production-admin.yml` for admin roles.
- The production Supabase project and its settings. Nothing in this work touches production data.
- The owner's sign-off on a preview link before every merge.

## 6. Order of work

Each step ships as its own PR (or dashboard change), is proven before the next starts, and is reversible until
4.5:

1. CI on the throwaway database (4.1).
2. Previews on the real project (4.2) and the test sign-in (4.3). These ship together: a preview on the real
   project without test sign-in would leave the owner unable to check admin changes.
3. Staging cleanup (4.4), after the owner's yes.
4. Demo retirement (4.5), after the owner's yes.

Budget note: until step 4, every push still builds both projects, so PRs in this work are pushed sparingly.

## 7. Risks

| Risk | Mitigation |
|---|---|
| The panel appears on the real site | Database allow-list gate checked on the server; unit tests; post-release check on respublika.ge. |
| Someone with a preview link signs in as test admin | Vercel Authentication on previews; staging holds only made-up people after 4.4. |
| Local Supabase in CI differs from hosted staging | Same migrations and seed; staging previews still exercise the hosted stack before every merge. |
| Moving secrets between Vercel projects | Claude never handles the values; mechanism or owner step chosen in the plan. |
| Previews from both projects during the transition | Short-lived; the demo project goes in step 4. |

## 8. Out of scope

- Supabase branching, per-PR databases.
- Changes to the production release or migration workflows.
- Upgrading the Vercel plan.
- GeoData.
