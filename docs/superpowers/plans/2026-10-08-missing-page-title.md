# Missing article, delegate and event pages keep their own tab title — plan

**Goal:** `/news/<missing>`, `/delegates/<missing>` and (events shown) `/events/<missing>` show their
own Georgian "not found" title on every visit, in the served HTML and in the tab, including after the
page's 60-second ISR entry regenerates. Visible content is unchanged. Closes the "still open" item of
ADR-040.

**Stacked on PR #36** (which is stacked on PR #32): it reuses #36's e2e refresh check and the events
switch from #32, and touches the same comments. Merge #32, then #36, then this.

## Root cause and probe (2026-10-08)

Temporary pages `app/(public)/zprobe*/[slug]` with `revalidate = 5` and `notFound()` for unknown slugs.
"head" is the `<title>` in the served HTML; "tab" is the title after the page has loaded.

`next build` + `next start` (Next 16.2.10):

| variant | head, every visit | tab, first visit | tab, after regeneration |
| --- | --- | --- | --- |
| page `generateMetadata` only (today) | site name | page's title | **site name** (the bug) |
| + `(public)/not-found.tsx` exports `metadata` | group file's title | page's title | group file's title |
| + `[slug]/not-found.tsx` exports `metadata` | that file's title | page's title | that file's title |
| `[slug]/not-found.tsx` renders `<title>` in JSX | site name | its title | its title (two `<title>` elements) |
| segment file, page returns `{}` when missing | that file's title | **site name** | that file's title |
| `[slug]/not-found.tsx` exports `generateMetadata()` | its title | page's title | its title |

Vercel preview (throwaway branch, deleted): the HTML head carried the nearest not-found file's title on
every visit, the tab kept the page's title across regenerations (the `Age` header reset), status 404.

So a page-raised 404 takes its HTML title from the **nearest not-found file's** metadata, and its tab
title from the page's `generateMetadata` until a regeneration drops that. Earlier comments saying Next
ignores the not-found file's metadata were wrong for the HTML.

## Fix

The page's missing-case metadata and the nearest not-found file's metadata become the same object.

- `app/(public)/news/[slug]/not-found.tsx` (new): `metadata` = the article title moved from the page;
  renders the same `NotFoundNotice` the public group shows today. The page returns that `metadata`.
- `app/(public)/delegates/[slug]/not-found.tsx`: gains `metadata` (the delegate title moved from the
  page). The page returns it.
- `app/(public)/events/[slug]/not-found.tsx` (new): `generateMetadata()` = the event title while events
  are shown, `NOT_FOUND_METADATA` while hidden (the hidden page must never name events). The page's
  missing case returns that.
- `app/(public)/not-found.tsx`: exports `NOT_FOUND_METADATA`, the safety net for any other public page
  that raises a 404 (today `/transparency` and `/events` while hidden, whose pages already present
  that title). Comment corrected; the transparency and events-index comments too.

Rejected: rendering the missing case per request (`revalidate` is per route; a runtime switch to
dynamic errors), checking slugs in `proxy.ts` (a database read on every article view), a `<title>`
in the notice's JSX (the HTML keeps the site name), accepting the generic title.

## Tests (TDD)

1. `app/(public)/missing-page-titles.test.tsx` (red first): for news, delegates and events (shown),
   the not-found file's title is the exact Georgian title and equals the page's missing-case
   metadata; events hidden gives `NOT_FOUND_METADATA` from both; the public group's file exports
   `NOT_FOUND_METADATA`; every `app/(public)/**/[slug]/page.tsx` has a sibling `not-found.tsx`.
2. e2e `public.spec.ts`: PR #36's refresh check now also visits `/news/<missing>`,
   `/delegates/<missing>` and (events shown) `/events/<missing>`, three times across the 60-second
   window, asserting 404 and the exact title in the HTML and the tab. No extra wait.

## Gates

typecheck, lint, format:check, test, build, ka:scan (+ ka-gate on the diff); the refresh e2e against a
production build; the same addresses curled on the Vercel preview. ADR-041.
