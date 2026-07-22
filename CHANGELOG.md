# Changelog

## 0.8.0 — Phase 6 R2: The ladder and the numbers (2026-07-23)

- Delegacy is now a member-only request from the cabinet („გახდი დელეგატი"):
  the delegate terms + one confirm button, landing in the existing admin
  verification queue. Someone is a delegate ONLY once approved — pending and
  rejected requesters keep their full member life untouched, and rejection is
  a calm final state (re-request is an admin decision)
- The database makes a delegate without a completed membership unrepresentable
  (trigger), and approval closes the new delegate's own membership inside the
  same audited operation — delegates back no one (Phase 3 canon)
- The public numbers show both rungs honestly: a cumulative „რეგისტრირებული"
  counter (total registry — never shrinks) on the homepage and transparency
  page beside the active-member figure; the header CTA now reads
  „დარეგისტრირდი"; delegate-page supporter copy describes what actually
  happens (support is expressed through membership)
- Admin overview grows to seven cards (registered, members, conversion —
  members ÷ registered); the members table shows who invited each
  registered-only row instead of the old mislabel
- Phase-5 riders + R1 review carries absorbed (ADR-019): whitespace-aware text
  guards (the staging probe caught Postgres btrim stripping spaces only —
  fixed in a follow-up migration), pinned news-image URLs, cancel-guard
  conditional DML, RSVP row locking, an 80-char slug cap with one shared
  slug-mint helper, stable poll-form option keys, poll-list revalidation,
  consolidated e2e OTP/login helpers, and a login page that surfaces a failed
  state lookup instead of bouncing existing members to /join
- Post-review hardening (15-finding max-effort review, fixed before merge):
  approved-only routing gates everywhere (pending/rejected requesters keep
  /me/delegate and the membership pages, and may change their delegate); the
  login lookup failure gained a real retry that never re-submits the
  single-use OTP; referral codes are case-normalized so hand-typed links keep
  attribution; a referral-code collision no longer masquerades as „already
  requested"; the slug-collision blind spot at the 80-char cap is closed; the
  public delegate terms returned at /join/terms so accepted terms stay
  readable; a database CHECK ties the two membership-standing bases together

## 0.7.0 — Phase 6 R1: Progressive registration (front door) (2026-07-21)

- One light registration door (/join): name, surname, personal ID, mobile +
  6-digit OTP — under a minute — replaces the 3-step member/delegate funnel.
  New base standing „რეგისტრირებული" (registered), not yet a member.
- Becoming a member moved inside the cabinet: a two-step wizard (legal profile →
  fee tier) that issues the permanent GR- bank reference code; delegate choice
  is a member privilege („ცენტრალური მოძრაობა" default)
- Standing-aware cabinet: registered tier gets events + RSVP, public news, and a
  profile with a "become a member" call to action; members keep polls, member
  news, delegate choice, and billing
- Public homepage delegate pitch retired for a single registration CTA; delegacy
  returns as a member-only request in Release 2
- Vocabulary: „წევრი" now labels the member standing and „რეგისტრირებული" the
  light tier, consistently across cabinet, delegate team, and admin surfaces
- Data model (ADR-018): member_status „draft" renamed to „registered";
  register / become_member_save_profile / become_member_complete / cabinet_state
  RPCs replace the funnel surface; a membership row is created only at completion
- Post-review hardening (max-effort review, fixed before merge): dev-OTP endpoint
  withholds codes for any existing account (closes a preview-only takeover oracle
  for the new registered tier); registration and membership flows recover from a
  transient network failure instead of freezing; an absent-profile cabinet state
  is now a typed impossibility (no more 500s); the staging seed no longer opens a
  membership for registered-standing rows, with a live D1 self-check

## 0.6.0 — Phase 5: Community (2026-07-19)

- Public news (/news + article pages with OG tags), per-article visibility:
  public or member-only (member-only lives in the cabinet feed only)
- Public events (/events + detail): upcoming/past archive, cancellation banner,
  Tbilisi wall-time display; no public attendee counts
- Transparency page (/transparency): total membership contributions (GEL,
  all-time), registered members, approved delegates, region table
  (registered + active) — every figure derived live, nothing stored
- Member cabinet: news feed (member-only pill), events with RSVP toggle
  (მოვალ ⇄ გაუქმება until start) + internal going counts, polls with the
  prototype voting UX — one vote per member enforced by the database
- Delegate panel: team RSVP overview (who from my team is coming)
- Admin შიგთავსი hub (editor + super_admin): news with live preview + audited
  cover upload, events publish/cancel, polls draft→open→closed with optional
  end date; every action audited in-transaction
- 15 new audit actions with Georgian viewer labels

## 0.5.0 — Phase 4: Admin CRM (2026-07-17)

- /admin area with DB-enforced roles (super_admin / verifier / finance / editor)
- Delegate verification: approve (mints the public slug — page + referral link live
  instantly), reversible reject with internal notes, bio/photo editing (Storage)
- Member management: search/filter/pagination, audited personal-ID reveals,
  audited CSV export (personal IDs super_admin-only, off by default)
- Payment recording: single entry + bulk paste matching by GR-code with
  classify-then-confirm preview (all-or-nothing), void with required reason
- Active-member engine: amount buys 30-day months (min 1, stacking), configurable
  grace (default 30), instant recompute + nightly sweep; seed now derives statuses
- Reassignment of ცენტრალური მოძრაობა members to delegates (history kept)
- Append-only audit log for every admin action + viewer with filters
- Personal-ID column lockdown: exactly two audited read paths remain
- Pre-release hardening pass, 2026-07-18 (ADR-016): Tbilisi-aligned date checks
  in SQL, duplicate backstop for reference-less single payments, approval
  requires a completed registration, CSV formula-injection neutralization,
  member-facing payments columns restricted, serialized last-super-admin guard,
  honest bulk previews (within-batch duplicates, real calendar dates, code
  word-boundary), fresh finance stats after recording, reseed survives real
  staging life

## 0.4.0 — 2026-07-16 (Phase 3: cabinets)

- Member cabinet: profile editing (five scoped fields; phone + personal ID
  visibly locked), delegate change with full history and instant counters,
  payments page — permanent GR-code + transfer instructions + tier change +
  honest empty history.
- Delegate panel: live referral link + QR (uqr, ADR-011), live counts
  (active / total / drafts), leaderboard-consistent rank, searchable team
  table; pending and rejected states; sign-out.
- Referral links live end-to-end; login/funnel handoff — completed users land
  in the cabinet, the funnel is one-way; session-aware public header.
- DB: column-scoped profile UPDATE re-grant + four cabinet RPCs (ADR-013);
  funnel_start referral-input cap; funnel_state exposes status + timestamps.
- Hygiene: typed Database generic on all supabase factories; staging e2e-user
  sweep + login e2e teardown fix; REFERENCE_CODE_RE derived from the alphabet;
  deterministic seeded-referral pick; OtpVerification robustness minors;
  TransferInstructions shared.

## 0.3.0 — Phase 2: Registration funnel (2026-07-15)

- Real 3-step /join funnel (member + delegate variants): contact + 6-digit OTP with
  resumable server-side drafts
- Legal profile step: duplicate personal-ID check, region→city cascade, delegate
  binding (referral links pre-fill, „ცენტრალური მოძრაობა" default)
- Tier step: 5/10/20 GEL + manual bank-transfer instructions with permanent
  per-member GR-XXXXXX reference codes (placeholder recipient details until launch)
- Delegate T&C (placeholder terms page) + pending-approval end state; pending
  delegates on no public surface
- Four SECURITY DEFINER RPCs as the sole client write path to profiles (client
  UPDATE grant revoked); statuses stay derived
- Login routes by funnel state
- Dev OTP endpoint hardened: refuses completed/active accounts, purges stale codes
  (closes the Phase 0 oracle)
- e2e: five funnel journeys (member/delegate/dup/resume/referral) on a
  collision-safe 55-block per-run phone scheme

## 0.2.0 — Phase 1: Public core

- Real public site on seeded staging data: home (hero + live counters), delegate
  directory (search + region filter), leaderboard (top-3 medals), delegate pages
  at /delegates/<slug>
- Public read model: public_delegates + public_stats views; delegates base table
  sealed from client reads; profiles.created_at now server-managed
- Per-delegate OG share cards (next/og + bundled Noto Sans Georgian), default OG
  image, env-gated robots.txt, sitemap
- Deterministic staging seed (prototype roster: 15 delegates, ~1.9k members, guarded)
- Demo-data banner on all non-production environments
- e2e: public-pages suite; CI e2e now runs against the production build (next start)
- Hygiene: BOM cleanup, Field id fix, actions v5, DESIGN.md clarifications

## 0.1.0 — Phase 0: Foundation

- Next.js + TypeScript app with Georgian design system (tokens, 6 components, /styleguide)
- Supabase schema v1: profiles, delegates, memberships, payments, admin_roles, audit_log
  (append-only), regions/cities seed, RLS everywhere
- Phone-OTP auth with dev-mode delivery (Send-SMS hook → dev_otp_inbox)
- PWA shell (manifest, icons, service worker)
- CI (typecheck, lint, format, unit, build, e2e vs staging) on GitHub Actions
- Vercel: production + per-PR previews pointed at staging
