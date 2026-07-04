# Design Spec — "ქართული რესპუბლიკა" Civic Platform (Prototype HTML)

**Date:** 2026-07-05
**Deliverable:** A single, self-contained, high-fidelity **interactive** HTML design prototype
(one `.html` file, zero build step, opens by double-click). This is the **visual/UX layer only**
— no real backend. All backend behaviors (SMS/OTP, payment gateway, DB, CRM) are **mocked**
in-browser so the prototype *feels* live for stakeholder demos and as a developer spec.

---

## 1. Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Format | Single self-contained `.html`, inline CSS + JS, no frameworks/build |
| Fidelity | High — genuinely interactive (funnel advances, filters, sorts, counters animate) |
| Aesthetic | **Hybrid A+B**: clean civic-tech foundation + bold patriotic public front |
| Language | **Georgian** throughout the UI |
| Fonts | **Option (i)** — Noto Sans/Serif Georgian via font link + full Georgian **system fallback** (Segoe UI/Sylfaen) so it still renders offline |

---

## 2. Visual system

- **Palette:**
  - Primary / patriotic red `--red: #C8102E` (CTAs, public front, key actions)
  - Ink `--ink: #12141C` (primary text), muted `--muted: #5B616E`
  - Surfaces: `--bg: #FFFFFF`, `--surface: #F6F7F9`, `--line: #E4E7EC`
  - Gold accent `--gold: #C9A24B` (rank medals, awards)
  - Status colors: Draft grey, Active green, Pending amber, Approved blue/green
- **Type:** `"Noto Sans Georgian"` for UI; `"Noto Serif Georgian"` for public hero headlines.
  Fallback stack: `"Noto Sans Georgian", "BPG Arial", "Segoe UI", "Sylfaen", system-ui, sans-serif`.
- **Register split:** Public pages lean bold-red + serif headlines + movement energy.
  Cabinets & Admin lean calm, neutral, utilitarian; red used sparingly for primary actions.
- **Component library (shared CSS classes):**
  - `.btn` (`.btn--primary`, `.btn--ghost`, `.btn--danger`), `.card`, `.stat-card` (animated count-up),
    `.pill` (status pills), `.leader-row` (rank medals), `.stepper` (3-step progress),
    `.field` (labeled input), `.select`, `.table`, `.modal`, `.toast`, `.badge`, `.avatar`, `.tabs`.

## 3. Technical architecture (single file)

- **Screen model:** every screen is a `<section class="screen" data-screen="id">`; only one visible at a time.
- **Router:** hash-based (`#/home`, `#/join/step-1`, `#/admin/verify` …) so browser back/forward works.
- **Prototype navigator:** floating, collapsible panel (top-right) with a **role switcher**
  (Public / Member / Delegate / Admin) + a jump-list of all screens. Hideable so it doesn't appear in screenshots.
- **Mock data layer:** one `DATA` object — `delegates[]`, `members[]`, `transactions[]`, `polls[]`,
  `regions[]`, `session`. Counters, tables, filters, and the leaderboard all compute from `DATA`.
- **State:** in-memory JS; actions (approve delegate, change delegate, add member) mutate `DATA`
  and re-render affected views so cross-screen effects are visible in a demo.

## 4. Roles

- **User / Member** — profile, payments, can view & change their delegate.
- **Delegate** — same registration as a member + T&C acceptance + personal referral link + team dashboard;
  public only after admin approval.
- **Super Admin** — CRM back-office: full control of users, finances, delegate verification, data export.

## 5. Regions (dropdowns)

11 total: 9 mხარე + თბილისი + აჭარა →
თბილისი, აჭარა, იმერეთი, კახეთი, ქვემო ქართლი, სამეგრელო-ზემო სვანეთი, სამცხე-ჯავახეთი,
გურია, მცხეთა-მთიანეთი, რაჭა-ლეჩხუმი და ქვემო სვანეთი, შიდა ქართლი.
(City dropdown cascades from selected region.)

## 6. Screen inventory (~20) & key behaviors

### 🌐 Public site (bold/patriotic)
1. **Home** `#/home` — hero, **live global counters** (Approved delegates + Active members, animated count-up),
   mission blocks, CTAs "გახდი წევრი" / "გახდი დელეგატი".
2. **About Delegates** `#/delegates` — searchable + region-filterable grid of **approved** delegates;
   card shows region + real supporter count.
3. **Leaderboard** `#/leaderboard` — delegates auto-ranked by **active paying supporters** (#1 = most); medals for top 3.
4. **Public delegate profile** `#/delegate/:id` — one delegate's public page (region, supporters, rank).

### 📝 Registration funnel (shared shell; member + delegate variants)
5. **Entry / role choice** `#/join` — "გახდი წევრი" vs "გახდი დელეგატი"; referral-link arrival pre-fills delegate.
6. **Step 1 — Contact & OTP** `#/join/step-1` — სახელი, გვარი, ტელეფონი →
   **duplicate-phone check** ("ეს ტელეფონის ნომერი უკვე რეგისტრირებულია") → **OTP modal** (SMS code).
   On Continue: "Draft saved" toast (auto-save). Status → **Draft**.
7. **Step 2 — Legal profile** `#/join/step-2` — **პირადი ნომერი (11-digit + validation)**, დაბ. თარიღი,
   რეგიონი→ქალაქი, სამუშაო ადგილი/სტატუსი. **Duplicate personal-ID check**.
   **Delegate mibma logic:** referral → delegate auto-filled; direct → mandatory region dropdown, then
   region-filtered verified-delegate list (first option: **"ცენტრალური მოძრაობა"**).
   **Delegate variant** adds mandatory T&C checkbox: "ვეცნობი და ვეთანხმები დელეგატად ყოფნის წესებსა და პირობებს".
   Status → **Profile_Completed**.
8. **Step 3 — Membership / billing** `#/join/step-3` — pick **5 / 10 / 20 GEL** monthly, card-entry modal,
   recurring toggle → success. Member status → **Active_Member**; Delegate status → **Pending_Delegate**.
9. **Delegate "Pending approval"** `#/join/pending` — explains link is disabled until admin approval.

### 👤 Member cabinet (calm/utilitarian)
10. **Profile** `#/me/profile` — view/edit personal data.
11. **Change my delegate** `#/me/delegate` — region-filtered picker; changing decrements old counter, increments new.
12. **Billing** `#/me/billing` — manage card (change/cancel), payment history archive.
13. **Polls** `#/me/polls` — participate in internal polls.

### ⭐ Delegate cabinet
14. **Dashboard** `#/delegate/dashboard` — copy **referral link** button + live "შენი აქტიური მხარდამჭერები: X".
15. **My team** `#/delegate/team` — table: [სახელი, გვარი] | [რეგისტრაციის თარიღი] | [სტატუსი: Active / Draft].

### 🛠 Super Admin / CRM (dense/utilitarian)
16. **Overview** `#/admin` — transaction stats, monitoring KPIs.
17. **Members management** `#/admin/members` — table + filters + **export CSV/Excel** (Ministry-of-Justice template).
18. **Delegate verification queue** `#/admin/verify` — Pending → **Approve** (moves live to public leaderboard).
19. **Admin transfer** `#/admin/transfer` — reassign "ცენტრალური მოძრაობა"/orphan members to regional delegates.
20. **Finances** `#/admin/finances` — recurring donations, revenue, transaction log.

## 7. Signature interactions that actually work in the prototype

- Funnel: step validation (11-digit ID, duplicate phone/ID), OTP modal, "Draft saved" auto-save toast per step.
- Region select filters both the delegate picker and the public delegate grid.
- Leaderboard re-sorts live; home counters animate count-up.
- Admin **Approve** → delegate moves Pending→Approved and appears on the public leaderboard immediately.
- Delegate dashboard: copy-link + live supporter counter.
- Member "change delegate" decrements old / increments new counter across the mock data.

## 8. Statuses (badge vocabulary)

`Draft` → `Profile_Completed` → `Active_Member` (member) ·
`Pending_Delegate` → `Approved_Delegate` (delegate).

## 9. Out of scope (mocked / not built)

Real SMS gateway, real payment/e-commerce API, real DB/persistence, real auth,
server-side export generation. All simulated client-side.

## 10. Success criteria

- Opens as one file; every one of the ~20 screens reachable via the prototype navigator and hash routes.
- Georgian renders correctly (web font online, system fallback offline).
- The signature interactions above visibly work with mock data.
- Consistent visual system across all screens (shared component classes).
- Responsive enough to demo on a laptop; degrades gracefully on smaller widths.
