# Changelog

## 0.1.0 — Phase 0: Foundation

- Next.js + TypeScript app with Georgian design system (tokens, 6 components, /styleguide)
- Supabase schema v1: profiles, delegates, memberships, payments, admin_roles, audit_log
  (append-only), regions/cities seed, RLS everywhere
- Phone-OTP auth with dev-mode delivery (Send-SMS hook → dev_otp_inbox)
- PWA shell (manifest, icons, service worker)
- CI (typecheck, lint, format, unit, build, e2e vs staging) on GitHub Actions
- Vercel: production + per-PR previews pointed at staging
