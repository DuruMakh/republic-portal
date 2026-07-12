# Design Spec — "ქართული რესპუბლიკა" Production Platform

**Date:** 2026-07-12
**Status:** Approved in brainstorming; supersedes the prototype-only scope of
`2026-07-05-georgian-republic-portal-design.md` (which remains the UX/visual reference).
**Predecessor artifact:** `index.html` — the 20-screen interactive prototype. It is the
UX contract: screens, flows, statuses, and visual system carry over unless this spec says otherwise.

---

## 1. Context and goals

The prototype validated the product: a civic platform for a Georgian movement with a
public site, member/delegate registration, cabinets, and an admin CRM. This spec defines
the **real, production application**.

Operating reality that shapes every decision:

- **Real launch, no hard deadline.** Built properly, phase by phase; each phase ships something usable.
- **The owner writes zero code.** AI (Claude + supporting tools) is the entire engineering team.
  Quality is enforced by process and automation, not by human code reading.
- **Lean budget:** ~$0–50/month infrastructure; owner + AI operate it. Managed services only —
  nothing that needs a human on call.
- **Hosting:** anywhere reliable; EU regions preferred where free (closest to Georgia,
  strong data-protection story).

## 2. Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Stack | **Next.js (App Router) + TypeScript + Supabase (Postgres, auth, storage) + Tailwind CSS, hosted on Vercel** |
| Mobile | **PWA-first**: one responsive installable web app. Capacitor store-wrap is a later, no-rewrite option |
| Payments v1 | **No gateway.** Members transfer manually (bank); finance admin records payments; platform shows statistics. Gateway integration is a later phase behind a payment-source interface |
| SMS / OTP | **Staged**: full OTP flow built now with dev-mode code delivery; a Georgian SMS provider (e.g., smsoffice.ge, sender.ge, gosms.ge) plugs into Supabase's send-SMS hook before public launch |
| V1 scope | Prototype parity **plus**: multi-admin roles + audit log, news & announcements, public transparency statistics, events & RSVP |
| Owner's role | **Feature-level sign-off**: every feature ends with a preview link + plain-language QA evidence; owner approves before merge |
| Language | Georgian UI throughout (as prototype). Content model kept i18n-ready but no second language in v1 |
| Repo | Private GitHub repository; protected `main`; all changes via PR with passing CI |

**Why this stack (recorded for future sessions):** when AI is the only engineer, choose the
stack AI is demonstrably most fluent in. Next.js/React + TypeScript + Postgres is the most
heavily documented stack in existence → fewest hallucinated APIs, best reviews and debugging.
Supabase natively supports phone-OTP auth with pluggable SMS senders. Vercel's automatic
per-PR preview deployments are the mechanism for owner sign-off. Alternatives considered:
Django monolith (simplest, but fights the interactive funnel/PWA/mobile future),
SvelteKit (leaner, but less AI fluency = higher slop risk).

## 3. Architecture

### 3.1 Shape

One Next.js application in one repository. Route groups isolate the areas:

```
app/
  (public)/    home, delegates, leaderboard, delegate/[id], news, events, transparency, join funnel
  (member)/    profile, my-delegate, payments, polls, feed
  (delegate)/  dashboard, team
  (admin)/     overview, members, verify, payments, transfer, content, admins, audit
lib/           domain logic (pure TypeScript, unit-testable, no framework imports)
components/    shared design-system components ported from the prototype
db/            schema + migrations (version-controlled)
```

- **Domain logic lives in `lib/`, not in components or route handlers.** Pure functions
  (status derivation, ranking, matching rules) are unit-tested in isolation.
- The prototype's CSS design system (red `#C8102E`, ink, gold; Noto Sans/Serif Georgian;
  `.btn`/`.card`/`.stat-card`/`.pill`/`.stepper` vocabulary) is ported to Tailwind +
  a shared component library with the same names (`Button`, `Card`, `StatCard`, `Pill`, `Stepper`).
- Public pages are server-rendered (SEO, social link previews with OG tags). Cabinets and
  admin are interactive client views behind auth.

### 3.2 Supabase

- **Postgres** — single source of truth. Schema changes only via committed migrations; no manual edits.
- **Auth** — phone + OTP sessions. Dev/pilot: OTP delivered on-screen via a dev-mode hook.
  Launch: Georgian SMS provider behind Supabase's send-SMS hook. The app never implements
  its own crypto/session logic.
- **Storage** — delegate photos, news images.
- **Row-level security (RLS)** on every table as defense-in-depth: even a buggy server query
  cannot read or write rows the session's role doesn't permit.

### 3.3 Environments

- **production** — its own Supabase project + Vercel production deployment.
- **staging/preview** — a separate free Supabase project with seed data. Every PR's Vercel
  preview points at staging, so features (including destructive admin flows) are tested
  without touching real member data.
- Secrets live in Vercel/Supabase environment config, never in the repo.

### 3.4 PWA

Web app manifest + service worker from Phase 0: installable icon, offline app shell,
fast repeat loads. Android push notifications become possible later without rework.
Capacitor wrap (Google Play / App Store) is deferred until store presence matters.

### 3.5 Cost profile

$0 during build/pilot (free tiers). At public launch: Supabase Pro (~$25/mo — daily backups,
no project pausing) and, if traffic warrants, Vercel paid (~$20/mo). Plus per-SMS cost
(~0.03–0.06 GEL) once the SMS provider is live. Belt-and-braces: a scheduled GitHub Action
dumps the database nightly to separate storage.

## 4. Data model

Core tables (simplified; exact columns defined in Phase 0 migrations):

| Table | Purpose / key rules |
|---|---|
| `profiles` | Every registered person: name, phone (unique), personal ID (unique, 11-digit validated), birth date, region → city, employment, status. Personal IDs encrypted at rest; visible only to authorized admin roles; every access audited |
| `delegates` | Extends a profile: T&C acceptance timestamp, referral code, verification status (`pending`→`approved`/`rejected`), public bio/photo. **Supporter counts are always computed from memberships — never a stored editable number** |
| `memberships` | Who supports which delegate, with full history. Changing delegate closes the old row and opens a new one; counters derive from current rows |
| `payments` | v1: manually recorded transfers — amount, date, recorded-by, optional bank reference, member link, source=`manual`. Designed so a gateway later is just another `source` |
| `polls`, `poll_votes` | One vote per member enforced by a database constraint |
| `news` | Admin-published announcements; public and/or member-only visibility |
| `events`, `event_rsvps` | Admin-created events; member RSVPs; delegates see their team's attendance |
| `audit_log` | Append-only: every admin action (approve, record payment, edit, export) with actor, action, target, timestamp. No updates or deletes, enforced at DB level |
| `regions` / `cities` | The 11 regions from the prototype spec; cities cascade from region |

**Statuses** (carried from prototype): member `Draft` → `Profile_Completed` → `Active_Member`;
delegate `Pending_Delegate` → `Approved_Delegate`. `Active_Member` is **derived** from payment
recency per an admin-configurable rule (e.g., "payment within the last N days"), not manually toggled.
Registration drafts persist server-side so a person can resume on another device.

## 5. Auth and roles

- **Authentication:** phone + OTP (Supabase). No passwords in v1.
- **Roles:** `member`, `delegate`, plus admin roles: `super_admin` (everything, manages admins),
  `verifier` (delegate queue), `finance` (payment recording/stats), `editor` (news/events).
- Authorization is checked **server-side on every admin/cabinet route and mutation**; RLS
  mirrors the same rules in the database. Client-side checks are UX only, never security.
- All admin actions write to `audit_log`.

## 6. Functionality by area

### Public site (server-rendered, bold/patriotic register)
Home with live real counters; delegate directory (region filter + search, approved only);
leaderboard ranked by **active** supporters with top-3 medals; shareable delegate pages;
news; events; **transparency page** — aggregate funds raised (from recorded payments),
member counts by region. Proper OG tags for social sharing.

### Registration funnel (3 steps, member + delegate variants)
1. Contact + OTP; duplicate-phone check against real data; server-side draft saved.
2. Legal profile: 11-digit personal-ID validation + duplicate check; region→city cascade;
   delegate binding — referral link pre-fills delegate; direct entry → region-filtered picker
   with "ცენტრალური მოძრაობა" as first option. Delegate variant adds mandatory T&C checkbox.
3. **Membership tier (5/10/20 GEL) + manual-transfer instructions**: recipient bank details and
   a **unique per-member reference code** so finance can match incoming transfers. No card entry in v1.
   Delegate flow ends in "pending approval" state (referral link inactive until approved).

### Member cabinet (calm register)
Profile edit; change-delegate (history kept, counters recompute); payment history as recorded
by finance; polls; news feed; events + RSVP.

### Delegate cabinet
Referral link + QR code; live supporter count; team table (name, registration date, status);
team RSVP overview.

### Admin CRM (dense/utilitarian)
Overview dashboard (registrations, payments, KPIs); member management with filters and
CSV/Excel export; delegate verification queue (approve → instantly public); **payment
recording** — single entry and bulk matching by reference code; reassignment of
"ცენტრალური მოძრაობა"/orphaned members to delegates; news/events publishing; admin-user
management (super_admin only); audit-log viewer.

## 7. Error handling and operations

- Every form validates client-side (instant Georgian feedback) **and** server-side (source of truth).
- All multi-step mutations are transactional — no half-saved registrations or payments.
- User-facing errors: friendly Georgian text. Technical detail: Sentry (free tier) with alerting,
  so diagnosis never depends on the owner describing a stack trace.
- Uptime monitoring via a free external pinger; Vercel/Supabase dashboards for resource health.
- Nightly DB dump (GitHub Action) in addition to platform backups; restore procedure documented
  and rehearsed once before public launch.

## 8. Quality machinery (anti-slop system)

The owner writes zero code; these mechanisms replace human code review:

1. **Written law in the repo** — `CLAUDE.md` (conventions, forbidden patterns, "domain logic in
   `lib/` only", naming rules), `ARCHITECTURE.md`, `DECISIONS.md` (append-only ADRs — significant
   choices + why, so future AI sessions cannot silently re-decide), `DESIGN.md` (design system).
   Every feature starts from a written spec + plan in `docs/superpowers/`.
2. **Per-feature cycle:** brainstorm (scaled to feature size) → spec → implementation plan →
   **TDD** (superpowers:test-driven-development — failing test first, always) →
   verification-before-completion → **two independent reviews**: superpowers code review +
   `/codex review` (a second AI model with no authorship bias) → `/qa` against the preview
   deployment → **owner sign-off on the preview link** → ship (version bump, changelog, merge).
3. **CI gates (GitHub Actions) — merges are impossible without:** strict TypeScript (`strict: true`,
   no `any` escapes), ESLint + Prettier, Vitest unit tests, Playwright e2e of critical flows
   (registration, delegate approval, payment recording, change-delegate), successful build.
   `main` is branch-protected; all work via PRs.
4. **Tests as the spec's shadow:** every behavior in a plan lands with tests; e2e suite is the
   living guarantee that yesterday's features still work.
5. **Recurring hygiene:** `/health` composite quality score tracked over time (slop = falling
   score); `/cso` security audit before public launch, then periodically; `/design-review`
   visual-polish passes; `/retro` weekly summaries; `/document-release` keeps docs matching
   reality after each ship.
6. **Database discipline:** schema changes only via committed migrations; staging seed data
   regenerated from scripts, not hand-edited.

## 9. Phased roadmap

Each phase = its own spec → plan → build → owner sign-off. Order optimizes for
"something real and reviewable as early as possible."

| Phase | Delivers | Owner sees |
|---|---|---|
| **0 — Foundation** | Repo + CI + Vercel/Supabase environments, design-system port, DB schema + migrations, auth skeleton, PWA shell | A live URL with the visual system and installable shell |
| **1 — Public core** | Home, delegate directory, leaderboard, delegate pages on real (seeded) data | The public face, shareable |
| **2 — Registration** | Full 3-step funnel with staged OTP, dedup, drafts, delegate binding, manual-payment instructions | Can register a real member end-to-end |
| **3 — Cabinets** | Member cabinet + delegate cabinet, referral links live | Members/delegates self-serve |
| **4 — Admin CRM** | Verification queue, member management + export, payment recording + statuses, reassignment, RBAC, audit log | The movement can operate day-to-day |
| **5 — Community** | News, events + RSVP, polls, transparency page | Engagement features |
| **6 — Launch hardening** | Real SMS provider, Supabase Pro + backup drill, `/cso` security audit, load sanity check, PWA/design polish | Public launch readiness |
| **Later** | Payment gateway (provider comparison first: TBC/BOG e-commerce APIs, Flitt, Payze, UniPAY), Capacitor store apps, push notifications, i18n second language | — |

## 10. Open items (tracked, not blocking)

- **SMS provider choice** — decide during Phase 6; needs the entity's documents to register.
  Candidates: smsoffice.ge, sender.ge, gosms.ge; criteria: price, API quality, sender-ID rules.
- **Payment gateway comparison** — its own research task when the movement is ready to
  automate payments (post-launch phase).
- **Bank details + reference-code format** for manual transfers — owner supplies before Phase 2 ships.
- **Legal review** of personal-data handling and T&C text — owner's counsel; the platform
  provides the technical side (encryption, audit, minimal retention).

## 11. Success criteria

- The platform runs at a public URL, installable as a PWA, entirely operated by owner + AI
  within the lean budget.
- A real person can register, verify by OTP, choose a delegate, receive transfer instructions,
  and appear in admin — with the delegate's supporter count updating after finance records payment.
- Every prototype screen exists for real, plus the four extras, with Georgian UI matching the
  approved visual system.
- No merge has ever bypassed CI; every feature has owner sign-off recorded in its PR.
- The e2e suite covers the four critical flows and passes on `main` at all times.
