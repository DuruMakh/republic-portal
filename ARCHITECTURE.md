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

## Registration funnel (Phase 2)

/join is a 3-step client funnel (choice → contact+OTP → legal profile → tier) with
member and delegate variants. All funnel writes go through four SECURITY DEFINER
Postgres RPCs (funnel_start / funnel_save_profile / funnel_complete / funnel_state) —
atomic, subject always auth.uid(), validation re-checked in-DB. The client UPDATE
grant on profiles is revoked, so the RPCs are the only client write path (Phase 3
re-grants a scoped path for cabinet editing). Thin zod-validated server actions sit
in front; funnel pages fetch state client-side on mount (useFunnelGuard) and redirect
client-side only. After OTP verification the login page routes by funnel state (no
profile → /join; draft → the derived step; completed → done/pending) instead of
/me/profile. Member reference codes (GR-XXXXXX) and delegate referral codes are
generated in-DB (gen_funnel_code, Crockford-style 31-char alphabet, no I/L/O/0/1).

## Cabinets (Phase 3)

/me/* (member) and /delegate/* (delegate panel) are per-request server-rendered
behind layout gates (session + completed registration + role) — safe because the
service worker treats them NetworkOnly. DB access is a mixed model (ADR-013):
the five plain profile fields update through a column-scoped grant + own-row RLS +
the protect-columns trigger; compound writes (member_change_delegate =
close-then-open membership history; member_change_tier) and delegate reads
(delegate_panel / delegate_team — the only client path to the caller's referral
code) are SECURITY DEFINER RPCs. funnel_state() also returns
status/registrationCompletedAt/createdAt. deriveDestination (lib/cabinet.ts)
sends completed users to their cabinet from login, /join and the funnel guards;
the funnel is one-way — done/pending render once via a sessionStorage marker set
by step 3. The public header swaps შესვლა→კაბინეტი client-side (the cached shell
stays session-agnostic). Dashboard rank reuses lib/ranking over public_delegates,
so it can never disagree with the leaderboard.

## Status derivation

Member/delegate statuses and supporter counts are always computed from source tables
(payments, memberships) by functions in lib/ — never stored as editable state.
