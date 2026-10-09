# CLAUDE.md — working rules for this repo

## What this is

Production app for "ქართული რესპუბლიკა" (Georgian civic platform).
Spec: docs/superpowers/specs/2026-07-12-republic-portal-production-design.md
UX contract: prototype/kronika-d3/ (spec docs/superpowers/specs/2026-07-23-kronika-redesign-design.md). Decisions log: DECISIONS.md (append-only).

## Process (non-negotiable)

Two sizes (simpler delivery, 2026-10-09). Use Small unless the change touches the database,
sign-in, roles, personal data or payments.

- **Small**: copy, styling, layout, a single bug fix, tooling. Failing test first where there
  is behaviour to test → fix → one review → screenshots → owner sign-off in chat → merge.
  No spec, plan or ADR.
- **Large**: a new feature, a database migration, anything in sign-in, roles, personal data
  or payments. Short spec → plan (docs/superpowers/plans/, few large tasks, not many small
  ones) → TDD → one review per task + a whole-branch review → screenshots → owner sign-off in
  chat → merge.
- **Batch.** One branch and one PR per batch of owner requests, sized to the work (a day's or
  a week's worth). Never one PR per item.
- **Push when ready.** Work and check on the local copy first (all five CI gates, plus e2e
  against the local database), then push. If a branch must go up early, open its PR as a
  draft: drafts get only the quick `checks` job; the slow `quality` job runs once it is
  marked ready. Every push to a ready PR costs a full CI run, so batch review fixes.
- **A database change ships in the same PR as the code that uses it**, as one release. Split it
  into "database first, code later" only when live users could break in between.
- **ADRs only for real decisions**, the kind someone could later ask "why?" about. Recheck main's
  last ADR number right before merging.
- Owner writes zero code and reads no code. Sign-off evidence is plain language and
  screenshots of the change running on the local copy (Docker + local Supabase, see README).
  There are no preview links or staging database since 2026-10-09.
- Owner only chats (owner order, 2026-10-08). Every development and release step is the
  agent's job, done from the session: merging after sign-off, dispatching the production
  database workflow (dry-run, then apply), deploy checks. Never ask the owner to click, run a
  command, or open a dashboard. Their part is decisions and sign-off, given in chat. If a tool
  permission blocks a step, explain the block in plain words and ask in chat how to proceed;
  never hand over a command to run.
- Never merge with failing CI. Never push directly to main. Merge = release to
  respublika.ge: check the live site after every merge.

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
