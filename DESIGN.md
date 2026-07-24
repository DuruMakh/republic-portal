# DESIGN.md — the Kronika design system

The visual + interaction reference for the production app. **One material system** now spans
every surface (adopted at v0.9.0; DECISIONS.md ADR-020). The living gallery is `/styleguide`.
The sources of visual truth are the contract bundle `prototype/kronika-d3/` and the spec
`docs/superpowers/specs/2026-07-23-kronika-redesign-design.md`.

> **Never restyle ad hoc.** Reuse or extend a component. Anything not expressible through the
> tokens and components below is a component change plus a `/styleguide` entry — never inline
> one-off classes. Component **contracts are frozen**: files, exported names, props and
> behavior are stable; the redesign changed only markup and styles.

## Registers — one material, three densities

Kronika is a single "newsprint on a desk" system, not the old public/cabinet split. The same
paper, rules, and type serve three densities:

- **Public editorial** — front page, registry, news: serif display, generous rules.
- **Cabinet ledger** — member / delegate surfaces: the same paper, tighter.
- **Admin dense** — ledger tables and underline controls at maximum density.

## Materials (spec §2.1)

Newsprint on a desk. Every screen is a bounded **paper** sheet (max-width 1280px, 1px `frame`
border) on a **stone** page background; on mobile the paper is edge-to-edge (no stone).
**Depth comes from rules, not shadows:** a double rule under the masthead (2px over 1px), 2px
section-opening rules, 1px hairlines between rows. Corners are square everywhere; the only
rounded elements are the tiny nav count badges. Call-out panels (poll card, my-delegate card,
verification cards) use **paper-bright** with a full 1px ink border. The single permitted
shadow is the printed edge `0 1px 0 #c9bfac` on form sheets. Selection is inverted (ink
background, paper text).

## Palette (spec §2.2)

Tokens live in `app/globals.css` under `@theme` as `--color-<name>`; use them through Tailwind
utilities (`bg-paper`, `text-ink`, `border-line`, `text-muted-fg`, …). Values only below — the
roles are the contract.

| Token                | Value                 | Role                                                                                                              |
| -------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `brand`              | `#9f1d35`             | The one red: links, kickers, active nav, №1 rank, focus ring, leading poll fill, and the danger/destructive role. |
| `brand-dark`         | `#7c1629`             | Button and link hover.                                                                                            |
| `ink`                | `#1a1611`             | Warm near-black: text, heavy rules, primary-button fill.                                                          |
| `prose`              | `#3e362b`             | Serif body text (manifesto lede, article ledes).                                                                  |
| `muted-fg`           | `#6e6659`             | Secondary text. **Only on paper / paper-bright, never on stone** (§2.5).                                          |
| `paper`              | `#f7f2e9`             | Sheet background; also the cream text color on ink/red fills.                                                     |
| `paper-bright`       | `#fffdf8`             | Call-out boxes, admin header band, form sheets.                                                                   |
| `stone`              | `#e5dfd2`             | Desktop page background behind the sheet.                                                                         |
| `surface`            | `#efe8da`             | Poll/chart track fill, image-placeholder hatch base.                                                              |
| `line`               | `#c9bfac`             | Borders and separators.                                                                                           |
| `hairline`           | `#c9bfac`             | Alias of `line`, used semantically for 1px row rules.                                                             |
| `frame`              | `#b5ab98`             | The sheet's outer border.                                                                                         |
| `ok` / `ok-deep`     | `#188038` / `#146c2e` | Success; `-deep` for small print (<12px), 5.9:1 on paper.                                                         |
| `warn` / `warn-deep` | `#b45309` / `#96450a` | Pending/amber; `-deep` for small print, 6.0:1 on paper.                                                           |
| `danger`             | `#9f1d35`             | Destructive role (same red as `brand`).                                                                           |

Focus-visible is a 2px `brand` outline, offset 2px, on every interactive element.

> **Retired tokens (deleted from `@theme`):** `#c8102e` (old brand), `#b3261e` (old danger),
> `#12141c` (old ink), navy `#0e1a2b` / `#16283f`, gold `#c9a24b`, info-blue `#1a73e8`, and the
> old neutrals `#5b616e` / `#e4e7ec`. Former info-status surfaces render as neutral ink chips.

## Type (spec §2.3)

Two families, both variable (loaded via `next/font`): **Noto Sans Georgian** and **Noto Serif
Georgian**. `lang="ka"` throughout.

- **Serif** — headlines, people's names, dates, and **all numerals** (counters, amounts,
  rankings, ledger figures). Manifesto/article ledes are serif ~1.12rem.
- **Sans** — UI labels, forms, buttons, nav, and small-caps section labels (~.7rem, weight
  700, letterspacing ~.18em).
- Base 15px, line-height 1.65. Page `h1`s are serif 2.1–2.7rem; the homepage manifesto
  headline is serif ~2.7rem with `text-wrap: balance`.
- **Minimum text-size floor: 0.74rem (~11px).** No micro-print below it.
- Justified two-column body is desktop-only; mobile is single-column, left-aligned (Georgian
  does not hyphenate — justified narrow columns produce rivers).
- The homepage manifesto keeps a serif **drop cap** in `brand` (float technique). Drop caps
  appear nowhere else.

## Interaction identity (spec §2.4)

- **Primary buttons: ink fill, paper text; hover turns `brand` red.** Red is the accent, not
  the default button color.
- Ghost buttons: transparent, 1px ink border; hover inverts to ink fill / paper text. The
  muted ghost (e.g. the abstain ballot option): muted text, hairline border, hover restores ink.
- Danger actions use the `brand`-red treatment (red border/text, or red fill for a confirmed
  destructive primary).
- Links: `brand` red, always underlined (1px, offset 3px); hover darkens to `brand-dark`.
- Button heights via the `size` prop: `lg` 46px, `md` 40px (default), `sm` 34px. Override size
  only through the prop — never padding/text classes in `className` (Tailwind order makes those
  unreliable).
- Motion: color/background transitions only — no movement animations; `prefers-reduced-motion`
  is honored.

## Accessibility floors (spec §2.5)

- Contrast (verified): ink/paper 16.1:1 · brand/paper 7.0:1 · muted-fg/paper 5.1:1 · paper/ink
  16.1:1 · paper/brand 7.0:1 — all AA.
- **muted-fg text never sits on stone** (muted-fg/stone is 4.3:1; stone only backs the sheet).
- `ok`/`warn` on paper are 4.5:1 → small print (<12px) uses `ok-deep`/`warn-deep`.
- Text floor 0.74rem; tap heights per the `size` prop; every field keeps a visible label
  (placeholder is never the only label); 2px `brand` focus ring; reduced-motion honored.

## Component register (spec §3)

Unit tests changed only where they assert visuals. Status keys, `TEAM_STATUS_LABELS`,
`DELEGACY_STATUS_LABELS` and the Pill-defaults guard test stay byte-identical.

### Re-dressed components (`components/`)

| Component (props unchanged)                                                     | Kronika visual contract                                                                                                                                                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button` / `ButtonLink` (`primary·ghost·danger·dark·ghost-inverse`; `sm·md·lg`) | §2.4 language. `dark` renders identically to `primary` (ink); `ghost-inverse` is paper-on-ink for dark surfaces (demo banner). All variant names still work — no call-site churn.                 |
| `Card` (`header`, `padded`)                                                     | Ruled paper panel; `header` renders as a small-caps label over a 2px ink rule. The call-out look (paper-bright + 1px ink border) comes from the component, not ad-hoc styling.                    |
| `StatCard` (`accent`, `sub`)                                                    | Figure block: serif number ~2.1rem, small muted label, hairline column separators; `accent` renders the figure in `brand` or `warn`. Absorbs the "figure" role (no separate FigureBlock shipped). |
| `Pill` (status colors, `label` override)                                        | Small-caps square chip. Mapping: ok→`ok`, warn→`warn`, danger/rejected→`brand`, info/profile_completed→**neutral ink**, muted→muted.                                                              |
| `Badge` (count chip)                                                            | The tiny **rounded** count dot (`brand`; `warn` for admin verification), used by nav badges. The only rounded element in the system.                                                              |
| `Field` (+ `adminControlClasses`)                                               | Underline field: small-caps label above, 1px ink bottom rule, focus = 2px `brand` rule, error = brand rule + brand small text. Admin dense variant matches. No boxed inputs.                      |
| `OtpInput`                                                                      | Six underline cells, serif digits; same behavior/testids incl. the env-gated on-screen test-code note.                                                                                            |
| `TierPicker` (5/10/20 ₾)                                                        | Classifieds-style bordered options, serif amounts; radio semantics unchanged.                                                                                                                     |
| `DelegateBinding`                                                               | Ruled radio rows: serif name, muted meta, selection in `brand`; the central-movement default row kept.                                                                                            |
| `Stepper`                                                                       | Paper-form steps: done ✓ `ok`, current `brand` underlined, upcoming muted; Roman-numeral prefixes are furniture, real labels stay shipped wording.                                                |
| `CabinetNav` / `AdminNav` / `ContentNav`                                        | Underlined section-tab rows; active tab `brand` with a 2px red underline; count badges; horizontal scroll on mobile; sign-out tab kept.                                                           |
| `DataTable` (+ pagination footer)                                               | Printed ledger: 2px rule under small-caps column heads, hairline row rules, serif dates, right-aligned serif amounts, no zebra striping; ruled centered pagination footer.                        |
| `NewsCard`                                                                      | Front-page brief: kicker, serif headline, muted dateline, hairline separation; cover (when present) as a bordered figure with caption rule.                                                       |
| `ContentBody`                                                                   | Same renderer; article typography per §2.3 (serif lede, sans body); no drop caps.                                                                                                                 |
| `LeaderRow`                                                                     | Numbered ranking row — serif rank (`brand` at №1), name, right-aligned serif figure. **No medals.**                                                                                               |
| `TransferInstructions` + `QrCode` + `CopyButton`                                | The payment slip: bordered document box, prominent serif GR-code and amounts, QR inside the slip.                                                                                                 |
| `CenteredNotice`                                                                | Ruled centered notice on paper.                                                                                                                                                                   |
| `DemoBanner`                                                                    | Same env-gating; thin ink strip, paper text.                                                                                                                                                      |

### Furniture (added in the redesign)

| Component     | Props                                                                    | Contract                                                                                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Masthead`    | `{ navItems, cta, sessionSlot?, tag? }`                                  | **Unified single-row header** (see note): horizontal Georgian lockup left; nav (active item `aria-current="page"`, `brand` red) + `cta` + `sessionSlot` right; optional `tag` is a small-caps register label after the lockup (member cabinet / admin). Double rule under (2px ink).                              |
| `PageSheet`   | `{ children, className? }`                                               | The paper sheet wrapper: `max-w-[1280px]`, `bg-paper`, `sm:border-x border-frame`, `min-h-screen flex flex-col` (footer pins to bottom). Stone shows behind on desktop; edge-to-edge on mobile.                                                                                                                   |
| `SiteFooter`  | —                                                                        | Ruled footer: © line left; right links go **only to real pages** — terms (`/join/terms`), news (`/news`), transparency (`/transparency`). No fake doors.                                                                                                                                                          |
| `SectionRule` | `{ label, action?, className? }`                                         | Small-caps section label over a 2px ink rule, optional right-side action (e.g. a "full →" link). Reach for this over `Card`'s `header` when the content is a bare label, not a form.                                                                                                                              |
| `IndexRow`    | `{ rank, name, meta, figure, figureLabel, href }`                        | Numbered directory row: serif № (`brand` at №1), serif name, muted meta, right-aligned serif figure + label; the whole row is one link.                                                                                                                                                                           |
| `Ballot`      | `ballotButtonClasses(state)` · `BallotBar({ label, pct, tone, value? })` | Ballot language: `ballotButtonClasses` = equal-width ghost answer buttons (polls/RSVP); `BallotBar` = `surface` track with `brand` fill for the leading option, `ink` for others, muted for abstain. `value?` overrides the right-slot text (defaults to `pct%`) — used for real region counts on the admin bars. |
| `PhotoFigure` | `{ src, alt, caption, width, height }`                                   | Bordered image + hairline caption row (news/event covers; the homepage photo slot).                                                                                                                                                                                                                               |
| `Eyebrow`     | `{ children }`                                                           | Red small-caps kicker — re-expresses the retired `Eyebrow`/`cardSkin` in Kronika terms with no call-site changes.                                                                                                                                                                                                 |

> **Masthead note (shipped reality):** spec §3.2 described a two-mode masthead (a full homepage
> variant with a vertical lockup, dateline, and tagline, plus a compact variant). At the owner
> look-and-feel checkpoint this was replaced by **one** single-row layout with the horizontal
> lockup for every page — no dateline, no tagline, no vertical lockup, and no separate `Dateline`
> component. This document reflects what shipped.

### Retired looks (spec §3.3)

Navy footer/surfaces; gold/silver/bronze leaderboard medals (→ numbered index, `brand`-red №1);
card shadows; blue info styling; boxed inputs. See the retired-tokens note under **Palette**.

## `/styleguide` — the living gallery

`/styleguide` renders the whole system: palette swatches (including the §2.5 contrast pairs),
the type scale, every re-dressed component, every furniture piece, and the status-chip table.
It is the first stop of any visual review. **If you add or change a component, update
`/styleguide` in the same change.**

## Georgian integrity gate (mandatory)

All user-facing strings are Georgian and are **byte-spliced from source, never hand-typed** —
models silently normalize `U+201C`/`U+201D` quotes to ASCII and can substitute Latin or Greek
homoglyphs into a Georgian word. Splice from the shipped app source or `prototype/kronika-d3/`
(and the spec's Appendix B copy inventory), then gate every touched file:

```bash
node scripts/ka-gate.mjs --diff main <files>
```

ka-gate checks for ASCII quotes adjacent to Georgian, Greek lookalikes, and balanced
`U+201E`/`U+201C` pairs. It does **not** catch a lone Latin letter fused inside a Georgian word —
so splicing (not retyping) remains the rule, and a mixed-script scan is the backstop.
