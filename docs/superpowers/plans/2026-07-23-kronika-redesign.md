# Kronika (D3) Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin and recompose all 46 pages of the platform into the Kronika (D3) newspaper identity — one release (v0.9.0), zero behavior change.

**Architecture:** Two stages on one branch. Stage 1 (Tasks 1–9) rebuilds the design system in place: token swap in `app/globals.css`, every existing component re-dressed behind its frozen contract, ~7 new furniture components, `/styleguide` as the living gallery. Stage 2 (Tasks 10–20) recomposes pages group by group (public chrome → homepage → public pages → auth → member → delegate → admin) using only that system. Tasks 21–23 handle OG/PWA assets, the new 360px guard + sweeps, and docs. A hard owner checkpoint sits after Task 11.

**Tech Stack:** Next 16 (App Router, route groups), React 19, Tailwind v4 CSS-first (`@theme` in `app/globals.css`, no config file), next/font/google variable fonts, Vitest + Testing Library (co-located tests), Playwright (`workers:1`), sharp (already a dependency) for asset generation, Supabase (untouched).

**Authorities:** Spec `docs/superpowers/specs/2026-07-23-kronika-redesign-design.md` (D1–D10, palette, per-page treatments). Georgian copy splice source: `prototype/kronika-d3/kronika-d3-template.html`. Brand assets: `prototype/kronika-d3/brand/`.

## Global Constraints

Every task's requirements implicitly include all of these (from the spec):

- **Zero database changes.** No migrations, no new RPCs/views/grants. All new reads (badges, news teaser, homepage rail) use existing fetchers/views only.
- **Component contracts frozen** (D4): no prop renames/removals; furniture components are additive. Business logic, forms, validation, data access, routes, redirects, gating: byte-untouched.
- **Formatters untouched:** `formatCountKa` (NBSP grouping), `formatDateKa`, `memberSinceKa`, GR-code display.
- **No new npm dependencies.**
- **Georgian text discipline (spec §7.5):** never type Georgian quote glyphs (U+201E/U+201C/U+201D) or copy blocks by hand. Splice bytes from `prototype/kronika-d3/kronika-d3-template.html` (mock voice) or from existing app source (shipped wording), then run `node scripts/ka-gate.mjs <files...>` (created in Task 1) on every touched file containing Georgian. Reviewers verify via the gate output, not by eye. This plan document deliberately contains no quote glyphs; Georgian strings appear in backticks.
- **Closed e2e-update list** (spec §7.6). Only these e2e changes are allowed: `smoke.spec.ts:7,10` and `public.spec.ts:52-62` (header/main CTA relabel), `public.spec.ts:86-90` (medal → rank testid), `smoke.spec.ts:20-33` only if styleguide samples move (keep the `ძირითადი` button and `აქტიური` pill samples so it passes unchanged), plus the NEW `e2e/responsive.spec.ts` (Task 22). Any other e2e failure is a regression: fix the code, never the test.
- **Existing test intent preserved:** `components/design-system.test.tsx`, `ButtonLink.test.tsx` etc. get their class-string expectations updated to the new skins (shown per task) — behavioral assertions stay identical.
- **CI hygiene:** run `npm run format` before every push (prettier check fails CI otherwise). e2e runs need `.env.local` vars loaded into the shell first, `workers:1`. Do not run the full e2e suite more than twice per hour (staging OTP send-cap on the canonical admin phone).
- **Token names are stable:** existing token names (`brand`, `ink`, `muted-fg`, `surface`, `line`, `ok`, `warn`, `danger`) keep working with new values, so call sites don't churn. `navy`, `navy-dark`, `gold`, `info` stay defined (deprecated) until Task 21 removes them after their last usages are gone.
- **Commit style:** conventional prefixes as shown per task; every commit ends with the Claude co-author trailer used in this repo.

## File Structure (what exists / what's new)

```
app/globals.css                 — token swap (Task 1)
scripts/ka-gate.mjs             — NEW reusable Georgian gate (Task 1)
components/Button.tsx           — reskin (Task 2)      components/ButtonLink.tsx (Task 2)
components/Field.tsx, OtpInput.tsx                     (Task 3)
components/Pill.tsx, Badge.tsx, Card.tsx, Eyebrow.tsx,
  StatCard.tsx, DataTable.tsx, CenteredNotice.tsx      (Task 4)
public/brand/*.png              — NEW copied assets    (Task 5)
components/Masthead.tsx         — NEW (Task 5)         components/PageSheet.tsx — NEW (Task 5)
components/SiteFooter.tsx       — NEW (Task 5)         components/SectionRule.tsx — NEW (Task 5)
components/IndexRow.tsx         — NEW (Task 6)         components/Ballot.tsx — NEW (Task 6)
components/PhotoFigure.tsx      — NEW (Task 6)
components/CabinetNav.tsx, AdminNav.tsx, ContentNav.tsx (Task 7)
components/Stepper.tsx, TierPicker.tsx, DelegateBinding.tsx, NewsCard.tsx,
  ContentBody.tsx, QrCode.tsx, CopyButton.tsx, TransferInstructions.tsx,
  DemoBanner.tsx                                        (Task 8)
app/(public)/styleguide/*       — rebuild (Task 9)
app/(public)/layout.tsx         — chrome (Task 10)
app/(public)/page.tsx           — homepage (Task 11)   ← owner checkpoint after
app/(public)/{delegates,leaderboard}/*, components/{DelegateDirectory,DelegateCard,LeaderRow}.tsx (Task 12)
app/(public)/{news,events,transparency}/*              (Task 13)
app/(public)/{join,login}/*, app/offline/page.tsx      (Task 14)
app/(member)/*                  — cabinet (Task 15–16)
app/(delegate)/*                                        (Task 17)
app/(admin)/*                                           (Task 18–20)
app/(public)/delegates/[slug]/opengraph-image.tsx, scripts/generate-og-default.mjs,
  scripts/generate-icons.mjs, app/manifest.ts, app/icon.png, assets/fonts/ (Task 21)
e2e/responsive.spec.ts          — NEW guard (Task 22)
DESIGN.md, CLAUDE.md, prototype/README.md              (Task 23)
```

**Spec corrections discovered during planning (already reflected in the spec):** (1) no 360px e2e guard exists today — Task 22 creates it; (2) monthly income is admin-only (`admin_overview.mrr_gel`) — the homepage rail uses the public all-time total (`transparency_stats.total_gel`) with the transparency page's shipped wording; (3) the serif weight range needs no font-pipeline work — next/font already loads variable fonts.

---

### Task 1: Kronika tokens, global canvas, and the ka-gate script

**Files:**
- Modify: `app/globals.css` (entire file — it is 24 lines)
- Create: `scripts/ka-gate.mjs`
- Test: `components/design-system.test.tsx` (only run, no edits yet)

**Interfaces:**
- Produces: token classes used by every later task — `bg-paper`, `bg-paper-bright`, `bg-stone`, `border-frame`, `border-hairline` (alias `line` also remains), `text-prose`, `text-ok-deep`, `text-warn-deep`, plus re-valued `brand`, `brand-dark`, `ink`, `muted-fg`, `surface`, `line`, `danger`. Also `node scripts/ka-gate.mjs <file...>` exit-0/1 contract.
- Consumes: nothing.

- [ ] **Step 1: Rewrite `app/globals.css`** to exactly:

```css
@import "tailwindcss";

@theme {
  --color-brand: #9f1d35;
  --color-brand-dark: #7c1629;
  --color-ink: #1a1611;
  --color-prose: #3e362b;
  --color-muted-fg: #6e6659;
  --color-paper: #f7f2e9;
  --color-paper-bright: #fffdf8;
  --color-stone: #e5dfd2;
  --color-surface: #efe8da;
  --color-line: #c9bfac;
  --color-hairline: #c9bfac;
  --color-frame: #b5ab98;
  --color-ok: #188038;
  --color-ok-deep: #146c2e;
  --color-warn: #b45309;
  --color-warn-deep: #96450a;
  --color-danger: #9f1d35;
  /* deprecated — removed in the final sweep once all usages are gone */
  --color-navy: #0e1a2b;
  --color-navy-dark: #16283f;
  --color-gold: #c9a24b;
  --color-info: #1a73e8;
  --font-sans: var(--font-noto-sans-georgian), "Sylfaen", "Segoe UI", system-ui, sans-serif;
  --font-serif: var(--font-noto-serif-georgian), "Sylfaen", Georgia, serif;
}

body {
  @apply bg-stone text-ink font-sans antialiased;
  font-size: 15px;
  line-height: 1.65;
}

a {
  @apply text-brand underline decoration-1 underline-offset-[3px];
}
a:hover {
  @apply text-brand-dark;
}

::selection {
  background: var(--color-ink);
  color: var(--color-paper);
}

input::placeholder,
textarea::placeholder {
  color: #a79d8d;
}

:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Notes: `--color-hairline` is a readable alias of `line` (both defined so existing `border-line` call sites keep compiling). The global `a` rule makes every link red-underlined; nav/button-shaped links opt out via their own classes (`no-underline` is included in `buttonClasses` in Task 2 and the nav components in Tasks 5/7).

- [ ] **Step 2: Create `scripts/ka-gate.mjs`** (reusable Georgian-integrity gate; checks built from escapes, never literal glyphs):

```js
// Usage: node scripts/ka-gate.mjs <file> [...files]
// Fails (exit 1) on: ASCII quote adjacent to Georgian, a U+201E opener closed
// by an ASCII quote, Greek look-alike characters, unbalanced U+201E vs
// U+201C/U+201D counts. Prints per-file counts so reviewers can verify.
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("ka-gate: pass at least one file");
  process.exit(2);
}
const GEO = "\\u10A0-\\u10FF\\u1C90-\\u1CBF\\u2D00-\\u2D2F";
let failed = false;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const problems = [];
  if (new RegExp(`["][${GEO}]|[${GEO}]["]`, "u").test(text))
    problems.push("ASCII quote adjacent to Georgian");
  if (new RegExp("\\u201E[^\\u201C\\u201D]{0,120}\\u0022", "u").test(text))
    problems.push("U+201E opener closed by ASCII quote");
  if (/\p{Script=Greek}/u.test(text)) problems.push("Greek look-alike character");
  const nOpen = (text.match(new RegExp("\\u201E", "g")) || []).length;
  const nClose = (text.match(new RegExp("\\u201C|\\u201D", "g")) || []).length;
  if (nOpen !== nClose) problems.push(`unbalanced quotes open=${nOpen} close=${nClose}`);
  if (problems.length > 0) {
    failed = true;
    console.error(`FAIL ${f}: ${problems.join("; ")}`);
  } else {
    console.log(`ok ${f} (open=${nOpen} close=${nClose})`);
  }
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Verify the gate self-tests on a known-good file**

Run: `node scripts/ka-gate.mjs lib/cabinet.ts DECISIONS.md`
Expected: two `ok` lines, exit 0.

- [ ] **Step 4: Run the unit suite and build**

Run: `npm test` then `npm run build`
Expected: tests pass (no test asserts token values); build succeeds. The app now renders on stone/paper — visually broken in places until components catch up; that is expected mid-stage.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css scripts/ka-gate.mjs
git commit -m "style(tokens): Kronika palette + global canvas; add ka-gate script"
```

---

### Task 2: Button / ButtonLink

**Files:**
- Modify: `components/Button.tsx`, `components/ButtonLink.tsx`
- Test: `components/design-system.test.tsx` (Button describe), `components/ButtonLink.test.tsx`

**Interfaces:**
- Produces: `buttonClasses(variant, size, extra?)` unchanged signature; variants `primary|ghost|danger|dark|ghost-inverse` (dark renders identical to primary); sizes `sm|md|lg` = heights 34/40/46px.
- Consumes: Task 1 tokens.

- [ ] **Step 1: Update the tests first.** In `components/design-system.test.tsx` (Button describe) and `components/ButtonLink.test.tsx`, replace class expectations: primary now contains `bg-ink` and `hover:bg-brand`; `dark` also contains `bg-ink` (delete any `bg-navy` expectation, e.g. `ButtonLink.test.tsx:18`, `design-system.test.tsx:28`); `ghost-inverse` contains `text-paper` and `border-paper`; danger contains `border-brand text-brand`; no class list contains `rounded`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run components/design-system.test.tsx components/ButtonLink.test.tsx`
Expected: FAIL on class assertions.

- [ ] **Step 3: Implement.** In `components/Button.tsx` replace the class maps with:

```ts
const base =
  "inline-flex items-center justify-center font-bold no-underline transition-colors disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "border border-ink bg-ink text-paper hover:border-brand hover:bg-brand",
  dark: "border border-ink bg-ink text-paper hover:border-brand hover:bg-brand",
  ghost: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
  "ghost-inverse":
    "border border-paper bg-transparent text-paper hover:bg-paper hover:text-ink",
  danger: "border border-brand bg-transparent text-brand hover:bg-brand hover:text-paper",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-[34px] px-4 text-[0.76rem]",
  md: "h-10 px-5 text-[0.86rem]",
  lg: "h-[46px] px-8 text-[0.92rem]",
};
```

Keep `buttonClasses` composition and both components otherwise untouched (`ButtonLink` consumes the same maps).

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run components/design-system.test.tsx components/ButtonLink.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/Button.tsx components/ButtonLink.tsx components/design-system.test.tsx components/ButtonLink.test.tsx
git commit -m "style(button): ink primary, ghost inversion, one red — Kronika interaction identity"
```

---

### Task 3: Underline form fields — Field, adminControlClasses, OtpInput

**Files:**
- Modify: `components/Field.tsx` (also exports `inputClasses`, `adminControlClasses`), `components/OtpInput.tsx`
- Test: `components/design-system.test.tsx` (Field describe), `components/OtpInput.test.tsx`

**Interfaces:**
- Produces: `inputClasses`, `adminControlClasses` strings (same export names); `Field`/`OtpInput` props unchanged.
- Consumes: Task 1 tokens.

- [ ] **Step 1: Update tests.** Field test: expect the input class to contain `border-b` and `bg-transparent` and NOT contain `rounded`; label class contains `tracking-[.08em]`. OtpInput test: cells contain `font-serif` and `border-b`.

- [ ] **Step 2: Run to verify failure** — `npx vitest run components/design-system.test.tsx components/OtpInput.test.tsx` → FAIL.

- [ ] **Step 3: Implement.** In `components/Field.tsx`:

```ts
export const inputClasses =
  "block w-full h-[38px] border-0 border-b border-ink bg-transparent px-0.5 font-serif text-[1.02rem] text-ink focus:border-b-2 focus:border-brand focus-visible:outline-none aria-[invalid=true]:border-b-2 aria-[invalid=true]:border-brand";

export const adminControlClasses =
  "h-9 border-0 border-b border-ink bg-transparent px-0.5 text-[0.84rem] text-ink focus:border-b-2 focus:border-brand focus-visible:outline-none";
```

Label classes become `block text-[0.72rem] font-bold tracking-[.08em] text-muted-fg mb-1`; error text `mt-1 text-[0.74rem] text-brand`. Keep the id/error wiring exactly as-is. OtpInput cells: replace box classes with `w-10 h-11 border-0 border-b-2 border-ink bg-transparent text-center font-serif text-xl focus:border-brand focus-visible:outline-none` (error state swaps `border-ink` for `border-brand`). The env-gated test-code box keeps its logic; restyle its container to `border border-hairline bg-paper-bright px-3 py-2 text-[0.8rem]`.

- [ ] **Step 4: Run tests to verify pass** — same command → PASS. Also run `npx vitest run components/OtpVerification.test.tsx` (must still pass untouched).

- [ ] **Step 5: Commit**

```bash
git add components/Field.tsx components/OtpInput.tsx components/design-system.test.tsx components/OtpInput.test.tsx
git commit -m "style(forms): underline paper-form fields (Field, admin controls, OTP cells)"
```

---

### Task 4: Chips, panels, figures, ledgers — Pill, Badge, Card, Eyebrow, StatCard, DataTable, CenteredNotice (+ JoinForm info repoint)

**Files:**
- Modify: `components/Pill.tsx`, `components/Badge.tsx`, `components/Card.tsx` (incl. `cardSkin`), `components/Eyebrow.tsx`, `components/StatCard.tsx`, `components/DataTable.tsx` (incl. `tableThClass`, `tableRowClass`, `tableCellClass`), `components/CenteredNotice.tsx`, `app/(public)/join/JoinForm.tsx:205` (class-only)
- Test: `components/design-system.test.tsx`, `components/CenteredNotice.test.tsx`

**Interfaces:**
- Produces: same exports; `cardSkin = "border border-hairline bg-paper-bright"`; StatCard is the figure block (serif value, ruled top) — later tasks use StatCard wherever the spec says figure block.
- Consumes: Tasks 1–2.

- [ ] **Step 1: Update tests.** design-system.test: Pill `profile_completed` renders label from `TEAM_STATUS_LABELS` (unchanged assertion) but class expectation moves from `text-info` to `text-ink`; Card contains `bg-paper-bright`; StatCard value element contains `font-serif`; Badge contains `rounded-full` still (the one rounded element). Keep the Pill/TEAM_STATUS_LABELS drift guard (`design-system.test.tsx:114-127`) byte-untouched.

- [ ] **Step 2: Run to verify failure** — `npx vitest run components/design-system.test.tsx components/CenteredNotice.test.tsx` → FAIL.

- [ ] **Step 3: Implement.**

`Pill.tsx` STATUS_CONFIG classes (keys and label defaults unchanged):

```ts
draft:            "bg-surface text-muted-fg",
profile_completed:"bg-ink/5 text-ink",
active_member:    "bg-ok/10 text-ok-deep",
pending:          "bg-warn/10 text-warn-deep",
approved:         "bg-ok/10 text-ok-deep",
rejected:         "bg-brand/10 text-brand",
```

Pill base: `inline-flex items-center px-2 py-0.5 text-[0.74rem] font-bold tracking-[.06em]` (square — remove `rounded-full`).

`Badge.tsx`: `inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-brand px-1.5 text-[0.74rem] font-bold text-paper`.

`Card.tsx`: `cardSkin = "border border-hairline bg-paper-bright"`; header renders `text-[0.7rem] font-bold uppercase tracking-[.18em] text-muted-fg border-b-2 border-ink pb-2 mb-4`; padded prop semantics unchanged.

`Eyebrow.tsx`: `text-[0.7rem] font-bold uppercase tracking-[.18em] text-brand`.

`StatCard.tsx`: container `border-t-2 border-ink pt-3` (no border-radius, no shadow); label `text-[0.74rem] text-muted-fg`; value `font-serif text-[2.1rem] font-bold leading-tight` (accent `text-brand` as before); sub `text-[0.74rem] text-muted-fg mt-0.5`.

`DataTable.tsx`: `tableThClass = "pb-2 border-b-2 border-ink text-left text-[0.74rem] font-bold tracking-[.1em] text-muted-fg"`; `tableRowClass = "border-b border-hairline"`; `tableCellClass = "py-2.5 text-[0.86rem]"`. No zebra classes anywhere.

`CenteredNotice.tsx`: wrapper `mx-auto max-w-lg border-y-2 border-ink py-10 text-center`; title stays `font-serif`.

`app/(public)/join/JoinForm.tsx:205`: replace `bg-info/10 text-info` with `bg-ink/5 text-ink` (class-only; message text untouched).

- [ ] **Step 4: Run tests to verify pass** — same command → PASS. Then full `npm test` (other component tests must still pass; if any assert removed classes like `shadow-sm`, update that expectation only).

- [ ] **Step 5: Commit**

```bash
git add components/Pill.tsx components/Badge.tsx components/Card.tsx components/Eyebrow.tsx components/StatCard.tsx components/DataTable.tsx components/CenteredNotice.tsx "app/(public)/join/JoinForm.tsx" components/design-system.test.tsx components/CenteredNotice.test.tsx
git commit -m "style(system): Kronika chips, ruled panels, serif figures, ledger tables"
```

---

### Task 5: Brand assets + core furniture — PageSheet, Masthead, SectionRule, SiteFooter

**Files:**
- Create: `public/brand/lockup-vertical-geo-red.png`, `public/brand/lockup-horizontal-geo-red.png`, `public/brand/lockup-horizontal-geo-white.png`, `public/brand/emblem-roundel-red-notext.png` (copied from `prototype/kronika-d3/brand/`)
- Create: `components/PageSheet.tsx`, `components/Masthead.tsx`, `components/SectionRule.tsx`, `components/SiteFooter.tsx`
- Test: create `components/Masthead.test.tsx`, `components/SectionRule.test.tsx`

**Interfaces:**
- Produces:
  - `PageSheet({ children, className? })` — paper sheet wrapper: `mx-auto w-full max-w-[1280px] bg-paper sm:border-x sm:border-frame` (+ `min-h-screen` flex column so the footer sits at the bottom).
  - `Masthead({ navItems, dateKa, cta, sessionSlot }: { navItems: { href: string; label: string }[]; dateKa: string; cta: ReactNode; sessionSlot?: ReactNode })` — client component; `usePathname()`; renders FULL masthead when pathname === "/" (dateline row -> vertical lockup image -> tagline -> double rule -> nav row) and COMPACT otherwise (horizontal lockup left + nav + cta right over a single 2px rule). Tagline/label strings are spliced (Step 3).
  - `SectionRule({ label, action?, className? }: { label: ReactNode; action?: ReactNode; className?: string })` — `flex items-baseline justify-between border-b-2 border-ink pb-1.5` with label `text-[0.7rem] font-bold uppercase tracking-[.18em]`.
  - `SiteFooter({ links }: { links: { href: string; label: string }[] })` — `border-t-2 border-ink` cream footer, copyright left, links right.
- Consumes: Task 1 tokens; Task 2 `ButtonLink` for the CTA the caller passes in.
- Deliberate consolidations vs spec §3.2 (same visuals, fewer parts): the Dateline renders as the masthead's first row (no separate Dateline component), and the FigureBlock role is played by the re-dressed `StatCard` (Task 4) — wherever the spec says Dateline or FigureBlock, that is Masthead's dateline row and StatCard respectively.

- [ ] **Step 1: Copy the four in-app brand files**

```bash
cp prototype/kronika-d3/brand/lockup-vertical-geo-red.png prototype/kronika-d3/brand/lockup-horizontal-geo-red.png prototype/kronika-d3/brand/lockup-horizontal-geo-white.png prototype/kronika-d3/brand/emblem-roundel-red-notext.png public/brand/
```

- [ ] **Step 2: Write failing tests.** `Masthead.test.tsx`: mock `next/navigation` `usePathname` to `/` → expect an `img` with `src` containing `lockup-vertical-geo-red` and the dateline text passed as `dateKa`; mock to `/delegates` → expect `lockup-horizontal-geo-red` and NOT the vertical one. `SectionRule.test.tsx`: renders label text and the action node.

- [ ] **Step 3: Implement.** Splice the two mock strings via a one-off node snippet (never retype):

```bash
node -e "const s=require('fs').readFileSync('prototype/kronika-d3/kronika-d3-template.html','utf8');const m=(re)=>s.match(re)[0];console.log(JSON.stringify({tagline:m(/სამოქალაქო პლატფორმა[^<]*?ჩანაწერი/),city:m(/თბილისი/)}))"
```

Paste the JSON-escaped values into the component as constants. Masthead FULL structure (all inside `<header className="px-5 pt-5 text-center sm:px-10 sm:pt-7">`):

```tsx
<div className="flex justify-between border-b border-ink pb-2 text-[0.74rem] text-muted-fg">
  <span>{dateKa}</span>
  <span>{CITY}</span>
</div>
<Image src="/brand/lockup-vertical-geo-red.png" alt="ქართული რესპუბლიკა" width={269} height={218} className="mx-auto mt-5" priority />
<div className="mt-2 text-[0.74rem] uppercase tracking-[.28em] text-muted-fg">{TAGLINE}</div>
<div className="mt-3.5 h-[3px] border-y border-ink border-t-2" />
<nav className="flex items-center justify-center gap-6 border-b border-ink py-2.5 text-[0.8rem] font-semibold">
  {navItems.map((i) => (
    <Link key={i.href} href={i.href} className="no-underline text-ink hover:text-brand aria-[current=page]:text-brand" aria-current={pathname === i.href ? "page" : undefined}>
      {i.label}
    </Link>
  ))}
  {sessionSlot}
  {cta}
</nav>
```

COMPACT: one row `flex items-baseline justify-between border-b-2 border-ink px-5 pb-2.5 pt-4 sm:px-10`, horizontal lockup `width={172} height={58}`, then the same nav-link markup (smaller gap, `overflow-x-auto whitespace-nowrap` on mobile). SiteFooter: copyright string is spliced in Task 10 (it lives with chrome integration); for now accept it as a `copyright: string` prop. PageSheet per the interface above.

- [ ] **Step 4: Run tests** — `npx vitest run components/Masthead.test.tsx components/SectionRule.test.tsx` → PASS. Run `node scripts/ka-gate.mjs components/Masthead.tsx` → ok.

- [ ] **Step 5: Commit**

```bash
git add public/brand components/PageSheet.tsx components/Masthead.tsx components/SectionRule.tsx components/SiteFooter.tsx components/Masthead.test.tsx components/SectionRule.test.tsx
git commit -m "feat(furniture): masthead with brand lockups, page sheet, section rules, footer"
```

---

### Task 6: Furniture — IndexRow, Ballot, PhotoFigure

**Files:**
- Create: `components/IndexRow.tsx`, `components/Ballot.tsx`, `components/PhotoFigure.tsx`
- Test: create `components/IndexRow.test.tsx`, `components/Ballot.test.tsx`, `components/PhotoFigure.test.tsx`

**Interfaces:**
- Produces:
  - `IndexRow({ rank, name, meta, figure, figureLabel, href? })` — `rank: number`, `name: ReactNode`, `meta: ReactNode`, `figure: ReactNode`, `figureLabel?: string`, `href?: string`. Renders `flex items-baseline gap-3.5 border-b border-hairline py-3.5`; rank cell `<span data-testid={"rank-" + rank} className={"w-7 font-serif font-bold " + (rank === 1 ? "text-brand" : "text-muted-fg")}>{rank}.</span>`; name serif bold (wrapped in `Link` when href given, `no-underline hover:text-brand`); meta `block text-[0.74rem] text-muted-fg tracking-[.06em] mt-0.5`; figure right-aligned serif bold with `figureLabel` beneath in `text-[0.74rem] text-muted-fg`.
  - `Ballot` exports: `ballotButtonClasses(state: "solid" | "muted") => string` — solid: `h-10 flex-1 border border-ink bg-transparent px-3 text-left text-[0.86rem] font-semibold text-ink transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-50`; muted: same but `border-hairline text-muted-fg hover:border-ink hover:text-ink hover:bg-transparent`. Also `BallotBar({ label, pct, tone }: { label: string; pct: number; tone: "brand" | "ink" | "muted" })` — grid row `label | track | pct` where the track is `h-2 bg-surface relative` with an absolute fill `bg-brand`/`bg-ink`/`bg-muted-fg` at `width: pct%`, pct right-aligned `font-serif font-bold`.
  - `PhotoFigure({ src, alt, caption?, width, height })` — `border border-hairline` image (next/image) + caption `text-[0.74rem] text-muted-fg mt-1.5 border-b border-hairline pb-2`.
- Consumes: Task 1 tokens.

- [ ] **Step 1: Write failing tests.** IndexRow: rank 1 gets `text-brand` and testid `rank-1`; rank 2 gets `text-muted-fg`; name renders inside a link when `href` passed. Ballot: `BallotBar` fill style `width: 45%` for `pct={45}`; `ballotButtonClasses("muted")` contains `border-hairline`. PhotoFigure: renders caption when given.

- [ ] **Step 2: Run to verify failure** — `npx vitest run components/IndexRow.test.tsx components/Ballot.test.tsx components/PhotoFigure.test.tsx` → FAIL (modules missing).

- [ ] **Step 3: Implement** per the interface definitions above (complete markup was specified; no liberties on class strings or the `data-testid`).

- [ ] **Step 4: Run tests** — same command → PASS.

- [ ] **Step 5: Commit**

```bash
git add components/IndexRow.tsx components/Ballot.tsx components/PhotoFigure.tsx components/IndexRow.test.tsx components/Ballot.test.tsx components/PhotoFigure.test.tsx
git commit -m "feat(furniture): numbered index rows, ballot language, photo figure"
```

---

### Task 7: Section-tab navs — CabinetNav, AdminNav, ContentNav (+ badge slot, + stray copies)

**Files:**
- Modify: `components/CabinetNav.tsx`, `components/AdminNav.tsx`, `components/ContentNav.tsx`, `lib/cabinet.ts` (CabinetNavItem type only), `lib/admin.ts` (AdminTab type only), `app/(admin)/admin/verify/page.tsx:58-59` (inline tab classes), `app/(admin)/admin/members/ExportControls.tsx:39` (raw navy)
- Test: `components/CabinetNav.test.tsx`, `components/AdminNav.test.tsx`, `components/ContentNav.test.tsx`

**Interfaces:**
- Produces: `CabinetNavItem` gains optional `count?: number`; `AdminTab` gains optional `count?: number`. Both navs render a `Badge` with the count when `count > 0`. Tab visual: active `text-brand border-b-2 border-brand pb-1`, inactive `text-ink hover:text-brand`; row container `flex gap-5 overflow-x-auto whitespace-nowrap border-b border-hairline text-[0.78rem] font-semibold` beneath a `border-b-2 border-ink` brand row. `გასვლა` button unchanged in behavior.
- Consumes: Tasks 1–2, Badge from Task 4.

- [ ] **Step 1: Update/extend tests first.** CabinetNav test: item with `count: 3` renders text `3` inside the nav link; active item has `border-brand`; no `bg-brand/10` classes remain. AdminNav test: same badge behavior; `გასვლა` still present. ContentNav: active styling assertions updated.

- [ ] **Step 2: Run to verify failure** — `npx vitest run components/CabinetNav.test.tsx components/AdminNav.test.tsx components/ContentNav.test.tsx` → FAIL.

- [ ] **Step 3: Implement.** Add `count?: number` to `CabinetNavItem` (`lib/cabinet.ts`) and `AdminTab` (`lib/admin.ts`) — additive, no call-site churn. Restyle all three navs to the shared visual above (each keeps its own file; copy the class strings verbatim into each — do not create a new abstraction). Render `{item.count ? <Badge>{item.count}</Badge> : null}` inside the link with `inline-flex items-center gap-1.5`. Replace the two stray copies: `verify/page.tsx:58-59` sub-tab links get the same active/inactive classes; `ExportControls.tsx:39` drops `bg-navy … hover:bg-navy-dark` in favor of `buttonClasses("dark", "sm")` (import from `components/Button`).

- [ ] **Step 4: Run tests** — component tests PASS; then `npm test` fully green.

- [ ] **Step 5: Commit**

```bash
git add components/CabinetNav.tsx components/AdminNav.tsx components/ContentNav.tsx lib/cabinet.ts lib/admin.ts "app/(admin)/admin/verify/page.tsx" "app/(admin)/admin/members/ExportControls.tsx" components/CabinetNav.test.tsx components/AdminNav.test.tsx components/ContentNav.test.tsx
git commit -m "style(nav): underlined section tabs with count badges; fold stray tab/navy copies in"
```

---

### Task 8: Remaining component reskins — Stepper, TierPicker, DelegateBinding, NewsCard, ContentBody, payment slip, DemoBanner

**Files:**
- Modify: `components/Stepper.tsx`, `components/TierPicker.tsx`, `components/DelegateBinding.tsx`, `components/NewsCard.tsx`, `components/ContentBody.tsx`, `components/QrCode.tsx`, `components/CopyButton.tsx`, `components/TransferInstructions.tsx`, `components/DemoBanner.tsx`
- Test: `components/TierPicker.test.tsx`, `components/DelegateBinding.test.tsx`, `components/NewsCard.test.tsx`, `components/ContentBody.test.tsx`, `components/DemoBanner.test.tsx` (update class expectations only where they assert old skins)

**Interfaces:**
- Produces: all props unchanged. Visual contracts: Stepper steps render `done` in `text-ok`, `current` in `text-brand font-bold border-b-2 border-brand pb-0.5`, `upcoming` in `text-muted-fg`, prefixed with Roman numerals `I.` `II.` `III.` by position (furniture only — the label strings passed in stay whatever callers pass). TierPicker options: `border border-hairline bg-paper-bright p-4` with the amount in `font-serif font-bold`; selected option `border-ink`. DelegateBinding rows: `flex items-baseline gap-3 border-b border-hairline py-3` with serif names. NewsCard: `border-b border-hairline pb-4` brief — kicker (`Eyebrow`), serif headline, muted dateline; image (when `imageUrl`) via `PhotoFigure`. TransferInstructions: wrapper `border border-ink bg-paper-bright p-5`, GR-code `font-serif text-xl font-bold tracking-wider`, amount serif; QR inside. DemoBanner: `border-b border-ink bg-ink px-4 py-1.5 text-center text-[0.76rem] text-paper` (drop `bg-gold/15`), same gating and text.
- Consumes: Tasks 1–6.

- [ ] **Step 1: Update the listed tests' class expectations** to the contracts above (behavioral assertions — option counts, callbacks, gating — untouched).

- [ ] **Step 2: Run to verify failures** — `npx vitest run components/TierPicker.test.tsx components/DelegateBinding.test.tsx components/NewsCard.test.tsx components/ContentBody.test.tsx components/DemoBanner.test.tsx` → FAIL.

- [ ] **Step 3: Implement** all nine components per the visual contracts. ContentBody: paragraph classes `text-[0.92rem] leading-[1.75]`, links inherit the global red-underline rule; no other change to `parseBody` handling.

- [ ] **Step 4: Run tests** — same command → PASS; full `npm test` green; `node scripts/ka-gate.mjs components/DemoBanner.tsx components/TransferInstructions.tsx` → ok.

- [ ] **Step 5: Commit**

```bash
git add components/Stepper.tsx components/TierPicker.tsx components/DelegateBinding.tsx components/NewsCard.tsx components/ContentBody.tsx components/QrCode.tsx components/CopyButton.tsx components/TransferInstructions.tsx components/DemoBanner.tsx components/TierPicker.test.tsx components/DelegateBinding.test.tsx components/NewsCard.test.tsx components/ContentBody.test.tsx components/DemoBanner.test.tsx
git commit -m "style(components): paper-form steps, classifieds tiers, briefs, payment slip, ink banner"
```

---

### Task 9: /styleguide rebuild

**Files:**
- Modify: `app/(public)/styleguide/page.tsx`, `app/(public)/styleguide/samples.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces: the gallery the owner reviews at the checkpoint. MUST keep: a primary Button labeled `ძირითადი`, and the Pill statuses card titled `სტატუსები` containing the default `active_member` pill (renders `აქტიური`) — `e2e/smoke.spec.ts:20-33` depends on both.

- [ ] **Step 1: Rebuild the page** with sections in this order: (1) palette swatches — one row per token from spec §2.2 with name, hex, and the §2.5 contrast pairs listed beneath; (2) type scale (serif display/h1/lede + sans labels incl. the small-caps register); (3) buttons (all 5 variants × 3 sizes; ghost-inverse demoed on a `bg-ink` box, replacing the old `bg-navy` box at line 48); (4) `სტატუსები` Pill card (unchanged sample set); (5) StatCard figures; (6) Badge; (7) Card with header; (8) Eyebrow; (9) Field + adminControlClasses input; (10) Stepper; (11) OtpInput sample; (12) TierPicker sample; (13) DelegateBinding samples; (14) NEW furniture: Masthead (compact, static props), SectionRule, IndexRow (3 rows), Ballot (BallotBar trio + buttons), PhotoFigure (use `/brand/emblem-roundel-red-notext.png` as the demo image), TransferInstructions sample, DataTable sample; (15) NewsCard/ContentBody/ContentNav. Wrap the page in `PageSheet`.

- [ ] **Step 2: Verify** — `npm run build` succeeds; `npm test` green; run e2e smoke only (env loaded): `npx playwright test e2e/smoke.spec.ts` → styleguide test passes.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/styleguide/page.tsx" "app/(public)/styleguide/samples.tsx"
git commit -m "feat(styleguide): full Kronika gallery — palette, type, components, furniture"
```

---

### Task 10: Public chrome — layout, nav labels, CTA, footer

**Files:**
- Modify: `app/(public)/layout.tsx` (whole chrome), `components/HeaderSessionAction.tsx` (visual classes only)
- Test: e2e `e2e/smoke.spec.ts:7,10`, `e2e/public.spec.ts:52-62` (the two allowed CTA updates)

**Interfaces:**
- Consumes: `Masthead`, `PageSheet`, `SiteFooter`, `ButtonLink`, `DemoBanner`, `formatDateKa` (`lib/cabinet.ts:152`).
- Produces: the public chrome every (public) page renders inside. Nav array labels: keep `მთავარი`, `დელეგატები`, `რეიტინგი`, `სიახლეები`, `ღონისძიებები`; change the `/transparency` label to the spliced `ფინანსები`; CTA label becomes the spliced `შემოგვიერთდი` (still `/join`, still `ButtonLink size="sm"`). Footer links: `/join/terms` label `წესები` (splice), `/news` label `სიახლეები` (copy from the nav array), `/transparency` label `ფინანსები` (same constant as nav).

- [ ] **Step 1: Update the two e2e specs first** (this is the closed list). `smoke.spec.ts:7` main-CTA assertion will be finalized in Task 11 (homepage) — in THIS task change only `smoke.spec.ts:10` banner assertion to `getByRole("banner").getByRole("link", { name: "შემოგვიერთდი", exact: true })`. In `public.spec.ts:52-62` update the header-CTA related lines the same way; leave the `შემოგვიერთდი ერთ წუთში` heading assertions untouched (the `/join` h1 does not change).

- [ ] **Step 2: Implement the chrome.** Splice labels:

```bash
node -e "const s=require('fs').readFileSync('prototype/kronika-d3/kronika-d3-template.html','utf8');console.log(JSON.stringify({fin:s.match(/ფინანსები/)[0],cta:s.match(/შემოგვიერთდი/)[0],terms:s.match(/წესები/)[0],copyright:s.match(/© 2026 ქართული რესპუბლიკა[^<]*?ჩანაწერი/)[0]}))"
```

Rewrite `app/(public)/layout.tsx`: body renders `DemoBanner` (above the sheet), then `PageSheet` containing `Masthead` (props: the nav array, `dateKa={formatDateKa(new Date().toISOString())}`, `cta={<ButtonLink href="/join" size="sm">…spliced CTA…</ButtonLink>}`, `sessionSlot={<HeaderSessionAction />}`), then `{children}`, then `SiteFooter` (spliced copyright + the three footer links). Delete the old header (emoji emblem, old nav markup) and the old `bg-navy` footer entirely. `HeaderSessionAction`: keep logic; the signed-in `კაბინეტი` link renders `variant="ghost" size="sm"` as today (classes update via Task 2 automatically — verify only).

- [ ] **Step 3: Verify** — `npm run build`; `npm test`; ka-gate the layout: `node scripts/ka-gate.mjs "app/(public)/layout.tsx"`; run `npx playwright test e2e/smoke.spec.ts` — the banner CTA test passes; the main-CTA test (line 7) is EXPECTED to fail until Task 11 lands (note this in the task handoff; do not adjust it here).

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/layout.tsx" components/HeaderSessionAction.tsx e2e/smoke.spec.ts e2e/public.spec.ts
git commit -m "feat(chrome): Kronika masthead chrome, financial nav label, join-us CTA, ruled footer"
```

---

### Task 11: Homepage — the front page

**Files:**
- Modify: `app/(public)/page.tsx` (full recompose), `e2e/smoke.spec.ts:7`, `e2e/public.spec.ts:55` (main CTA)
- Test: e2e `smoke.spec.ts`, `public.spec.ts` homepage tests

**Interfaces:**
- Consumes: `SectionRule`, `StatCard`, `IndexRow`, `CountUp`, `Eyebrow`, `ButtonLink`, `Card`, fetchers `fetchPublicStats` + `fetchPublicDelegates` + `fetchTransparencyStats` + `fetchPublicNews` (`lib/supabase/public.ts`), `rankDelegates` (`lib/ranking.ts`), `formatCountKa`.
- Produces: the S1 front page. Keeps `revalidate = 60` and the three stat testids `stat-registered-total`, `stat-active-members`, `stat-approved-delegates`.

- [ ] **Step 1: Splice the manifesto block** (all six strings in one go — headline, lede, column 1 tail, column 2, continue-link, plus the correction clause). Column 2 MUST have the mock's fixed-price clause replaced by the owner-approved corrected clause; build it from escapes exactly as the spec does:

```bash
node -e "
const s=require('fs').readFileSync('prototype/kronika-d3/kronika-d3-template.html','utf8');
const m=(re)=>s.match(re)[0];
const EMD=String.fromCodePoint(0x2014), LARI=String.fromCodePoint(0x20BE);
const p2=m(/დელეგატები ლაგდებიან[^<]*?მტკიცდება\./).replace(m(/წევრობა ფიქსირებულია[^<]*?თვეში/), 'წევრობის შენატანი არჩევითია '+EMD+' 5, 10 ან 20'+LARI+' თვეში');
console.log(JSON.stringify({kicker:m(/მანიფესტი/),h:m(/ავაშენოთ[^<]*?ერთად/),lede:m(/გამჭვირვალე სამოქალაქო მოძრაობა[^<]*?შენს ხელში\./),p1:'რ'+m(/ესპუბლიკა არ შენდება[^<]*?არჩევით\./).slice(1),p2,cont:m(/გააგრძელე კითხვა[^<]*/).trim(),byline1:m(/მოძრაობის რედაქცია/),byline2:m(/3 წუთი კითხვა/),reg:m(/რეესტრი[^<]{0,3}დღეს/),src:m(/წყარო: საჯარო დავთარი/),top:m(/რეიტინგი[^<]{0,3}ხუთეული/),full:m(/სრულად[^<]*/).trim(),strip:m(/როგორ შემოგვიერთდები/)}))
"
```

(`p1` recomposes the drop-cap letter; keep the printed first letter `რ` as the drop cap span below.)

- [ ] **Step 2: Recompose the page.** Delete the navy hero, gradient bar, features array and the old CTA block. New structure inside the existing default export (data: `const [stats, delegates, tStats, news] = await Promise.all([fetchPublicStats(), fetchPublicDelegates(), fetchTransparencyStats(), fetchPublicNews()])`; `const ranked = rankDelegates(delegates)`):

```tsx
<div className="grid gap-0 px-5 pb-12 pt-8 sm:px-10 lg:grid-cols-[1fr_348px]">
  <div className="lg:border-r lg:border-hairline lg:pr-8">
    <Eyebrow>{KICKER}</Eyebrow>
    <h1 className="mt-2.5 font-serif text-[2rem] font-bold leading-[1.16] [text-wrap:balance] sm:text-[2.7rem]">{HEADLINE}</h1>
    <p className="mt-3.5 font-serif text-[1.12rem] leading-[1.6] text-prose">{LEDE}</p>
    <div className="mt-4 flex gap-3.5 border-y border-hairline py-2 text-[0.74rem] text-muted-fg">
      <span>{BYLINE1}</span><span>·</span><span>{BYLINE2}</span>
    </div>
    <div className="mt-4 grid gap-7 sm:grid-cols-2">
      <p className="text-[0.92rem] leading-[1.75] sm:text-justify">
        <span className="float-left pr-2.5 pt-1 font-serif text-[3.4rem] font-bold leading-[0.78] text-brand">{P1.slice(0, 1)}</span>
        {P1.slice(1)}
      </p>
      <p className="text-[0.92rem] leading-[1.75] sm:text-justify">{P2} <Link href="#join-strip">{CONT}</Link></p>
    </div>
    <div id="join-strip" className="mt-6">
      <SectionRule label={STRIP} />
      <div className="grid sm:grid-cols-3">{/* three ladder columns, below */}</div>
    </div>
  </div>
  <aside className="mt-8 flex flex-col gap-6 lg:mt-0 lg:pl-7">{/* rail, below */}</aside>
</div>
```

Ladder columns (fresh copy from shipped vocabulary — run ka-gate after): each `className="border-b border-hairline py-4 sm:border-b-0 sm:border-r sm:py-0 sm:pr-4 last:border-0 sm:pl-4 first:pl-0"`; column content = serif bold title, muted description, link:
1. title `რეგისტრირებული`, desc `სწრაფი რეგისტრაცია, გადახდის გარეშე.`, link `<Link href="/join">რეგისტრაცია →</Link>`
2. title `წევრი` + `<span className="text-[0.7rem] font-bold text-brand">5/10/20₾ თვეში</span>`, desc `სრული წევრობა და შიდა გამოკითხვები — კაბინეტიდან.`, link `<Link href="/join">დაიწყე რეგისტრაციით →</Link>`
3. title `დელეგატი`, desc `წევრებისთვის, დადასტურებით.`, link `<Link href="/join/terms">გაეცანი წესებს →</Link>`

Rail (three blocks): (a) `SectionRule label={REG}` + four rows — the three counters as `flex justify-between border-b border-hairline py-2.5` rows with `CountUp` values in `font-serif text-xl font-bold` keeping the exact `data-testid` attributes (`stat-approved-delegates`, `stat-active-members`, `stat-registered-total`), plus a fourth row with `tStats.total_gel` formatted `formatCountKa(tStats.total_gel) + "₾"` and the transparency page's shipped label for it (splice from `app/(public)/transparency/page.tsx` — the heading currently at its line ~41, `შეგროვებული საწევრო შენატანები`); then the source line `text-[0.74rem] text-muted-fg` = spliced `SRC` + ` · ` + `<Link href="/transparency">…ფინანსები…</Link>`; (b) `SectionRule label={TOP} action={<Link href="/leaderboard">{FULL}</Link>}` + `ranked.slice(0,5)` as `IndexRow` (figure = supporter count, figureLabel from the delegates page shipped vocabulary `მხარდამჭერი`); (c) news box `border border-ink bg-paper-bright p-5`: `Eyebrow` label spliced `სიახლეები`-equivalent — use the nav label constant — then up to 3 `news.slice(0,3)` items (serif title link + muted `formatDateKa(published_at)`), `Link href="/news"` at the bottom.

- [ ] **Step 3: Update the two remaining e2e lines.** `smoke.spec.ts:7` → `getByRole("main").getByRole("link", { name: "რეგისტრაცია", exact: true })`; `public.spec.ts:55` → the same locator (the comment above it explains the ladder column). Keep the three stat-testid assertions untouched — they must pass as-is.

- [ ] **Step 4: Verify** — `npm run build`; `npm test`; ka-gate: `node scripts/ka-gate.mjs "app/(public)/page.tsx"`; e2e (env loaded): `npx playwright test e2e/smoke.spec.ts e2e/public.spec.ts` → all green except `public.spec.ts:86-90` (the medal test still expects medals — that update belongs to Task 12; note it in the handoff).

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/page.tsx" e2e/smoke.spec.ts e2e/public.spec.ts
git commit -m "feat(homepage): the Kronika front page — manifesto, ladder, registry rail, news box"
```

---

## ⛔ OWNER CHECKPOINT (hard pause — do not proceed to Task 12)

After Task 11 is merged into the branch: push, wait for the Vercel preview, and deliver to the owner: the preview URL + screenshots of `/styleguide` (desktop) and `/` (desktop 1280 + mobile 390) in plain language. **Stop and wait for the owner's explicit go.** Direction changes here are cheap; the remaining ~35 pages ride on this approval. (Process memory: never auto-resume past an owner checkpoint.)

---

### Task 12: Delegates index, delegate profile, leaderboard

**Files:**
- Modify: `app/(public)/delegates/page.tsx`, `components/DelegateDirectory.tsx`, `components/DelegateCard.tsx`, `app/(public)/delegates/[slug]/page.tsx`, `app/(public)/leaderboard/page.tsx`, `components/LeaderRow.tsx`, `lib/ranking.ts` (delete `medalFor`), `lib/ranking.test.ts` (delete its describe), `e2e/public.spec.ts:86-90`
- Test: `components/LeaderRow.test.tsx`, `components/DelegateDirectory.test.tsx`, `components/DelegateCard.test.tsx`

**Interfaces:**
- Consumes: `IndexRow`, `SectionRule`, `StatCard`, `Eyebrow`, splice keys `delegatesKicker` (`საჯარო რეესტრი` without the volume flourish), `delegatesH1` (`ჩვენი დელეგატები`).
- Produces: `LeaderRow` keeps its props (`{ delegate: RankedDelegate }`) but renders an `IndexRow` internally (rank testids come free). `medalFor` is deleted (only consumer was LeaderRow; spec §3.3 retires medals).

- [ ] **Step 1: Update tests first.** `LeaderRow.test.tsx`: rank 1 renders `1.` with `text-brand` and NO gold-gradient classes, no 🥇 emoji anywhere; delete `lib/ranking.test.ts` medalFor cases. `e2e/public.spec.ts:86-90`: rename the test to a rank-numbering description; replace the 🥇 assertion with `await expect(rows.first().getByTestId("rank-1")).toBeVisible()` and add `await expect(page.getByText("🥇")).toHaveCount(0)`.

- [ ] **Step 2: Run to verify failure** — `npx vitest run components/LeaderRow.test.tsx lib/ranking.test.ts` → FAIL.

- [ ] **Step 3: Implement.** Delegates index page: header block per spec §4.2 — centered `Eyebrow` kicker (spliced), serif h1 (spliced), sub-line from real counts (`formatCountKa`), then `DelegateDirectory` restyled: search + region select swap to `inputClasses`/underline select (visual only; GET-form semantics untouched); results render as `IndexRow`s in `lg:columns-2`-style two-column layout (`grid lg:grid-cols-2 lg:gap-x-16`, left column `lg:border-r lg:border-hairline lg:pr-8`); the shown/total line becomes a `border-t-2 border-ink` centered footer line. Delegate profile: compact masthead comes from chrome; page gets `Eyebrow` (region · status kicker via existing data), serif name h1, `StatCard` for supporters, existing share/join blocks re-dressed with `Card`. Leaderboard: `LeaderRow` → `IndexRow` internals; delete `medalFor` import and the `rankBox` gradient map; page title/h1 dress only.

- [ ] **Step 4: Verify** — `npm test` green; `npm run build`; e2e: `npx playwright test e2e/public.spec.ts` → green incl. the reworked rank test; ka-gate touched pages.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/delegates" "app/(public)/leaderboard" components/DelegateDirectory.tsx components/DelegateCard.tsx components/LeaderRow.tsx lib/ranking.ts lib/ranking.test.ts components/LeaderRow.test.tsx components/DelegateDirectory.test.tsx components/DelegateCard.test.tsx e2e/public.spec.ts
git commit -m "feat(registry): printed delegate index + profile piece; leaderboard drops medals for ranks"
```

---

### Task 13: News, events, transparency

**Files:**
- Modify: `app/(public)/news/page.tsx`, `app/(public)/news/[slug]/page.tsx`, `app/(public)/events/page.tsx`, `app/(public)/events/[slug]/page.tsx`, `app/(public)/transparency/page.tsx`
- Test: existing e2e `community-news.spec.ts`, `community-events.spec.ts` (must pass unchanged)

**Interfaces:**
- Consumes: `NewsCard`, `PhotoFigure`, `ContentBody`, `SectionRule`, `StatCard`, `Ballot` (RSVP dress), `DataTable`.
- Produces: nothing new — page dress only.

- [ ] **Step 1: Implement.** News list: `NewsCard` rows under a `SectionRule` (h1 serif). Article: `Eyebrow` kicker + serif headline + `border-b border-ink` dateline row + `PhotoFigure` cover when `image_url` + `ContentBody`. Events list/detail: same language; the RSVP block's buttons adopt `ballotButtonClasses` (server-action forms untouched — className only); cancelled-event notice via `CenteredNotice`. Transparency: h1 + figures as `StatCard` row (`grid sm:grid-cols-3 gap-x-8`), region table as `DataTable` ledger, headings via `SectionRule`. Page h1s and all figure labels keep shipped wording byte-for-byte (they are already in these files — do not retype; edit around them).

- [ ] **Step 2: Verify** — `npm run build`; `npm test`; e2e: `npx playwright test e2e/community-news.spec.ts e2e/community-events.spec.ts` → green UNCHANGED (any failure = regression in this task). ka-gate all five files.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/news" "app/(public)/events" "app/(public)/transparency/page.tsx"
git commit -m "style(public): briefs, article dress, ballot RSVP, transparency ledger"
```

---

### Task 14: Join, login, terms, offline

**Files:**
- Modify: `app/(public)/join/page.tsx`, `app/(public)/join/JoinForm.tsx` (visual classes only), `app/(public)/login/page.tsx` (+ its form component file), `app/(public)/join/terms/page.tsx`, `app/offline/page.tsx`
- Test: e2e `registration.spec.ts`, `login.spec.ts` (must pass unchanged)

**Interfaces:**
- Consumes: `Field`/`inputClasses`, `OtpInput`, `Card` (form sheet: add `shadow-[0_1px_0_var(--color-hairline)]` on the join/login form container — the single permitted shadow), `Eyebrow`, `CenteredNotice`, `DelegateTerms`.
- Produces: nothing new.

- [ ] **Step 1: Implement.** Join: `Eyebrow` kicker = spliced `წევრის რეგისტრაცია`; h1 stays the shipped `შემოგვიერთდი ერთ წუთში` byte-untouched (three e2e specs assert it); form sits in a `bg-paper-bright border border-hairline p-8 sm:p-10` sheet with the permitted printed-edge shadow; field-group headings restyled `font-serif font-bold border-b-2 border-ink pb-2` (keep their shipped wording). No draft/autosave line exists — do not add one. Login: same sheet dress; all flows untouched. Terms: `DelegateTerms` wrapped in a ruled document frame (`border-y-2 border-ink py-8`). Offline: `CenteredNotice` (already re-dressed) — verify only.

- [ ] **Step 2: Verify** — `npm run build`; `npm test`; e2e: `npx playwright test e2e/registration.spec.ts e2e/login.spec.ts` → green unchanged; ka-gate touched files.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/join" "app/(public)/login" app/offline/page.tsx
git commit -m "style(auth): paper-form registration and login, ruled terms document"
```

---

### Task 15: Member cabinet — layout, profile, delegate, delegacy, feeds, billing

**Files:**
- Modify: `app/(member)/layout.tsx` (PageSheet + compact masthead + polls badge count), `app/(member)/me/page.tsx`, `app/(member)/me/profile/page.tsx`, `app/(member)/me/delegate/page.tsx`, `app/(member)/me/delegacy/page.tsx`, `app/(member)/me/news/page.tsx`, `app/(member)/me/news/[slug]/page.tsx`, `app/(member)/me/events/page.tsx`, `app/(member)/me/polls/page.tsx`, `app/(member)/me/billing/page.tsx`
- Test: e2e `cabinet.spec.ts`, `community-polls.spec.ts`, `delegacy.spec.ts` (must pass unchanged)

**Interfaces:**
- Consumes: `Masthead` (compact — the member layout renders its own compact brand rule: horizontal lockup + the register tag; reuse the compact markup via a `tag` prop added now: `Masthead` gains optional `tag?: string` rendered after the lockup in `text-[0.72rem] font-semibold tracking-[.14em] text-brand`), `CabinetNav` with `count`, `SectionRule`, `StatCard`, `Card`, `Ballot`, `DataTable`, `TransferInstructions`, `Pill`.
- Produces: `Masthead` `tag` prop (additive) — Task 17/18 reuse it.

- [ ] **Step 1: Add the `tag` prop to Masthead** (+ one test case in `Masthead.test.tsx`: tag text renders in compact mode). Run the test — fails, implement, passes.

- [ ] **Step 2: Wire the polls badge.** In `app/(member)/layout.tsx`, alongside the existing `getCabinetState` call, count open polls with the exact open-determination `/me/polls` already uses: replicate its `member_polls` select (`app/(member)/me/polls/page.tsx:14-19`) limited to the fields the open/closed split needs, apply the same split helper from `lib/community` (`pollView`/close logic), and pass `count` on the `გამოკითხვები` nav item via `cabinetNavItems(...)` result mapping (do NOT change `cabinetNavItems` itself — map the returned array in the layout: `items.map(i => i.href === "/me/polls" ? { ...i, count: openCount || undefined } : i)`). Members/delegates only (the registered fallback nav has no polls tab — mapping is a no-op there).

- [ ] **Step 3: Re-dress the pages.** Layout: `PageSheet` + compact masthead (`tag` = the register wording spliced from the mock: `პირადი კაბინეტი`) + `CabinetNav`. Profile: serif name h1 + status line (existing standing Pill, GR-code, `memberSinceKa` — all shipped values); personal data as ruled rows (`flex justify-between border-b border-hairline py-2.5`, values `font-serif`); right rail: my-delegate `Card` (rank via existing data the page already loads — do not add new delegate fetches) + poll teaser `Card` (`Eyebrow` = spliced `დღის კითხვა`) on `/me/profile` per spec §5.1: extract the open-poll determination into a small pure helper in `lib/community` (reusing `pollView`'s close logic), call it from both the layout badge (Step 2) and a minimal `member_polls` fetch in the profile page; render the teaser ONLY when an open poll exists — question title + `ballotButtonClasses`-styled link row pointing to `/me/polls` (no voting on the profile page). Delegate/delegacy/news/events/polls/billing: dress with the system (ledger `DataTable` for billing + year-total row summed from the rows the page already renders + `TransferInstructions` slip; ballots on polls page via `ballotButtonClasses` + `BallotBar` for results — vote forms untouched).

- [ ] **Step 4: Verify** — `npm run build`; `npm test`; e2e: `npx playwright test e2e/cabinet.spec.ts e2e/community-polls.spec.ts e2e/delegacy.spec.ts` → green unchanged; ka-gate touched files.

- [ ] **Step 5: Commit**

```bash
git add "app/(member)" components/Masthead.tsx components/Masthead.test.tsx
git commit -m "feat(cabinet): personal-ledger dress, open-polls badge, poll teaser on the landing"
```

---

### Task 16: Membership wizard + done certificate

**Files:**
- Modify: `app/(member)/me/membership/page.tsx` (+ wizard component files it imports), `app/(member)/me/membership/done/page.tsx`
- Test: e2e `membership.spec.ts` (must pass unchanged)

**Interfaces:**
- Consumes: `Stepper` (Roman numerals arrive free from Task 8), `TierPicker`, `Field`, `Card` form sheet, `CenteredNotice`.
- Produces: nothing new.

- [ ] **Step 1: Implement.** Wizard steps in the paper-form sheet (same dress as join, Task 14); section headings serif over 2px rules; tier step uses the re-dressed `TierPicker`. Done page: `CenteredNotice`-based certificate — GR-code in `font-serif text-3xl font-bold tracking-[.08em]`, standing pill, ruled frame. All wording, steps, actions byte-untouched.

- [ ] **Step 2: Verify** — `npm run build`; `npm test`; e2e: `npx playwright test e2e/membership.spec.ts` → green unchanged; ka-gate touched files.

- [ ] **Step 3: Commit**

```bash
git add "app/(member)/me/membership"
git commit -m "style(wizard): paper-form membership steps and GR-code certificate"
```

---

### Task 17: Delegate panel + team

**Files:**
- Modify: `app/(delegate)/layout.tsx`, `app/(delegate)/delegate/page.tsx`, `app/(delegate)/delegate/team/page.tsx`
- Test: e2e `delegate-panel.spec.ts` (must pass unchanged)

**Interfaces:**
- Consumes: `PageSheet`, `Masthead` (`tag` = the shipped panel wording — splice `დელეგატის კაბინეტი` from `app/(delegate)/delegate/page.tsx:68`, NOT from the mock), `StatCard`, `Card`, `QrCode`, `CopyButton`, `DataTable`, `Pill`.
- Produces: nothing new.

- [ ] **Step 1: Implement.** Layout: `PageSheet` + compact masthead with the panel tag + `CabinetNav`. Dashboard: greeting h1 serif; stats (`activeCount`, `totalCount`, `registeredCount`) as a ruled `StatCard` row; referral link + QR as the clipping `Card` (`border border-ink bg-paper-bright`) with `CopyButton`. Team: filters via `adminControlClasses` visuals, table via `DataTable` ledger (chips/filter semantics untouched).

- [ ] **Step 2: Verify** — `npm run build`; `npm test`; e2e: `npx playwright test e2e/delegate-panel.spec.ts` → green unchanged; ka-gate touched files.

- [ ] **Step 3: Commit**

```bash
git add "app/(delegate)"
git commit -m "style(delegate): the desk — figures, clipping card, team ledger"
```

---

### Task 18: Admin chrome + overview + verify (+ badge)

**Files:**
- Modify: `app/(admin)/layout.tsx`, `app/(admin)/admin/page.tsx`, `app/(admin)/admin/verify/page.tsx`, `app/(admin)/admin/verify/[id]/page.tsx` (+ `VerifyCard` component file)
- Test: e2e `admin-rbac.spec.ts`, `admin-approval.spec.ts` (must pass unchanged)

**Interfaces:**
- Consumes: `PageSheet`, `Masthead` (`tag` = `ადმინისტრირება` — reuse the constant already rendered by `AdminNav`/`lib/admin.ts` vocabulary; splice from app source), `AdminNav` with `count`, `StatCard`, `SectionRule`, `Card`, `DataTable`, `BallotBar` (region bars), `Pill`.
- Produces: admin badge pattern for Tasks 19–20.

- [ ] **Step 1: Wire the verification badge.** In `app/(admin)/layout.tsx`: fetch `admin_overview` selecting only `pending_delegates` (same client/gating the overview page uses — the view self-gates by role); map the `adminTabs(roles)` result: `tabs.map(t => t.href === "/admin/verify" ? { ...t, count: pending || undefined } : t)`. Badge color: `AdminNav` renders its Badge with an amber override for the verify tab — add optional `tone?: "brand" | "warn"` to Badge (additive prop, default `brand`; warn = `bg-warn text-paper`) with a one-case test in `design-system.test.tsx`.
- [ ] **Step 2: Overview recompose.** Header row: serif h1 (shipped `დღის მიმოხილვა`-equivalent wording already on the page — keep byte-exact) + the real signed-in admin context line the page already renders. KPI row: existing figures as `StatCard`s in a `grid grid-cols-2 lg:grid-cols-4 border-t-2 border-ink` (queue figure `accent` + amber via existing accent semantics — if `accent` only supports `brand`, render the queue value with `className="text-warn"` on the sub, not a prop change). Region distribution: keep the page's existing `admin_region_stats` fetch; render the top-5 rows it already uses as `BallotBar` rows (tone `brand` for the largest, `ink` for the rest); if that fetch returns more rows than the five shown, add one remainder row summed from the remaining rows of the SAME result (tone `muted`, label `დანარჩენი` — fresh minimal copy, ka-gated); if the view only returns five rows, no remainder row (never estimate). Recent payments: `DataTable` ledger. Verify queue: `Card`-based cards (bright paper, ink border) with the existing approve/reject actions untouched.
- [ ] **Step 3: Verify pages.** List tabs re-dressed (Task 7 already fixed the inline sub-tab classes); detail/VerifyCard: document dress — masked-ID reveal button and audit semantics byte-untouched.
- [ ] **Step 4: Verify** — `npm run build`; `npm test`; e2e: `npx playwright test e2e/admin-rbac.spec.ts e2e/admin-approval.spec.ts` → green unchanged; ka-gate touched files.
- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/layout.tsx" "app/(admin)/admin/page.tsx" "app/(admin)/admin/verify" components/AdminNav.tsx components/Badge.tsx components/design-system.test.tsx
git commit -m "feat(admin): the desk overview, ruled region bars, verify queue cards, pending badge"
```

---

### Task 19: Admin members, finances, transfer

**Files:**
- Modify: `app/(admin)/admin/members/page.tsx` (+ `ExportControls.tsx` already done in Task 7), `app/(admin)/admin/finances/page.tsx` (+ `RecordPayment.tsx`, `BulkMatch.tsx`), `app/(admin)/admin/transfer/page.tsx`
- Test: e2e `admin-payments.spec.ts` (must pass unchanged)

- [ ] **Step 1: Implement.** Members: GET-form filters via `adminControlClasses`, results `DataTable` ledger, masked IDs + audited reveal untouched, pagination footer ruled. Finances: `RecordPayment`/`BulkMatch` forms re-dressed (underline controls, `Card` sheets); the classify-then-confirm preview chips keep their ok/warn/danger semantics with the Task 4 chip skins. Transfer: form + confirm dress only.

- [ ] **Step 2: Verify** — `npm run build`; `npm test`; e2e: `npx playwright test e2e/admin-payments.spec.ts` → green unchanged; ka-gate touched files.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/members" "app/(admin)/admin/finances" "app/(admin)/admin/transfer"
git commit -m "style(admin): ledger tables and dense underline controls for members, finances, transfer"
```

---

### Task 20: Admin content hub, audit, settings, admins

**Files:**
- Modify: `app/(admin)/admin/content/**` (hub + news/events/polls lists, editors, `new` pages), `app/(admin)/admin/audit/page.tsx`, `app/(admin)/admin/settings/page.tsx`, `app/(admin)/admin/admins/page.tsx` (+ `GrantRoleForm.tsx`)
- Test: full e2e content specs `community-news.spec.ts`, `community-events.spec.ts`, `community-polls.spec.ts` re-run (admin editor journeys included)

- [ ] **Step 1: Implement.** ContentNav already re-dressed (Task 7). Lists as ledgers; editors: underline fields + the live `ContentBody` preview inside a `Card` titled with its existing wording; poll forms untouched behaviorally. Audit: the viewer table as ledger; the `max-w-[360px]` pre block keeps its constraint. Settings/admins: form dress only (`GrantRoleForm` uses `buttonClasses("dark", ...)` already — verify).

- [ ] **Step 2: Verify** — `npm run build`; `npm test`; e2e: `npx playwright test e2e/community-news.spec.ts e2e/community-events.spec.ts e2e/community-polls.spec.ts` → green unchanged; ka-gate touched files.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/content" "app/(admin)/admin/audit" "app/(admin)/admin/settings" "app/(admin)/admin/admins"
git commit -m "style(admin): content hub, audit ledger, settings and roles in Kronika dress"
```

---

### Task 21: OG images, PWA icons, favicon, manifest — and retire the dead tokens

**Files:**
- Modify: `app/(public)/delegates/[slug]/opengraph-image.tsx`, `scripts/generate-og-default.mjs`, `scripts/generate-icons.mjs`, `app/manifest.ts`, `app/globals.css` (delete deprecated tokens)
- Create: `assets/fonts/NotoSerifGeorgian-Bold.ttf`, `app/icon.png`, regenerated `public/og-default.png`, `public/icons/*.png`
- Test: `npm run build` + manual OG fetch on preview (final QA)

- [ ] **Step 1: Commit the serif TTF.** Download Noto Serif Georgian Bold:

```bash
curl -L -o assets/fonts/NotoSerifGeorgian-Bold.ttf "https://raw.githubusercontent.com/notofonts/georgian/main/fonts/NotoSerifGeorgian/hinted/ttf/NotoSerifGeorgian-Bold.ttf"
```

If the URL 404s (repo layout changed), fetch the family zip from Google Fonts (fonts.google.com/download?family=Noto+Serif+Georgian) and extract the Bold static TTF. Verify: `node -e "console.log(require('fs').statSync('assets/fonts/NotoSerifGeorgian-Bold.ttf').size > 50000)"` → `true`.

- [ ] **Step 2: Rewrite the delegate OG route.** Background `#F7F2E9`; a 10px `#9F1D35` kicker bar + 10px `#1A1611` bar (replacing the old red/white pair); the roundel via committed file (`readFile` `public/brand/emblem-roundel-red-notext.png` → data URI in an `<img>`); delegate name in `NotoSerifGeo` 700 (register the new TTF alongside the existing sans registration — keep the sans TTF for the meta line); all `#C8102E`/`#A30D26`/`#F4D67A` values replaced by `#9F1D35`/`#7C1629`/`#1A1611` on paper. Keep `force-static`, `revalidate`, satori explicit-flex rules.

- [ ] **Step 3: Rewrite the two sharp scripts + run them.**

`scripts/generate-icons.mjs` — compose from the roundel instead of drawing an SVG:

```js
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "prototype/kronika-d3/brand/emblem-roundel-red-notext.png";
mkdirSync("public/icons", { recursive: true });
await sharp(SRC).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(SRC).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#9F1D35" },
})
  .composite([{ input: await sharp(SRC).resize(400, 400).toBuffer(), gravity: "center" }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");
await sharp(SRC).resize(48, 48).png().toFile("app/icon.png");
console.log("icons written");
```

`scripts/generate-og-default.mjs` — paper background `#F7F2E9`, left-aligned brand bars `#9F1D35` + `#1A1611`, nameplate text in `Noto Serif Georgian, Sylfaen, serif` fill `#1A1611`, tagline fill `#6E6659`, roundel composited at the right (`composite` the resized roundel buffer). Keep the same output path. Run both:

```bash
node scripts/generate-icons.mjs && node scripts/generate-og-default.mjs
```

- [ ] **Step 4: Manifest + token retirement.** `app/manifest.ts`: `background_color: "#F7F2E9"`, `theme_color: "#F7F2E9"` (icons list unchanged — same paths). `app/globals.css`: delete the four deprecated token lines (navy, navy-dark, gold, info) and the comment. Verify nothing references them:

```bash
git grep -nE "navy|-gold|text-info|bg-info" -- app components lib
```

Expected: no hits (docs/prototype/scripts excluded by pathspec).

- [ ] **Step 5: Verify + commit** — `npm run build` (sw precache picks up regenerated icons); `npm test`.

```bash
git add app/globals.css app/manifest.ts app/icon.png assets/fonts scripts/generate-icons.mjs scripts/generate-og-default.mjs public/icons public/og-default.png "app/(public)/delegates/[slug]/opengraph-image.tsx"
git commit -m "feat(brand): roundel icons + favicon, paper OG cards with serif, retire navy/gold/info"
```

---

### Task 22: The 360px guard + full-suite audit + integrity sweeps

**Files:**
- Create: `e2e/responsive.spec.ts`
- Test: the full suites

- [ ] **Step 1: Write the new guard** (this file is NEW — no existing guard; spec correction #1):

```ts
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/delegates", "/leaderboard", "/news", "/events", "/transparency", "/join", "/login", "/styleguide"];

test.describe("360px viewport has no horizontal overflow", () => {
  test.use({ viewport: { width: 360, height: 780 } });
  for (const path of PAGES) {
    test(`no overflow at ${path}`, async ({ page }) => {
      await page.goto(path);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, `${path} overflows horizontally`).toBeLessThanOrEqual(clientWidth);
    });
  }
});
```

- [ ] **Step 2: Run it** — `npx playwright test e2e/responsive.spec.ts` → all pass (fix any overflowing page with `min-w-0`/`overflow-x-auto` on the offending container — table wrappers are the usual suspects; wide ledgers must scroll inside their own container per the spec).

- [ ] **Step 3: Full audit.** (a) Full e2e once (env loaded, respecting the 2-runs/hour cap): `npx playwright test` → 100% green. (b) ka-gate sweep over every touched file with Georgian: `git diff --name-only main | xargs node scripts/ka-gate.mjs` (skip binaries — filter to `.ts/.tsx/.md/.css`). (c) Old-identity sweep:

```bash
git grep -inE "C8102E|A30D26|B3261E|1A73E8|0E1A2B|C9A24B|F4D67A|🥇|🥈|🥉" -- app components lib
```

Expected: zero hits. (d) `npm run format && npm run lint && npm run typecheck && npm test && npm run build` — all clean.

- [ ] **Step 4: Commit**

```bash
git add e2e/responsive.spec.ts
git commit -m "test(e2e): 360px no-overflow guard across public pages"
```

---

### Task 23: Documentation — DESIGN.md rewrite, CLAUDE.md pointer, prototype supersession

**Files:**
- Modify: `DESIGN.md` (full rewrite), `CLAUDE.md` (one line), `prototype/README.md` (banner)

- [ ] **Step 1: Rewrite `DESIGN.md`** as the Kronika system reference: registers (public editorial / cabinet ledger / admin dense — all one material system now); the token table copied from spec §2.2 (values only, no prose duplication); type rules (§2.3 incl. the 0.74rem floor and serif roles); interaction identity (§2.4); the component register — every component from Tasks 2–8 with its one-line visual contract and the furniture set with props; the accessibility floors (§2.5); the rule that `/styleguide` is the living gallery and ad-hoc restyling stays forbidden; the ka-gate script as the mandatory Georgian gate. Reference the contract bundle path.

- [ ] **Step 2: Update `CLAUDE.md`** — the line `UX contract: prototype/index.html.` becomes `UX contract: prototype/kronika-d3/ (spec docs/superpowers/specs/2026-07-23-kronika-redesign-design.md).` (keep the rest of the line's sentence structure intact).

- [ ] **Step 3: Prepend to `prototype/README.md`**: a short banner — this prototype is superseded as UX contract by `prototype/kronika-d3/` as of v0.9.0; kept for history.

- [ ] **Step 4: Verify + commit** — `node scripts/ka-gate.mjs DESIGN.md CLAUDE.md prototype/README.md` → ok; `npm run format`.

```bash
git add DESIGN.md CLAUDE.md prototype/README.md
git commit -m "docs: DESIGN.md rewritten for Kronika; UX-contract pointer moved; old prototype marked superseded"
```

---

## After Task 23 (not tasks — the standing ritual)

Whole-branch review → fix waves as needed → push → CI green → **/qa against the Vercel preview** → plain-language sign-off package for the owner (screenshots: front page desktop+mobile, registry, an article, join form, member profile + billing, wizard done, delegate desk, admin desk, styleguide; plus the OG image fetch and the installed-icon shot) → owner sign-off → release commit (v0.9.0 bump + CHANGELOG, per the R2 ritual: release commit on the branch BEFORE merge, CI green again) → merge. Not started without the owner's explicit go at each gate.
