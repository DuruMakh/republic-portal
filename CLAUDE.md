# CLAUDE.md — working rules for this repo

## What this is

Production app for "ქართული რესპუბლიკა" (Georgian civic platform).
Spec: docs/superpowers/specs/2026-07-12-republic-portal-production-design.md
UX contract: prototype/kronika-d3/ (spec docs/superpowers/specs/2026-07-23-kronika-redesign-design.md). Decisions log: DECISIONS.md (append-only).

## Process (non-negotiable)

- Every feature: spec → plan (docs/superpowers/plans/) → TDD → code review (Claude:
  independent per-task reviews + whole-branch review) → /qa on preview → OWNER sign-off
  on the Vercel preview link → merge. (Independent /codex review dropped by owner
  decision, 2026-07-15.)
- Owner writes zero code and reads no code. All evidence for sign-off must be
  plain-language + screenshots + a preview URL.
- Never merge with failing CI. Never push directly to main.

## Code rules

- TypeScript strict. No `any`, no `@ts-ignore`.
- Domain logic = pure functions in `lib/` (no React/Next imports). UI components in
  `components/`. Route groups: app/(public), app/(member), app/(delegate), app/(admin).
- All user-facing text in Georgian. Reuse design-system components (DESIGN.md) — never
  restyle ad hoc.
- Validation with zod at every boundary (form + API). Server is the source of truth.
- Database: schema changes only via supabase/migrations/. Never mutate data by hand.
- Auth: Supabase only. Authorization checked server-side on every mutation + RLS in DB.
  Client-side checks are UX, not security.
- Admin mutations must write to audit_log.
- Secrets only in env vars. `.env.local` is never committed.

## Forbidden patterns

- Storing derivable values (e.g., supporter counts) as editable columns.
- Fetching with service-role key in any code path reachable without a server-side role check.
- Skipping the failing-test step of TDD. Copy-pasting components instead of extracting.
- Adding dependencies without recording why in DECISIONS.md.
