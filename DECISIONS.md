# Decisions

The decisions that hold today, grouped by topic. Each keeps its ADR number because code and
tests cite them. The full original entries (reasoning, rejected options, incidents) are in
`docs/decisions-history.md`, frozen at ADR-051.

**How to add or change one**

- Only a real decision gets an entry: something a later reader could ask "why?" about. Bug
  fixes, review findings and implementation notes go in the PR and commit message.
- An entry is at most six lines: the rule, the reason, where it lives in the code.
- When a decision changes, edit its entry here and add "(changed YYYY-MM-DD)". Do not add a
  correction entry. Move what it replaced to "Retired or replaced" at the bottom.
- New number: one above the highest here AND in every open PR; recheck right before merging.
  ADR-048, ADR-049 and ADR-050 are claimed by open PRs (#44, #49 and #48, which must renumber
  its clashing 047).

## Delivery and environments

- **ADR-051 Simpler delivery.** Two process sizes, one PR per batch of owner requests, a
  database change ships with its code (CLAUDE.md "Process"). Development runs on Docker with a
  local Supabase (`npm run db:start`, `db:seed`, `e2e:local`); owner sign-off is on screenshots
  from it. No staging database, no preview links, no demo site. CI: `checks` on every push,
  `quality` (local stack, build, e2e) skips draft PRs, docs-only PRs skip CI.
- **ADR-047 Throwaway test databases.** CI builds and runs e2e on its own local Supabase stack,
  seeded by `scripts/seed-staging.mjs --confirm-ref local`. One test-database allow-list
  (`lib/env.ts` `isTestDatabaseUrl`, `scripts/staging-guard.mjs`). The test sign-in card on
  `/login` works only on a test database in a preview/development build, never on a live
  Vercel deployment.
- **ADR-028 Production database changes only through `production-db.yml`**: manually
  dispatched, exact project ref, dry-run then apply, `production-db` environment limited to
  `main`. Never `config push`, reset or seed production. Merge to `main` = release to
  respublika.ge; the migration is applied after the code merges, so code must work against
  the old schema in between.
- **ADR-046 First production admins** come from `production-admin.yml` (main-only, audited,
  actor null with a `via` marker). After that, roles are granted in the app at `/admin/admins`.
- **ADR-043 e2e signs seeded accounts in by password**, not SMS (`e2e/otp-helpers.ts`), only
  for the per-run e2e phones and the four canonical seeded admins.

## Stack and tooling

- **ADR-001 Stack:** Next.js + TypeScript + Supabase + Vercel, the stack the AI engineer is
  most fluent in. **ADR-002:** PWA first; store apps only if presence ever matters.
- **ADR-007 Current stable majors** ("floors, not pins"): Next 16 (Turbopack, `proxy.ts`
  instead of `middleware.ts`), TypeScript 6. ESLint stays on 9 until eslint-config-next
  supports 10. Next is at 16.3.8 since the October security release (ADR-045).
- **ADR-008 Hand-built service worker:** `app/sw.ts` bundled by `scripts/build-sw.mjs`
  (esbuild, postbuild), because @serwist/next does not support Turbopack. Inert in dev.
- **ADR-012 Typed Supabase clients:** the ssr factories are typed through
  `SupabaseClient<Database>` on the return, not the ssr generic, which is broken in
  @supabase/ssr 0.6.1. Revisit together with an ssr upgrade.
- **ADR-011 QR codes via `uqr`** (zero dependencies, pure SVG), rendered in the browser.
- **ADR-045 `sharp` is a runtime dependency:** every uploaded photo is re-encoded with its
  metadata (GPS, time, device) stripped and orientation kept (`lib/image-sanitize.ts`).
- **ADR-023 Georgian text integrity:** `scripts/ka-gate.mjs` blocks new quote corruption on
  changed lines; old corruption is accepted and cleaned whenever a line is touched.
  **ADR-025/026:** `npm run ka:scan` catches Latin, Cyrillic or Greek look-alikes inside
  Georgian, and runs in CI.

## Data and security model

- **ADR-009 Registration and membership writes are SECURITY DEFINER RPCs.** Server actions
  stay thin: zod, one RPC call, a Georgian error.
- **ADR-013 Own-profile edits:** a column-scoped UPDATE grant, the own-row RLS policy and the
  `protect_profile_columns()` trigger; anything compound is a definer RPC.
- **ADR-014 Admin access:** reads are self-gating definer views that never include
  `personal_id` or `birth_date`; writes are definer RPCs that insert their `audit_log` row in
  the same transaction. Audit actors are permanent, so e2e users never act as admins.
- **ADR-017 Community content:** no client grants on base tables; public, member and admin
  views carry the visibility rules; bodies are plain text (no markdown, no stored HTML); one
  vote per member is the primary key.
- **ADR-026 Every new view revokes client grants before granting** (default privileges make a
  fresh view writable); `lib/security/schema-guards.test.ts` checks every migration.
- **ADR-030 Owner-executed views** keep the committed public-read / signed-in-read grants; any
  change to the list needs review and an update to the access matrix.
- **ADR-021 Personal IDs are not column-encrypted** (owner, 2026-07-26): at-rest encryption,
  RLS, column grants and audited reveals. The squatting finding is deferred to launch in
  `docs/security/LAUNCH-BLOCKERS.md`.
- **ADR-045 Security hardening (2026-10-08 audit):** phone-proof timestamps compared in
  microseconds; legacy `register()` revoked, `register_google()` is the only path; three
  personal-ID conflicts stop the membership step, each audited; SMS send limits per account,
  per number and site-wide; approved delegates' names locked (admins correct them, audited);
  the service worker never caches signed-in or cross-origin responses.
- **ADR-016 Tbilisi is the day source** in SQL (`tbilisi_today()`) and TypeScript; CSV exports
  neutralise formulas; the last-super-admin guard is serialized.

## Sign-in and registration

- **ADR-031/033 Google is the identity; Verify.ge proves a phone once, at registration.** It
  sits behind `PhoneVerificationProvider`, calls the endpoint that accepts the dashboard key,
  and logs no numbers or codes. The `test` provider is refused in production.
- **ADR-018 Progressive registration:** a light sign-up makes a supporter; membership is a form
  in the cabinet; delegacy is a member-only request reviewed by admins.
- **ADR-022 The personal ID is asked at membership,** not at sign-up.
- **ADR-041 Privacy consent:** one required box (18+ and personal-data processing) at
  registration; `register()` stores the date and policy version and refuses a stale version.
  The version lives in `lib/privacy.ts`.
- **ADR-034 One header account button:** join for guests, cabinet when signed in. This relies
  on `NEXT_PUBLIC_AUTH_MODE=google`; phone mode would need the sign-in button back.

## Members, delegates and referrals

- **ADR-035 The free tier is called supporter** (მხარდამჭერი) wherever it is a standing or a
  count; the ladder copy says what each step does.
- **ADR-036 Membership application:** the wizard's steps are the member's details and an
  application the board reviews, with two required consents. Text only: there is no
  board-approval action yet, and the stored status is still `profile_completed`.
- **ADR-037 No dues for now:** every member is simply a member (წევრი), and counts include all
  members. Payment surfaces are hidden behind `SHOW_MEMBERSHIP_DUES`; the payment code,
  tables and admin finance tools stay, dormant.
- **ADR-019 Delegacy is a role only once approved;** approval closes the new delegate's own
  membership. The public registered figure is cumulative.
- **ADR-024 Referral codes:** every profile has one (`M-` for members; delegate codes never
  contain a hyphen, guaranteed by the generator, not a CHECK). An approved delegate's count
  sums both codes. `/delegates` redirects to the ranking page.
- **ADR-039 The referral card counts supporters and members apart,** derived on every read.

## Public site and design

- **ADR-020 Kronika (D3) is the design contract** (`prototype/kronika-d3/`, DESIGN.md): one
  red `#9F1D35`, warm ink on paper, rules instead of shadows, serif for names, dates and
  numerals. Marketing copy follows the mock; functional copy keeps shipped wording.
- **ADR-038 `/structure`** is information only, with a condensed display type and pebble motif
  scoped to it; the board roster lives in `lib/board-members.ts`. The header reads მთავარი,
  რეიტინგი, სტრუქტურა.
- **ADR-027 Mobile:** a sticky bottom tab bar on normal page scroll; tabs chosen per role by
  how often people return; singular tab labels because of the minimum text size.
- **ADR-022 Selects stay native** under the design-system styling.
- **ADR-025 The support page is a contact page.** Nothing is emailed; messages wait in
  `/admin/support`. Its RPC is callable only with the service role (ADR-026).
- **Hidden sections (ADR-034 finances, ADR-037 dues, ADR-042 events):** each is behind a
  server-only switch (`SHOW_PUBLIC_FINANCES`, `SHOW_MEMBERSHIP_DUES`, `SHOW_EVENTS`) that shows
  only for the word `true` and needs a redeploy. Nothing is deleted. The anon-readable finance
  total views stay readable until the owner decides otherwise.
- **Not-found pages:** every route group has its own `not-found.tsx` (ADR-034,
  `app/route-groups.test.tsx`); switch-hidden addresses are answered in `proxy.ts` with a real
  404 (ADR-040); a missing article, delegate or event keeps its title through a sibling
  `not-found.tsx` (ADR-044).

## Retired or replaced

| ADR                           | Was                                                                      | Now                                                  |
| ----------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| 003, 010, 015                 | Manual bank-transfer dues, `GR-` payment codes, the active-member engine | Dormant behind `SHOW_MEMBERSHIP_DUES` (ADR-037)      |
| 004                           | Phone-code sign-in through a dev inbox, an SMS provider at launch        | Google sign-in + Verify.ge phone proof (ADR-031/033) |
| 005                           | No Docker; the staging project is the dev database                       | Docker + local Supabase (ADR-051)                    |
| 006                           | Personal-ID encryption deferred                                          | Decided: not encrypted (ADR-021)                     |
| 024 (tier)                    | Membership fixed at 10 GEL a month                                       | No dues for now (ADR-037)                            |
| 028 (staging), 047 (previews) | Hosted staging, PR previews, the demo site                               | Deleted 2026-10-09 (ADR-051)                         |
| 029                           | CLI profile wording                                                      | Folded into ADR-028                                  |
| 032                           | Verify.ge REST API host                                                  | ADR-033's endpoint                                   |
| 016, 022, 024, 026 (rest)     | Implementation and review notes                                          | `docs/decisions-history.md` only                     |
