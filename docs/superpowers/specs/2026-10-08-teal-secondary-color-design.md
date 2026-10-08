# Teal secondary colour — design

**Date:** 2026-10-08
**Owner decision pass:** this conversation. The owner compared three brand directions on the
exploration board (https://claude.ai/artifact/369gKgZSdqsDeQS19u5qHv) and chose
**1 · Kronika + Teal** ("the safe, easiest one"), with one change: no tinted background panels.
The follow-up choices were a teal line plus teal heading and figures for the homepage registry box,
and a solid teal footer.

## 1. What this is

Kronika keeps everything it has: paper, rules, type, layout, the one red. It gains **one second
colour, teal `#235B59`**, with a job of its own:

- **Red acts:** links, the active menu item, the №1 rank, the focus outline, the hover on main
  buttons, danger.
- **Teal informs:** the live registry figures, the supporter chip, the non-leading poll answers,
  the "my delegate" card, secondary solid buttons, the rule under the masthead, the footer.

There are no layout, copy, behaviour, database or environment changes. Every change is a colour
treatment on an existing component, plus small additive props so the treatment lives in the
component and not at call sites (DESIGN.md: never restyle ad hoc).

## 2. Tokens

Added to `@theme` in `app/globals.css`:

| Token        | Value     | Role                                               |
| ------------ | --------- | -------------------------------------------------- |
| `teal`       | `#235B59` | The second colour. Fills, rules, figures, chips.   |
| `teal-dark`  | `#1A4644` | Hover for teal buttons.                            |

There is **no teal tint token.** The light teal panel from the exploration board is rejected
(owner, 2026-10-08). The only soft teal is the supporter chip, which uses the chip system's own
pattern (`bg-teal/10`, exactly like `bg-ok/10`, `bg-warn/10` and `bg-brand/10` on the other chips).

## 3. Changes by surface

| # | Surface | Today | After | Where |
| - | ------- | ----- | ----- | ----- |
| 1 | Masthead rule (every page) | One 2px ink rule | 2px ink rule, 2px paper gap, then a 1px teal line | `Masthead`, `MobileBackHeader`, new furniture `TealRule` |
| 2 | Homepage registry box ("რეესტრი — დღეს") | Ink section rule and label, ink figures | Teal 2px section rule, teal label, teal serif figures; no fill | `SectionRule` gains `tone`; `app/(public)/page.tsx` |
| 3 | Public footer | Paper, 2px ink top rule, muted text, ink links | Solid teal band, no top rule, paper text and links, links hover to `surface`, **paper focus outline** | `SiteFooter` |
| 4 | Supporter chip (`registered`) | `bg-surface text-muted-fg` (grey) | `bg-teal/10 text-teal` | `Pill` |
| 5 | Admin region bars | №1 brand, others ink, remainder muted | №1 brand, others **teal**, remainder muted | `BallotBar` gains `tone="teal"`; `app/(admin)/admin/page.tsx` |
| 6 | Member poll results | Every bar brand | Leading answer(s) brand, the others teal | `app/(member)/me/polls/PollCard.tsx` |
| 7 | "ჩემი დელეგატი" card on `/me/profile` | Call-out: ink border, muted label | Call-out with a **teal border** and a teal label; no fill | `Card` gains `variant="callout-teal"`; `app/(member)/me/profile/page.tsx` |
| 8 | Secondary solid buttons (`variant="dark"`) | Identical to primary (ink, red hover) | Teal fill, paper text, `teal-dark` hover | `Button` / `ButtonLink` via `buttonClasses` |

Details:

- **1, the teal line.** `TealRule` is a decorative `aria-hidden` span positioned just under the
  header's 2px bottom border: 3px tall, a 2px paper top border then 1px of teal, so the gap is
  opaque even while the mobile header is sticky. It needs a positioned parent: the Masthead's
  desktop `md:static` becomes `md:relative` (no visual change, since relative with no offsets
  renders the same), and the non-sticky case (styleguide and admin) gains `relative`.
  `MobileBackHeader` is already `sticky`. One component serves both headers, so nothing is
  copy-pasted.
- **2, the registry.** `SectionRule` gets `tone?: "ink" | "teal"` (default `ink`, so today's
  output is unchanged for every other caller). The three counters (and the collected-dues row
  while finances are public) add `text-teal` to their figure. The ranking box below keeps ink,
  with brand at №1.
- **3, the footer.** It only renders on public pages (`app/(public)/layout.tsx`). On teal, the
  global red focus outline would be invisible (red and teal are equally dark, 1.00:1), so footer
  links set `focus-visible:outline-paper` (6.94:1).
- **6, the leading answer.** Every option whose `pct` equals the highest `pct` is leading. A tie
  colours each tied option brand.
- **7, the delegate card.** The border comes from the new `Card` variant. The small label
  above the name is inline markup on the profile page today (`text-muted-fg`), so its colour
  class changes there to `text-teal`. That is the one call-site class edit in this design.
- **8, `dark`.** DESIGN.md says `dark` "renders identically to primary", so it is a spare variant.
  Its seven call sites are admin lookup/search buttons (audit, members, finances record and bulk
  match, grant role) and the delegate panel's team link. All are look-up or go-see actions, which
  is teal's job. The variant name stays (component contracts are frozen); only its look changes.

## 4. Out of scope

- Stat figures elsewhere (`StatCard` in the cabinet, delegate panel and admin): they stay as they
  are. The board showed teal figures only in the homepage registry.
- Navigation (`CabinetNav`, `AdminNav`, `MobileTabBar`, `MobileMoreSheet`): the active state stays
  red.
- The brand lockup and emblem stay red. Teal never recolours the logo.
- The ranking (`IndexRow`, `LeaderRow`), news cards, the delegate OG image, the admin header band,
  `/structure` pebbles: unchanged.
- No dark mode. The site has none today.

## 5. Accessibility

Measured (WCAG relative luminance):

| Pair | Ratio |
| ---- | ----- |
| teal text on paper | 6.94:1 |
| teal text on paper-bright | 7.62:1 |
| paper text on teal (footer, teal button) | 6.94:1 |
| paper text on teal-dark (teal button hover) | 9.40:1 |
| surface on teal (footer link hover) | 6.35:1 |
| teal on the supporter chip (`teal/10` over paper-bright / paper) | 6.54:1 / 5.99:1 |
| paper focus outline on teal (footer) | 6.94:1 |
| red focus outline on teal (why the footer overrides it) | 1.00:1 |

All text pairs pass AA, including at the 0.74rem floor. The red/teal equal-darkness also affects
**poll bars**: a red bar and a teal bar differ by hue only, which some colour-blind readers cannot
see. This is acceptable because the leading answer never relies on colour alone. It is also the
longest bar and carries its percentage, and the member's own answer is marked "✓ შენი არჩევანი".
Focus outlines on teal buttons sit 2px outside the button on paper, so they keep the red ring
(7.0:1).

## 6. Component contracts (all additive)

| Component | Change |
| --------- | ------ |
| `TealRule` (new furniture) | No props. Decorative rule under a header; the parent must be positioned. |
| `SectionRule` | `tone?: "ink" \| "teal"`, default `ink`. |
| `BallotBar` | `tone` union gains `"teal"` (`bg-teal`). `"ink"` stays supported. |
| `Card` | `variant` union gains `"callout-teal"`: `border border-teal bg-paper-bright`. |
| `Button` / `buttonClasses` | `dark` restyled to teal. Names and props unchanged. |
| `Pill` | `registered` className only. Labels byte-identical (the Pill-defaults guard test stays green). |
| `SiteFooter`, `Masthead`, `MobileBackHeader`, `PollCard` | Classes only. Props unchanged. |

## 7. Testing

TDD per component, each test red first:

- `TealRule`: renders an `aria-hidden` element with `bg-teal`, and is present in both `Masthead`
  and `MobileBackHeader` output.
- `SectionRule`: `tone="teal"` gives a teal rule and label; the default stays ink.
- `BallotBar`: `tone="teal"` fills with `bg-teal` (joins the existing tone table).
- `Card`: `variant="callout-teal"` has `border-teal`; `callout` keeps `border-ink`.
- `Button`: `dark` has `bg-teal` and `hover:bg-teal-dark`; `primary` unchanged.
- `Pill`: `registered` has `text-teal`; labels unchanged.
- `SiteFooter`: the footer has `bg-teal`; links carry `focus-visible:outline-paper`.
- `PollCard`: in results views the leading option's bar is `bg-brand` and the others `bg-teal`;
  a tie colours both brand.
- Homepage: the three counter figures carry `text-teal`.

No e2e test asserts colours (checked), so the e2e suite is unaffected.

## 8. Documentation

- `DESIGN.md`: palette rows for `teal` / `teal-dark`; the red/teal role split; the contrast floors;
  the `dark` variant; and the component-register entries for every row in §6 (plus `TealRule`
  under Furniture).
- `/styleguide`: palette swatches, the new contrast pairs, a teal `SectionRule`, a `callout-teal`
  card, the teal `BallotBar` tone, the restyled `dark` button row, and the supporter chip. Any new
  demo label is byte-spliced from existing source, never typed.
- `DECISIONS.md`: the next free ADR (expected ADR-045; recheck main before merge).
- `CHANGELOG.md`: a plain-language entry.

## 9. Release

Merging ships to both sites (demo and real), as every merge does. No migration and no new
environment variable. Verify georgia-republic.vercel.app after merge.

## 10. Georgian integrity

No new Georgian copy. Any Georgian string touched or added (styleguide demo labels) is
byte-spliced from source. `node scripts/ka-gate.mjs --diff main <files>` and `npm run ka:scan`
run on the touched files before each commit.
