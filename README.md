# ქართული რესპუბლიკა — platform

Production app. Owner + AI collaboration; see CLAUDE.md for working rules,
ARCHITECTURE.md for structure, DECISIONS.md for the ADR log, DESIGN.md for UI rules.

## Quickstart (AI sessions)

1. `npm install`
2. `.env.local` from `.env.example` (staging values — ask owner's password manager)
3. `npm run dev` → http://localhost:3000 (or the `portal-dev` launch config)
4. Gates: `npm run typecheck && npm run lint && npm run test && npm run e2e`

## Environments

- Production: Vercel production — TEMPORARILY pointing at the staging Supabase project
  until Phase 6 creates republic-portal-prod (free-plan project limit; Pro upgrade
  planned at launch hardening). Phone auth dark on production until Phase 6.
- Staging: all PR previews + local dev + CI → Supabase project republic-portal-staging
  (org "Republic Portal", eu-central-1, ref orcxtbedkexoclbfgvzd).

## Deploy

Merge to main → Vercel auto-deploys production. Migrations: `npx supabase db push`
(staging first, then prod). Auth/config changes: `npx supabase config push` (staging;
prod config is managed manually at Phase 6). All Vercel deployments are currently behind
Vercel SSO protection — decide public exposure at Phase 1 launch of the public site.
Never edit schema outside supabase/migrations/.
