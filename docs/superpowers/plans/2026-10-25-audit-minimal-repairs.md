# Portal Audit Minimal Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the 16 retained audit repairs and the four explicitly selected companion corrections, with evidence that they work and no broader refactoring.

**Architecture:** Keep the existing Next.js application, Supabase authorization and database functions, pure domain helpers and design components. Use local editor state, three additive function-replacement migrations, and the existing release workflow.

**Tech Stack:** TypeScript, React, Next.js, Supabase/Postgres, Zod, Vitest/Testing Library, Playwright and Docker. No new package is planned. Update only Next.js and its matching lint package for the security patch.

**Spec:** `docs/superpowers/specs/2026-10-25-audit-minimal-repairs-design.md`.

**Status:** Owner selected subagent-driven implementation on 26 October 2026. Baseline `cb87c340e191dc96df549d258ab64cdce660854d`, 25 October 2026. Execution evidence is recorded in this plan's local SDD ledger.

## Global Constraints

- The owner authorized implementation using subagents on 26 October 2026. Execute the authorized work without asking the owner to make routine coding choices; retain the concrete owner sign-off gates for merge and database apply.
- Selected execution: a fresh implementer for each of six substantial tasks, with one independent review per task and a whole-branch review under `CLAUDE.md`. Run implementations sequentially in this checkout. All new repairs belong in one PR; checkpoint 0 releases already-merged code separately.
- Before editing, refresh `git status`, branch/main state and relevant code. Preserve this detached checkout's audit artifacts and every other worktree. Use a suitable existing worktree or a `codex/` branch for implementation; do not reset user work. Reconcile drift against this plan before carrying forward function definitions.
- Read relevant installed Next.js guides before code changes and after the framework update. Apply the repository's Supabase/security rules to database work. Preserve RLS, function grants, `search_path`, server authorization and admin audit records.
- Test the defect first, then fix only it. Use existing test files and helpers where practical. Add behavioral coverage for the changed boundary; do not replace the existing test framework or add tests that merely restate harmless documentation.
- Use fictional records only. Fixture/cleanup destination checks must pass before privileged database access. Do not weaken these checks for convenient ports or connect a test suite to production.
- No new product features or dependencies. The selected companions are BIZ-4, BIZ-5, ADM-3 and ADM-9 only. Other related/deferred/removed audit suggestions stay out of this batch.
- Preserve current UI layouts and bilingual account/public copy. Keep the existing product flags. No unrelated formatting or instruction rewrites.

## Review Focus

1. **Test destination and concurrency:** mislabeled production is refused before privileged client creation; overlapping personal-ID calls commit at most the existing three conflict records. Review lock order and final permissions. Task 1.
2. **Displayed versus saved state:** a second edit during saving stays dirty; list/export filters agree; failed poll reads are not empty data; timestamp ties do not duplicate/omit unchanged records across pages. Task 2.
3. **Asynchronous UI:** an old region response cannot overwrite a new one; initial saved selections survive; navigation releases the menu; feedback is announced once and focus does not jump unnecessarily. Task 3.
4. **Money and dates:** never change a debit into a credit, truncate an amount/reference, choose a fee, or replace an invalid supplied date with today. Task 4.
5. **Uploads and delivery:** enforce the same byte ceiling on client/server, recover from rejected requests, accept only the specified local URL exception, preserve erasure protections, and match reviewed code/database/deployment revisions. Tasks 5–6 and checkpoint 0.

## Checkpoint 0 — complete the already-merged deletion release

**Finding:** OPS-1. **Existing files:** `.github/workflows/production-db.yml`, `scripts/production-db-schema-check.sql`, and the four `20261009140000` through `20261009170000` deletion migrations. No new implementation is required for this checkpoint.

- [ ] Refresh read-only GitHub main, Vercel deployment and Supabase migration/function metadata. Expected audit baseline: source 45 migrations, production 41 through `20261008160300`, missing four deletion migrations. Target production is `uorvlshbrlbdnbauxsws`; do not assume that an older snapshot is still current.
- [ ] If the mismatch remains, dispatch the existing workflow's **dry-run** on the current merged main. Read its complete output and pending filenames, verify the target and commit, and show the owner the concrete release evidence. The workflow requires owner approval of this exact dry-run before its separate **apply** dispatch; do not treat preparation of this plan as that approval.
- [ ] After that approval, apply using its successful dry-run run ID. A changed commit/list invalidates the approval evidence and requires a fresh dry-run. Preserve the workflow's exact-match checks.
- [ ] Verify the workflow's schema/security gate, migration parity, deletion function presence/permissions, cleanup schedule and deployed SHA. Record what was checked; no real account is deleted for production verification.

**Done:** the existing deletion release is demonstrably complete. If authorization/access is pending, keep that delivery item pending and continue independent authorized local work; do not quietly bundle or apply unreviewed migrations. No new PR is needed for already-merged files.

## Preparation for the new repair batch

- [ ] Inspect service ownership before starting local tools: port 54321/54322 may belong to `republic-portal-planning-583e01`; port 3000 may serve another checkout. Do not stop/reset/seed that stack or let Playwright silently reuse the wrong app.
- [ ] Use an owned disposable stack on the supported ports when available. If occupied, proceed with source/unit work and arrange access before database tests/screenshots. Do not add port configuration or widen the database allow-list as a workaround.
- [ ] In the implementation checkout, install the lockfile dependencies with `npm ci` and the existing browser requirement with `npx playwright install chromium`. When the owned local stack is ready, use `npm run db:start` and `npm run db:seed` per README. Never print or commit generated environment secrets.
- [ ] Re-run only relevant baseline checks as each task starts. The prior audit's suite counts are historical evidence, not current passing results.

## Task 1 — test-safety checks, personal-ID cap and framework patch

**Findings:** AUTH-1, QA-1, DB-1, WEB-1. **Review focus:** 1.

**Files to modify:**

- `lib/env.ts`, `lib/env.test.ts`; `lib/phone-verification/provider.ts` and its tests.
- `app/api/dev/otp/route.ts` and `route.test.ts`.
- `e2e/cleanup-helpers.ts`, `cleanup-helpers.test.ts`, `otp-helpers.test.ts`; change `otp-helpers.ts` only if a privileged entry point bypasses the shared guard.
- `package.json`, `package-lock.json`; current version reference in `DECISIONS.md`.
- `.github/workflows/production-db.yml` as each migration changes the file count.

**Create:** one migration with CLI name `audit_personal_id_cap`; `e2e/personal-id-cap.spec.ts` for the controlled overlap case. Extend the relevant existing migration/security tests only as needed. Read the latest `become_member_save_profile` body in `20261008160100_membership_personal_id_probe_cap.sql` before copying it into the new migration.

- [ ] **Red — environment rules.** Add cases for missing/mistyped app environment, production Vercel with a development label, development label with the production Supabase URL, unknown hosts, and the existing allowed local URLs. Assert provider refusal and OTP refusal before any privileged client is created. Add equivalent destination failures to the shared fixture/cleanup helper tests. Keep real-provider cases passing.
- [ ] **Fix — reuse one rule.** Let `testSignInEnabled` accept an optional typed environment with `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_SUPABASE_URL` and `VERCEL_ENV`, defaulting to process values. Existing zero-argument callers remain compatible. Extend the phone provider's injected environment with these fields and evaluate that environment as a whole. Use this gate for test provider/dev OTP; add `isTestDatabaseUrl` to the existing fixture guard before client creation. No separate enable flag, new allow-list or generic policy module.
- [ ] **Red — database behavior.** Using fictional accounts, start from two committed conflicts. Hold a third conflict transaction open after the actual authenticated function call, then overlap further authenticated calls. The old implementation permits extra conflict answers/rows while that transaction is uncommitted. Assert that this exceeds three before the fix. Use the existing Playwright runner plus local Docker/`psql` access for the held transaction, not a new database-testing dependency. Poll bounded observable request/lock state, release the held transaction before awaiting blocked requests, and always clean up in `finally`.
- [ ] **Fix — serialize per account.** Generate the migration with `npx --yes supabase@2.109.1 migration new audit_personal_id_cap`. Add `FOR UPDATE` to the existing caller-profile read before the count; preserve all other validations, return values, audit fields and grants. Maintain profile-first lock order. Update both workflow migration-count values to the actual committed count.
- [ ] **Green — real database.** Apply only to the owned local database. Verify three total committed conflict rows, one final conflict response after the initial two, then attempts-exceeded for remaining calls. Check a different account proceeds independently, a read-only request still refuses, and ordinary successful profile save/resume still works. Preserve the existing sequential hardening test.
- [ ] **Patch framework.** Recheck the official advisory in the spec. Install the smallest compatible patched Next.js release, no lower than 16.4.1, and matching `eslint-config-next`. If 16.4.1 remains sufficient, use `npm install next@16.4.1 eslint-config-next@16.4.1`. Review the lockfile changes. Do not use `npm audit fix --force` or upgrade unrelated toolchains.
- [ ] Run the targeted environment/provider/OTP/helper tests, `npm run e2e:local -- e2e/personal-id-cap.spec.ts e2e/security-hardening.spec.ts`, `npm run typecheck`, and `npm run build`. Expected: all relevant assertions pass, normal real-provider configuration builds, lockfile resolves to patched Next.js. Have one reviewer inspect the diff against review focus 1, resolve material findings, then commit the task.

## Task 2 — saved staff edits, Member results and reliable list reads

**Findings:** ADM-1, ADM-2, ADM-5, PERF-1. **Review focus:** 2.

**Files to modify:**

- `app/[locale]/(admin)/admin/content/news/{NewsForm,ArticleActions}.tsx` and `[id]/page.tsx`; existing form/action tests.
- `app/[locale]/(admin)/admin/content/polls/{PollForm,PollActions}.tsx` and `[id]/page.tsx`; existing tests.
- `app/[locale]/(admin)/admin/members/page.tsx`, `page.test.tsx`, `export/route.test.ts`; export route only if needed to preserve filter parity.
- `app/[locale]/(admin)/admin/{audit,finances,support,transfer}/page.tsx`.
- `.github/workflows/production-db.yml` for the new migration count.

**Create:** `news/NewsEditor.tsx`, `polls/PollDraftEditor.tsx`, their focused component tests, and one CLI-generated migration named `audit_member_filter`. Add `e2e/admin-member-filter.spec.ts` for actual list/export database parity if the existing browser tests have no suitable home; reuse all existing fixture/sign-in/cleanup helpers.

- [ ] **Red — real editor composition.** Render the form with its actual action buttons. Change news visibility/content or poll question/options, attempt Publish/Open and assert no publication call. Cover save success, save failure, edit-then-revert and a second edit while the first save is pending. Verify existing unpublish/close behavior remains available as before.
- [ ] **Fix — local ownership.** `NewsEditor` receives the existing article, status, publication history and image URL and reproduces the existing form/cover/action layout. `PollDraftEditor` receives the existing draft poll and owns its form/action layout; leave open/closed result rendering alone. The forms expose an optional `onEditStateChange(dirty, saving)` callback. The buttons accept optional `publishBlocked` / `openBlocked` booleans, defaulting false for existing consumers. Track the normalized saved/submitted field snapshot; acknowledge only the snapshot that actually saved. Show the save-first instruction and disable only Publish/Open. Do not put publication inside Save or add a generic editor abstraction.
- [ ] **Red — category and paging.** Verify Member includes completed and active members, excludes registered supporters, and matches export under the same region/city/search filters. A direct active-only token stays exact. Include tied timestamps across a 50-row boundary and check the union of consecutive pages against the expected IDs in an unchanged dataset. Add a failed poll-options read case that must render the error boundary.
- [ ] **Fix — existing queries/functions.** Use the two-status predicate for `profile_completed` in the list. Generate `audit_member_filter`, restating the latest `admin_export_members` from `20260728143000_admin_members_city.sql` with the equivalent predicate; preserve signature, permissions, optional ID rules and audit contents. Append descending `id` to the existing timestamp sort in all five lists. Check `optionsRes.error` before rendering poll content. Update both workflow counts.
- [ ] **Green — integration and permissions.** With fictional supporter/completed/active records, compare list results/count with CSV membership and verify unauthorized export/ID access still fails. Run focused editor, members/export, poll-page and list-query tests; then `npm run e2e:local -- e2e/admin-member-filter.spec.ts`. The database can still open a valid saved poll and refuses an empty one. No extra pagination/indexing work follows from this test.
- [ ] Capture local staff screenshots for blocked unsaved publication, successful Save→Publish/Open, and the corrected Member filter/export summary. Obtain one task review, resolve material issues, then commit.

## Task 3 — mobile navigation and focused member-form feedback

**Findings:** UX-1, UX-2, UX-3. **Review focus:** 3.

**Files to modify:** `components/UnityHeader.tsx`, `components/OtpInput.tsx`; `app/[locale]/(unity)/support/SupportForm.tsx`; `app/[locale]/(member)/me/membership/MembershipWizard.tsx`; `app/[locale]/(member)/me/profile/{ProfileForm,RegisteredProfileForm}.tsx`; `app/[locale]/(member)/me/polls/PollCard.tsx`; their existing tests; `lib/i18n/messages/{public,accounts,shared}.ts` only where the changed copy belongs.

**Create if missing:** `components/UnityHeader.test.tsx`. Extend `e2e/support.spec.ts` and `e2e/membership.spec.ts`; add one focused mobile history case to the existing relevant browser suite rather than duplicating every route.

- [ ] **Red — asynchronous reads.** Resolve region A's city/delegate requests after region B's requests and assert B stays selected. Cover failed initial regions, failed dependent reads, successful empty responses, retry, saved initial city/delegate, and a referral-bound delegate. Ensure failures cannot submit stale IDs or erase entered profile text.
- [ ] **Fix — small effects and state.** Follow `ProfileForm`'s existing cancellation pattern. Clear dependent values on a user region change, ignore stale requests, and keep loading/error/empty distinct. Preserve initial resume values and referral behavior. Add local retry controls using existing components/copy; do not add a fetching library or reusable state machine.
- [ ] **Red/fix — menu and feedback.** Reproduce the menu left open after browser history changes; close on pathname changes. Add only the missing error/success announcements and submission/step focus described in the spec. Focus after the updated error/step is rendered, not on first mount. Preserve existing labels, working alerts and headings. Do not change middle-digit OTP editing, visual design or dormant pages.
- [ ] **Green.** Run `npm run test -- MembershipWizard ProfileForm RegisteredProfileForm SupportForm OtpInput PollCard UnityHeader` and the focused membership/support browser cases. Check a narrow viewport with Back/Forward, keyboard submission, first-invalid-field focus, retry, and normal success. Verify the changed English copy in the existing test locale without enabling English in production.
- [ ] Capture local screenshots of mobile navigation and representative loading/error/success states; record keyboard/focus checks in words because a screenshot alone cannot prove them. Get one task review and commit.

## Task 4 — safe bank amounts, complete references and explicit dates

**Finding:** BIZ-3. **Included companions:** BIZ-4, BIZ-5. **Review focus:** 4.

**Files:** `lib/bank-parse.ts`, `lib/bank-parse.test.ts`; `app/[locale]/(admin)/admin/finances/{actions.ts,actions.test.ts,types.ts,BulkMatch.tsx,BulkMatch.test.tsx}`. No new parser service or database migration.

- [ ] **Red — table-driven cases.** Keep existing valid cases and add `20`, `20.00`, `1000.00`, `10000.00`, `1 234,56`, leading-plus positive, negative decimal/integer, accounting parentheses, zero, over-limit values, payment-plus-fee/balance, malformed decimal fragments, invalid reference suffixes and absent/invalid/multiple supplied dates. Assert complete values or explicit problems, not just that the parser returns something.
- [ ] **Fix — token handling.** Recognize complete monetary tokens before applying sign/range rules; multiple candidates remain ambiguous even if one is invalid. Use integer fallback only when no decimal money candidate exists. Require a full alphanumeric boundary after a reference. Distinguish missing dates from invalid supported date tokens; exclude all recognized date tokens from amount analysis. Keep the public row shape, limit and supported formats.
- [ ] **Connect errors to preview.** Add parser problems `invalid_amount`/`invalid_date`; add only `invalid_amount` to `BulkStatus` and reuse `bad_date` for date failures. Update Georgian status wording so it covers invalid and out-of-range dates. An invalid supplied date must stay unresolved, not show today. Keep flagged rows unselectable and ensure confirm still validates the submitted rows server-side. Do not alter payment-duplicate concurrency, coverage or pricing.
- [ ] **Green.** Run `npm run test -- lib/bank-parse.test.ts 'app/[locale]/(admin)/admin/finances/actions.test.ts' 'app/[locale]/(admin)/admin/finances/BulkMatch.test.tsx'`. Expected: valid amounts remain exact, negative/ambiguous/bad-date rows cannot become recordable, no-date rows explicitly preview today's Tbilisi date, and existing duplicate/single-entry behavior passes.
- [ ] On the fictional local dataset, preview the supplied edge cases and confirm only an unambiguous valid row; show a screenshot with clear blocked-row reasons. Get one task review and commit.

## Task 5 — upload ceiling, local storage URLs and retry

**Finding:** OPS-2. **Included companions:** ADM-3, ADM-9. **Review focus:** 5.

**Files:** `lib/admin-schemas.ts`, `admin-schemas.test.ts`; `app/[locale]/(admin)/admin/content/news/{CoverUpload.tsx,actions.ts,actions.test.ts}`; `app/[locale]/(admin)/admin/verify/[id]/{DelegateProfileForm.tsx,DelegateProfileForm.test.tsx,actions.ts,actions.test.ts}`; `.github/workflows/production-db.yml` count. Retain the existing image-sanitization helper and tests.

**Create:** `CoverUpload.test.tsx` alongside its component if missing, `e2e/admin-image-upload.spec.ts`, and one CLI-generated migration named `audit_local_image_urls`.

- [ ] **Red — size and failures.** Test exactly 4,194,304 bytes and one byte above at the client/server validation boundaries. A fake-size unit fixture proves the byte check only; use a genuinely decodable image for integration. Simulate both returned errors and rejected save promises, then assert the button recovers, feedback appears, and selected file/text remain available for retry.
- [ ] **Fix — shared ceiling.** Set `PHOTO_MAX_BYTES` to `4 * 1024 * 1024`; change only associated 5 MB wording to 4 MB. Use it in both forms and existing server actions. Restore pending state in `finally` and handle transport failures with the existing error presentation. Preserve image sanitation, role checks and compensating file cleanup. Do not lower unrelated global limits or replace the upload transport.
- [ ] **Red — real local URL contract.** Upload a valid image through each current local action and show that saving its generated URL fails under the old functions. Add explicit rejection cases for non-local HTTP hosts, other ports, wrong buckets/record IDs, malformed filenames, credentials and appended query/fragment in the new exception. Keep hosted URL behavior and unauthorized-caller expectations unchanged.
- [ ] **Fix — narrow function replacements.** Generate `audit_local_image_urls`. Start from the latest `admin_set_news_image` definition in `20260722120000_r2_ladder_and_numbers.sql` and `admin_update_delegate_profile` in `20261009170000_account_deletion_races.sql`. Add only the two documented loopback origin/bucket/path exceptions, including target UUID matching. Preserve newest deletion protections, role checks, return types, revokes/grants and audit writes. There is no trusted SQL environment flag; do not add one or claim the format exception can identify a local deployment. Update both workflow counts.
- [ ] **Green.** Run targeted schema/form/action tests and `npm run e2e:local -- e2e/admin-image-upload.spec.ts`. Verify upload→sanitization→storage→database reference→render locally for both images, a just-over-limit file rejected before sending, and a failed request followed by successful retry. Confirm the stored image has no original metadata. Use the existing deletion regression tests to ensure the restated function retains their protections.
- [ ] Capture local upload/retry screenshots and actual byte sizes. Report the host limit as documentation-backed; do not describe a local request as a production upload test. Get one task review and commit.

## Task 6 — current guidance, final review and delivery

**Findings:** ARC-2, QA-2; final verification of every previous task. **Review focus:** 5 and the full spec.

**Files:** `ARCHITECTURE.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`, the obsolete comment in `lib/supabase/types.ts`; `scripts/security/coverage.mjs`, `docs/security/coverage.md`, `scripts/verify-security-fixes.mjs`; the two migration count values in `.github/workflows/production-db.yml` if not already updated. Existing checks: `lib/production-db-workflow.test.ts`, `lib/production-db-security-gate.test.ts`, `lib/account-deletion-migration.test.ts`.

- [ ] Correct only identified current inaccuracies. Use current design/decision references and explain the mixed Unity/Kronika rollout; leave historical plans, decisions and master rules intact. Record historical coverage's 27 July 2026 / `49891cd` provenance in the generator and regenerate only the static coverage from stored evidence. Label the retired verifier clearly; retain its safe refusal. No new live census or artificial fresh test date.
- [ ] Confirm all expected migrations are committed and both workflow counts equal the actual file count: baseline 45 plus the three planned migrations would be 48, unless source drift changes the baseline. Keep exact-count and exact-dry-run security checks. Run their existing tests, adjusting only assertions genuinely changed by the legitimate new definitions.
- [ ] Perform one whole-branch review against all 16 IDs and four companions. Check for accidental extra features, unnecessary helpers/dependencies, widened authorization, dropped SQL race checks, misleading screenshots, or changed unrelated files. Resolve material issues and rerun only affected checks after fixes.
- [ ] Run the full required checks once on the final branch: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run ka:scan`, `npm run test`, `npm run build`, `npm run e2e:local`. All must pass. Verify Playwright is running this checkout's app against the owned disposable database. Record real results and reasons for any configured skips; never substitute prior audit counts.
- [ ] Give the owner a plain-language summary and local Docker/Supabase screenshots showing staff save-before-publish, corrected Member results, mobile/form behavior, safe bank preview and upload/retry. Include database/concurrency and keyboard evidence separately. Keep generated screenshots/reports in `output/` unless the repository requires a small selected artifact in the PR.
- [ ] Push the completed branch and open one PR for this owner batch, including code, migrations and the corresponding tests. Attach the PR to this chat through the app tool. Verify CI on the exact head. Request the repository-required owner sign-off with the concrete local evidence before merging; never merge failing checks or push directly to main.
- [ ] Once merge is authorized, merge and verify Vercel's resulting deployment. Code remains compatible with the old function signatures while migrations are pending; list/export parity is not complete until the database update. Run the existing production workflow dry-run on the merged SHA, present its exact changes for the workflow-required owner approval, then apply using the successful reviewed run ID. Do not replace that gate with manual SQL.
- [ ] Verify migration/function/permission parity, deployed SHA and public read-only behavior. Production privileged operations remain untested unless actually exercised with separate authorization; local fictional tests supply behavioral evidence. Report completion only when both app and database delivery are proven. If a gate fails, keep the release pending and repair it forward rather than resetting production or editing applied history.

## Completion checklist

- [ ] Checkpoint 0 and Tasks 1–6 have concrete evidence, or an explicitly identified unresolved delivery boundary.
- [ ] Every keep-now ID and only the four named companion items are accounted for.
- [ ] No new architecture, dependency, service, configuration system or broad refactor was introduced.
- [ ] The owner can understand the outcome from the plain-language report and screenshots without reading source code.

An unresolved delivery boundary is reported as pending, not as a completed release. Owner implementation authorization does not claim that unchecked steps have run or replace the explicit release sign-off gates.
