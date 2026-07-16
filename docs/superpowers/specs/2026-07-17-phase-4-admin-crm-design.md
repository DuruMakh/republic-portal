# Design Spec — Phase 4: Admin CRM

**Date:** 2026-07-17
**Status:** Approved in brainstorming (owner approved 9 product decisions, the access
model, and all 4 design sections).
**Parent spec:** `2026-07-12-republic-portal-production-design.md` (binding platform
spec; this document details its "Phase 4 — Admin CRM" row, §6 "Admin CRM", the §4
status-derivation rule, and the §5 roles).
**UX contract:** `prototype/index.html`, screens `admin-overview`, `admin-members`,
`admin-verify`, `admin-transfer`, `admin-finances` (markup ~912–1136, logic
~1966–2199). Copy, layout and behavior carry over unless stated otherwise.
**Known deviations from the prototype, all owner-approved:**

- Every number is real. MRR is the actual sum of active members' tiers (the prototype
  multiplied by an assumed 11 ₾ average); the tier-breakdown chart counts **active
  members by their current tier** (the prototype counted demo transactions).
- Member search matches name, phone **or GR-code** (prototype: name only); the status
  filter uses the real three-status vocabulary (prototype: active/draft); the table
  gains საწევრო and კოდი columns; real server-side pagination (50/page with controls)
  replaces the display-only 50-row cap.
- Personal IDs are **never rendered outright** (the prototype's verify queue showed
  fabricated ones). They are masked everywhere with an audited click-to-reveal —
  verifier/super_admin in the verification queue, super_admin in the member list.
  Phones render outright (contact data, needed for the job; not in the reveal regime).
- The verification screen gains **დამტკიცებული** and **უარყოფილი** tabs (prototype:
  pending only). Rejection stores an optional internal note and is **reversible**
  (re-approve after the applicant contacts the team). Bio/photo editing lives under
  დამტკიცებული.
- ფინანსები gains the entire **recording surface** (single entry + bulk paste
  matching) — the prototype's transactions were demo fiction. Its table adds თვეები,
  ვინ აღრიცხა and a void action; სტატუსი shows აქტიური/გაუქმებული instead of a
  hardcoded „წარმატებული".
- Three screens the prototype never had, mandated by the parent spec: **ადმინები**
  (admin-user management), **აუდიტი** (audit-log viewer), **პარამეტრები** (the
  admin-configurable active rule).
- Prototype toasts become inline confirmations/notices (house pattern since Phase 2).

---

## 1. Goal

Give the movement its operational cockpit: verify delegate applications (approval
mints the public slug and makes the delegate + referral link live instantly), manage
and export the member roster with personal IDs behind audited reveals, record manual
bank payments (single and bulk-paste matching by GR-XXXXXX codes) feeding a new
**active-member derivation engine** that replaces the staging seed as the only writer
of active status, reassign „ცენტრალური მოძრაობა" members to delegates with full
membership history, and put all of it behind database-enforced RBAC with an
append-only audit trail and viewer.

## 2. Decisions locked in brainstorming (owner-approved)

| # | Decision | Choice |
|---|---|---|
| 1 | Active window | A single monthly payment keeps a member active **60 days** total. Engine shape: each paid month = 30 days of coverage, plus a **grace period** (default 30 days) after coverage ends. Grace is the admin-configurable value (პარამეტრები) |
| 2 | Amount buys months | `months = floor(amount ÷ tier at recording), minimum 1`. Payments **stack** (a new payment extends from the later of current coverage-end and its own date). Underpayment still buys the minimum 1 month — finance sees the amount while recording |
| 3 | Bulk input | **Paste rows** (from any bank site/Excel). Parser extracts GR-code, amount, date per line; preview → confirm. CSV upload deferred until the real bank account exists |
| 4 | Export | **Generic CSV** (UTF-8 BOM so Excel renders Georgian correctly), honoring active filters. The Ministry-of-Justice template is a follow-up once the owner supplies the official form |
| 5 | Personal IDs | Masked everywhere; **click-to-reveal**, one audit row per reveal. Exactly **two** paths in the platform can return a personal ID, both audited: the reveal RPCs and the super_admin export |
| 6 | RBAC matrix | super_admin: everything. verifier: queue + delegate bio/photo + reassignment + member list (masked), reveal only in the queue. finance: payment recording + member list (masked) + CSV export (never with IDs). editor: grantable, **no Phase 4 surface** (Phase 5) |
| 7 | Overview dashboard | Prototype parity with real numbers (4 stat cards, recent payments, top regions, queue shortcut) |
| 8 | Delegate bio/photo | **Admin-side editing only** this phase (verifier/super_admin); delegate self-serve is a later follow-up |
| 9 | Rejection | **Reversible**; optional internal note stored with the decision, visible to admins only (the rejected cabinet keeps Phase 3's generic „დაგვიკავშირდი" copy) |
| 10 | Access model | **Locks in the database.** Admin reads via self-gating definer views that never contain personal-ID columns; every admin mutation is a SECURITY DEFINER RPC that re-checks the caller's role and writes its audit row **in the same transaction** (extends ADR-009/ADR-013; recorded as ADR-014) |

## 3. Screens

All admin pages are authed, dense/utilitarian register (DESIGN.md: calm surfaces, red
only for primary actions), Georgian, design-system components only. The route group is
`app/(admin)/admin/*`; the layout enforces **session + at least one admin role
server-side on every request** (per-request rendering is safe: `/admin` has been in
the service worker's NetworkOnly prefixes since Phase 0 — verified). Mutations are
thin zod-validated server actions in front of the §4 RPCs.

### 3.1 Shell and navigation

- **AdminNav** (new component): eyebrow „ადმინისტრირება", tabs filtered by the
  caller's roles, and the same გასვლა sign-out as CabinetNav.
  - Tabs → roles: მიმოხილვა · წევრები (super_admin/verifier/finance) ·
    ვერიფიკაცია (verifier/super_admin) · ფინანსები (finance/super_admin) ·
    ტრანსფერი (verifier/super_admin) · ადმინები · აუდიტი · პარამეტრები
    (super_admin only).
- A user holding **only** `editor` passes the layout gate but every tab is absent;
  they see a single notice: „შენი განყოფილება (სიახლეები და ღონისძიებები) მე-5 ფაზაში
  ჩაირთვება." — no dead links (Phase 3's "no stub entries" rule).
- Non-admins (and signed-out visitors) never see the area: the layout redirects them
  through `deriveDestination` (members → cabinet, no session → `/login`).
- **CabinetNav rider:** admins see an extra „ადმინისტრირება" tab (→ `/admin`) in
  their own cabinet. `funnel_state()` gains an additive `admin: boolean` so the
  cabinet learns this without new queries.
- The layout reads the caller's own roles via a new own-rows RLS policy on
  `admin_roles` (§4.6) — used for the gate and tab filtering. App-side checks are
  UX; the database re-checks everything (§4).

### 3.2 მიმოხილვა — `/admin`

Prototype `admin-overview` with live data:

- **4 stat cards:** დამტკიცებული დელეგატი · აქტიური წევრი · ვერიფიკაციის მოლოდინში
  (red card) · **სავარაუდო MRR** = sum of `membership_tier` over currently-active
  members (real, not estimated).
- **ბოლო ტრანზაქციები** card: the 6 most recent non-voided payments (member, amount,
  date) with „ყველა →" to `/admin/finances`.
- **ვერიფიკაციის რიგი** card (red well): pending count + „გადადი ვერიფიკაციაზე →".
- **წევრები მხარეების მიხედვით:** top-5 regions by member count with proportion bars.

Reads: `admin_overview` + `admin_region_stats` + `admin_payments` (§4.2).

### 3.3 წევრები — `/admin/members`

Prototype `admin-members`:

- **Filter card:** search (ძებნა — matches first/last name, phone, or GR-code),
  region select, status select (ყველა სტატუსი / აქტიური / რეგისტრირებული /
  მონახაზი), and the **ექსპორტი (CSV)** button.
- **Table:** სახელი გვარი · რეგიონი · დელეგატი (name or „ცენტრალური მოძრაობა") ·
  საწევრო · კოდი (GR-XXXXXX) · სტატუსი (standard pills) · თარიღი (registration).
  Server-side pagination, 50/page, with „ნაჩვენებია X–Y / Z" and წინა/შემდეგი
  controls. Default order: newest first.
- **Personal-ID reveal (super_admin only):** an actions column shows ჩვენება per row;
  clicking calls the reveal RPC — the full ID renders inline for that row only, one
  `member.reveal_personal_id` audit row per click. Other roles see no reveal control
  (and the database refuses them regardless).
- **Export:** finance/super_admin. Honors the current search/region/status filters.
  super_admin additionally sees a „პირადი ნომრების ჩართვა" checkbox (default **off**).
  Download via a route handler streaming CSV built from the export RPC (§4.5) — one
  `member.export` audit row records filters, row count, and whether IDs were included.
  Columns: სახელი, გვარი, ტელეფონი, რეგიონი, ქალაქი, დელეგატი, სტატუსი, საწევრო,
  კოდი, რეგისტრაციის თარიღი (+ პირადი ნომერი only when the checkbox was on).
  Birth dates are not exported (least data; the MoJ follow-up will revisit).

Reads: `admin_members` (§4.2 — the view physically lacks `personal_id`/`birth_date`).

### 3.4 ვერიფიკაცია — `/admin/verify`

Prototype `admin-verify` extended with three tabs (მოლოდინში default):

- **მოლოდინში:** cards per the prototype — initials avatar, name, „მოლოდინში" pill,
  region, then პირადი ნომერი (masked ••••••••••• + ჩვენება for verifier/super_admin →
  `delegate.reveal_personal_id` audit row), ტელეფონი (outright), რეგისტრაცია date.
  Buttons: **უარყოფა** (danger; opens an optional internal-note field ≤500 chars +
  confirm) and **დადასტურება** (primary).
  - **Approve** = the server action computes the slug with `makeSlug` (lib/slug.ts,
    Phase 1, finally consumed) over the taken-slug set, then calls
    `admin_approve_delegate` (§4.5). Effects, atomic: status → approved, slug set,
    `verified_at`/`verified_by` stamped, audit `delegate.approve`. The delegate
    appears on the public directory/leaderboard and their referral link activates
    **instantly** (both key on `status = 'approved'` — no extra wiring). Inline
    success: „დელეგატი დამტკიცდა ✓" + a link to the live public page
    (`/delegates/<slug>`).
  - **Reject** = `admin_reject_delegate`: status → rejected, note stored (internal),
    `verified_at`/`verified_by` stamped, audit `delegate.reject`. The applicant's
    cabinet shows Phase 3's rejected panel (unchanged copy).
- **დამტკიცებული:** table/cards of approved delegates (name, region, slug link,
  photo-present indicator, supporter count) with **რედაქტირება** →
  `/admin/verify/[id]`: bio textarea (≤1000 chars) + photo upload (JPEG/PNG/WebP,
  ≤5 MB) with current-photo preview → შენახვა calls `admin_update_delegate_profile`
  (audit `delegate.update_profile`). Photos go to the `delegate-photos` Storage
  bucket via the server (§4.8); filenames are versioned (`{id}-{timestamp}.{ext}`)
  so caches never serve a stale photo; the previous object is best-effort deleted
  after commit. Public pages keep `<img>` (next/image stays deferred to Phase 6).
- **უარყოფილი:** the same applicant cards plus the stored note and the decision
  stamp; a **დადასტურება** button re-approves (same RPC — it accepts pending **or**
  rejected; the audit row records the prior status). Un-approving an approved
  delegate is explicitly out of scope (§9).

Empty states per tab, prototype-style („ვერიფიკაციის მოლოდინში დელეგატები არ არის" etc.).
Reads: `admin_delegate_queue` (§4.2).

### 3.5 ფინანსები — `/admin/finances`

Recording first (the daily job), statistics below.

- **ერთეული აღრიცხვა card:** member lookup (one input — exact GR-code or name/phone
  search over `admin_members`, finance/super_admin) → picked member summary (name,
  region, tier, current status) → fields: თანხა (₾, 0.01–10,000, two decimals),
  თარიღი (default today, never future), საბანკო რეფერენსი (optional, ≤64) → a live
  preview line „→ N თვე" (client math mirrors the engine; server recomputes) →
  **აღრიცხვა** calls `admin_record_payment`. Inline confirmation with the result:
  „აღირიცხა — 3 თვე · წევრი ახლა აქტიურია ✓".
- **ბალკ შესატყვისება card:** textarea („ჩასვი ამონაწერის სტრიქონები…") → გადამოწმება
  parses server-side (lib/bank-parse.ts, §5) → **preview table**, one row per pasted
  line: the raw line, extracted კოდი/თანხა/თარიღი, and a status pill —
  ✓ ნაპოვნია (member name + „→ N თვე") · კოდი ვერ მოიძებნა · უცნობი კოდი ·
  დუბლიკატი (bank reference already recorded) · გაურკვეველი თანხა (ambiguous —
  parser refuses to guess between multiple numbers) · დაუსრულებელი რეგისტრაცია.
  A summary line counts each kind. **დადასტურება** records exactly the ✓ rows via
  `admin_record_payments_bulk` — **all-or-nothing** (any server-side failure lands
  nothing and returns the failing rows). Non-✓ rows stay on screen for manual
  single-entry handling. Identical duplicate lines within one paste are collapsed
  (recorded once, marked).
- **Statistics (prototype parity, honest):** stat cards — თვიური შემოსავალი (MRR:
  sum of active members' tiers) · აქტიური გამომწერი · საშ. შენატანი (MRR ÷ active);
  **განმეორებადი შენატანები დონეების მიხედვით** bars = active members per current
  tier; **ტრანზაქციები** table: თარიღი · წევრი · თანხა ₾ · თვეები · მეთოდი
  („გადარიცხვა" for the manual source) · ვინ აღრიცხა · სტატუსი (აქტიური / გაუქმებული) ·
  action **გაუქმება** (finance/super_admin; requires a reason 3–500 chars) →
  `admin_void_payment`. 20/page pagination. Voided rows stay visible, struck
  through, with the reason on hover/expand.

Reads: `admin_finance_stats` + `admin_payments` (§4.2).

### 3.6 ტრანსფერი — `/admin/transfer`

Prototype `admin-transfer` (verifier/super_admin):

- Info banner verbatim from the prototype (why orphans exist, what reassignment does).
- „ობოლი წევრები: N" note; **table** of completed members whose current membership is
  central (delegate_id null): წევრი · რეგიონი · მიმღები დელეგატი (select of the
  member's region's **approved** delegates; when none — the prototype's „ამ მხარეს
  დამტკიცებული დელეგატი არ ჰყავს" note and a disabled button) · **გადანაწილება** →
  `admin_reassign_member`: closes the open central membership row, opens the new one
  (exact ADR-013 close-then-open semantics — history never deleted), audit
  `member.reassign`. The row disappears; counters everywhere recompute because they
  are always computed. 50/page pagination.
- Empty state per the prototype („ყველა წევრი გადანაწილებულია ✅").
- The region filter is UX (house stance since the funnel): the RPC accepts any
  **approved** delegate as backstop-consistent behavior.

### 3.7 ადმინები — `/admin/admins` (super_admin only)

- **Current admins** table: name, phone, role pills, granted date + by whom; each
  role pill has a remove ✕ → `admin_revoke_role` (audit `admin.revoke_role`).
  Lockout guard: the RPC **refuses to remove the last super_admin**
  (`last_super_admin` error → „ბოლო super_admin-ის მოხსნა შეუძლებელია").
- **Grant** card: phone lookup of a member who finished registration (exact match
  over `admin_members`) → member summary → role select (super_admin / verifier /
  finance / editor with one-line Georgian duty descriptions) → მინიჭება →
  `admin_grant_role` (audit `admin.grant_role`; granting an already-held role is a
  friendly no-op). Admins must already be registered, completed members — roles
  attach to profiles (Phase 0 schema), and the RPC requires completion (§4.5).
- **Bootstrap:** the very first super_admin is granted by `scripts/grant-admin.mjs`
  (service role, by phone, staging first; documented one-time step like seeding).
  After that, everything happens on this screen.

### 3.8 აუდიტი — `/admin/audit` (super_admin only)

- Reverse-chronological table over `admin_audit` (§4.2): დრო · ვინ (actor name, or
  „სისტემა" for the sweep) · მოქმედება (Georgian labels from the §4.4 taxonomy) ·
  ობიექტი (resolved name for profiles/delegates/payments where possible, else raw
  type+id) · დეტალები (expandable pretty JSON).
- Filters: action type (select over the taxonomy), actor (select over admins),
  date from/to. 50/page pagination.
- Append-only is already DB-enforced since Phase 0 (update/delete trigger raises).

### 3.9 პარამეტრები — `/admin/settings` (super_admin only)

- One setting this phase: **active_grace_days** (int 0–365, default 30), presented as
  a plain sentence: „წევრი აქტიურია გადახდილი პერიოდის ბოლოდან კიდევ **N დღე**" with
  a live example („20 ₾ ერთი თვის საწევრო, გადახდილი 1 ივლისს → აქტიურია 30 აგვისტომდე").
- შენახვა → `admin_update_setting` → validates, upserts `app_settings`, audit
  `settings.update` {old → new}, and **recomputes every member's status in the same
  transaction** — the change is visible platform-wide immediately.
- Shows who last changed it and when.

## 4. Database (one migration)

### 4.1 Role helpers

`has_admin_role(p_role text)` and `has_any_admin_role(variadic p_roles text[])` —
`security definer, stable, set search_path = ''`, checking `admin_roles` for
`auth.uid()`. Used as the gate inside every §4.2 view (`where has_any_admin_role(…)`)
and re-checked first inside every §4.5 RPC. EXECUTE granted to `authenticated` only
(house revoke pattern).

### 4.2 Admin read views (definer-style, like `public_delegates`)

All owner-executed views that (a) self-gate on the caller's role — non-admins get
**zero rows**, and (b) **never include `personal_id` or `birth_date`**. `select`
granted to `authenticated`; PostgREST supplies filtering/search/order/pagination.

| View | Gate | Contents |
|---|---|---|
| `admin_overview` | staff¹ | one row: approved_delegates, pending_delegates, active_members, total_completed, mrr_gel |
| `admin_region_stats` | staff¹ | region name + member count (completed members), for the top-regions bars |
| `admin_members` | staff¹ | profile id, first/last name, phone, region id+name, city name, current delegate id+name (null = central), status, membership_tier, reference_code, created_at, registration_completed_at, is_delegate flag |
| `admin_delegate_queue` | verifier, super_admin | delegate id, name, region, phone, status, slug, bio, photo_url, review_note, tc_accepted_at, created_at, verified_at, verifier name, active/total supporter counts |
| `admin_payments` | finance, super_admin | payment id, member id+name+reference_code, amount_gel, months_covered, paid_at, bank_reference, source, recorded_by name, created_at, voided_at/by name/reason |
| `admin_finance_stats` | finance, super_admin | one row: mrr_gel, active_count, tier5/tier10/tier20 active-member counts (average is derived in-app: mrr ÷ active) |
| `admin_settings` | super_admin | key, value, updated_at, updated-by name (the sealed `app_settings` table's read path) |
| `admin_admins` | super_admin | user id, name, phone, role, granted_at, granted-by name (one row per held role) |
| `admin_audit` | super_admin | audit id, created_at, actor id+name, action, target_type, target_id, resolved target label (profile/delegate/payment names via left joins), details |

¹ staff = super_admin | verifier | finance (deliberately not editor).

### 4.3 Payments and delegates alterations

- `payments` gains: `tier_gel_at_payment smallint not null check (tier_gel_at_payment
  in (5,10,20))` (snapshot at recording — later tier changes never rewrite history);
  `months_covered int generated always as (greatest(1, floor(amount_gel /
  tier_gel_at_payment)::int)) stored` (derived **in the database from immutable
  facts** — no editable derivable column, single source for engine/views/cabinet);
  `voided_at timestamptz`, `voided_by uuid references profiles(id)`,
  `void_reason text`.
- The table is empty today (recording starts this phase), so the not-null addition is
  safe; the staging seed (§8) populates it.
- **Dedup index:** `create unique index payments_bank_ref_live on
  payments(bank_reference) where bank_reference is not null and voided_at is null` —
  double-pasting a statement cannot double-record; voiding frees the reference for a
  corrected re-entry.
- **Engine index:** `payments(member_id, paid_at)`.
- **FK rider:** `payments.member_id` becomes `on delete cascade` (matching
  `memberships`). The platform has no member-deletion flow; deletion happens only for
  e2e/staging cleanup, which today would trip the plain FK. The audit trail survives
  deletions by design (audit targets are type+text-id, not FKs).
- `delegates` gains `review_note text` (internal rejection note).
- `app_settings` table: `key text primary key, value jsonb not null, updated_at
  timestamptz not null default now(), updated_by uuid references profiles(id)`;
  RLS enabled, **no client grants** (definer paths only); migration seeds
  `('active_grace_days', '30')`.

### 4.4 The active-member engine

- `active_coverage(p_member uuid) → date` (definer, stable): folds the member's
  **non-voided** payments in `paid_at` order:
  `coverage_end = greatest(prev_end, paid_at) + months_covered × 30 days` — pure
  date arithmetic (no timezones; `paid_at` is a date).
- `recompute_member_active(p_member uuid)`: a **completed** member (registration
  finished) is `active_member` iff `current_date ≤ coverage_end + active_grace_days`,
  else `profile_completed`. **Never touches drafts, never demotes below
  profile_completed, never promotes a draft** — the funnel owns draft →
  profile_completed; this engine owns profile_completed ⇄ active_member. Runs inside
  every payment/void RPC for the affected member.
- `recompute_all_active()`: set-based whole-table recompute; runs on settings change
  (same transaction) and from the seed.
- `active_sweep()`: the nightly demotion (members whose window lapsed with no
  intervening write); writes **one** audit row `system.active_sweep {demoted: N}`
  only when N > 0 (actor null = „სისტემა").
- **Scheduling:** `pg_cron` (`create extension if not exists pg_cron` +
  `cron.schedule('active-member-sweep', '0 1 * * *', 'select public.active_sweep()')`
  — 05:00 Tbilisi). Named risk: staging has never used pg_cron; the plan verifies it
  on staging **before** dependent work, with the documented fallback of a Vercel cron
  route calling the same function (same behavior, different trigger). Recorded in
  ADR-015 either way.
- Sole-writer rule: after this phase, only these functions (and the funnel's
  draft→profile_completed step) write `profiles.status`. The seed stops writing it
  (§8). The Phase 0 protect-columns trigger keeps clients out (unchanged).

### 4.5 Mutation RPCs

All: `security definer`, `set search_path = ''`, `revoke from public/anon`,
`grant execute to authenticated`, **role check first**, all effects + **audit row in
one transaction**, error tokens for the Georgian map (§5). Subject of every audit row:
`auth.uid()`.

| RPC | Role | Behavior (concise) |
|---|---|---|
| `admin_approve_delegate(p_delegate_id, p_slug)` | verifier, super_admin | target pending **or** rejected → approved; slug = existing or p_slug (unique violation → `slug_taken`, action regenerates with the next suffix and retries); stamps verified_at/by; audit `delegate.approve` {slug, prior_status} |
| `admin_reject_delegate(p_delegate_id, p_note)` | verifier, super_admin | target pending → rejected; stores review_note; stamps verified_at/by; audit `delegate.reject` |
| `admin_update_delegate_profile(p_delegate_id, p_bio, p_photo_url)` | verifier, super_admin | target approved; updates bio/photo_url; audit `delegate.update_profile` {changed fields} |
| `admin_record_payment(p_member_id, p_amount_gel, p_paid_at, p_bank_reference)` | finance, super_admin | member must be completed (has reference_code); inserts payment with tier snapshot; recomputes the member; audit `payment.record` {amount, months, bank_ref}; returns months + new status for the inline confirmation |
| `admin_record_payments_bulk(p_rows jsonb)` | finance, super_admin | ≤500 rows; re-validates **every** row in-DB (codes resolve, refs unique incl. within the batch, members completed); any failure → whole batch rejected with failing rows identified; else inserts all + recomputes affected members; audit: one `payment.record` row per payment {batch_id} + one `payment.bulk_record` summary {count, total_gel} |
| `admin_void_payment(p_payment_id, p_reason)` | finance, super_admin | not already voided; reason required; sets voided_at/by/reason; recomputes the member; audit `payment.void` {reason} |
| `admin_reassign_member(p_member_id, p_delegate_id)` | verifier, super_admin | member completed, not a delegate, has an open membership; target approved; same-target → friendly no-op; close-then-open (ADR-013); audit `member.reassign` {from, to} |
| `admin_reveal_personal_id(p_member_id)` | super_admin | returns the personal ID; audit `member.reveal_personal_id` — one row per call, always |
| `admin_reveal_applicant_personal_id(p_delegate_id)` | verifier, super_admin | target must hold a delegates row; returns the personal ID; audit `delegate.reveal_personal_id` |
| `admin_export_members(p_search, p_region_id, p_status, p_include_ids)` | finance, super_admin; `p_include_ids` additionally requires super_admin | returns the filtered roster as jsonb (IDs only when allowed); **one** audit row `member.export` {filters, row_count, include_ids}. The route handler streams it as CSV |
| `admin_grant_role(p_user_id, p_role)` | super_admin | target is a completed member; role in the four; upsert-style friendly no-op when held; audit `admin.grant_role` |
| `admin_revoke_role(p_user_id, p_role)` | super_admin | removing the **last** super_admin → `last_super_admin` error; audit `admin.revoke_role` |
| `admin_update_setting(p_key, p_value)` | super_admin | whitelist: `active_grace_days` int 0–365; upsert + audit `settings.update` {old, new} + `recompute_all_active()` in the same transaction |

**Audit taxonomy (fixed vocabulary, Georgian labels in lib/admin.ts):**
`delegate.approve`, `delegate.reject`, `delegate.update_profile`,
`delegate.reveal_personal_id`, `member.reveal_personal_id`, `member.export`,
`member.reassign`, `payment.record`, `payment.bulk_record`, `payment.void`,
`admin.grant_role`, `admin.revoke_role`, `settings.update`, `system.active_sweep`.

### 4.6 Grants and RLS riders

- **Personal-ID lockdown:** `revoke select on profiles from authenticated`, then
  re-grant `select` on the explicit column list — everything **except `personal_id`
  and `birth_date`**. Verified safe: no client-path code selects either (they are
  write-only through `funnel_save_profile`; Phase 3 established the platform never
  echoes them). After this migration the two §2-decision-5 paths are the only ways
  any client session can obtain a personal ID.
- **admin_roles:** new RLS policy `own roles readable` (`user_id = auth.uid()`) +
  `grant select on admin_roles to authenticated` — the layout/nav read only their own
  rows. Cross-user visibility exists solely through the super_admin-gated
  `admin_admins` view.
- `audit_log`, `app_settings`: RLS on, **no client grants** (reads via gated views /
  definer paths only; writes via RPCs only).
- `funnel_state()` rider: additive `admin` boolean (any admin_roles row exists).

### 4.7 Verification probes (`scripts/verify-schema.mjs`)

New live probes, reusing the established throwaway-user + canonical-actor patterns:
a non-admin authenticated user gets **zero rows** from every §4.2 view and a refusal
from every §4.5 RPC; a verifier session is refused finance RPCs (including the export
RPC); **no admin view exposes personal_id/birth_date** (column-list
assertion); the base-table grant no longer includes them (42501 on direct select);
reveal RPCs demonstrably append audit rows (canonical staging admins act — audit rows
must reference permanent actors, since audit_log is append-only and actor_id is a
plain FK); `admin_record_payments_bulk` with one bad row lands nothing;
`payments_bank_ref_live` blocks a duplicate reference; voiding frees it;
`recompute_member_active` matches lib/active.ts on shared fixtures (dates, stacking,
grace, void); the sweep demotes a synthetically-expired member; the last-super_admin
guard refuses; e2e-created users hold no admin roles (deletability invariant).

### 4.8 Storage

Migration inserts the `delegate-photos` bucket (`public = true`) idempotently. No
client storage policies — writes go exclusively through the admin server action
(app-side role precheck → service-role upload → `admin_update_delegate_profile` RPC
re-checks in-DB and records the URL + audit). Public read via the bucket's public
URLs (photos are public content on delegate pages). Probe: bucket exists and is
public.

## 5. Domain logic (`lib/`, pure, TDD)

- `lib/active.ts` — the engine's TS mirror (client previews + the fixture source the
  SQL probe compares against): `monthsFor(amountGel, tierGel)` (= max(1,
  floor(amount/tier))), `computeCoverage(payments, graceDays, today)` →
  `{coverageEnd, activeUntil, isActive}`; date-only math; void-aware.
- `lib/bank-parse.ts` — `parseStatementRows(text)`: per line, extract GR-code (regex
  derived from `FUNNEL_CODE_ALPHABET` — single source with Phase 2), amount
  (dot/comma decimals, thousands separators; **conservative**: multiple plausible
  candidates → `ambiguous_amount`, never guess), optional date (dd.mm.yyyy /
  yyyy-mm-dd; absent → recording date); collapse identical duplicate lines;
  row problems typed for the preview pills.
- `lib/csv.ts` — RFC-4180 escaping + UTF-8 BOM; `membersExportColumns(includeIds)`;
  filename `tsevrebi-YYYYMMDD.csv`.
- `lib/admin.ts` — role types, `canSeeTab(roles, tab)` (UX filtering only), audit
  action → Georgian label map, target-type labels, payment/source/status label reuse
  from `lib/cabinet.ts`.
- `lib/admin-schemas.ts` — zod for every boundary: approve/reject (uuid, note ≤500),
  delegate profile (bio ≤1000), record payment (uuid, amount 0.01–10,000 two-decimal,
  paid_at not future + not before 2026-01-01, bank_reference ≤64), bulk confirm
  (≤500 rows), void (reason 3–500), reassign, grant/revoke (role enum), settings
  (int 0–365), export params, photo constraints (type/size).
- Server actions under `app/(admin)/admin/**/actions.ts`: thin zod → own-roles UX
  precheck → RPC → Georgian error mapping. New error tokens join the house map:
  `missing_role`, `slug_taken` (internal retry), `not_completed`, `invalid_target`,
  `already_voided`, `duplicate_reference`, `last_super_admin`, `invalid_setting`.
- `lib/supabase/types.ts` — Database type gains the new views/RPCs/columns
  (hand-maintained per ADR-005/ADR-012).

## 6. Security & error handling

- **Four independent locks** on every admin surface: the layout gate (session + role,
  per request), the self-gating views (zero rows for non-admins), the RPC role
  re-checks (in-DB, per mutation), and the personal-ID column lockdown (§4.6). The
  service-role key appears **only** in the photo-upload server action (behind the
  app-side role precheck + in-DB re-check of the paired RPC) and in existing
  scripts — no admin page ever renders from a service-role read (CLAUDE.md rule).
- **Audit completeness is structural:** the audit insert lives inside the same
  database transaction as the mutation — an unaudited admin action is impossible by
  construction, including bulk (per-payment rows + summary).
- **Personal IDs:** masked render + audited reveal only (two RPC paths); never in
  views, exports default to excluded, `no-store` on reveal/export responses; the
  member table renders reveal controls only to super_admin (UX) while the DB refuses
  everyone else (security).
- Reveal/export are super_admin/finance-trusted actions — no rate limiting v1
  (audited instead); revisit at the Phase 6 /cso audit.
- **Error mapping:** token → Georgian, unknown → generic „რაღაც შეცდომა მოხდა — სცადე
  თავიდან" with state preserved (all writes atomic). Form state survives failures.
- Session expiry mid-action → next request bounces to `/login` (server gate), same as
  cabinets.
- The service worker needs **no change**: `/admin` has been NetworkOnly since Phase 0
  (verified in `app/sw.ts` PROTECTED_PREFIXES).

## 7. Testing

- **Unit (Vitest, failing-first):** lib/active.ts — the §2 date examples verbatim
  plus stacking, underpayment minimum, grace boundary (day 60 active / day 61 not),
  void exclusion, tier-snapshot math; lib/bank-parse.ts — extraction across formats
  (TSV paste, comma decimals, thousands separators, code-only lines, multi-number
  ambiguity, date variants, duplicate collapse); lib/csv.ts — escaping, BOM,
  ID-inclusion columns; lib/admin.ts maps; every lib/admin-schemas.ts schema
  accept/reject per field.
- **Component:** AdminNav (role → tabs matrix, editor-notice case), reveal button
  (masked → revealed → error states), bulk preview table (every row-status pill),
  export control (checkbox only for super_admin), verify card (approve/reject/note
  flows), settings form, pagination controls.
- **DB probes:** §4.7 list, run green on staging before dependent e2e lands in CI
  (Phase 1–3 discipline).
- **e2e (Playwright vs staging; established per-run isolation — 55-block phones with
  the run-attempt digit, 9-prefixed personal IDs, canonical seed untouched; canonical
  seeded admin accounts for the three roles act as actors):**
  1. **Delegate approval (critical flow):** fresh delegate registers → seeded
     verifier opens /admin/verify, reveals the applicant's personal ID (audited),
     approves → public page live at the generated slug, delegate visible in the
     directory, referral link active (a fresh member registers through it), panel
     flips approved; second applicant: reject (with note) → rejected tab → re-approve.
  2. **Payment recording (critical flow):** fresh member registers → seeded finance
     admin records a single payment by GR-code → member turns აქტიური (cabinet
     billing row, public counters, leaderboard) → bulk paste (2 valid rows + unknown
     code + duplicate reference + no-code line) → preview classifies all five
     correctly → confirm → exactly 2 recorded → void one (reason) → statuses
     recompute; member's cabinet shows the voided row as გაუქმებული.
  3. **RBAC smoke:** verifier session is refused finance surfaces (server-side, not
     just hidden tabs); an ordinary member hitting /admin is bounced to their
     cabinet; editor-only admin sees the Phase 5 notice.
  - Existing suites (funnel, cabinet, delegate-panel, login, public, smoke) must stay
    green; the seed-count assertions they rely on move to derived numbers (§8).
- **Sequencing:** migration → staging → seed rewrite → probes green → e2e in CI.

## 8. Hygiene riders

- **Seed rewrite (`scripts/seed-staging.mjs`):** stops writing `status:
  'active_member'`; instead generates deterministic payment histories (varied tiers,
  paid_at offsets inside/outside the window) and runs `recompute_all_active()`; the
  script asserts the **derived** active count equals the expected constant (same
  spirit as today's 1636 assertion, new number fixed at implementation). Adds the
  three canonical admin accounts (super_admin / verifier / finance; fixed 55-block
  phones documented in the script). Staging activity now decays honestly over time;
  reseeding refreshes it (documented in the script header).
- **Member cabinet touch:** /me/billing's history table marks voided rows
  „გაუქმებული" (Phase 3 shipped the table; this is the honest-void rider, decided in
  brainstorming §2).
- **Docs:** ARCHITECTURE.md gains the Admin CRM section (gates, views+RPC model,
  engine, sweep); DESIGN.md + /styleguide gain AdminNav and the new admin table
  patterns; DECISIONS.md appends **ADR-014** (admin access model: self-gating definer
  views + in-transaction-audit RPCs; personal-ID column lockdown) and **ADR-015**
  (active-member engine semantics: 30-day months, min-1, stacking, grace setting,
  pg_cron sweep + fallback decision); CHANGELOG + version bump to **v0.5.0**.
- **Zero new npm dependencies** (CSV, parsing, storage, cron all hand-rolled or
  platform-side — first phase since Phase 2 to add none).
- Admin routes stay out of the sitemap (authed, like cabinets).

## 9. Out of scope

Ministry-of-Justice export template (awaits the official form — owner supplies);
CSV/Excel file upload for bulk matching (awaits the real bank account); delegate
self-serve bio/photo editing (follow-up); un-approving an approved delegate
(product decision deferred — public page + team consequences need their own design);
bulk multi-select reassignment; a member detail page; member deletion flows; audit
retention/archival; rate limiting on reveals (Phase 6 /cso revisit); applicant
notifications (no SMS in v1); editor-role surfaces (Phase 5); payment gateway
(post-launch per ADR-003); column-level PII encryption (Phase 6 /cso); multi-month
proration or refunds beyond void.

## 10. Rollout & sign-off

- Branch `claude/phase-4-admin-crm-1fd359` (this worktree, off `main` @ `8b8b21c`);
  superpowers subagent-driven TDD execution (fresh implementer + independent reviewer
  per task), whole-branch review at the end; single PR; CI green throughout
  (`npm run format` before every push); merges as **Phase 4 — Admin CRM (v0.5.0)**.
- **Migration step:** applied to staging first, via the same documented pooler
  procedure as Phase 3 (§10 there); then the seed rewrite repopulates staging with
  engine-derived statuses; probes green; only then the e2e suite lands in CI.
  pg_cron availability is verified at this step (fallback per §4.4 if needed).
- **Owner sign-off package** (plain language + screenshots + URLs, per the Phase 4
  brief): the Vercel preview link; demo logins for each admin role (dev OTP appears
  on-screen on previews); a scripted walkthrough — approve a pending delegate and
  open their live public page; record a payment for a fresh member and watch the
  leaderboard move; paste a fake statement and see the preview classify rows; reveal
  a personal ID and then find that exact reveal in the audit log; try to open
  ფინანსები as the verifier and get refused — with screenshots of every screen.
- Owner explicitly approves in chat before merge.

## 11. Success criteria

- A verifier approves a pending delegate and the public page exists **at that
  instant** at the transliterated slug; the referral link registers a real member;
  the audit log holds the approval with actor and prior status. Reject → re-approve
  works and is fully audited.
- Personal IDs: provably absent from every admin view and the base-table grant
  (probes); visible only via the two audited reveal paths and the super_admin export;
  every such access has its audit row.
- Finance records a payment by GR-code and the member is active everywhere within one
  request cycle; the §2 date examples hold exactly (unit + probe fixtures); bulk
  paste classifies matched/no-code/unknown/duplicate/ambiguous correctly and records
  all-or-nothing; duplicate bank references cannot double-record; void recomputes and
  stays visible (admin + member cabinet).
- The staging seed writes zero statuses by hand; the engine derives them; the nightly
  sweep demotes lapsed members and logs `system.active_sweep`.
- Reassignment preserves membership history (old row closed, not deleted) and moves
  counters instantly.
- RBAC holds server-side: probes show zero-row views + RPC refusals for missing
  roles; the last super_admin cannot be removed; e2e smoke passes; the editor sees
  the Phase 5 notice.
- All CI gates green including the two new critical-flow e2e suites and every
  existing suite; zero new npm dependencies; owner sign-off recorded before merge.
