# Organization structure page (`/structure`) — design

Date: 2026-10-07 · Status: owner-approved design and spec (2026-10-07)
UX contract: `prototype/structure-concept/index.html` (published concept, version 5,
https://claude.ai/artifact/7RZntWZM7Ds1jSxsJUmZFm)

## In plain language (for the owner)

A new public page, **სტრუქტურა**, explains how the movement is run: the board, the
members, the general vote, and who sits on the board. It is information only — nothing
else on the site changes. It looks like the concept you approved (pebbles, narrow bold
headings, compact layout), sitting inside the site's normal header and footer.

- The menu gets a new item **სტრუქტურა**, in the header and the footer, on phone too.
- The board list starts empty and says **ბორდის შემადგენლობა მალე გამოქვეყნდება**.
  When you send names, photos, short bios and social links, I add them and the page
  shows the cards instead. Each change goes through a preview link for your sign-off.
- The "see how it will look" button from the concept is **not** on the real page — it
  was only there to show you the filled cards.
- No database changes, no new settings. Merging releases it to both the demo site and
  the real site (georgia-republic.vercel.app).

## 1. Scope

In: one static public page, its menu links, the sitemap entry, the board roster fed from
a typed list in code, tests.

Out (owner decision, 2026-10-07): admin editing of the board; any change to how members
join, pay, vote or how delegates work; the concept's sample-preview toggle; the concept's
interactive board-size picker (dropped with the 5→9 rule).

## 2. Approved text (verbatim, owner-agreed 2026-10-07)

All strings live in `lib/structure-copy.ts` and are spliced from this spec, never retyped.
The page contains no quotation marks (avoids the U+201C/U+201D hazard).

- Title: ორგანიზაციული სტრუქტურა
- Intro: მოძრაობას მართავს ბორდი, მის გადაწყვეტილებებში კი ყველა წევრი მონაწილეობს.
- **ბორდი** — ბორდი მოძრაობის მთავარი მმართველი ორგანოა და 5 წევრისგან შედგება.
  - List label: ბორდი
  - ამტკიცებს მოძრაობის სტრატეგიასა და სამოქმედო გეგმას
  - ამტკიცებს კვარტალურ ანგარიშს
  - იღებს ახალ წევრებს
  - ირჩევს ადმინისტრაციულ ხელმძღვანელს
  - Rules label: როგორ იღებს ბორდი გადაწყვეტილებას
  - Rule 1 — headline: არანაკლებ 2/3 · body: ბორდის ახალი წევრის დამატება და მოძრაობის წესდების დამტკიცება
  - Rule 2 — headline: უბრალო უმრავლესობა · body: ყველა სხვა გადაწყვეტილება
- **წევრები** — წევრად მიღება ხდება ბორდის გადაწყვეტილებით, გასაუბრების ან მოქმედი წევრის რეკომენდაციის საფუძველზე.
  - Path label: როგორ ხდები წევრი · steps: გასაუბრება ან მოქმედი წევრის რეკომენდაცია / ბორდის გადაწყვეტილება / მოძრაობის წევრი
  - Rights label: წევრს შეუძლია
  - ბორდს წარუდგინოს ინიციატივა
  - დაასახელოს კანდიდატი ბორდის წევრობისთვის
  - რეკომენდაცია გაუწიოს ახალ წევრს
  - მიიღოს მონაწილეობა საერთო კენჭისყრაში
- **საერთო კენჭისყრა** — ბორდს შეუძლია მნიშვნელოვანი საკითხი გადასაწყვეტად ყველა წევრს გადასცეს. გადაწყვეტილებას იღებს კენჭისყრის მონაწილეთა უმრავლესობა.
  - Tally legend: მომხრე / წინააღმდეგი
- **ბორდის შემადგენლობა** — empty-state notice: ბორდის შემადგენლობა მალე გამოქვეყნდება
- Closing button: შემოგვიერთდი → (links to `/join`, same as the header CTA)
- Nav label: სტრუქტურა · `<title>`: ორგანიზაციული სტრუქტურა

## 3. Page layout (top to bottom, per the concept)

1. **Hero (compact).** Condensed display `h1` (second word in brand red), intro in serif
   muted. Right: the pebble council — 5 brand pebbles on a thin ring around the word
   ბორდი, ~160 small member pebbles scattered around it. Hidden below 900px.
2. **Section index.** Three links (ბ ბორდი · წ წევრები · კ საერთო კენჭისყრა) with
   outlined serif letters, jumping to in-page anchors `#board`, `#members`, `#vote`.
3. **ბორდი.** Heading + lead; two columns: duties list (pebble bullets) | two rule cards,
   each with 5 pebbles of which `votesNeeded` are brand-filled (4 and 3), with an
   `aria-label` such as `5-დან 4 ხმა`.
4. **წევრები.** Heading + lead; two columns: the 3-step path (numbered pebble nodes on a
   vertical line, last node filled) | rights list.
5. **საერთო კენჭისყრა.** Heading + lead; tally panel: two even 4-row pebble piles
   (9 columns brand "for", 6 columns line-colour "against") split by a dashed divider,
   legend underneath. Illustrative only — no numbers.
6. **ბორდის შემადგენლობა.** Heading; roster grid (5 columns desktop, 2 on phone).
   Empty list → 5 placeholder cards (silhouette + grey bars) and the notice chip.
   Filled list → one card per member: photo (4:5), name (serif), bio, social links.
7. **Closing CTA** — one ink button to `/join`.

Large outlined section letters sit right of each section heading on desktop, hidden on
phone. Compact spacing per concept v4/v5 (section padding ~36–64px, headings ~2–3.1rem).

## 4. Design-system reconciliation

The page sits inside the existing public chrome (Masthead, PageSheet, SiteFooter); the
concept's own top bar and footer are mock-ups only.

- **Colours: no new tokens.** Concept → portal: ground → `paper`, raised panels →
  `paper-bright`, text → `ink`, secondary → `muted-fg`, rules/member pebbles → `line`,
  accent pebbles → `brand`, empty pebbles → `surface`. (The concept's cooler limestone
  ground becomes the site's warm paper — a deliberate, small shift so the page doesn't
  look foreign inside the sheet.) The site has no dark mode; none is added.
- **New: condensed display headings.** Load the `wdth` axis on the existing
  `Noto_Sans_Georgian` (`axes: ["wdth"]` — supported by next/font, axis 62.5–100) and add
  one `display` text style (sans, `font-stretch: 68%`, weight ~850, tight leading). Used
  for this page's `h1`/`h2`s only, for now. Recorded in DESIGN.md + ADR-036 (adds font
  bytes site-wide; no new dependency).
- **New: pebble motif.** One `Pebble` primitive (the irregular border-radius ellipse)
  reused by bullets, rule cards, path nodes; SVG pebbles for the council and the tally.
  Added to DESIGN.md's component register. Square corners rule: pebbles are the one
  sanctioned organic shape, scoped to this page.
- Motion: the five council pebbles fade in once (CSS, staggered); nothing else moves.
  `prefers-reduced-motion` disables it. Text floor 0.74rem and 2px brand focus ring hold.

## 5. Architecture

Static server-rendered page, no client JavaScript, no database, no env vars.

| Unit | Kind | Purpose |
|---|---|---|
| `lib/structure-copy.ts` | data | Every Georgian string from §2. |
| `lib/board-rules.ts` | pure | `BOARD_SIZE = 5`; `votesNeeded(rule, size)`: `twoThirds` → `ceil(2n/3)`, `majority` → `floor(n/2)+1`. |
| `lib/pebbles.ts` | pure | Seeded PRNG + `councilLayout()` and `tallyLayout(forCols, againstCols, rows)` returning pebble geometry (cx, cy, rx, ry, rotation, opacity). Deterministic → identical server output every build. |
| `lib/board-members.ts` | data + schema | `BoardMember` type, zod `boardMemberSchema`, and `BOARD_MEMBERS: BoardMember[] = []`. |
| `components/Pebble.tsx` | UI | The pebble shape primitive (size, filled/outlined). |
| `components/PebbleCouncil.tsx` | UI | Hero SVG from `councilLayout()`; `aria-hidden`. |
| `components/PebbleTally.tsx` | UI | Vote SVG from `tallyLayout()` (`aria-hidden`) + the visible legend, which carries the meaning. |
| `components/DecisionRuleCard.tsx` | UI | Headline, body, 5 pebbles with `votesNeeded` filled. |
| `components/MembershipPath.tsx` | UI | The 3 numbered steps. |
| `components/BoardRoster.tsx` | UI | Empty state vs. cards. |
| `components/BoardMemberCard.tsx` | UI | Photo, name, bio, `SocialLinks`. |
| `components/SocialLinks.tsx` | UI | Square text marks (fb / tt / in), as in the approved concept — no brand-logo artwork. |
| `app/(public)/structure/page.tsx` | route | Composes the above; `metadata` title. |

**Board member data.** `BoardMember = { name: string; photo: string; bio: string;
socials: { network: "facebook" | "tiktok" | "linkedin"; url: string }[] }`.
Schema rules: non-empty name; `photo` is a path under `/board/` (files in
`public/board/`, rendered with `next/image`, alt = name); bio 1–300 characters; each
social `url` is `https://` on that network's own host (facebook.com, tiktok.com,
linkedin.com); no email or phone fields exist. Facebook and TikTok are the usual pair;
LinkedIn appears only for some members — every network is optional per person. A unit
test parses `BOARD_MEMBERS` with the schema, so a bad entry fails CI. Owner-confirmed
set (2026-10-07); more networks only on request.

**Social links** open in a new tab with `rel="noopener noreferrer"` and an `aria-label`
naming the network (its Latin brand name) and the person, e.g. `Facebook: <name>`.

**Navigation.** Add `{ href: "/structure", label: "სტრუქტურა" }` to the public
`navItems` (after ღონისძიებები, before the hidden-by-default finance link) and to
`footerLinks`. `MobileMenu` already renders `navItems`, so phones get it too. Add
`/structure` to `app/sitemap.ts`.

## 6. Error handling and edge cases

- Empty `BOARD_MEMBERS` is the launch state, not an error.
- 1–4 or 6+ members: the grid simply holds that many cards; the "5 წევრი" text is copy
  and changes only with an owner-approved text edit.
- Missing photo file → CI fails: a unit test asserts each `photo` exists under `public/`.
- Unknown route segments under `/structure/*` fall to the (public) group's Georgian 404
  (already in place).

## 7. Testing (TDD)

- Unit: `votesNeeded` (5→4 and 3; 6–9 for sanity); `pebbles` determinism, counts and
  bounds (every pebble inside its viewBox — the clipping bug the owner caught);
  `boardMemberSchema` accepts a valid member and rejects email/phone-like URLs, foreign
  hosts and `http:`; `BOARD_MEMBERS` parses and every photo file exists.
- Component (Vitest + RTL): `DecisionRuleCard` fills exactly `votesNeeded` pebbles;
  `BoardRoster` empty → 5 placeholders + notice, filled → names, alts, social links with
  correct `rel`/`target`/labels; `MembershipPath` renders 3 ordered steps; page renders
  every §2 string; public layout nav and footer include სტრუქტურა.
- E2E (`e2e/public.spec.ts`): header link reaches `/structure`, the three anchors scroll
  to their sections, the notice shows; `responsive.spec.ts` covers `/structure` at phone
  width with no horizontal scroll.
- Gates: typecheck, lint, format:check, unit, build, e2e, `npm run ka:scan`.

## 8. Release

Merge releases to both sites (demo auto-deploy; real site linked to GitHub since
2026-10-07). No migrations, no env vars. After merge, verify `/structure` on
georgia-republic.vercel.app. Owner sign-off on the preview link before merge, with
plain-language notes + desktop and phone screenshots.
