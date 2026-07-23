# ქართული რესპუბლიკა — „ქრონიკა“ (Kronika D3) visual/UX redesign — design spec

- **Date:** 2026-07-23 · **Status:** brainstorm-approved section by section; awaiting owner review of this written spec
- **Release target:** v0.9.0, one release, single cutover · **Branch:** `claude/georgian-republic-redesign-33da46`
- **UX contract:** this spec + `prototype/kronika-d3/` replace `prototype/index.html` as the UX contract. The old prototype stays in the repo for history and is marked superseded at release.
- **Contract bundle:** `prototype/kronika-d3/kronika-d3-standalone.html` (the original self-contained mock, openable in a browser), `prototype/kronika-d3/kronika-d3-template.html` (the decoded page — **the byte-splice authority for all Georgian copy**), `prototype/kronika-d3/brand/` (10 logo PNGs, renamed; see Appendix A).
- **Prime directive inherited from brainstorming:** the mock governs look and layout; the shipped product (v0.8.0) governs behavior, flows, data rules and functional wording. Every place the mock's content was fiction, this spec names the real substitution.

## 1. Decisions locked in brainstorming (owner-approved 2026-07-23)

| # | Decision |
|---|---|
| D1 | Kronika D3 is the **look-and-layout contract**; shipped behavior/flows/labels/data rules win over the mock's content everywhere they conflict. |
| D2 | Scope: **the whole app** — all 46 pages (public, registration/login, member cabinet, delegate panel, admin). Admin keeps its calm dense register, rebuilt from Kronika materials. |
| D3 | Rollout: **one release (v0.9.0)**, one branch, one preview QA, one merge — a single identity cutover. |
| D4 | Code depth: **reskin & recompose** — every existing component keeps its name and contract; internals/visuals rewritten; pages recomposed from those components plus new furniture pieces. Business logic, forms, validation, data access untouched. |
| D5 | Hard constraints, all six: **Georgian-only** (mock's ქარ/ENG dropped), **routes/URLs unchanged**, **server-side authorization untouched**, **mobile-first**, **PWA installability**, **accessibility kept or improved**. |
| D6 | Copy: **the mock's voice wins on marketing/decorative surfaces** (spliced byte-for-byte from the template file); **shipped wording wins on functional surfaces** (buttons, forms, statuses, legal). Owner-decided per-item exceptions where mock voice replaces a shipped label: the header CTA (D9) and the transparency nav label (§4.10). |
| D7 | Build approach: **design system first, then recompose** (tokens → components → furniture → /styleguide, then pages section by section). Early owner checkpoint at styleguide + homepage on a Vercel preview. |
| D8 | Brand: the supplied logo set is canonical. **Brand red = `#9F1D35`**, sampled identically from every red logo file; it replaces the mock's `#A6192E` in every role. Vertical Georgian lockup = homepage nameplate; horizontal Georgian lockup = inner pages/cabinets/admin; textless roundel = app icon + favicon; white variants for ink surfaces; English variants committed but never rendered in-app. |
| D9 | Header CTA wording becomes **შემოგვიერთდი** (mock's voice), replacing „დარეგისტრირდი“ everywhere the header CTA appears. Destination and behavior unchanged (`/join`). |
| D10 | Nav **count badges ship with real counts** (member: open polls; admin: pending verifications) — the one approved addition beyond pure re-dressing, alongside the homepage news teaser (§4.1/S7). |

## 2. Design language

### 2.1 Materials

Newsprint on a desk. Every screen is a bounded **paper** sheet (max-width 1280px, 1px frame `#B5AB98`) on a **stone** page background. On mobile the paper is edge-to-edge (no stone visible). Depth comes from **rules, not shadows**: a double rule under the masthead (2px over 1px), 2px section-opening rules, 1px hairlines between rows. Corners are square everywhere; the only rounded elements are the tiny nav count badges. Call-out panels (poll card, my-delegate card, verification cards) use **bright paper** `#FFFDF8` with a full 1px ink border. The single permitted shadow is the printed edge `0 1px 0 #C9BFAC` on form sheets.

### 2.2 Palette (token values)

| Token (role) | Value | Notes |
|---|---|---|
| brand (the one red) | `#9F1D35` | From the logo files (D8). Links, kickers, active nav, №1 rank, focus outline, leading poll fill, danger/destructive role. Replaces both `#C8102E` (brand) and `#B3261E` (danger). |
| brand-dark (hover red) | `#7C1629` | Darkened step of brand; button hover, link hover. |
| ink | `#1A1611` | Warm near-black: text, heavy rules, primary button fill. Replaces `#12141C` and the navy `#0E1A2B`/`#16283F` roles. |
| body (serif body text) | `#3E362B` | Manifesto/article lede paragraphs. |
| muted | `#6E6659` | Secondary text. **Only ever on paper/bright-paper, never on stone** (contrast rule, §2.5). Replaces `#5B616E`. |
| paper | `#F7F2E9` | Sheet background; cream text on ink/red fills. Replaces white as the app's surface. |
| paper-bright | `#FFFDF8` | Call-out boxes, admin header band, form sheets. |
| stone | `#E5DFD2` | Desktop page background behind the sheet. |
| hairline | `#C9BFAC` | Row separators, light borders. Replaces `#E4E7EC`. |
| frame | `#B5AB98` | The sheet's outer border. |
| well | `#EFE8DA` | Poll/chart track fill, image-placeholder hatch base. |
| ok | `#188038` | Success (unchanged value); ≥12px or bold only. |
| ok-deep | `#146C2E` | Success in small print (<12px), 5.9:1 on paper. |
| warn | `#B45309` | Pending/amber (unchanged value); ≥12px or bold only. |
| warn-deep | `#96450A` | Amber small print, 6.0:1 on paper. |
| placeholder | `#A79D8D` | Input placeholders only; every field keeps a visible label, so placeholders are never load-bearing. |
| Retired | — | navy, navy-dark, gold, info-blue `#1A73E8`. Former info-status surfaces render in neutral ink chips (§3.1 Pill). |

Selection is inverted (ink background, paper text). Focus-visible is a 2px brand outline, offset 2px, on every interactive element.

### 2.3 Type

Same two families as today — **Noto Sans Georgian** and **Noto Serif Georgian** — redistributed; the serif's loaded weight range extends to 400/500/600/700 through the existing font pipeline (no new dependency).

- **Serif:** headlines, people's names, dates, and **all numerals** (counters, amounts, rankings, ledger figures). The homepage manifesto lede and article ledes are serif at ~1.12rem.
- **Sans:** UI labels, forms, buttons, nav, small-caps section labels (`.7rem`, weight 700, letterspacing ~.18em).
- Base 15px, line-height 1.65. Masthead nameplate is the vertical lockup image (not set type); page h1s are serif 2.1–2.7rem; the homepage manifesto headline is serif ~2.7rem with `text-wrap: balance`.
- **Minimum text size floor: 0.74rem (~11px).** The mock's `.62–.72rem` micro-print is bumped to the floor.
- Justified two-column body text is desktop-only; single-column left-aligned on mobile (Georgian doesn't hyphenate — justification on narrow columns produces rivers).
- The homepage manifesto keeps its **drop cap** (float technique, serif, brand red). Drop caps appear nowhere else.

### 2.4 Interaction identity

- **Primary buttons: ink fill, paper text; hover turns brand red.** Red stops being the default button color and becomes the accent.
- Ghost buttons: transparent, 1px ink border; hover inverts to ink fill/paper text. Muted ghost (e.g. „თავს ვიკავებ“ ballots): muted text, hairline border, hover restores ink.
- Danger actions use the brand red treatment (red border/text, or red fill for confirmed destructive primaries).
- Links: brand red, always underlined (1px, offset 3px); hover darkens to brand-dark.
- Button heights: lg 46px, md 40px, sm 34px — mapped to the existing `size` prop.
- Motion: color/background transitions only; no movement animations; the existing reduced-motion support stays.

### 2.5 Accessibility floors (verified against the palette)

- ink on paper 16.1:1; brand red on paper 7.0:1; muted on paper 5.1:1; paper on ink 16.1:1; paper on brand 7.0:1 — all pass AA.
- muted on stone is 4.3:1 → **rule: muted text never sits on stone** (stone only ever backs the sheet, not text).
- ok/warn on paper sit at 4.5:1 → small print uses ok-deep/warn-deep (§2.2).
- Text floor 0.74rem; tap heights per §2.4; visible labels on every field (placeholder never the only label); focus ring per §2.2; `prefers-reduced-motion` honored as today.

## 3. Component system

Contracts frozen: every component below keeps its file, exported name, props and behavior. Only internals, markup and styles change. Unit tests change only where they assert visuals.

### 3.1 Re-dressed components

| Component | Kronika treatment |
|---|---|
| Button / ButtonLink (primary·ghost·danger·dark·ghost-inverse; sm·md·lg) | §2.4 language. `dark` renders identically to `primary` (ink); `ghost-inverse` becomes paper-on-ink for dark surfaces (demo banner). Variant names all still work — no call-site churn. |
| Card (header, padded) | Ruled paper panel; `header` renders as a small-caps label over a 2px ink rule. A boxed appearance (bright paper + ink border) is used where pages need the call-out look, via the component's existing surface, not ad-hoc styling. |
| StatCard (accent, sub) | Figure block: serif number ~2.1rem, small muted label, hairline column separators; accent renders the figure in brand red or warn per current prop semantics. |
| Pill (status colors, label override) | Small-caps text chip, square. Mapping: ok→ok green, warn→warn amber, danger/rejected→brand red, info/profile_completed→**neutral ink**, muted→muted. Status keys, `TEAM_STATUS_LABELS`, `DELEGACY_STATUS_LABELS` and the Pill-defaults guard test stay byte-identical. |
| Badge (count chip) | The tiny rounded count dot (brand red; amber for admin verification), used by nav badges (D10). |
| Field (+ adminControlClasses) | Underline fields: small-caps label above, 1px ink bottom rule, focus = 2px brand rule, error = brand rule + brand small text. Admin dense variant matches. Boxed inputs disappear. |
| OtpInput | Six underline cells, serif digits. Same behavior/testids, including the env-gated on-screen test-code box (re-dressed as a small bordered note). |
| TierPicker (5/10/20₾) | Classifieds-style bordered options, serif amounts, radio semantics unchanged. |
| DelegateBinding | Ruled radio rows: serif name, muted meta line, selected marked in brand; „ცენტრალური მოძრაობა“ default row kept. |
| Stepper | Paper-form steps: done ✓ green, current brand-red underlined, upcoming muted; Roman-numeral prefixes are furniture; real step labels stay shipped wording. |
| CabinetNav / AdminNav / ContentNav | Underlined section-tab rows; active tab brand red with 2px red underline; count badges per D10; horizontal scroll on mobile; გასვლა stays. |
| DataTable + pagination footer | Printed ledger: 2px rule under small-caps column heads, hairline row rules, serif dates, right-aligned serif amounts, no zebra striping; ruled centered pagination footer. |
| NewsCard | Front-page brief: kicker, serif headline, muted dateline, hairline separation; cover image (when present) as a bordered figure with caption rule. |
| ContentBody | Same renderer; article typography per §2.3 (serif lede, sans body); no drop caps. |
| Poll bars / RSVP toggle | Ballot language: well track, brand fill for the leading option, ink for others, muted for abstain; answer buttons equal-width ghosts; RSVP keeps its exact behavior in ballot dress. |
| TransferInstructions + QrCode + CopyButton | The payment slip: bordered document box, prominent serif GR-code and amounts, QR inside the slip. |
| CenteredNotice | Ruled centered notice on paper. |
| DemoBanner | Same env-gating; thin ink strip, paper text, small white horizontal lockup optional. |

### 3.2 New furniture components (~8, in `components/`)

- **Masthead** — two modes. Full (homepage): dateline row, vertical Georgian lockup as nameplate, tagline სამოქალაქო პლატფორმა — ღია ჩანაწერი, double rule, nav row. Compact (all other pages): horizontal Georgian lockup left, page-register tag right (პირადი კაბინეტი / ადმინისტრირება / none), single 2px rule.
- **Dateline** — real current Tbilisi date (existing date formatter) + „თბილისი“. No edition №, no language toggle (D5).
- **SectionRule** — small-caps section label over a 2px rule, optional right-side link (სრულად →).
- **FigureBlock** — the registry/KPI figure with serif number and muted label (wraps/replaces StatCard internals where pages use the rail/KPI form).
- **IndexRow** — numbered directory row: serif №, serif name, muted meta, right-aligned serif figure; №1 in brand red.
- **BallotButtons** — the equal-width ghost answer row used by polls/RSVP.
- **PhotoFigure** — bordered image + hairline caption row (news/event covers; the homepage photo slot when a real photograph exists).
- **PageSheet / Footer** — the paper sheet wrapper (stone behind, frame border, mobile edge-to-edge) and the ruled footer: © 2026 ქართული რესპუბლიკა — ღია ჩანაწერი left; right links go only to real pages — წესები (`/join/terms`), სიახლეები (`/news`), ფინანსები (`/transparency`). The mock's კონფიდენციალურობა and არქივი links are dropped until such pages exist (no fake doors).

### 3.3 Retired looks

Navy footer/surfaces; gold/silver/bronze leaderboard medals (→ numbered index, red №1); card shadows; blue info styling; boxed inputs. `cardSkin`/`Eyebrow` re-express in Kronika terms (Eyebrow = red small-caps kicker) without call-site changes.

### 3.4 /styleguide

The gallery page is rebuilt to show the complete Kronika system — palette, type scale, every re-dressed component, every furniture piece, the status-chip table — and is the first stop of the early owner checkpoint (D7).

## 4. Public pages

### 4.1 Homepage (`/`)

Front page per mock S1: full Masthead; manifesto lead (kicker მანიფესტი, headline ავაშენოთ ქართული რესპუბლიკა ერთად, serif lede გამჭვირვალე სამოქალაქო მოძრაობა — ვერიფიცირებული დელეგატები, ღია რეიტინგი და საჯარო ფინანსები. შენს ხელში., byline row, drop-cap two-column body); the how-to-join classifieds strip; right rail (registry figures, top-5 ranking, news box). Spliced copy:

> **Headline:** ავაშენოთ ქართული რესპუბლიკა ერთად
>
> **Lede:** გამჭვირვალე სამოქალაქო მოძრაობა — ვერიფიცირებული დელეგატები, ღია რეიტინგი და საჯარო ფინანსები. შენს ხელში.
>
> **Column 1:** რესპუბლიკა არ შენდება ერთი მოედნიდან — ის იწერება ათასობით ხელმოწერით, ყოველ მხარეში, ყოველდღე. ჩვენი პლატფორმა თითოეულ წევრს აძლევს დადასტურებულ ხმას: პირადი ნომრით, SMS კოდით, საკუთარი დელეგატის არჩევით.
>
> **Column 2 (verbatim mock):** დელეგატები ლაგდებიან ღია რეიტინგში მხარდამჭერების მიხედვით; ყოველი ლარი აღირიცხება საჯარო დავთარში. წევრობა ფიქსირებულია — 20₾ თვეში — და ყველა გადაწყვეტილება შიდა გამოკითხვით მტკიცდება. [გააგრძელე კითხვა →]

**Copy correction requiring owner sign-off with this spec:** the mock's column 2 says „წევრობა ფიქსირებულია — 20₾ თვეში“ — a fixed 20₾ membership. Shipped reality is the 5/10/20₾ tier choice (D1). Proposed replacement clause, same rhythm: „წევრობის შენატანი არჩევითია — 5, 10 ან 20₾ თვეში“. The rest of the sentence stands as spliced.

Substitution ledger for this page (each item = mock fiction → real):

| # | Mock | Ships as |
|---|---|---|
| S1 | Dateline „გამოცემა № 27“, ქარ/ENG | Real Tbilisi date + „თბილისი“; no edition №, no toggle |
| S2 | Byline „№ 27“ | მოძრაობის რედაქცია · 3 წუთი კითხვა only |
| S3 | Fake photo + caption | Slot omitted until the owner supplies a real photograph + caption (PhotoFigure ready) |
| S4 | Supporter/member-20₾/delegate classifieds | The real ladder: რეგისტრირებული (free, <1 min, `/join`) → წევრი (5/10/20₾ tiers, from the cabinet) → დელეგატი (members-only, verification; descriptive column, links to `/join/terms`) — final Georgian drafted at implementation from shipped vocabulary, ka-gated |
| S5 | Registry rail static figures | Live shipped counters + monthly income (already public via `/transparency` data), with წყარო: საჯარო დავთარი + real date, linking to `/transparency` |
| S6 | Top-5 რეიტინგი — ხუთეული | Real leaderboard top-5 → `/leaderboard` |
| S7 | Public poll with percentages | **News box**: same bordered call-out, latest 2–3 public news headlines → `/news` (polls stay member-only) |
| S8 | Nav „გამოკითხვები“ (public) | Dropped from public nav (member-only feature) |

### 4.2 Delegates index (`/delegates`)

Mock S2: centered kicker საჯარო რეესტრი (the „ტომი II“ flourish is dropped), headline ჩვენი დელეგატები, sub-line from real derived counts (N approved · M regions — numerals, not word-numbers, no „განახლებულია ყოველდღე“ claim). Existing search + region filter as underline controls; two-column numbered IndexRow registry on desktop, single column mobile; real pagination line (ნაჩვენებია X / Y). GET-form behavior unchanged.

### 4.3 Delegate profile (`/delegates/[slug]`)

Profile piece: compact Masthead; serif name headline; kicker line region · status · approved-since; supporter FigureBlock; existing share/join affordances unchanged. No portrait (no photo data exists).

### 4.4 Leaderboard (`/leaderboard`)

Full printed index: IndexRows, red №1, medals retired (§3.3). Region shown in the meta line. Data and ordering unchanged.

### 4.5 News (`/news`, `/news/[slug]`)

List = front-page briefs (NewsCard). Article = kicker, serif headline, dateline rule, PhotoFigure cover when present, ContentBody. ISR behavior unchanged.

### 4.6 Events (`/events`, `/events/[slug]`)

Same brief/article language; RSVP block in ballot dress with behavior untouched (registered+ gating as shipped).

### 4.7 Transparency (`/transparency`)

The public ledger page: FigureBlocks + ruled tables; all figures derived live exactly as today. Nav label becomes ფინანსები (owner-approved); the page h1 and content wording otherwise stay shipped.

### 4.8 Join, login, terms (`/join`, `/login`, `/join/terms`)

Paper-form treatment: compact Masthead, kicker წევრის რეგისტრაცია (mock's „ფორმა B“ tag dropped — no such register exists), §-numbered field groups matching the real shipped fields only (name/surname/personal ID/phone + OTP), underline fields, serif OTP cells, terms links unchanged. The mock's „ინახება ავტომატურად · ჩანაწერი M-დრაფტი“ line is dropped (the one-step registration has no draft). Login: same language, lookup/retry behavior unchanged. Terms: ruled legal document via the shared DelegateTerms.

### 4.9 Offline, styleguide

Offline = ruled CenteredNotice on paper. Styleguide per §3.4.

### 4.10 Public nav & CTA (labels table)

| Route | Label |
|---|---|
| `/` | მთავარი |
| `/delegates` | დელეგატები |
| `/leaderboard` | რეიტინგი |
| `/news` | სიახლეები |
| `/events` | ღონისძიებები |
| `/transparency` | **ფინანსები** (changed from გამჭვირვალობა) |
| CTA → `/join` | **შემოგვიერთდი** (D9; replaces დარეგისტრირდი; signed-in header swap to კაბინეტი unchanged) |

## 5. Signed-in surfaces

### 5.1 Member cabinet (`/me/*`)

Compact Masthead + პირადი კაბინეტი tag; existing member tabs as the underlined section row (names/destinations unchanged) + polls count badge (D10). Profile: serif name h1; status line with real standing label, GR-code and member-since (existing formatters); პირადი მონაცემები ruled rows (phone, masked personal ID — masking rules untouched, region/city, employment); edit affordances unchanged. Right rail: ჩემი დელეგატი boxed card (rank №, name, region, supporters, დელეგატის შეცვლა → — the existing flow); poll call-out **only when a real open poll exists** — ballot-styled teaser linking to `/me/polls` (voting does not move onto the profile page). Registered-standing members see their shipped reduced tab set and the become-member CTA in the same dress.

### 5.2 Membership wizard (`/me/membership`, `/done`)

Paper form with Roman-numeral Stepper furniture over the real two shipped steps; TierPicker classifieds; done screen presents the GR-code certificate-style in large serif, behavior unchanged.

### 5.3 Billing (`/me/billing`)

The contributions ledger (შენატანების დავთარი): DataTable ledger dress, serif dates/amounts, year-total row summed from the displayed data, honest empty state, TransferInstructions as the payment slip.

### 5.4 Delegate panel (`/delegate`, `/delegate/team`)

The desk: compact Masthead whose register tag reuses the panel's shipped heading wording (spliced from app source, not the mock); FigureBlocks for team stats (incl. the registered figure), referral link + QR as a bordered clipping card with CopyButton, team ledger with existing chips/filters. All RPCs and gating untouched.

### 5.5 Admin (`/admin/*`)

Dense register on bright-paper header band + horizontal lockup + ადმინისტრირება. **The real admin nav survives in full** (overview, members, verification, finances, transfer, content, audit, settings, admins) — nothing from the mock's slimmer nav is removed; verification count badge per D10. Overview (დღის მიმოხილვა): KPI FigureBlock row from real figures (queue figure amber); წევრები მხარეების მიხედვით as ruled bar rows from real per-region counts **only if derivable from existing readable data — a new migration is not an acceptable cost, and the chart is dropped from scope rather than adding one** (verified at planning); ბოლო ტრანზაქციები ledger; ვერიფიკაციის რიგი — განსახილველი cards driving the existing audited flows. The mock's growth deltas (▲ +3.2%) are dropped (no stored history to derive honestly); the editor line shows the real signed-in admin. Members/finances/transfer/audit/content/settings: ledger tables, dense underline controls, masked-ID audited reveal, bulk classify-then-confirm chips, live content preview — all behavior identical.

### 5.6 Dropped fictions (signed-in)

M-XXXX record numbers (GR-codes are the real identity), fixed-20₾ any-surface remnants, growth deltas, mock-only nav slimming.

## 6. Mobile, PWA, share cards, motion

- **Mobile (390/360):** paper edge-to-edge; Masthead compresses to the two-line nameplate; section tabs = horizontally scrollable underlined row; ledgers keep printed-table form; ballot buttons equal-width; no floating action buttons; the existing 360px no-overflow e2e guarantee stays.
- **PWA:** `app/manifest.ts` updates — `background_color` → paper `#F7F2E9`, `theme_color` → paper (browser chrome reads as newsprint), icons regenerated from `emblem-roundel-red-notext.png` (192 crisp; 512 + maskable slightly soft from the 360px source — accepted, swap-ready when a vector arrives). Serwist/precache mechanics untouched; offline page re-dressed.
- **Share cards (OG):** delegate OG route + `og-default.png` rebuilt: paper background, roundel, serif name (Noto Serif Georgian TTF committed for the OG renderer alongside the existing sans TTF), red kicker. Satori constraints as learned in Phase 1 (explicit flex).
- **Motion:** §2.4; reduced-motion support and its tests unchanged.

## 7. Engineering constraints & invariants

1. **Zero database changes.** No new migrations, RPCs, views, or grants. D10 badges + S7 news teaser + the admin region chart read **existing** readable views only (member polls view; admin verify view; public news view; admin members data) — planning verifies each, and any that would need a migration is dropped, not migrated.
2. **Routes, redirects, gating, RLS, zod schemas, audit writes: byte-untouched.** Client-side checks remain UX-only, per CLAUDE.md.
3. **Formatters untouched:** `formatCountKa` (NBSP grouping — the mock's comma grouping is ignored), `formatDateKa`/Tbilisi day logic, GR-code display.
4. **Component contracts frozen** (D4): no prop renames/removals; new furniture components are additive. No new npm dependencies. Token swap happens in the Tailwind `@theme` block (`app/globals.css`) + component internals; retired tokens (navy, gold, info) are removed from the token set and their usages re-pointed, never left dangling.
5. **Georgian text discipline:** every task touching Georgian copy splices bytes from `prototype/kronika-d3/kronika-d3-template.html` (or existing app source for shipped wording) and runs the escape-based codepoint gate (U+201E/U+201C/U+201D checks, Greek-lookalike scan). No retyped quote glyphs anywhere, including docs. This spec itself was generated through that pipeline.
6. **Known label-coupled test updates** (enumerated per-file at planning; nothing else may silently change): header CTA დარეგისტრირდი → შემოგვიერთდი; transparency nav label → ფინანსები; leaderboard medal assertions → numbered-index assertions; any selector coupled to retired visual structure (e.g., hero locator, medal emoji). Functional-wording assertions (statuses, form labels, errors) must keep passing unchanged.
7. **ISR/caching semantics unchanged** (news/events/transparency revalidate windows; e2e settle patterns stay valid). PWA precache revisioning rides the normal deploy.
8. **Env-gated dev affordances** (demo banner, on-screen OTP test code) keep exact gating; only dress changes.

## 8. Contract & documentation changes (part of the release)

- `prototype/kronika-d3/` = new UX contract bundle (already committed with this spec). `prototype/index.html` + its README get a superseded banner note (kept for history).
- `DESIGN.md` rewritten as the Kronika system reference (tokens §2.2, type §2.3, component table §3, furniture, registers).
- `CLAUDE.md` UX-contract line re-pointed to `prototype/kronika-d3/`.
- `DECISIONS.md`: ADR-020 appended (adoption, D1–D10) — appended together with this spec.
- Version bump + CHANGELOG at release: **v0.9.0**.

## 9. QA, acceptance criteria, sign-off path

Process per CLAUDE.md: this spec → owner review/approval → implementation plan (writing-plans) → owner plan approval → subagent build (fresh implementer + independent reviewer per task) → whole-branch review → /qa on the Vercel preview → owner sign-off on the preview link → merge.

**Checkpoints for the owner (plain language + screenshots + preview URL, always):**
1. **Early look checkpoint (D7):** /styleguide + homepage on a preview link — judge the whole language before the remaining pages are dressed.
2. **Final walkthrough:** the full app on the preview — homepage/front page, delegate registry + profile, ranking, news/events/transparency, registration + login, member cabinet (profile/billing/wizard/polls), delegate desk, admin desk + one audited flow, mobile width, installed-app icon.

**Acceptance criteria:**
- All CI gates green (typecheck, lint, format, unit, build, e2e) with the §7.6 label updates and nothing else changed in test intent; e2e 360px overflow guard passing.
- ka-gate report clean on every touched file (zero ASCII quotes adjacent to Georgian, zero Greek lookalikes, balanced U+201E/U+201C pairs).
- Contrast spot-checks match §2.5 on the built pages (styleguide swatch page includes the checked pairs).
- Zero migrations in the diff; zero route changes; schema probe untouched and still green against staging.
- Old identity fully absent at cutover: no `#C8102E`/navy/gold/info-blue/medal usages survive (repo-wide token sweep in the whole-branch review).

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Breadth (46 pages) | System-first build (D7); per-task independent reviews; suite as safety net; early checkpoint catches direction errors before the long tail. |
| Silent Georgian quote corruption at this scale | §7.5 pipeline mandatory per task; reviewers dump codepoints; spec/DECISIONS generated the same way. |
| Label-coupled e2e churn hiding real regressions | §7.6 closed list at planning; any test change outside the list is treated as a defect signal, not adjusted away. |
| OG/satori regressions with the serif TTF | Verified on the Vercel preview exactly as Phase 1 did (meta og:image fetch → 200 + visual check). |
| PWA icon softness at 512px | Accepted (D8 note); swap-ready when a vector/hi-res arrives. |
| Admin region chart needs data we can't derive without a migration | Pre-verified at planning; dropped if not derivable (§5.5, §7.1). |
| Style-only intent drifting into behavior changes mid-build | D4 frozen contracts + §7 invariants are review gates; whole-branch review checks the diff against the §7.1–.3 invariants explicitly. |

## 11. Out of scope (this release)

Dark mode; English/second language; payment gateway; real photography (S3 slot waits for a real photo); launch-hardening checklist (real SMS provider, production Supabase + env swap, removing `/api/dev/otp` — the separate next phase per the master roadmap); Capacitor apps; push notifications; any feature beyond D10's badges and S7's news box.

## Appendix A — brand asset map (`prototype/kronika-d3/brand/`)

| File (repo) | Original filename | Use |
|---|---|---|
| lockup-vertical-geo-red.png | vert-GEO-Textlogo-RED.png | Homepage nameplate |
| lockup-horizontal-geo-red.png | horiz-Geo-textogo-red.png | Compact masthead (inner/cabinet/admin) |
| emblem-roundel-red-notext.png | White-red-emblem-withouttext.png | App icon, favicon, OG stamp |
| emblem-roundel-red-geo.png | red-white-Emblem-GEO.png | Alternative roundel (unused by default) |
| lockup-vertical-geo-white.png / lockup-horizontal-geo-white.png | vert-GEO-Textlogo-white.png / Horiz -GEO-textlogo-white.png | Ink-dark surfaces (demo banner option) |
| lockup-vertical-geo-black.png | vert-GEO-Textlogo-Black.png | Print/docs, not in-app |
| lockup-vertical-eng-red.png / lockup-horizontal-eng-red.png / emblem-roundel-black-eng.png | vert-ENG-textlogo-RED.png / Horiz-ENG-textlogo-RED.png / Black-red-Emblem.png | Committed, never rendered in-app (D5 Georgian-only) |

All red assets sample to `#9F1D35` exactly (verified per-file at 160×160-grid pixel sampling, 2026-07-23). Implementation copies the in-app subset to `public/brand/`.

## Appendix B — spliced copy inventory (template → app surface)

| Key | Content (spliced above) | Surface |
|---|---|---|
| tagline | სამოქალაქო პლატფორმა — ღია ჩანაწერი | Homepage masthead |
| manifestoKicker / H2 / Lede / P1 / P2 / continueLink | §4.1 block | Homepage lead |
| bylineEditorial / bylineRead | მოძრაობის რედაქცია / 3 წუთი კითხვა | Homepage byline |
| joinStripLabel | როგორ შემოგვიერთდები | Homepage classifieds rule |
| registryLabel / sourceLine / ratingLabel / fullLink / pollLabel | რეესტრი — დღეს / წყარო: საჯარო დავთარი / რეიტინგი — ხუთეული / სრულად → / დღის კითხვა | Rails (homepage + cabinet poll teaser) |
| footerCopyright / footerTerms | © 2026 ქართული რესპუბლიკა — ღია ჩანაწერი / წესები | Footer |
| delegatesKicker / delegatesH1 | საჯარო რეესტრი / ჩვენი დელეგატები | Delegates index |
| regKicker | წევრის რეგისტრაცია | Join paper form |
| cabinetTag / adminTag | პირადი კაბინეტი / ადმინისტრირება | Masthead register tags |
| personalDataLabel / ledgerLabel / myDelegateLabel / changeDelegateLink | პირადი მონაცემები / შენატანების დავთარი / ჩემი დელეგატი / დელეგატის შეცვლა → | Member cabinet |
| adminH1 / regionsChartLabel / recentTxLabel / verifyQueueLabel | დღის მიმოხილვა / წევრები მხარეების მიხედვით / ბოლო ტრანზაქციები / ვერიფიკაციის რიგი — განსახილველი | Admin desk |
| navFinances / cta | ფინანსები / შემოგვიერთდი | Nav (D9) |

Functional wording (statuses, form labels, errors, legal) is **not** in this inventory: it is spliced from the shipped app source, not the mock (D6).
