# Portal audit: minimal repairs specification

**Status:** Implementation authorized on 26 October 2026 using subagent-driven development. Production merge and database apply retain the concrete review/sign-off gates described below.

**Date:** 25 October 2026. **Source baseline:** `cb87c340e191dc96df549d258ab64cdce660854d`.

## Purpose and scope

Repair the concrete problems retained by the ten-reviewer re-review while keeping the portal's existing structure, design and services. Success means that the affected actions behave correctly, failures are understandable, and each repair has a specific check proving it works.

The review classified 77 findings: 16 keep now, 32 fix with related work, 21 defer and 8 remove. This specification includes **all 16 keep-now findings and only four related corrections**: bank reference/date parsing and local upload validation/error recovery. It does not turn the remaining audit suggestions into a new backlog for this release.

The local evidence register is `output/audit-2026-10-25/rereview/coverage.md`; individual re-reviews and production observations are alongside it. These are local audit artifacts. The requirements below are self-contained so implementation does not depend on carrying the entire audit scratch directory into the PR.

| Finding | Required outcome                                                                          | Delivery     |
| ------- | ----------------------------------------------------------------------------------------- | ------------ |
| OPS-1   | Release the four already-merged account-deletion database updates                         | Checkpoint 0 |
| AUTH-1  | Test phone verification and OTP lookup refuse production or an unapproved database        | Task 1       |
| QA-1    | Privileged test setup/cleanup refuses an unapproved database before connecting            | Task 1       |
| DB-1    | Concurrent requests cannot exceed the existing three-conflict personal-ID limit           | Task 1       |
| WEB-1   | Move Next.js and its matching lint package to a patched release                           | Task 1       |
| ADM-1   | Staff cannot publish news or open a poll with unsaved form changes                        | Task 2       |
| ADM-2   | The Member filter and CSV export include both completed member statuses                   | Task 2       |
| ADM-5   | A failed poll-options read displays an error, not an apparently empty poll                | Task 2       |
| PERF-1  | Equal timestamps have a stable order across the five paginated staff lists                | Task 2       |
| UX-1    | Navigation closes the mobile menu and releases its scroll/focus lock                      | Task 3       |
| UX-2    | Membership location/delegate lists cannot show stale results or conceal read failures     | Task 3       |
| UX-3    | Specified form failures, successes and step changes are announced and focus is useful     | Task 3       |
| BIZ-3   | Bank imports never turn a negative amount positive or select a fee from an ambiguous line | Task 4       |
| OPS-2   | The advertised image limit fits the hosted request limit                                  | Task 5       |
| ARC-2   | Current working instructions describe the current application                             | Task 6       |
| QA-2    | Old security evidence and its retired verifier are clearly dated/labeled                  | Task 6       |

Related corrections included: **BIZ-4** complete bank reference tokens, **BIZ-5** invalid supplied dates, **ADM-3** documented local storage URLs, and **ADM-9** recovery when an upload request rejects. Targeted regression tests address QA-3/QA-8 only as verification of these repairs.

## 0. Finish the existing deletion release first

The 25 October metadata check found 41 production migrations, ending at `20261008160300`, against 45 in source. The live app matched the source baseline, but its account-deletion functions were absent from both `public` and `private`. This is a release mismatch, not a reason to redesign deletion.

The missing files are:

- `20261009140000_account_deletion.sql`
- `20261009150000_account_deletion_hardening.sql`
- `20261009160000_account_deletion_followups.sql`
- `20261009170000_account_deletion_races.sql`

When release work is authorized, refresh the main/deployment/database evidence and use the existing `production-db.yml` dry-run and apply workflow for production project `uorvlshbrlbdnbauxsws`. The owner reviews the concrete dry-run before apply, as that workflow requires. Apply only the reviewed pending files; a different SHA or migration list requires a fresh dry-run. No new pipeline, manual SQL application, seed, reset or migration-history repair is proposed.

Completion evidence: workflow success, matching migration history, the existing schema/security checks including deletion functions and cleanup schedule, and the current deployed SHA. Actual deletion behavior is exercised with fictional accounts locally; do not delete a real account merely to test production. This checkpoint can ship independently of the new repairs because its code is already merged.

Preserve the accepted deletion rules. Export search text was explicitly excluded from erasure in the approved deletion design; PR-1 would change that retention decision and is outside this package. The existing best-effort photo cleanup and sweep also remain. This specification does not claim either limitation has been removed.

## 1. Protect test tools and the personal-ID limit

### Test environment checks

Use the existing `testSignInEnabled` / `isTestDatabaseUrl` rules rather than creating another environment policy. Test phone verification and `/api/dev/otp` must require all of:

- `VERCEL_ENV` is not `production`;
- `NEXT_PUBLIC_APP_ENV` is explicitly `preview` or `development`;
- the Supabase URL passes the existing test database allow-list.

Missing, mistyped and production settings fail closed. The allow-list is not broadened: it currently includes the documented loopback origins on port 54321 and the legacy named test project. This work neither restores that retired hosted project nor treats every localhost port as a test database. Real phone verification remains unchanged.

The provider factory's injected environment must be checked as one complete environment, using the same rule as its default process environment. Privileged fixture and cleanup helpers additionally check their actual database destination before constructing a privileged client. Existing shared helper entry points are the right place for that check; no new test-safety framework or configuration flag is needed.

### Personal-ID conflicts

The existing rule permits at most three recorded conflicts for one account, permanently. Concurrent requests currently can inspect the same old count. Serialize this account's checks by locking its existing profile row before reading the conflict count, using the same profile-first ordering as deletion. Keep the current function signature, returned refusal, audit contents, grants and all other validations.

After two recorded conflicts, overlapping attempts for that account may produce only one additional conflict response and audit row. Later requests must receive the existing attempts-exceeded response before another ID lookup. Different accounts must not share a new global lock. Do not add a counter column, daily reset, separate rate-limit service or new table. The audit demonstrated a possible transaction interleaving, not a measured frequency of ordinary production requests.

### Framework patch

The lockfile currently contains Next.js 16.3.8. Update Next.js and `eslint-config-next` together to at least 16.4.1, the fixed version for the reviewed Server Actions availability advisory. Recheck official advisories at implementation time and use the smallest compatible patched release; keep unrelated packages unchanged. The [official advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) identifies versions through 16.4.0 as affected. No production attack test is needed.

## 2. Make staff actions match what the screen says

### Save before publishing

For an existing news article or draft poll, disable Publish/Open while form changes are unsaved or a save is pending. Show the short instruction “Save changes first” in the existing Georgian admin interface. Saving successfully enables the action only if the currently displayed values match what was saved. A failed save remains dirty. Editing again while a save is in flight must not mark the newer changes saved. Returning fields to their last saved values clears the dirty state.

Use local state shared by each existing form and its action buttons. Two small editor composition components are sufficient; no general form engine, automatic saving or new publication database operation is needed. Preserve the layout, separate cover upload, current publication permissions, and close/unpublish/delete behavior. This repairs unsaved edits; the re-review did not establish a separate queued-Save race.

### Member list, export and pagination

Keep the current `profile_completed` filter URL/API token, but interpret its visible **Member** category as both `profile_completed` and `active_member`. Apply the same rule in the list and the existing export database function. A direct `active_member` filter remains exact. Other filters, search, count, role checks, ID-export permission and audit recording remain unchanged. No member data or status is rewritten.

For staff Members, Audit, Finances, Support and Transfer lists, keep the existing newest-first timestamp order and append the unique `id` in the same descending direction. This guarantees a deterministic order for tied timestamps in an unchanged dataset. It does not promise a frozen snapshot across new inserts, and does not require cursor pagination, new indexes or performance infrastructure.

If reading poll options fails, show the existing error/retry boundary. Do not substitute an empty options list. The database already prevents opening an actually empty poll; retain that protection.

## 3. Correct the identified member and mobile interactions

In `UnityHeader`, close an open mobile menu when the pathname changes, following the existing `MobileMenu` pattern. Browser Back/Forward and navigation must release the menu's body-scroll and focus behavior. Resizing an otherwise visible, closable menu is not a separately established defect; do not add a breakpoint listener for it.

In `MembershipWizard`, cancel/ignore outdated region, city and delegate reads. A user changing region immediately clears the old dependent selection and cannot submit an old city's value while the new list loads. Preserve a valid saved city/delegate when initially resuming the form, and preserve the existing referral-bound delegate rule. Distinguish loading, a successful empty result and a failed read; offer an in-place retry that retains entered information. Use the existing cancellation pattern from `ProfileForm`, without a data-fetching dependency or shared request framework.

Limit form feedback changes to `SupportForm`, `MembershipWizard`, `ProfileForm`, `RegisteredProfileForm`, `OtpInput` and member `PollCard`:

- Associate visible errors with fields and focus the first visible invalid field after a failed submission; if no field can receive focus, focus the form-level error.
- Announce asynchronous failures and save/success outcomes where the current form does not already do so. Preserve existing working alerts and avoid duplicate announcements.
- Move focus to the existing heading/content when the wizard changes step or a successful support submission replaces the form. Do not move focus on the initial page load or on every keystroke.

Keep current components, native controls and styling. New or changed public/account feedback has Georgian and English copy in the existing dictionaries. English remains hidden under the current product setting; do not enable it or the hidden events, ratings or dues features. Broader copy, heading, OTP-editing and visual redesign suggestions remain outside scope.

## 4. Make bank import parsing conservative

Keep `parseStatementRows(text)` as a pure function and keep the existing preview/confirm flow. A flagged row cannot be confirmed as a payment; staff can resolve it through existing single entry.

| Input condition, after removing reference/date tokens                   | Required treatment                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| One supported positive amount, at most 10,000 GEL                       | Parse the complete amount, including `1000.00`, `10000.00` and `1 234,56`       |
| Negative amount, accounting parentheses, zero or an out-of-range amount | Flag invalid; never discard a sign or take a smaller substring                  |
| More than one monetary candidate, including payment plus fee/balance    | Flag ambiguous; do not drop an invalid candidate and choose the remaining value |
| No decimal candidate, one supported integer                             | Preserve integer fallback                                                       |
| Decimal candidates exist but cannot be accepted                         | Do not fall back to an unrelated integer                                        |
| `GR-ABC234I` or `GR-ABC2340`                                            | Do not shorten into `GR-ABC234`; require a complete alphanumeric token boundary |
| No supplied date token                                                  | Preserve the existing default to today's Tbilisi date, displayed in preview     |
| A recognized date token is invalid                                      | Flag invalid date; do not replace it with today or a later valid date           |

Retain decimal dot/comma with two fractional digits and the supported space-thousands format. An optional leading plus on an otherwise valid amount may be accepted; a minus or surrounding parentheses denotes a rejected debit. Do not introduce bank-specific format guessing. For multiple valid supported date tokens, use the first in text order; a recognized invalid date anywhere on the line blocks automatic matching. Strip recognized date tokens from amount analysis, including invalid ones, so their digits cannot become payments.

Add `invalid_amount` and `invalid_date` to the parser problem union. Carry `invalid_amount` into the preview status and map invalid dates to the existing `bad_date` status with accurate wording. An invalid date stays visibly unresolved instead of displaying today. Keep the confirmation schema, server validation, duplicate rules, fees, membership coverage and existing atomic bulk write. The separate concurrent-payment finding is not included.

## 5. Keep image uploads within their supported limits

Set the shared image ceiling to **4 MiB (4,194,304 bytes)** and display “4 MB” using the existing interface convention. Enforce it both before sending and on the server for news covers and delegate photos. This leaves room for the small form fields and multipart overhead under the hosting platform's documented [4.5 MB request limit](https://vercel.com/docs/functions/limitations#request-body-size). Keep the current image formats, decoded-pixel limit, resizing and metadata removal. No direct-to-storage upload redesign is needed.

Both upload forms must leave the saving state after a returned error or a rejected request, announce the failure, and allow retry without losing entered text or the selected file. Retain the existing cleanup of a newly uploaded file if saving its database reference fails. Do not add a queue or orphan-cleanup service.

For local Docker verification, the two existing image-setting database functions must also accept the exact storage URL shapes generated by the current actions on `http://127.0.0.1:54321` and `http://localhost:54321`, in their respective `news-images` and `delegate-photos` buckets. Require the existing UUID/timestamp/extension filename shape and the target record's UUID for this new local exception. Preserve existing hosted URL behavior, authorization, auditing and deletion-race checks.

This is a narrow URL-format exception in the same database functions, not detection of the deployment environment: the functions have no trusted environment setting today. Only already-authorized staff may call them, and normal application actions derive URLs from configured storage. Do not allow arbitrary HTTP hosts, alternative ports, credentials, query strings or fragments in the new local exception, and do not invent a database environment/configuration system.

## 6. Correct current guidance without rewriting history

Update the misleading current claims in `ARCHITECTURE.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md` and the obsolete local-Docker comment in `lib/supabase/types.ts`. Current design guidance is `DESIGN.md` plus current `DECISIONS.md`; Unity is adopted page by page, while `prototype/kronika-d3/` remains a reference for unchanged Kronika surfaces. Preserve the master instructions and historical decision documents. Update the current framework version reference after the patch; no new ADR is required for these routine repairs.

The generated security coverage must say it is historical evidence from 27 July 2026, source commit `49891cd`, rather than implying a fresh test run. Put the label in its generator so it survives regeneration. Mark the hosted-staging verifier as obsolete for the current local workflow while preserving its safe refusal. Do not relaunch the old census, port its attacks or manufacture new totals.

## Delivery and proof

Use six implementation tasks and one PR for the new code/database batch. The only expected new migrations replace the existing personal-ID, member-export and image-URL function definitions; they add no tables or services. Generate their timestamps when implementing and retain the newest function bodies' security and race protections. The release workflow's two migration-count checks must match the resulting committed file count.

The application remains callable before these new function replacements reach production: signatures and return types are preserved. The Member list/export correction is fully complete only after its database update, so the short code-to-database release interval is not claimed as final parity. Follow the existing merge-then-database workflow; no feature-flag or compatibility layer is warranted.

Verification consists of targeted failing tests followed by passing fixes, one review per task and a whole-branch review, the existing full checks once at the end, and local Docker/Supabase screenshots of the changed flows. Database tests use fictional data and actual authenticated calls, including controlled overlapping transactions for the personal-ID cap. A source-text assertion alone is insufficient for that fix.

Before local setup, identify ownership of services already using ports 54321/54322 and 3000. The audit observed another worktree's local stack on the standard database ports. Do not stop, reset, seed or silently reuse it. Source/unit work can proceed while arranging an available local stack; local sign-off remains pending if the required ports cannot be made available with authorization. CI provides its own disposable database but does not substitute for the required local screenshots.

The owner receives a short explanation and screenshots before merge, as required by the repository process. CI must pass. After merge, use the existing reviewed production database workflow and verify deployed SHA, schema parity and public read-only behavior. Do not claim production payment, upload or deletion behavior was tested unless it actually was; privileged mutation tests belong on the local fictional dataset.

If a release check fails, stop claiming completion and correct it forward. Do not reset production, edit applied migrations or undo migration history. Any application rollback must be database-compatible and remain on a patched framework version.

## Explicit exclusions

No architecture rewrite, new dependency/service, general form framework, background worker, state library, cache layer, pagination redesign, broad test rewrite, generated database types, design-system replacement, SEO expansion or blanket dependency upgrade. No implementation of the other related/deferred findings simply because a nearby file is touched. Preserve the separately accepted decisions on deletion retention, photo cleanup, membership eligibility, dormant features and authentication. The implementation plan may choose routine details within these boundaries; a larger product or architecture change needs a separate scope decision.
