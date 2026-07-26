# Threat model — security check-up, Pass 1

- **Date:** 2026-07-25 · **Pass:** 1 of 4 (see spec §3) · **Revised** the same day with live disproofs (§1.2, §5.2)
- **Spec:** `docs/superpowers/specs/2026-07-25-security-checkup-design.md`
- **Inputs:** spec §2.2 (nine seed threats), spec §2.1 (twelve actor positions), `supabase/migrations/` (the authority on what exists), `scripts/security/manifest.json` (152 surfaces), `docs/security/ledger.json` (census baseline, 1824 rows), `DECISIONS.md` (ADR-006, ADR-009, ADR-013 … ADR-019), `supabase/config.toml`, and live catalog introspection of the staging database on 2026-07-25.
- **Output:** the ranked threat register below. **The ranking (R1 … R22) is the ordering key for the owner-facing report in Task 11.** Findings from Passes 2–4 are ranked by the threat they realise, not by technical novelty.

> **Nothing in this document is a finding.** A threat is a statement of what would be damaging _if_ it were reachable. The spec's prime directive stands: nothing becomes a finding until it has been reproduced against a running system.
>
> **Two caveats to carry into every later pass:**
>
> 1. **The census baseline's 141 `finding` rows are rule-derived placeholders, not pending findings.** They record where a mechanically-derived expectation disagreed with a probe result. A large share are expectation artefacts — the `regions`/`cities` rows (24 of the 141) are the clearest case: both tables are _deliberately_ world-readable and their policies say `using (true)`, so the `deny` expectation was simply wrong. Pass 2 corrects expectations; it does not inherit them. Nobody should read "141 findings" as "141 holes".
> 2. **Several threats below are stated as _route exists, defence holds_.** That is the honest shape of most of this model: a privilege is granted, a path to it exists, and something else — usually a single row-level rule — returns nothing. Recording those is the point. A defence that is doing all the work is worth naming _before_ it fails, not after.

---

## 1. How to read this

### 1.1 The shape of each entry

| Part                | What it means                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Who**             | The actor position(s) from spec §2.1 that could mount it, by `A` number.                                                |
| **What is at risk** | The concrete asset, named as the real tables, views or functions it lives in.                                           |
| **Route**           | The plausible path given what this codebase actually does — including what currently blocks it.                         |
| **If it happened**  | What the damage means for real people and for the movement, in plain language.                                          |
| **Held today by**   | The specific mechanism that stands in the way right now. This is what Passes 2–4 must test.                             |
| **Live disproof**   | Present only where the route has already been attacked and did not work. Disproofs are deliverables (spec §3, Pass 4).  |

Actor shorthand, from spec §2.1: **A1** anonymous · **A2** signed in with no profile row · **A3** registered · **A4** profile_completed · **A5** active_member · **A6** pending delegate · **A7** approved delegate · **A8** rejected delegate · **A9** super_admin · **A10** verifier · **A11** finance · **A12** editor.

### 1.2 What "permitted but zero rows" means

Several disproofs below say a statement was _permitted_ and affected _zero rows_. That distinction is load-bearing and must not be blurred in the owner report:

- **The grant let the statement run.** PostgreSQL did not refuse it at the privilege layer.
- **The row-level rule returned nothing.** No row matched a policy, so nothing was read, changed or deleted.

A permitted statement affecting zero rows **is not a hole**. It is one layer abstaining and the next layer holding. It is also not nothing: it means that layer is alone, and the whole of §5 is about that.

---

## 2. The ranking principle

The order below is **by damage, not by likelihood and not by how clever the attack is.** The tie-breaks, in order:

1. **Does it put named individuals at physical or legal risk?** This is a Georgian opposition movement. A list of named people with state ID numbers who publicly belong to it is not a privacy incident — it is a targeting list. Anything that produces such a list, or confirms one name at a time, ranks at the top.
2. **Does it destroy or falsify the movement's own record of itself?** Losing the membership record, or losing the ability to prove who did what, is not recoverable by apology.
3. **Does it let an outsider forge the movement's size, its voice, or its decisions?** The movement's public claim to legitimacy is its numbers, its statements and its internal votes.
4. **Does it break the internal fairness the platform promises its own people?** Delegate standings, poll integrity, verification meaning something.
5. **Is it a guard that ought to exist but has no route to real harm today?**

Three consequences of this ordering are worth stating out loud, because they are not the conventional ones:

- **A route that yields one name is ranked near a route that yields all of them.** Confirming that a specific named person is a member of this movement is, for that person, most of the damage of the full roster leak. Bulk is worse, but not by the margin a technical reading would suggest.
- **An attack on the ability to physically assemble ranks above an attack on money.** A list of who is going to a specific protest, at a specific place, at a specific hour, is more dangerous per row than the membership roster, because it is _predictive and location-bound_. The same logic puts the irreversible cancellation of a real mobilisation above payment tampering.
- **A short list can outrank a long one.** The handful of people who hold `super_admin` are, by tie-break 1, a more consequential list than a thousand ordinary members: they are the people worth coercing. That is why R3 sits where it does.

**One rank, one fix.** R2 carries two threat identifiers (T9 and D4) because they sit behind the same door and one repair closes both. The fix wave must bill that once.

---

## 3. The ranked threat register

Seed threats keep their spec identifiers (**T1–T9**) so later passes can cite them unchanged. Threats derived in this pass are **D1–D14**. Twenty-three threats, twenty-two ranks: **R1** (worst) to **R22**.

---

### R1 — T1 · The member roster, with personal ID numbers, leaves the platform

**Who:** A1, A2, A3–A8 (if any row-level rule fails); A9 and A11 as insiders; anyone who takes over an A9 or A11 account.

**What is at risk:** `profiles` — specifically `personal_id`, `phone`, `first_name`, `last_name`, `region_id`, `city_id`, `birth_date`, `employment`. Reachable in bulk through the `admin_members` view, the `admin_export_members(text,int,text,boolean)` function, and the CSV route `app/(admin)/admin/members/export/route.ts`.

**Route:**

- **From outside (A1/A2).** Live introspection shows `anon` holds column-level `SELECT` on **every** column of `profiles`, including `personal_id` and `birth_date`. The _only_ thing that returns zero rows to an anonymous PostgREST query is the single RLS policy `"own profile readable"`, whose predicate is `auth.uid() = id` — which yields NULL, and therefore no rows, when there is no session. There is no second layer here. Note the asymmetry: the column-grant defence that protects **members from each other** (the `authenticated` `SELECT` grant on `profiles` deliberately omits `personal_id`, `birth_date` and `pending_delegate_id`) **does not exist for `anon`**, which was never narrowed. The most sensitive table has the least grant-layer defence for the least trusted role. This is candidate finding 1, and this is what makes it matter.
- **From inside (A11).** `admin_export_members` is EXECUTE-granted to `authenticated` and admits `super_admin` or `finance` by its own in-function role check. A finance admin can export the entire roster — every name, every phone number, region, city, delegate, standing, tier and reference code — as a CSV, in one request. Personal IDs are correctly withheld from A11 (`p_include_ids` re-checks `has_admin_role('super_admin')`), but the rest is the roster. See R11.
- **From inside (A9).** `admin_export_members` with `p_include_ids = true`, or `admin_reveal_personal_id(uuid)` row by row. Both are audited. A9 is also the only role that can read the audit log.
- **Through an admin view — route exists, defence holds.** All 24 views are owned by `postgres` and carry no `security_invoker`, so each one bypasses RLS entirely and its `WHERE` clause **is** the authorization. Eleven views — including `admin_members`, which carries every member's phone number, and `admin_admins`, `admin_overview`, `admin_settings`, `admin_region_stats`, `admin_finance_stats`, `public_delegates`, `public_stats` — are `SELECT`-granted to `anon` as well as `authenticated`. What stops an anonymous read is not the grant but the fact that `has_any_admin_role(text[])` is not EXECUTE-granted to `anon`.
- **Through a direct client PATCH — not a read route, but the same table.** `authenticated` holds `UPDATE` on exactly five columns (`first_name`, `last_name`, `region_id`, `city_id`, `employment`); every other column, including `personal_id` and `status`, is additionally guarded by the `protect_profile_columns()` trigger, which fires only for the `anon` and `authenticated` roles and raises on any server-managed column. Three independent locks, per ADR-013.

**If it happened:** every person who joined is publicly identifiable as a member of an opposition movement, with the state ID number that ties them to employment records, property records, and family. This is not reversible, not deniable, and not survivable as "we changed a password". It is the reason this audit exists. ADR-006 (2026-07-12) deferred column-level encryption of `personal_id` with the note "revisit at Phase 6 audit before public launch" — **this is that audit**, and the deferral is now due for an explicit owner decision.

**Held today by:** one RLS policy expression for A1/A2; a column grant plus that policy for A3–A8; a role check inside a definer function for the admin views; and, for A9/A11, nothing at all — it is their job.

**Live disproof (2026-07-25, admin-view route only):** an anonymous read of `admin_members`, `admin_payments`, `admin_audit` and `admin_overview` returns **`42501` permission denied for function `has_any_admin_role`**, confirmed both in the census ledger and by an independent fresh anonymous read. The mechanism is exactly the one predicted: function EXECUTE inside a non-`security_invoker` view is checked against the _calling_ role, so the `anon` view grant is inert. **This route is closed.** The other four routes above remain untested and are Pass 2/4's business.

---

### R2 — T9 · Account takeover through the sign-in code flow · and (D4) what it makes possible

**Who:** A1, ending as any position up to and including A9.

**What is at risk:** every asset in this document. The sign-in path touches `dev_otp_inbox`, `send_sms_hook(jsonb)`, the endpoint `GET /api/dev/otp`, and `auth.users`.

**Route — three ways at the same secret:**

1. **The dev endpoint.** `app/api/dev/otp/route.ts` is gated by exactly one condition — `NEXT_PUBLIC_APP_ENV` being `development` or `preview`. There is no authentication, no role check, no rate limit and no origin check. It reads `dev_otp_inbox` with the service-role key and returns the live code for a caller-supplied phone number. Its one substantive restriction is that it withholds the code when a `profiles` row already exists for that number — so it protects existing members, and hands out codes for every number that has **not yet registered**. The spec places closing this door in the _next_ phase (§9), which means the door is open on the deployed environment during and after this one.
2. **The table, directly — route exists, defence holds.** `GET /rest/v1/dev_otp_inbox` as A1 or A3. `anon` holds table-level `SELECT` on `dev_otp_inbox`; RLS is enabled with **zero policies**, so the read reaches the row-level layer and is returned nothing. In principle this route is _strictly worse_ than the endpoint, because the endpoint at least withholds codes for numbers that already have a profile — the table has no such notion. Only the absence of a policy separates an anonymous caller from every live sign-in code on the platform.
3. **The existence oracle.** The endpoint's two 404 branches return different bodies (`"not found"` when a profile exists, `"no otp"` when it does not), so it also answers "does this phone number have an account here?" for any number, without sending anything.

**Rate limiting, stated precisely** (this sentence will be quoted, so it must be exact): there **is** a real server-side throttle — `supabase/config.toml` sets `[auth.sms] max_frequency = "5s"`, a per-phone minimum interval between sends — and Supabase enforces `sign_in_sign_ups = 30` and `token_verifications = 30` per five minutes **per IP**. What does **not** exist is a CAPTCHA (`[auth.captcha]` is commented out) or any app-layer limit. The 60-second resend cooldown in `components/OtpVerification.tsx` is client-side React state that never reaches a server. None of the real limits constrain an attacker who rotates phone numbers and source addresses, because `max_frequency` is per phone and the Supabase limits are per IP.

**R2's consequence set (D4) — manufacturing members at scale.** Behind the same door, and closed by the same fix. Once codes are obtainable for arbitrary numbers, the ladder to a voting member costs nothing:

1. `signInWithOtp` accepts any phone number and `enable_signup = true`, so an auth user is created for a number that need not exist or belong to anyone.
2. The code is obtainable by route 1 or 2 above, because the account has no profile row yet.
3. `register()` needs a name and any string matching `^\d{11}$` that is not already taken — there is no validation that a personal ID is real, only that it is unique and eleven digits.
4. `become_member_save_profile` + `become_member_complete` promote the account to `profile_completed` with **no payment** — enough to satisfy `is_completed_member()` and vote, and enough to satisfy `is_registered()` and RSVP.
5. If step 3 carries a delegate's `signup_ref_code`, step 4 binds the synthetic account to that delegate's team (stored approved referral wins over the picker).

The only scarce resource is unused 11-digit strings, of which there are 10^11. The reachable damage: `public_stats.registered_total` (cumulative and never shrinking, by ADR-019) becomes forgeable; internal polls become decidable by whoever registers most; `member_event_going_counts` becomes noise; and any chosen delegate's team can be flooded — R15 run in reverse, poisoning rather than boosting.

**If it happened:** an attacker holding an A9 session has the roster, the personal IDs, the payment ledger, the role grants and the audit log — and is the only role that can read the audit log that would show what they did. Impersonation is total: statements published under the movement's name, delegates approved or rejected, members reassigned. Short of that, the movement's headline public number and its internal votes become things an outsider can set.

**Held today by:** the profile-exists check in the dev endpoint (for accounts that already completed registration); the absence of any policy on `dev_otp_inbox`; Supabase's per-IP verification limits and per-phone send interval; and the six-digit code space. For accounts that have _not_ completed registration, by the first of those alone.

**Live disproof (2026-07-25, table route only):** a read of `dev_otp_inbox` as A1 and as A3 returns **zero rows**. Route exists; defence holds. The endpoint route (1) and the oracle (3) are untested and remain open.

**Escalation:** the door stays open by explicit scope decision (spec §9). **This should be escalated to the owner under D8 rather than deferred silently**, because the exposure is live on the deployed environment now and the remedy is scheduled for a later phase.

---

### R3 — D13 · Who the admins are

**Who:** A1, A2, A3–A8.

**What is at risk:** `admin_roles` — the mapping from a real person to `super_admin`, `verifier`, `finance` or `editor`. Named and given a phone number by the `admin_admins` view; re-derivable from `audit_log` / `admin_audit` rows for `admin.grant_role`.

**Route:** `anon` and `authenticated` hold column-level `SELECT` on all four columns of `admin_roles` (`user_id`, `role`, `granted_by`, `granted_at`). The sole policy on the table, `"own admin roles readable"`, restricts reads to `auth.uid() = user_id` — so a member sees their own rows and nothing else, and an anonymous caller sees nothing because the predicate is NULL. `admin_admins` joins the same rows to `profiles.first_name`, `profiles.last_name` and `profiles.phone`, and is correctly gated on `has_admin_role('super_admin')`. Anyone who obtains the `user_id` set separately can resolve the names through any other roster route (R1).

**If it happened:** in an opposition movement, the handful of people who can reach everything are the handful of people worth coercing, arresting, pressuring or discrediting. A list of them by name and phone number is a targeting list of a different and sharper kind than the roster: shorter, and far more consequential per name. It is also the natural first step of R2 — an attacker does not guess whose account to take, they look it up.

**Held today by:** one RLS policy predicate on `admin_roles`, and a role check inside `admin_admins`.

**Live disproof (2026-07-25):** a read of `admin_roles` as A3 returns **zero rows**. Route exists; defence holds.

---

### R4 — D14 · A session outlives the trust that created it

**Who:** A9–A12 primarily; A3–A8 for the ordinary-member case. Realised by whoever holds a stolen token.

**What is at risk:** every asset reachable by the compromised position — via `auth.uid()`, which is read from the JWT `sub` claim by every definer RPC and every RLS predicate in the schema.

**Route:** `supabase/config.toml` sets `jwt_expiry = 3600` and `enable_refresh_token_rotation = true` with `refresh_token_reuse_interval = 10`. Both `[auth.sessions]` controls — `timebox` and `inactivity_timeout` — are **commented out**. So: access tokens live one hour, but a refresh token renews indefinitely, and there is no forced logout and no inactivity expiry at all. A session captured from a shared device, a browser profile left signed in, or a stolen laptop stays valid until someone thinks to revoke it — and there is no admin surface in this product to revoke one. Rotation with reuse detection is a genuine mitigation: if the legitimate client refreshes after the thief does, the reuse is detected. It is the only one.

**If it happened:** an admin who has left the movement, or whose device was taken, still holds a working session. Everything in R1, R3 and R14 follows, and the audit log records it under their name — which makes the log actively misleading rather than merely incomplete.

**Held today by:** refresh-token rotation with reuse detection, and one-hour access-token lifetime.

**Live disproof (2026-07-25):** the obvious escalation vector is clean. **Role revocation is not defeated by a stale session:** `has_admin_role(text)` and `has_any_admin_role(text[])` read `admin_roles` at call time, and the JWT carries no role claim, so `admin_revoke_role` takes effect on the very next request against every gate in the schema. A revoked admin's surviving session is a member's session, immediately.

---

### R5 — D1 · Named attendance lists for a specific upcoming event

**Who:** A7 (legitimately, for their own team); anyone who takes over an A7 account; A9/A10/A11 by reconstruction.

**What is at risk:** `event_rsvps` joined to `profiles` and `memberships` — surfaced as names by `delegate_team_rsvps()`, and as counts by `member_event_going_counts` and `admin_events.going_count`.

**Route:** `delegate_team_rsvps()` returns, for every **published, not-yet-finished** event, the first and last name of each member of the calling delegate's team who has RSVP'd "going". It is correctly scoped to `m.delegate_id = v_uid` and requires `status = 'approved'`. That scoping is the defence, and it holds — but it means every approved delegate legitimately holds a forward-looking, named list of who intends to be physically present at a specific place and time. A staff role (A9/A10/A11) can reconstruct the same lists across all delegates by joining `admin_members` (which carries `delegate_id`) against per-event counts, though no granted surface gives them the names directly. The write side is narrow by construction: `member_rsvp(uuid,boolean)` is the only path, its subject is always `auth.uid()`, and it takes `FOR SHARE` on the event row to serialize against a concurrent cancel.

Secondary exposure: `member_event_going_counts` gates on `is_registered()` — which R2's consequence set makes free to obtain — so per-event going counts are effectively public even though names are not.

**If it happened:** this is the most operationally dangerous data the platform produces. The roster says who joined; this says _who will be standing in that square on Thursday_. A leak here is not a disclosure, it is advance notice.

**Held today by:** the `approved`-delegate gate and the `delegate_id = auth.uid()` scoping inside `delegate_team_rsvps()`, plus the absence of any write or bulk-read grant on `event_rsvps` (`authenticated` holds column `SELECT` on `event_id, member_id, status` only, constrained to own rows by `"own rsvps readable"`; there are no INSERT/UPDATE/DELETE grants at all). This table is one of the few defended at both layers.

---

### R6 — D2 · Silent confirmation that a named person is a member, one at a time

**Who:** A2 (the position that can call it), reachable from A1 in one hop via R2.

**What is at risk:** the fact of membership itself, for any individual whose 11-digit Georgian personal ID the attacker holds. The oracle is `register(text,text,text,text)`, reading `profiles.personal_id`.

**Route:** `register()` raises the distinct token `duplicate_personal_id` when the submitted personal ID already exists in `profiles`, `invalid_personal_id` when it fails the `^\d{11}$` shape, and succeeds otherwise. An attacker with a session and no profile row (A2) submits a target's personal ID and reads the answer off the error token. Personal ID numbers in Georgia are widely held — they appear on identity documents, in employment records and in commercial databases — so the attacker's input is not the hard part. The duplicate check raises **before** the insert, so a _yes_ answer writes nothing and leaves the session usable — one session therefore probes an unbounded list of IDs. Only a _no_ answer consumes the session, and that same call permanently squats the probed ID (F13). **Nothing is written to `audit_log` on this path.** The movement would never know it had been asked.

**If it happened:** an adversary can go down a list of names — employees, students, journalists, civil servants — and learn, silently and repeatably, which of them belong to this movement. For the individuals concerned this is nearly the whole harm of R1, delivered retail instead of wholesale, with no trace and no disclosure event to respond to.

**Held today by:** the requirement for an authenticated session — and nothing else. That is not a real cost while R2 stands.

**Corrected 2026-07-26 (Pass 4, finding DL-1).** An earlier revision of this entry credited _the per-session single-shot nature of `register()`_ among the controls holding this threat. **That control does not exist, and the claim has been deleted rather than softened.** All three branches were reproduced live from a session with no profile row: a taken ID raises `duplicate_personal_id` and writes nothing (`a2_profile_after = false`), a malformed ID raises `invalid_personal_id`, and only the success branch consumes the session. `lib/funnel.ts:107-108` renders the first two as two different Georgian sentences, so the oracle is delivered by the public sign-up form. DL-1 is a confirmed finding, raised Medium → **High**, in `docs/security/findings.md`.

---

### R7 — D3 · Mass destruction of the membership record

**Who:** A1, A2, A3–A8.

**What is at risk:** `profiles`, and by cascade `delegates`, `memberships`, `payments`, `event_rsvps`, `poll_votes`; plus `audit_log`, `admin_roles`, `app_settings`, `dev_otp_inbox`, `regions`, `cities` directly.

**Route:** `anon` and `authenticated` hold `DELETE`, `INSERT`, `UPDATE`, `REFERENCES` **and `TRUNCATE`** on `profiles`, `memberships`, `payments`, `admin_roles`, `audit_log`, `app_settings`, `dev_otp_inbox`, `regions` and `cities` (Supabase's default posture — candidate findings 1 and 2). Two different keys open the same door:

- **`DELETE`** is subject to row-level security, and `profiles` has no DELETE policy, so it is denied — by RLS alone. `profiles.id` is the parent of `ON DELETE CASCADE` foreign keys from `delegates`, `memberships`, `payments`, `event_rsvps` and `poll_votes` (added deliberately for staging cleanup, ADR-015). A single successful `DELETE FROM profiles` therefore erases the movement, not one table.
- **`TRUNCATE` is not subject to row-level security at all**, and no statement-level trigger guards it. PostgREST does not expose TRUNCATE, so there is very likely no live route — "very likely" is precisely what Pass 4 exists to resolve.

Adjacent, and candidate finding 3: four trigger functions — `audit_log_immutable()`, `protect_profile_columns()`, `enforce_delegate_completed()` and `set_updated_at()` — carry EXECUTE for `PUBLIC` plus explicit `anon` and `authenticated` grants, and all four are `SECURITY INVOKER`, so they run as the caller. Two of them are the enforcers of the append-only log and the protected-columns rule. They are unreachable only because PostgREST filters trigger-returning functions out of its schema cache, and because calling a trigger function outside trigger context raises. Pass 4 must confirm both.

**If it happened:** the movement loses its membership, its payment history, its delegate structure and its event records in one statement, with no product-level restore path. Recovery would depend entirely on platform backups, which this audit does not cover. Every member would have to be re-enrolled — meaning every member would have to be asked, again, to hand over their personal ID.

**Held today by:** for DELETE, the absence of a DELETE policy on every table — that is, by RLS and nothing else. For TRUNCATE, by PostgREST not exposing the verb. For the trigger functions, by PostgREST's schema-cache filter.

---

### R8 — T8 · The append-only audit log is erased or forged

**Who:** A1, A2, A3–A8 for the erasure/forgery routes; A9 as the only reader, and as the subject the log exists to constrain.

**What is at risk:** `audit_log`, the trigger `audit_log_no_update`, the function `audit_log_immutable()`, and the view `admin_audit`.

**Route:** four sub-threats, and they do not have the same shape:

- **Rewriting history.** `UPDATE` and `DELETE` on `audit_log` are blocked by the row-level trigger `audit_log_no_update`, which raises unconditionally and fires for **every** role including the table owner. This is the strongest single guard in the schema.
- **Erasing history.** `TRUNCATE` fires no row-level trigger and is not subject to RLS, and `TRUNCATE` on `audit_log` is granted to `anon`. **The append-only guarantee has a hole exactly the width of TRUNCATE.** Whether that hole is reachable is Pass 4's job; that it exists is not in dispute.
- **Forging history.** `INSERT` on `audit_log` is granted to `anon` and `authenticated`. Note that `active_sweep()` and the bootstrap script both legitimately write rows with `actor_id = NULL`, so a forged system-attributed row would be indistinguishable from a real one.
- **Reading history.** `admin_audit` gates on `has_admin_role('super_admin')`. The log records who revealed which personal ID and who exported what — so the log is itself sensitive, and A9 is both its only reader and its most consequential subject. ADR-014's guarantee is that an unaudited admin action is unrepresentable; it is _not_ that an audited one will be noticed. No alerting exists.

**If it happened:** every other item in this document becomes unattributable. The movement could know it had been breached and never be able to say by whom — which in this context is the difference between a security incident and an unresolvable internal accusation.

**Held today by:** a row-level trigger (strong); the absence of an INSERT policy; and PostgREST not exposing TRUNCATE.

**Live disproof (2026-07-25):** probed as anonymous, as an ordinary member, **and as `super_admin`**. `SELECT`, `UPDATE` and `DELETE` are permitted as statements and affect **zero rows** each; `INSERT` is refused outright with **`42501`**. Row count **1468 → 1468**, unchanged across the whole probe. Route exists; defence holds — and note that it holds against A9 too, which is what ADR-014 promised. The TRUNCATE sub-threat was not covered by this probe and remains open for Pass 4.

---

### R9 — D5 · Self-granting an admin role

**Who:** A3–A8 (and A2, if any INSERT path existed at all).

**What is at risk:** `admin_roles`, and through it everything gated on `has_admin_role(text)` / `has_any_admin_role(text[])`.

**Route:** `anon` and `authenticated` hold column-level `INSERT` and `UPDATE` on all four columns of `admin_roles`. The table has exactly one policy — `"own admin roles readable"`, a SELECT policy. There is no INSERT policy and no UPDATE policy. A successful `INSERT INTO admin_roles (user_id, role) VALUES (auth.uid(), 'super_admin')` would be self-service promotion to the top of the platform and — because `has_admin_role` reads that table directly on every call — would take effect on the next request with no further step.

The legitimate path, `admin_grant_role(uuid,text)`, is correctly `super_admin`-only, requires a completed member, and is audited; `admin_revoke_role` additionally holds `pg_advisory_xact_lock` so the last `super_admin` cannot be revoked away under concurrency. Neither helps if the table itself is writable.

**If it happened:** an ordinary member becomes a super_admin. Everything in R1, R3 and R8 follows in one step, and the audit row that would have recorded a legitimate grant never exists, because no RPC was called.

**Held today by:** the absence of an INSERT policy on `admin_roles`. Nothing else.

**Live disproof (2026-07-25):** `INSERT` of `{role: 'super_admin'}` attempted as **A3 and A5** with fresh sessions. Both **denied — `42501`, "new row violates row-level security policy"**. `admin_roles` count **4 → 4**. Route exists; defence holds. This refutes a reviewer claim reasoned from grants alone: the grant is real, the exploit is not.

---

### R10 — D8 · One setting flips the standing of the entire membership

**Who:** A1–A8 for the direct-write route (mechanically identical to R9 — same wide grant, same absent policy); A9 for the legitimate route.

**What is at risk:** `app_settings` (key `active_grace_days`), and through `recompute_all_active()` the `status` of every row in `profiles`.

**Route:** two, of very different character.

- **Directly.** `anon` and `authenticated` hold `INSERT`, `UPDATE`, `DELETE`, `SELECT` and `TRUNCATE` on `app_settings` — the full Supabase default set, exactly as on `admin_roles`. The table has **zero policies**. Reads are meant to go through `admin_settings` and writes through the RPC; neither is what stops a direct write. The absence of a policy is. (An earlier draft of this model described `app_settings` as "sealed — no client grants beyond the default set". That was self-contradictory: the default set _is_ full write access. Corrected here.)
- **Legitimately.** `admin_update_setting('active_grace_days', <jsonb>)` is `super_admin`-only, validated to 0–365, audited — and then calls `recompute_all_active()`, which rewrites `profiles.status` across the whole table in one transaction. Set it to 365 and lapsed members become active again: the public "active members" figure and `mrr_gel` inflate, and delegates' public `active_supporters` inflate with them. Set it to 0 and everyone whose coverage has expired is demoted at once — locked out of polls, member-only news and billing, and removed from every public count.

**If it happened:** the movement's public claim about its own size changes by one number typed into one field, in either direction, with no visible cause. Or the entire membership loses its member privileges simultaneously and the support burden lands on the movement, not the attacker.

**Held today by:** the absence of any policy on `app_settings` for the direct route; the `super_admin` check and the 0–365 bound for the legitimate one. Both correct; neither limits the blast radius.

**Live disproof (2026-07-25):** `UPDATE app_settings SET active_grace_days = 0` attempted as **A3, A5 and anonymous**. The statement was **permitted and affected zero rows** in every case; the stored value was verified **30 before and 30 after**. Route exists; defence holds. See §1.2 — permitted-with-zero-rows is the grant abstaining and the row rule holding, not a hole.

---

### R11 — D6 · An admin role reads and exports far beyond its stated scope

**Who:** A10 (verifier), A11 (finance).

**What is at risk:** `profiles` via the `admin_members` view; `admin_export_members`; `memberships` structure via `admin_members.delegate_id`; the payment ledger via `admin_payments`.

**Route:** The spec describes A10 as "delegate verification and PID reveals only" and A11 as "payments only". The database does not implement that description on the read side:

- `admin_members` self-gates on `has_any_admin_role('super_admin', 'verifier', 'finance')` — so **all three** staff roles read every member's name, **phone number**, region, city, standing, tier, reference code, and which delegate backs them.
- `admin_export_members` admits `super_admin` or `finance` — so **A11 can download the whole roster as a file**, not merely browse it. The CSV route applies the same two roles at the app layer and narrows `includeIds` to `super_admin`.
- `admin_payments` correctly narrows to `super_admin | finance`, and `admin_delegate_queue` to `super_admin | verifier` — so the _ledger_ and the _queue_ respect the split even though the _roster_ does not.
- The per-page role checks in `app/(admin)/**` narrow what the UI shows, but every one of these views is directly queryable through PostgREST by any holder of a staff session. The app-layer check in `findAdminCandidateAction` (restricting to `super_admin`) is narrower than the view it reads, and is therefore not a control — the view is.

**If it happened:** the volunteer given the narrowest-sounding job on the platform — recording bank transfers — holds a one-click export of the entire movement with phone numbers. This is R1 with an ordinary login and no break-in at all, and it is the version most likely to actually happen: not an attacker, but a trusted person who is later pressured, or whose laptop is taken.

**Held today by:** nothing — this is the designed behaviour. It is in this register because "designed" and "intended" are not the same thing, and the owner has not been told that finance can export the roster.

---

### R12 — T4 · One member reads another member's personal ID

**Who:** A3–A8; A10 for the applicant-scoped case.

**What is at risk:** `profiles.personal_id` and `profiles.birth_date`.

**Route:** Two layers currently stand between one member and another's ID: the `authenticated` `SELECT` column grant on `profiles` deliberately omits `personal_id`, `birth_date` and `pending_delegate_id`; and the `"own profile readable"` RLS policy restricts to `auth.uid() = id`. No view exposes `personal_id` — ADR-014 states it appears in no admin view, and introspection confirms it. `cabinet_state()` returns only `personalIdMasked` (first three digits plus asterisks). The remaining routes are the two audited reveal RPCs, both role-gated: `admin_reveal_personal_id` (super_admin) and `admin_reveal_applicant_personal_id` (super_admin or verifier, scoped to rows that exist in `delegates`).

Residual insider case: **A10 can reveal the personal ID of any delegate applicant, one at a time, with no reason required and no rate limit** — audited, but harvestable.

**If it happened:** one person's state ID number in the hands of another member. Smaller than R1 in scale, identical in kind for the person concerned.

**Held today by:** a column grant _and_ an RLS policy — genuine defence in depth, and the strongest posture on any sensitive column in the schema. This is what the rest of `profiles` should look like for `anon` (see R1).

---

### R13 — D7 · An editor speaks for the movement, or cancels a real mobilisation

**Who:** A12, A9; anyone who takes over such an account.

**What is at risk:** `news`, `events`, and the movement's public voice. Functions: `admin_save_news`, `admin_publish_news`, `admin_save_event`, `admin_publish_event`, `admin_cancel_event`.

**Route:** `admin_publish_news(uuid,text)` requires only `editor` or `super_admin`. There is no second approval, no four-eyes rule and no delay: a single editor account publishes to the public homepage immediately. The same account can publish a fabricated event — a protest at a place and time the movement never called — and members will act on it. And `admin_cancel_event(uuid)` moves a published event to `cancelled`, which `admin_save_event` then refuses to edit ("cancelled events are frozen history") and for which **no un-cancel RPC exists**. The cancellation is irreversible through the product.

**If it happened:** a false statement carrying the movement's name — an endorsement, a retraction, a call to something the movement did not call for — reaches the public before anyone internal can react. Or the reverse: on the eve of a real mobilisation, the event page says cancelled, and the movement cannot put it back without a database migration. In a political contest, the second is a direct attack on the ability to assemble.

**Held today by:** the `editor`/`super_admin` role check inside each RPC, and the audit row each writes. Both are correct; neither is a second pair of eyes.

---

### R14 — T7 · Payments recorded, altered or voided outside finance — and a revenue figure nobody paid

**Who:** A10, A12 (roles that must not); A3–A8 (if the table itself were writable, and for the tier route); A9, A11 (legitimately).

**What is at risk:** `payments`, the `admin_payments` ledger view, and — through the active-member engine — `profiles.status`, `public_stats.active_members`, `admin_finance_stats.mrr_gel`, `admin_overview.mrr_gel`, `transparency_stats.total_gel` and `public_delegates.active_supporters`.

**Route:**

- **Write RPCs.** `admin_record_payment`, `admin_record_payments_bulk` and `admin_void_payment` all check `has_any_admin_role('super_admin', 'finance')` first, so A10 and A12 are refused.
- **Directly against the table.** `anon` and `authenticated` hold `INSERT`, `UPDATE` and `DELETE` on every column of `payments`; the table has exactly one policy, `"own payments readable"` (SELECT), so all writes are denied — again by RLS alone. ADR-015 declares payments **immutable** ("corrections are voids"), but that immutability is enforced only by the absence of an UPDATE RPC and the absence of an UPDATE policy. There is **no equivalent of `audit_log`'s immutability trigger on `payments`**. If the row-level layer ever admits an UPDATE, payment history becomes silently rewritable, and `months_covered` — a generated column — would follow the rewritten amount automatically.
- **The revenue figure is member-declared, not payment-derived.** `member_change_tier(int)` lets _any_ completed member set `profiles.membership_tier` to 5, 10 or 20 at will, with no payment and no admin involvement. `admin_finance_stats.mrr_gel` and `admin_overview.mrr_gel` are `sum(membership_tier)` over `active_member` rows. So the movement's monthly-revenue figure is the sum of what members _say_ they intend to pay, not of what they have paid. It is contained — you must already be an `active_member`, which requires a real recorded payment — but every active member can inflate it fourfold by changing one dropdown, and the finance dashboard presents it as revenue.

**If it happened:** members are shown as paid who did not pay, or unpaid who did. Because `profiles.status` is derived from payments, a forged payment silently promotes someone to `active_member`, which counts them in the public figures, adds them to a delegate's public supporter count, and unlocks member-only surfaces. The transparency page — the movement's public account of the money it holds — becomes untrue. And the internal revenue forecast is not a forecast of money.

**Held today by:** role checks inside the RPCs (correct), plus the absence of write policies on `payments` (RLS only). For the tier figure: nothing, because it is working as designed — the defect is that the label says revenue.

---

### R15 — T2 · A delegate's supporter count inflated, or moved

**Who:** A6, A7 (self-inflation); **A10 (the cleanest route)**; A1 via R2's consequence set.

**What is at risk:** `memberships`, `public_delegates.active_supporters`, `admin_delegate_queue.total_supporters`/`active_supporters`, `delegate_panel()`'s `totalCount`/`registeredCount`/`activeCount`.

**Route:** Supporter counts are correctly derived everywhere — nothing stores them, per the house rule. Four routes, in descending order of plausibility:

- **A verifier moves supporters between the teams they are judging.** `admin_reassign_member(uuid,uuid)` requires `super_admin | verifier` and closes a completed member's open membership, opening a new one against the target delegate. So **A10 — the role that decides approvals on the strength of `admin_delegate_queue.total_supporters` — can move supporters between the very teams that number describes.** It is audited (`member.reassign`), one member at a time, with no second signature. This is a cleaner insider route than anything an outsider has.
- **Via manufactured members (R2's consequence set).** Register synthetic accounts carrying the delegate's `signup_ref_code`; each one that completes the wizard binds to that delegate. This needs no grant at all. The public number `active_supporters` counts only `active_member`, so inflating _that_ still needs a recorded payment (A9/A11) — but `admin_delegate_queue.total_supporters` is inflatable for free, and it is what a verifier looks at. A pending delegate can inflate the figure they are being judged on.
- **Directly against the table.** `anon` and `authenticated` hold `INSERT` and `UPDATE` on all columns of `memberships`. The table has one policy, `"own memberships readable"` (SELECT). Writes are denied by RLS alone. A successful insert would let any account mint arbitrary `(member_id, delegate_id)` rows.
- **By the member's own hand, legitimately.** `member_change_delegate(uuid)` lets any completed, non-approved-delegate member re-point their open membership at any approved delegate, atomically (close-then-open, history never deleted). That is the product working; it is listed because it is the write path any inflation attempt would try to imitate.

Referral codes themselves are not the weak link: `gen_funnel_code(6)` draws from a 31-character alphabet (≈8.9 × 10^8 combinations), `delegates.referral_code` appears in no table grant and no view, and `delegate_panel()` withholds it until approval.

**If it happened:** the public leaderboard stops meaning anything, and — worse internally — verification decisions get made on manufactured or hand-moved evidence. The inverse is equally available: flooding a rival's team with synthetic supporters so that the fraud, when found, is attributed to them.

**Held today by:** a role check plus an audit row (the verifier route); RLS on `memberships` (the direct route); nothing at all (the referral route).

---

### R16 — T3 · A rival delegate's team read

**Who:** As stated in the seed list, A7. **On the evidence, the real actors are A9, A10 and A11.**

**What is at risk:** `memberships` joined to `profiles` — surfaced by `delegate_team()` (own team only) and `admin_members.delegate_id` (all teams).

**Route:** `delegate_team()` is scoped to `m.delegate_id = v_uid` and additionally requires `status = 'approved'` (added by `20260716120000_delegate_team_approved_gate.sql` after a review finding). `delegate_panel()` deliberately stays any-status but returns only counts, and withholds `referral_code` until approval. `public_delegates` exposes a count, not names. `memberships` is readable only for own rows. **No route from A7 to a rival's team was found in the schema, and this was independently confirmed in review.**

What does exist: `admin_members` carries `delegate_id`, `delegate_first_name` and `delegate_last_name` for every member, so any of the three staff roles can reconstruct every delegate's full team. That is R11 again, applied to team structure.

**If it happened:** a delegate learns exactly who is backing a rival — in a movement where delegates compete for standing, that is a map of the internal opposition. The trust cost is internal and corrosive rather than external and dangerous, which is why it sits here rather than higher.

**Held today by:** correct uid-scoping in `delegate_team()`; the `approved` gate; and the absence of any cross-member read on `memberships`. This one is well built.

---

### R17 — T5 · Poll integrity — double voting, early results, timed closure

**Who:** A4–A8 (voting); A12 and A9 (running the poll); A1 via R2's consequence set (stuffing).

**What is at risk:** `polls`, `poll_options`, `poll_votes`, the views `member_polls`, `member_poll_options`, `poll_option_counts`, `admin_polls`, `admin_poll_options`.

**Route:** three sub-threats with very different strengths:

- **Voting twice is structurally impossible.** `poll_votes` has `PRIMARY KEY (poll_id, member_id)` and a composite FK `(poll_id, option_id) → poll_options(poll_id, id)`, so a second vote and a cross-poll option are both unrepresentable, not merely rejected. `member_cast_vote` takes `FOR SHARE` on the poll row to serialize against a concurrent close. This is the strongest guard in the community schema.
- **Early results are a design decision, not a hole.** `poll_option_counts` shows counts once the caller has voted or the poll has closed (ADR-017 decision #4), and gates on `is_completed_member()`. `member_polls` and `member_poll_options` gate the same way, so ballots render for members and nobody else.
- **The real residual is who controls the clock.** `admin_polls.total_votes` and `admin_poll_options.votes` give A12 the live tally at all times, and `admin_close_poll(uuid)` lets that same A12 close the poll at a moment of their choosing. **An editor can watch the count and close when the result suits them.** Combined with R2's consequence set, an outsider can also stuff the ballot: `member_cast_vote` requires only `registration_completed_at is not null`, which costs nothing to obtain.

**If it happened:** an internal vote the movement treats as its own decision is decided by whoever controls the close button or the registration queue. The credibility loss is internal first and public second.

**Held today by:** a primary key (strong), a role check on the close RPC (correct but single-handed), and, for stuffing, only the cost of manufacturing members — which is currently zero.

---

### R18 — T6 · A rejected applicant regains delegate powers

**Who:** A8 (self-service); A10 or A9 (by decision).

**What is at risk:** `delegates.status`, `delegates.slug`, `delegates.referral_code`, and everything gated on approved status — `delegate_team()`, `delegate_team_rsvps()`, `public_delegates`.

**Route:**

- **Self-service.** `request_delegacy()` refuses if any `delegates` row exists for the caller, so rejection is terminal from the member side (ADR-019). The obvious bypass would be deleting one's own `delegates` row and re-requesting: `authenticated` holds `DELETE` and `UPDATE` on `delegates`, and `delegates` has **zero policies** with RLS enabled, so every client write is denied — by RLS alone. There is no client `SELECT` grant on `delegates` either, so the table is fully sealed. Additionally, `enforce_delegate_completed()` (trigger `delegates_require_completed`) makes a delegates row without a completed member profile unrepresentable on any path, including service-role scripts.
- **By decision.** `admin_approve_delegate` refuses only when the target is already `approved` — a `rejected` row **can** be re-approved, and the migration comment ("re-approval keeps the original slug") shows this is intentional. So a single verifier, acting alone, can reinstate a rejected applicant with no second signature and no cooling-off. It is audited.

**If it happened:** the verification step — the movement's only check on who gets a public profile, a referral code and a team — stops being a check. Note the plausible route is not an attacker but a single insider holding `verifier`.

**Held today by:** RLS on a fully sealed table (self-service route), and a role check plus an audit row (decision route).

---

### R19 — D9 · Individual ballots readable outside the product

**Who:** nobody through any granted surface — including A9. Anyone holding the service-role key or the database password.

**What is at risk:** `poll_votes`, which stores `(poll_id, option_id, member_id)` — the link between a named person and how they voted.

**Route:** deliberately included as a threat with **no in-product route**, because the answer to "who must never read this?" is _everyone_, and the schema currently honours that: `authenticated` holds column `SELECT` on `poll_votes` constrained by `"own votes readable"` to `member_id = auth.uid()`; there are no write grants; and no admin view exposes per-voter rows — `admin_polls` and `admin_poll_options` give counts only. The only readers are the service role and the database owner.

Two residual leaks that do exist in-product: a poll with very few voters makes `poll_option_counts` a de-anonymiser by arithmetic, and `admin_poll_options.votes` gives A12 a per-option breakdown that becomes identifying at small N.

**If it happened:** members learn their vote in an internal leadership contest was never secret. For a movement whose internal legitimacy rests on those votes, that is a governance failure rather than a data breach — but one the members were never warned about, because the product presents the ballot as private.

**Held today by:** the schema, correctly. The exposure is operational: key and credential custody, which spec §9 places in the next phase.

---

### R20 — D10 · The sign-in door jammed

**Who:** A1.

**What is at risk:** availability of `signInWithOtp` for every member, and — after launch — the movement's SMS budget. Touches `send_sms_hook(jsonb)` and `dev_otp_inbox`.

**Route:** `sms_sent` is capped at 100 per hour **for the whole project** (`supabase/config.toml`, raised for staging e2e). The real per-request throttles — `max_frequency = "5s"` per phone and `sign_in_sign_ups = 30 / 5 min` per IP — do not constrain a caller who rotates phone numbers and source addresses, and there is no CAPTCHA. An anonymous caller can therefore exhaust the hourly project quota so that nobody — member, delegate or admin — can sign in or register until it resets. The spec already records this happening accidentally during normal e2e runs (§8). After launch, when the hook points at a paid Georgian SMS provider, the same abuse becomes a direct cost attack.

**If it happened:** the platform is unreachable at exactly the moments it matters most, which for a civic movement are the hours around an event or an announcement. It costs the attacker nothing and leaves no attributable trace.

**Held today by:** a project-wide hourly cap that is itself the thing being attacked, plus per-IP and per-phone limits that a distributed caller does not encounter.

---

### R21 — D11 · Storage: member-only covers, and what gets accepted as an image

**Who:** A1 (reading); A9, A10, A12 (writing).

**What is at risk:** objects in the `news-images` and `delegate-photos` buckets, and `news` rows with `visibility = 'members'`.

**Route:**

- **Reading.** Both buckets are `public = true`, and `storage.objects` has zero policies. Public buckets serve objects by path without a row-level check. Paths are `<uuid>-<epoch-ms>.<ext>`, so they are not enumerable by guessing and cannot be listed (listing goes through `storage.objects`, which denies). But a URL, once shared, works for anyone forever. ADR-017 records this as an accepted trade-off ("unguessable UUID paths, illustrative by policy; private bucket + signed URLs recorded as the later fix"). `delegate-photos` is intentionally public and is not a threat.
- **Writing.** Uploads run with the service-role key from two server actions, each behind a real role check (`verifier | super_admin` for delegate photos, `editor | super_admin` for news covers), and the path is built server-side from a validated UUID plus `Date.now()` — no caller-controlled string reaches it, so there is no traversal. Two gaps remain: **file type is decided from the client-supplied `File.type` header rather than from the bytes**, and that same value is passed through as the stored `contentType`; and **there is no per-actor upload quota or total-size limit** beyond the 5 MB per-file cap and the globally-raised 6 MB server-action body limit (ADR-016 records that global raise as accepted exposure). So an actor holding the required role can park non-image bytes under an image extension in a public bucket, and can do it repeatedly.

**If it happened:** an image intended for members only is viewable by anyone who obtains the link. Low damage on its own; included because the _reason_ it is low — that covers are illustrative — is a policy assumption that stops being true the first time someone uses a photograph of identifiable people as the cover of a members-only article. The upload gaps are lower still: they need an admin role, and the damage is content parked in a bucket rather than data leaving one.

**Held today by:** path unguessability and an editorial convention (reading); role checks and server-built paths (writing).

---

### R22 — D12 · Reference data corrupted

**Who:** A1, A2, A3–A8.

**What is at risk:** `regions` and `cities`, which feed `transparency_regions`, `admin_region_stats`, `public_delegates.region_name_ka`, every member's stated region, and the composite FK `profiles_city_in_region`.

**Route:** `regions` and `cities` are the only two tables intended to be world-readable, and their policies say so (`"regions readable by all"`, `"cities readable by all"`, both `using (true)`). `anon` and `authenticated` also hold `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` on both, with no write policies — denied by RLS.

**Census note:** the baseline records 24 `finding` rows across these two tables for A1–A8. Those are expectation artefacts, not holes: the derivation rule assigned a `deny` expectation to tables that are deliberately public. Pass 2 should correct the expectation. This is the clearest instance of the general caveat at the top of this document.

**If it happened:** renamed or deleted regions would corrupt the public transparency breakdown and every member's displayed location; a `cities` deletion would break the `profiles_city_in_region` pairing. Embarrassing and confusing, not dangerous.

**Held today by:** RLS write denial.

---

## 4. Coverage — all sixteen tables

Every table appears in at least one threat above. None is exempt.

| #   | Table           | Who must never **read** it                                                                                                        | Who must never **write** it                                                       | Threats              |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------- |
| 1   | `profiles`      | Everyone but the person themselves and the three staff roles; `personal_id`/`birth_date`: everyone but A9 (and A10 for applicants)   | Everyone; the five scoped columns only via own-row grant, the rest only via definer RPCs | R1, R6, R7, R11, R12 |
| 2   | `delegates`     | Everyone (no client SELECT grant exists at all); `referral_code` in particular                                                      | Everyone but A9/A10 through the approval RPCs                                         | R15, R16, R18        |
| 3   | `memberships`   | Everyone but the member, their own delegate (counts/names via RPC) and staff                                                        | Everyone; only definer RPCs                                                           | R7, R15, R16         |
| 4   | `payments`      | Everyone but the member (10 columns of own rows) and A9/A11                                                                         | Everyone including A9/A11 directly — writes only via the audited RPCs                 | R7, R14              |
| 5   | `admin_roles`   | **Everyone but the holder (own row) and A9** — this is the coercion-target list                                                     | **Everyone**, including A9 directly — only `admin_grant_role`/`admin_revoke_role`     | R3, R9, R2           |
| 6   | `audit_log`     | Everyone but A9                                                                                                                     | **Everyone, without exception, including A9** — append-only by trigger                | R8, R7               |
| 7   | `app_settings`  | Everyone but A9 (via `admin_settings`)                                                                                              | Everyone but A9 via `admin_update_setting`                                            | R10, R7              |
| 8   | `dev_otp_inbox` | **Everyone** — it holds live sign-in codes in clear text                                                                            | Everyone but `supabase_auth_admin` via `send_sms_hook`                                | R2, R20              |
| 9   | `event_rsvps`   | Everyone but the member and their own approved delegate                                                                             | Everyone; only `member_rsvp`, always for `auth.uid()`                                 | R5                   |
| 10  | `events`        | Nobody, once published; drafts: A9/A12 only                                                                                         | Everyone but A9/A12                                                                   | R5, R13              |
| 11  | `news`          | Nobody, for public+published; members-only rows: completed members; drafts: A9/A12                                                  | Everyone but A9/A12                                                                   | R13, R21             |
| 12  | `polls`         | Everyone but completed members (open/closed) and A9/A12                                                                             | Everyone but A9/A12                                                                   | R17                  |
| 13  | `poll_options`  | Same as `polls` — labels are member-visible so ballots can render                                                                   | Everyone but A9/A12, and frozen once the poll opens                                   | R17                  |
| 14  | `poll_votes`    | **Everyone but the voter — including all four admin roles**                                                                         | Everyone; only `member_cast_vote`, and immutable thereafter                           | R17, R19             |
| 15  | `regions`       | Nobody — deliberately world-readable reference data                                                                                 | Everyone; there is no product write path at all                                       | R22, R7              |
| 16  | `cities`        | Nobody — deliberately world-readable reference data                                                                                 | Everyone; there is no product write path at all                                       | R22, R7              |

No table was found to hold nothing worth attacking. `regions` and `cities` come closest — their contents are public by design — but they are still integrity-relevant (R22), so neither is listed as exempt.

---

## 5. The grant layer: a defence-in-depth observation, not a breach

The census surfaced three candidates. **They have now been probed live, and none of them is exploitable anywhere tested.** This section states what that means, because the distinction matters more than the raw fact.

### 5.1 What is true

`anon` and `authenticated` hold `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` on `admin_roles`, `app_settings`, `audit_log`, `cities`, `dev_otp_inbox`, `memberships`, `payments`, `profiles` and `regions` — Supabase's default posture, narrowed to a column list only for `authenticated` on `profiles` and `payments`. Eleven views carry the same write set for `anon`. Four trigger functions carry EXECUTE for `PUBLIC`. All sixteen tables have RLS enabled, none forced.

### 5.2 What was tested, and what happened

| Probe                                                                      | Actors             | Result                                                                                                       |
| -------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `admin_members` / `admin_payments` / `admin_audit` / `admin_overview` read | A1                 | **`42501` permission denied for function `has_any_admin_role`.** Refused.                                        |
| `admin_roles` INSERT `{role:'super_admin'}`                                | A3, A5             | **`42501`, "new row violates row-level security policy".** Count 4 → 4.                                          |
| `app_settings` UPDATE `active_grace_days = 0`                              | A1, A3, A5         | Statement permitted, **0 rows affected**. Value 30 before, 30 after.                                             |
| `audit_log` SELECT / UPDATE / DELETE                                       | A1, member, **A9** | Permitted as statements, **0 rows each**. Row count 1468 → 1468.                                                 |
| `audit_log` INSERT                                                         | A1, member, A9     | **`42501`.** Refused.                                                                                            |
| `admin_roles` read                                                         | A3                 | **0 rows.**                                                                                                      |
| `dev_otp_inbox` read                                                       | A1, A3             | **0 rows.**                                                                                                      |
| Definer views: write grants vs auto-updatability                           | —                  | 11 views anon-writable, all `is_updatable = NO`; 8 auto-updatable, all SELECT-only for `anon`. **Intersection: empty.** |

### 5.3 What that means

- **The wide-open grant layer is real, and it is not a hole.** Every write attempt either failed at the privilege layer or was permitted and changed nothing. See §1.2: a permitted statement affecting zero rows is one layer abstaining and the next holding.
- **But one layer is doing all the work.** On `profiles`, `admin_roles`, `app_settings`, `audit_log`, `memberships`, `payments`, `delegates` and `dev_otp_inbox`, the thing standing between an anonymous stranger and the asset is a single row-level rule — sometimes a policy predicate, sometimes the _absence_ of a policy. There is no second layer to catch a mistake in the first. That is the finding-shaped observation, and it is about resilience, not about a current breach.
- **The empty intersection on views is luck, not design.** No anon-writable view happens to be auto-updatable, so no view is a write door into a base table. That is a property of view _shape_ (joins and subselects are not auto-updatable), not of any decision. Adding a single-relation admin view with the inherited default grants would open that door silently. Pass 2 should record this so it is not rediscovered, and the fix wave should consider making it structural.
- **The inconsistency is the point.** The Phase-5 community tables (`news`, `events`, `event_rsvps`, `polls`, `poll_options`, `poll_votes`) were created with an explicit `revoke all ... from anon, authenticated` and today carry **only** the column-scoped `SELECT` they need. The Phase-0 and Phase-4 tables — which hold the personal IDs, the money, the roles and the audit log — never got that treatment. Grant-layer defence was clearly intended in this project; it was applied last where it was needed first.

### 5.4 Threats each candidate would realise, if a row-level rule ever failed

| Candidate                                                           | Threats it would realise                   | Still open for Pass 4                                                                                                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — wide-open grants, row-level rules alone holding**              | R1, R2, R3, R7, R8, R9, R10, R14, R15, R22 | Refuted at every point tested (§5.2). Untested surfaces remain — Pass 2 enumerates them.                                                                                                                         |
| **2 — `TRUNCATE` granted to `anon`, not subject to row-level rules** | R7, R8                                     | **Open.** No probe reached TRUNCATE. If no route exists, record the disproof and close the grant anyway — it is the one verb the append-only trigger cannot see.                                                  |
| **3 — four trigger functions EXECUTE-granted to `PUBLIC`**           | R7, R8, R1                                 | **Open.** `audit_log_immutable`, `protect_profile_columns`, `enforce_delegate_completed`, `set_updated_at` are all `SECURITY INVOKER`; two are the enforcers of the append-only log and the protected-columns rule. |

---

## 6. What this model deliberately does not cover

Named so it does not drift into the later passes (spec §9):

- **Secrets, keys and access-token custody** across Supabase, Vercel and GitHub. R19 terminates in "whoever holds the service-role key", and that is launch hardening. Note that **session _policy_ is in scope and is modelled** (R4); only key custody is excluded.
- **Personal-data retention and minimisation, and the legal review.** ADR-006's deferred decision on encrypting `personal_id` at column level is flagged in R1 as now due, but deciding it is the owner's, not this audit's.
- **Replacing the dev OTP door with a real SMS provider.** R2 and R20 both depend on it; the door stays open by explicit scope decision. **R2's consequence set should be escalated to the owner under D8 rather than deferred silently.**
- **Denial-of-service beyond R20**, which is included only because it runs through the same OTP surface the audit is already attacking.
- **Anything reachable only with the database password or the service-role key**, and platform backup/restore behaviour (relevant to R7).

---

## 7. Self-check against the Task 5 acceptance criteria

- **Every threat names at least one actor position by `A` number.** R1–R22 each open with a "Who" line using `A1`–`A12`. R19 is stated as "nobody through any granted surface" and then names the positions checked and excluded, which is the honest form of the same claim.
- **Every threat names the tables or functions it targets by their real manifest names,** and **every name listed here appears in the ranked register itself**, not only in the coverage table — verified mechanically against `scripts/security/manifest.json`. The set: 16 tables (`profiles`, `delegates`, `memberships`, `payments`, `admin_roles`, `audit_log`, `app_settings`, `dev_otp_inbox`, `event_rsvps`, `events`, `news`, `polls`, `poll_options`, `poll_votes`, `regions`, `cities`); 20 views (`admin_members`, `admin_delegate_queue`, `admin_payments`, `admin_audit`, `admin_settings`, `admin_polls`, `admin_poll_options`, `admin_events`, `admin_finance_stats`, `admin_region_stats`, `admin_admins`, `admin_overview`, `public_delegates`, `public_stats`, `member_polls`, `member_poll_options`, `member_event_going_counts`, `poll_option_counts`, `transparency_stats`, `transparency_regions`); 41 functions (`register`, `cabinet_state`, `become_member_save_profile`, `become_member_complete`, `request_delegacy`, `delegate_team`, `delegate_team_rsvps`, `delegate_panel`, `member_cast_vote`, `member_rsvp`, `member_change_delegate`, `member_change_tier`, `has_admin_role`, `has_any_admin_role`, `is_registered`, `is_completed_member`, `admin_export_members`, `admin_reveal_personal_id`, `admin_reveal_applicant_personal_id`, `admin_record_payment`, `admin_record_payments_bulk`, `admin_void_payment`, `admin_reassign_member`, `admin_grant_role`, `admin_revoke_role`, `admin_update_setting`, `admin_approve_delegate`, `admin_publish_news`, `admin_save_news`, `admin_save_event`, `admin_publish_event`, `admin_cancel_event`, `admin_close_poll`, `recompute_all_active`, `active_sweep`, `send_sms_hook`, `audit_log_immutable`, `protect_profile_columns`, `enforce_delegate_completed`, `set_updated_at`, `gen_funnel_code`); 2 triggers (`audit_log_no_update`, `delegates_require_completed`); the endpoint `GET /api/dev/otp`; and both buckets (`delegate-photos`, `news-images`).
- **No threat is stated as a technique without naming the asset.** Each entry states the asset before the route; no entry is named after a class of attack.
- **All sixteen tables appear.** §4 maps each to at least one threat; none is listed as exempt, with the reason given for the two that came closest.
- **Ranking principle unchanged; positions extended.** The five tie-breaks in §2 are exactly as first written. Three structural changes moved rank numbers: two threats were inserted near the top (R3 `admin_roles` identity, R4 session policy), the former manufactured-members entry was merged into R2 as its consequence set (one rank, one fix), and **one entry was deliberately re-positioned on its merits** — `app_settings` (D8) moved from old R13 to new R10, next to `admin_roles` (D5), because the two are mechanically identical: same inherited wide grant, same absent policy, same disproof. Nothing else changed relative order.

  Old → new: R1→R1 · R2→R2 · R3→R5 · R4→R6 · R5→R7 · R6→R8 · **R7→merged into R2** · R8→R9 · R9→R11 · R10→R12 · R11→R13 · R12→R14 · **R13→R10** · R14→R15 · R15→R16 · R16→R17 · R17→R18 · R18→R19 · R19→R20 · R20→R21 · R21→R22.
