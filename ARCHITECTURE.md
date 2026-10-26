# Architecture

One Next.js App Router app. Public pages server-rendered (SEO/OG); cabinets/admin are
protected server-rendered views. Supabase = Postgres + Google sign-in + storage, RLS on everything.
Vercel hosts production only; changes are checked on a local Supabase stack (README).

## Layout

- app/[locale]/(unity|public|member|delegate|admin)/ — shared pages for `ka` and `en`;
  the proxy keeps Georgian addresses unprefixed and English under `/en`. Administration
  stays Georgian. Each protected group has a
  layout.tsx that enforces auth + role server-side.
- lib/ — pure domain logic (validation, status derivation, ranking). Unit-tested.
- lib/i18n/ — language context, localized links, English interface dictionaries, dates and metadata.
- lib/supabase/ — client factories: client.ts (browser, anon), server.ts (SSR, cookies),
  admin.ts (service-role, server-only).
- components/ — design-system components (see DESIGN.md).
- supabase/migrations/ — the only way schema changes.
- e2e/ — Playwright; critical flows must stay green.

## Environments

- production: production Supabase + Vercel project `georgia-republic` (respublika.ge).
- local and CI: a throwaway local Supabase stack (`supabase start` + canonical seed). The hosted
  staging project and PR previews were deleted 2026-10-09 (ADR-051).

## Auth flow

Google sign-in via Supabase OAuth creates the session through `/auth/callback`;
`@supabase/ssr` refreshes its cookie in `proxy.ts`. Verify.ge proves phone ownership
once during registration, through `PhoneVerificationProvider`; it is not the sign-in
method (ADR-031/033). The test provider is refused in production. Legacy phone-code
screens remain in source, but the current mode is `NEXT_PUBLIC_AUTH_MODE=google`.

## Registration funnel (Phase 2)

/join is the one-door light registration (ADR-018): after Google sign-in it collects
name, surname, phone and privacy consent, verifies the phone, then calls the SECURITY
DEFINER RPC, register_google(). It checks Google identity and recent phone proof before
calling the internal, atomic and idempotent register(); direct client execution of
register() is revoked. Personal ID is asked only at membership (ADR-022).
cabinet_state() is the one state read for every cabinet/registration surface (discriminated CabinetState union,
lib/funnel.ts); standing ('registered' | 'member') drives registered/member cabinet
routing and nav, and an APPROVED delegacy overrides it (below). Becoming a member
happens entirely inside the cabinet, in two RPCs:
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
code) are SECURITY DEFINER RPCs. cabinet_state() also returns
status/registrationCompletedAt/createdAt. deriveDestination (lib/cabinet.ts)
sends existing users to their cabinet from login and /join. Registration is
progressive, not a one-way funnel: register_google() opens the cabinet immediately;
becoming a member happens later via the in-cabinet wizard
(become_member_save_profile then become_member_complete). The public header
carries one account action: the join door for guests, swapping to the cabinet
link client-side once signed in (the cached shell stays session-agnostic).
Dashboard rank reuses lib/ranking over public_delegates,
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
(ADR-015); `lib/active.ts` keeps only the date helpers the app previews with, and
`profiles.status` is written only by the engine (plus `register()`'s initial
'registered' insert and `become_member_complete()`'s registered→profile_completed
step).
