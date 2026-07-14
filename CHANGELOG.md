# Changelog

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
