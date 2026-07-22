# Design Spec — Phase 6 Release 2: The Ladder and the Numbers (v0.8.0)

**Date:** 2026-07-22
**Status:** brainstormed with owner (2026-07-22), approved section-by-section in chat;
this document is the written record for owner review before planning.
**Parent spec:** docs/superpowers/specs/2026-07-21-progressive-registration-design.md —
this document refines its §5 (Release 2) into full detail and fixes the release scope.
R1 (v0.7.0, the new front door) merged to main 2026-07-21 (merge commit b024200).

## 1. Context and goal

R1 shipped the light front door: one-minute registration, the become-a-member wizard in
the cabinet, and a retired public delegate pitch. Two gaps were deliberately left open:
there is no path to delegacy at all (nothing feeds the admin verification queue), and
the public/admin surfaces still present the old single-tier picture of the community.

R2 closes the ladder and shows the numbers:

1. **Delegacy request** — a member-only, one-confirm request feeding the existing
   verification queue (parent D-table, D1/D7).
2. **Public counters** — registered and active members shown side by side, both derived
   live (parent D5).
3. **Admin standing buckets** — members/export/overview treat
   registered / member / active as clean, disjoint groups with a conversion figure.
4. **Internal cleanups** — the R1-review deferrals (test-helper consolidation,
   duplicate-ID race, latent routing/data hardening, small hygiene) plus the queued
   Phase 5 community hardening riders.
5. **Wording** — the public header CTA switches to „დარეგისტრირდი“.

Timing: still pre-launch (staging data only), so schema work remains a code rework,
not a live migration.

## 2. Decisions locked in brainstorming (owner, 2026-07-22)

| #    | Decision |
|------|----------|
| R2-1 | All four deferred tidy-up baskets are **in scope**: e2e-helper consolidation, duplicate-personal-ID race fix, routing/data hardening, small hygiene batch (login error UI, seed referral codes, stat-key rename). |
| R2-2 | The queued **Phase 5 community hardening items ride along** in R2's migration + three small app fixes (§8) — R2 is "the next hardening migration" they were queued for. |
| R2-3 | The public header CTA becomes **„დარეგისტრირდი“** (was „გახდი წევრი“). „გახდი წევრი“ now means exactly one thing: the in-cabinet membership journey. The delegate-page supporter card's supporting sentence is softened to match what the click does (registration with the referral remembered). |
| R2-4 | **One release**: single branch/PR/preview/sign-off, tagged v0.8.0; internal cleanups land first in the build order. Spec = this new dated document (the R1 spec stays untouched as the approved record). |
| R2-5 | The public "registered" number is **cumulative** (count of all profiles — members included). It answers "how big is the list?" and never shrinks on upgrade. The **disjoint** split lives in admin only. |
| R2-6 | Reaffirmed from parent: rejected delegacy has **no self-service retry** (D7); a fresh request requires an admin decision. |

## 3. Delegacy request (members only)

### 3.1 Flow

- The member's cabinet landing page (`/me/profile` — members never see `/me`, it
  redirects them there) gains a „გახდი დელეგატი“ card → `/me/delegacy`:
  the delegate terms (content moved from the orphaned `/join/terms`, which then
  redirects there) + one confirm button. No new data is collected.
- `request_delegacy()` RPC (SECURITY DEFINER, ADR-009 pattern, `authenticated` only):
  - requires member standing (`registration_completed_at is not null`) — else a
    specific refusal token;
  - refuses if **any** `delegates` row already exists for the caller (pending,
    approved, or rejected — the last per R2-6/D7);
  - inserts `delegates` with `status = 'pending'`, a referral code minted by the
    existing generator, `tc_accepted_at = now()` — the same row the old public funnel
    created, now always on top of a completed member.
- Cabinet states (driven by `cabinet_state()`'s existing delegate-status field,
  extended only if a gap is found during implementation):
  - **pending** — the card becomes a calm „მოთხოვნა გაგზავნილია“ state; member life
    (polls, RSVP, billing) is untouched while waiting;
  - **approved** — delegate cabinet + public page unlock via existing routing;
  - **rejected** — calm final state in the cabinet; only an admin can approve later
    (queue unchanged).
- Routing distinguishes approval: only **approved** delegates land in the delegate
  cabinet (`/delegate`); pending and rejected requesters stay in the member cabinet
  with the card states above. (R1 sent any delegates-row holder to `/delegate`; that
  rule predates member-initiated requests.)
- Admin verification queue, `admin_reject_delegate`, and all audit rows: **unchanged**.
  `admin_approve_delegate` gains exactly one rider: approval also closes the new
  delegate's own open membership (delegates back no one — the standing Phase 3
  invariant). The membership stays open through the pending wait, so a rejection
  leaves the member's own delegate backing untouched.
  Member requests simply start feeding the queue again.

### 3.2 Integrity and hardening (rides with this feature)

- **Invariant, DB-enforced:** a `delegates` row requires a completed member profile.
  A constraint trigger on `delegates` insert/update enforces
  `registration_completed_at is not null` on the owning profile — so no path (product,
  service-role script, or seed) can create the half-formed hybrid again.
  `request_delegacy()` satisfies it by construction; ADR-016's approval-time guard
  stays as depth. Staging's seeded delegates already comply (all sit on active members).
- **Redirect-loop retired structurally:** destination derivation and the delegate
  layout now both key on *approved* delegacy (not mere delegates-row presence), so
  the R1 latent `/me` ↔ `/delegate` loop for a half-formed hybrid becomes
  unrepresentable — no bounce target remains even without the invariant, and the
  invariant removes the hybrid itself.
- **Stale wizard choice:** `profiles.pending_delegate_id` must never dangle or block —
  deleting a delegate clears it (`on delete set null`; verified/adjusted in the
  migration). Completion-time re-validation (approved-else-central) already covers the
  semantics either way.

## 4. Public numbers

- `public_stats` (view, already `anon`-readable) gains
  `registered_total = count(*) of profiles` — cumulative per R2-5. Existing columns
  (`approved_delegates`, `active_members`) unchanged.
- Homepage: the two counters become three — **რეგისტრირებული** (breadth),
  **აქტიური წევრი** (commitment), **დელეგატი** (as today) — reusing the existing
  StatCard/CountUp components; ka-GE number formatting via the existing helper.
- `/transparency` adds the registered total alongside its existing derived figures
  (reads `public_stats`; no new view needed).
- Regional breakdowns stay member-based — registered people have no region (honest
  consequence of the minimal form; recorded in the parent spec, unchanged here).
- Derived live, never stored (house forbidden-pattern holds). ISR (revalidate 60)
  means public figures can lag up to a minute — existing behavior, unchanged;
  e2e reuses the established settle-loop pattern when asserting counts.

## 5. Admin: disjoint standing buckets

- `admin_members` (self-gating view, ADR-014 pattern preserved) is rebuilt to carry a
  derived `standing` with **disjoint buckets**:
  - `registered` — `registration_completed_at is null`;
  - `member` — completed but `status <> 'active_member'`;
  - `active` — `status = 'active_member'`.
  Each person appears in exactly one bucket; the three sum to the total.
- Members page: standing filter (ყველა + the three buckets). Registered rows show
  exactly what we hold: name, phone, created_at, and the referral source delegate
  (resolved from `signup_ref_code`). Personal IDs stay out of list views — only the
  existing audited reveal/export paths return them (ADR-014 unchanged).
- `admin_export_members`: same standing filter parameter; CSV neutralization rules
  unchanged (ADR-016).
- `admin_overview`: adds `registered_total` and conversion — completed members (the
  member + active buckets together) ÷ registered total, rendered as a percentage. Its `total_completed` and `admin_region_stats`' member
  predicates are corrected to the R1 semantics (member =
  `registration_completed_at is not null`), replacing the mechanical
  `status <> 'registered'` filters where they survive.
- No new audited admin mutations: registration and upgrade are self-service; delegate
  approve/reject already audit.

## 6. Wording

- Public header CTA (`app/(public)/layout.tsx`): „გახდი წევრი“ → **„დარეგისტრირდი“**.
- Delegate public page supporter card: the button label „გახდი მისი მხარდამჭერი“
  stays; its supporting sentence is softened to describe the real click (register in a
  minute; the delegate link is remembered and applied when you become a member) instead
  of promising the profile+fee journey up front.
- No other user-facing copy changes.

## 7. Internal cleanups (R1-review deferrals)

### 7a. e2e test-helper consolidation

One shared helper module for the e2e suite: single `loginAs` (funnel + admin variants
merged, landing-target parameterized), single service-client factory, single
OTP-inbox-poll routine consumed by `submitJoinAndReadInboxOtp` (currently the third
copy). Alongside: fix the stale „withheld for COMPLETED“ comment (the dev-OTP route
withholds for any existing profile since R1), retarget the toothless
`membership.spec` substring assertion to a precise locator, and raise the 150s
per-test cap to 210s (a spec that rides out two OTP-throttle windows needs ~186s —
the recorded latent flake). The
throttle-race idiom inside the poll loop is kept as-is (pre-existing shape, worst
case is a spec flake, never a double registration) — recorded, not redesigned.

### 7b. Duplicate-personal-ID race

`register()` gains a `unique_violation` handler so the check-then-insert race emits
the same specific token as the pre-check (`duplicate_personal_id` → the existing
field-level Georgian error + in-place retry), instead of a raw 23505 → generic error.

### 7c. Login error surface

`/login`'s cabinet-state routing gets an error path: on a failed state lookup the
person stays on the login screen with a Georgian error message (today a transient
lookup failure silently bounces even an existing member to `/join`).

### 7d. Seed + stat key

- `seed-staging.mjs` writes `signup_ref_code` on a slice of registered rows so the
  referral prefill and the delegate panel's registered stat are finally exercisable in
  staging QA; the registered-roster `.in()` select is chunked so a >1000-row roster
  cannot overflow the request line (fails loud today; recorded minor).
- `delegate_panel`'s jsonb key `draftCount` → `registeredCount` (SQL + `lib/cabinet.ts`
  type + `app/(delegate)/delegate/page.tsx` consumer). The on-screen label already says
  „რეგისტრირებული“ (fixed in R1); this closes the naming debt behind it.

## 8. Phase 5 community hardening riders

Queued at the Phase 5 merge gate for "the next hardening migration" — which is this
one. Planning grounded each item in current code; two of the recorded "SQL" items
turned out to live in the app layer (same fixes, right layer). SQL (in R2's
migration):

1. `admin_save_event`'s content UPDATE becomes conditional DML (`… and status <>
   'cancelled'`), closing the check-then-act gap behind its existing pre-check (the
   one lifecycle RPC still missing it).
2. Whitespace-only guards (`btrim`) on the news body and event description CHECK
   constraints and in the two save RPCs, matching the existing non-empty intent.
3. `admin_save_news` visibility failure raises a correct `invalid_visibility` token
   (today it reuses `invalid_status`).
4. The news cover-image RPC's URL pin tightens from "any host with the right path"
   to the supabase.co storage origin + the uploader's exact filename shape. (Events
   have no image feature — the recorded "both RPCs" premise was wrong; there is
   exactly one image RPC.)
5. `member_rsvp` gains the `for share` event-row lock `member_cast_vote` already has
   (closes the recorded cancel/RSVP race; result today is inert, fix is parity).

App-side:

6. Slug minting (`lib/slug.ts`) truncates the romanized base to 80 chars before
   dedup, suffix-aware — long titles publish instead of failing with `invalid_slug`;
   mint-once permanence unchanged. (The 80 cap lives in DB CHECKs; minting is app-side.)
7. The three near-identical mint-and-retry blocks (news publish, event publish,
   delegate approve) share one extracted helper — the recorded "third copy" dedup.
8. `.order("id")` added to the two remaining unordered paged payment sums — both in
   verification code (`e2e/community-polls.spec.ts`, `scripts/verify-schema.mjs`);
   the product-side paged query already orders.
9. `PollForm` option rows get stable keys (mid-list removal no longer misattaches
   input focus/IME state).
10. Poll status actions `revalidatePath` their admin list (parity with news/event
    deletes; harmless today, correct tomorrow).

## 9. Data model and RPC surface (summary of changes)

- New RPC: `request_delegacy()` (definer, `authenticated` only, §3.1 contract).
- Changed RPCs: `register(...)` — adds the `unique_violation` handler (§7b);
  `admin_approve_delegate` — closes the new delegate's open membership (§3.1);
  `delegate_panel` — jsonb key rename (§7d); Phase 5 RPC guards per §8.
- New trigger: delegates-require-completed-member constraint trigger (§3.2).
- Changed views: `public_stats` (+`registered_total`), `admin_members` (+`standing`,
  +referral source), `admin_overview` (+`registered_total`, +conversion, corrected
  member predicates), `admin_region_stats` (corrected member predicate).
- `admin_export_members`: +standing filter parameter.
- FK check: `profiles.pending_delegate_id` → delegates `on delete set null`
  (verified/adjusted).
- No table-shape changes; no new client table grants; grants follow the existing
  pattern (RPCs to `authenticated`; views per their existing audiences).
- `lib/`: `cabinet.ts` gains the delegacy-request card states + `registeredCount`
  rename; nav unchanged (no new nav item — the card lives on the overview).

## 10. Migration (staging-only reality, pre-launch)

One migration file, ordered:

1. Delegates invariant trigger (§3.2) — staging data already complies.
2. `request_delegacy()` + grant.
3. `register()` recreated with the `unique_violation` handler.
4. `admin_approve_delegate` recreated with the membership-close rider (§3.1).
5. `pending_delegate_id` FK adjusted to `on delete set null` (it is `no action`
   today).
6. `public_stats`, `admin_members`, `admin_overview`, `admin_region_stats` recreated
   (column-append only, so `create or replace` is legal). `admin_export_members`
   already takes the standing filter (the three statuses ARE the disjoint buckets) —
   verified, no change; the probe asserts it.
7. `delegate_panel` recreated with `registeredCount`.
8. Phase 5 SQL riders (§8.1–5).

`scripts/verify-schema.mjs` and `seed-staging.mjs` updated alongside (§7d, §12);
probes run against staging before the preview QA, as always.

## 11. Edge cases (handled deliberately)

- Double-confirm race on `/me/delegacy`: the second call hits the any-existing-row
  refusal; UI settles on the pending state from `cabinet_state()`.
- Delegacy approved while the member is mid-session on `/me`: next navigation routes
  through existing delegate routing; no forced redirect mid-page.
- Rejected → final in cabinet (R2-6); the admin queue can still approve later.
- Service-role delegate deletion (e2e/seed cleanup): `pending_delegate_id` clears via
  set-null; wizard completion re-validates regardless (existing central fallback).
- Two same-ID registrations in the same instant: the loser now gets the same
  field-specific error + retry as the sequential case (§7b).
- Homepage/transparency counters lag up to 60s behind a registration (ISR) — existing,
  accepted; e2e settles with the established re-request loop.
- Long-title publish: slug truncates at 80 chars, dedup suffixes still apply;
  already-minted slugs never change.

## 12. Testing

- Unit (pure `lib/` + component tests): delegacy card-state derivation,
  `registeredCount` type/consumer, conversion formatting, PollForm key behavior,
  nav gating unchanged.
- Schema probe additions: `request_delegacy` lifecycle (non-member refused; member →
  pending; duplicate request refused; rejected stays final), invariant trigger blocks a
  service-role incomplete-profile delegate insert, `registered_total` arithmetic,
  bucket disjointness + sum == total, export filter, conversion, duplicate-ID race
  token parity, and the §8 guards (truncate, cancelled-guard, btrim, token, host-pin,
  `for share`).
- e2e (staging, existing harness): member requests delegacy → pending state → admin
  approves → delegate cabinet + public page live; rejected calm state; homepage shows
  the three counters consistent with seeded numbers; admin standing filter + export +
  conversion; header CTA text. Helper consolidation (§7a) lands first and the full
  suite stays green on it before feature specs build on the shared module.
- CI green or no merge (unchanged).

## 13. Rollout and bookkeeping

- v0.8.0; full ritual: plan → TDD → per-task + whole-branch review → /qa on the
  preview → owner sign-off on the Vercel preview link → merge. Version bump +
  CHANGELOG at merge, per house pattern.
- DECISIONS.md gains ADR-019 at implementation time (cumulative-counter semantics,
  rider absorption, wording switch, delegates invariant, key rename).
- Fresh `.superpowers/sdd/progress.md` ledger for R2 (the R1 ledger lives in the old
  R1 worktree).
- Branch `claude/progressive-registration-r2-b1608b` (already cut from main b024200).

## 14. Out of scope (recorded)

- Delegate-facing referral funnel stats ("N registered via your link, M became
  members") — parent spec deferral stands.
- Self-service re-request after delegacy rejection (R2-6/D7).
- Regional data for registered people.
- Any change to payment tiers, the payment engine, or the leaderboard formula.
- Direct registered → delegate path (delegacy stays member-gated).
- Signed direct-to-storage photo upload (ADR-016 deferral stands).
- Admin/cabinet UI dedup (AdminNav≈CabinetNav, pagination footers) — Phase 4
  deferral, untouched by R2's areas.
- `@supabase/ssr` upgrade (ADR-012 revisit) — its own reviewed task, launch phase.
- Markdown article bodies (ADR-017 stands).
