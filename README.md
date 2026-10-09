# ქართული რესპუბლიკა — platform

Production app. Owner + AI collaboration; see CLAUDE.md for working rules,
ARCHITECTURE.md for structure, DECISIONS.md for the ADR log, DESIGN.md for UI rules.

## Quickstart (AI sessions)

1. `npm install`
2. `.env.local` from `.env.example` (staging values — ask owner's password manager)
3. `npm run dev` → http://localhost:3000 (or the `portal-dev` launch config)
4. Gates: `npm run typecheck && npm run lint && npm run test && npm run e2e`

## Environments

- Production: https://respublika.ge (Vercel project `georgia-republic`) → production Supabase
  `uorvlshbrlbdnbauxsws` in the owner's Duru org. Merge to main releases it.
- Staging: Supabase `republic-portal-staging` (ref orcxtbedkexoclbfgvzd, Duru org). Used by PR
  previews and local dev; previews offer the „სატესტო შესვლა“ one-click test sign-in (ADR-047).
- CI: its own throwaway local Supabase stack per run (`supabase start` + canonical seed); never
  touches staging or production.
- Demo site (`republic-portal.vercel.app`): being retired (ADR-047).

## Deploy

Merge to main → Vercel auto-deploys production. Migrations: `npx supabase db push`
(staging first, then prod). Auth/config changes: `npx supabase config push` (staging;
prod config is managed manually at Phase 6). All Vercel deployments are currently behind
Vercel SSO protection — decide public exposure at Phase 1 launch of the public site.
Never edit schema outside supabase/migrations/.
