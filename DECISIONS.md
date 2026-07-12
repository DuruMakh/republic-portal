# Decisions (append-only ADR log)

## ADR-001 (2026-07-12): Stack = Next.js + TypeScript + Supabase + Vercel
AI is the only engineer → choose the stack AI is most fluent in. Supabase gives Postgres,
phone-OTP auth with pluggable SMS hook, storage, RLS. Vercel gives per-PR previews (the
owner sign-off mechanism). Alternatives: Django (fights PWA/interactive funnel), SvelteKit
(less AI fluency).

## ADR-002 (2026-07-12): PWA-first mobile; Capacitor wrap later
One codebase. Store apps only when presence matters — no rewrite required.

## ADR-003 (2026-07-12): v1 payments are manual bank transfers
Finance admin records transfers matched by per-member reference codes; statuses derive
from recorded payments. A gateway later is just another `source` value.

## ADR-004 (2026-07-12): Staged OTP delivery
Send-SMS hook architecture from day one; dev/staging delivers to dev_otp_inbox
(on-screen); production switches the hook to a Georgian SMS provider before launch.

## ADR-005 (2026-07-12): No Docker; staging cloud project is the dev database
Owner machine stays simple. Migrations via supabase CLI against staging, then prod.
Unit tests never touch the DB (pure lib/); e2e runs against staging.

## ADR-006 (2026-07-12): Personal IDs rely on platform at-rest encryption + RLS + audit
Column-level encryption deferred; revisit at Phase 6 /cso audit before public launch.

## ADR-007 (2026-07-13): Version baseline = current stable majors
Scaffold upgraded to Next 16 + TypeScript 6 at foundation time ("floors, not pins").
Consequences recorded for future work: Turbopack is the default for dev AND build
(webpack-plugin-based tools like @serwist/next need Turbopack-aware setup);
middleware.ts is deprecated in favor of proxy.ts; `next lint` is removed (CI runs
`eslint .`). ESLint held at 9.x because eslint-config-next's bundled plugins peer-cap
at ^9 — revisit when eslint-config-next supports ESLint 10.
