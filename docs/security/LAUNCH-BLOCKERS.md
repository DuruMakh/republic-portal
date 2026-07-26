# Launch blockers — MUST be closed before real people register

**Owner decision 2026-07-26:** the findings below are **deliberately deferred**, not dismissed.
They are safe to leave open only while the platform holds synthetic data. The owner asked to be
reminded of them **before the site goes live to real members**.

Nothing in this file may be quietly dropped. If a phase closes without addressing an item here,
it stays here.

---

## LB-1 — Personal-ID squatting (F13) — the one the owner deferred by name

Anyone holding a manufactured account can register using **another real person's 11-digit
government ID number**, under a name of their choosing.

- Registration validates the ID by **shape only** (`p_personal_id !~ '^\d{11}$'`,
  `20260722140000_r2_review_fixes.sql:56`). No checksum, no proof of ownership, no registry
  check. `register()` writes **no `audit_log` row** — the act is silent.
- The real person can then **never join**: they receive `duplicate_personal_id`, rendered to them
  as `ეს პირადი ნომერი უკვე რეგისტრირებულია.` (`lib/funnel.ts:107`) — i.e. *you already
  registered*.
- **It is irreversible through the product.** Verified: the only `set personal_id =` sits in
  `funnel_save_profile`, which was dropped (`20260721120000_progressive_registration.sql:89`);
  the only `delete from profiles` statements are one-time migration cleanup (`:12`, `:21`);
  `profiles` has exactly two policies — `own profile readable` (SELECT) and
  `own profile updatable` (UPDATE) — and **no DELETE policy**; the `authenticated` UPDATE column
  grant excludes `personal_id`, which `protect_profile_columns` also guards; and none of the 34
  app-called RPCs deletes a profile or edits a personal ID. Only the service-role key can undo
  it, i.e. hand-editing production — which `CLAUDE.md` forbids.
- **Sharp end:** if the squatter then calls `request_delegacy()`, the victim's real government ID
  moves into the **verifier-reachable** `admin_reveal_applicant_personal_id`
  (`20260717150000_admin_crm.sql:728` scopes on *a delegates row exists*, any status). A verifier
  is then shown a real citizen's ID under a false name, and `audit_log` records the reveal as
  fact. `admin_export_members(include_ids:true)` carries it into the roster CSV.

**Why it is safe to defer today:** production points at the staging database, whose people are
synthetic. **Why it cannot ship:** for a movement facing a hostile state this is a
fabricated-evidence primitive, not merely blocked enrolment.

**Note the dependency:** closing the dev-OTP door does **not** fix this. Account manufacture also
runs through email signup (LB-3), which survives that change.

---

## LB-2 — The dev OTP endpoint is an anonymous membership oracle (F1/F2)

Live on the public production URL, because `NEXT_PUBLIC_APP_ENV` is `preview` there
(set deliberately 2026-07-20 for owner testing).

- **Existence oracle, two independent channels:** the two 404 bodies differ (`"not found"` vs
  `"no otp"`), *and* the branches differ in latency by ~6 seconds (measured on production:
  1.0 s vs 7.1–7.4 s). Unifying the bodies alone does **not** close it.
- **Worse than an oracle (F2):** for any number with **no** profile, the endpoint serves a
  **usable login code** to an anonymous caller → real session for a phone they do not control →
  `register()` → `become_member_complete()` (no payment, no admin) → an account that can RSVP and
  vote. Existing members are protected; this manufactures **new** accounts.
- A code fix exists on the audit branch (`87344e6`) but is **not deployed** — it ships at merge.

---

## LB-3 — Email sign-up is enabled and auto-confirmed (F3)

Live `/auth/v1/settings`: `external.email: true`, `disable_signup: false`,
`mailer_autoconfirm: true`, no captcha — while `phone_autoconfirm: false`. So phone identity is
gated by OTP and email identity is not gated at all. `register()` has **no null-phone guard**, so
a manufactured email account reaches `profile_completed` and can vote **without ever proving a
Georgian phone number**.

The platform's core Sybil assumption — *one SMS-verified phone, one person* — is not enforced at
the membership boundary. Live `users_with_email = 0`: the door has never been used, but it is open.

**Recommended:** disable the email provider (the app never uses it) **and** add a null-phone guard
to `register()`. Either alone leaves the other open.

---

## LB-4 — Sessions never end (F4)

`signOut({ scope: "local" })` in `components/CabinetNav.tsx:18` and `components/AdminNav.tsx:15`
clears the browser only; the refresh token stays valid server-side. `[auth.sessions]` has both
`timebox` and `inactivity_timeout` commented out, with rotation enabled — so the token renews
indefinitely. There is no forced logout, no inactivity cap and no admin revoke surface. **An admin
who logs out on a shared or seized device is not actually signed out.**

Caveat to confirm against the hosted project: `config.toml` is the local file; the dashboard could
carry a timebox the settings endpoint does not expose.

---

## Also carried (lower, but do not lose)

- **LB-5 (F5)** — 11 views grant `anon` INSERT/UPDATE/DELETE/TRUNCATE. Refused today only by
  PostgreSQL's auto-updatability **shape** rule (error `55000` = *the security check passed*), not
  by a security check. `admin_settings` and `admin_admins` are each one real table plus a cosmetic
  display join; removing that join — a routine refactor — would let anonymous writes reach
  `app_settings` / `admin_roles` past RLS. Fix is cheap and behaviour-free:
  `revoke insert, update, delete, truncate on all views in schema public from anon, authenticated`.
- **LB-6 (CF4)** — `anon` holds column SELECT on **all 17** `profiles` columns including
  `personal_id`, `birth_date`, `phone`; `authenticated` holds only 14 (not `personal_id`,
  not `birth_date`). For the most sensitive read on the platform, the sole barrier for `anon` is
  the RLS predicate `auth.uid() = id`, inert only because anon's uid is null — **one layer deep**,
  where `authenticated` gets two. Revoke those anon column grants.
- **LB-7 (F14)** — `request_delegacy()` permanently voids `admin_reassign_member` over the caller,
  un-audited and irreversible (`20260717150000_admin_crm.sql:666` refuses **any** delegates row of
  **any** status; nothing ever deletes from `delegates`). An earlier fix narrowed the mirror guard
  in `member_change_delegate` to `status = 'approved'` and did not narrow this one. **6 of 19
  delegate rows are already in this state**, reached accidentally.
