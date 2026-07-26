# Security check-up v0.10.0 — findings and disproofs

Produced by Task 10 (Pass 4, live proof). Consolidates every verdict the phase reached.

**The rule this file is built on:** nothing is listed as a finding until it has been reproduced
against a running system, and nothing is listed as dismissed until its disproof is recorded.
Section 3 (the disproofs) is a deliverable in its own right, not an appendix — three of the
readings that died there were confidently argued from source first.

**Severity scale** (spec §4):

| | |
|---|---|
| **Critical** | an actor with no account obtains data or powers it should not have |
| **High** | an ordinary account holder crosses a boundary |
| **Medium** | unusual precondition, or contained damage |
| **Low** | a missing guard with no route to harm today |

**Two standing method rules, both earned the hard way:**

1. *A permitted statement affecting zero rows is not a hole.* The grant let the statement run;
   the row rule returned nothing. Several entries below say "permitted, 0 rows" and are
   deliberately **not** findings.
2. *Grade against the live object, never the migration that first mentions it.* Views get
   re-created; grants get revoked from one role and not another.

**Impact honesty, applies to every entry:** the production URL currently points at the STAGING
database, which holds ~1,900 synthetic seeded people. Real-world harm **today** is near zero for
every finding here. The severities describe harm **at launch, with real members**. Do not inflate
them and do not soft-pedal them.

---

## 1. Confirmed findings

### Critical

#### F1 — anonymous phone-number membership oracle at `GET /api/dev/otp`
*Threat R2/R6. Measured live on the public production URL, twice, 2026-07-26.*

`GET /api/dev/otp?phone=...` answers "does this number have an account?" to a caller with no
account, by two independent channels: a **different response body** (`{"error":"not found"}` vs
`{"error":"no otp"}`, both 404) and a **~6.1-6.4 second timing gap** (the no-profile branch runs a
10 x 500 ms inbox poll). Either channel alone is sufficient; unifying the bodies does not close
the timing one. Staging measurement agreed across 12 actors (gap 6,325 ms).

The endpoint is reachable in public because `NEXT_PUBLIC_APP_ENV` is set to `preview` on the
production deployment — set deliberately by the owner on 2026-07-20 to keep an on-screen
test-code box working.

**Status: fix committed (87344e6), NOT DEPLOYED.** That commit is on this audit branch only;
production deploys from `main`, which has never received it. Lens 4 re-measured the deployed
artifact and it still serves the pre-fix route — the string `"no otp"` does not exist anywhere in
the fixed source, so the wire itself proves pre-fix code is running. **"Fixed" here means fixed in
a file.** It must be re-probed against the deployed URL after merge.

The committed fix closes the **passive** channel only (both failure paths now walk the same poll
and return the same body; verified gaps of 14 ms, 69 ms and MINUS 71 ms across three runs — the
sign flips between runs, which a real channel cannot do). See F2 for what survives.

#### F2 — the same endpoint hands an anonymous caller a usable login code
*Threat R2/R7. Chain already proven by the repo's own code; deliberately not re-demonstrated.*

For any number with **no profile**, the 200 path returns a live 6-digit code to an unauthenticated
caller. Chain: trigger `signInWithOtp` for the target number -> anonymous `GET /api/dev/otp` -> 200
`{otp}` -> `verifyOtp` -> **a real session bound to a phone the attacker does not control** ->
`register()` -> `become_member_complete()` (self-service, no payment, no admin) -> the manufactured
account can RSVP and vote (`member_rsvp` gates only on `is_registered()`).

Existing members are protected — their codes are withheld — so this is manufacture of **new**
accounts, not takeover of existing ones.

**Evidence:** `scripts/security/actors.mjs` mints every one of this audit's twelve sessions by
exactly this route. That is the chain, executed, in the repository. No SMS was spent re-proving
it, per the task brief.

This is what remains of F1 after the committed fix: an **active** oracle rather than a passive one
(the attacker must first trigger a send, which is rate-limited to one per phone per 5 s and, in
production, sends a real SMS to the target — noisy and costly). The only complete fix is removing
the endpoint, which spec section 9 assigns to launch hardening.

#### F3 — email sign-up is enabled and auto-confirmed
*Threat R7. Read live from the hosted project's `/auth/v1/settings`.*

`"external":{"email":true,...}`, `"disable_signup":false`, `"mailer_autoconfirm":true`, no captcha
— while `"phone_autoconfirm":false`. So phone is gated by OTP and **email is not gated at all**.
An attacker registers email+password, is auto-confirmed with no mail delivery, and holds a session
with **no phone**. `register()` has no null-phone guard: it reads `auth.users.phone` (null) and
inserts the profile anyway. `profiles.phone` is nullable-unique and Postgres permits many NULLs.
`personal_id` is then the only real uniqueness constraint, and it is an attacker-chosen 11-digit
string. Then `become_member_complete` -> `profile_completed` -> RSVP and vote.

**The platform's core Sybil assumption — "one SMS-verified phone = one person" — is not enforced
at the membership boundary.** This survives removing the dev door, so launch hardening does not
close it.

Live `users_with_email = 0`: the door has never been used.

Recommended: disable the email provider (the app never uses it) **and** add a null-phone guard to
`register()`. Either alone leaves the other open.

#### F13 — personal-ID squatting
*Threat R1/R15. Load-bearing link independently verified. **Owner-deferred to launch** — see
`docs/security/LAUNCH-BLOCKERS.md`.*

Manufacture a session (F2 or F3, both free) -> call `register(first, last, <victim's 11-digit
government ID>, ref)` -> a profiles row now permanently owns that ID -> the real person can never
join. They are told the Georgian sentence meaning *you already registered*.

`register()` validates the ID by **shape only** (an 11-digit regex) — no checksum, no ownership
proof, no registry check — and writes **no** `audit_log` row.

Irreversibility verified across all 15 migrations and all 34 app-called RPCs: the only
`set personal_id =` is inside a function that was dropped; the only `delete from profiles` are
one-time migration cleanups that already ran; `profiles` has exactly two policies (SELECT and
UPDATE own row) and **no DELETE policy**; `authenticated`'s UPDATE column grant excludes
`personal_id` and `protect_profile_columns` guards it. Only the service-role key can undo it —
i.e. hand-editing production, which CLAUDE.md forbids.

**Sharp end:** step 3 optionally calls `request_delegacy()`, which moves the squatted ID from the
super_admin-only reveal into the **verifier-reachable** `admin_reveal_applicant_personal_id`
(it scopes on "a delegates row exists", any status). A verifier then sees the victim's real
government ID under the attacker's chosen name, and `audit_log` records the reveal **as fact**.
`admin_export_members(include_ids:true)` carries it into the roster CSV. For an opposition movement
facing a hostile state, that is a **fabricated-evidence primitive**, not merely a denial of
enrolment.

Harm lands on a **third party who has never touched the platform**, and is irreversible through
the product. Not fixed by closing the dev door.

*Out of scope for Pass 4 by owner decision; not re-proved here, and no ID was squatted.*

### High

#### DL-1 — `register()` is a government-ID membership oracle
*Threat R6 (and R1 retail). **Reproduced live 2026-07-26**, all three branches, zero residue.*

The claim was that `register()`'s error token separates "this ID already belongs to someone" from
"bad format" from success. It does. Reproduced inside a single aborted transaction, with the
privilege context PostgREST itself uses (`request.jwt.claims` + `set local role authenticated`),
using A2's identity (a session with no profile row):

| probe | result | profile written? |
|---|---|---|
| an ID that **is** registered | `P0001 duplicate_personal_id` | **no** (`a2_profile_after = false`) |
| a malformed ID | `P0001 invalid_personal_id` | no |
| an ID that is **not** registered | `created = true` | **yes** |
| any ID, called again on the same session | `created = false` | — |

The tokens reach the user unchanged. `lib/funnel.ts:107-108` maps them to **two different Georgian
sentences** — *"this personal ID is already registered"* vs *"personal ID must be 11 digits"* — and
`duplicate_personal_id`'s message is even exported as a named constant
(`DUPLICATE_PERSONAL_ID_MESSAGE`). So the oracle is not an API-level subtlety reachable only by
someone who knows PostgREST: **it is rendered on screen by the product's own public sign-up form.**
No tooling required.

**This corrects the threat model.** R6 currently records `register()` as "one query per session"
and lists that single-shot property among the things holding the threat today. **It does not
hold.** The duplicate check raises *before* the insert, so a **yes** answer costs nothing and
leaves the session intact — one session can probe an unbounded list of IDs and collect every
**yes** for free, unaudited. The session is only consumed when the answer is **no**, and that same
call permanently squats the probed ID (F13). Against a target list the attacker's position is
therefore: every member is confirmed silently and for free; the first non-member is both revealed
*and* locked out.

**Severity — High, raised from the Medium recorded in Pass 3.** Two things raise it: the answer is
free and repeatable rather than one-shot, and it is delivered by the public UI rather than by a raw
RPC. It is not Critical because the precondition is a session (the ordinary account-holder
position) and the attacker must already hold the target's exact 11-digit ID — the checksummed space
forecloses mass enumeration. The route from *no* account runs through F2/F3, which carry their own
Critical rating; it is not double-counted here.

Nothing is written to `audit_log` on this path. The movement would never know it had been asked.

#### F4 — logout does not log out server-side
*Threat R4. Read from source; hosted-config caveat below.*

`CabinetNav.tsx:18` and `AdminNav.tsx:15` both hard-code `signOut({scope:"local"})`, which clears
the browser and leaves the refresh token valid on the server. Combined with `[auth.sessions]`
`timebox` and `inactivity_timeout` **both commented out** in `config.toml` and rotation enabled,
that token renews indefinitely — no forced logout, no inactivity cap, and **no admin revocation
surface anywhere in the product**. An admin logging out on a shared or seized device is not
actually signed out.

**Caveat stated honestly:** `config.toml` is the local file. The hosted dashboard could set a
timebox that the settings endpoint does not expose. Confirm against the hosted project before
remediating.

### Medium

#### F14 — `request_delegacy()` permanently voids admin authority over your own membership
*Threat R15. Live-confirmed: 6 members are already un-reassignable today.*

`admin_reassign_member` refuses **any** member holding a `delegates` row of **any** status
(`admin_crm.sql:666`); `admin_reject_delegate` never deletes the row; and no statement anywhere
deletes from `delegates`. So one un-audited self-service click permanently removes an admin's
ability to reassign that member.

**The asymmetry is the finding.** Migration `20260722140000` fix #3 deliberately narrowed
`member_change_delegate`'s guard to `status='approved'`, but the mirror guard in
`admin_reassign_member` was not narrowed with it. A pending or rejected requester therefore keeps
unilateral control of their own delegate binding while the verifier loses theirs.

Live: 6 of 19 `delegates` rows are non-approved on completed members. In an R15 scenario each bound
member calling `request_delegacy()` once makes an inflated team un-unwindable by admins.

#### L3-1 — the finance dashboard's "MRR" is member-declared intent, not revenue
*Threat R14.*

`mrr_gel = sum(membership_tier)` over active members, and `member_change_tier` lets any active
member set their own tier in {5,10,20} with no payment and no admin. So the figure is inflatable up
to 4x per member. Bounded: it needs `active_member` standing, which needs a real payment. The
genuinely payment-derived figure `transparency_stats.total_gel = sum(amount_gel)` is separate and
sound. This is a truthfulness defect in one internal figure, **not an access breach**.

Fix: compute `mrr_gel` from `payments`, not from the self-declared tier.

### Low

*"Low" here means exactly what the scale says — a missing guard with no route to harm today. Each
of these was probed and each held. They are listed because the margin is thinner than it looks.*

#### F5 — 11 admin/public views carry INSERT/UPDATE/DELETE/TRUNCATE for `anon`, and the defence is accidental
*Threat R7/R9.*

`admin_admins, admin_audit, admin_delegate_queue, admin_finance_stats, admin_members,
admin_overview, admin_payments, admin_region_stats, admin_settings, public_delegates,
public_stats`.

**The error code is the whole finding.** Anonymous INSERT into `admin_roles` gives `42501` — *a
security check refused you*. Anonymous INSERT into `admin_admins` gives `55000` — *"Views that do
not select from a single table or view are not automatically updatable"*, i.e. **the security check
passed and the query planner refused on shape**. Every view is owned by `postgres` with
`security_invoker` unset and none has `WITH CHECK OPTION`, so an INSERT through an auto-updatable
one would not evaluate the view's `WHERE` and would execute as `postgres`, straight past the base
table's RLS.

`admin_settings` and `admin_admins` are each one real table plus a cosmetic display join for a
name. **Drop the join — a routine refactor no reviewer would question — and anonymous writes into
`app_settings` / `admin_roles` become live.**

Fix (cheap, no behaviour change): `revoke insert, update, delete, truncate on all views in schema
public from anon, authenticated`, and/or set `security_invoker = true`.

#### CF4 — `anon` holds column SELECT on all 17 `profiles` columns, including `personal_id` and `birth_date`
*Threat R1/R12. The highest-consequence single-layer dependency in the system.*

The Phase-3 profiles lockdown **revoked from `authenticated` only**. Live column grants confirm it:
`authenticated` holds SELECT on 14 columns (not `personal_id`, `birth_date`, `pending_delegate_id`)
and UPDATE on exactly five (`city_id, region_id, employment, first_name, last_name`) — while `anon`
still holds SELECT, INSERT, UPDATE, DELETE and TRUNCATE on **all seventeen**.

So for the crown-jewel read, the only barrier between an anonymous caller and every member's
government ID and date of birth is the RLS predicate `auth.uid() = id`, inert for `anon` only
because its uid is null. It holds live (200, `[]`). But that is **one predicate deep for `anon`,
against two layers for `authenticated`.**

`birth_date` is likewise not among the ten columns `protect_profile_columns` guards, so on the
write side it has the RLS predicate alone. Confirmed live from the other direction: an
`authenticated` caller attempting `birth_date` gets `42501` — the column grant stops it first.

Not a breach — nothing left the database, and reaching a non-null `auth.uid()` as `anon` needs the
JWT secret. But it is **a defect in a hardening migration** (the revoke omitted a role), not an
accepted default. Fix: revoke the `anon` column grants on `personal_id`, `birth_date`, `phone`.

#### CF1 — the grant layer is wide open; RLS is the only thing holding — and it holds
*Threat R7/R8. **Settled live in Pass 4**, including the part earlier passes could not close.*

`anon` and/or `authenticated` hold the full privilege set (DELETE, INSERT, REFERENCES, SELECT,
TRIGGER, TRUNCATE, UPDATE) on most public tables — including `dev_otp_inbox`, `audit_log`,
`payments`, `memberships`, `app_settings`, `admin_roles`. This is Supabase's default posture, so it
is not automatically a defect. What makes it reportable is the **inconsistency**: this project's own
migrations *did* explicitly revoke SELECT where it cared (`delegates` has none for either role,
`profiles`/`payments` none for `authenticated`) — so grant-layer defence was clearly intended in
some places. `dev_otp_inbox`, the single most sensitive table in the system, has one layer where
`delegates` has two.

Pass 4 closed the two questions that were left open:

- **(a) Can any actor actually read `dev_otp_inbox`?** Earlier passes got "0 rows" — but from a
  table that might simply have been empty, which proves nothing. Re-run against a **populated**
  table: true row count **14**, RLS enabled, **zero policies**, and an `authenticated` caller sees
  **0 of 14**. RLS-with-no-policy is deny-all for non-owner roles, and it is demonstrably doing the
  work. Proven, not assumed.
- **(b) Is TRUNCATE reachable?** TRUNCATE is granted to `anon` and `authenticated` on
  `profiles, payments, memberships, audit_log, app_settings, admin_roles, dev_otp_inbox`, and
  **TRUNCATE is not subject to RLS**. But: PostgREST does not expose the verb (501, reproduced);
  **no function in schema `public` contains a TRUNCATE statement**; **no function contains dynamic
  SQL**; and the six SECURITY INVOKER functions are four trigger functions (unreachable, see RF6)
  plus `gen_funnel_code` and `tbilisi_today`, neither of which writes. **No route exists.**

CF1 therefore collapses from "possible hole" to a defence-in-depth observation: one layer is doing
all the work, and it is currently doing it correctly. **Do not report this to the owner as a
breach.**

#### L3-2 — `payments` rests on one layer where `audit_log` has two
*Threat R14.*

`payments` drives `active_member` status **and** every money figure, but is defended only by RLS
write-absence: no append-only trigger, no write policy, and wide default anon/authenticated
INSERT/UPDATE/DELETE/TRUNCATE grants (inert today — 0-row writes, same shape as RF2-RF5). Direct
`payments` writes emit **no** `audit_log` row; only the RPCs audit.

Positive: a forged payment row alone promotes no one — `status` is written only by `recompute_*`
(definer, revoked from clients) — so self-promotion via money needs two locks to fail.

Fix: add an append-only trigger to `payments` and revoke the wide write grants — the treatment the
Phase-5 community tables already got.

#### L3-3 — a member controls the divisor on their own payment's coverage
*Threat R14.*

Coverage months = `floor(amount / tier_at_recording)`, and the divisor is the member's own current
tier. Finance sets the amount but not the divisor, so a member can minimise the divisor to maximise
months. Largely by design (a self-selected monthly rate); flagged because finance cannot override
the tier at the moment of recording.

#### F15-R — region/city is self-assignable by direct PATCH (the residue of a refuted finding)
*Threat R15/R22. See section 3 for why F15 itself is refuted.*

The mismatched-pair attack is impossible (a composite FK blocks it). What *is* possible, and was
reproduced live: a completed member can `PATCH` their own `region_id`/`city_id` to any **coherent**
pair (`rows=1`, verified), or null out one side and keep the other (`region=2, city=null` ->
`rows=1`; `region=null, city=1` -> `rows=1`, because the composite FK is MATCH SIMPLE and is not
enforced when either column is null). All of it is unvalidated by the funnel and unaudited, and
`admin_region_stats.member_count` joins on `p.region_id`, so a member chooses which region counts
them — or, by nulling `region_id`, drops out of every regional count.

No boundary is crossed (own row, own declared location, admin-only view, nothing downstream grants
power by region), which is why this is Low and not a finding in its own right.

---

## 2. Pass 4 live-proof register — the 134 unresolved cells

Task 7 left the 1,824-cell matrix at **1,690 clear / 134 needs-live-proof / 0 findings**. Every one
of the 134 now has a verdict. None became a finding.

| # | group | disposition |
|---|---|---|
| 48 | `PGRST202` on the 4 trigger functions (`audit_log_immutable`, `set_updated_at`, `enforce_delegate_completed`, `protect_profile_columns`) x 12 actors | **Clear.** Reproduced 8/8 as both `anon` and `authenticated`: `0A000 trigger functions can only be called as triggers`. The census's PGRST202 was a statement about PostgREST's schema cache — a probe artefact. The real defence is the type system (see RF6). |
| 58 | `APP-GENERIC` — 28 anonymous cells across 28 server actions, plus 30 non-admin cells on `approveDelegateAction`, `publishEventAction`, `publishNewsAction` | **Clear.** Every one carries a per-cell paired assertion (58/58, 0 missing, 0 failing): `probe-is-valid` proves at least one *allowed* actor got a non-generic result, so the arguments and encoding are right and the generic error is a real refusal; `denied-actor-changes-nothing` proves the target row is byte-identical before and after. |
| 14 | `P0001 not_completed`, deny expectation, on `member_cast_vote`, `member_change_delegate`, `member_change_tier`, `member_rsvp` and their action envelopes (A2/A3) | **Clear.** Read from live `prosrc`: in all four bodies `not_completed` is raised as the caller-standing gate, immediately after the auth gate and before any effect. Deny + refusal token = clear. The token stays globally unclassified because it *also* appears post-gate in `admin_grant_role`, `admin_record_payment` and `admin_record_payments_bulk` (where it describes the *target*, not the caller) — which is exactly why this had to be settled per cell. |
| 4 | `P0001 profile_incomplete`, A2, on `become_member_complete` / `become_member_save_profile` and their envelopes | **Expectation corrected `allow` -> `deny`; cell clear.** See F11 in section 4. |
| 2 | `P0001 profile_incomplete`, A3, on `become_member_complete` and `completeMembershipAction` | **Clear.** A3 has a profiles row (live: `status=registered`, all four funnel fields null), so it passes gate 2 and is refused by the **post-gate** field check. Allow + post-gate = the gate admitted them = clear. |
| 8 | `SKIP-MUTATING` — `request_delegacy` and `requestDelegacyAction` for A9-A12 | **Clear by equivalence; deliberately not executed.** A9-A12 are the four canonical staging admins the audit must not mutate, and this RPC writes on the caller. Settled instead from live inputs: the function's only gates are auth, `registration_completed_at is not null`, and `not exists (delegates row)`. Live state of A9-A12: `completed=true`, `delegates_row=none` — identical on all three inputs to **A4**, whose live execution of both the RPC and the envelope returned `rc=1`, no error. The allow path is proven on a standing-identical actor. *This is the one group settled by equivalence rather than by execution, and it is recorded as such.* |

**Cells remaining unresolved: 0.** The verdict *string* in `ledger.json` still reads
`needs-live-proof` for these rows, because `judge()` is given no `surfaceId` and so cannot classify
a position-dependent token globally (root cause F7/F9). That is a property of the instrument, not
an open question about the platform.

---

## 3. Recorded disproofs

*Spec section 3 makes these deliverables. Do not re-raise them.*

#### F15 — REFUTED. Region/city pairing **is** validated outside the funnel.
*The claim died under live testing. It was argued from grants, policy and trigger, all read
correctly — and it missed a constraint.*

The claim: `authenticated` holds UPDATE on `region_id`/`city_id`, the own-profile UPDATE policy
permits it, and `protect_profile_columns` guards neither — so a direct PATCH with a **mismatched**
pair should succeed, unvalidated and unaudited.

Every premise is true. Confirmed live: `authenticated`'s UPDATE column grant is exactly
`city_id, region_id, employment, first_name, last_name`; the policy `own profile updatable` is
`cmd=w, roles=PUBLIC, USING (auth.uid() = id)` with no separate WITH CHECK; and
`protect_profile_columns`'s guarded set is `status, personal_id, phone, id, created_at,
signup_ref_code, membership_tier, reference_code, registration_completed_at, pending_delegate_id`
— region and city appear nowhere in it.

**The conclusion is still wrong.** Probed as A5 (`active_member`, live pair region 1 / city 1)
against city 2, which really belongs to region 2:

```
F15_WRITE   23503 / insert or update on table "profiles"
                    violates foreign key constraint "profiles_city_in_region"
F15_AFTER   profile still 1/1
F15_RESTORE rows=1   (a VALID pair writes fine, so grant and policy are exactly as claimed)
```

`profiles_city_in_region :: FOREIGN KEY (city_id, region_id) REFERENCES cities(id, region_id)` —
a **composite** foreign key, invisible to a reading that looks at column grants, policies and
triggers. There is a fourth enforcement layer, and it is the one that bites.

Controls run in the same transaction, to show the probe could have detected a hole:
`CTRL1_other_row rows=0` (RLS blocks writing another member's row) and
`CTRL2_status 42501 / permission denied for table profiles` (the column grant blocks a protected
column before the trigger is even reached).

Live `region_city_mismatch` was 0 before and 0 after. Residual noted as **F15-R** above.

#### RF6 — CF3 disproved, more strongly than expected
Four trigger functions carry EXECUTE for PUBLIC **plus explicit `anon` and `authenticated`
grants**. They are unreachable not because PostgREST filters them, but because **Postgres itself
refuses**: `select public.set_updated_at()` as the `postgres` superuser returns *"trigger functions
can only be called as triggers"*. The backstop is the type system, not the gateway. Confirmed on
all four, by two people.

Remediation correction Task 12 must not inherit: live `proacl` is
`...|anon=X/postgres|authenticated=X/postgres|...` — EXECUTE is granted **explicitly**, not merely
inherited from the PUBLIC default, so `revoke ... from public` would leave both roles holding it.
Needs `revoke ... from public, anon, authenticated`. Hygiene only.

#### RF1 — the admin views are **not** anonymously readable
The SELECT grant to `anon` on the 13 `admin_` views is real, but the view **bodies** call
`has_any_admin_role()`, and `anon` holds no EXECUTE on that function — so the read dies inside the
view. Independent live anon reads of `admin_members`, `admin_payments`, `admin_audit`,
`admin_overview`: `rows=0, code=42501, "permission denied for function has_any_admin_role"`. That
is a genuine second layer. **R1 is not Critical by this route**, and CF1's "grant layer is wide
open" story does not extend to the admin views.

#### RF2-RF5 — the escalation routes reasoned from grants alone, all refuted live
Tested 2026-07-25 with freshly minted sessions:

- **RF2** `admin_roles` INSERT `{role:'super_admin'}` as A3 and A5 gives **denied**, `42501` *"new
  row violates row-level security policy"*. Count 4 to 4. No privilege-escalation route.
- **RF3** `app_settings` UPDATE `active_grace_days=0` as A3/A5/anon gives a statement that is
  **permitted** but affects **0 rows**; value verified 30 before and 30 after. Unchanged.
- **RF4** `audit_log` as anon, member and super_admin: SELECT/UPDATE/DELETE all permitted as
  statements, all **0 rows**; INSERT is **denied** `42501`. Row count 1,468 to 1,468 across every
  attempt. **The append-only audit log holds.** Re-confirmed in Pass 4 from a member session:
  `C4_audit_insert 42501 / new row violates row-level security policy for table "audit_log"`,
  `C4_audit_update rows=0`.
- **RF5** `dev_otp_inbox` SELECT as A3/A5 is permitted, 0 rows. **Re-proved properly in Pass 4
  against 14 live rows** — see CF1(a).

#### RF7 — the audit-log invariant holds, 48/48
Every completed `admin_*` call left a correctly attributed `audit_log` row. **Caveat:** the
assertion matches on `(action, actor_id)` only, so for the
`admin_record_payment` / `admin_record_payments_bulk` pair it could not have detected a failure —
both write `payment.record`. The invariant is true in fact; the *check* was weaker than it looked.

#### RF8 — no server action reaches the service-role client without re-checking the caller
Exactly two actions touch `createAdminClient`, and both re-check first, in the right order:
`updateDelegateProfileAction` (zod, then `getAdminRoles()`, then `hasAnyRole(["verifier",
"super_admin"])` at lines 25-28, and `createAdminClient()` only at line 51) and `setNewsCoverAction`
(parse, then the role check at lines 114-117, then `createAdminClient()` at line 137).
`updateDelegateProfileAction` also refuses a non-approved target *before* uploading, so a rejected
delegate can never park a file in the public bucket — a deliberate ordering choice, correctly made.

Confirmed (not refuted) in the same read: upload type is taken from the **client-declared MIME**,
never sniffed from bytes; there is a 5 MB per-file cap but no per-actor quota. Because the echoed
`Content-Type` stays `image/*`, a browser will not execute the bytes — so this is hosting abuse of
a public URL by an already-trusted editor/verifier, **not stored XSS**. Rate it accordingly.

#### C4 — the two "strongest controls that can never auto-clear", settled by hand
Both raise full sentences rather than tokens, so the census can never grade them automatically.
Reproduced live from an `authenticated` session (A5):

- `protect_profile_columns` **fires**: `C4_trigger_blank_name P0001 / invalid_name` and
  `C4_trigger_long_employment P0001 / invalid_employment`.
- Its *server-managed columns* branch is **unreachable for `authenticated`** — not because it
  fails, but because the column grant forecloses first: `C4_personal_id 42501 / permission denied
  for table profiles`. The trigger is the second layer there, and it is the **only** layer for
  `anon`, which holds UPDATE on all 17 columns (CF4).
- `audit_log is append-only`: RLS refuses the INSERT before the trigger is reached (`42501`), so
  that sentence likewise never fires. The control holds; the layer above it is what proves it.

#### Cleared by Pass 3 and not re-walked
OTP brute force (30 verifications / 5 min / IP + 1 h expiry, Supabase-enforced); cross-phone and
consumed-code reuse; `verifyOtp` type confusion; role revocation vs stale JWT (no role claim in the
JWT). Privilege escalation — **no route exists**; every privileged bit has exactly one correctly
gated writer. Supporter counts and poll integrity (double-vote blocked by a PK unique violation;
votes are insert-only with no grant and no policy, so `poll_votes` is better defended than
`payments`). Membership close-then-open races; delegate lifecycle orphan edges (approval is
terminal); payment void/re-record double counting; referral binding reuse; time arbitrage around
the nightly sweep. Data leakage through rows and columns: zero of the 24 views carry
`personal_id`/`birth_date`/`employment`; `phone` appears only in 3 admin-gated views; vote and RSVP
secrecy hold; delegate team scoping is byte-correct; `audit_log.details` never logs raw
`personal_id`/`phone`/`birth_date`.

---

## 4. Findings about the audit itself

*These are defects in the instrument, not in the platform. They are listed separately and are not
counted in the severity tally.*

- **F11 — four cells whose stated expectation contradicted the live body. Corrected in this pass.**
  `become_member_complete` and `become_member_save_profile` (and their two action envelopes) were
  recorded as *"Gate: not_authenticated only"* for A2. Both live bodies run a **second**
  caller-standing gate immediately after the auth gate —
  `select * into v_profile from public.profiles where id = v_uid; if not found then raise exception
  'profile_incomplete';` — and A2 (session, no profiles row; verified live) is refused by it. A2's
  expectation is now `deny` in all four entries, citing gate 2.
  **Why this mattered more than four rows:** `profile_incomplete` is deliberately unclassified, and
  classifying it as a post-gate token — the natural next cleanup — would have minted **four false
  over-restriction findings** against correct, spec'd behaviour. Live `prosrc` shows the token
  appears **twice** in `become_member_complete` (gate 2, and the post-gate field check) and **once**
  in `become_member_save_profile`, so its meaning is position-dependent and it must stay
  unclassified. A3 keeps `allow` and is correct.
- **F6 — a route handler was never in the manifest.** `GET /admin/members/export` streams the whole
  roster and, with `?includeIds=1`, personal ID numbers. The app layer was built from `"use server"`
  exports plus a hand-listed endpoint set of size **one**, so the second route handler was never
  seen. **The endpoint itself is sound** — verified by reading it and live against production:
  anonymous GET gives 403, and `?includeIds=1` gives 403; three layers (route role check, a separate
  super_admin gate for `includeIds`, then `admin_export_members` re-checks in the DB). So this is a
  hole in the **coverage claim**, not in the platform. Enumerate route handlers from the filesystem,
  never by hand. Coverage total should go 152 to 153 surfaces (1,824 to 1,836 cells).
- **F7 — the gate-order guard is near-vacuous.** Its anchor resolves to `not_authenticated` in 38 of
  40 functions, so it only proves post-gate tokens follow the *auth* check — trivially true — and
  proves nothing about the role/standing gate, which is what `judge()` actually relies on. The
  invariant holds today (measured across all 54 live bodies); the guard would not notice if it
  stopped.
- **F8 — no row-scope assertion covers FUNCTION read surfaces.** `judge()` returns clear the instant
  `errorCode` is null and never consults `rowCount` on the allow side. If `delegate_team()` lost its
  `where m.delegate_id = v_uid`, A7's cell would return the entire membership and still grade CLEAR.
  Correct today (hand-verified live); unasserted.
- **F9 — `ruleDerived` is `false` in all 1,824 cells,** so it distinguishes nothing. The only
  surviving provenance is free-text notes — and F11 proves at least one note was contradicted by the
  live body.
- **F10 — `publicColumnAssertions` is a denylist over returned rows,** so a view returning zero rows
  passes vacuously and any sensitive column outside the ten hardcoded names passes silently. Not
  biting today. Fix: make it an allowlist.
- **F12 — monitoring.** PostgREST exposes `public, graphql_public`. `pg_graphql` is disabled so
  `/graphql/v1` is inert — but enabling it is a one-click dashboard toggle, no migration and no code
  review, and would add a second query **and mutation** interface over the same tables, fully
  unmodelled.
- **CF2 — `verify-schema.mjs`'s `dev_otp_inbox` check is weaker than its own log line claims.** It
  only fails if rows come back; the line *"OK: anon dev_otp_inbox query permission-denied (42501)"*
  is printed solely in the error branch, which never fires. A grant-layer regression on that table
  would pass the existing probe silently.

---

## 5. By-design observations for the owner

Neither is an escalation; both are governance choices worth a decision.

- **O1 (R18)** — a rejected delegate has no self-restore route, but a **single** verifier can
  re-approve a rejected row with no second signature and no cooldown.
- **O2** — a verifier can `request_delegacy()` on themselves and then
  `admin_approve_delegate(self)`, self-appointing as a public approved delegate and skipping peer
  review. The verifier already holds the approve power, so no role boundary is crossed — it is the
  same single-hand property as O1.

**Resilience note.** `admin_roles` and `delegates` are sealed by the **absence** of a write policy,
not by a deny rule. A future migration adding a permissive write policy — or F5's conversion of an
anon-writable admin view to auto-updatable shape — would open a self-grant door that no current test
names. One layer doing all the work, consistently with threat-model section 5.3.

---

## 6. Pass 4 method and residue

**Method.** Every write probe ran inside a single `do $$ ... $$` statement ending in
`raise exception 'AUDIT-RESULT >> ...'`. The raise carries the measurements out in the error message
**and aborts the statement**, so the experiment is rolled back by Postgres itself rather than by a
teardown that could fail. Privilege context was reproduced the way PostgREST reproduces it —
`set_config('request.jwt.claims', ...)` then `set local role authenticated` — so column grants, RLS
and BEFORE-UPDATE triggers all applied exactly as they do on a real request. Two controls in every
run (`CTRL1_other_row`, `CTRL2_status`) confirmed the harness could still detect a refusal.

**What this method does not cover:** the HTTP layer. It reproduces the database's answer, not
PostgREST's framing of it. That is acceptable here because every surface probed was already shown
reachable over HTTP by the census (`function:register` A2 executed live through PostgREST; the
`profiles` PATCH path uses the same `authenticated` role PostgREST assumes). It is recorded as a
limitation rather than glossed.

**Residue: none.** Verified after the fact, as `postgres`, in a separate statement: A5's row is back
at its original `region_id`/`city_id` = 1/1; A2 still has no profiles row; no profiles row holds
either synthetic probe ID (`99900000011`, `99900000012`); zero rows carry the probe name
`SECAUDIT Pass4`; and the platform-wide region/city mismatch count is 0. Recorded as a run entry in
`docs/security/residue.json`.

**SMS sends spent: 0.** No session was re-minted. Every probe ran either as read-only SQL, as source
analysis against live `pg_get_functiondef` output, or through the role-simulated aborted transaction
above.

**Actors touched:** A5 and A2 only, both audit-tagged fixtures, both inside aborted transactions.
A9-A12 (the canonical staging admins) and every seeded roster row were left untouched, as required.
