# Design Spec — Phase 6: Progressive Registration

**Date:** 2026-07-21
**Status:** brainstormed with owner (2026-07-20/21), approved section-by-section in chat;
this document is the written record for owner review before planning.
**Parent spec:** docs/superpowers/specs/2026-07-12-republic-portal-production-design.md —
this spec supersedes its §6 "Registration funnel" description and inserts a new Phase 6
into the §9 roadmap (the launch checklist becomes Phase 7).

## 1. Context and goal

Today the front door forces the biggest decision first: a visitor must choose "member or
delegate" before knowing the movement, then surrender name, surname, phone + OTP,
personal ID, birth date, region, city, employment, and a fee tier before they are "in".
There is also no path from member to delegate after registration — the choice is final
unless an admin intervenes.

The rework inverts the funnel into progressive escalation:

1. **Registration** (the only public entry): first name, surname, personal ID, mobile +
   OTP. Under a minute. No role choice, no payment talk. The person lands in a cabinet.
2. **Become a member** — an in-cabinet journey that collects the rest (birth date,
   region, city, employment, delegate choice, fee tier + bank reference code).
3. **Request delegacy** — a member-only, one-confirm request feeding the existing admin
   verification queue. No new data is collected (verified: today's delegate variant only
   adds T&C acceptance; bio/photo already arrive post-approval in the cabinet).

Timing: pre-launch (no real users), so this is a code rework, not a live migration.

## 2. Decisions locked in brainstorming (owner, 2026-07-20/21)

| # | Decision |
|---|----------|
| D1 | Backing a delegate stays a **member** privilege. Registered users cannot choose a delegate; a referral link is silently remembered and prefilled at member upgrade (overridable). Leaderboard semantics unchanged (active paying supporters). |
| D2 | The light registration **does collect personal ID** — the registered list stays a verifiable list of real citizens (one person = one registration guaranteed by ID, not SIM). |
| D3 | Registered cabinet = **mobilization package**: events + RSVP, public news, own profile, and a prominent become-a-member journey. Polls, member-only news, delegate backing, and billing stay member-gated. |
| D4 | The public delegate pitch is **retired**: homepage "გახდი დელეგატი" CTA and the member-vs-delegate choice screen disappear; delegacy is discovered inside the member cabinet. No intent-tracking landing page. |
| D5 | Public counters show **both** numbers, clearly labeled: registered (breadth) and active members (commitment). Both derived live, never stored. |
| D6 | Delivery in **two releases**: Release 1 "the new front door" (v0.7.0), Release 2 "the ladder and the numbers" (v0.8.0). Each with its own preview, QA evidence, and owner sign-off. |
| D7 | After a rejected delegacy request, a fresh request requires an **admin decision** — no self-service retry in v1. |

## 3. Terminology and standings

One person = one `profiles` row, always. Standing escalates:

- **registered** (რეგისტრირებული) — completed the light registration. New base standing.
- **member** (წევრი) — completed the become-a-member journey. DB meaning unchanged:
  `registration_completed_at is not null` (`is_completed_member()` stays the single
  member gate).
- **active member** (აქტიური წევრი) — unchanged: `status = 'active_member'`, written
  only by the ADR-015 payment engine.
- **delegate** (დელეგატი) — unchanged: a `delegates` row on top of a member profile,
  `pending → approved/rejected` via the existing verification queue.

"Supporter" (მხარდამჭერი) keeps its existing product meaning — a member backing a
delegate — and is deliberately NOT the name of the new base standing (naming collision
avoided; the light tier is publicly just "registration").

`member_status` enum: `draft` is renamed to `registered` (semantics change from
"half-finished registration" to "completed light registration" — see migration, §7).
`profile_completed` keeps its name and its meaning tightens: it is now set at wizard
**completion** (together with `registration_completed_at`), not at profile-save.

## 4. Release 1 — the new front door (v0.7.0)

### 4.1 Registration flow

- `/join` becomes a single page: four fields (first name, surname, personal ID, mobile)
  → OTP → straight into the cabinet (`/me`). No done/pending ceremony pages.
- Routes deleted: the choice screen (`JoinChoice`), `step-1`, `step-2`, `step-3`,
  `done`, `pending`, and the `?role=delegate` deep link (redirects to `/join`).
  `/join/terms` (delegate T&C) moves under the member cabinet in Release 2.
- Homepage: the delegate CTA is replaced by a single registration CTA (D4).
- Referral links (`?ref=CODE`) land on `/join`; the code is stored on the profile at
  registration (existing `signup_ref_code` column) for prefill at upgrade (D1).
- Duplicate phone: the OTP step signs the person into their existing account — no
  duplicate profile is possible (phone is unique; auth user is the same).
- Duplicate personal ID: Georgian error on the form, correctable in place. The auth
  user may exist without a profile at that moment; the register RPC is retryable.

### 4.2 Registered cabinet

- Nav for registered standing: მთავარი (overview: welcome + become-a-member hero card
  stating what membership unlocks — voting, backing a delegate, member news, from
  5₾/month), ღონისძიებები (browse + RSVP), სიახლეები (public news only), პროფილი.
- Profile page: first/last name editable (existing scoped grant); phone and personal ID
  display-only (server-managed, unchanged).
- Gate widening (the only one): event RSVP and the going-counts become
  registered-level — `member_rsvp()` and `member_event_going_counts` switch from the
  completed-member check to a new `is_registered()` definer check (profile row exists).
  Polls, member news, my-delegate, billing: gates unchanged (member-only).

### 4.3 Become a member (in-cabinet journey)

- `/me/membership`, two steps, resumable:
  - **Step A** — birth date, region, city, employment + delegate picker (prefilled from
    the stored referral when that delegate is approved; default ცენტრალური მოძრაობა).
  - **Step B** — tier 5/10/20 ₾ → `GR-XXXXXX` reference code + bank instructions
    (today's step-3/done content, moved).
- Server truth (ADR-009 pattern, definer RPCs):
  - `become_member_save_profile(birth, region, city, employment, delegate_id?)` —
    validates as today's `funnel_save_profile`, stores fields + the chosen delegate in a
    new server-managed `profiles.pending_delegate_id`; status stays `registered`.
  - `become_member_complete(tier)` — re-validates the pending delegate (approved, else
    falls back to central), **creates the membership row here** (backing is a member
    privilege, D1 — creation moves out of profile-save), stamps
    `registration_completed_at`, flips status `registered → profile_completed`, mints
    the reference code. Idempotent like today's `funnel_complete`.
- Abandoning mid-journey loses nothing: standing stays registered, fields persist, the
  overview card resumes at the right step (derived server-side from cabinet state).
- On completion the full member nav unlocks instantly.

### 4.4 Explicitly accepted for Release 1

Between the releases there is no path to delegacy (invisible pre-launch). Existing
approved (seeded) delegates are untouched and stay public.

## 5. Release 2 — the ladder and the numbers (v0.8.0)

### 5.1 Delegacy request (members only)

- Member overview gains a "გახდი დელეგატი" card → `/me/delegacy`: the delegate terms
  (content moved from `/join/terms`) + one confirm.
- `request_delegacy()` RPC: requires member standing (`registration_completed_at`) and
  no existing `delegates` row; inserts `delegates` with `status = 'pending'`, a minted
  referral code, `tc_accepted_at = now()` — the same row today's funnel created, now
  always from a completed member (ADR-016's completeness guard holds by construction).
- Cabinet shows the state: pending ("request sent"), approved (delegate cabinet +
  public page unlock via existing routing), rejected (calm final state; re-request only
  via admin — D7).
- Admin verification queue, `admin_approve_delegate` / `admin_reject_delegate`, and
  their audit rows: unchanged.

### 5.2 Public numbers

- `public_stats` gains `registered_total` (count of all profiles). Homepage shows
  რეგისტრირებული and აქტიური წევრი side by side (plus delegates, as today);
  transparency page adds the registered total.
- Regional breakdowns stay member-based — registered people have no region (honest
  consequence of the minimal form; recorded, not worked around).

### 5.3 Admin

- `admin_members` view + members page: standing filter with **disjoint buckets** —
  all / registered-not-yet-member / member-not-active / active member — so each person
  appears in exactly one bucket and the buckets sum to the total. Registered rows carry
  exactly what we hold: name, phone, created_at, and the referral source delegate
  (resolved from `signup_ref_code`); personal IDs stay out of list views, reachable
  only via the existing audited reveal/export paths (ADR-014 unchanged).
- `admin_export_members`: same standing filter parameter.
- `admin_overview`: `registered_total` and conversion (members ÷ registered). Its
  `total_completed` and `admin_region_stats`' `status <> 'draft'` filters are updated
  to the new semantics (member = `registration_completed_at is not null`).
- No new audited admin mutations: registration and upgrade are self-service; delegate
  approve/reject already audit.

## 6. Data model and RPC surface (summary of changes)

- Enum: `alter type member_status rename value 'draft' to 'registered'`.
- `profiles`: drop `signup_role` (no role at signup; delegate intent = `delegates`
  row). Keep `signup_ref_code` (referral memory). Add `pending_delegate_id uuid null`
  (wizard step-A choice; server-managed; validated against approved delegates at
  completion time regardless).
- `protect_profile_columns()`: remove `signup_role`, add `pending_delegate_id`.
- RPCs replaced: `funnel_start` / `funnel_save_profile` / `funnel_complete` dropped;
  new `register(first, last, personal_id, ref?)`, `become_member_save_profile(...)`,
  `become_member_complete(tier)`, `request_delegacy()` (R2). `funnel_state()` is
  reshaped into `cabinet_state()`: standing, wizard progress, tier, reference code,
  delegate status, referral, chosen delegate, admin flag.
- New `is_registered()` definer check; `member_rsvp` + `member_event_going_counts`
  switch to it. All other member gates keep `is_completed_member()`.
- `lib/`: `funnel-schemas` → registration + membership schemas; `funnel.ts` step
  derivation → cabinet standing/wizard derivation; `cabinet.ts` `deriveDestination` and
  nav items gain the registered standing.
- Grants follow the existing pattern: RPCs to `authenticated` only; no new client
  table grants.

## 7. Migration (staging-only reality, pre-launch)

Order matters:

1. Delete `profiles` where `status = 'draft'` and `personal_id is null` — abandoned
   step-1 rows from the old funnel (drafts never have a personal ID: the old
   `funnel_save_profile` set ID and flipped status in one statement). Cascades:
   memberships (none exist for drafts by construction), payments (cascade per ADR-016
   note; drafts have none). Orphaned auth users simply re-register on next login.
2. Rename enum value `draft → registered`.
3. Normalize old mid-step-3 abandoners: `status = 'profile_completed'` with
   `registration_completed_at is null` → `status = 'registered'` (fields kept, open
   membership row from the old step-2 closed — backing is member-only under D1). They
   become exactly the new model's mid-wizard registered people and resume at the tier
   step.
4. Column and function changes per §6; recreate the touched views.
5. `scripts/verify-schema.mjs` probe updated for the new surface; `seed-staging.mjs`
   adds registered-standing rows (canonical admins untouched, ADR-014 rules hold).

Fully completed profiles map cleanly: `profile_completed` rows **with** the completion
stamp, `active_member` rows, and all `delegates` rows keep their meaning without data
changes.

## 8. Edge cases (handled deliberately)

- OTP passed but register fails (duplicate ID): auth user exists without a profile;
  `/join` keeps the form with the Georgian error; retry with corrected ID works.
- Same phone, second registration attempt → OTP login → `/me`. The freshly typed form
  fields are discarded — an existing profile is never overwritten by a registration
  form (the register RPC no-ops when a profile exists and returns state).
- Wizard abandoned after step A → still registered; resume anytime; RSVP etc. keep
  working meanwhile.
- Referral delegate unapproved/rejected by upgrade time → prefill silently skipped
  (existing rule: stored approved referral wins, else picker/central).
- `pending_delegate_id` pointing at a delegate who lost approval before completion →
  completion re-validates and falls back to central.
- A pending delegacy request never blocks member life (voting, RSVP, billing).
- Rejected delegacy: final in cabinet; admin can still approve later (queue unchanged).

## 9. Testing

- Unit (pure `lib/`): registration/membership schemas, standing + wizard-step
  derivation, nav gating, counter formatting.
- e2e Release 1: light registration happy path; duplicate phone → login; duplicate ID
  error + retry; registered nav shows no polls/billing/my-delegate; RSVP as registered;
  full become-a-member journey incl. referral prefill, mid-journey resume, and member
  unlock.
- e2e Release 2: request → pending → admin approve → delegate cabinet + public page;
  reject state; `public_stats` counters; admin standing filter + export + conversion.
- Schema probe updated alongside every DB change; CI green or no merge (unchanged).

## 10. Rollout and bookkeeping

- Release 1 = v0.7.0, Release 2 = v0.8.0; each runs the full ritual: plan → TDD →
  per-task + whole-branch review → /qa on preview → owner sign-off → merge.
- DECISIONS.md gains ADR-018 (this pivot + phase renumbering: launch checklist → Phase 7).
- ADR-006 (personal-ID encryption revisit) moves with the launch phase, now Phase 7.

## 11. Out of scope (recorded future ideas)

- Delegate-facing referral funnel stats ("N registered via your link, M became members").
- Self-service re-request after delegacy rejection.
- Regional data for registered people (would require asking region at registration).
- Any change to payment tiers, the payment engine, or the leaderboard formula.
- Direct registered → delegate path (delegacy remains member-gated).
