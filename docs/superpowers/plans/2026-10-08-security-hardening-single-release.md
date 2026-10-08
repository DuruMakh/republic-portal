# Security hardening — single release

> **For agentic workers:** this file overrides the release steps of the four security plans. The
> tasks' code and tests stay as written there:
> - `docs/superpowers/plans/2026-10-08-security-fixes-registration.md`
> - `docs/superpowers/plans/2026-10-08-security-fixes-nextjs-upgrade.md`
> - `docs/superpowers/plans/2026-10-08-security-fixes-before-launch.md`
> - `docs/superpowers/plans/2026-10-08-security-fixes-sms-limits.md`

**Owner order (2026-10-08):** "prepare everything as one release, I don't want different releases
separately, it would be one big work on security." So there is one branch
(`claude/security-hardening`), one PR, one merge, and one production database apply.

**Spec:** `docs/superpowers/specs/2026-10-08-security-audit-fixes-design.md`. Decisions D1–D4 stand.
D5's release order is replaced by this file.

## What changes against the four plans

**Four migrations instead of five** (the fourth added at the merge with main, see below). The
timestamps are after privacy step 2's `20261008150000`:

| File | Contents (plan → task) |
|---|---|
| `20261008160000_phone_verification_hardening.sql` | `superseded_at` + backfill (registration T6); `complete_phone_verification_send` with **both** the explicit supersede marker (registration T6) and the sender-only scope (sms-limits T1); attempt/consume guards (registration T6); `reserve_phone_verification_send` limits + index (sms-limits T1); `register()` revoked (registration T6) |
| `20261008160100_membership_personal_id_probe_cap.sql` | registration T7 (D2: no time window) |
| `20261008160200_delegate_name_lock.sql` | before-launch T6 |

`EXPECTED_MIGRATION_FILE_COUNT`: 36 → 39 (one more if privacy step 2 merges first).

**One ADR (next free number) covering the whole release:**
- C1, both halves;
- H1 cap, with the null-actor rule;
- H2 (Next.js 16.3.8, `npm audit fix`, accepted dev-only leftovers);
- H3 (D1 applied, action SHAs);
- M1 rules;
- M2 lock;
- M3 never-cache;
- M4 sharp as a runtime dependency;
- M6 guard.

**The real site's code goes live at merge, before the production apply.** Every code change must
work against the old schema for that window:

| Code | Old schema behaviour | OK? |
|---|---|---|
| exact timestamps, returned-refusal mapping | independent of schema | yes |
| `typeof superseded_at === "string"` | field absent, so it is skipped | yes |
| `name_locked` message mapping, audit labels | the token never occurs yet | yes |
| admin rename form | calls an RPC that doesn't exist yet, so it shows the generic error | acceptable: admin-only. Run the production dry-run right after merge to keep the window short |
| sharp / service worker / Next.js / script guard | no database involvement | yes |

## Task order

1. Exact phone-proof timestamps (registration T1, T2).
2. Membership returned-refusal contract and token (registration T3), with the D2 message.
3. Migration model (registration T5).
4. Phone verification migration, types, store `superseded_at`, schema check, `.env.example`, static
   tests (registration T6 and sms-limits T1, merged into one file).
5. Membership cap migration, audit label, tests (registration T7).
6. Delegate name lock migration and types (before-launch T6), then the UI (before-launch T8).
7. Image sanitizing (before-launch T1, T2).
8. Never-cache and sign-out cache clearing (before-launch T3).
9. Staging guard (before-launch T4).
10. Workflow SHAs and count (registration T8).
11. Next.js 16.3.8 (nextjs-upgrade T1).
12. The SMS scenario file (sms-limits T2).
13. ADR. Full gates: typecheck, lint, format:check, ka:scan, test, build.

## Release procedure

1. **Independent whole-branch review** (CLAUDE.md) before anything touches a database. Fix the
   findings.
2. **Apply the three migrations to staging** with the established staging push. This happens before
   /qa, because the owner's sign-off must show the new behaviour on the preview, and the preview
   uses staging.
   - There are no other open PRs on 2026-10-08.
   - The demo site runs old `main` code against staging until merge. Its only visible difference is
     the duplicate-ID message during that window, which is acceptable for fictional data.
   - Then run the read-only staging checks (registration T9 step 3) and the SMS scenario
     (sms-limits T2).
3. **Push once, open the PR, bind it with ccd_pr.** CI's e2e now runs against the new staging schema.
4. **/qa on the demo preview:**
   - Google registration with the test phone provider;
   - duplicate personal ID → inline message;
   - an approved test delegate's rename refused;
   - admin rename recorded in `/admin/audit`;
   - photo upload → no GPS, photo upright;
   - sign out → Cache Storage empty;
   - a delegate share image still renders.
5. **Owner sign-off package.** Plain language, screenshots, the preview URL. Wait for the explicit
   yes.
6. **Merge** once `quality` passes. Check `Vercel – georgia-republic` on the merge commit.
7. **Production dry-run at once.**
   - Pending files: this release's four files. Privacy steps 1 and 2 (`20261008140000`,
     `20261008150000`) were applied to production by the launch-audit session after PR #43
     merged (2026-10-08).
   - Tell the owner that and wait for their yes.
   - Then apply. The schema check and advisors gate must pass.
8. **Verify the real site:** `/join`, a delegate page and its share image, and `/admin/verify/<id>`
   for a real approved delegate (the rename form renders).
9. **Coordinate privacy step 2.**
   - Rename its migration to after `20261008160200`.
   - Replace its `register()` grant to `authenticated` with the revoke.
   - Record this in its branch or session.

## Merge with main (2026-10-08, privacy step 2 = PR #43)

- Main gained `20261008150000_require_privacy_consent.sql`, which restates `register()` and grants it
  to `authenticated`. In filename order this release's revoke comes later and wins.
- Staging, however, received this release's migrations before 150000, so `20261008160300` repeats
  the revoke after every file that touches `register()`. On staging, push 150000 and 160300 with
  `--include-all`.
- Main's consent e2e called `register()` directly. It now expects `42501` from `register()` and
  `phone_required` from `register_google()`.
- Window: from this release's staging push until it merges, CI on other PRs fails two tests,
  because main's code meets the new staging rules: the duplicate-ID message (the returned refusal)
  and the consent test's direct `register()` call. Both pass once this release is on main.
