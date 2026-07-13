# Design Spec — Phase 1: Public Core

**Date:** 2026-07-13
**Status:** Approved in brainstorming (owner approved all sections + 5 scoping decisions).
**Parent spec:** `2026-07-12-republic-portal-production-design.md` (binding platform spec; this
document details its "Phase 1 — Public core" row).
**UX contract:** `prototype/index.html`, screens `home`, `delegates`, `leaderboard`,
`delegate-public` (lines ~301–390 markup, ~1414–1522 logic). Copy, layout and behavior carry
over unless stated otherwise.

---

## 1. Goal

Replace the placeholder home page with the real public face of the platform, on real (seeded)
staging data: Home with live counters, delegate directory, leaderboard, and public delegate
pages — server-rendered, Georgian, shareable with proper OG previews. Registration does not
exist yet (Phase 2); news/events/transparency do not exist yet (Phase 5).

## 2. Decisions locked in brainstorming (owner-approved)

| # | Decision | Choice |
|---|---|---|
| 1 | Pre-launch data | Seed the prototype roster (12 approved + 3 pending delegates, ~1,887 members). A slim demo banner — „სადემონსტრაციო გარემო — მონაცემები ფიქტიურია" — shows whenever `NEXT_PUBLIC_APP_ENV !== "production"` |
| 2 | Join CTAs before Phase 2 | Both hero buttons and profile-page CTA route to a designed `/join` "opening soon" page. Phase 2 replaces that page in place |
| 3 | Delegate page URLs | Readable Latin slugs: `/delegates/giorgi-maisuradze`. Collisions get `-2`, `-3` … suffixes |
| 4 | Social share cards | Per-delegate OG image generated at request time (brand card: emblem, name, region, „აქტიური მხარდამჭერი: N"). Other public pages share one static branded image |
| 5 | Freshness vs speed | ISR with 60-second revalidation on all public pages. Counters may lag ≤60 s — accepted |

## 3. Pages

All pages live in `app/(public)/` and use the bold/patriotic register (DESIGN.md). All copy
Georgian; strings below are binding where given, otherwise carried verbatim from the prototype.

### 3.1 Shared public frame — `app/(public)/layout.tsx`

- Header: 🏛 emblem + wordmark „ქართული რესპუბლიკა" / sub „სამოქალაქო პლატფორმა" (links home);
  nav: მთავარი `/`, დელეგატები `/delegates`, რეიტინგი `/leaderboard`; right side: შესვლა
  `/login` (ghost) + გახდი წევრი `/join` (primary). No hamburger: links must fit a 360 px
  viewport by wrapping/compacting.
- Demo banner directly under the header when `NEXT_PUBLIC_APP_ENV !== "production"`:
  „სადემონსტრაციო გარემო — მონაცემები ფიქტიურია".
- Footer: wordmark, line „გამჭვირვალე, ანგარიშვალდებული და შენს ხელში.", the three nav links,
  „© 2026 ქართული რესპუბლიკა".
- The existing `/login` and `/styleguide` pages sit inside this group and inherit the frame;
  `/styleguide` stays unlisted (no nav link).

### 3.2 Home — `/` (replaces placeholder)

Hero (flag-stripe accent, serif H1 „ავაშენოთ ქართული რესპუბლიკა ერთად", lead sentence from
prototype, buttons „გახდი წევრი" → `/join`, „გახდი დელეგატი" → `/join?role=delegate` — the
query param is forwarded so Phase 2 inherits working links). Below: two live counters
(„დამტკიცებული დელეგატი", „აქტიური წევრი") with client-side count-up animation
(`prefers-reduced-motion` disables it; numbers render server-side first — no layout shift, no
zero-flash); three feature cards (verbatim prototype copy); dark button „ნახე დელეგატების
რეიტინგი →" → `/leaderboard`.

### 3.3 Delegate directory — `/delegates`

Eyebrow „საჯარო პორტალი", H1 „ჩვენი დელეგატები", prototype intro copy. Controls: name-search
input (placeholder „ძებნა სახელით...") + region `<select>` („ყველა მხარე" + the 11 regions).
Count line „ნაჩვენებია N დელეგატი". Card grid: region, full name, active-supporter count +
label „აქტიური მხარდამჭერი", pill „დამტკიცებული"; card links to the delegate page. Default
order = leaderboard order. Empty state: prototype copy („ამ პარამეტრებით დელეგატი ვერ
მოიძებნა..."). The full approved list is server-rendered; search/filter is a client component
filtering that list in memory (12–100 rows — no server round-trips).

### 3.4 Leaderboard — `/leaderboard`

Eyebrow „ლიდერბორდი", H1 „დელეგატების რეიტინგი", intro copy. Card „ცოცხალი რეიტინგი" with
badge „N დელეგატი" and ranked rows: ranks 1–3 render 🥇🥈🥉 + highlighted row styling, rank ≥4
renders the number; row = name, region, count + „მხარდამჭერი"; rows link to delegate pages.
Footnote: prototype copy („რეიტინგი ახლდება ავტომატურად...").

### 3.5 Delegate page — `/delegates/[slug]`

Back link „← უკან რეიტინგზე" → `/leaderboard`; pill „დამტკიცებული". Profile card: round
initials avatar (photo renders via `photo_url` when set; seed sets none — no fake faces),
region eyebrow, name H2, bio paragraph (seeded `bio`; when null, the prototype's generated
line: „{region}ის რეგიონული დელეგატი. ..."). Two stat tiles: „აქტიური მხარდამჭერი" (red
variant) and „პოზიცია რეიტინგში" `#N` („დამტკიცებულ დელეგატებს შორის"). CTA card „დაუდექი
მხარში {firstName}-ს" + button „გახდი მისი მხარდამჭერი" → `/join`. Unknown slug → 404 page
with „დელეგატი ვერ მოიძებნა." + link „დაბრუნდი რეიტინგზე".

### 3.6 Opening-soon — `/join`

Serif H1 „რეგისტრაცია მალე გაიხსნება", body „პლატფორმა მშენებლობის პროცესშია — წევრობის
გახსნისთანავე აქვე შეძლებ დარეგისტრირებას.", primary button „მთავარ გვერდზე დაბრუნება" → `/`,
ghost button „ნახე დელეგატების რეიტინგი" → `/leaderboard`. Accepts (and ignores, in Phase 1)
`?role=delegate`.

## 4. Public read model (database)

One migration, `*_public_read_model.sql`:

- **View `public_delegates`** (default definer semantics, owner `postgres` — a deliberate,
  documented exception to Supabase's security-definer-view lint warning; it exists precisely
  to bypass `profiles` RLS for a fixed safe column set): approved delegates only, columns
  `id, slug, first_name, last_name, region_id, region_name_ka, bio, photo_url,
  active_supporters`. `active_supporters` = count of `memberships` rows with
  `ended_at is null` whose member's `profiles.status = 'active_member'`. **Nothing else** —
  `tc_accepted_at`, `verified_at`, `verified_by`, `referral_code`, phones, personal IDs and
  birth dates are not reachable through any public path.
- **View `public_stats`**: one row — `approved_delegates` (count of approved `delegates`),
  `active_members` (count of `profiles` with `status = 'active_member'` — delegates' own
  profiles included; they are members too).
- **Grants:** `select` on both views to `anon, authenticated`.
- **Tightening (closes Phase 0 deferred item):** drop policy `"approved delegates are public"`
  on `delegates`; revoke `select` on `delegates` from `anon, authenticated`. Public reads go
  only through the views. (Phase 3 adds an own-row policy when the delegate cabinet needs it.)
- **Column protection rider (Phase 0 deferred item):** add `created_at` to the
  `protect_profile_columns()` trigger's guarded list.
- **Index:** partial index on `memberships (delegate_id) where ended_at is null` (serves the
  count).
- **`delegates.slug`**: new `text unique` column. Seed backfills it; from Phase 4 on, approval
  generates it. Nullable, but every `approved` delegate must have one (enforced by a check
  constraint `status <> 'approved' or slug is not null`).

**Status-derivation bridge (recorded intent):** the platform spec derives `active_member` from
payment recency. The payment-recording engine arrives in Phase 4; until then
`profiles.status` (server-managed, trigger-protected) is the source the views count, and the
seed sets it directly. Phase 4 replaces the *writer* of that column, not this read model.

## 5. Domain logic (`lib/`, pure, TDD)

- `lib/ranking.ts` — `rankDelegates(rows)`: sort by `active_supporters` desc, ties by full
  name via `Intl.Collator("ka")`; returns rows with `rank`. `medalFor(rank)`: 1→🥇 2→🥈 3→🥉
  else null. Rank-of-delegate falls out of the sorted list.
- `lib/slug.ts` — `transliterateGeorgian(text)`: national romanization with aspirate marks
  dropped (ა a, ბ b, გ g, დ d, ე e, ვ v, ზ z, თ t, ი i, კ k, ლ l, მ m, ნ n, ო o, პ p, ჟ zh,
  რ r, ს s, ტ t, უ u, ფ p, ქ k, ღ gh, ყ q, შ sh, ჩ ch, ც ts, ძ dz, წ ts, ჭ ch, ხ kh, ჯ j,
  ჰ h); `makeSlug(fullName, taken)`: lowercase, hyphen-joined, `-2`/`-3`… on collision.
- `lib/format.ts` — `formatCountKa(n)`: `toLocaleString("ka-GE")`.
- `lib/supabase/public.ts` — **cookie-free** anon client factory (`server-only`), used by all
  public pages. Rationale: the cookie-bound `createServerSupabase()` would force every page
  dynamic and defeat ISR; public pages must never read sessions.

## 6. Rendering, metadata, SEO

- Every public page: `export const revalidate = 60`. Delegate pages additionally
  `generateStaticParams` (all approved slugs at build) with default `dynamicParams = true`, so
  a newly approved delegate's page appears without a redeploy.
- `generateMetadata` per page: Georgian titles/descriptions; delegate page title
  „{სახელი გვარი} — ქართული რესპუბლიკა". `metadataBase` derives from Vercel system envs
  (`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`) so OG URLs are absolute on previews too.
- **OG images:** `app/(public)/delegates/[slug]/opengraph-image.tsx` via `next/og`
  `ImageResponse` (same 60 s revalidation): brand-red card, emblem, name, region,
  „აქტიური მხარდამჭერი: N", wordmark. Georgian text requires a bundled font file: subset TTF
  of Noto Sans Georgian committed under `assets/fonts/` with its OFL license file (satori
  cannot use woff2). All other public pages: static `public/og-default.png` generated by a
  one-off sharp script (same pipeline as icons), referenced in root metadata.
- `app/robots.ts`: `NEXT_PUBLIC_APP_ENV === "production"` → allow + sitemap; anything else →
  disallow all (belt and braces on top of Vercel's preview `x-robots-tag`).
- `app/sitemap.ts`: `/`, `/delegates`, `/leaderboard`, all delegate pages.

## 7. Seed data (staging)

`scripts/seed-staging.mjs` (service-role; run manually, never in CI):

- **Guards:** refuses when `NEXT_PUBLIC_APP_ENV === "production"`; requires
  `--confirm-ref <project-ref>` matching the ref parsed from `NEXT_PUBLIC_SUPABASE_URL`.
- **Reset first (closes "staging data pruning" deferred item):** deletes all auth users
  (cascades through profiles/delegates/memberships), truncates `dev_otp_inbox`. Staging holds
  synthetic data only; this is safe by definition.
- **Roster (prototype parity):** approved — გიორგი მაისურაძე/თბილისი/342, თამარ
  ქავთარაძე/აჭარა/287, ლევან ჩხეიძე/იმერეთი/256, ნინო გელაშვილი/კახეთი/198, დავით
  კობახიძე/ქვემო ქართლი/176, მარიამ წიქარიშვილი/სამეგრელო-ზემო სვანეთი/154, ზურაბ
  ბერიძე/სამცხე-ჯავახეთი/121, ეკა მელაძე/გურია/98, ირაკლი ფხაკაძე/მცხეთა-მთიანეთი/83, სოფიო
  ლომიძე/შიდა ქართლი/67, ვახტანგ ნადირაძე/რაჭა-ლეჩხუმი და ქვემო სვანეთი/41, ანა
  ჯაფარიძე/თბილისი/39. Pending (must NOT appear publicly): ბექა ღოღობერიძე/იმერეთი/12,
  ქეთევან სვანიძე/კახეთი/8, ალექსანდრე თავაძე/ქვემო ქართლი/5.
- **Mechanics:** each person = auth user (`auth.admin.createUser`, deterministic fake phone
  `+99550XXXXXXX`, `phone_confirm: true` — real numbers can never collide with the `50`
  prefix) + `profiles` row (name, region, deterministic 11-digit `personal_id`, status) +
  for delegates a `delegates` row (status, slug from `lib/slug`, short seeded Georgian bio,
  `tc_accepted_at`) + for supporters an open `memberships` row → their delegate. Per delegate,
  `round(N × 0.86)` supporters get `active_member`, the rest split
  `profile_completed`/`draft` (prototype's ratio). Delegates' own profiles: `active_member`,
  no membership row (keeps card counts exactly at roster numbers). Concurrency-batched
  (~1,900 users); idempotent by construction (reset-first).
- Expected result: home counters ≈ 12 approved delegates / ≈1,635 active members; leaderboard
  order exactly the roster order above.

## 8. Testing

- **Unit (Vitest, failing-first):** transliteration table incl. every letter above;
  slug collision suffixing; ranking order + ka tie-break + medals + rank-of; count formatting.
- **Component:** DelegateCard (region/name/count/pill/link), LeaderRow (medal vs number,
  highlight ranks 1–3), DemoBanner (renders unless env is production), counter renders
  server value without animation when reduced-motion.
- **e2e (Playwright, read-only against seeded staging):** home shows both counters > 0 and
  nav routes work; directory search narrows (e.g., „გიორგი"), region filter works, silly query
  shows empty state; leaderboard row 1 contains 🥇 and 12 rows total; delegate page by slug
  shows name, rank and supporter count; pending delegate's name appears nowhere public; join
  buttons land on opening-soon; delegate page HTML contains `og:title` and `og:image`.
- **e2e infra (closes deferred item):** `playwright.config.ts` webServer becomes
  `npm run start` when `CI` (real production build — `npm run build` already precedes it in
  the workflow), `npm run dev` locally. Cross-PR e2e sharing staging stays safe: Phase 1 e2e
  is read-only and the login e2e already uses a per-run phone.

## 9. Hygiene riders (Phase 0 leftovers, one small task)

- Strip UTF-8 BOMs from the three affected files (locate via grep at implementation time).
- `Field` component: caller-supplied `id`/props must not sever the label↔input link (spread
  order fix).
- CI: bump `actions/checkout` + `actions/setup-node` to v5 (current majors) if compatible.
- DESIGN.md: add one line making the body-background rule explicit (page background is white;
  `surface` is for wells/inputs/inactive elements — matches prototype usage).

Still deferred (unchanged): zod boundary pattern (first real form boundary is Phase 2),
composite-FK MATCH SIMPLE note (informational), Phase 6 launch checklist.

## 10. Out of scope

Registration funnel (Phase 2); member/delegate cabinets (Phase 3); admin CRM, real slug
generation on approval, payments→status derivation engine (Phase 4); news/events/transparency
(Phase 5); real SMS, prod Supabase, indexing-on (Phase 6). **No new npm dependencies** — the
OG generator (`next/og`) ships with Next; the bundled font is an asset, not a package.

## 11. Rollout & sign-off

- Branch `claude/phase-1-public-core` off `main`; subagent-driven execution (fresh implementer
  per task + independent reviewer per task), final whole-branch review + independent
  `/codex review`; single PR; CI green throughout.
- **Environment check during QA:** the Vercel *production* URL currently serves staging data
  (prod Supabase arrives in Phase 6). QA must verify the demo banner shows and `robots.txt`
  disallows indexing on that URL; if its `NEXT_PUBLIC_APP_ENV` is already set to `production`,
  change it to `preview` until Phase 6 (owner or CLI — one env var).
- Owner sign-off package: Vercel preview link + plain-language QA notes + screenshots (home
  with counters, directory searched + region-filtered, leaderboard with medals, a delegate
  page, the generated share-card image, phone-width set) — then merge.

## 12. Success criteria

- Sharing `/delegates/giorgi-maisuradze` into a social debugger shows the personalized card
  with correct Georgian text.
- The four public screens match the prototype's UX contract on desktop and a 360 px phone.
- Anonymous queries can read exactly the public-view columns and nothing else from
  `delegates`/`profiles` (verified by an updated `scripts/verify-schema.mjs` probe).
- Pending seeded delegates are absent from every public surface.
- All CI gates green; owner sign-off recorded on the PR.
