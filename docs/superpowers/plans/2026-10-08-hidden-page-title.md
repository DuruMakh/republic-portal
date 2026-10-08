# Hidden pages keep the not-found tab title — plan

**Goal:** a page hidden behind a server-only switch (`/transparency`, ADR-034; `/events` and
`/events/<slug>`, ADR-042) shows the exact Georgian not-found title on every visit, including after
its 60-second ISR entry regenerates. The shown mode is unchanged.

**Stacked on PR #32** (events hidden): the events rules need `lib/events-switch.ts`, which is not on
main yet. Merge #32 first.

## Root cause (probe, 2026-10-08, `next build` + `next start`)

Temporary probe pages in `app/(public)/` with `revalidate = 5`:

| page | build prerender | after ISR regeneration | request-time (`force-dynamic`) |
| --- | --- | --- | --- |
| `notFound()` + `generateMetadata` | page's title in the RSC payload only | **root layout title** | page's title in the RSC payload |
| `notFound()` + `export const metadata` | (same) | **root layout title** | — |
| shown page (control) | page's title | page's title | — |
| unmatched URL (`/no-such-page`) | not-found title in `<head>` **and** payload | (static, never regenerates) | — |

Two defects in how Next 16.2 renders a page-raised 404:

1. Background ISR regeneration drops the page's own metadata and keeps only the root layout's
   (`ქართული რესპუბლიკა`). This is the reported bug.
2. Even the build prerender serves the root layout's title in the HTML `<head>`; the page's title
   lives only in the RSC payload and reaches the tab when React hydrates. Without JavaScript (and
   for link previews) the tab never read "not found".

The site-wide not-found page (`app/not-found.tsx`, prerendered once as `/_not-found`) has neither
problem: its own `NOT_FOUND_METADATA` is in the `<head>` and the payload, and it never regenerates.

## Fix

Answer hidden addresses before the page cache is consulted: `proxy.ts` rewrites them to
`/_not-found` (status 404, the exact page a mistyped address gets). The page-level `notFound()` and
`NOT_FOUND_METADATA` stay as a second line of defence.

- `lib/hidden-routes.ts` — pure `hiddenBySwitch(pathname, switches)`: `/transparency` while finances
  are hidden, `/events` and `/events/<anything>` while events are hidden. Prefix match on a path
  segment boundary (`/eventsx` is not hidden).
- `proxy.ts` — if hidden, `NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 })`,
  skipping the session refresh; otherwise unchanged. The explicit status matters on Vercel only: a
  probe preview answered the bare rewrite with 200, while `next start` gives 404 either way.
- Member and admin events pages (`/me/events`, `/admin/content/events`) stay as PR #32 left them:
  they render per request, so the probe's request-time column applies and their titles are right.

## Tests (TDD)

1. `lib/hidden-routes.test.ts` (red first): every rule, both switch states, segment boundary.
2. `proxy.test.ts` (red first): hidden address → rewrite to `/_not-found`, no session refresh;
   shown address and ordinary pages → session refresh as before.
3. e2e `public.spec.ts`:
   - finances and events hidden checks assert the exact `NOT_FOUND_TITLE` again (PR #32's relaxed
     regex goes), plus the served HTML's own `<title>` (defect 2; fails on every visit before the fix).
   - one order-independent check: visit each hidden page, wait 61 s, visit again (serves stale and
     regenerates), visit a third time (regenerated); exact title every time.

## Gates

typecheck, lint, format:check, test, build, ka:scan; e2e hidden-mode specs against a production
build. ADR-040 (ADR-039 is taken by the referral split branch).
