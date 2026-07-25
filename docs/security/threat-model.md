# Threat model — security check-up, Pass 1

- **Date:** 2026-07-25 · **Pass:** 1 of 4 (see spec §3)
- **Spec:** `docs/superpowers/specs/2026-07-25-security-checkup-design.md`
- **Inputs:** spec §2.2 (nine seed threats), spec §2.1 (twelve actor positions), `supabase/migrations/` (the authority on what exists), `scripts/security/manifest.json` (152 surfaces), `docs/security/ledger.json` (census baseline, 1824 rows), `DECISIONS.md` (ADR-006, ADR-009, ADR-013 … ADR-019), and live catalog introspection of the staging database on 2026-07-25.
- **Output:** the ranked threat register below. **The ranking (R1 … R21) is the ordering key for the owner-facing report in Task 11.** Findings from Passes 2–4 are ranked by the threat they realise, not by technical novelty.

> **Nothing in this document is a finding.** A threat is a statement of what would be damaging *if* it were reachable. The spec's prime directive stands: nothing becomes a finding until it has been reproduced against a running system (Pass 4). Where this document says "the only thing holding X is Y", that is a claim about the *structure* of the defence, read off the migrations and the live catalog — not a claim that the defence has failed.

---

## 1. How to read this

Each threat has five parts:

| Part            | What it means                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **Who** | The actor position(s) from spec §2.1 that could mount it, by `A` number.                                     |
| **What is at risk** | The concrete asset, named as the real tables, views or functions it lives in.                        |
| **Route** | The plausible path given what this codebase actually does — including what currently blocks it.               |
| **If it happened** | What the damage means for real people and for the movement, in plain language.                       |
| **Held today by** | The specific mechanism that stands in the way right now. This is what Passes 2–4 must test.           |

Actor shorthand, from spec §2.1: **A1** anonymous · **A2** signed in with no profile row · **A3** registered · **A4** profile_completed · **A5** active_member · **A6** pending delegate · **A7** approved delegate · **A8** rejected delegate · **A9** super_admin · **A10** verifier · **A11** finance · **A12** editor.

---

## 2. The ranking principle

The order below is **by damage, not by likelihood and not by how clever the attack is.** The tie-breaks, in order:

1. **Does it put named individuals at physical or legal risk?** This is a Georgian opposition movement. A list of named people with state ID numbers who publicly belong to it is not a privacy incident — it is a targeting list. Anything that produces such a list, or confirms one name at a time, ranks at the top.
2. **Does it destroy or falsify the movement's own record of itself?** Losing the membership record, or losing the ability to prove who did what, is not recoverable by apology.
3. **Does it let an outsider forge the movement's size, its voice, or its decisions?** The movement's public claim to legitimacy is its numbers, its statements and its internal votes.
4. **Does it break the internal fairness the platform promises its own people?** Delegate standings, poll integrity, verification meaning something.
5. **Is it a guard that ought to exist but has no route to real harm today?**

Two consequences of this ordering are worth stating out loud, because they are not the conventional ones:

- **A route that yields one name is ranked near a route that yields all of them.** Confirming that a specific named person is a member of this movement is, for that person, most of the damage of the full roster leak. Bulk is worse, but not by the margin a technical reading would suggest.
- **An attack on the ability to physically assemble ranks above an attack on money.** A list of who is going to a specific protest, at a specific place, at a specific hour, is more dangerous per row than the membership roster, because it is *predictive and location-bound*. The same logic puts the irreversible cancellation of a real mobilisation above payment tampering.

---

## 3. The ranked threat register

Seed threats keep their spec identifiers (**T1–T9**) so later passes can cite them unchanged. Threats derived in this pass are **D1–D12**. Rank is **R1** (worst) to **R21**.

---

### R1 — T1 · The member roster, with personal ID numbers, leaves the platform

**Who:** A1, A2, A3–A8 (if any row-level rule fails); A9 and A11 as insiders; anyone who takes over an A9 or A11 account.

**What is at risk:** `profiles` — specifically `personal_id`, `phone`, `first_name`, `last_name`, `region_id`, `city_id`, `birth_date`, `employment`. Reachable in bulk through the `admin_members` view, the `admin_export_members(text,int,text,boolean)` function, and the CSV route `app/(admin)/admin/members/export/route.ts`.

**Route:**

- **From outside (A1/A2).** Live introspection shows `anon` holds column-level `SELECT` on **every** column of `profiles`, including `personal_id` and `birth_date`. The *only* thing that returns zero rows to an anonymous PostgREST query is the single RLS policy `"own profile readable"`, whose predicate is `auth.uid() = id` — which yields NULL, and therefore no rows, when there is no session. There is no second layer here. Note the asymmetry: the column-grant defence that protects **members from each other** (the `authenticated` `SELECT` grant on `profiles` deliberately omits `personal_id`, `birth_date` and `pending_delegate_id`) **does not exist for `anon`**, which was never narrowed. The most sensitive table has the least grant-layer defence for the least trusted role. This is candidate finding 1, and this is what makes it matter.
- **From inside (A11).** `admin_export_members` is EXECUTE-granted to `authenticated` and admits `super_admin` or `finance` by its own in-function role check. A finance admin can export the entire roster — every name, every phone number, region, city, delegate, standing, tier and reference code — as a CSV, in one request. Personal IDs are correctly withheld from A11 (`p_include_ids` re-checks `has_admin_role('super_admin')`), but the rest is the roster.
- **From inside (A9).** `admin_export_members` with `p_include_ids = true`, or `admin_reveal_personal_id(uuid)` row by row. Both are audited. A9 is also the only role that can read the audit log.
- **Through a view.** All 24 views are owned by `postgres` and carry no `security_invoker`, so each one bypasses RLS entirely and its `WHERE` clause **is** the authorization. Nine admin views — including `admin_members`, which carries every member's phone number — are `SELECT`-granted to `anon` as well as `authenticated`. What stops an anonymous read is not the grant but the fact that `has_any_admin_role(text[])` is not EXECUTE-granted to `anon`.

**If it happened:** every person who joined is publicly identifiable as a member of an opposition movement, with the state ID number that ties them to employment records, property records, and family. This is not reversible, not deniable, and not survivable as "we changed a password". It is the reason this audit exists. ADR-006 (2026-07-12) deferred column-level encryption of `personal_id` with the note "revisit at Phase 6 audit before public launch" — **this is that audit**, and the deferral is now due for an explicit owner decision.

**Held today by:** one RLS policy expression for A1/A2; a column grant plus that policy for A3–A8; a role check inside a definer function for the admin views; and, for A9/A11, nothing at all — it is their job.

---

### R2 — T9 · Account takeover through the sign-in code flow

**Who:** A1, ending as any position up to and including A9.

**What is at risk:** every asset in this document. The sign-in path touches `dev_otp_inbox`, `send_sms_hook(jsonb)`, the endpoint `GET /api/dev/otp`, and `auth.users`.

**Route:**

- The dev OTP endpoint `app/api/dev/otp/route.ts` is gated by exactly one condition — `NEXT_PUBLIC_APP_ENV` being `development` or `preview`. There is no authentication, no role check, no rate limit and no origin check. It reads `dev_otp_inbox` with the service-role key and returns the live code for a caller-supplied phone number. Its one substantive restriction is that it withholds the code when a `profiles` row already exists for that number — so it protects existing members, and hands out codes for every number that has **not yet registered**. The spec places closing this door in the *next* phase (§9), which means the door is open on the deployed environment during and after this one.
- The two 404 branches return different bodies (`"not found"` when a profile exists, `"no otp"` when it does not), so the endpoint also answers "does this phone number have an account here?" for any number, without sending anything.
- Independent of that door: there is **no CAPTCHA** (`[auth.captcha]` is commented out in `supabase/config.toml`) and no app-layer rate limit. The only throttle on resend is a client-side 60-second React counter in `components/OtpVerification.tsx`, which never reaches the server — the send is a browser-to-Supabase call. The real limits are Supabase's `sign_in_sign_ups = 30` and `token_verifications = 30` per five minutes **per IP**.

**If it happened:** an attacker holding an A9 session has the roster, the personal IDs, the payment ledger, the role grants and the audit log — and is the only role that can read the audit log that would show what they did. Impersonation is total: statements published under the movement's name, delegates approved or rejected, members reassigned.

**Held today by:** the profile-exists check in the dev endpoint (for accounts that already completed registration), Supabase's per-IP verification limits, and the six-digit code space. For accounts that have *not* completed registration, by nothing.

---

### R3 — D1 · Named attendance lists for a specific upcoming event

**Who:** A7 (legitimately, for their own team); anyone who takes over an A7 account; A9/A10/A11 by reconstruction.

**What is at risk:** `event_rsvps` joined to `profiles` and `memberships` — surfaced as names by `delegate_team_rsvps()`, and as counts by `member_event_going_counts` and `admin_events.going_count`.

**Route:** `delegate_team_rsvps()` returns, for every **published, not-yet-finished** event, the first and last name of each member of the calling delegate's team who has RSVP'd "going". It is correctly scoped to `m.delegate_id = v_uid` and requires `status = 'approved'`. That scoping is the defence, and it holds — but it means every approved delegate legitimately holds a forward-looking, named list of who intends to be physically present at a specific place and time. A staff role (A9/A10/A11) can reconstruct the same lists across all delegates by joining `admin_members` (which carries `delegate_id`) against per-event counts, though no granted surface gives them the names directly.

**If it happened:** this is the most operationally dangerous data the platform produces. The roster says who joined; this says *who will be standing in that square on Thursday*. A leak here is not a disclosure, it is advance notice. It also enables the quieter version: an adversary who knows the counts can anticipate the size of a gathering.

**Held today by:** the `approved`-delegate gate and the `delegate_id = auth.uid()` scoping inside `delegate_team_rsvps()`, plus the absence of any write or bulk-read grant on `event_rsvps` (`authenticated` holds column `SELECT` on `event_id, member_id, status` only, constrained to own rows by `"own rsvps readable"`; there are no INSERT/UPDATE/DELETE grants at all). This table is one of the few that is properly defended at both layers.

---

### R4 — D2 · Silent confirmation that a named person is a member, one at a time

**Who:** A2 (the position that can call it), reachable from A1 in one hop.

**What is at risk:** the fact of membership itself, for any individual whose 11-digit Georgian personal ID the attacker holds. The oracle is `register(text,text,text,text)`, reading `profiles.personal_id`.

**Route:** `register()` raises the distinct token `duplicate_personal_id` when the submitted personal ID already exists in `profiles`, and `invalid_personal_id` when it fails the `^\d{11}$` shape, and succeeds otherwise. An attacker with a session and no profile row (A2) submits a target's personal ID and reads the answer off the error token. Personal ID numbers in Georgia are widely held — they appear on identity documents, in employment records and in commercial databases — so the attacker's input is not the hard part. `register()` no-ops once the caller has a profile, so it is one query per session; but sessions are free (see R2), so the query count is effectively unbounded. **Nothing is written to `audit_log` on this path.** The movement would never know it had been asked.

**If it happened:** an adversary can go down a list of names — employees, students, journalists, civil servants — and learn, silently and repeatably, which of them belong to this movement. For the individuals concerned this is nearly the whole harm of R1, delivered retail instead of wholesale, with no trace and no disclosure event to respond to.

**Held today by:** the requirement for an authenticated session, and the per-session single-shot nature of `register()`. Neither is a real cost.

---

### R5 — D3 · Mass destruction of the membership record

**Who:** A1, A2, A3–A8.

**What is at risk:** `profiles`, and by cascade `delegates`, `memberships`, `payments`, `event_rsvps`, `poll_votes`; plus `audit_log`, `admin_roles`, `app_settings`, `dev_otp_inbox`, `regions`, `cities` directly.

**Route:** Live introspection shows `anon` and `authenticated` hold `DELETE`, `INSERT`, `UPDATE`, `REFERENCES` **and `TRUNCATE`** on `profiles`, `memberships`, `payments`, `admin_roles`, `audit_log`, `app_settings`, `dev_otp_inbox`, `regions`, `cities` (this is Supabase's default posture — candidate findings 1 and 2). Two different keys open the same door:

- **`DELETE`** is subject to row-level security, and `profiles` has no DELETE policy, so it is denied — by RLS alone. `profiles.id` is the parent of `ON DELETE CASCADE` foreign keys from `delegates`, `memberships`, `payments`, `event_rsvps` and `poll_votes` (added deliberately for staging cleanup, ADR-015). A single successful `DELETE FROM profiles` therefore erases the movement, not one table.
- **`TRUNCATE` is not subject to row-level security at all**, and no statement-level trigger guards it. PostgREST does not expose TRUNCATE, so there is very likely no live route — "very likely" is precisely what Pass 4 exists to resolve.

**If it happened:** the movement loses its membership, its payment history, its delegate structure and its event records in one statement, with no product-level restore path. Recovery would depend entirely on platform backups, which this audit does not cover. Every member would have to be re-enrolled, meaning every member would have to be asked, again, to hand over their personal ID.

**Held today by:** for DELETE, the absence of a DELETE policy on every table — that is, by RLS and nothing else. For TRUNCATE, by PostgREST not exposing the verb.

---

### R6 — T8 · The append-only audit log is erased or forged

**Who:** A1, A2, A3–A8 for the erasure/forgery routes; A9 as the only reader.

**What is at risk:** `audit_log`, the trigger `audit_log_no_update`, the function `audit_log_immutable()`, and the view `admin_audit`.

**Route:** Three distinct sub-threats, and they do not have the same shape:

- **Rewriting history.** `UPDATE` and `DELETE` on `audit_log` are blocked by the row-level trigger `audit_log_no_update`, which raises unconditionally and fires for **every** role including the table owner. This is the strongest single guard in the schema.
- **Erasing history.** `TRUNCATE` fires no row-level trigger and is not subject to RLS, and `TRUNCATE` on `audit_log` is granted to `anon`. **The append-only guarantee has a hole exactly the width of TRUNCATE.** Whether that hole is reachable is Pass 4's job; that it exists is not in dispute.
- **Forging history.** `INSERT` on `audit_log` is granted to `anon` and `authenticated` and is blocked only by the absence of an INSERT policy. Note that `active_sweep()` and the bootstrap script both legitimately write rows with `actor_id = NULL`, so a forged system-attributed row would be indistinguishable from a real one.
- **Reading history.** `admin_audit` gates on `has_admin_role('super_admin')`. The log records who revealed which personal ID and who exported what — so the log is itself sensitive, and A9 is both its only reader and its most consequential subject.

Separately, and by design: **a compromised A9 cannot delete the log, but is also the only person who would ever look at it.** No alerting exists. ADR-014's guarantee is that an unaudited admin action is unrepresentable; it is not that an audited one will be noticed.

**If it happened:** every other item in this document becomes unattributable. The movement could know it had been breached and never be able to say by whom, which in this context is the difference between a security incident and an unresolvable internal accusation.

**Held today by:** a row-level trigger (strong), plus the absence of INSERT/DELETE policies (RLS only), plus PostgREST not exposing TRUNCATE.

---

### R7 — D4 · Manufacturing members at scale

**Who:** A1, chaining to unlimited A3 and A4 identities.

**What is at risk:** `profiles`, `memberships`, `public_stats.registered_total`, `public_delegates.active_supporters`, `poll_votes`, `event_rsvps`, `delegate_panel()`'s counts and `admin_delegate_queue.total_supporters`.

**Route:** A chained attack, and the clearest example of two individually-defensible behaviours combining badly:

1. `signInWithOtp` accepts any phone number and `enable_signup = true`, so an auth user is created for a number that need not exist or belong to anyone.
2. The dev OTP endpoint hands back the code for that number, because it has no profile row (R2).
3. `register()` needs a name and any string matching `^\d{11}$` that is not already taken — there is no validation that a personal ID is real, only that it is unique and eleven digits.
4. `become_member_save_profile` + `become_member_complete` promote the account to `profile_completed` with **no payment**, which is enough to vote in polls and to be counted as a member.
5. If step 3 carries a delegate's `signup_ref_code`, step 4 binds the synthetic account to that delegate's team (stored approved referral wins over the picker).

The only scarce resource is unused 11-digit strings, of which there are 10^11.

**If it happened:** the movement's headline public number (`public_stats.registered_total` — cumulative and never shrinking, by ADR-019) becomes forgeable in either direction: inflated to embarrass the movement when the fraud is exposed, or inflated *by* an insider and then exposed by an adversary. Internal polls become decidable by whoever registers the most synthetic accounts. Event RSVP counts, which the movement uses to plan logistics, become noise. And a hostile actor can flood a chosen delegate's team with fake supporters, which is R14 run in reverse — poisoning rather than boosting.

**Held today by:** the dev OTP door being the only step that is not already open, and it is open on the deployed environment by explicit scope decision (spec §9). **This threat should be treated as an escalation candidate under D8** — its remedy sits in the next phase, but the exposure is live now.

---

### R8 — D5 · Self-granting an admin role

**Who:** A3–A8 (and A2, if any INSERT path existed at all).

**What is at risk:** `admin_roles`, and through it everything gated on `has_admin_role(text)` / `has_any_admin_role(text[])`.

**Route:** `anon` and `authenticated` hold column-level `INSERT` and `UPDATE` on all four columns of `admin_roles` (`user_id`, `role`, `granted_by`, `granted_at`). The table has exactly one policy — `"own admin roles readable"`, a SELECT policy. There is no INSERT policy and no UPDATE policy, so writes are denied. That is the entire defence: an absent policy. A successful `INSERT INTO admin_roles (user_id, role) VALUES (auth.uid(), 'super_admin')` would be self-service promotion to the top of the platform, and — because `has_admin_role` reads that table directly — would take effect on the next request with no further step.

The legitimate path, `admin_grant_role(uuid,text)`, is correctly `super_admin`-only and audited; `admin_revoke_role` additionally holds an advisory lock so the last super_admin cannot be revoked away. Neither helps if the table itself is writable.

**If it happened:** an ordinary member becomes a super_admin. Everything in R1, R2 and R6 follows in one step, and the audit row that would have recorded a legitimate grant never exists, because no RPC was called.

**Held today by:** the absence of an INSERT policy on `admin_roles`. Nothing else.

---

### R9 — D6 · An admin role reads and exports far beyond its stated scope

**Who:** A10 (verifier), A11 (finance).

**What is at risk:** `profiles` via the `admin_members` view; `admin_export_members`; `memberships` structure via `admin_members.delegate_id`.

**Route:** The spec describes A10 as "delegate verification and PID reveals only" and A11 as "payments only". The database does not implement that description on the read side:

- `admin_members` self-gates on `has_any_admin_role('super_admin', 'verifier', 'finance')` — so **all three** staff roles read every member's name, **phone number**, region, city, standing, tier, reference code, and which delegate backs them.
- `admin_export_members` admits `super_admin` or `finance` — so **A11 can download the whole roster as a file**, not merely browse it. The CSV route applies the same two roles at the app layer, and narrows `includeIds` to `super_admin`.
- The per-page role checks in `app/(admin)/**` narrow what the *UI* shows, but every one of these views is directly queryable through PostgREST by any holder of a staff session. The app-layer check in `findAdminCandidateAction` (which restricts to `super_admin`) is narrower than the view it reads, and is therefore not a control — the view is.

**If it happened:** the volunteer who was given the narrowest-sounding job on the platform — recording bank transfers — holds a one-click export of the entire movement with phone numbers. This is R1 with an ordinary login and no break-in at all, and it is the version most likely to actually happen: not an attacker, but a trusted person who is later pressured, or whose laptop is taken.

**Held today by:** nothing — this is the designed behaviour. It is in this register because "designed" and "intended" are not the same thing, and the owner has not been told that finance can export the roster.

---

### R10 — T4 · One member reads another member's personal ID

**Who:** A3–A8.

**What is at risk:** `profiles.personal_id` and `profiles.birth_date`.

**Route:** Two layers currently stand between one member and another's ID: the `authenticated` `SELECT` column grant on `profiles` deliberately omits `personal_id`, `birth_date` and `pending_delegate_id`; and the `"own profile readable"` RLS policy restricts to `auth.uid() = id`. No view exposes `personal_id` — ADR-014 states it appears in no admin view, and introspection confirms it. `cabinet_state()` returns only `personalIdMasked` (first three digits plus asterisks). The remaining routes are the two audited reveal RPCs, both role-gated: `admin_reveal_personal_id` (super_admin) and `admin_reveal_applicant_personal_id` (super_admin or verifier, scoped to rows that exist in `delegates`).

Note the residual insider case: **A10 can reveal the personal ID of any delegate applicant, one at a time, with no reason required and no rate limit** — audited, but harvestable.

**If it happened:** one person's state ID number in the hands of another member. Smaller than R1 in scale, identical in kind for the person concerned.

**Held today by:** a column grant *and* an RLS policy — genuine defence in depth, and the strongest posture on any sensitive column in the schema. This is what the rest of `profiles` should look like for `anon` (see R1).

---

### R11 — D7 · An editor speaks for the movement, or cancels a real mobilisation

**Who:** A12, A9; anyone who takes over such an account.

**What is at risk:** `news`, `events`, and the movement's public voice. Functions: `admin_save_news`, `admin_publish_news`, `admin_save_event`, `admin_publish_event`, `admin_cancel_event`.

**Route:** `admin_publish_news(uuid,text)` requires only `editor` or `super_admin`. There is no second approval, no four-eyes rule and no delay: a single editor account publishes to the public homepage immediately. The same account can publish a fabricated event — a protest at a place and time that the movement never called — and members will act on it. And `admin_cancel_event(uuid)` moves a published event to `cancelled`, which `admin_save_event` then refuses to edit ("cancelled events are frozen history") and for which **no un-cancel RPC exists**. The cancellation is irreversible through the product.

**If it happened:** a false statement carrying the movement's name — an endorsement, a retraction, a call to something the movement did not call for — reaches the public before anyone internal can react. Or the reverse: on the eve of a real mobilisation, the event page says cancelled, and the movement cannot put it back without a database migration. In a political contest, the second is a direct attack on the ability to assemble.

**Held today by:** the `editor`/`super_admin` role check inside each RPC, and the audit row each writes. Both are correct; neither is a second pair of eyes.

---

### R12 — T7 · Payments recorded, altered or voided outside finance

**Who:** A10, A12 (roles that must not); A3–A8 (if the table itself were writable); A9, A11 (legitimately).

**What is at risk:** `payments` and, through the active-member engine, `profiles.status`, `public_stats.active_members`, `admin_finance_stats.mrr_gel`, `transparency_stats.total_gel` and `public_delegates.active_supporters`.

**Route:** Every write RPC — `admin_record_payment`, `admin_record_payments_bulk`, `admin_void_payment` — checks `has_any_admin_role('super_admin', 'finance')` first, so A10 and A12 are refused. Directly against the table, `anon` and `authenticated` hold `INSERT`, `UPDATE` and `DELETE` on every column of `payments`; `payments` has exactly one policy, `"own payments readable"` (SELECT), so all writes are denied — again by RLS alone.

Worth noting: ADR-015 declares payments **immutable** ("corrections are voids"), but that immutability is enforced only by the absence of an UPDATE RPC and the absence of an UPDATE policy. There is **no equivalent of `audit_log`'s immutability trigger on `payments`**. If the row-level layer ever admits an UPDATE, payment history becomes silently rewritable, and `months_covered` — a generated column — would follow the rewritten amount automatically.

**If it happened:** members are shown as paid who did not pay, or unpaid who did. Because `profiles.status` is derived from payments, a forged payment silently promotes someone to `active_member`, which counts them in the public figures, adds them to a delegate's public supporter count, and unlocks member-only surfaces. The transparency page — the movement's public account of the money it holds — becomes untrue.

**Held today by:** role checks inside the RPCs (correct), plus the absence of write policies on `payments` (RLS only).

---

### R13 — D8 · One setting flips the standing of the entire membership

**Who:** A9; anyone who takes over an A9 account.

**What is at risk:** `app_settings` (key `active_grace_days`), and through `recompute_all_active()` the `status` of every row in `profiles`.

**Route:** `admin_update_setting('active_grace_days', <jsonb>)` is `super_admin`-only, validated to 0–365, audited — and then calls `recompute_all_active()`, which rewrites `profiles.status` across the whole table in one transaction. Set it to 365 and lapsed members become active again: the public "active members" figure and `mrr_gel` inflate, and delegates' public `active_supporters` inflate with them. Set it to 0 and everyone whose coverage has expired is demoted at once: locked out of polls, member-only news and billing, and removed from every public count.

`app_settings` is otherwise sealed — no client grants beyond the default set, no policies, read only through `admin_settings`.

**If it happened:** the movement's public claim about its own size changes by one number typed into one field, in either direction, with no visible cause. Or the entire membership loses its member privileges simultaneously and the support burden lands on the movement, not the attacker.

**Held today by:** the `super_admin` check and the 0–365 bound. Both correct; neither limits the blast radius.

---

### R14 — T2 · A delegate's supporter count inflated

**Who:** A6, A7 (self-inflation); A1 via R7 (inflation or poisoning of any delegate).

**What is at risk:** `memberships`, `public_delegates.active_supporters`, `admin_delegate_queue.total_supporters`/`active_supporters`, `delegate_panel()`'s `totalCount`/`registeredCount`/`activeCount`.

**Route:** Supporter counts are correctly derived everywhere — nothing stores them, per the house rule. There are two distinct routes:

- **Direct.** `anon` and `authenticated` hold `INSERT` and `UPDATE` on all columns of `memberships`. The table has one policy, `"own memberships readable"` (SELECT). Writes are denied by RLS alone. A successful insert would let any account mint arbitrary `(member_id, delegate_id)` rows.
- **Via manufactured members (R7).** Register synthetic accounts carrying the delegate's `signup_ref_code`; each one that completes the wizard binds to that delegate. This needs no grant at all. The public number `active_supporters` counts only `active_member`, so inflating *that* still needs a recorded payment (A9/A11) — but **`admin_delegate_queue.total_supporters` is exactly the number a verifier looks at when deciding whether to approve an applicant**, and it is inflatable for free. A pending delegate can inflate the figure they are being judged on.

**If it happened:** the public leaderboard stops meaning anything, and — worse internally — verification decisions get made on manufactured evidence. The inverse is equally available: flooding a rival's team with synthetic supporters so that the fraud, when found, is attributed to them.

**Held today by:** RLS on `memberships` for the direct route; nothing for the referral route.

---

### R15 — T3 · A rival delegate's team read

**Who:** As stated in the seed list, A7. **On the evidence, the real actors are A9, A10 and A11.**

**What is at risk:** `memberships` joined to `profiles` — surfaced by `delegate_team()` (own team only) and `admin_members.delegate_id` (all teams).

**Route:** `delegate_team()` is scoped to `m.delegate_id = v_uid` and additionally requires `status = 'approved'` (added by `20260716120000_delegate_team_approved_gate.sql` after a review finding). `delegate_panel()` deliberately stays any-status but returns only counts, and withholds `referral_code` until approval. `public_delegates` exposes a count, not names. `memberships` is readable only for own rows. **No route from A7 to a rival's team was found in the schema.**

What does exist: `admin_members` carries `delegate_id`, `delegate_first_name` and `delegate_last_name` for every member, so any of the three staff roles can reconstruct every delegate's full team. That is R9 again, applied to team structure.

**If it happened:** a delegate learns exactly who is backing a rival — in a movement where delegates compete for standing, that is a map of the internal opposition. The trust cost is internal and corrosive rather than external and dangerous, which is why it sits here rather than higher.

**Held today by:** correct uid-scoping in `delegate_team()`; the `approved` gate; and the absence of any cross-member read on `memberships`. This one is well built.

---

### R16 — T5 · Poll integrity — double voting, early results, timed closure

**Who:** A4–A8 (voting); A12 and A9 (running the poll); A1 via R7 (stuffing).

**What is at risk:** `polls`, `poll_options`, `poll_votes`, the views `member_polls`, `member_poll_options`, `poll_option_counts`, `admin_polls`, `admin_poll_options`.

**Route:** Three sub-threats with very different strengths:

- **Voting twice is structurally impossible.** `poll_votes` has `PRIMARY KEY (poll_id, member_id)` and a composite FK `(poll_id, option_id) → poll_options(poll_id, id)`, so a second vote and a cross-poll option are both unrepresentable, not merely rejected. `member_cast_vote` takes `FOR SHARE` on the poll row to serialize against a concurrent close. This is the strongest guard in the community schema.
- **Early results are a design decision, not a hole.** `poll_option_counts` shows counts once the caller has voted or the poll has closed (ADR-017 decision #4). So live running counts are visible to voters mid-poll, deliberately.
- **The real residual is who controls the clock.** `admin_polls.total_votes` and `admin_poll_options.votes` give A12 the live tally at all times, and `admin_close_poll(uuid)` lets that same A12 close the poll at a moment of their choosing. **An editor can watch the count and close when the result suits them.** Combined with R7, an outsider can also stuff the ballot: `member_cast_vote` requires only `registration_completed_at is not null`, which costs nothing to obtain.

**If it happened:** an internal vote that the movement treats as its own decision is decided by whoever controls the close button or the registration queue. The credibility loss is internal first and public second.

**Held today by:** a primary key (strong), a role check on the close RPC (correct but single-handed), and, for stuffing, only the cost of manufacturing members — which is currently zero.

---

### R17 — T6 · A rejected applicant regains delegate powers

**Who:** A8 (self-service); A10 or A9 (by decision).

**What is at risk:** `delegates.status`, `delegates.slug`, `delegates.referral_code`, and everything gated on approved status — `delegate_team()`, `delegate_team_rsvps()`, `public_delegates`.

**Route:**

- **Self-service.** `request_delegacy()` refuses if any `delegates` row exists for the caller, so rejection is terminal from the member side (ADR-019). The obvious bypass would be deleting one's own `delegates` row and re-requesting: `authenticated` holds `DELETE` and `UPDATE` on `delegates`, and `delegates` has **zero policies** with RLS enabled, so every client write is denied — by RLS alone. There is no client `SELECT` grant on `delegates` either, so the table is fully sealed. Additionally, `enforce_delegate_completed()` (trigger `delegates_require_completed`) makes a delegates row without a completed member profile unrepresentable on any path, including service-role scripts.
- **By decision.** `admin_approve_delegate` refuses only when the target is already `approved` — a `rejected` row **can** be re-approved, and the migration comment ("re-approval keeps the original slug") shows this is intentional. So a single verifier, acting alone, can reinstate a rejected applicant with no second signature and no cooling-off. It is audited.

**If it happened:** the verification step — the movement's only check on who gets a public profile, a referral code and a team — stops being a check. Note that the plausible route is not an attacker but a single insider with the `verifier` role.

**Held today by:** RLS on a fully sealed table (self-service route), and a role check plus an audit row (decision route).

---

### R18 — D9 · Individual ballots readable outside the product

**Who:** nobody through any granted surface — including A9. Anyone holding the service-role key or the database password.

**What is at risk:** `poll_votes`, which stores `(poll_id, option_id, member_id)` — the link between a named person and how they voted.

**Route:** This is deliberately included as a threat with **no in-product route**, because the answer to "who must never read this?" is *everyone*, and the schema currently honours that: `authenticated` holds column `SELECT` on `poll_votes` constrained by `"own votes readable"` to `member_id = auth.uid()`; there are no write grants; and no admin view exposes per-voter rows — `admin_polls` and `admin_poll_options` give counts only. The only readers are the service role and the database owner.

Two residual leaks that do exist in-product: a poll with very few voters makes `poll_option_counts` a de-anonymiser by arithmetic, and `admin_poll_options.votes` gives A12 a per-option breakdown that becomes identifying at small N.

**If it happened:** members learn that their vote in an internal leadership contest was never secret. For a movement whose internal legitimacy rests on those votes, that is a governance failure rather than a data breach — but it is one the members were never warned about, because the product presents the ballot as private.

**Held today by:** the schema, correctly. The exposure is operational: key and credential custody, which spec §9 places in the next phase.

---

### R19 — D10 · The sign-in door jammed

**Who:** A1.

**What is at risk:** availability of `signInWithOtp` for every member, and — after launch — the movement's SMS budget. Touches `send_sms_hook(jsonb)` and `dev_otp_inbox`.

**Route:** `sms_sent` is capped at 100 per hour **for the whole project** (`supabase/config.toml`, raised for staging e2e). There is no CAPTCHA and no app-layer rate limit; the client-side 60-second resend cooldown never reaches a server. An anonymous caller can therefore exhaust the hourly quota and nobody — member, delegate or admin — can sign in or register until it resets. The spec already records this happening accidentally during normal e2e runs (§8). After launch, when the hook points at a paid Georgian SMS provider, the same abuse becomes a direct cost attack.

**If it happened:** the platform is unreachable at exactly the moments it matters most, which for a civic movement are the hours around an event or an announcement. It costs the attacker nothing and leaves no attributable trace.

**Held today by:** Supabase's per-IP `sign_in_sign_ups = 30 / 5 min`, which does not constrain a distributed caller.

---

### R20 — D11 · Member-only article covers fetchable by anyone with the URL

**Who:** A1.

**What is at risk:** objects in the `news-images` storage bucket that illustrate `news` rows with `visibility = 'members'`.

**Route:** Both buckets — `delegate-photos` and `news-images` — are `public = true`, and `storage.objects` has zero policies. Public buckets serve objects by path without an RLS check. Paths are `<uuid>-<epoch-ms>.<ext>`, so they are not enumerable by guessing and cannot be listed (listing goes through `storage.objects`, which denies). But a URL, once shared, works for anyone forever. ADR-017 records this as an accepted trade-off ("unguessable UUID paths, illustrative by policy; private bucket + signed URLs recorded as the later fix"). `delegate-photos` is intentionally public and is not a threat.

**If it happened:** an image intended for members only is viewable by anyone who obtains the link. Low damage on its own; included because the *reason* it is low — that covers are illustrative — is a policy assumption that will quietly stop being true the first time someone uses a photograph of identifiable people as a cover image for a members-only article.

**Held today by:** path unguessability, and an editorial convention.

---

### R21 — D12 · Reference data corrupted

**Who:** A1, A2, A3–A8.

**What is at risk:** `regions` and `cities`, which feed `transparency_regions`, `admin_region_stats`, `public_delegates.region_name_ka`, every member's stated region, and the composite FK `profiles_city_in_region`.

**Route:** `regions` and `cities` are the only two tables intended to be world-readable, and their policies say so (`"regions readable by all"`, `"cities readable by all"`, both `using (true)`). `anon` and `authenticated` also hold `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` on both, with no write policies — denied by RLS. The census baseline flags these two tables as findings for A1–A8; that is an artefact of the expectation-derivation rule (a `deny` expectation was derived for tables that are in fact deliberately public), not a real hole. Pass 2 should correct the expectation rather than record a finding.

**If it happened:** renamed or deleted regions would corrupt the public transparency breakdown and every member's displayed location; a `cities` deletion would break the `profiles_city_in_region` pairing. Embarrassing and confusing, not dangerous.

**Held today by:** RLS write denial.

---

## 4. Coverage — all sixteen tables

Every table appears in at least one threat above. None is exempt.

| #   | Table           | Who must never **read** it                                            | Who must never **write** it                                          | Threats             |
| --- | --------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------- |
| 1   | `profiles`      | Everyone but the person themselves and the three staff roles; `personal_id`/`birth_date`: everyone but A9 (and A10 for applicants) | Everyone; the five scoped columns only via own-row grant, the rest only via definer RPCs | R1, R4, R5, R9, R10 |
| 2   | `delegates`     | Everyone (no client SELECT grant exists at all); `referral_code` in particular | Everyone but A9/A10 through the approval RPCs                     | R14, R15, R17       |
| 3   | `memberships`   | Everyone but the member, their own delegate (counts/names via RPC) and staff | Everyone; only definer RPCs                                      | R5, R14, R15        |
| 4   | `payments`      | Everyone but the member (10 columns of own rows) and A9/A11           | Everyone including A9/A11 directly — writes only via the audited RPCs | R5, R12             |
| 5   | `admin_roles`   | Everyone but the holder (own row) and A9                              | **Everyone**, including A9 directly — only `admin_grant_role`/`admin_revoke_role` | R8, R2        |
| 6   | `audit_log`     | Everyone but A9                                                       | **Everyone, without exception, including A9** — append-only by trigger | R6, R5              |
| 7   | `app_settings`  | Everyone but A9 (via `admin_settings`)                                | Everyone but A9 via `admin_update_setting`                            | R13                 |
| 8   | `dev_otp_inbox` | **Everyone** — it holds live sign-in codes in clear text              | Everyone but `supabase_auth_admin` via `send_sms_hook`                | R2, R7              |
| 9   | `event_rsvps`   | Everyone but the member and their own approved delegate               | Everyone; only `member_rsvp`, always for `auth.uid()`                 | R3                  |
| 10  | `events`        | Nobody, once published; drafts: A9/A12 only                           | Everyone but A9/A12                                                   | R3, R11             |
| 11  | `news`          | Nobody, for public+published; members-only rows: completed members; drafts: A9/A12 | Everyone but A9/A12                                       | R11, R20            |
| 12  | `polls`         | Everyone but completed members (open/closed) and A9/A12               | Everyone but A9/A12                                                   | R16                 |
| 13  | `poll_options`  | Same as `polls` — labels are member-visible so ballots can render     | Everyone but A9/A12, and frozen once the poll opens                   | R16                 |
| 14  | `poll_votes`    | **Everyone but the voter — including all four admin roles**           | Everyone; only `member_cast_vote`, and immutable thereafter           | R16, R18            |
| 15  | `regions`       | Nobody — deliberately world-readable reference data                   | Everyone; there is no product write path at all                       | R21                 |
| 16  | `cities`        | Nobody — deliberately world-readable reference data                   | Everyone; there is no product write path at all                       | R21                 |

No table was found to hold nothing worth attacking. `regions` and `cities` come closest — their contents are public by design — but they are still integrity-relevant (R21), so neither is listed as exempt.

---

## 5. The three candidate findings, mapped

The census baseline surfaced three candidates. They are **not** findings; Pass 4 proves or refutes them. This model names the threats each would realise, so the later passes know what they are testing against.

| Candidate                                                                                | Threats it would realise | What Pass 4 must establish                                                                                                                        |
| ---------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — the grant layer is wide open; row-level rules are the only thing holding**          | R1, R5, R6, R8, R12, R14, R21 | Whether any row-level rule is missing or wrong on `profiles`, `admin_roles`, `audit_log`, `memberships`, `payments`. Every one of those tables is defended by exactly one layer, and for `anon` on `profiles` that layer covers `personal_id` itself. |
| **2 — `TRUNCATE` is granted to `anon` and is not subject to row-level rules**             | R5, R6                   | Whether any live route reaches TRUNCATE. If none, record the disproof — the grant remains a latent hole worth closing on its own merits, because it is the one verb the append-only trigger cannot see. |
| **3 — four trigger functions are EXECUTE-granted to PUBLIC**                              | R5, R6, R1               | Whether `audit_log_immutable`, `protect_profile_columns`, `enforce_delegate_completed` or `set_updated_at` can be invoked outside trigger context. All four are `SECURITY INVOKER`, so they run as the caller; two of them are the enforcers of the append-only log and the protected-columns rule. |

Introspection confirms the mechanical facts behind all three: `anon` and `authenticated` hold `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` on `admin_roles`, `app_settings`, `audit_log`, `cities`, `dev_otp_inbox`, `memberships`, `payments`, `profiles` and `regions` (with `SELECT` narrowed to a column list for `authenticated` on `profiles` and `payments` only); the four trigger functions carry `=X/postgres` (PUBLIC) plus explicit `anon` and `authenticated` grants; and every one of the sixteen tables has RLS enabled with `relforcerowsecurity = false`.

The inconsistency is the point. The Phase-5 community tables (`news`, `events`, `event_rsvps`, `polls`, `poll_options`, `poll_votes`) were created with an explicit `revoke all ... from anon, authenticated` and today carry **only** the column-scoped `SELECT` they need. The Phase-0 and Phase-4 tables — which hold the personal IDs, the money, the roles and the audit log — never got that treatment. Grant-layer defence was clearly intended in this project; it was applied last where it was needed first.

---

## 6. What this model deliberately does not cover

Named so it does not drift into the later passes (spec §9):

- Secrets, keys and access-token custody across Supabase, Vercel and GitHub. R18 and R2 both terminate in "whoever holds the service-role key", and that is launch hardening, not this phase.
- Personal-data retention and minimisation, and the legal review. ADR-006's deferred decision on encrypting `personal_id` at column level is flagged in R1 as now due, but deciding it is the owner's, not this audit's.
- Replacing the dev OTP door with a real SMS provider. R2, R7 and R19 all depend on it; the door stays open by explicit scope decision. **R7 in particular should be escalated to the owner under D8 rather than deferred silently**, because its exposure is live on the deployed environment today.
- Denial-of-service beyond R19, which is included only because it runs through the same OTP surface the audit is already attacking.
- Anything reachable only with the database password or the service-role key.

---

## 7. Self-check against the Task 5 acceptance criteria

- **Every threat names at least one actor position by `A` number.** R1–R21 each open with a "Who" line using `A1`–`A12`. R18 is stated as "nobody through any granted surface" and then names the positions that were checked and excluded, which is the honest form of the same claim.
- **Every threat names the tables or functions it targets by their real manifest names.** Checked against `scripts/security/manifest.json`: every object referenced above (`profiles`, `delegates`, `memberships`, `payments`, `admin_roles`, `audit_log`, `app_settings`, `dev_otp_inbox`, `event_rsvps`, `events`, `news`, `polls`, `poll_options`, `poll_votes`, `regions`, `cities`; the views `admin_members`, `admin_delegate_queue`, `admin_payments`, `admin_audit`, `admin_settings`, `admin_polls`, `admin_poll_options`, `admin_events`, `admin_finance_stats`, `admin_region_stats`, `public_delegates`, `public_stats`, `member_polls`, `member_poll_options`, `member_event_going_counts`, `poll_option_counts`, `transparency_stats`, `transparency_regions`; the functions `register`, `cabinet_state`, `become_member_save_profile`, `become_member_complete`, `request_delegacy`, `delegate_team`, `delegate_team_rsvps`, `delegate_panel`, `member_cast_vote`, `member_rsvp`, `member_change_delegate`, `has_admin_role`, `has_any_admin_role`, `is_registered`, `is_completed_member`, `admin_export_members`, `admin_reveal_personal_id`, `admin_reveal_applicant_personal_id`, `admin_record_payment`, `admin_record_payments_bulk`, `admin_void_payment`, `admin_grant_role`, `admin_revoke_role`, `admin_update_setting`, `admin_approve_delegate`, `admin_publish_news`, `admin_save_news`, `admin_save_event`, `admin_publish_event`, `admin_cancel_event`, `admin_close_poll`, `recompute_all_active`, `active_sweep`, `send_sms_hook`, `audit_log_immutable`, `protect_profile_columns`, `enforce_delegate_completed`, `set_updated_at`, `gen_funnel_code`; the trigger `audit_log_no_update`, `delegates_require_completed`; the endpoint `GET /api/dev/otp`; the buckets `delegate-photos`, `news-images`) appears in the manifest under that name.
- **No threat is stated as a technique without naming the asset.** Each entry states the asset before the route; no entry is named after a class of attack.
- **All sixteen tables appear.** §4 maps each to at least one threat; none is listed as exempt, with the reason given for the two that came closest.
