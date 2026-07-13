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

## Status derivation

Member/delegate statuses and supporter counts are always computed from source tables
(payments, memberships) by functions in lib/ — never stored as editable state.
