# Architecture

One Next.js App Router app. Public pages server-rendered (SEO/OG); cabinets/admin are
authed client views. Supabase = Postgres + phone-OTP auth + storage, RLS on everything.
Vercel hosts; every PR gets a preview deployment pointed at the STAGING Supabase project.

## Layout

- app/(public|member|delegate|admin)/ — route groups per area; each protected group has a
  layout.tsx that enforces auth + role server-side.
- lib/ — pure domain logic (validation, status derivation, ranking). Unit-tested.
- lib/supabase/ — client factories: client.ts (browser, anon), server.ts (SSR, cookies),
  admin.ts (service-role, server-only).
- components/ — design-system components (see DESIGN.md).
- supabase/migrations/ — the only way schema changes.
- e2e/ — Playwright; critical flows must stay green.

## Environments

- production: republic-portal-prod Supabase + Vercel production.
- staging: republic-portal-staging Supabase + all Vercel previews + local dev + CI e2e.

## Auth flow

Phone → supabase.auth.signInWithOtp → Send-SMS hook (Postgres fn) delivers code:
dev/staging writes to dev_otp_inbox (surfaced on-screen); production will call a Georgian
SMS provider (Phase 6). verifyOtp creates the session (cookie via @supabase/ssr session refresh in proxy.ts — Next 16's successor to middleware.ts).

## Registration funnel (Phase 2)

/join is the one-door light registration (ADR-018): a single screen collects name,
surname, personal ID and phone, verifies an OTP in place, then calls the one SECURITY
DEFINER RPC, register() — atomic and idempotent, so a repeat call from an
already-registered phone is a state read, never a rewrite. cabinet_state() is the one
state read for every cabinet/registration surface (discriminated CabinetState union,
lib/funnel.ts); standing ('registered' | 'member') — not role — drives cabinet routing
and nav. Becoming a member happens entirely inside the cabinet, in two RPCs:
become_member_save_profile (profile fields + delegate pick — an approved referral wins
over the picker) then become_member_complete(tier), which opens the membership, mints
the reference code and sets registration_completed_at. Delegacy is member-only and a
role only once approved (ADR-019): request_delegacy() is a one-confirm RPC off a
completed profile (a trigger makes an incomplete delegates row unrepresentable), and
deriveDestination/cabinetRole (lib/cabinet.ts) route only an APPROVED delegate to
/delegate — pending/rejected requesters stay in the member cabinet. Personal ID,
status, tier and registration_completed_at stay outside the client's column-scoped
profile grant (ADR-013); these RPCs are the only path to them.

## Cabinets (Phase 3)

`/me/*` (member) and `/delegate/*` (delegate panel) are per-request server-rendered
behind layout gates (session + completed registration + role) — safe because the
service worker treats them NetworkOnly. DB access is a mixed model (ADR-013):
the five plain profile fields update through a column-scoped grant + own-row RLS +
the protect-columns trigger; compound writes (member_change_delegate =
close-then-open membership history; member_change_tier) and delegate reads
(delegate_panel / delegate_team — the only client path to the caller's referral
code) are SECURITY DEFINER RPCs. funnel_state() also returns
status/registrationCompletedAt/createdAt. deriveDestination (lib/cabinet.ts)
sends completed users to their cabinet from login, /join and the funnel guards;
the funnel is one-way — done/pending render once via a sessionStorage marker set
by step 3. The public header swaps შესვლა→კაბინეტი client-side (the cached shell
stays session-agnostic). Dashboard rank reuses lib/ranking over public_delegates,
so it can never disagree with the leaderboard.

## Admin CRM (Phase 4)

`/admin/*` (route group `app/(admin)`) is per-request server-rendered behind a
layout gate (session + ≥1 `admin_roles` row, read via the own-rows RLS policy);
role-specific pages re-gate and the database re-checks everything regardless.
Reads go through self-gating definer views (`admin_overview`, `admin_region_stats`,
`admin_members`, `admin_delegate_queue`, `admin_payments`, `admin_finance_stats`,
`admin_admins`, `admin_audit`, `admin_settings`) — zero rows for non-admins, and
no view contains `personal_id`/`birth_date`. Every mutation is a SECURITY DEFINER
RPC that re-checks the caller's role and writes its `audit_log` row in the same
transaction (ADR-014). Personal IDs: masked with audited click-to-reveal (two RPC
paths) and super_admin-only export inclusion; since Phase 4 the `authenticated`
column grant on `profiles` excludes `personal_id`/`birth_date`.

The active-member engine (ADR-015): payments carry a tier snapshot and a GENERATED
`months_covered`; coverage folds `greatest(prev_end, paid_at) + months × 30 days`;
a member is active while `today ≤ coverage_end + active_grace_days` (app_settings,
default 30). Status recomputes on record/void/setting change; a nightly pg_cron
sweep demotes lapsed members (`system.active_sweep` audit rows). The staging seed
writes payment histories — statuses are always derived. Delegate photos live in the
public `delegate-photos` bucket; uploads go only through the admin server action
(the single service-role app path), paired with the re-checking RPC.

## Community (Phase 5)

News, events and polls live behind the same locks as Phase 4: base tables carry
zero client grants; anon reads only `public_news`/`public_events` and the
aggregate-only `transparency_stats`/`transparency_regions`; completed members
read self-gating `member_*` views (the DB-level meaning of „წევრებისთვის");
editors read self-gating `admin_*` views. Every editor mutation is a SECURITY
DEFINER RPC writing audit_log in-transaction (ADR-014); member acts
(member_rsvp, member_cast_vote) are definer RPCs without audit rows. One vote
per member is the poll_votes PRIMARY KEY (poll_id, member_id); RSVPs are one
row per (event, member) flipped between going/cancelled. Slugs mint at first
publish (delegate pattern: server suggests via lib/slug, RPC enforces,
23505 → retry) and are permanent. Member-only articles render ONLY under
/me/news/* (service-worker NetworkOnly) — the public cache never sees them.
Public pages are ISR (60s) + revalidatePath on publish/unpublish/cancel.
News covers ride the Phase 4 photo envelope (editor-prechecked service-role
upload to the public news-images bucket + audited re-checking RPC) — the one
service-role app path added this phase. Bodies are plain text rendered to React
elements (paragraphs + auto-links, lib/content-render) — no HTML round-trips.

## Status derivation

Derived values are never stored as editable state. Since Phase 4 the
active-member computation itself lives in the database engine functions
(ADR-015); `lib/active.ts` mirrors the same math for previews and tests, and
`profiles.status` is written only by the engine (plus the funnel's
draft→profile_completed step).
