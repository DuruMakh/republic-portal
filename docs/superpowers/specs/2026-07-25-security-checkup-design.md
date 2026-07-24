# Security check-up — design spec

- **Date:** 2026-07-25 · **Status:** brainstorm-approved section by section; awaiting owner review of this written spec
- **Release target:** v0.10.0, one release · **Baseline:** `main` at v0.9.0 (merge commit `46e7a90`)
- **Branch:** this spec is committed on `claude/project-status-next-steps-d54c9d`; the audit and fix wave get their own worktree/branch at plan time.
- **Phase position:** owner decision 2026-07-25 — the security check-up is the next phase. Launch hardening (real SMS, production database, closing the dev test door, accounts/keys housekeeping) moves to the phase *after* this one and is explicitly out of scope here.
- **Prime directive:** nothing is a finding until it has been reproduced against a running system. Plausible-but-unreproduced holes are discarded with their disproof recorded, not fixed.

## 1. Decisions locked in brainstorming (owner-approved 2026-07-25)

| # | Decision |
|---|---|
| D1 | **Scope is the permission model plus live break-in testing.** The two other candidate areas — accounts/keys/secrets housekeeping, and personal-data retention/exposure — were considered and deliberately excluded by the owner. |
| D2 | **Find, then fix everything, in one phase.** The phase ends in a v0.10.0 release with every confirmed hole closed, not in a report that leaves them open. |
| D3 | **Attack staging and the public URL as they are.** No throwaway copy: the real configuration is the thing worth testing. Junk data and exhausted SMS limits during the phase are accepted; staging is reseeded clean at the end. |
| D4 | **Layered method, four passes** — threat list, census, adversarial sweep, live proof — in that order (§3). Each pass is permitted to find what the prior pass missed. |
| D5 | **A Critical finding is fixed immediately**, out of band, rather than held until the audit completes. |
| D6 | **Every fix is test-first**: a test that performs the attack and fails, then the repair, then it passes. |
| D7 | **Fixes that remove a capability real people currently have are flagged to the owner explicitly** before shipping, never buried in release notes. |
| D8 | **A hole that cannot be closed without a redesign is escalated to the owner**, not silently deferred. |

## 2. The surface under audit

Counts are distinct live objects, de-duplicated across migrations (a function recreated in a later migration counts once).

| Surface | Count | Why it is in scope |
|---|---|---|
| `security definer` database functions | 52 | Every privileged write and most privileged reads pass through one. Primary attack surface. |
| Other database functions and helpers | 6 | Predicate helpers the gatekeepers depend on; a wrong helper compromises every caller. |
| Filtered views | 24 | Each decides what a given actor may see. Self-gating: the filter *is* the authorization. |
| Row-level security policies | 10 | Last line of defence when a gatekeeper is wrong. |
| Database triggers | 8 | Includes the protected-columns trigger and the delegate/membership invariant. |
| Tables | 16 | Where personal IDs, phones, payments, votes and the append-only audit log sit. |
| Server actions | 35 (in 16 files) | The application's own doors into all of the above. |
| Public HTTP endpoints | 1 | The dev OTP route. Attacked here as a target; closing it belongs to launch hardening. |
| Storage buckets | 2 | Delegate photos, news images. Public-read, RPC-mediated write. |
| **Total** | **154** | Every one receives a verdict. Nothing is sampled. |

### 2.1 The twelve actor positions

Every surface is evaluated from each position. The list is exhaustive by construction: it enumerates the product's own standing/role vocabulary plus the two states that exist between them. The four admin roles count as four separate positions — the entire purpose of the roles is that they differ, so evaluating them jointly would defeat the exercise.

| # | Actor | Notes |
|---|---|---|
| A1 | Anonymous stranger | No account, no session. |
| A2 | Signed in, **no profile row** | Real and reachable: login mints a session before `register()`; the duplicate-personal-ID retry phase parks such a session. Caused live crashes in R1. |
| A3 | `registered` standing | Account, personal data, no membership. |
| A4 | `profile_completed` standing | Member, membership open, unpaid. |
| A5 | `active_member` standing | Paid, counted in public figures. |
| A6 | `pending` delegate applicant | Requested delegacy, not approved. Keeps full member life. |
| A7 | `approved` delegate | Has a team, a referral code, a panel. |
| A8 | `rejected` delegate applicant | Terminal state. Must retain member life and nothing more. |
| A9 | Admin: `super_admin` | Expected to reach everything; audited for what it must *still* not do (e.g. write the audit log). |
| A10 | Admin: `verifier` | Delegate verification and PID reveals only. |
| A11 | Admin: `finance` | Payments only. |
| A12 | Admin: `editor` | News, events, polls only. |

### 2.2 The threat list

Written first, in plain language; every finding is ranked against it. Starting set, to be expanded in Pass 1:

| # | Threat | Damage if real |
|---|---|---|
| T1 | Extraction of the member roster with personal ID numbers | Catastrophic. Political and legal exposure for every member. |
| T2 | A delegate inflating their own supporter count | Destroys the integrity of the public leaderboard. |
| T3 | A delegate reading a rival delegate's team | Internal trust collapse. |
| T4 | A member reading another member's personal ID | Direct personal-data breach. |
| T5 | Voting twice, or reading poll results before close | Destroys poll credibility. |
| T6 | A rejected applicant regaining delegate powers | Verification becomes meaningless. |
| T7 | A non-finance admin recording or altering payments | Financial control failure; corrupts active-member status. |
| T8 | Any write to the append-only audit log | Removes the ability to investigate anything else. |
| T9 | Account takeover through the SMS-code flow | Full impersonation, including of admins. |

## 3. Method — four passes

### Pass 1 — The threat list

Expand §2.2 into the working threat model: for each threat, the actor, the asset, the plausible route, and what "damage" concretely means for the movement. Shortest pass. Output: the ranking key for everything that follows.

### Pass 2 — The census

All 154 surfaces, one at a time. For each: state what it is *supposed* to permit, then determine what it *actually* permits, from each applicable actor position in §2.1.

Output is a coverage table — one row per surface, each carrying an interim verdict of `clear`, `finding`, or `needs-live-proof`. `needs-live-proof` is a temporary state only: Pass 4 resolves every such row to `clear` or `finding`, so no surface ends the phase unresolved (§7). The value of this pass is the completeness claim: afterwards the owner can be told exactly what was examined, and nothing was skipped for looking uninteresting.

### Pass 3 — The adversarial sweep

Multiple independent hunting passes over the same codebase, each carrying a distinct lens:

1. Privilege escalation across the standing ladder and the admin roles
2. Data leakage — personal IDs, phones, roster, team membership, vote records
3. Tampering with money, counts, and the derived active-member state
4. Abuse of the sign-in and OTP flow
5. Chained attacks — two individually-harmless behaviours combined
6. Assumptions inherited by Pass 2 (the census auditing its own blind spots)

**Every candidate finding is then handed to a separate pass whose sole job is to refute it.** Only survivors advance. This is the pattern that, on PR #10, surfaced a hole caught by five angles yet missed by all ten task reviews and the whole-branch review.

### Pass 4 — Live proof

Each survivor is attacked for real against staging and the public URL. Outcome is binary:

- **Reproduced** → confirmed finding, evidence attached, enters the fix wave.
- **Not reproduced** → discarded, with the disproof and its evidence recorded in the report.

Disproofs are deliverables in their own right: on R2, two refutations corrected notes in our own records that had been wrong for weeks.

## 4. Severity

Assigned against the threat list, not against technical novelty.

| Severity | Definition |
|---|---|
| **Critical** | An actor with no account (A1) obtains data or powers they should not have. Fixed immediately, out of band (D5). |
| **High** | An ordinary account holder (A3–A8) crosses a boundary they should not cross. |
| **Medium** | Possible, but requires an unusual precondition, or the damage is contained. |
| **Low** | No route to real harm today, but a guard that should exist is missing. |

## 5. The fix wave

- **Test-first, without exception** (D6). The failing test performs the attack. A fix with no reproducing test is not a fix.
- **Independent review per fix** by a reviewer that did not write the fix, then one review across the whole wave — the per-task/whole-branch pattern used in every prior phase.
- **Database changes go in new migrations only.** An already-applied migration is never edited — the R2 whitespace defect established the pattern: a follow-up migration, not a rewrite.
- **Admin mutations continue to write to `audit_log`.** Any fix touching an admin path preserves this.
- **Capability-removing fixes are surfaced to the owner** before they ship (D7), described in terms of who loses what.
- **Redesign-scale findings are escalated**, not deferred (D8).

## 6. Deliverables

1. **The report** — plain language, ranked by damage. Each finding reads: an actor in position X can do Y, which means Z for the movement, and here is the evidence it is real. Readable without reading code, per the owner's standing constraint.
2. **The coverage table** — all 154 surfaces with verdicts, so "everything was checked" is auditable rather than asserted.
3. **v0.10.0** — the release closing every confirmed hole.

## 7. Verification and exit criteria

The phase is done when all of the following hold:

- Every one of the 154 surfaces carries a verdict.
- Every confirmed finding has a reproducing test that failed before the fix and passes after.
- Every discarded finding has its disproof recorded.
- Full unit and e2e suites pass; the schema probe reports zero drift.
- CI is green on the final commit.
- Staging is reseeded clean and the seed self-checks confirm exact counts.
- The owner has signed off on the Vercel preview link.

## 8. Blast radius and operating notes

- **The demo site will hold junk during the phase**: forged accounts, odd data, exhausted SMS-code limits. All data is synthetic. The owner may request a pause in destructive testing on any given day if the site needs to be presentable.
- **Known throttle ceiling**: more than roughly two full e2e passes per hour exhausts the canonical admin phone's SMS send cap. Attack testing must be paced against this, and it will intermittently affect the owner's own use of the on-screen test-code flow.
- **Reseed at the end** restores the documented counts and is verified by the seed's own live self-checks.

## 9. Out of scope

Named explicitly so it does not drift into this phase:

- Closing the dev OTP door, replacing it with a real Georgian SMS provider, dropping the dev inbox table.
- Creating the production Supabase project and swapping the Vercel production environment.
- Flipping `NEXT_PUBLIC_APP_ENV` back to `production`.
- Accounts, keys, secrets and access-token housekeeping across Supabase, Vercel and GitHub.
- Personal-data retention, minimization and the legal review.
- Payment gateway, mobile store apps, push notifications, second-language support.

All of the above remain in launch hardening, which follows this phase.

## 10. Success criteria

- The permission model has been examined in full, from every actor position, and the coverage is demonstrable.
- Every hole that a real person could walk through is closed, with a test that would catch its return.
- Every claim in the report is backed by a live reproduction; every discarded claim by a live disproof.
- The owner can read the report end to end and understand what was at risk and what changed, without reading a line of code.
