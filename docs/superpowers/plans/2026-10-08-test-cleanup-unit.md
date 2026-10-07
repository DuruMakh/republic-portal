# Unit-test cleanup (PR 1 of 3) — plan (2026-10-08)

Owner-approved test-suite audit, PR 1: remove unit tests that protect nothing, delete dead
code that only tests use, and make the unit suite faster — without losing real protection.
PR 2 (browser e2e, owns `e2e/**` + `playwright.config.ts`) and PR 3 (new security tests:
`app/api/dev/otp/route.test.ts`, `lib/security/schema-guards.test.ts`, new admin
`actions.test.ts` files, `app/(admin)/admin/members/export/route.test.ts`) run in parallel;
this PR touches none of their files. No production behaviour changes except deleting code
nothing imports.

Every audit claim is re-verified before acting; a claim that turns out wrong is skipped
and listed in the PR notes. Every kept test the audit flagged "can't fail" is either fixed
(and proven red by temporarily breaking the code) or deleted.

## Cross-PR coverage contract

- Deletable here because PR 2 keeps the browser check: sticky header / one bottom bar /
  bar-never-covers-footer / desktop chrome sweep; 360px no-overflow; one Georgian 404
  inside the header; /structure anchors; the membership/delegate/polls/news/events/payments
  journeys.
- Must stay here because PR 2 deletes the browser check: `MobileMenu` focus/Escape/trap;
  `LeaderboardDirectory`; `lib/mobile-nav` route list + `MobileJoinCta` "renders nothing on
  CTA routes"; login google-mode test; `SupportForm` "neither email nor phone";
  `(public)/layout` finance hidden/visible; `me/billing/page`; `lib/bank-parse`;
  `lib/community` poll-view rules; `lib/cabinet` approved-delegate routing.

## A. Speed — `vitest.config.ts`

`lib/**` tests run in the node environment (they are pure functions); any lib test that
truly needs a DOM gets a `// @vitest-environment jsdom` docblock. Components/app keep jsdom.

## B. CI — `.github/workflows/ci.yml`

Add `npm run ka:scan` after `format:check`. The Georgian homoglyph scan is documented as
mandatory (DESIGN.md) but never runs in CI. Nothing else in the workflow changes.

## C. Dead code (zero non-test importers, confirmed by search) + its tests

| File                                   | Change                                                                | Reason                                      |
| -------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| `lib/active.ts` + test                 | drop `computeCoverage`, its two constants and types; fix header       | SQL owns coverage; TS mirror unused         |
| `lib/mobile-nav.ts` + test             | drop `mobileChrome` (+ its private `inCabinet`, `MobileChrome` type)  | no component calls it                       |
| `lib/cabinet.ts` + test                | drop `initialsKa`                                                     | unused                                      |
| `lib/validation.ts` + test             | drop `validatePersonalId`                                             | unused                                      |
| `lib/slug.ts` + tests                  | drop `makeSlug`/`slugBase`; `seed-roster.test` uses `makeSlugFrom`    | only tests call them                        |
| `components/PhotoFigure.tsx` + test    | delete; drop styleguide sample + DESIGN.md row                        | only the styleguide renders it              |
| (kept) `OtpVerification`               | untouched                                                             | legacy auth mode is the documented rollback |

## D. lib trims

- `lib/phone-verification/migration-contract.test.ts` — delete: text checks of an applied,
  immutable migration.
- `lib/production-db-security-gate.test.ts` — delete the JSON-restating test and the
  applied-migration text test (incl. the `toHaveLength(34)` pin); checker tests call the
  exported `verifyProductionSecurityAdvisors()` directly with one subprocess test kept;
  `reviewedViews` read from `scripts/production-security-view-access.json`; drop the
  V8-wording JSON error assertion.
- `lib/production-db-workflow.test.ts` — keep the safety rules (manual dispatch only, main
  only, no cancel-in-progress, dry-run before apply with evidence compared, no seed/reset,
  read-only SQL check); cut version pins, jq-field pins, the thrice-repeated view lists.
  Both migration-count pins become ONE derived check: `EXPECTED_MIGRATION_FILE_COUNT` ===
  number of `.sql` files in `supabase/migrations`.
- `lib/security/verdict.tokens-drift.test.ts` — delete the two count tripwires.
- `lib/security/verdict.test.ts` — remove the duplicate P0001 block and the "restated" test.
- `lib/security/expectations.test.ts` — collapse the five one-entry ROLE_FAMILIES tests.
- `lib/funnel.test.ts` — one loop over every exported `ERROR_MESSAGES` key (bare and
  `P0001: ` prefixed) replaces ~30 literal tests; keep the 23505 guard and unknown→generic;
  merge duplicate `isReferenceCode` blocks; drop the fee-constant pin.
- `lib/admin.test.ts` — remove the Phase-5 duplicate blocks.
- `lib/cabinet.test.ts` duplicate routing case; `lib/funnel-schemas.test.ts` duplicate +
  BANK_DETAILS shape; constant-equals-itself tests in `phone-verification/contracts.test.ts`;
  `public-finances.test.ts` FINANCES_HREF; `seed-roster.test.ts` staging-number pins;
  `verify-ge.test.ts` header object asserted 3× → once; `pebbles.test.ts` function compared
  with itself (if present).

## E. components

- Delete: `StickyBar.test`, `ButtonLink.test`, `QrCode.test` (dup of ReferralCard),
  `MembershipPath.test`, `PhotoFigure.test`.
- Merge `BoardMemberCard.test` into `BoardRoster.test`.
- Trim pure Tailwind-class assertions: Ballot (keep pct→width, value-replaces-label; fix the
  page-wide `.bg-brand` selector), NewsCard, IndexRow, CenteredNotice, SectionRule, Select,
  OtpInput, Pebble, MobileBackHeader (keep the 0.74rem floor), Masthead (keep "no empty nav
  landmark", "one visible banner").
- `design-system.test.tsx` 24 → ~9 (keep danger button, Field label linking, CheckboxField,
  Stepper aria-current, Pill ADR-037 look + drift guard; fix or delete "dark variant").
- Delete the three removed-class `bg-brand/10` negative tests (AdminNav, CabinetNav,
  ContentNav); LeaderRow rank 2/3 can't-fail tests; NotFoundNotice tests 1 and 4; PebbleCouncil
  stagger-delay + counts duplicating lib/pebbles (keep the width-class bug guard);
  PebbleTally ellipse counts; DemoBanner dup of lib/env; ContentBody className test (keep
  rel/nofollow); MobileMoreSheet duplicate trap internals + sign-out (keep one wiring test);
  CabinetNav dups of lib/nav-active; useSignedIn test 4 (global React mock).

## F. app

- Delete `app/(public)/styleguide/styleguide.test.tsx` (slow, flaky; e2e loads /styleguide)
  and `app/(public)/not-found.test.tsx`.
- `structure/page.test.tsx` → one render; root `app/not-found.test.tsx` cut 3 dups, keep the
  4 hydration pins; `route-groups.test.tsx` small trim (keep no-banner + file check);
  `(public)/layout.test.tsx` keep finance hidden/visible, drop static-nav/removed-item tests;
  home `page.test.tsx` keep finance tests incl. "never fetches the finance totals", trim copy
  wall, merge wording tests; transparency metadata `toBeTruthy`.
- JoinForm trims (keep the Google/SMS state machine) + `lib/test-cabinet-state` fixtures
  (also MembershipWizard and done page); google-actions 4 same-branch cases; MembershipWizard
  21 → ~14 (keep F2/M2 regressions, aria-invalid, reject paths); done page dup;
  RegisteredProfileForm 60-char dup + generic pending; EventRsvp go/cancel dups; PollCard
  vote-submit dup; TeamRsvpCard; TeamTable removed-filter; VerifyCard fixture-echo + e2e dups
  (keep rejected stamp + error); BulkMatch special-case dup (keep the 9 status labels);
  NewsForm create dup; PollForm create dup + fix/delete "trimmed options"; SettingsForm STRONG
  tagName line; SupportForm :166 dup + merge the two success-path tests (keep :203
  regression and neither-email-nor-phone).

## Gates

typecheck, lint, format:check, full vitest (before/after counts + wall time), `next build`,
ka:scan, ka-gate on touched files. Push branch; no PR (coordinator staggers PRs).
