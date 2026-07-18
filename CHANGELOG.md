# Changelog

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
