# Design Spec — Phase 2: Registration Funnel

**Date:** 2026-07-15
**Status:** Approved in brainstorming (owner approved all 4 sections + 3 scoping decisions).
**Parent spec:** `2026-07-12-republic-portal-production-design.md` (binding platform spec; this
document details its "Phase 2 — Registration" row and §6 "Registration funnel").
**UX contract:** `prototype/index.html`, screens `join`, `join-step-1`, `join-step-2`,
`join-step-3`, `join-pending` (markup lines ~393–610, logic ~1361–1405 and ~1524–1708).
Copy, layout and behavior carry over unless stated otherwise. **Known deviations from the
prototype, all owner-approved:** step 3 replaces the card-payment modal + recurring checkbox
with manual bank-transfer instructions (per parent spec §6); the OTP code is 6 digits
(Supabase's actual length), not 4; the duplicate-phone message appears **after** OTP
verification, not before (anti-enumeration, §6 below); OTP entry is inline on step 1 rather
than the prototype's modal; the pending screen's „გადადი პანელზე" button is dropped until
Phase 3 ships the panel.

---

## 1. Goal

Replace the `/join` "opening soon" page in place with the real 3-step registration funnel,
member + delegate variants: contact + staged OTP with server-side resumable drafts, legal
profile with duplicate checks and delegate binding, membership tier + manual bank-transfer
instructions with a unique per-member reference code. This phase also establishes the
platform-wide zod validation-at-every-boundary pattern and closes the Phase 0 "dev OTP
oracle" security gate.

## 2. Decisions locked in brainstorming (owner-approved)

| # | Decision | Choice |
|---|---|---|
| 1 | Bank details | Owner has no account yet. Ship with clearly-marked placeholder recipient details held in one module; swapping in real details is a config-level edit. "Real bank details set" joins the Phase 6 launch checklist |
| 2 | Reference-code format | Platform-issued random code `GR-XXXXXX` (6 chars, Crockford-style alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` — no I/L/O/0/1). Owner explicitly rejected personal-ID-as-reference after data-protection briefing |
| 3 | Post-registration state (until Phase 3 cabinets) | **Completion screen only**: funnel ends on a persistent completion screen (member: reference code + transfer instructions; delegate: pending screen). Logging in later returns there. `/me/profile` stays a stub |
| 4 | Delegate T&C | No legal text yet → placeholder terms page marked „სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას". Acceptance timestamp is real from day one. Final text = launch-checklist item |
| 5 | Mutation architecture | "Fortress database": every funnel save is one SECURITY DEFINER Postgres function (RPC) — atomic, rules enforced in-DB, thin zod-validated server actions in front. Alternatives (service-role TS orchestration; client-direct writes under RLS) rejected for non-atomicity / house-rule violations |
| 6 | Dev-OTP hardening (strict) | `/api/dev/otp` refuses phones whose profile has `registration_completed_at` set or status `active_member`. Accepted consequence: on staging/preview a *completed* account can only be revisited with its still-valid session (same device), not re-logged-in cross-device. Mid-funnel resume (draft/profile_completed, not completed) keeps working. Endpoint stays 404 outside dev/preview and is deleted entirely in Phase 6 |

## 3. Screens

All funnel pages live in `app/(public)/join/`, mobile-first, Georgian, calm register with the
funnel's card style per prototype; design-system components only (Stepper, Field, Card,
Button, Pill). Funnel state is always fetched client-side on mount (never baked into cached
HTML), so service-worker shell caching stays harmless.

### 3.1 Choice — `/join` (replaces opening-soon in place)

Prototype screen `join` verbatim: eyebrow „რეგისტრაცია", H1 „როგორ გსურს შემოგვიერთდე?",
two cards — 🙋 „წევრი / მხარდამჭერი" (primary „გახდი წევრი") and ⭐ „დელეგატი" (red-ringed
card, dark button „გახდი დელეგატი"). Query params:

- `?role=delegate` (Phase 1 home hero already sends this) → skips the choice, goes straight
  to step 1 in delegate mode.
- `?ref=<code>` → skips the choice, goes straight to step 1 in member mode with the
  referral retained; the code is persisted server-side at step 1 (survives cross-device
  resume). If the person later restarts as a delegate (possible only while still `draft`,
  §4.3), the stored ref is discarded. Invalid/unknown/not-yet-approved codes are **silently
  ignored** (funnel proceeds as direct entry; no error).
- A signed-in visitor with funnel state is forwarded to their current step / completion
  screen (see 3.8). Completed members/delegates never re-enter the funnel; member→delegate
  upgrade is out of scope (§9).

### 3.2 Step 1 — contact + OTP — `/join/step-1`

Stepper (1 of 3: „კონტაქტი / იურ. პროფილი / საწევრო"), role label „წევრის რეგისტრაცია" /
„დელეგატის რეგისტრაცია". Fields per prototype: სახელი, გვარი, ტელეფონის ნომერი (hint: „ამ
ნომერზე მოგივა ერთჯერადი SMS კოდი დასადასტურებლად."). Phone validated/normalized with the
existing `normalizeGeorgianPhone`. Continue → `signInWithOtp` (existing machinery) → inline
OTP entry: 6 individual digit boxes (prototype's `.otp` visual, auto-advance), „ხელახლა
გაგზავნა" resend with 60 s cooldown (matching Supabase's per-number SMS rate limit; hitting
the limit anyway shows „კოდი უკვე გაიგზავნა — სცადე ერთ წუთში"), dev-code display on
dev/preview exactly like the login page. The OTP UI is extracted into a shared component and the login page is refactored to use
it (no copy-paste, per CLAUDE.md).

On verify: server action calls `funnel_start` (§4.3) — the draft now exists server-side
(auto-save promise „💾 მონაცემები ინახება ავტომატურად (Draft)" is literally true from here).
Routing after verify, by state: fresh/draft → step 2; already mid-funnel → their step, inputs
pre-filled; already completed → notice „ეს ნომერი უკვე რეგისტრირებულია" + forward to
completion screen. Duplicate registration is impossible by construction (one auth account per
phone).

### 3.3 Step 2 — legal profile — `/join/step-2`

Prototype screen `join-step-2`: პირადი ნომერი (11 digits, `inputmode=numeric`,
maxlength 11), დაბადების თარიღი (required, must be a past date; **no age gate in v1** —
counsel decision, launch-checklist item), მხარე → ქალაქი/მუნიციპალიტეტი cascade (city list
loads for the chosen region from the `cities` table; both always submitted together),
სამუშაო ადგილი / სტატუსი — the prototype's five presets „დასაქმებული, თვითდასაქმებული,
სტუდენტი, პენსიონერი, დროებით უმუშევარი" + „სხვა (მიუთითე)" revealing a free-text field
(≤100 chars; the free text is what gets stored).

- **Member variant — delegate binding block** („აირჩიე შენი დელეგატი"): with a stored valid
  referral → read-only card (avatar initials, name, region, pill „დამტკიცებული", line „🔗 შენ
  შემოხვედი რეფერალური ბმულით — დელეგატი უკვე მინიჭებულია."); referral delegates may be from
  any region. Otherwise → select with **„ცენტრალური მოძრაობა" first and default**, then
  approved delegates of the chosen region (from `public_delegates`), re-filtered when region
  changes. Server enforces "approved delegate or central" (region match is UX only —
  recorded, since referrals already legitimize cross-region support).
- **Delegate variant — T&C block**: mandatory checkbox „ვეცნობი და ვეთანხმები დელეგატად
  ყოფნის წესებსა და პირობებს. ვადასტურებ, რომ მოწოდებული მონაცემები ნამდვილია." linking to
  `/join/terms` (new tab). Cannot submit unchecked.

Submit → `funnel_save_profile` (§4.3), atomic. Duplicate personal ID → inline „ეს პირადი
ნომერი უკვე რეგისტრირებულია." Status becomes `profile_completed`. Re-submitting step 2 while
not yet completed updates the same fields (back-navigation works); after completion the
funnel is read-only (cabinet edits arrive in Phase 3).

### 3.4 Step 3 — membership tier — `/join/step-3`

Prototype screen `join-step-3` **minus** the card modal and the recurring checkbox: title
„საწევრო შენატანი", the three tier cards 5/10/20 ₾ „თვეში" (10 pre-selected). Single button
„რეგისტრაციის დასრულება" → `funnel_complete` (§4.3) → member: `/join/done`; delegate:
`/join/pending`.

### 3.5 Member completion — `/join/done`

New screen (replaces the prototype's card-payment fiction; calm, Card-based):

- H2 „რეგისტრაცია დასრულებულია ✓", pill „პროფილი შევსებულია".
- **Reference code, displayed large**: label „შენი პირადი კოდი", the code (e.g. `GR-7K3M9Q`),
  hint „მიუთითე ეს კოდი ყველა გადარიცხვის დანიშნულებაში."
- **Transfer instructions**: recipient name, bank, IBAN (placeholder values visibly marked
  „საბანკო რეკვიზიტები მალე დაემატება — ეს დროებითი მონაცემებია."), then „გადმორიცხე
  {tier} ₾ ყოველთვიურად ამ ანგარიშზე და დანიშნულებაში მიუთითე შენი პირადი კოდი."
- Status note: „აქტიური წევრის სტატუსი გააქტიურდება პირველი შენატანის დადასტურების შემდეგ."
- Their delegate (name or „ცენტრალური მოძრაობა") as a small confirmation line.
- Buttons: „მთავარი გვერდი" (primary), „დელეგატების რეიტინგი" (ghost).

This screen is the member's persistent home until Phase 3 (see 3.8).

### 3.6 Delegate pending — `/join/pending`

Prototype screen `join-pending` with adjustments: ⏳, H2 „შენი დელეგატის პროფილი განიხილება",
pill „მოლოდინში", and the three-row explainer (🔗 referral link deactivated until approval /
🙈 profile not public yet / ✅ what happens after approval) carried verbatim — but the intro
sentence no longer claims a completed payment; instead the same reference-code + transfer
instructions block as 3.5 (delegates are paying members too). Buttons: „მთავარი გვერდი" only
(prototype's „გადადი პანელზე" returns with Phase 3). Approval itself is Phase 4 tooling.

### 3.7 Terms — `/join/terms`

Static public page: eyebrow „დელეგატის წესები და პირობები", visible placeholder banner
„სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას", short neutral Georgian outline of
delegate duties (data accuracy, lawful conduct, revocation on breach). Real text replaces it
before launch (checklist item).

### 3.8 Resume & login routing

One shared rule, derived purely from DB state (`deriveFunnelStep` in `lib/`, §5): no
profile → step 1 · profile without personal ID → step 2 · profile without
tier/reference-code → step 3 · completed → done/pending by role. **Legacy rows (seed and
Phase 0/1 users) are first-class inputs:** an existing `delegates` row implies role
delegate regardless of the backfilled `signup_role` default; `status = 'active_member'`
**or** a set `registration_completed_at` both mean "completed" (the done screen shows the
reference-code block only when a code exists — pre-Phase-2 actives have none). Applied at:
every funnel page load (guard + redirect), `/join` entry, and the login page's post-verify
redirect (replacing today's hardcoded `/me/profile`; a logged-in user with no profile row
at all lands on `/join`). Funnel-page guards are **client-side redirects after the mount
fetch** (per §3's client-fetch rule — never server-rendered redirects, so cached shells
stay valid). Steps 2–3 and completion screens require a session; signed-out visitors
hitting them are sent to step 1.

## 4. Database (one migration)

### 4.1 New columns — `profiles`

- `signup_role text not null default 'member' check (signup_role in ('member','delegate'))`
- `signup_ref_code text` — referral code captured at step 1 (nullable; resolved at step 2)
- `membership_tier smallint check (membership_tier in (5,10,20))` — null until step 3
- `reference_code text unique check (reference_code ~ '^GR-[A-HJKMNP-Z2-9]{6}$')` — null
  until completion; permanent once set (character class = exactly the §4.2 alphabet:
  no I, L, O, 0, 1)
- `registration_completed_at timestamptz` — the "funnel finished" marker

All five join the `protect_profile_columns()` trigger's guarded list (client API roles can
never write them; the definer RPCs and service role can). The migration also **backfills
`signup_role = 'delegate'` for every profile that already has a `delegates` row** (seed
consistency), and **revokes the client `update` grant on `profiles`**: after this phase no
legitimate client path writes `profiles` directly (all funnel writes go through the RPCs;
cabinet editing arrives in Phase 3 with its own scoped path), so the open grant was an
unvalidated side door around the funnel's in-DB checks. The "own profile updatable" RLS
policy stays in place for Phase 3 reuse — unreachable without the grant.

### 4.2 Code generation

`gen_funnel_code(len int)` — Postgres function using `pgcrypto` randomness over alphabet
`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, stored uppercase. Because the funnel RPCs run with
`set search_path = ''`, it schema-qualifies `extensions.gen_random_bytes` (and the
migration opens with `create extension if not exists pgcrypto with schema extensions`).
Used for member reference codes (`'GR-' || gen_funnel_code(6)`, uniqueness-retry loop) and
new delegates' `referral_code` (`gen_funnel_code(6)`). Seeded delegates keep their
`D00101`-style codes — both formats are unique and referral lookup is by exact code, so
they coexist.

### 4.3 Funnel RPCs — the mutation boundary

Four `security definer` functions (owner `postgres`, `set search_path = ''`), `execute`
granted to `authenticated` **with an explicit `revoke execute … from public, anon`**
(Postgres grants new functions to PUBLIC by default — same pattern the Phase 0 migration
already uses for `send_sms_hook`), all deriving the subject from `auth.uid()` — never from
a parameter — and each a single transaction:

- **`funnel_start(first_name, last_name, role, ref_code)`** — inserts the caller's
  `profiles` row (names, phone copied from `auth.users` **normalized to E.164 with `+` —
  the pinned canonical format for `profiles.phone`; Supabase stores auth phones without
  the `+`**, status `draft`, `signup_role`, `signup_ref_code`) or, while still incomplete,
  updates the names — role and ref are
  changeable **only while status is still `draft`** (once step 2 has created role-specific
  artifacts, the chosen path is locked; the funnel's own routing means the person never
  sees the choice screen again mid-funnel anyway). No-op with current state returned once
  completed.
- **`funnel_save_profile(personal_id, birth_date, region_id, city_id, employment,
  delegate_id, tc_accepted)`** — re-validates everything in-DB (11-digit format; birth date in the past;
  city belongs to region; employment non-empty). Personal-ID uniqueness violation raises a
  distinct error the server action maps to the Georgian duplicate message. Member: resolves
  binding (stored valid+approved referral wins over picker choice; picker delegate must be
  approved; null = central) and closes-then-opens the `memberships` row. Delegate: requires
  T&C acceptance flag, creates the `delegates` row (status `pending`, generated
  `referral_code`, `tc_accepted_at = now()` on first acceptance only); a delegate
  re-submission updates profile fields but **preserves the existing `referral_code`**
  (never regenerated). Moves status forward-only `draft → profile_completed`. Rejected
  when already completed.
- **`funnel_complete(tier)`** — requires `profile_completed` + the role's step-2 artifacts;
  sets `membership_tier`, generates `reference_code`, stamps `registration_completed_at`.
  **Idempotent: a second call returns the existing code and never regenerates it — a
  different tier in a repeat call is ignored** (the funnel is read-only after completion,
  §3.3; tier changes arrive with the Phase 3 cabinet).
- **`funnel_state()`** — read-only: role, derived step, saved field values for pre-fill,
  resolved referral-delegate display data (name/region) when valid, and completion data
  (code, tier, delegate name). Only ever the caller's own row.

No new direct table grants to client roles. Supporter counts, statuses and money remain
derived — nothing in this phase stores a computed value (house rule), and nothing in this
funnel can set `active_member` (that is Phase 4's payment-recording engine).

### 4.4 Dev-OTP hardening (code change riding the same PR)

`/api/dev/otp` additionally refuses (404) any phone whose profile has
`registration_completed_at is not null` **or** `status = 'active_member'` (decision #6).
The profile lookup must match **both** phone formats (`+995…` and `995…` — the same
double-format handling the route already applies to the inbox), so a format mismatch can
never fail *open* and serve a code the rule should block.
While touching it: opportunistically purge `dev_otp_inbox` rows older than 1 hour (closes a
Phase 0 minor). The endpoint remains absent outside dev/preview and is deleted in Phase 6.

## 5. Domain logic (`lib/`, pure, TDD)

- `lib/funnel.ts` — `deriveFunnelStep(state)` (the 3.8 rule, exhaustive over role×progress);
  tier constants `[5, 10, 20]`; reference/referral-code format validators + the shared
  alphabet constant (mirrors §4.2 — DB generates, lib validates).
- `lib/funnel-schemas.ts` — zod schemas for every boundary: step-1 contact (names 1–60
  chars trimmed, phone via `normalizeGeorgianPhone`), OTP (6 digits), step-2 profile
  (personal ID `^\d{11}$`, past birth date, region/city ids, employment ≤100, delegate
  binding, T&C literal `true` for delegates), step-3 tier (enum 5/10/20). **These schemas
  are the single source for both the client forms and the server actions — the
  platform-wide zod pattern this phase establishes (closes the Phase 0/1 deferred item).**
- `lib/bank-details.ts` — the one place holding recipient name / bank / IBAN + a
  `placeholder: true` flag driving the visible marking; swapping real details = editing this
  module only.
- Existing `lib/validation.ts` (`validatePersonalId`, `normalizeGeorgianPhone`) is reused,
  not duplicated.

Server actions (`app/(public)/join/actions.ts`, `"use server"`): thin — parse with zod,
call the RPC with the caller's cookie-bound client, map DB error codes to Georgian
messages. No service-role usage anywhere in the funnel path.

## 6. Security & error handling

- **Validation twice**: instant Georgian feedback client-side; zod re-parse + in-DB checks
  server-side (server is the source of truth). Friendly Georgian errors throughout; unknown
  failures → generic „რაღაც შეცდომა მოხდა — სცადე თავიდან", state preserved (atomic saves).
- **Anti-enumeration**: no pre-OTP phone-existence check (deviation from prototype UX,
  §"deviations"); "already registered" is only revealed after proving phone ownership.
  Personal-ID duplicate response is submit-only, authenticated-only, generic-messaged.
  Residual authenticated probing risk is accepted for v1 and **explicitly queued for the
  Phase 6 `/cso` audit**.
- **Dev-OTP oracle closed** per decision #6 (the Phase 0 MUST-CLOSE gate for this phase).
- **RLS/grants unchanged for clients**; funnel writes only via definer RPCs; new profile
  columns trigger-protected; reference codes reachable only by the owner (and Phase 4
  finance via service role). Referral codes stay out of all public views.
- **Session expiry mid-funnel**: guard redirects to step 1; verified draft data is intact.
- Placeholder bank details visibly marked (3.5) on top of the site-wide demo banner.

## 7. Testing

- **Unit (Vitest, failing-first):** `deriveFunnelStep` exhaustive matrix; every zod schema
  (accept/reject per field, incl. phone normalization edge cases and T&C literal-true);
  code-format validators; bank-details module shape.
- **Component:** OTP input (6 boxes, auto-advance, resend cooldown), tier picker
  (selection state), delegate-binding block (referral card vs picker vs central default).
- **e2e (Playwright vs staging):** the two full journeys — member (phone → OTP via
  `/api/dev/otp` → profile → tier → done screen shows a `GR-` code + placeholder-marked
  instructions) and delegate (…→ T&C required → pending screen, then: not present on
  `/delegates` or `/leaderboard`); plus duplicate personal-ID rejection, mid-funnel resume
  (new context, log in, land on the right step pre-filled), referral pre-fill
  (`?ref=<seeded delegate code>` → read-only card), and dev-OTP hardening (completed
  member's phone → 404).
- **e2e isolation (binding):** per-run phones derived from the CI run number **and run
  attempt** in the **`55XXXXXXX` national block**, each journey with a distinct reserved
  digit — disjoint from the seed's `50XXXXXXX` block. **The existing login e2e's phone
  derivation moves into this scheme in the same PR**: today's `5 + %08d(run_number)`
  formula lands inside the seed block and can collide with a seeded `active_member`, which
  the §4.4 hardening would then 404 — red CI on this phase's own PR otherwise.
  `login.spec.ts` is also updated for §3.8: a profile-less login now lands on `/join`, not
  `/me/profile`. Per-run **personal IDs** get the same treatment: an 11-digit scheme in a
  reserved prefix (e.g. leading `9`) disjoint from the seed's `1`-prefixed IDs, folding in
  run attempt. Runs create only their own users and delete them in teardown (service-role,
  best-effort; the canonical 12-delegate seed and home counters are asserted by existing
  specs and must stay untouched — new registrants are never `active_member`, so counters
  can't drift anyway).
- **Sequencing:** the migration is applied to staging *before* e2e specs depending on it
  land in CI (Phase 1 discipline). `scripts/verify-schema.mjs` gains probes: client roles
  cannot call-bypass (RPC as `anon` fails; direct write to protected columns fails), and a
  visible-effect check that `funnel_complete` is idempotent.

## 8. Hygiene riders

- **DECISIONS.md** (append-only): ADR-009 — funnel mutations via SECURITY DEFINER RPCs
  (decision #5 rationale); ADR-010 — reference-code format + placeholder bank details
  (decisions #1–2); plus the deferred note that the composite FK
  `profiles(city_id, region_id)` uses MATCH SIMPLE and why that's acceptable (the funnel
  always submits both — recorded now that Phase 2 touches it, per Phase 0 tracking).
- **DESIGN.md**: add the new shared components — OTP input, TierPicker (and the extracted
  OTP verification block) — to the inventory + `/styleguide` gallery.
- **Metadata/SEO**: `/join` gets a real title/description (replacing „მალე გაიხსნება");
  `/join` and `/join/terms` join the sitemap. Step/completion pages stay out of it.
- `dev_otp_inbox` purge (rides §4.4).

## 9. Out of scope

Member cabinet, delegate panel, referral links being *live*, profile editing (Phase 3);
delegate approval queue, payment recording, `active_member` derivation, finance matching UI
(Phase 4); member→delegate upgrade (unscheduled; explicitly not handled — completed members
entering the funnel are forwarded to their completion screen); changing delegate (Phase 3);
real SMS, real bank details, final T&C text, age-gate policy, prod Supabase (Phase 6 launch
checklist); payment gateway (post-launch). **No new npm dependencies** (zod is already in).

## 10. Rollout & sign-off

- Branch `claude/republic-registration-phase-2-4f2474` (this worktree, already off updated
  `main`); superpowers subagent-driven execution (fresh implementer + independent reviewer
  per task), whole-branch review, independent `/codex review`; single PR; CI green
  throughout; merges as **v0.3.0**.
- Owner sign-off package (plain language, no screenshots — DOM-verified evidence + URLs to
  click, per owner's tooling constraint): Vercel preview link; a test member and a test
  delegate registered end-to-end by the AI on the preview against staging, with the exact
  URLs and what each shows (done screen with real `GR-` code; pending screen; pending
  delegate absent from public pages); instructions for the owner to register themselves
  with any made-up `5XXXXXXXX` number (test code appears on screen on previews).
- Owner explicitly approves in chat before merge. Branch protection on `main` remains
  owner's two-minute task (reminded 2026-07-15; not blocking).

## 11. Success criteria

- A person can register as a member on the preview end-to-end and sees a permanent
  `GR-XXXXXX` code with transfer instructions, and can return to that screen at any time
  (routing rule 3.8; on staging, completed accounts revisit via their still-valid session —
  cross-device re-login stays blocked there by decision #6 until real SMS in Phase 6).
- A person can register as a delegate, must accept the T&C, ends in „მოლოდინში", and appears
  on no public surface while pending.
- A referral link pre-fills its approved delegate; an invalid one degrades silently.
- The same phone can never produce two registrations; a duplicate personal ID is rejected
  with the Georgian message; no half-saved registration is observable at any point.
- `/api/dev/otp` no longer serves codes for completed or active accounts.
- Every form boundary in the funnel validates with zod on both sides; all CI gates green;
  owner sign-off recorded before merge.
