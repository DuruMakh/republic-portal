# Design Spec — Phase 3: Cabinets

**Date:** 2026-07-15
**Status:** Approved in brainstorming (owner approved all 3 design sections + 5 scoping
decisions).
**Parent spec:** `2026-07-12-republic-portal-production-design.md` (binding platform spec;
this document details its "Phase 3 — Cabinets" row and §6 "Member cabinet" / "Delegate
cabinet").
**UX contract:** `prototype/index.html`, screens `me-profile`, `me-delegate`, `me-billing`
(markup lines ~617–790, logic ~1720–1843) and `delegate-dashboard`, `delegate-team`
(markup ~810–908, logic ~1885–1960). Copy, layout and behavior carry over unless stated
otherwise. **Known deviations from the prototype, all owner-approved:**

- `me-billing`'s card-on-file / cancel-subscription / edit-card modal is payment-gateway
  fiction and is replaced by the manual-transfer reality (tier + reference code + transfer
  instructions + honest empty history), per parent spec ADR-003 — the same
  de-fictionalization the funnel's step 3 already received.
- `me-polls` is omitted entirely (Phase 5). The cabinet navigation shows only working
  sections — no greyed-out or stub entries (scoping decision #1).
- The referral link uses the real deployment origin and the delegate's real
  `referral_code` (`/join?ref=<code>`), not the prototype's `giorgi-101` slug fiction; a
  **QR code** of the same link is added (parent spec §6 mandates it; the prototype lacks
  one).
- Personal ID renders **fully masked** (`•••••••••••`), stricter than the prototype's
  last-3-digits mask — the platform never echoes the personal ID to the client (privacy
  stance declared at Phase 2 sign-off).
- Prototype toasts become inline confirmations/notices (the design system has no toast
  component; the funnel set the inline pattern).
- The cabinet shell adds a **sign-out** control (the prototype had none; the platform
  currently has no way to log out).
- The team table has no 40-row display cap and uses the real status vocabulary; "draft"
  rows never appear in the table (a draft has no membership row yet) — drafts exist only
  as the dashboard's მონახაზები stat.

---

## 1. Goal

Give every completed registrant a home: a member cabinet (profile editing via the
Phase-2-prepared scoped path, delegate changing with history, payments page holding the
reference code + transfer instructions + tier control) and a delegate panel (live referral
link + QR, live counts, team table) — and make login/funnel routing hand off cleanly so
completed users land in the cabinet, not on the funnel's completion screens. Referral
links become genuinely live: sharing `/join?ref=<code>` has worked end-to-end since
Phase 2; this phase gives delegates the surface that shows, copies and QR-encodes it.

## 2. Decisions locked in brainstorming (owner-approved)

| # | Decision | Choice |
|---|---|---|
| 1 | Phase 5 tiles (polls/news/events) | **Omit entirely.** Cabinet nav shows only working sections; Phase 5 adds its own entries when it ships |
| 2 | Login/funnel handoff | **Cabinet takes over fully.** `/join/done` and `/join/pending` render exactly once, at the moment of completion (code-reveal celebration), with buttons leading into the cabinet; any later visit by a completed user — login, `/join`, or the completion URLs directly — forwards to the cabinet. The funnel becomes strictly one-way |
| 3 | Payment history (empty until Phase 4) | **Table + honest empty state**: „გადახდები ჯერ არ არის აღრიცხული" + a note that transfers are confirmed by the finance team and active status switches on after the first confirmed payment. Fills with real rows when Phase 4 ships — no UI change needed |
| 4 | Tier change | **Ships now** (honors Phase 2's "tier changes arrive with the Phase 3 cabinet" note). Reuses the funnel's 5/10/20 TierPicker on the payments page; changing tier only changes the monthly amount shown in the transfer instructions |
| 5 | Cabinet DB access | **Mixed model.** Plain profile fields go through the Phase-2-prepared scoped path: a column-scoped `UPDATE` grant on exactly (first_name, last_name, region_id, city_id, employment), the kept "own profile updatable" RLS policy, and the `protect_profile_columns()` trigger as backstop — three independent locks. Everything compound or protected (change delegate, change tier, delegate panel reads) stays SECURITY DEFINER RPCs per ADR-009. Recorded as ADR-012 |
| 6 | QR code | One new dependency — a tiny **zero-dependency QR generator** rendering SVG client-side (first new package since zod). Recorded as ADR-011 |

## 3. Screens

All cabinet pages are authed, calm-register, Georgian, design-system components only.
Layouts enforce auth **and completion server-side on every request**; the service worker
already treats `/me` and `/delegate` as NetworkOnly (Phase 0), so per-request server
rendering is safe — no funnel-style client-fetch dance is needed inside the cabinet.
Mutations are thin zod-validated server actions in front of the §4 paths.

### 3.1 Cabinet shell, navigation, and entry

- **Shared shell** for both areas: eyebrow „პირადი კაბინეტი", role-aware tab navigation,
  and a **გასვლა** (sign out) control (client-side `signOut()` + redirect home).
  - Member sees: პროფილი · ჩემი დელეგატი · გადახდები.
  - Delegate sees: პროფილი · გადახდები · დელეგატის პანელი (they are paying members too;
    they have no "my delegate" — the data model gives delegates no membership row).
- **`/me`** is a server redirect to the caller's primary page: members → `/me/profile`,
  delegates → `/delegate`. It is the single cabinet entry point for the header.
- **Public header**: signed-in visitors see „კაბინეტი" (→ `/me`) instead of „შესვლა".
  The swap happens client-side after mount (same reason as the funnel's client-fetch
  rule: the public shell is served from the service-worker cache and must stay
  session-agnostic).

### 3.2 Routing and handoff

One shared pure rule (`deriveDestination`, §5) extends Phase 2's `deriveFunnelStep`:

| Situation | Destination |
|---|---|
| No session on a cabinet page | `/login` |
| Session, no profile row | `/join` (unchanged) |
| Session, registration unfinished | the derived funnel step (unchanged) |
| Completed member | `/me/profile` |
| Delegate (any verification status) | `/delegate` |

Applied at: the login page's post-verify redirect (today it targets the funnel's
done/pending screens), the `/join` entry guard, the completion-screen guards, and — in
inverse — the cabinet layouts (unfinished visitors are bounced to their funnel step;
members opening `/delegate` go to `/me/profile`; delegates opening `/me/delegate` go to
`/delegate`).

**One-time completion screens (decision #2):** finishing step 3 still navigates to
`/join/done` (member) or `/join/pending` (delegate) — the code-reveal moment — via a
one-shot client-side marker set by step 3 and consumed on first render. Without the
marker (any later visit), a completed user is forwarded to their cabinet. The buttons on
both screens now lead into the cabinet („ჩემი კაბინეტი" primary on done; the pending
screen's „გადადი პანელზე" returns, as Phase 2 promised).

### 3.3 ჩემი პროფილი — `/me/profile`

Prototype `me-profile`: two-column (summary card 340px + form card), stacking on mobile.

- **Summary card:** initials avatar, full name, status pill (existing mapping:
  active_member → „აქტიური" ok-green; otherwise „რეგისტრირებული" info-blue), rows:
  „წევრი — {თვე წელი}-დან" (from `registration_completed_at`; legacy rows without it
  fall back to profile creation date), რეგიონი, დელეგატი (name or „ცენტრალური
  მოძრაობა") with the „დელეგატის შეცვლა →" link to `/me/delegate` — members only; for
  delegate users the დელეგატი row and link are omitted (their panel covers it).
- **Form card „პირადი მონაცემები":**
  - Editable: სახელი, გვარი · მხარე → ქალაქი/მუნიციპალიტეტი (same cascade + data source
    as funnel step 2) · სამუშაო ადგილი / სტატუსი — the funnel's five presets +
    „სხვა (მიუთითე)" free-text; a stored value that isn't a preset renders as „სხვა" with
    the text filled in.
  - Locked, shown for trust: ტელეფონი read-only with ✓ ვერიფიცირებული badge and the
    prototype hint „ნომრის შესაცვლელად საჭიროა ხელახალი დადასტურება." (actual phone
    change is out of scope); პირადი ნომერი fully masked with hint „ვერიფიცირებული ·
    დაცული მონაცემი." Birth date does not appear (matches prototype).
  - შენახვა → server action (zod, §5) → scoped update (§4.1) → inline confirmation
    „პროფილი განახლდა ✓"; summary card reflects the change immediately.
    Validation mirrors funnel step 2 for the same fields, client + server.

### 3.4 ჩემი დელეგატი — `/me/delegate` (members only)

Prototype `me-delegate`:

- Red reassurance banner verbatim: „შენ შეგიძლია ნებისმიერ დროს, შეზღუდვის გარეშე
  შეცვალო დელეგატი." + subline about instant effect on the rating.
- **მიმდინარე დელეგატი card:** avatar initials, name, „დამტკიცებული" pill, region, and
  the delegate's live active-supporter count (from `public_delegates` — the same number
  the public pages show). Central variant when unaffiliated: „ცენტრალური მოძრაობა" +
  „შენ პირდაპირ ცენტრალურ მოძრაობას უჭერ მხარს."
- **დელეგატის შეცვლა card:** region select → delegate select („ცენტრალური მოძრაობა"
  always first; then approved delegates of the chosen region from `public_delegates`;
  the current choice marked „(მიმდინარე)"). Submitting the current choice shows „ეს
  დელეგატი უკვე არჩეულია" without a server round-trip (the RPC treats it as a no-op
  anyway, as backstop). Otherwise → `member_change_delegate` (§4.2): old support row closed, new one
  opened — history kept, counters recompute because they are always computed. Inline
  success „დელეგატი შეიცვალა ✓"; current-delegate card and picker markers refresh.
- Region filtering is UX only; the server accepts any approved delegate or central
  (same stance as the funnel, where referrals already legitimize cross-region support).

### 3.5 გადახდები — `/me/billing`

Prototype `me-billing` de-fictionalized (deviations block):

- **Tier card:** „შენი საწევრო: {tier} ₾ / თვეში" + „შეცვლა" revealing the funnel's
  TierPicker (5/10/20) inline with შენახვა/გაუქმება → `member_change_tier` (§4.3) →
  inline confirmation; the instructions block amount updates immediately.
- **Reference code + instructions:** label „შენი პირადი კოდი", the `GR-XXXXXX` code
  displayed large, hint „მიუთითე ეს კოდი ყველა გადარიცხვის დანიშნულებაში.", then the
  shared TransferInstructions block (recipient/bank/IBAN still visibly
  placeholder-marked until the owner's account exists — Phase 6 checklist), with
  „გადმორიცხე {tier} ₾ ყოველთვიურად…" reflecting the current tier.
- **Status note** while not yet active: „აქტიური წევრის სტატუსი გააქტიურდება პირველი
  შენატანის დადასტურების შემდეგ."
- **გადახდების ისტორია** (decision #3): table თარიღი / თანხა / მეთოდი / სტატუსი reading
  the member's own `payments` rows (the RLS path has existed since Phase 0; rows arrive
  with Phase 4's recording engine). Manual rows render მეთოდი „გადარიცხვა". Empty state:
  „გადახდები ჯერ არ არის აღრიცხული" + „გადარიცხვებს ადასტურებს ფინანსური გუნდი —
  დადასტურებული გადახდები აქ გამოჩნდება."

### 3.6 დელეგატის პანელი — `/delegate`

Prototype `delegate-dashboard`, with a verification-status dimension:

- **Approved:** greeting „გამარჯობა, {სახელი}" + „დამტკიცებული" pill.
  - **Referral card:** the full live link `{origin}/join?ref={referral_code}` (origin =
    the deployment the delegate is actually on, read client-side), კოპირება button
    (clipboard + inline „დაკოპირდა ✓"), **QR code** (SVG, ~200px, decision #6) encoding
    the same URL, hint verbatim: „ყველა, ვინც ამ ბმულით დარეგისტრირდება, ავტომატურად
    შენს გუნდში ჩაითვლება."
  - **Four StatCards:** აქტიური მხარდამჭერები („ლიმიტის გარეშე" subline) · სულ გუნდში ·
    მონახაზები (Draft) · რეიტინგში ადგილი („#N" + subline „N / M დელეგატი"). Definitions
    in §4.4; rank reuses the leaderboard's exact ranking math (`lib/ranking` over
    `public_delegates`) so the two surfaces can never disagree; pending delegates and
    zero-active ties render per that same math.
  - **Team CTA card** → `/delegate/team`.
- **Pending:** „მოლოდინში" pill; instead of the referral card, the pending explainer
  carried from `/join/pending` (🔗 link inactive until approval / 🙈 profile not public /
  ✅ what approval unlocks); the stat row renders zeroed with rank „—"; no team CTA.
  (Approval itself is Phase 4 tooling.)
- **Rejected:** danger notice „დელეგატის პროფილი უარყოფილია — დაგვიკავშირდი დეტალებისთვის."
  No link, no stats, no team. (No prototype contract exists; minimal by design.)

### 3.7 ჩემი გუნდი — `/delegate/team` (approved delegates; pending/rejected → `/delegate`)

Prototype `delegate-team`:

- Head: „შენს გუნდში **N** წევრი".
- Card „წევრების სია": search „ძებნა სახელით ან გვარით…", status filter (ყველა სტატუსი /
  აქტიური / რეგისტრირებული) — both client-side over the fetched list; table წევრი /
  რეგისტრაციის თარიღი / სტატუსი with the standard pills (active_member → „აქტიური" ok;
  profile_completed → „რეგისტრირებული" info). Date = the member's profile creation date.
- Empty state: „ჯერ არავინ დარეგისტრირებულა შენი ბმულით — გააზიარე ბმული და გუნდი აქ
  გამოჩნდება."
- No pagination in v1 (team sizes are hundreds at most on current data; revisit when
  real scale demands — recorded in §9).

## 4. Database (one migration)

### 4.1 Scoped profile re-grant (decision #5, the path Phase 2 prepared)

```
grant update (first_name, last_name, region_id, city_id, employment)
  on profiles to authenticated;
```

Three independent locks on this path: the column list above (Postgres rejects any other
column), the Phase-0 "own profile updatable" RLS policy (kept dormant by Phase 2 exactly
for this), and `protect_profile_columns()` (raises on any server-managed column, even if
a future migration fattens the grant). The composite FK `profiles(city_id, region_id) →
cities(id, region_id)` enforces city-in-region whenever both are set; the cabinet action
always writes the pair together, same discipline as the funnel (ADR-009 note stands).
No `insert`/`delete` grants — creation stays funnel-only.

### 4.2 `member_change_delegate(p_delegate_id uuid default null)` — definer RPC

Subject `auth.uid()`, single transaction, `set search_path = ''`, EXECUTE to
`authenticated` only (explicit revoke from `public, anon` — house pattern):

- Requires an existing, **completed** profile (`registration_completed_at is not null`
  or `status = 'active_member'`) → else `not_completed`; requires **no** `delegates` row
  → else `not_a_member` (delegates hold no membership).
- `null` = ცენტრალური მოძრაობა; otherwise the target must be an **approved** delegate →
  else `invalid_delegate`.
- Same delegate as the current open membership → no-op returning current state (no
  history row minted).
- Otherwise: close the open membership (`ended_at = now()`), insert the new row — the
  same close-then-open pattern `funnel_save_profile` uses; the
  `one_active_membership` partial unique index holds throughout. History is never
  deleted.
- Returns `funnel_state()`.

### 4.3 `member_change_tier(p_tier int)` — definer RPC

Same envelope. Requires a completed profile (members **and** delegates — both pay);
validates `p_tier in (5,10,20)`; updates `membership_tier` (the definer context passes
the protect-trigger, exactly like `funnel_complete`). Reference code, status, completion
timestamp untouched. Returns `funnel_state()`.

### 4.4 `delegate_panel()` — definer read RPC

Requires the caller's `delegates` row → else `not_a_delegate`. Returns jsonb:

- `status` — pending / approved / rejected;
- `referralCode` — the caller's own code (never exposed through any public view or
  table grant — this RPC is the only client path to it, preserving Phase 2's
  non-harvestable stance);
- `activeCount` — open memberships to the caller whose member is `active_member`
  (matches the public supporter count by construction);
- `totalCount` — all open memberships to the caller;
- `draftCount` — profiles with `signup_ref_code = <caller's code>` still in status
  `draft` (opened the link, started step 1, not yet reached step 2; from step 2 on they
  appear in the membership counts instead — no double counting).

Rank is deliberately **not** computed here: the dashboard derives it app-side with
`lib/ranking` over `public_delegates`, the leaderboard's own inputs.

### 4.5 `delegate_team()` — definer read RPC

Same gate. Returns jsonb array, newest first: `firstName`, `lastName`, `registeredAt`
(the member profile's `created_at`), `status` (`profile_completed` | `active_member`) —
for open memberships to the caller. Names, dates, statuses only: no phones, no personal
IDs, no tiers, no payment data.

### 4.6 Riders

- `funnel_start` gains the queued `p_ref_code` cap: values not matching
  `^[A-Za-z0-9-]{1,32}$` are stored as `null` (silent, matching the funnel's
  invalid-referral-degrades-silently semantics; mirrors `isReferralCodeCandidate`).
- `funnel_state()` is `create or replace`d to additionally return `status` (the enum
  text) and `registrationCompletedAt` — the cabinet needs both (status pill, „წევრი
  …-დან"); all existing keys unchanged (additive, funnel pages unaffected).

### 4.7 Verification probes (`scripts/verify-schema.mjs`)

New live probes: scoped update as `authenticated` **succeeds** on `employment` and
**fails** on `status` and `reference_code` (trigger raise); `member_change_delegate`
demonstrably closes-and-opens (membership history row count grows by one, old row gains
`ended_at`); `anon` cannot execute any new RPC; `delegate_panel` refuses a non-delegate
caller. Reuses the throwaway-user pattern the script already has.

## 5. Domain logic (`lib/`, pure, TDD)

- `lib/cabinet.ts` — `deriveDestination(state): string` (the §3.2 table, exhaustive over
  role × completion, legacy rows first-class exactly like `deriveFunnelStep`);
  employment preset↔form mapping (`employmentToForm` / `formToEmployment`, reusing the
  presets already exported by `lib/funnel-schemas.ts`); status → Georgian label maps for
  the team table / summary pill; payment `source` → method label („გადარიცხვა").
- `lib/cabinet-schemas.ts` — zod: `profileUpdateSchema` (names 1–60 trimmed; region/city
  ids; employment preset-or-other ≤100 — composed from the funnel's step-2 pieces, not
  duplicated), `changeDelegateSchema` (uuid | null), `changeTierSchema` (reuses the tier
  enum). Single source for client forms and server actions (house pattern).
- `lib/funnel.ts` — `FunnelState` gains `status` + `registrationCompletedAt`;
  `REFERENCE_CODE_RE` becomes derived from `FUNNEL_CODE_ALPHABET` (hygiene queue item).
- `buildReferralUrl(origin, code)` pure helper (tested; the client component feeds it
  `window.location.origin`).
- `lib/supabase/types.ts` — hand-maintained `Database` generic (tables, views, RPC
  signatures actually used by app code); all three client factories become typed
  (hygiene queue item).
- Server actions (`app/(member)/me/actions.ts`): `updateProfile` (zod → scoped update via
  the caller's cookie-bound client → Georgian error mapping), `changeDelegate`,
  `changeTier` (zod → RPC → mapping). Panel/team pages are server components calling the
  read RPCs with the caller's client. **No service-role usage anywhere in cabinet paths.**

## 6. Security & error handling

- **Auth gates server-side on every request** (cabinet layouts: session + completion +
  role), mirrored in-DB (RLS, trigger, definer-RPC checks). Client-side guards are UX
  only — house rule.
- The **scoped update path** is the only client-writable table surface, and it can touch
  exactly five columns of the caller's own row (§4.1's three locks). Everything else
  goes through definer RPCs that re-derive the subject from `auth.uid()`.
- **Referral codes stay non-harvestable**: own code via `delegate_panel()` only; no new
  table grants; public views unchanged. Team data (names/dates/statuses) is visible
  only behind the own-`delegates`-row gate.
- **Error mapping** extends the existing Georgian token map (`not_completed`,
  `not_a_member`, `not_a_delegate` join it); unknown failures keep the generic „რაღაც
  შეცდომა მოხდა — სცადე თავიდან" with state preserved (all writes atomic).
- **Session expiry** on a cabinet page → next request redirects to `/login` (server
  gate); after re-login the destination rule lands them back in the cabinet.
- Sign-out clears the Supabase session client-side and returns to `/`; the header swap
  (§3.1) reflects it immediately.
- The service worker needs **no change**: `/me` and `/delegate` have been NetworkOnly
  since Phase 0 (verified), and the public shell stays session-agnostic because the
  header swap is client-side.

## 7. Testing

- **Unit (Vitest, failing-first):** `deriveDestination` exhaustive matrix (roles ×
  progress × legacy rows); employment mapping round-trips (preset, custom text, empty);
  every cabinet zod schema accept/reject per field; `buildReferralUrl`;
  derived `REFERENCE_CODE_RE` still matches/rejects the Phase 2 fixtures; label maps.
- **Component:** cabinet nav (member vs delegate variants, active tab, sign-out
  present); profile form (prefill incl. preset vs „სხვა", validation messages, locked
  fields rendered read-only); delegate picker (central first, „(მიმდინარე)" marker,
  same-choice guard); tier control (reveal, save, cancel); team table (search, filter,
  empty state); QR component renders an SVG for a given URL.
- **e2e (Playwright vs staging, established isolation: per-run 55-block phones with the
  run-attempt digit, 9-prefixed personal IDs, canonical seed untouched):**
  1. **Member cabinet journey** — register fresh member → done screen (one-time) → lands
     in cabinet on next navigation → edits profile (city + employment) and sees it
     persisted after reload → changes delegate to a seeded approved delegate (current
     card updates; „(მიმდინარე)" moves) → changes tier 10→5 (instructions amount
     updates) → billing shows the GR-code + placeholder-marked instructions + empty
     history state.
  2. **Delegate lifecycle** — register fresh delegate → pending screen (one-time) →
     `/delegate` shows the pending panel (explainer, zeroed stats, no live link) →
     e2e helper flips **its own** delegate to approved via service role (seed untouched,
     deleted in teardown) → reload: live referral card with correct URL + QR present →
     a fresh member registers **through that referral link** → team table shows them
     („რეგისტრირებული" pill) and სულ გუნდში = 1, აქტიური = 0.
  3. **Routing handoff** — completed member: `/join` → cabinet; `/join/done` (direct,
     no marker) → cabinet; login → `/me/profile`; header shows „კაბინეტი"; a member
     opening `/delegate` bounces to `/me/profile`.
  - Existing funnel/login specs: assertions updated where destinations changed
    (completed users now land in the cabinet; profile-less login still → `/join`); all
    five Phase 2 journeys must stay green. The one-time celebration behavior keeps the
    existing "fresh completion shows done/pending" assertions valid.
- **Sequencing (Phase 1/2 discipline):** the migration is applied to staging **before**
  dependent e2e lands in CI; `verify-schema.mjs` probes (§4.7) run green at that moment.
- Login e2e **teardown fix** rides along: the login journey's auth user is now deleted
  in teardown like the funnel journeys' users (closes the one-orphan-per-run leak).

## 8. Hygiene riders

- **Staging sweep (one-time):** delete accumulated e2e leftovers on staging — login-e2e
  orphan auth users and any stray 55-block/9-prefix e2e users from past runs — via a
  guarded script (service role, pattern-scoped, dry-run first). The three known
  synthetic smoke users (+995551234567/8/9) are kept. The canonical 12-delegate seed is
  asserted untouched afterwards (`verify-schema` + spot counts).
- **Queue items folded in** (from Phase 2's final review): typed `Database` generic
  (§5); `p_ref_code` cap (§4.6); `getSeededReferral` gains `.order("id")`
  (deterministic pick); `REFERENCE_CODE_RE` derived from the alphabet (§5); remaining
  `OtpVerification` robustness minors — the unmount guard on `fetchDevOtp`, `resend()`
  busy-state, and the eslint-disable reason suffix — verified against current code at
  plan time (the `useFunnelGuard` `.catch` was already fixed in Phase 2's fix wave).
- **Component moves:** TransferInstructions relocates from `app/(public)/join/` to
  `components/` (now shared by `/join/done`, `/join/pending`, `/me/billing`). New
  shared components: CabinetNav (shell), QrCode, CopyButton. DESIGN.md inventory +
  `/styleguide` gallery updated.
- **Docs:** ARCHITECTURE.md gains a "Cabinets" section (route gates, mixed mutation
  model, panel read RPCs); DECISIONS.md appends ADR-011 (QR dependency: which package
  and why) and ADR-012 (mixed cabinet DB access model, decision #5 rationale);
  CHANGELOG + version bump to **v0.4.0**. Cabinet routes stay out of the sitemap
  (authed pages).

## 9. Out of scope

Phone change and personal-ID/birth-date editing (re-verification flows, unscheduled);
partial personal-ID display (zero-echo stance holds); delegate approval tooling, payment
recording, `active_member` derivation, reassignment (Phase 4); polls, news, events,
team-RSVP overview, transparency page (Phase 5); delegate public bio/photo editing
(Phase 4, with photos); member→delegate upgrade (unscheduled; completed members simply
never re-enter the funnel); real bank details, real SMS, final T&C text, prod Supabase
(Phase 6 checklist); team-table pagination (revisit at real scale); toast component
(inline notices per the established pattern). **One new npm dependency only — the QR
generator (ADR-011); nothing else.**

## 10. Rollout & sign-off

- Branch `claude/phase-3-cabinets-a070f4` (this worktree, off `main` @ `ef98cf7`);
  superpowers subagent-driven execution (fresh implementer + independent reviewer per
  task), whole-branch review at the end; single PR; CI green throughout (`npm run
  format` before every push — CI's format check is strict); merges as **v0.4.0**.
- **Migration step:** applied to staging via the **pooler host**
  (`postgres.orcxtbedkexoclbfgvzd@aws-0-eu-central-1.pooler.supabase.com:5432` — the
  direct host doesn't resolve on the owner's network). The owner adds
  `SUPABASE_DB_PASSWORD` to `.env.local` when asked (never in chat) and deletes the
  line afterwards.
- **Owner sign-off package** (plain language + URLs to click; DOM-verified evidence, no
  screenshots): Vercel preview link; a demo member walked through profile edit, delegate
  change and tier change — with the counter nuance spelled out (a delegate's **team**
  numbers move instantly; the public **rating** counts only active/paying members, so it
  moves when Phase 4 starts recording payments); a demo delegate's panel with the live
  link + QR and a second member registered **through that link** visible in the team
  table; instructions for the owner to try everything with any made-up `5XXXXXXXX`
  number (dev code appears on screen on previews).
- Owner explicitly approves in chat before merge. Branch protection on `main` remains
  the owner's two-minute task (re-verified unprotected and re-reminded 2026-07-15; not
  blocking).

## 11. Success criteria

- A completed member logs in and lands in the cabinet; `/join` and the completion URLs
  forward there; the funnel is demonstrably one-way.
- The member edits name/region/city/employment and the change persists; phone and
  personal ID are visibly locked; no client path can touch status, codes, tier, or
  completion columns except the sealed tier operation (probes prove it).
- Changing delegate keeps history (the old support row survives with an end date —
  demonstrable), takes effect instantly, and the delegate's team counts recompute; the
  member sees the change reflected in summary + current-delegate card.
- Changing tier updates the transfer-instructions amount immediately; the reference
  code never changes.
- The billing page shows the member's permanent GR-code, placeholder-marked bank
  details, and the honest empty history state.
- An approved delegate sees their live referral link + QR and real counts; a
  registration through that link appears in their team table; a pending delegate sees
  the pending panel with no live link; rank matches the leaderboard.
- All CI gates green including the updated Phase 2 journeys; owner sign-off recorded
  before merge.
