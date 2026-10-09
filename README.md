# ქართული რესპუბლიკა — platform

Production app. Owner + AI collaboration; see CLAUDE.md for working rules,
ARCHITECTURE.md for structure, DECISIONS.md for the ADR log, DESIGN.md for UI rules.

## Quickstart (AI sessions)

1. `npm install`, and Docker Desktop running
2. `npm run db:start`: a local Supabase with every migration, plus `.env.development.local`
   pointing the app at it (first start downloads the images, a few minutes)
3. `npm run db:seed`: the canonical made-up people, the same seed CI uses
4. `npm run dev` → http://localhost:3000; „სატესტო შესვლა“ on /login signs in as a seed persona
5. Gates: `npm run typecheck && npm run lint && npm run format:check && npm run ka:scan && npm run test && npm run e2e:local`
6. `npm run db:stop` when done; `npm run db:reset` re-applies the migrations to an empty database

## Environments

- Production: https://respublika.ge (Vercel project `georgia-republic`) → production Supabase
  `uorvlshbrlbdnbauxsws` in the owner's Duru org. Merge to main releases it.
- Local: Docker + local Supabase on this machine (Quickstart). Owner sign-off screenshots come
  from here.
- CI: its own throwaway local Supabase stack per run (`supabase start` + canonical seed); never
  touches production.
- Staging database, PR preview links and the demo site (`republic-portal.vercel.app`): deleted
  2026-10-09 (ADR-051).

## Deploy

Merge to main → Vercel auto-deploys respublika.ge. Migrations reach production only through the
`production-db.yml` workflow (dry-run, then apply), after the code PR merges. Never edit schema
outside supabase/migrations/.
