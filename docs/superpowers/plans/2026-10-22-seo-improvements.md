# SEO Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make respublika.ge describe itself properly to search engines: real descriptions and
canonical addresses on every public page, private areas kept out of the index, a complete sitemap,
and structured data for the organisation and news articles.

**Architecture:** Metadata only. No database change, no new dependency, no change to sign-in logic.
Shared pieces live in `lib/` (pure functions, `import type` from Next only); pages call them from
`generateMetadata`. JSON-LD is rendered by one small server component.

**Tech Stack:** Next.js 16 App Router metadata API, next-intl copy via `getCopy()`/`t()`, Vitest.

**Spec:** this plan carries its own spec: the reviewed audit findings below (2026-10-22 SEO audit).
Process size: **Small** (CLAUDE.md): copy and tooling, one review, screenshots, owner sign-off.

## Reviewed audit findings (the spec)

Each finding was re-checked against `main` (cb87c34) and the live site on 2026-10-22.

| # | Finding | Verdict | Task |
|---|---|---|---|
| F1 | Home, about, structure, principles, support show the two-word description „სამოქალაქო პორტალი“ | Confirmed | 1 |
| F2 | Home title is only the name | Confirmed | 1 |
| F3 | Home, `/join`, `/login` have no canonical address | Confirmed | 1, 2 |
| F4 | Pages that set their own `openGraph` (news, news article, join, events, transparency) lose `og:site_name`: Next replaces the layout's `openGraph` object instead of merging it | **New**, confirmed on live `/news`, `/join` | 1 |
| F5 | No `og:locale` / `og:type` on most pages | Confirmed | 1 |
| F6 | robots.txt does not exclude `/admin`, `/me`, `/delegate`, `/api`, `/auth` | Confirmed | 2 |
| F7 | `/login`, `/styleguide`, `/styleguide-mobile-tabbar`, `/offline` are indexable, all titled only „ქართული რესპუბლიკა“ | **New** (styleguides, offline), confirmed live | 2 |
| F8 | Internal `/ka/...` addresses answer 307 (temporary); delegate share images are published under `/ka/...` | Confirmed; low impact | 2 |
| F9 | Sitemap has no news articles, no last-modified dates, homepage claims hourly change | Confirmed | 3 |
| F10 | No structured data (JSON-LD) anywhere | Confirmed | 4 |
| F11 | Google does not return the site for its own name | Confirmed by search; needs Search Console (owner) | 2 (verification tag), owner |
| F12 | `/join` has no heading in the server HTML | Confirmed, but **not fixed here**: the form reads `?ref=` client-side behind `<Suspense fallback={null}>`; Google renders the JS and sees the heading. A fix means restructuring the sign-up form; not worth the risk to referral attribution | none |
| F13 | Delegate pages are linked from nowhere | Confirmed, but caused by the owner's decision to hide ratings (ADR-052); a public delegate list is a product decision | owner |
| F14 | Hero map image downloads while hidden | **Withdrawn**: it is the visible hero map, 30 KB compressed | none |
| F15 | Logo PNG oversized | **Withdrawn**: 24 KB, negligible | none |
| F16 | Fonts are the heaviest part of a page (~276 KB) | Real but a design trade-off with no SEO-visible cost (load ≈ 2 s, no layout shift); out of scope | none |

## Global Constraints

- TypeScript strict. No `any`, no `@ts-ignore`.
- Domain logic = pure functions in `lib/` (no React/Next runtime imports; `import type` is fine).
- Every new Georgian string gets an English entry in `lib/i18n/messages/public.ts`
  (`lib/i18n/public-copy.test.ts` enforces this for the copy modules it imports).
- Georgian copy: no quotation marks in new strings (quote-transcription hazard); run `npm run ka:scan`.
- Site name stays exactly `ქართული რესპუბლიკა`; the owner's wording `სამოქალაქო პორტალი` (PR #69) stays in the home description.
- Share image stays `/og-default.png?v=civic-portal`.
- No new dependencies.
- All five CI gates green locally before push: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build`; plus e2e against the local database.

## Review Focus

1. robots.txt rules are **prefix matches**: a rule for the delegate panel (`/delegate`) must not block the public profiles at `/delegates/<slug>`, and `/me` must not block any future `/me…` public address → test in Task 2.
2. A news title containing `</script>` or `<!--` must not break out of the JSON-LD script tag → test in Task 4.
3. With `SHOW_ENGLISH=true`, `/en` pages must still get `og:locale` `en_GB`, not `ka_GE` → test in Task 1.
4. With the env var for Google verification unset, no empty `google-site-verification` tag is emitted → test in Task 2.
5. Outside production, robots.txt must still be `Disallow: /` only (e2e `public.spec.ts` pins this) → test in Task 2.

## File map

- Modify `lib/i18n/metadata.ts`: add `openGraphDefaults(locale)`.
- Modify `lib/home-copy.ts`, `lib/about-copy.ts`: add SEO title/description strings.
- Modify `lib/i18n/messages/public.ts`: English for the new strings.
- Modify `app/[locale]/layout.tsx`: use `openGraphDefaults`; add verification tag.
- Modify `app/[locale]/(unity)/page.tsx`: add `generateMetadata`, render JSON-LD.
- Modify metadata in `about`, `structure`, `principles`, `support`, `join`, `news`, `news/[slug]`, `events`, `events/[slug]`, `transparency`, `login` pages under `app/[locale]/(unity)/`.
- Modify `app/[locale]/(public)/styleguide/page.tsx`, `app/[locale]/styleguide-mobile-tabbar/page.tsx`, `app/[locale]/offline/page.tsx`: noindex.
- Modify `app/[locale]/(member)/layout.tsx`, `(admin)/layout.tsx`, `(delegate)/layout.tsx`: noindex.
- Modify `app/robots.ts`; create `app/robots.test.ts`.
- Modify `proxy.ts`, `proxy.test.ts`: `/ka` redirect permanent.
- Modify `app/sitemap.ts`, `app/sitemap.test.ts`.
- Create `lib/structured-data.ts`, `lib/structured-data.test.ts`, `components/JsonLd.tsx`, `components/JsonLd.test.tsx`.

---

### Task 1: Page descriptions, canonical home/join, share-preview defaults

**Files:**
- Modify: `lib/i18n/metadata.ts`, `lib/i18n/metadata.test.ts`
- Modify: `lib/home-copy.ts`, `lib/about-copy.ts`, `lib/i18n/messages/public.ts`
- Modify: `app/[locale]/layout.tsx`
- Modify: `app/[locale]/(unity)/page.tsx`, `about/page.tsx`, `structure/page.tsx`, `principles/page.tsx`, `support/page.tsx`, `join/page.tsx`, `news/page.tsx`, `news/[slug]/page.tsx`, `events/page.tsx`, `events/[slug]/page.tsx`, `transparency/page.tsx`
- Test: `app/[locale]/(unity)/seo-metadata.test.tsx` (new, one file for all public-page metadata)

**Interfaces:**
- Produces: `openGraphDefaults(locale: Locale): { siteName: string; locale: "ka_GE" | "en_GB"; type: "website" }` in `lib/i18n/metadata.ts`. Site name: `ქართული რესპუბლიკა` for ka, `Georgian Republic` for en.
- Produces copy constants:
  - `HOME_SEO_TITLE = "ქართული რესპუბლიკა — სამოქალაქო პორტალი"` (en: `Georgian Republic — civic portal`)
  - `HOME_SEO_DESCRIPTION = "სამოქალაქო პორტალი, რომელიც ქართველებს აერთიანებს საერთო მიზნებისა და ღირებულებების გარშემო. გაეცანი შეთანხმებას და გახდი მხარდამჭერი."` (en: `A civic portal uniting Georgians around shared goals and values. Read the agreement and become a supporter.`)
  - `ABOUT_SEO_DESCRIPTION = "ვინ ვართ, რის გვჯერა და რა არის ჩვენი მიზანი: ერთობიდან გამარჯვებამდე."` (en: `Who we are, what we believe and what we aim for: from unity to victory.`)
  - All three are **drafts for owner approval** before merge.

- [ ] **Step 1: Write the failing tests** in `seo-metadata.test.tsx` (mock `@/lib/supabase/public` and `@/lib/supabase/server` the way `missing-page-titles.test.tsx` and `about/page.test.tsx` do):
  - `home metadata`: `title === HOME_SEO_TITLE`, `description === HOME_SEO_DESCRIPTION`, `alternates.canonical === "/"`.
  - `it.each` over about/structure/principles/support: `description` equals `ABOUT_SEO_DESCRIPTION` / `STRUCTURE_INTRO` / `PRINCIPLES_LEDE` / `SUPPORT_LEDE`, and is never `"სამოქალაქო პორტალი"`.
  - `join metadata`: `alternates.canonical === "/join"`.
  - `it.each` over join, news, news article (mocked article), events and transparency (with `SHOW_EVENTS`/`SHOW_PUBLIC_FINANCES` stubbed on): `openGraph` contains `siteName: "ქართული რესპუბლიკა"`, `locale: "ka_GE"`; news article keeps `type: "article"`.
  - In `lib/i18n/metadata.test.ts`: `openGraphDefaults("ka")` and `openGraphDefaults("en")` return the values above (Review Focus 3).
- [ ] **Step 2: Run** `npx vitest run "app/[locale]/(unity)/seo-metadata.test.tsx" lib/i18n/metadata.test.ts` → FAIL (`openGraphDefaults` not exported, descriptions wrong).
- [ ] **Step 3: Implement.**
  - `openGraphDefaults` in `lib/i18n/metadata.ts`.
  - Layout `baseMetadata.openGraph` = `{ ...openGraphDefaults(locale), images: [...] }` for both locales (replace the hand-written en object).
  - Home `generateMetadata`: `t(HOME_SEO_TITLE)`, `t(HOME_SEO_DESCRIPTION)`, `...languageAlternates("/", locale)`. `openGraph` title/description follow from Next's defaults; do not set `openGraph` here (layout's applies).
  - about/structure/principles/support: add `description: t(<constant>)`.
  - join: add `...languageAlternates("/join", locale)`.
  - Every page that sets `openGraph` spreads `...openGraphDefaults(locale)` first, then its own keys (news article keeps `type: "article"` after the spread).
  - English entries in `lib/i18n/messages/public.ts`.
- [ ] **Step 4: Run** the same tests, plus `npx vitest run lib/i18n/public-copy.test.ts` and `npm run ka:scan` → PASS / clean.
- [ ] **Step 5: Commit** `Give public pages real descriptions and full share previews`.

### Task 2: Keep private and utility pages out of search; Search Console hook

**Files:**
- Modify: `app/robots.ts`; Create: `app/robots.test.ts`
- Modify: `app/[locale]/(unity)/login/page.tsx`
- Modify: `app/[locale]/(member)/layout.tsx`, `app/[locale]/(admin)/layout.tsx`, `app/[locale]/(delegate)/layout.tsx`
- Modify: `app/[locale]/(public)/styleguide/page.tsx`, `app/[locale]/styleguide-mobile-tabbar/page.tsx`, `app/[locale]/offline/page.tsx`
- Modify: `app/[locale]/layout.tsx`
- Modify: `proxy.ts`, `proxy.test.ts`
- Test: extend `seo-metadata.test.tsx` from Task 1; `app/robots.test.ts`; `proxy.test.ts`

**Interfaces:**
- Consumes: `languageAlternates` (existing).
- Produces: `export const NOINDEX = { index: false, follow: false } as const` in `lib/i18n/metadata.ts`, used as `robots: NOINDEX` everywhere below.

- [ ] **Step 1: Write the failing tests.**
  - `robots.test.ts`: production (`isProductionEnv` mocked true, `siteUrl` mocked) → `rules` is `{ userAgent: "*", allow: "/", disallow: ["/admin", "/me$", "/me/", "/delegate$", "/delegate/", "/api/", "/auth/"] }` and `sitemap` ends with `/sitemap.xml`; non-production → `{ userAgent: "*", disallow: "/" }` with no sitemap (Review Focus 5).
  - `robots.test.ts`, prefix safety (Review Focus 1): a helper `blocks(rule, path)` (`$` rule = exact match, otherwise `startsWith`) shows no rule blocks `/delegates/levan-nishnianidze`, `/`, `/news/x`, `/join`, `/login`, and that `/delegate`, `/delegate/team`, `/me`, `/me/profile`, `/admin/members` are each blocked.
  - `seo-metadata.test.tsx`: login metadata has `robots: NOINDEX`, `title === "შესვლა — ქართული რესპუბლიკა"`; styleguide, styleguide-mobile-tabbar, offline `metadata.robots` equals `NOINDEX`.
  - Group layouts: assert `metadata.robots` equals `NOINDEX` in the existing `(member)/layout.test.tsx` and `(delegate)/layout.test.tsx` (their mocks already load the layout); for `(admin)` add the assertion to `seo-metadata.test.tsx` with `@/lib/supabase/server` mocked as `about/page.test.tsx` does.
  - Layout `generateMetadata`: with `GOOGLE_SITE_VERIFICATION=abc` → `verification.google === "abc"`; unset or blank → no `verification` key (Review Focus 4).
  - `proxy.test.ts`: `it.each(["/ka", "/ka/about"])` → status `308`, location the unprefixed address; the existing `/en` cases stay `307`.
- [ ] **Step 2: Run** `npx vitest run app/robots.test.ts proxy.test.ts "app/[locale]/(unity)/seo-metadata.test.tsx"` → FAIL.
- [ ] **Step 3: Implement.**
  - `robots.ts`: add the `disallow` list to the production rule only. Never a bare `/delegate` or `/me` (they would block public addresses; see Review Focus 1).
  - Login: `generateMetadata` with `t("შესვლა") + " — " + t("ქართული რესპუბლიკა")` and `robots: NOINDEX` (no other change to the login page).
  - Group layouts and the three utility pages: `export const metadata: Metadata = { robots: NOINDEX }` (or add the key to existing metadata).
  - Root layout: spread `verification: { google }` only when `process.env.GOOGLE_SITE_VERIFICATION?.trim()` is non-empty. Not a secret; add it to `.env.example` with a comment in the style of the `SHOW_*` entries (server-side, set it for the build too). Claude sets the production value through the Vercel CLI once the owner sends the code; it takes effect on the next deploy.
  - `proxy.ts`: for the `/ka` branch call `NextResponse.redirect(destination, 308)`; leave the `/en` branch at the default 307 (English comes back later). Update the comment.
- [ ] **Step 4: Run** the same tests → PASS.
- [ ] **Step 5: Commit** `Keep private and utility pages out of search results`.

### Task 3: Complete sitemap

**Files:**
- Modify: `app/sitemap.ts`, `app/sitemap.test.ts`

**Interfaces:**
- Consumes: `fetchPublicNews(): Promise<PublicNewsItem[]>`, `fetchPublicEvents(): Promise<PublicEventItem[]>` from `@/lib/supabase/public`; `showEvents()` from `@/lib/events-switch`.

- [ ] **Step 1: Write the failing tests** (extend the mock to `fetchPublicNews`, `fetchPublicEvents`):
  - Two news items → entries `https://example.test/news/<slug>` with `lastModified` = the item's `published_at` as a `Date`, `changeFrequency: "monthly"`, `priority: 0.6`.
  - Homepage and `/news` entries have `lastModified` = newest `published_at`, homepage `changeFrequency: "daily"`.
  - No news → homepage and `/news` have no `lastModified` key.
  - A news item with `published_at: "not a date"` → its entry has no `lastModified`, and the sitemap still resolves.
  - `SHOW_EVENTS` unset → no `/events` URLs; `SHOW_EVENTS=true` with one event → `/events` and `/events/<slug>` listed.
  - `SHOW_PUBLIC_FINANCES` unset → no `/transparency`; `"true"` → listed (same pattern as the ranking).
  - Existing English-pairing test still passes and now also pairs news article URLs.
- [ ] **Step 2: Run** `npx vitest run app/sitemap.test.ts` → FAIL.
- [ ] **Step 3: Implement** in `sitemap.ts`: fetch news (and events when `showEvents()`) in parallel with delegates; `/transparency` gated by `showPublicFinances()` from `@/lib/public-finances`; one local helper `lastModifiedOf(iso: string | undefined): { lastModified: Date } | {}` that drops invalid dates; keep the existing `flatMap` English pairing untouched.
- [ ] **Step 4: Run** `npx vitest run app/sitemap.test.ts` → PASS.
- [ ] **Step 5: Commit** `List news articles and update dates in the sitemap`.

### Task 4: Structured data (organisation, website, news articles)

**Files:**
- Create: `lib/structured-data.ts`, `lib/structured-data.test.ts`
- Create: `components/JsonLd.tsx`, `components/JsonLd.test.tsx`
- Modify: `app/[locale]/(unity)/page.tsx`, `app/[locale]/(unity)/news/[slug]/page.tsx`

**Interfaces:**
- Produces in `lib/structured-data.ts`:
  - `type JsonLdObject = { "@context": "https://schema.org"; "@type": string } & Record<string, unknown>`
  - `organizationJsonLd(base: string): JsonLdObject` → `@type: "Organization"`, `name: "ქართული რესპუბლიკა"`, `url: base`, `logo: \`${base}/icons/icon-512.png\``. No `sameAs` until the owner gives official social accounts.
  - `websiteJsonLd(base: string): JsonLdObject` → `@type: "WebSite"`, `name`, `url: base`, `inLanguage: "ka"`.
  - `newsArticleJsonLd(base: string, article: Pick<PublicNewsItem, "slug" | "title" | "body" | "image_url" | "published_at">): JsonLdObject` → `@type: "NewsArticle"`, `headline` (title cut to 110 chars), `datePublished`, `url`, `image` (absolute; default share image when null), `publisher` = the organisation object without `@context`.
- Produces `JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] })` server component: `<script type="application/ld+json">` whose text is `JSON.stringify(data)` with every `<` replaced by `<`.

- [ ] **Step 1: Write the failing tests.**
  - `structured-data.test.ts`: exact objects for each builder with `base = "https://example.test"`; null `image_url` → `https://example.test/og-default.png?v=civic-portal`; relative `image_url` made absolute, absolute left alone; 200-char title cut to 110.
  - `JsonLd.test.tsx`: data with title `</script><script>alert(1)</script>` renders exactly one `script` element whose `textContent` contains no `<` and `JSON.parse` of it round-trips the title (Review Focus 2).
  - Home page test: renders one `application/ld+json` script with Organization and WebSite. News article page test: one with NewsArticle.
- [ ] **Step 2: Run** `npx vitest run lib/structured-data.test.ts components/JsonLd.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the builders, the component, and render `<JsonLd data={[organizationJsonLd(siteUrl()), websiteJsonLd(siteUrl())]} />` at the top of the home `<main>` and `<JsonLd data={newsArticleJsonLd(siteUrl(), article)} />` inside the news `<article>`.
- [ ] **Step 4: Run** the tests plus `npm test` → PASS.
- [ ] **Step 5: Commit** `Describe the organisation and news articles with structured data`.

### Task 5: Verify, review, release

- [ ] **Step 1:** All five gates locally: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build`. Then e2e against the local database (`npm run db:start`, `npm run e2e:local`; see the worktree e2e memory for the absolute CLI path).
- [ ] **Step 2:** On the local copy, read the HTML head of `/`, `/about`, `/news`, `/join`, `/login`, a news article and `/robots.txt`, `/sitemap.xml`: confirm description, canonical, `og:site_name`, `og:locale`, noindex, JSON-LD. Also confirm `og:title`/`og:description` on `/` follow the new title and description (Next fills them from the page's own; the unit tests cannot see that). robots.txt and the sitemap only show their production form with `NEXT_PUBLIC_APP_ENV=production`, so check that form through the unit tests and on the live site after release. Validate the JSON-LD with Google's Rich Results test only after release (it needs a public address).
- [ ] **Step 3:** One whole-branch review (superpowers:requesting-code-review).
- [ ] **Step 4:** Owner sign-off in chat: the before/after table of titles and descriptions in plain words, plus a screenshot of a share preview. The three new Georgian texts need the owner's explicit approval.
- [ ] **Step 5:** Push, open the PR, CI green, merge, then check the live site: the same head checks on respublika.ge, `robots.txt`, `sitemap.xml`.

## Plan review (2026-10-22)

Checked against the code before delivery. Changed as a result:

- **Bug fixed:** robots.txt rules are prefix matches, so the first draft's `/delegate` rule would
  have hidden every public delegate profile (`/delegates/<slug>`). Rules now use `$` / trailing
  slashes, with a test that public addresses stay crawlable.
- Group-layout noindex tests moved into the existing layout tests, which already mock sign-in.
- Sitemap also lists `/transparency` when finances are switched on, like the ranking.
- Google verification code: Claude sets it on Vercel; it applies from the next deploy.
- Local check notes that robots/sitemap show their production form only in production.

Confirmed: none of the pages touched is a client component (all may export metadata); the
organisation logo `/icons/icon-512.png` is the knot emblem; `SHOW_EVENTS` / `SHOW_PUBLIC_FINANCES`
are the switch names; `lib/i18n/public-copy.test.ts` already covers `home-copy` and `about-copy`.

## Owner decisions (outside the code)

1. **Approve or rewrite the three new texts** in Task 1 (home title, home description, about description).
2. **Google Search Console and Bing Webmaster Tools.** Adding a site needs a Google (and Microsoft) account sign-in, which only the owner can do. Once the owner pastes the verification code in chat, Task 2's `GOOGLE_SITE_VERIFICATION` setting carries it and Claude submits nothing else. This is the step that gets the site found under its own name (F11).
3. **Official social accounts** (Facebook page, etc.), if any, to add as `sameAs` in the organisation data.
4. **A public list of delegates** (F13): today the delegate pages are reachable only from shared links, because the ranking that linked them is hidden.
