# English Portal Implementation Plan

> **For agentic workers:** Use the test-first workflow and review each task, then review the combined change. Independent translation areas may run in parallel with disjoint file ownership.

**Goal:** A usable English public portal and registration/member/delegate experience alongside unchanged Georgian addresses.

**Architecture:** One localized route tree, request-scoped language, shared navigation wrappers, and explicit English copy dictionaries. Original user/published content remains labelled and unchanged.

**Tech stack:** Existing Next.js 16.3, React 19, TypeScript, Supabase; next-intl for language context and navigation.

**Spec:** `docs/superpowers/specs/2026-10-18-english-portal-design.md`

## Global constraints

- Georgian is default at existing addresses; English uses `/en`.
- No database changes, content rewrites, new permissions, or administration translation.
- Preserve Georgian copy and the existing design system.
- Translate static pages, registration/member/delegate controls, validation messages and accessibility labels.
- Use the current isolated worktree and a single review branch; no merge before owner sign-off.

## Shared interfaces

- `lib/i18n/routing.ts`: `Locale = 'ka' | 'en'`, `localePath(href, locale)`, `stripLocale(pathname)`, routing configuration.
- `lib/i18n/navigation.tsx`: default/named `Link` and locale-aware `useRouter`; existing Next navigation remains available for unrelated hooks.
- `lib/i18n/copy.ts`: `useCopy()` returns `(source: string) => string` using the current request/provider language; source is fixed Georgian interface copy, never authored content.
- `lib/i18n/server.ts`: async `getCopy()` and `getLocale()` for async server pages and metadata.
- `lib/i18n/translate.ts`: pure `translate(source, locale)`; dictionaries in `lib/i18n/messages/{public,accounts,shared}.ts` export `Record<string, string>`.

## Task 1: Language foundation and shared chrome

Files: localized route layout, proxy, Next config, i18n modules, shared header/footer/navigation, service worker routing, metadata and corresponding tests.

- [x] Add failing tests for `/en`, Georgian stability, hash/query preservation, protected routes, spoofed request language, and hidden sections in English.
- [x] Implement the route tree and request/provider language, language switch, shared links, metadata, and private-cache protections.
- [x] Run focused tests; verify Georgian and English request isolation and administrative destinations.

## Task 2: Public page translations

Files: public page bodies and their own content components; `messages/public.ts`. Exclude shared chrome and sign-in/registration.

- [x] Add a failing English rendering test for representative public copy and navigation.
- [x] Translate home, about, agreement, structure, support, privacy, terms, lists/details/empty states, original-content labels, and public page metadata using shared interfaces.
- [x] Run public/component tests and inspect full English pages for missing fixed text.

## Task 3: Registration and accounts

Files: login/join, member/delegate route groups, their forms and account components; `messages/accounts.ts`; auth callback and related tests.

- [x] Add failing tests for English entry, error/validation messages, localized post-sign-in destinations and safe return paths.
- [x] Translate registration, consent, membership, profile, delegation, billing, community controls and sign-out/deletion; preserve locale through redirects.
- [x] Run account tests and local database journeys, including an unsafe return-path check.

## Task 4: Integration, review and evidence

- [x] Review all areas and fix verified problems with regression tests.
- [x] Run typecheck, lint, format check, Georgian integrity scan, all unit tests, build, and local e2e.
- [x] Capture desktop/mobile English screenshots and check the Georgian counterpart.
- [ ] Prepare one PR with plain-language scope and verification evidence; stop before merge for owner sign-off.

## Review focus

- Language switching retains referral parameters and section anchors (Task 1).
- Hidden pages cannot be reached by adding `/en` (Task 1).
- English private pages and account responses cannot be served from offline cache (Task 1).
- Failed Google returns and new-user registration remain in English without accepting external redirects (Task 3).
- Original authored data is labelled without changing its values or implying a translation exists (Task 2/3).
