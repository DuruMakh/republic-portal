# AGENTS.md — working rules for this repo

## What this is

Production app for "ქართული რესპუბლიკა" (Georgian civic platform).
Spec: docs/superpowers/specs/2026-07-12-republic-portal-production-design.md
UX contract: prototype/index.html. Decisions log: DECISIONS.md (append-only).

## Communication language

The user may ask questions or give tasks in Georgian. Conduct work in English and use English for all communication by default, including questions, plans, progress updates, explanations, and final answers. Respond in Georgian only when the user explicitly requests it.

## Process (non-negotiable)

- Every feature: spec → plan (docs/superpowers/plans/) → TDD → code review (Codex + /codex review)
  → /qa on preview → OWNER sign-off on the Vercel preview link → merge.
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
