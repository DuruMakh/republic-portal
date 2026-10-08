# Security audit fixes — design

**Date:** 2026-10-08 · **Status:** decisions D1–D5 made (the owner delegated them to the agent,
2026-10-08: "made desitions best suitable in your opininon") · **Source:** the static security audit of
8 October 2026 (main @ 98923ca) and its same-day re-verification. The full audit report is kept outside
the repository; this document carries everything an implementer needs.

## For the owner, in plain words

The audit found one critical hole and a handful of smaller ones. This plan fixes them in five
releases, most urgent first:

1. **Release 1, the critical fix, within a day.** Nobody can attach someone else's phone number
   without that person's code any more. This is a code-only change, so the merge alone fixes both
   sites.
2. **Release 2, the database half.** The old back-door registration function is switched off. The
   "cancelled code" trick is made impossible at the root. The unlimited "is this personal ID a
   member?" check gets a limit of 3 tries per account, in total, and each try shows up in the admin
   audit log. The production database also gets these changes, after your yes on the dry run.
3. **Release 3, the website framework upgrade** (Next.js 16.3.8). It can run in parallel with
   release 1.
4. **Release 4, before-launch hardening:**
   - photos lose their hidden location data;
   - the phone's offline copy no longer keeps sign-in data;
   - the test-data script can only ever touch the test database;
   - approved delegates can no longer rename themselves; admins correct names instead.
5. **Release 5, SMS abuse limits.** Nobody can block a chosen person from joining or spam them with
   codes (section 7, D4).

Plus one GitHub setting: the production-database password can only be used by the main code line
(D1, applied 2026-10-08).

Not in this plan, unchanged by owner decision:
- personal-ID squatting (LB-1, deferred);
- what the verifier and finance roles can see;
- single-editor powers;
- the readable finance totals.

## 1. Verified findings this design fixes

| ID | Finding (re-verified 2026-10-08) | Fixed in |
|---|---|---|
| C1 | `complete_phone_verification_send` marks a superseded challenge `consumed_at = expires_at + 1µs`; `readOwnedChallenge` compares in JS milliseconds, so after expiry the challenge reads as a valid consumed proof and `verifyPhoneVerificationAction` attaches the phone with no code. `register()` is still granted to `authenticated` and checks only `auth.users.phone is not null`, so the attacker can register under the stolen number. | R1 (exact check), R2 (root cause + revoke) |
| H1 | `become_member_save_profile` checks `duplicate_personal_id` before `invalid_delegate`; a bogus delegate id rolls the call back, so one account can test unlimited IDs, with no trace. | R1 (client contract), R2 (reorder + cap + audit) |
| H2 | next@16.2.10. Applicable to our Vercel setup: server-action CPU DoS (GHSA-m99w-x7hq-7vfj), server-action id disclosure (GHSA-955p-x3mx-jcvp), cache confusion. The next/og RCE does not apply (no visitor text inside SVG), nor do the Windows, AVIF/remotePatterns or i18n-proxy ones. | R3 |
| H3 | GitHub environment `production-db`: `deployment_branch_policy: null`, no rules. Only collaborator: DuruMakh. Third-party actions pinned by tag see the production secrets. | Ops step + R2 (SHA pins) |
| M1 | Per-phone limits are shared across accounts and a send cancels every live code for that phone, so anyone can lock a chosen person out and send them ~120 SMS a day. | R5 |
| M2 | `authenticated` can UPDATE `profiles.first_name/last_name`; `public_delegates` shows them; approved delegates rename freely, unaudited. | R4 |
| M3 | Service worker `defaultCache` caches cross-origin GETs, including Supabase `/auth/v1/user`, after sign-out. Low. | R4 |
| M4 | Delegate photos and news covers are uploaded byte for byte (EXIF/GPS kept) and served raw. | R4 |
| M6 | `scripts/seed-staging.mjs` (destructive) refuses only on `NEXT_PUBLIC_APP_ENV=production` and prints the ref it wants typed. | R4 |

Corrections from the re-verification:
- M5 (public repo) is closed: the repo is private now.
- L4 (test-mode switches) was wrong: both switches fail closed.

## 2. Release 1 — exact phone-proof check (code only)

- New pure function `timestampMicros(iso)` in `lib/phone-verification/timestamps.ts`. It parses
  Postgres/ISO timestamps to `bigint` microseconds and returns `null` when the input doesn't match.
- `readOwnedChallenge` compares in microseconds. An unparseable timestamp throws (fail closed). A row
  carrying a non-null `superseded_at` is never usable. This is forward-compatible: the column arrives
  in R2, and until then the field is simply absent.
- `saveMembershipProfileAction` accepts the R2 return contract
  `{"error": "<token>"}` in addition to raised errors. It maps a returned error through
  `mapFunnelError`, never treating it as a `CabinetState`.
- New error token `personal_id_attempts_exceeded` in `lib/funnel.ts`.
- Merge = release on both sites. This alone closes the C1 attack: the superseded challenge's
  `consumed_at` is one microsecond after `expires_at`, so it fails `consumed <= expires`.

## 3. Release 2 — database hardening (migration-only PR, then production apply)

Migration 1, `<ts>_phone_proof_superseded_and_register_revoke.sql`:
- Table changes:
  - add `phone_verification_challenges.superseded_at timestamptz`, with check
    `(consumed_at is null or superseded_at is null)`;
  - backfill: rows with `consumed_at > expires_at` (only the old supersede marker can produce that,
    because a real consume requires `expires_at > now()`) get `superseded_at = now()` and
    `consumed_at = null`.
- `complete_phone_verification_send`:
  - restated, with supersede now setting `superseded_at = v_now`;
  - `consumed_at` stays null;
  - the scope `(user_id = p_user_id or phone = v_phone)` is unchanged here, because R5 changes it.
- `reserve_phone_verification_attempt` and `consume_phone_verification_challenge`:
  - restated, each adding `and superseded_at is null`.
- `register(text, text, text, text)`: `revoke execute ... from authenticated` (it stays revoked from
  `public, anon`).
  - `register_google` is SECURITY DEFINER and calls it as the owner, so registration keeps working.
  - The retired legacy phone form (`LegacyJoinForm`, `app/(public)/join/actions.ts`) can no longer
    register. Both sites and CI run `NEXT_PUBLIC_AUTH_MODE=google`; `.env.example` is switched to
    `google`. Deleting the legacy UI is a separate follow-up, the August plan's Task 9 step 9.

Migration 2, `<ts+1>_membership_personal_id_probe_cap.sql`:
- `become_member_save_profile` is restated from the live body (`20260728100000`) with these changes:
  - order: auth, profile state, birth date, employment, city, **delegate resolution**, then the
    personal-ID block;
  - in the personal-ID block, before the duplicate check: count **all** `audit_log` rows with
    `action = 'member.personal_id_conflict' and target_id = v_uid::text`, with no time window (D2).
    At 3 or more, `raise exception 'personal_id_attempts_exceeded'`, and the message sends the
    person to the support page;
  - on a duplicate (pre-check or the unique-violation race), insert an audit row and **return**
    `jsonb_build_object('error', 'duplicate_personal_id')` instead of raising, so the row commits;
  - the audit row is `(actor_id null, action 'member.personal_id_conflict', target_type 'profile',
    target_id v_uid::text, details null)`. `actor_id` stays null on purpose: `audit_log.actor_id` is a
    plain FK to profiles, and a non-null actor would make the account undeletable (it breaks e2e
    cleanup and any future deletion). The tried ID is never stored.
- The audit viewer gets the label `"member.personal_id_conflict": "პირადი ნომრის დამთხვევა"`.

Workflow and checks, in the same PR:
- `EXPECTED_MIGRATION_FILE_COUNT` goes up by two, in both jobs and in their tests.
- Every `uses:` in `production-db.yml` is pinned to a commit SHA:
  - `actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5`
  - `supabase/setup-cli@1dedf2c611547ede7232d26866dd3c56ab903bbb # v1.7.3`
  - `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4`
  - `actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0 # v5`
  - Re-resolve each tag with `gh api repos/<owner>/<repo>/git/matching-refs/tags/<tag>` on the day
    of implementation and use what it returns.
- `scripts/production-db-schema-check.sql` flips its legacy-register assertion: it now raises if
  `authenticated` CAN execute `public.register(text,text,text,text)`. It also asserts the
  `superseded_at` column exists.

## 4. Release 3 — Next.js 16.3.8

- Pin `next` and `eslint-config-next` to `16.3.8`, then run `npm audit fix` without `--force`. The
  remaining dev-only advisories (vitest/tinypool, sharp in build scripts) are recorded as accepted in
  the ADR, since they never reach the website.
- Full gates. Preview checks:
  - a delegate share image still renders;
  - sign-in and registration on the preview;
  - the service worker builds.

## 5. Release 4 — before-launch hardening

- **M4.** `lib/image-sanitize.ts` → `sanitizeUploadedImage(bytes, mime)`, built on `sharp`:
  - `.rotate()` applies the EXIF orientation, then re-encodes in the same format, which drops all
    metadata (GPS, time, device);
  - JPEG quality 90, WebP quality 90, PNG lossless;
  - used by both upload actions before `storage.upload`;
  - `sharp` moves from devDependencies to dependencies at `^0.35.5`, which also clears its advisories.
- **M3.** `lib/sw-routes.ts` → `isNeverCached(url, sameOrigin)`:
  - true for every cross-origin request (in practice Supabase auth, data and storage) and for the
    protected same-origin prefixes;
  - `app/sw.ts` uses it for its NetworkOnly rule;
  - sign-out deletes every runtime cache whose name does not contain `precache`.
- **M6.** `scripts/staging-guard.mjs` → `assertStagingTarget(url)`:
  - allows only the project ref `orcxtbedkexoclbfgvzd`, and its refusal never prints a ref;
  - used by `seed-staging.mjs`, `verify-schema.mjs`, `verify-security-fixes.mjs` and
    `scripts/security/db.mjs`.
- **M2.**
  - Migration: `protect_profile_columns()` raises `name_locked` when an `anon`/`authenticated` caller
    changes `first_name`/`last_name` on a profile that has an `approved` delegates row.
  - New RPC `admin_update_delegate_name(uuid, text, text)` for `super_admin`/`verifier`. It validates
    1–60 characters and writes audit `delegate.update_name` with the old and new names.
  - Code PR after apply: name inputs on `/admin/verify/[id]`, the `name_locked` message, and the audit
    label.
  - Unpublishing an approved delegate stays out of scope. It touches memberships and referral codes
    and needs its own design.

## 6. Release 5 — SMS abuse limits (numbers decided in D4)

- A send never cancels another account's live code: supersede scope becomes `user_id = p_user_id`
  only.
- Per account: one send per 60 s, 5 per hour, 10 per day, and at most 3 different numbers per day.
- Per number:
  - one send per 60 s across all accounts;
  - at most 10 per day across all accounts, **except** that each account always gets its first
    three codes for a number today (review change: with only one, the real owner was one lost SMS
    away from a day-long lockout). Nobody can lock a person out; spam costs a fresh Google account
    per three extra SMS.
- Site-wide: 1,000 sends per hour. Above that, sends answer "too many requests". There is no alert,
  because no mail is provisioned.
- No new "is this number a member?" signal: sends behave the same for member and non-member numbers.

## 7. Decisions (made by the agent on the owner's delegation, 2026-10-08)

**D1 — GitHub `production-db` environment: `main` only. Yes, applied 2026-10-08.**
- Deployment branch policy: custom, one rule `main`.
- No required reviewers. The owner only chats, so an approval click in GitHub would either never
  happen or be clicked by the agent, which protects nothing.
- What the setting does buy: a branch other than `main`, for example one pushed by a tricked coding
  agent, can no longer read the production database password or the Supabase access token.
- Actions pinned to commit SHAs ship in R2.

**D2 — personal-ID conflicts: 3 per account, in total, with no daily reset.**
- The threat model ranks confirming a named person's membership near the top. A daily allowance
  lets a patient prober keep asking, at 3 answers a day per account, indefinitely.
- A real person only hits a conflict when their ID is already taken (LB-1 squatting). That needs a
  human to resolve it, so the third conflict sends them to the support page instead of "try again
  tomorrow".
- Admins have no reset tool yet. That is acceptable for the same reason.

**D3 — approved delegates' names change only through super_admin or verifier, audited.**
- A delegate who needs a correction writes through the support page.
- Unpublishing a delegate stays out of scope.

**D4 — SMS limits as in section 6, with the site-wide ceiling raised from 300 to 1,000 an hour.**
- 300 an hour could turn real people away during a sign-up surge, such as a launch day or a
  televised moment, which is the worst time to fail.
- The per-account and per-number limits already bound abuse. The site-wide ceiling is only a
  backstop for the SMS bill.
- The automated tests are unaffected: each registration journey uses a fresh account and sends one
  code, so the per-account allowance always applies.

**D5 — order of releases.**
1. R1 (critical fix) first, at once.
2. R3 (Next.js) alongside it, pushed after R1 so the two builds don't land at once.
3. R2 next, **without waiting** for privacy step 2. Security fixes outrank it, and adapting step 2
   afterwards is small: rename its migration file and replace its re-grant with the revoke. R2's
   static test enforces this.
4. Privacy step 1 (`20261008140000`, additive, accepts a missing consent version) goes live in
   production together with R2's apply. Its own apply had been waiting for a go, and this decision
   gives it.
5. Then R4, then R5. Both before launch.

## 8. Sequencing and constraints

> **Superseded by owner order (2026-10-08):** everything ships as ONE release: one branch, one PR,
> one merge, one production apply. See
> `docs/superpowers/plans/2026-10-08-security-hardening-single-release.md`. The constraints below
> still apply where they are not about release order: tighten rules, privacy step 2 coordination,
> and verifying after merge.

- R1 and R3 are independent code PRs.
  - Stagger the pushes: every push builds both Vercel projects, and the hobby plan has a daily deploy
    limit.
  - After each merge, check the `Vercel – georgia-republic` status on the merge commit.
- R2 ships only after R1 is live on both sites, because R1's code understands R2's new return
  contract.
- R2's migrations apply to staging only after R2 merges (tighten rule).
- R2's production apply also applies any earlier pending migration. As of 2026-10-08 that is privacy
  step 1, `20261008140000`, whose apply was still waiting. Say so to the owner with the dry-run
  result.
- Privacy step 2 (`20261008150000`, branch `claude/privacy-consent-feature`) restates `register()`
  with `grant execute ... to authenticated`.
  - If step 2 merges **before** R2: R2's revoke comes later in order and wins.
  - If step 2 merges **after** R2 has reached production: step 2's migration must be renamed to a
    timestamp after R2's, otherwise `supabase db push` refuses out-of-order files. Its
    `grant ... to authenticated` line must also be replaced by the revoke.
  - R2 adds a static test, "the final grant state of `register()` excludes authenticated", which
    fails on a rebased step 2 until that is done.
- Every PR follows CLAUDE.md:
  - spec, plan, TDD, review, /qa on preview, then owner sign-off in chat;
  - the agent merges, pushes staging, and runs the production-db dry-run and, after the owner's yes,
    the apply;
  - verify georgia-republic.vercel.app after each merge.
- ADR numbers: the next free on main is ADR-045 today. Recheck before every merge.

## 9. Out of scope

LB-1 squatting; M7/M9; L-items except those named above; admin MFA and session time-box (dashboard
settings, checked separately with the owner's go); deleting the legacy phone UI; delegate unpublish.
