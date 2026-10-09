# Teal Secondary Colour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kronika gains a second colour, teal `#235B59`, that marks informational elements while red keeps marking actions. No layout, copy, behaviour, database or environment change.

**Architecture:** Two theme tokens and one CSS utility in `app/globals.css`. Additive props on existing design-system components (`SectionRule.tone`, `BallotBar` tone `"teal"`, `Card` variant `"callout-teal"`). Class-only restyles of `Masthead`, `MobileBackHeader`, `SiteFooter`, `Pill`, `Button` (`dark`) and `PollCard`. Three call sites switch to the new props (homepage registry, admin region bars, profile my-delegate card).

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4 (`@theme` tokens, `@utility`), React 19, Vitest + Testing Library (jsdom), Playwright (e2e on CI).

**Spec:** `docs/superpowers/specs/2026-10-08-teal-secondary-color-design.md`

## Global Constraints

- Tokens: `--color-teal: #235b59;` and `--color-teal-dark: #1a4644;`. No teal tint token of any name (owner, 2026-10-08: no tinted panels).
- Red acts (links, active nav, №1 rank, focus outline, primary-button hover, danger). Teal informs. Never recolour the logo.
- Component contracts are frozen: names, exported symbols and existing prop values keep working. Every new prop or union member is additive, and defaults reproduce today's classes byte for byte.
- No new Georgian copy. Never retype an existing Georgian string. Edit class strings only, or copy existing JSX with the editor. Gate every touched file with `node scripts/ka-gate.mjs --diff main <files>` and run `npm run ka:scan` before each commit.
- TypeScript strict. No `any`, no `@ts-ignore`. No new dependencies.
- TDD: each task writes its failing test, runs it red, then implements.
- Never push to `main`. Work on branch `claude/platform-branding-design-5f4d1c`.
- Commit messages: plain imperative sentence, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## How to run things from this worktree

The worktree has no `node_modules`. `npx --no-install` resolves the parent repo's binaries (verified):

- One test file: `npx --no-install vitest run <path>`
- Whole unit suite: `npx --no-install vitest run`
- Types: `npx --no-install tsc --noEmit` (if it reports errors under `.next/`, delete `.next` and rerun)
- Lint: `npx --no-install eslint .`
- Format: `npx --no-install prettier --write <files>` then `npx --no-install prettier --check .`
- Georgian gates: `node scripts/ka-gate.mjs --diff main <files>` and `npm run ka:scan`
- Build (Task 7 only): copy env first with `cp "../../../.env.local" .env.local` (gitignored), then `npx --no-install next build`

## File map

| File | Responsibility | Task |
| ---- | -------------- | ---- |
| `app/globals.css` | `teal`, `teal-dark` tokens; `masthead-rule` utility | 1 |
| `app/theme-tokens.test.ts` (new) | Pins the tokens and the utility | 1 |
| `components/Masthead.tsx`, `components/MobileBackHeader.tsx` (+ tests) | Use `masthead-rule` instead of `border-b-2 border-ink` | 1 |
| `components/SectionRule.tsx` (+ test) | `tone?: "ink" \| "teal"` | 2 |
| `app/(public)/page.tsx` (+ test) | Registry box: teal rule, label, figures | 2 |
| `components/SiteFooter.tsx`, `components/SiteFooter.test.tsx` (new) | Teal band | 3 |
| `components/Pill.tsx` | Supporter chip teal | 4 |
| `components/Ballot.tsx` (+ test), `app/(admin)/admin/page.tsx` | `tone="teal"`; region bars use it | 4 |
| `app/(member)/me/polls/PollCard.tsx` (+ test) | Leading bar brand, others teal | 4 |
| `components/Card.tsx`, `app/(member)/me/profile/page.tsx` | `variant="callout-teal"`; my-delegate card | 5 |
| `components/Button.tsx` | `dark` restyled teal | 5 |
| `components/design-system.test.tsx` | Pill, Card, Button tests | 4, 5 |
| `app/(public)/styleguide/page.tsx` | Gallery entries | 6 |
| `DESIGN.md`, `DECISIONS.md`, `CHANGELOG.md` | Docs, ADR-047, changelog | 6 |

---

### Task 1: Teal tokens and the masthead rule

**Files:**
- Modify: `app/globals.css` (the `@theme` block, lines 3–23, and a new utility after `@utility pebble`)
- Create: `app/theme-tokens.test.ts`
- Modify: `components/Masthead.tsx:73-75` (header `className`) and its docstring (lines 14–20)
- Modify: `components/MobileBackHeader.tsx:18` (header `className`)
- Test: `components/Masthead.test.tsx`, `components/MobileBackHeader.test.tsx`

**Interfaces:**
- Produces: Tailwind utilities `bg-teal`, `text-teal`, `border-teal`, `bg-teal/10`, `bg-teal-dark`, `hover:bg-teal-dark`, `hover:border-teal-dark` (generated from the tokens), and the class `masthead-rule`. Every later task uses these names.

- [ ] **Step 1: Write the failing token/utility test**

Create `app/theme-tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("theme tokens (ADR-047)", () => {
  it("defines the teal second colour and its hover shade", () => {
    expect(css).toMatch(/--color-teal:\s*#235b59;/i);
    expect(css).toMatch(/--color-teal-dark:\s*#1a4644;/i);
  });

  it("has no teal tint token (owner, 2026-10-08: no tinted panels)", () => {
    expect(css).not.toMatch(/--color-teal-(tint|soft|light|pale)/);
  });

  it("draws the masthead rule as one bottom border: 2px ink, 2px paper, 1px teal", () => {
    const block = css.match(/@utility masthead-rule \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toContain("border-bottom: 5px solid");
    expect(block).toMatch(/var\(--color-teal\) 0 1px/);
    expect(block).toMatch(/var\(--color-paper\) 1px 3px/);
    expect(block).toMatch(/var\(--color-ink\) 3px 5px/);
    expect(block).toMatch(/\b0 0 5 0;/);
  });
});
```

- [ ] **Step 2: Write the failing header tests**

Append inside the `describe("Masthead", …)` block of `components/Masthead.test.tsx`:

```tsx
  it("draws the masthead rule as the header's own border, not the old 2px ink rule (ADR-047)", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<Masthead navItems={NAV_ITEMS} cta={<span>CTA</span>} />);
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("masthead-rule");
    expect(header).not.toHaveClass("border-b-2");
  });
```

Append inside the `describe("MobileBackHeader", …)` block of `components/MobileBackHeader.test.tsx`:

```tsx
  it("uses the same masthead rule as the Masthead (ADR-047)", () => {
    const { container } = render(<MobileBackHeader href="/news" label="News" />);
    const header = container.firstElementChild as HTMLElement;
    expect(header).toHaveClass("masthead-rule");
    expect(header).not.toHaveClass("border-b-2");
  });
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx --no-install vitest run app/theme-tokens.test.ts components/Masthead.test.tsx components/MobileBackHeader.test.tsx`
Expected: FAIL. The token test fails on `--color-teal` missing; the two header tests fail on `masthead-rule`.

- [ ] **Step 4: Add the tokens and the utility**

In `app/globals.css`, inside `@theme`, directly after `--color-danger: #9f1d35;`, add:

```css
  --color-teal: #235b59;
  --color-teal-dark: #1a4644;
```

After the `@utility pebble { … }` block, add:

```css
/* Masthead rule (ADR-047): 2px ink, a 2px paper gap, 1px teal, drawn as the header's own
   bottom border so its position and stickiness stay untouched (e2e pins both). The gradient
   runs to top, so its stops are measured from the bottom edge. */
@utility masthead-rule {
  border-bottom: 5px solid var(--color-ink);
  border-image: linear-gradient(
      to top,
      var(--color-teal) 0 1px,
      var(--color-paper) 1px 3px,
      var(--color-ink) 3px 5px
    )
    0 0 5 0;
}
```

- [ ] **Step 5: Switch both headers to the utility**

In `components/Masthead.tsx`, in the header's `className` template, replace the substring
`items-center justify-between border-b-2 border-ink px-5 pb-2.5 pt-4 sm:px-10`
with
`items-center justify-between masthead-rule px-5 pb-2.5 pt-4 sm:px-10`.

In the docstring above `export function Masthead`, replace
`vertically centered with the logo, over a single` / `2px rule.`
with
`vertically centered with the logo, over the masthead rule` / `(2px ink, 2px paper, 1px teal; ADR-047).`
Keep the rest of the comment.

In `components/MobileBackHeader.tsx`, in the header `className`, replace
`border-b-2 border-ink bg-paper`
with
`masthead-rule bg-paper`.

- [ ] **Step 6: Format and run the tests green**

Run: `npx --no-install prettier --write app/globals.css app/theme-tokens.test.ts components/Masthead.tsx components/MobileBackHeader.tsx components/Masthead.test.tsx components/MobileBackHeader.test.tsx`
Run: `npx --no-install vitest run app/theme-tokens.test.ts components/Masthead.test.tsx components/MobileBackHeader.test.tsx`
Expected: PASS. All tests in the three files are green, including the existing back-route test, which checks `hidden` / `md:flex` and is unaffected.

If prettier rewraps the gradient, rerun the token test. Its regexes match the stops, not the line breaks.

- [ ] **Step 7: Gate and commit**

```bash
node scripts/ka-gate.mjs --diff main app/globals.css app/theme-tokens.test.ts components/Masthead.tsx components/MobileBackHeader.tsx components/Masthead.test.tsx components/MobileBackHeader.test.tsx
npm run ka:scan
git add app/globals.css app/theme-tokens.test.ts components/Masthead.tsx components/MobileBackHeader.tsx components/Masthead.test.tsx components/MobileBackHeader.test.tsx
git commit -m "Add the teal tokens and draw the masthead rule with a teal line" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Teal registry box on the homepage

**Files:**
- Modify: `components/SectionRule.tsx` (props and the two `className`s)
- Test: `components/SectionRule.test.tsx`
- Modify: `app/(public)/page.tsx:166-199` (the registry `<div>` inside `<aside>`)
- Test: `app/(public)/page.test.tsx`

**Interfaces:**
- Consumes: `border-teal`, `text-teal` (Task 1).
- Produces: `SectionRule` prop `tone?: "ink" | "teal"` (default `"ink"`). Task 6 uses it in the styleguide.

- [ ] **Step 1: Write the failing SectionRule tests**

Append inside `describe("SectionRule", …)` in `components/SectionRule.test.tsx`:

```tsx
  it("draws an ink rule and leaves the label uncoloured by default", () => {
    const { container } = render(<SectionRule label="Default tone" />);
    expect(container.firstElementChild).toHaveClass("border-ink");
    expect(screen.getByText("Default tone")).not.toHaveClass("text-teal");
  });

  it("draws a teal rule and a teal label with tone=teal (ADR-047)", () => {
    const { container } = render(<SectionRule label="Registry" tone="teal" />);
    expect(container.firstElementChild).toHaveClass("border-teal");
    expect(container.firstElementChild).not.toHaveClass("border-ink");
    expect(screen.getByText("Registry")).toHaveClass("text-teal");
  });
```

- [ ] **Step 2: Write the failing homepage test**

Append to `app/(public)/page.test.tsx` (top level, after the existing `describe` blocks):

```tsx
describe("registry box (ADR-047)", () => {
  it("draws the registry heading rule and its three counters in teal", async () => {
    render(await HomePage());

    const registry = screen.getByTestId("registry");
    expect(registry.firstElementChild).toHaveClass("border-teal");
    for (const id of ["stat-approved-delegates", "stat-members-total", "stat-registered-total"]) {
      expect(screen.getByTestId(id)).toHaveClass("text-teal");
    }
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx --no-install vitest run components/SectionRule.test.tsx "app/(public)/page.test.tsx"`
Expected: FAIL. TypeScript accepts `tone` at runtime, but the class assertions fail, and `getByTestId("registry")` throws because no element has that test id yet.

- [ ] **Step 4: Add `tone` to SectionRule**

In `components/SectionRule.tsx`, change the signature and the two class strings so the function reads:

```tsx
export function SectionRule({
  label,
  action,
  as: LabelTag = "h2",
  tone = "ink",
  className = "",
}: {
  label: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3" | "div";
  /** `teal` marks an informational box (the homepage registry, ADR-047). Default ink. */
  tone?: "ink" | "teal";
  className?: string;
}) {
  const rule = tone === "teal" ? "border-teal" : "border-ink";
  const labelTone = tone === "teal" ? " text-teal" : "";
  return (
    <div
      className={`flex items-baseline justify-between border-b-2 ${rule} pb-1.5 ${className}`.trim()}
    >
      <LabelTag className={`text-[0.7rem] font-bold uppercase tracking-[.18em]${labelTone}`}>
        {label}
      </LabelTag>
      {action}
    </div>
  );
}
```

With the default tone, both class strings are byte-identical to today's.

- [ ] **Step 5: Turn the homepage registry teal**

In `app/(public)/page.tsx`, inside `<aside>`:

1. The first child `<div>` (the one wrapping `<SectionRule label={REG} />`) becomes `<div data-testid="registry">`.
2. `<SectionRule label={REG} />` becomes `<SectionRule label={REG} tone="teal" />`.
3. In each of the four figure `<span>`s of that box (approved delegates, members, registered, and the collected-dues row), change `className="font-serif text-xl font-bold"` to `className="font-serif text-xl font-bold text-teal"`.

Do not touch the ranking box below it (`<SectionRule label={TOP} …>` stays ink).

- [ ] **Step 6: Run the tests green**

Run: `npx --no-install prettier --write components/SectionRule.tsx components/SectionRule.test.tsx "app/(public)/page.tsx" "app/(public)/page.test.tsx"`
Run: `npx --no-install vitest run components/SectionRule.test.tsx "app/(public)/page.test.tsx"`
Expected: PASS, including every pre-existing homepage test (counters, ladder links, finances shown/hidden, events).

- [ ] **Step 7: Gate and commit**

```bash
node scripts/ka-gate.mjs --diff main components/SectionRule.tsx components/SectionRule.test.tsx "app/(public)/page.tsx" "app/(public)/page.test.tsx"
npm run ka:scan
git add components/SectionRule.tsx components/SectionRule.test.tsx "app/(public)/page.tsx" "app/(public)/page.test.tsx"
git commit -m "Draw the homepage registry box in teal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Teal footer band

**Files:**
- Modify: `components/SiteFooter.tsx` (docstring, `<footer>` and `<Link>` classes)
- Create: `components/SiteFooter.test.tsx`

**Interfaces:**
- Consumes: `bg-teal`, `text-paper`, `text-surface`, `outline-paper` (Task 1 and the existing tokens).
- Produces: nothing new. Props are unchanged.

- [ ] **Step 1: Write the failing test**

Create `components/SiteFooter.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

const LINKS = [
  { href: "/join/terms", label: "Terms" },
  { href: "/support", label: "Contact" },
];

describe("SiteFooter (ADR-047)", () => {
  it("is a solid teal band with paper text and no ink top rule", () => {
    render(<SiteFooter copyright="(c) 2026" links={LINKS} />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass("bg-teal", "text-paper");
    expect(footer).not.toHaveClass("bg-paper");
    expect(footer).not.toHaveClass("border-t-2");
  });

  it("keeps links paper-coloured, with a paper focus outline (red on teal is 1.00:1)", () => {
    render(<SiteFooter copyright="(c) 2026" links={LINKS} />);
    for (const name of ["Terms", "Contact"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveClass("text-paper", "hover:text-surface", "focus-visible:outline-paper");
      expect(link).not.toHaveClass("text-ink");
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx --no-install vitest run components/SiteFooter.test.tsx`
Expected: FAIL on `bg-teal` (the footer is `bg-paper` today).

- [ ] **Step 3: Restyle the footer**

In `components/SiteFooter.tsx`:

- `<footer>` className: replace
  `border-t-2 border-ink bg-paper px-5 py-6 text-[0.8rem] text-muted-fg sm:px-10`
  with
  `bg-teal px-5 py-6 text-[0.8rem] text-paper sm:px-10`.
- `<Link>` className: replace
  `text-ink hover:text-brand`
  with
  `text-paper hover:text-surface focus-visible:outline-paper`.
- Docstring: replace its first two lines
  `Cream (paper-toned) site footer (spec §3.2): copyright left, link row right,`
  `over a 2px ink rule matching the masthead's own rule weight.`
  with
  `Teal site footer (spec §3.2, ADR-047): copyright left, link row right, on the one solid`
  `teal band. Links take a paper focus outline because red on teal is invisible (1.00:1).`
  Leave the `aria-label` on `<nav>` exactly as it is.

- [ ] **Step 4: Run it green**

Run: `npx --no-install prettier --write components/SiteFooter.tsx components/SiteFooter.test.tsx`
Run: `npx --no-install vitest run components/SiteFooter.test.tsx`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
node scripts/ka-gate.mjs --diff main components/SiteFooter.tsx components/SiteFooter.test.tsx
npm run ka:scan
git add components/SiteFooter.tsx components/SiteFooter.test.tsx
git commit -m "Turn the public footer into a teal band" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Teal for the supporter chip and non-leading poll answers

**Files:**
- Modify: `components/Pill.tsx` (the `registered` entry of `STATUS_CONFIG`)
- Modify: `components/Ballot.tsx` (`BallotBarProps.tone`, the tone mapping)
- Modify: `app/(admin)/admin/page.tsx:179` (region bar tone)
- Modify: `app/(member)/me/polls/PollCard.tsx` (results bars)
- Test: `components/design-system.test.tsx`, `components/Ballot.test.tsx`, `app/(member)/me/polls/PollCard.test.tsx`

**Interfaces:**
- Consumes: `bg-teal`, `bg-teal/10`, `text-teal` (Task 1).
- Produces: `BallotBarProps["tone"]` = `"brand" | "teal" | "ink" | "muted"`. Task 6 uses `tone="teal"` in the styleguide.

- [ ] **Step 1: Write the failing tests**

In `components/design-system.test.tsx`, append inside `describe("Pill", …)`:

```tsx
  it("shows the supporter chip in teal, in the chip system's own /10 tint (ADR-047)", () => {
    const { container } = render(<Pill status="registered" />);
    const chip = container.firstElementChild;
    expect(chip).toHaveClass("bg-teal/10", "text-teal");
    expect(chip).not.toHaveClass("bg-surface");
  });
```

In `components/Ballot.test.tsx`, add a row to the `it.each` table so it reads:

```tsx
  it.each([
    ["brand", "bg-brand"],
    ["teal", "bg-teal"],
    ["ink", "bg-ink"],
    ["muted", "bg-muted-fg"],
  ] as const)("the fill is pct wide and coloured by tone %s", (tone, toneClass) => {
```

In `app/(member)/me/polls/PollCard.test.tsx`, append inside `describe("PollCard", …)`:

```tsx
  it("results: the leading answer's bar is brand red, the others teal (ADR-047)", () => {
    const { container } = render(
      <PollCard
        pollId={POLL_ID}
        question="Q?"
        view="results-own"
        deadlineKa={null}
        options={[
          { optionId: OPT_A, label: "Yes", pct: 67, votes: 2, mine: true },
          { optionId: OPT_B, label: "No", pct: 33, votes: 1, mine: false },
        ]}
        total={3}
      />,
    );
    expect(container.querySelector("[style*='width: 67%']")).toHaveClass("bg-brand");
    expect(container.querySelector("[style*='width: 33%']")).toHaveClass("bg-teal");
  });

  it("results: a tie colours every leading answer brand red", () => {
    const { container } = render(
      <PollCard
        pollId={POLL_ID}
        question="Q?"
        view="results-closed"
        deadlineKa={null}
        options={[
          { optionId: OPT_A, label: "Yes", pct: 50, votes: 2, mine: false },
          { optionId: OPT_B, label: "No", pct: 50, votes: 2, mine: false },
        ]}
        total={4}
      />,
    );
    const bars = container.querySelectorAll("[style*='width: 50%']");
    expect(bars).toHaveLength(2);
    bars.forEach((bar) => expect(bar).toHaveClass("bg-brand"));
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx --no-install vitest run components/design-system.test.tsx components/Ballot.test.tsx "app/(member)/me/polls/PollCard.test.tsx"`
Expected: FAIL. The Pill test fails on `bg-teal/10`; the Ballot `teal` row fails on the missing `bg-teal` (and `tsc` would reject the tone); the PollCard 33% bar is `bg-brand`.

- [ ] **Step 3: Pill**

In `components/Pill.tsx`, in the `registered` entry, change only `className: "bg-surface text-muted-fg"` to `className: "bg-teal/10 text-teal"`. Leave its `label` and every other entry untouched (the Pill-defaults guard test must stay green).

- [ ] **Step 4: BallotBar**

In `components/Ballot.tsx`, change the `tone` member of `BallotBarProps` to
`tone: "brand" | "teal" | "ink" | "muted";`
and replace the `toneClass` line inside `BallotBar` with a lookup placed between the `BallotBarProps` interface and the `BallotBar` function:

```tsx
const TONE_CLASS: Record<BallotBarProps["tone"], string> = {
  brand: "bg-brand",
  teal: "bg-teal",
  ink: "bg-ink",
  muted: "bg-muted-fg",
};
```

and inside `BallotBar`: `const toneClass = TONE_CLASS[tone];`

In `app/(admin)/admin/page.tsx`, change `tone={i === 0 ? "brand" : "ink"}` to `tone={i === 0 ? "brand" : "teal"}`. The remainder bar keeps `tone="muted"`. This call site has no page test. Its colour is covered by the `BallotBar` test above and checked visually in Task 7.

- [ ] **Step 5: PollCard**

In `app/(member)/me/polls/PollCard.tsx`, directly above `return (`, add:

```tsx
  // ADR-047: the leading answer (every answer tied for the top share) stays red; the rest teal.
  const leadPct = Math.max(0, ...options.map((o) => o.pct));
```

In the results branch, replace the fill
`<div className="h-2 bg-brand" style={{ width: `${o.pct}%` }} />`
with
`<div className={`h-2 ${o.pct === leadPct ? "bg-brand" : "bg-teal"}`} style={{ width: `${o.pct}%` }} />`

- [ ] **Step 6: Run them green**

Run: `npx --no-install prettier --write components/Pill.tsx components/Ballot.tsx components/design-system.test.tsx components/Ballot.test.tsx "app/(admin)/admin/page.tsx" "app/(member)/me/polls/PollCard.tsx" "app/(member)/me/polls/PollCard.test.tsx"`
Run: `npx --no-install vitest run components/design-system.test.tsx components/Ballot.test.tsx "app/(member)/me/polls/PollCard.test.tsx"`
Expected: PASS (all old and new tests).

- [ ] **Step 7: Gate and commit**

```bash
node scripts/ka-gate.mjs --diff main components/Pill.tsx components/Ballot.tsx components/design-system.test.tsx components/Ballot.test.tsx "app/(admin)/admin/page.tsx" "app/(member)/me/polls/PollCard.tsx" "app/(member)/me/polls/PollCard.test.tsx"
npm run ka:scan
git add components/Pill.tsx components/Ballot.tsx components/design-system.test.tsx components/Ballot.test.tsx "app/(admin)/admin/page.tsx" "app/(member)/me/polls/PollCard.tsx" "app/(member)/me/polls/PollCard.test.tsx"
git commit -m "Show supporters and non-leading poll answers in teal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Teal call-out card and the teal secondary button

**Files:**
- Modify: `components/Card.tsx` (new skin + `variant` union)
- Modify: `app/(member)/me/profile/page.tsx:252-256` (my-delegate card)
- Modify: `components/Button.tsx` (`dark` variant)
- Test: `components/design-system.test.tsx`

**Interfaces:**
- Consumes: `border-teal`, `text-teal`, `bg-teal`, `hover:bg-teal-dark`, `hover:border-teal-dark` (Task 1).
- Produces: `Card` prop `variant?: "callout" | "callout-teal"`. Task 6 uses it in the styleguide.

- [ ] **Step 1: Write the failing tests**

In `components/design-system.test.tsx`, add `import { Card } from "./Card";` next to the other component imports. Then append inside `describe("Button", …)`:

```tsx
  it("renders dark as the teal secondary button (ADR-047)", () => {
    render(<Button variant="dark">Find</Button>);
    const btn = screen.getByRole("button", { name: "Find" });
    expect(btn).toHaveClass("bg-teal", "border-teal", "text-paper", "hover:bg-teal-dark");
    expect(btn).not.toHaveClass("bg-ink");
  });

  it("keeps primary on ink with the red hover", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("bg-ink", "hover:bg-brand");
  });
```

and add a new block at the end of the file:

```tsx
describe("Card", () => {
  it("callout keeps the ink border on bright paper", () => {
    const { container } = render(<Card variant="callout">x</Card>);
    expect(container.firstElementChild).toHaveClass("border-ink", "bg-paper-bright");
  });

  it("callout-teal is the same surface with a teal border (ADR-047)", () => {
    const { container } = render(<Card variant="callout-teal">x</Card>);
    expect(container.firstElementChild).toHaveClass("border-teal", "bg-paper-bright");
    expect(container.firstElementChild).not.toHaveClass("border-ink");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx --no-install vitest run components/design-system.test.tsx`
Expected: FAIL on the `dark` test (`bg-teal` missing) and on `callout-teal` (falls through to the hairline skin).

- [ ] **Step 3: Card**

In `components/Card.tsx`, below `const cardSkinCallout = …`, add:

```tsx
// Teal call-out (ADR-047): the same bright surface with a teal border, for informational
// call-outs such as the my-delegate card. Never a teal fill.
const cardSkinCalloutTeal = "border border-teal bg-paper-bright";
```

Change the prop type to `variant?: "callout" | "callout-teal";` and the skin line to:

```tsx
  const skin =
    variant === "callout"
      ? cardSkinCallout
      : variant === "callout-teal"
        ? cardSkinCalloutTeal
        : cardSkin;
```

- [ ] **Step 4: The my-delegate card on /me/profile**

In `app/(member)/me/profile/page.tsx`, find the `<Card variant="callout">` that opens directly under `{isMemberRole ? (` (its first child is the small label `<div>` above the delegate). Make exactly two edits there:

1. `<Card variant="callout">` becomes `<Card variant="callout-teal">`.
2. On the label `<div>` right below it, change `text-muted-fg` to `text-teal` in its className (it becomes `text-[0.7rem] font-bold uppercase tracking-[.18em] text-teal`). Do not retype the label text.

Leave the other `variant="callout"` cards on this page (delegacy states) unchanged. The page has no unit test harness. The variant is covered by the Card test above and checked on the preview in Task 7.

- [ ] **Step 5: Button**

In `components/Button.tsx`, change the `dark` entry of `variants` to:

```tsx
  dark: "border border-teal bg-teal text-paper hover:border-teal-dark hover:bg-teal-dark",
```

- [ ] **Step 6: Run them green**

Run: `npx --no-install prettier --write components/Card.tsx components/Button.tsx components/design-system.test.tsx "app/(member)/me/profile/page.tsx"`
Run: `npx --no-install vitest run components/design-system.test.tsx components/GoogleAuthButton.test.tsx components/CopyButton.test.tsx`
Expected: PASS. `GoogleAuthButton` and `CopyButton` use `ghost`, which is unchanged.

- [ ] **Step 7: Gate and commit**

```bash
node scripts/ka-gate.mjs --diff main components/Card.tsx components/Button.tsx components/design-system.test.tsx "app/(member)/me/profile/page.tsx"
npm run ka:scan
git add components/Card.tsx components/Button.tsx components/design-system.test.tsx "app/(member)/me/profile/page.tsx"
git commit -m "Add the teal call-out and make the dark button teal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Styleguide, DESIGN.md, ADR-047, changelog

**Files:**
- Modify: `app/(public)/styleguide/page.tsx` (`PALETTE`, `CONTRAST_PAIRS`, `BUTTON_VARIANTS`, the SectionRule card, the registry card, the poll card)
- Modify: `DESIGN.md`
- Modify: `DECISIONS.md` (append)
- Modify: `CHANGELOG.md` (prepend)

**Interfaces:**
- Consumes: `SectionRule tone="teal"` (Task 2), `BallotBar tone="teal"` (Task 4), `Card variant="callout-teal"` (Task 5), `Pill status="registered"`, `Button variant="dark"`.

- [ ] **Step 1: Styleguide data**

In `app/(public)/styleguide/page.tsx`:

- In `PALETTE`, after the `brand-dark` entry, add:
  ```tsx
  { name: "teal", hex: "#235B59" },
  { name: "teal-dark", hex: "#1A4644" },
  ```
- In `CONTRAST_PAIRS`, append:
  ```tsx
  "teal / paper — 6.9:1",
  "paper / teal — 6.9:1",
  "paper / teal-dark — 9.4:1",
  ```
- In `BUTTON_VARIANTS`, change `{ variant: "dark", label: "dark" }` to `{ variant: "dark", label: "dark (teal)" }`.

- [ ] **Step 2: Styleguide demos (copy, never retype Georgian)**

- In the card that holds the ranking `<SectionRule … as="div" … />` (section 14), use the editor to duplicate that whole `<SectionRule … />` element directly below itself, then add `tone="teal"` and `className="mt-6"` to the copy.
- Directly after the card that renders the three `<IndexRow … />` samples, add a new card. Use the editor to copy the first `<IndexRow … />` element (rank 1) into it:
  ```tsx
  <Card variant="callout-teal">
    <div className="mb-3">
      <Pill status="registered" />
    </div>
    {/* replace this comment with the copied rank-1 <IndexRow … /> element */}
  </Card>
  ```
  The finished card holds the `Pill` and the copied `IndexRow`, with no comment left behind.
- In the poll card, change the second `<BallotBar … tone="ink" />` to `tone="teal"`.
- Leave the "4. Pill statuses" card byte-exact (its comment marks it as a smoke anchor).

- [ ] **Step 3: DESIGN.md**

Make these edits, each a literal find-and-replace (English only). Afterwards run prettier so the
tables realign.

**3a. Materials paragraph.** Find:

```text
**Depth comes from rules, not shadows:** a double rule under the masthead (2px over 1px), 2px
```

Replace with:

```text
**Depth comes from rules, not shadows:** the masthead rule (2px ink, a 2px paper gap, 1px teal,
drawn as one border by the `masthead-rule` utility, never a shadow), 2px
```

**3b. Palette table.** Directly after the row that starts with `` | `brand-dark` ``, insert:

```text
| `teal`               | `#235b59`             | The second colour, which **informs**: registry figures, the supporter chip, non-leading poll bars, the my-delegate call-out border, `dark` buttons, the masthead rule's teal line, the footer band. Never acts, never recolours the logo. |
| `teal-dark`          | `#1a4644`             | Teal button hover.                                                                                                |
```

**3c. Roles paragraph.** Directly before the line that starts with `Focus-visible is a 2px`,
insert this paragraph (followed by a blank line):

```text
**Red acts, teal informs (ADR-047).** There is no teal tint token: teal never fills a panel. The
footer is the one solid teal area; the supporter chip uses the chip system's `/10` tint like
every other chip. Red and teal are equally dark (1.00:1), so never let red-versus-teal alone
carry meaning: a leading poll answer is also the longest bar and shows its percentage.
```

**3d. Focus sentence.** Find:

```text
Focus-visible is a 2px `brand` outline, offset 2px, on every interactive element.
```

Replace with:

```text
Focus-visible is a 2px `brand` outline, offset 2px, on every interactive element, except on the
teal footer, where links use a `paper` outline (red on teal is invisible).
```

**3e. Interaction identity.** Directly after the bullet that starts with `- Ghost buttons:`
(including its continuation line), insert:

```text
- **Secondary solid buttons (`dark`): teal fill, paper text; hover `teal-dark`.** For look-up and
  go-see actions (admin search and lookup, the delegate panel's team link).
```

**3f. Accessibility floors.** In the bullet that starts with `- Contrast (verified):`, find
`paper/brand 7.0:1` and replace it with:

```text
paper/brand 7.0:1 · teal/paper 6.9:1 · paper/teal 6.9:1 · paper/teal-dark 9.4:1 · teal on the supporter chip 6.5:1
```

**3g. Component register.** Literal replacements inside the named rows:

| Row | Find | Replace with |
| --- | ---- | ------------ |
| `Button` | `` `dark` renders identically to `primary` (ink); `` | `` `dark` is the teal secondary button (ADR-047); `` |
| `Card` | `comes from the component, not ad-hoc styling.` | ``comes from the component, not ad-hoc styling. `variant="callout-teal"`: the same surface with a teal border (the my-delegate card).`` |
| `Pill` | `` Mapping: ok→`ok`, warn→`warn`, danger/rejected→`brand`, info/profile_completed→**neutral ink**, muted→muted. `` | `` Mapping: draft→muted; registered (supporter)→`teal`; profile_completed/active_member/approved→`ok`; pending→`warn`; rejected→`brand`. `` |
| `Masthead` | `Double rule under (2px ink).` | ``The `masthead-rule` under it: 2px ink, 2px paper, 1px teal (ADR-047).`` |
| `SiteFooter` | `Ruled footer:` | `Solid teal band (paper text and links, paper focus outline; ADR-047):` |
| `SectionRule` | `{ label, action?, className? }` | `{ label, action?, as?, tone?, className? }` |
| `SectionRule` | `when the content is a bare label, not a form.` | ``when the content is a bare label, not a form. `tone="teal"` (teal rule and label) marks the homepage registry box.`` |
| `Ballot` | `` `ink` for others `` | `` `teal` for others (`ink` still accepted) `` |
| `MobileBackHeader` | `2px ink rule.` | ``the `masthead-rule`.`` |

- [ ] **Step 4: ADR-047**

First check that ADR-047 is still free: `git fetch origin && git show origin/main:DECISIONS.md | grep -n "^## ADR-04"`. If main already has ADR-047, use the next free number here and in every `ADR-047` reference added by Tasks 1–6 (`grep -rn "ADR-047" app components DESIGN.md CHANGELOG.md docs`).

Append to `DECISIONS.md`:

```markdown
## ADR-047 (2026-10-08): Teal is Kronika's second colour

Spec: `docs/superpowers/specs/2026-10-08-teal-secondary-color-design.md`. Plan:
`docs/superpowers/plans/2026-10-08-teal-secondary-color.md`. No migration, no new variable.

- **Decision.** The owner compared three brand directions and chose to keep Kronika and add
  teal `#235B59` (hover `#1A4644`) as a second colour. Red acts (links, active nav, №1, focus,
  primary hover, danger); teal informs (homepage registry figures and rule, supporter chip,
  non-leading poll bars, the my-delegate call-out border, `dark` buttons, a 1px line in the
  masthead rule, the footer band).
- **No tinted panels.** The exploration board's light-teal registry panel was rejected; there is
  no teal tint token. The footer is the one solid teal area.
- **Masthead rule as a border.** `masthead-rule` paints 2px ink, 2px paper, 1px teal as one
  gradient border image. A positioned overlay would have changed the header's `position`, which
  three e2e checks pin; a box-shadow would hide under any following sibling with a background.
- **Accessibility.** Teal/paper 6.9:1 both ways. Red and teal are equally dark (1.00:1), so the
  footer's links use a paper focus outline, and a leading poll answer is never shown by colour
  alone (longest bar, percentage).
- **Rejected.** Directions 2 (Agora) and 3 (Republic 1918) from the board: full re-skins, kept
  for later. A teal tint for information panels: owner preference.
```

- [ ] **Step 5: CHANGELOG**

Prepend under `# Changelog`:

```markdown
## Unreleased - A second colour (2026-10-08)

The site keeps its newspaper look and gains a second colour, teal, next to the red.

- Red still marks things you do: links, buttons, the active menu item, the No. 1 delegate.
- Teal marks things you read: the live numbers on the homepage, the supporter label, the
  poll answers that are not leading, your delegate's card, and the search buttons in admin.
- A thin teal line now runs under the black line at the top of every page, and the footer is a
  teal band.
- Every text colour pair passes the standard readability check. Links in the teal footer show a
  light outline when you move through them with the keyboard, because the usual red outline
  would not be visible on teal.
```

- [ ] **Step 6: Verify and commit**

Run: `npx --no-install prettier --write "app/(public)/styleguide/page.tsx" DESIGN.md DECISIONS.md CHANGELOG.md`
Run: `npx --no-install tsc --noEmit && npx --no-install vitest run`
Expected: types clean; the whole unit suite passes.

```bash
node scripts/ka-gate.mjs --diff main "app/(public)/styleguide/page.tsx" DESIGN.md DECISIONS.md CHANGELOG.md
npm run ka:scan
git add "app/(public)/styleguide/page.tsx" DESIGN.md DECISIONS.md CHANGELOG.md
git commit -m "Document the teal second colour and show it in the styleguide" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Full gates, visual check, PR and sign-off

**Files:** none changed unless a gate fails (fix in the owning task's files, with a test).

- [ ] **Step 1: Full local gates**

```bash
npx --no-install tsc --noEmit
npx --no-install eslint .
npx --no-install prettier --check .
npx --no-install vitest run
npm run ka:scan
cp "../../../.env.local" .env.local
npx --no-install next build
```

Expected: all pass. `git status --porcelain` must not list `.env.local` (gitignored).

- [ ] **Step 2: Whole-branch code review**

Run the whole-branch review (CLAUDE.md: independent per-task reviews plus a whole-branch review) against the spec. Fix findings test-first.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin claude/platform-branding-design-5f4d1c
gh pr create --base main --title "Teal second colour (ADR-047)" --body-file "$SCRATCHPAD/pr-body.md"
```

`$SCRATCHPAD` is the session's scratchpad directory. Write the body there first; never commit it. The PR body: a plain-language summary (from the CHANGELOG entry), the spec and plan paths, "no migration, no new env var; merging ships to both sites", and `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Then bind the PR with the ccd_pr tools and wait for CI (`quality`, including e2e) to go green. Never merge red.

- [ ] **Step 4: /qa on the Vercel preview, with screenshots**

On the republic-portal preview URL, screenshot desktop (1366) and phone (390):
- `/`: masthead line (ink, gap, teal), the teal registry box (no fill), the teal footer; Tab through the footer links and confirm the paper focus outline.
- `/styleguide`: palette, contrast pairs, the `dark (teal)` button row, the teal SectionRule copy, the `callout-teal` card with the supporter chip, the teal poll bar.
- `/me/profile` as a seeded member: the teal-bordered my-delegate card.
- `/me/polls` after voting: leading bar red, others teal.
- `/admin` as admin: region bars (first red, others teal) and a teal search button on `/admin/members`.
- One detail page on the phone (for example `/news/<slug>`): the back header carries the same rule.

- [ ] **Step 5: Owner sign-off**

Send the owner the preview URL, the screenshots, and a plain-language list of what changed. Wait for an explicit yes in chat. Owner interrupts are hard checkpoints.

- [ ] **Step 6: Merge and verify**

After sign-off: recheck that main's last ADR is still below 045, then merge the PR. Then verify the real site, georgia-republic.vercel.app: the commit status, and a curl or screenshot of `/` showing the teal footer. If Vercel's daily deploy limit blocks the release, say so and use the manual fallback recipe from the real-production-site notes.

---

## Review follow-ups (applied after the independent review, 2026-10-08)

The whole-branch review found no critical issues. These changes followed it, each test-first:

- **Poll leaders are decided on votes, not percentages.** New pure `leadingOptions(votes)` in
  `lib/community.ts` (tested in `lib/community.test.ts`). `percentages()` uses largest-remainder
  rounding, so a 1/1/1 tie became 34/33/33 and showed one false leader. `PollCard` and the admin
  poll page (`app/(admin)/admin/content/polls/[id]/page.tsx`, previously all red) both use it.
- **The open phone menu's header row** (`components/MobileMenu.tsx`) still had the old 2px ink
  rule. It now uses `masthead-rule` (test in `components/MobileMenu.test.tsx`).
- **Footer link hover** thickens the underline (`hover:decoration-2`) instead of the near-invisible
  paper-to-surface colour change (1.09:1).
- **The masthead rule's gap is transparent**, so it shows the header's own background instead of
  painting paper over a bright card (the styleguide demo).
- **Docs:** call-out sentence in DESIGN.md Materials, the CSV export as a `dark` call site, the e2e
  count (eight `position` checks, not three), CHANGELOG wording, and two stale code comments.
- **Renumbered to ADR-047.** PR #46 (security hardening) took ADR-045 and PR #45 (production
  admin grant) took ADR-046 before this merged; every reference in this work now reads ADR-047.
