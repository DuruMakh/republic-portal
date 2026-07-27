# Owner Fix List — Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the seven "straight fixes" from the owner's 2026-07-27 "What to FIX" doc (items 1, 4, 6, 7, 8a, 14, 15) plus item 10 as clarified by the owner on 2026-07-28: the personal ID is no longer asked at first registration (/join) and is asked instead when a registered person becomes a member (the membership wizard).

**Architecture:** All work lands on the current branch (`claude/portal-edits-review-cce8bc`), one commit per task. Two new design-system components (`Select`, `SelectField`) replace every native `<select>`; one additive migration completes the `cities` table; everything else is surgical edits to existing components/pages. No new dependencies, no schema changes beyond the one seed-style insert migration.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Supabase, vitest + @testing-library/react, Playwright.

**Spec source:** Owner Google Doc "What to FIX" (2026-07-27) + owner chat clarification of item 10 (2026-07-28): "in first registration we don't need to ask ID number. and ID number should be asked when person is trying to register as a member." Item numbers below refer to that doc. Out of scope by owner instruction: item 16 (admin city filter + აქტიური/წევრი wording), items 2/3/5/8b/9/11/12/13.

## Global Constraints

- All user-facing text is Georgian and **byte-spliced, never hand-typed** (DESIGN.md Georgian integrity gate). After every task that touches Georgian copy: `node scripts/ka-gate.mjs --diff main <touched files>`.
- The one NEW Georgian string in this plan, spliced from the owner doc item 15: `არ მყავს დელეგატი`. Copy it from this plan file (which spliced it from the doc), never retype it.
- TypeScript strict. No `any`, no `@ts-ignore`. No new dependencies.
- DB changes only via `supabase/migrations/`. Never mutate data by hand.
- Component contracts are frozen — changes are **additive props only**; any component change updates `/styleguide` and DESIGN.md **in the same task** (DESIGN.md rule).
- TDD: failing test first for every behavior change. (Tasks 5's pure copy deletion uses a grep gate instead — stated inline.)
- Commit messages: write to a temp file and use `git commit -F <file>` — `git commit -m` mangles multi-line messages in this PowerShell environment.
- Per-task verification: `npx vitest run <test file>`, then `npm test`, `npm run typecheck`, `npm run lint` before each commit.
- This worktree starts without `node_modules` or `.env.local` (Task 0 fixes that). Wrappers can exit 0 while dying — eyeball actual test output, don't trust bare exit codes.

---

### Task 0: Worktree setup + green baseline

**Files:** none (environment only)

- [ ] **Step 1: Install dependencies**

Run: `npm install` (in the worktree root)
Expected: completes without errors; `node_modules/` exists.

- [ ] **Step 2: Copy env from the primary checkout**

```powershell
Copy-Item "C:\Users\Mylaptop\Desktop\Claude\Geo Republic Portal\.env.local" ".env.local"
```

- [ ] **Step 3: Baseline gates**

Run: `npm test` then `npm run typecheck`
Expected: both PASS (baseline green before any edit). If not green, STOP and report — do not build on a red baseline.

---

### Task 1: `Select` + `SelectField` design-system components (doc item 1)

The owner's screenshot shows the raw OS `<select>` (region filter). The prototype's contract look (kronika-d3-template.html:557,651) is the underline field. Fix: a native `<select>` styled with `appearance-none` + our own ▾ chevron, in the two existing densities (`inputClasses` / `adminControlClasses`). The **open** option list stays OS-native (GOV.UK-style trade-off — documented; a custom listbox is a follow-up only if the owner still dislikes the preview).

**Files:**
- Create: `components/Select.tsx`
- Test: `components/Select.test.tsx`
- Modify: `app/(public)/styleguide/page.tsx` (Card 9, lines ~222–232)
- Modify: `DESIGN.md` (furniture table)

**Interfaces:**
- Consumes: `inputClasses`, `adminControlClasses` from `components/Field.tsx`.
- Produces: `Select({ variant?: "form" | "admin", className?, ...SelectHTMLAttributes })` — bare styled select (chevron wrapper takes `className` for widths). `SelectField({ label: string, error?: string, variant?, id?, ...SelectHTMLAttributes })` — labeled select mirroring `Field`'s label/error contract exactly. Task 2 swaps every call site onto these.

- [ ] **Step 1: Write the failing test** — `components/Select.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select, SelectField } from "./Select";

describe("Select", () => {
  it("renders a native select with options and a decorative chevron", () => {
    const { container } = render(
      <Select aria-label="მხარე" defaultValue="">
        <option value="">ყველა მხარე</option>
        <option value="1">თბილისი</option>
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "მხარე" });
    expect(select.className).toContain("appearance-none");
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("▾");
  });

  it("admin variant uses the dense control classes", () => {
    render(
      <Select variant="admin" aria-label="მხარე">
        <option>ყველა მხარე</option>
      </Select>,
    );
    expect(screen.getByRole("combobox").className).toContain("text-[0.84rem]");
  });
});

describe("SelectField", () => {
  it("associates the label and renders the error with aria-invalid", () => {
    render(
      <SelectField label="მხარე" error="აირჩიე მხარე" defaultValue="">
        <option value="">აირჩიე მხარე</option>
      </SelectField>,
    );
    const select = screen.getByLabelText("მხარე");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("აირჩიე მხარე", { selector: "p" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run components/Select.test.tsx` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `components/Select.tsx`:

```tsx
import { useId, type SelectHTMLAttributes } from "react";
import { adminControlClasses, inputClasses } from "@/components/Field";

/**
 * Kronika select (owner fix list #1): native <select> semantics (OS picker,
 * mobile wheels, full keyboard a11y) under the underline-field dress —
 * appearance-none removes the OS chrome, the ▾ glyph is ours. The OPEN option
 * list stays OS-native by design; revisit as a custom listbox only if the
 * owner still dislikes it on preview.
 */
export function Select({
  variant = "form",
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { variant?: "form" | "admin" }) {
  const base = variant === "admin" ? adminControlClasses : inputClasses;
  return (
    <span
      className={`relative ${variant === "admin" ? "inline-block" : "block w-full"} ${className}`}
    >
      <select {...props} className={`${base} w-full appearance-none pr-7`}>
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[0.74rem] text-muted-fg"
      >
        ▾
      </span>
    </span>
  );
}

/** Labeled select — mirrors Field's label/error contract exactly (same classes). */
export function SelectField({
  label,
  error,
  id: idProp,
  variant,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  variant?: "form" | "admin";
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="block text-[0.74rem] font-bold tracking-[.08em] text-muted-fg mb-1"
      >
        {label}
      </label>
      <Select id={id} aria-invalid={error ? true : undefined} variant={variant} {...props}>
        {children}
      </Select>
      {error ? <p className="mt-1 text-[0.74rem] text-brand">{error}</p> : null}
    </div>
  );
}
```

(No `"use client"` — no event handlers inside; `useId` works in RSC, matching `Field.tsx`.)

- [ ] **Step 4: Run tests** — `npx vitest run components/Select.test.tsx` — Expected: PASS.

- [ ] **Step 5: Styleguide entry** — in `app/(public)/styleguide/page.tsx`, inside Card `title="ფორმის ველი"` after the `adminControlClasses` input, add (splice the option strings from `components/DelegateDirectory.tsx` / seed):

```tsx
            <SelectField label="მხარე" defaultValue="">
              <option value="">ყველა მხარე</option>
              <option value="1">თბილისი</option>
              <option value="2">აჭარა</option>
            </SelectField>
            <Select variant="admin" aria-label="მხარე" defaultValue="">
              <option value="">ყველა მხარე</option>
              <option value="1">თბილისი</option>
            </Select>
```

Add the import: `import { Select, SelectField } from "@/components/Select";`

- [ ] **Step 6: DESIGN.md** — add one row to the furniture table:

```markdown
| `Select` / `SelectField` | `{ variant?: "form"·"admin", className? }` / `+ { label, error? }` | Underline select: native `<select>` with `appearance-none` + ▾ chevron, form density = `inputClasses`, admin density = `adminControlClasses`; `SelectField` mirrors `Field`'s small-caps label + brand error line. Open option list stays OS-native. Every `<select>` in the app goes through this — no bare selects. |
```

- [ ] **Step 7: Gates + commit**

Run: `npm test && npm run typecheck && npm run lint`, `node scripts/ka-gate.mjs --diff main components/Select.tsx components/Select.test.tsx "app/(public)/styleguide/page.tsx"`
Commit: `feat(design-system): add Select/SelectField underline selects (owner fix #1)`

---

### Task 2: Swap every native `<select>` onto `Select`/`SelectField` (doc item 1)

Mechanical, attribute-preserving swap of all 15 sites. Rule: keep every existing attribute (`id`, `value`, `onChange`, `aria-label`, `name`, `defaultValue`, testids) verbatim; **drop** the old `className` and move width/sizing classes (`max-w-…`, `min-w-…`, `flex-1`) into the new `className` prop (it lands on the wrapper). Sites with a hand-rolled `<label>` + `<select>` pair become one `SelectField` (label styling changes to Field's small-caps muted — intended unification; owner sees it on preview).

**Files (all Modify):**
- `components/DelegateDirectory.tsx:47` — bare `Select` (keep `aria-label="მხარე"`, `className="max-w-[280px]"`).
- `components/DelegateBinding.tsx:49` — bare `Select` (keep `aria-label="დელეგატი"`; options unchanged).
- `app/(member)/me/membership/MembershipWizard.tsx` — **delete** the local `LabeledSelect` (lines 28–59) and replace its 3 usages with `SelectField` (id/label/value/error preserved; `onChange` becomes the DOM handler form):

```tsx
            <SelectField
              label="მხარე"
              id="mw-region"
              value={regionId === null ? "" : String(regionId)}
              onChange={(e) => changeRegion(e.target.value)}
              error={errors.regionId}
            >
```

  (same pattern for `mw-city` with `onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : null)}`, and `mw-work` with `onChange={(e) => setWorkPreset(e.target.value)}`; children `<option>` blocks unchanged.)
- `app/(member)/me/profile/ProfileForm.tsx:167,187,208` — the three label+select pairs become `SelectField` (ids `profile-region`, `profile-city`, `profile-employment` kept; the `touch()` calls stay inside the handlers).
- `app/(member)/me/delegate/DelegateChange.tsx:94,111` — both pairs become `SelectField` (ids `change-region`, `change-delegate` kept; hint `<p>` stays below).
- Admin, all `variant="admin"`: `app/(admin)/admin/audit/page.tsx:109,120`, `app/(admin)/admin/members/page.tsx:99,114`, `app/(admin)/admin/admins/GrantRoleForm.tsx:85`, `app/(admin)/admin/transfer/ReassignRow.tsx:43`, `app/(delegate)/delegate/team/TeamTable.tsx:45` — replace `<select className={adminControlClasses} …>` with `<Select variant="admin" …>` keeping all other attributes and children; remove now-unused `adminControlClasses` imports.

**Interfaces:**
- Consumes: `Select`, `SelectField` from Task 1 (exact props above).
- Produces: zero bare `<select>` elements in `app/` + `components/` — Task 6 edits `DelegateBinding`/`DelegateChange` on top of this markup.

- [ ] **Step 1: Failing check** — `Grep pattern:"<select" glob:"{app,components}/**/*.tsx"` currently returns 15+ hits; after this task it must return **0** (test files may keep the word in comments).
- [ ] **Step 2: Swap the member/public sites** (DelegateDirectory, DelegateBinding, MembershipWizard, ProfileForm, DelegateChange) per the rule above.
- [ ] **Step 3: Swap the admin/delegate sites** per the rule above.
- [ ] **Step 4: Full suite** — `npm test` — Expected: PASS with **no test edits** (all existing suites query by role/label, which the swap preserves; if any test fails, the swap dropped an attribute — fix the swap, not the test).
- [ ] **Step 5: Grep gate** — re-run Step 1's grep: 0 hits in `app/` + `components/` source files.
- [ ] **Step 6: Gates + commit** — `npm run typecheck && npm run lint`, then commit: `refactor(ui): route every select through the design-system Select (owner fix #1)`

---

### Task 3: CabinetNav active state — longest match wins (doc item 7)

Owner screenshot: on the cabinet events page both „მთავარი" and „ღონისძიებები" are red. Cause: `components/CabinetNav.tsx:33` marks `/me` active via `pathname.startsWith("/me/")` on every subpage. `AdminNav.tsx:32-36` already solved this by exact-matching the root; CabinetNav gets the data-driven version (it also serves the delegate chrome, root `/delegate`).

**Files:**
- Modify: `components/CabinetNav.tsx:32-34`
- Test: `components/CabinetNav.test.tsx`

**Interfaces:** none new — pure internal fix.

- [ ] **Step 1: Make the pathname controllable in the test file.** Replace the `vi.hoisted` block and `next/navigation` mock at the top of `components/CabinetNav.test.tsx`:

```tsx
const { push, refresh, signOut, pathnameRef } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
  pathnameRef: { current: "/me/profile" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({ push, refresh }),
}));
```

In `beforeEach`, add `pathnameRef.current = "/me/profile";` (keeps all existing tests green).

- [ ] **Step 2: Add the failing tests** (labels spliced from `lib/cabinet.ts` registered-role items):

```tsx
  const REGISTERED_ITEMS = [
    { href: "/me", label: "მთავარი" },
    { href: "/me/events", label: "ღონისძიებები" },
    { href: "/me/news", label: "სიახლეები" },
    { href: "/me/profile", label: "პროფილი" },
  ];

  it("root „მთავარი“ is NOT marked on sibling subpages (owner fix #7)", () => {
    pathnameRef.current = "/me/events";
    render(<CabinetNav items={REGISTERED_ITEMS} />);
    expect(screen.getByRole("link", { name: "ღონისძიებები" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "მთავარი" })).not.toHaveAttribute("aria-current");
  });

  it("root „მთავარი“ is marked on /me itself and on subroutes no other item claims", () => {
    pathnameRef.current = "/me";
    const first = render(<CabinetNav items={REGISTERED_ITEMS} />);
    expect(screen.getByRole("link", { name: "მთავარი" })).toHaveAttribute("aria-current", "page");
    first.unmount();
    pathnameRef.current = "/me/membership";
    render(<CabinetNav items={REGISTERED_ITEMS} />);
    expect(screen.getByRole("link", { name: "მთავარი" })).toHaveAttribute("aria-current", "page");
  });
```

- [ ] **Step 3: Run** — `npx vitest run components/CabinetNav.test.tsx` — Expected: first new test FAILS (both items carry `aria-current`).

- [ ] **Step 4: Implement.** In `CabinetNav.tsx`, above the `return`, compute the winner; inside the map use it:

```tsx
  // Longest matching href wins (owner fix list #7): „მთავარი" (/me) is a
  // prefix of every cabinet route, so bare prefix-matching kept it lit on
  // every page. Same rule AdminNav hardcodes for /admin, made data-driven —
  // this nav also serves the delegate chrome, whose root is /delegate.
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  let activeHref: string | null = null;
  for (const item of items) {
    if (matches(item.href) && (activeHref === null || item.href.length > activeHref.length)) {
      activeHref = item.href;
    }
  }
```

and replace line 33 with `const active = item.href === activeHref;`

- [ ] **Step 5: Run** — `npx vitest run components/CabinetNav.test.tsx` — Expected: PASS (all, including the pre-existing five).
- [ ] **Step 6: Gates + commit** — `npm test && npm run typecheck && npm run lint`; commit: `fix(cabinet): only the deepest-matching nav item is active (owner fix #7)`

---

### Task 4: Remove the „§2. ტელეფონის ნომერი" heading on /join (doc item 6)

Owner clarified 2026-07-28: remove the **section heading itself** (`app/(public)/join/JoinForm.tsx:245-247`). The field's own label right under it stays and alone names the input — no `Field` component change, no design-system change. Consequence handled in the same breath: with §2 gone, „§1." would number a lone section, so the first heading (`JoinForm.tsx:211-213`) drops its prefix and reads plain „პირადი მონაცემები" (it now covers the whole short form — name, surname, phone once Task 9 lands). Owner sees both on the preview and can veto the §1 half.

**Files:**
- Modify: `app/(public)/join/JoinForm.tsx:211-213, 245-247`
- Test: `app/(public)/join/JoinForm.test.tsx`

**Interfaces:** none — copy-only change, no component API touched.

- [ ] **Step 1: Failing test** — add to `JoinForm.test.tsx` (reuse the file's existing render/setup exactly as the neighboring tests do):

```tsx
  it("no phone section heading — the field's own label names it (owner fix #6)", () => {
    // render JoinForm exactly as the first existing test in this file does
    expect(
      screen.queryByRole("heading", { name: /ტელეფონის ნომერი/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "პირადი მონაცემები" })).toBeInTheDocument();
    expect(screen.getByLabelText("ტელეფონის ნომერი")).toBeInTheDocument();
  });
```

Run: `npx vitest run "app/(public)/join/JoinForm.test.tsx"` — Expected: FAIL (the §2 heading renders; the §1 heading still carries the prefix).

- [ ] **Step 2: Implement.** In `JoinForm.tsx`: delete the whole `<h2>` block at lines 245-247 (`§2. ტელეფონის ნომერი`); change the heading text at line 212 from `§1. პირადი მონაცემები` to `პირადი მონაცემები` (delete the prefix only — the Georgian words are the existing bytes, untouched).
- [ ] **Step 3: Run** — `npx vitest run "app/(public)/join/JoinForm.test.tsx"` — Expected: PASS, including all pre-existing `getByLabelText("ტელეფონის ნომერი")` tests (the field label was never touched).
- [ ] **Step 4: Gates + commit** — `npm test && npm run typecheck && npm run lint`; `node scripts/ka-gate.mjs --diff main "app/(public)/join/JoinForm.tsx" "app/(public)/join/JoinForm.test.tsx"`; commit: `fix(join): drop the duplicated phone section heading (owner fix #6)`

---

### Task 5: Remove the „💾 მონაცემები ინახება ავტომატურად" note (doc item 8a)

Owner: the note is unnecessary — delete it. Behavior (draft autosave) stays; only the caption goes.

**Files:**
- Modify: `app/(member)/me/membership/MembershipWizard.tsx:329` (delete the whole `<p>` line)

- [ ] **Step 1: Delete the line.** (TDD exception, stated: pure copy deletion with no behavior — verified by grep + the full suite + preview sign-off instead of a new unit test; a bespoke wizard render harness just to assert an absent string would outweigh the change.)
- [ ] **Step 2: Verify** — Grep `ინახება ავტომატურად` over `app/` + `components/`: **0 hits**. `npm test`: PASS (no suite asserts the note).
- [ ] **Step 3: Commit** — `fix(membership): drop the autosave caption (owner fix #8)`

---

### Task 6: „ცენტრალური მოძრაობა" → „არ მყავს დელეგატი" on member surfaces (doc item 15)

The no-delegate default renders as „ცენტრალური მოძრაობა" everywhere. Owner: member-facing copy should read `არ მყავს დელეგატი` (splice from Global Constraints). **Scope: member-facing only.** Admin table (`app/(admin)/admin/members/page.tsx:185`) and CSV export (`lib/csv.ts:71`) keep the old term — admin vocabulary is doc item 16, deferred with the აქტიური/წევრი wording decision. DB semantics (`delegate_id = null`) untouched.

**Files:**
- Modify: `components/DelegateBinding.tsx:56` (picker option)
- Modify: `app/(member)/me/delegate/DelegateChange.tsx:118` (both branches of the ternary keep their shape: `"არ მყავს დელეგატი (მიმდინარე)"` / `"არ მყავს დელეგატი"`)
- Modify: `app/(member)/me/delegate/page.tsx:90` (current-delegate display)
- Modify: `app/(member)/me/profile/page.tsx:267` (profile display)
- Modify: `app/(member)/me/membership/done/page.tsx:41` (done-page display)
- Test: `components/DelegateBinding.test.tsx:33`, `app/(member)/me/delegate/DelegateChange.test.tsx:46`
- Test (e2e, asserted in Task 9's sweep): `e2e/cabinet.spec.ts:51`, `e2e/membership.spec.ts:57`
- Modify: `DESIGN.md` DelegateBinding row („ცენტრალური მოძრაობა" default row → the new label)

**Interfaces:** none — `value="central"` / `null` semantics unchanged; only display strings.

- [ ] **Step 1: Failing tests first.** Update `DelegateBinding.test.tsx:33` to `expect(items[0]).toHaveTextContent("არ მყავს დელეგატი");` and `DelegateChange.test.tsx:46` to the new string (keep the ` (მიმდინარე)` suffix exactly as the fixture's `currentDelegateId` dictates — if the fixture renders the current-central branch, expect `"არ მყავს დელეგატი (მიმდინარე)"`).
Run: `npx vitest run components/DelegateBinding.test.tsx "app/(member)/me/delegate/DelegateChange.test.tsx"` — Expected: FAIL (old label rendered).
- [ ] **Step 2: Swap the five display strings** listed under Files (splice the new label; leave `admin/members` and `lib/csv.ts` untouched).
- [ ] **Step 3: Run** — same vitest command — Expected: PASS.
- [ ] **Step 4: Update the two e2e assertions** (`cabinet.spec.ts:51`, `membership.spec.ts:57`) to the new label — they run in Task 9.
- [ ] **Step 5: Gates + commit** — `npm test && npm run typecheck && npm run lint`; `node scripts/ka-gate.mjs --diff main` over all six touched tsx files + both spec files; DESIGN.md row updated; commit: `fix(copy): no-delegate default reads „არ მყავს დელეგატი“ on member surfaces (owner fix #15)`

---

### Task 7: News visuals — lead/tile list + bounded article hero (doc item 4)

Owner: the news list page "არ ვარგა", and inside an article the image "ძაან მედიდება". Kronika spec §4.5 already frames the list as front-page briefs; we add presence: newest article becomes a full-width **lead** (cover on top, serif 3xl headline), the rest a 2-column **tile** grid. The article hero gets a bounded height with PhotoFigure's dress (stays a raw `<img>` — Supabase host isn't in the next/image allowlist; NewsCard precedent). Cabinet `/me/news` keeps the current **row** look (default variant — zero call-site changes there).

**Files:**
- Modify: `components/NewsCard.tsx` (additive `variant?: "row" | "lead" | "tile"`, default `"row"`)
- Test: `components/NewsCard.test.tsx`
- Modify: `app/(public)/news/page.tsx:26-39`
- Modify: `app/(public)/news/[slug]/page.tsx:52-59`
- Modify: `app/(public)/styleguide/page.tsx` (section 15: add lead + tile demos)
- Modify: `DESIGN.md` (NewsCard row)

**Interfaces:**
- Produces: `NewsCard` accepts `variant?: "row" | "lead" | "tile"`. All existing props unchanged.

- [ ] **Step 1: Failing tests** — append to `components/NewsCard.test.tsx` (splice strings from the file's existing fixtures):

```tsx
  it("lead variant renders the cover on top with a 3xl serif headline", () => {
    const { container } = render(
      <NewsCard
        variant="lead"
        href="/news/testi"
        title="სატესტო სიახლე"
        publishedAt="19.07.2026"
        imageUrl="https://x.supabase.co/storage/v1/object/public/news-images/a.png"
        excerptText="მოკლე შინაარსი…"
      />,
    );
    expect(screen.getByRole("heading").className).toContain("text-3xl");
    expect(container.querySelector("img")!.className).toContain("aspect-[2/1]");
  });

  it("tile variant renders the cover on top at 3:2", () => {
    const { container } = render(
      <NewsCard
        variant="tile"
        href="/news/testi"
        title="სატესტო სიახლე"
        publishedAt="19.07.2026"
        imageUrl="https://x.supabase.co/storage/v1/object/public/news-images/a.png"
        excerptText="მოკლე შინაარსი…"
      />,
    );
    expect(container.querySelector("img")!.className).toContain("aspect-[3/2]");
  });
```

Run: `npx vitest run components/NewsCard.test.tsx` — Expected: FAIL (unknown prop / row markup).

- [ ] **Step 2: Implement `NewsCard`.** Keep the current markup verbatim as the `"row"` branch; add the stacked branch:

```tsx
export function NewsCard({
  href,
  title,
  publishedAt,
  imageUrl,
  excerptText,
  pill,
  variant = "row",
}: {
  href: string;
  title: string;
  publishedAt: string;
  imageUrl: string | null;
  excerptText: string;
  pill?: ReactNode;
  /** row = cabinet/homepage brief (default) · lead = full-width opener · tile = grid card */
  variant?: "row" | "lead" | "tile";
}) {
  if (variant === "row") {
    return (
      /* …existing markup, byte-identical… */
    );
  }
  const lead = variant === "lead";
  return (
    <Link href={href} className="group flex flex-col gap-3 border-b border-hairline pb-5 no-underline">
      {imageUrl ? (
        // Same raw-<img> rationale as the row thumb (Supabase host not in the
        // next/image allowlist); PhotoFigure's border dress, bounded by ratio.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={title}
          className={`${lead ? "aspect-[2/1]" : "aspect-[3/2]"} w-full border border-hairline object-cover`}
        />
      ) : null}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>სიახლეები</Eyebrow>
          {pill}
        </div>
        <h3
          className={`mt-1 font-serif font-bold text-ink group-hover:text-brand ${
            lead ? "text-3xl" : "text-lg"
          }`}
        >
          {title}
        </h3>
        <p className="mt-1 text-[0.74rem] text-muted-fg">{publishedAt}</p>
        <p className={`mt-1 text-sm text-muted-fg ${lead ? "" : "line-clamp-2"}`}>{excerptText}</p>
      </div>
    </Link>
  );
}
```

(The row branch's `<h3>` has no `role="heading"` issue — `getByRole("heading")` finds `h3` natively.)

- [ ] **Step 3: Run** — `npx vitest run components/NewsCard.test.tsx` — Expected: PASS (old two tests included).

- [ ] **Step 4: Recompose `/news`.** In `app/(public)/news/page.tsx` replace the list block (keep the empty state exactly):

```tsx
        <>
          <SectionRule label="სიახლეები" className="mt-8" />
          <div className="mt-6">
            <NewsCard
              variant="lead"
              key={news[0]!.id}
              href={`/news/${news[0]!.slug}`}
              title={news[0]!.title}
              publishedAt={formatDateKa(news[0]!.published_at)}
              imageUrl={news[0]!.image_url}
              excerptText={excerpt(news[0]!.body)}
            />
          </div>
          {news.length > 1 ? (
            <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {news.slice(1).map((n) => (
                <NewsCard
                  variant="tile"
                  key={n.id}
                  href={`/news/${n.slug}`}
                  title={n.title}
                  publishedAt={formatDateKa(n.published_at)}
                  imageUrl={n.image_url}
                  excerptText={excerpt(n.body)}
                />
              ))}
            </div>
          ) : null}
        </>
```

(`news[0]!` is safe — the branch is behind `news.length === 0`; `fetchPublicNews` orders `published_at desc`, so `[0]` is newest.)

- [ ] **Step 5: Bound the article hero.** In `app/(public)/news/[slug]/page.tsx:57` change the img className to:

```tsx
            className="mt-6 max-h-[420px] w-full border border-hairline object-cover"
```

- [ ] **Step 6: Styleguide + DESIGN.md.** Section 15: add two Cards demoing `variant="lead"` and `variant="tile"` (reuse the existing NewsCard demo's props, splice its strings). DESIGN.md NewsCard row: append „variants: `row` (brief, default) · `tile` (grid card, cover top 3:2) · `lead` (full-width opener, cover 2:1, serif 3xl)".
- [ ] **Step 7: Visual check** — `npm run dev`, open `/news` and one article (staging has seeded news), confirm the lead/tile layout and that the article image stops at 420px.
- [ ] **Step 8: Gates + commit** — `npm test && npm run typecheck && npm run lint`; ka-gate touched files; commit: `feat(news): lead/tile front-page layout + bounded article hero (owner fix #4)`

---

### Task 8: Complete municipalities + Tbilisi districts (doc item 14)

`cities` currently seeds 37 rows (`20260712212415_seed_regions.sql`) — a partial list. Owner: every region lists all its municipalities; Tbilisi lists all its districts. Target = the standard 64 election municipalities (region rows keep the app's existing 11-მხარე split; existing center-name style kept, e.g. სტეფანწმინდა for ყაზბეგი municipality) **plus** Tbilisi's 10 raions. The legacy `თბილისი` city row stays (existing profiles reference it). Additive insert only — no schema change, no updates, no deletes.

**Files:**
- Create: `supabase/migrations/20260727120000_complete_municipalities.sql`

**Interfaces:** none — pickers read `cities` filtered by `region_id`, ordered `name_ka` (MembershipWizard:134-139 verified; check ProfileForm's cities query does the same and add `.order("name_ka")` if missing).

- [ ] **Step 1: Write the migration** (37 new rows; `not exists` guard makes it re-run-safe and skips any name already present):

```sql
-- Owner fix list #14 (2026-07-27): regions must list ALL their municipalities,
-- Tbilisi must list all 10 raions. Completes the partial 2026-07-12 seed to the
-- standard 64 election municipalities (center-name style, matching the seed)
-- + 10 Tbilisi districts. The legacy 'თბილისი' city row stays — profiles
-- reference it. Additive only.
insert into cities (region_id, name_ka)
select r.id, v.name
from regions r
join (values
  ('თბილისი', 'გლდანი'), ('თბილისი', 'დიდუბე'), ('თბილისი', 'ვაკე'),
  ('თბილისი', 'ისანი'), ('თბილისი', 'კრწანისი'), ('თბილისი', 'მთაწმინდა'),
  ('თბილისი', 'ნაძალადევი'), ('თბილისი', 'საბურთალო'), ('თბილისი', 'სამგორი'),
  ('თბილისი', 'ჩუღურეთი'),
  ('აჭარა', 'ქედა'), ('აჭარა', 'შუახევი'), ('აჭარა', 'ხელვაჩაური'),
  ('იმერეთი', 'ბაღდათი'), ('იმერეთი', 'ვანი'), ('იმერეთი', 'თერჯოლა'),
  ('იმერეთი', 'საჩხერე'), ('იმერეთი', 'ტყიბული'), ('იმერეთი', 'წყალტუბო'),
  ('იმერეთი', 'ხარაგაული'), ('იმერეთი', 'ხონი'),
  ('კახეთი', 'ახმეტა'), ('კახეთი', 'დედოფლისწყარო'), ('კახეთი', 'ლაგოდეხი'),
  ('კახეთი', 'საგარეჯო'),
  ('ქვემო ქართლი', 'დმანისი'), ('ქვემო ქართლი', 'თეთრი წყარო'), ('ქვემო ქართლი', 'წალკა'),
  ('სამეგრელო-ზემო სვანეთი', 'აბაშა'), ('სამეგრელო-ზემო სვანეთი', 'მარტვილი'),
  ('სამეგრელო-ზემო სვანეთი', 'ჩხოროწყუ'), ('სამეგრელო-ზემო სვანეთი', 'წალენჯიხა'),
  ('სამეგრელო-ზემო სვანეთი', 'ხობი'),
  ('სამცხე-ჯავახეთი', 'ადიგენი'), ('სამცხე-ჯავახეთი', 'ასპინძა'),
  ('სამცხე-ჯავახეთი', 'ნინოწმინდა'),
  ('მცხეთა-მთიანეთი', 'თიანეთი')
) as v(region, name) on r.name_ka = v.region
where not exists (
  select 1 from cities c where c.region_id = r.id and c.name_ka = v.name
);
```

- [ ] **Step 2: Name-integrity gate (MANDATORY — the hazard here is silent homoglyphs).** Two checks before commit:
  1. Codepoint scan — every non-ASCII char in the file must be Mkhedruli:
     `node -e "const s=require('fs').readFileSync('supabase/migrations/20260727120000_complete_municipalities.sql','utf8');const bad=[...s].filter(c=>{const p=c.codePointAt(0);return p>127&&!(p>=0x10D0&&p<=0x10FF);});console.log(bad.length?['BAD',...new Set(bad)]:'OK')"` — Expected: `OK`.
  2. Cross-check the 37 names + the per-region totals against an authoritative list (WebFetch the CEC or Georgian-Wikipedia municipalities page) — expected totals per region after apply: თბილისი 11 (1 legacy + 10 raions), აჭარა 6, იმერეთი 12, კახეთი 8, ქვემო ქართლი 7, სამეგრელო-ზემო სვანეთი 9, სამცხე-ჯავახეთი 6, გურია 3, მცხეთა-მთიანეთი 4, რაჭა-ლეჩხუმი და ქვემო სვანეთი 4, შიდა ქართლი 4 — **74 total**. Any mismatch: fix the SQL, not the expectation.
  3. `node scripts/ka-gate.mjs --diff main supabase/migrations/20260727120000_complete_municipalities.sql`
- [ ] **Step 3: Apply to staging** — `npx supabase db push` (repo practice; staging is the owner-approved target).
- [ ] **Step 4: Verify live counts** — scratch script (not committed) with the anon key from `.env.local`; `cities` is anon-readable:

```js
// scratch/verify-cities.mjs — run: node --env-file=.env.local scratch/verify-cities.mjs
import { createClient } from "@supabase/supabase-js";
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: regions } = await c.from("regions").select("id, name_ka");
const { data: cities } = await c.from("cities").select("id, region_id");
console.log("total:", cities.length); // expect 74
for (const r of regions) console.log(r.name_ka, cities.filter(x => x.region_id === r.id).length);
```

Expected: totals from Step 2.2, total 74.
- [ ] **Step 5: UI spot check** — `npm run dev`: wizard/profile city picker for თბილისი shows the 10 raions (+ legacy თბილისი), აჭარა shows 6, ordered by `name_ka`.
- [ ] **Step 6: Commit** — `feat(db): complete municipalities and Tbilisi raions in cities (owner fix #14)`

---

### Task 9: Personal ID moves from /join to the membership wizard (doc item 10)

Owner (2026-07-28): the ID is NOT asked at first registration; it IS asked when a registered person becomes a member. Today it's the opposite half: `register()` requires it, the wizard deliberately skips it. The move is: `/join` = name + surname + phone only; the wizard's „იურიდიული პროფილი" step gains the ID field (only when the profile doesn't already have one — every pre-change account does); `become_member_save_profile()` validates + writes it server-side; `become_member_complete()` refuses to complete without it. `personal_id` stays immutable once set (`protect_profile_columns` untouched — the definer RPC is the only writer).

**Security notes (do not skip):**
- This narrows LB-1's registration door but does NOT close the deferred personal-ID-squatting finding — the same squat is possible at the membership step. LB-1 stays open by owner decision; do not mark it addressed.
- The restated `register()` body below **includes the ADR-021 null-phone guard** (`phone_required` when the auth user has no phone). Main's current register() lacks it; the security branch adds it in its own migration. Because THIS migration is timestamped later, omitting the guard here would silently revert the security branch's fix at merge time. Including it makes the two branches converge whichever merges first. **Say this explicitly in the PR body** so the security-branch reviewer knows.

**Files:**
- Create: `supabase/migrations/20260728100000_personal_id_at_membership.sql`
- Modify: `lib/funnel-schemas.ts` (registerSchema, membershipProfileSchema)
- Modify: `lib/funnel.ts` (`CabinetStatePresent` + `hasPersonalId`)
- Modify: `app/(public)/join/JoinForm.tsx` + `app/(public)/join/actions.ts` + `app/(public)/join/JoinForm.test.tsx`
- Modify: `app/(member)/me/membership/MembershipWizard.tsx` + `app/(member)/me/membership/actions.ts`
- Modify: `app/(member)/me/profile/ProfileForm.tsx` (PID row only when it exists)
- Modify: `e2e/funnel-helpers.ts` (+ its callers: `e2e/registration.spec.ts`, `e2e/membership.spec.ts`, `e2e/login.spec.ts`, `e2e/cabinet.spec.ts`, `e2e/delegate-panel.spec.ts` — see Step 8)

**Interfaces:**
- Consumes: existing `personalIdSchema` (funnel-schemas.ts:47-49), `DUPLICATE_PERSONAL_ID_MESSAGE` (funnel.ts:165), Field from Task 4's state.
- Produces: `registerSchema` WITHOUT `personalId`; `membershipProfileSchema` WITH `personalId: string | null`; RPC `become_member_save_profile(p_birth_date, p_region_id, p_city_id, p_employment, p_delegate_id, p_personal_id text default null)`; `cabinet_state()` payload + `hasPersonalId: boolean`; RPC `register(p_first_name, p_last_name, p_ref_code)`.

- [ ] **Step 1: Failing tests first (client side).**
  - `JoinForm.test.tsx`: change every test that fills `getByLabelText("პირადი ნომერი")` to not fill it, and add:

```tsx
  it("does not ask for a personal ID at registration (owner fix #10)", () => {
    // render JoinForm exactly as the first existing test in this file does
    expect(screen.queryByLabelText("პირადი ნომერი")).not.toBeInTheDocument();
  });
```

  Run: `npx vitest run "app/(public)/join/JoinForm.test.tsx"` — Expected: new test FAILS (field renders).

- [ ] **Step 2: The migration** — `supabase/migrations/20260728100000_personal_id_at_membership.sql`. Four functions. No table DDL: `profiles.personal_id` is already nullable with a NULL-passing CHECK and a UNIQUE that permits many NULLs (initial_schema.sql:23).

```sql
-- Owner fix list #10 (clarified 2026-07-28): the personal ID moves from first
-- registration (/join) to the become-a-member step. register() stops taking it;
-- become_member_save_profile() takes it (validated, immutable once set);
-- become_member_complete() refuses to mint a member without one. cabinet_state()
-- exposes hasPersonalId so the wizard knows whether to render the field —
-- authenticated cannot SELECT personal_id itself.
--
-- SECURITY: LB-1 (personal-ID squatting, deferred by owner 2026-07-26) is NOT
-- closed by this — the squat window moves to the membership step. The restated
-- register() body ALSO carries the ADR-021 null-phone guard (phone_required):
-- this migration outdates the security branch's register(), and omitting the
-- guard here would revert that branch's fix at merge time.

-- 1) register(): 3-arg replacement. Old 4-arg overload dropped explicitly —
--    create-or-replace with a different signature would ADD an overload and
--    leave the ID door open.
drop function register(text, text, text, text);

create function register(
  p_first_name text,
  p_last_name text,
  p_ref_code text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_ref text := nullif(btrim(coalesce(p_ref_code, ''), E' \t\r\n'), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    -- duplicate phone after OTP: a state read, never an overwrite (spec §8)
    return public.cabinet_state() || jsonb_build_object('created', false);
  end if;
  if p_first_name is null or length(btrim(p_first_name, E' \t\r\n')) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name, E' \t\r\n')) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  -- Phase 3 rider parity (20260715213000 §4.6): junk ref codes are silently dropped
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9-]{1,32}$' then
    v_ref := null;
  end if;
  -- every minted code is uppercase (gen_funnel_code alphabet, roster seeds);
  -- lowercase arrivals are hand-retyped links — normalize losslessly so the
  -- case-sensitive attribution joins (admin_members, delegate_panel) match
  v_ref := upper(v_ref);

  select case
           when u.phone is null then null
           when left(u.phone, 1) = '+' then u.phone
           else '+' || u.phone
         end
    into v_phone
    from auth.users u where u.id = v_uid;

  -- ADR-021 null-phone guard (security check-up F3): membership identity is
  -- one SMS-verified phone per person; a phoneless (email-manufactured)
  -- session must not reach 'registered'.
  if v_phone is null then
    raise exception 'phone_required';
  end if;

  begin
    insert into public.profiles (id, first_name, last_name, phone, status, signup_ref_code)
    values (
      v_uid, btrim(p_first_name, E' \t\r\n'), btrim(p_last_name, E' \t\r\n'),
      v_phone, 'registered', v_ref
    );
  exception when unique_violation then
    -- profiles_pkey: double-submit race — the row now exists, report state
    if exists (select 1 from public.profiles where id = v_uid) then
      return public.cabinet_state() || jsonb_build_object('created', false);
    end if;
    raise;
  end;

  return public.cabinet_state() || jsonb_build_object('created', true);
end $$;

grant execute on function register(text, text, text) to authenticated;
revoke execute on function register(text, text, text) from public, anon;

-- 2) become_member_save_profile(): +p_personal_id. Different signature → drop
--    the old 5-arg version first, restate grants for the new one.
drop function become_member_save_profile(date, int, int, text, uuid);
```

then the new `become_member_save_profile` — copy the current body VERBATIM from `20260721120000_progressive_registration.sql:468-524` with exactly these three insertions:

```sql
create function become_member_save_profile(
  p_birth_date date,
  p_region_id int,
  p_city_id int,
  p_employment text,
  p_delegate_id uuid default null,
  p_personal_id text default null
) returns jsonb
```

after the `invalid_city` check (line 500), insert:

```sql
  -- Owner fix #10: the ID is captured here now. Immutable once set — a
  -- provided value for a profile that already has one is IGNORED (idempotent
  -- resume), never overwritten. Uniqueness double-checked at the constraint.
  if v_profile.personal_id is null then
    if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
      raise exception 'invalid_personal_id';
    end if;
    if exists (select 1 from public.profiles pr where pr.personal_id = p_personal_id) then
      raise exception 'duplicate_personal_id';
    end if;
  end if;
```

and the `update public.profiles set` gains one line before `pending_delegate_id`:

```sql
    personal_id = coalesce(v_profile.personal_id, p_personal_id),
```

wrap that `update` in a `begin … exception when unique_violation then raise exception 'duplicate_personal_id'; end;` block (two save-profile calls can race the same ID past the pre-check). Restate grants:

```sql
grant execute on function become_member_save_profile(date, int, int, text, uuid, text) to authenticated;
revoke execute on function become_member_save_profile(date, int, int, text, uuid, text) from public, anon;
```

- [ ] **Step 3: Same migration, parts 3+4.**
  - `create or replace function become_member_complete(p_tier int)` — copy the body VERBATIM from `20260721120000_progressive_registration.sql:529-614`, adding `or v_profile.personal_id is null` to the profile-completeness check (the `if v_profile.birth_date is null or v_profile.region_id is null …` block that raises `profile_incomplete`). Same signature → no drop, grants survive.
  - `create or replace function cabinet_state()` — copy the body VERBATIM from `20260721120000_progressive_registration.sql:333-413`, adding one key to the final `jsonb_build_object`, right after `'personalIdMasked', …`:

```sql
    'hasPersonalId', v_profile.personal_id is not null,
```

  Same signature → no drop.

- [ ] **Step 4: Schemas + types (failing typecheck drives the client edits).**
  - `lib/funnel-schemas.ts`: remove `personalId: personalIdSchema,` from `registerSchema`; add `personalId: personalIdSchema.nullable(),` to `membershipProfileSchema`.
  - `lib/funnel.ts`: in `CabinetStatePresent`, after `personalIdMasked`, add:

```tsx
  /** Whether profiles.personal_id is set — the wizard renders the ID field only when false (owner fix #10). */
  hasPersonalId: boolean;
```

  Run `npm run typecheck` — Expected: FAILS in JoinForm (personalId no longer in schema) and membership actions — the exact worklist for Steps 5–6.

- [ ] **Step 5: /join stops asking.**
  - `app/(public)/join/actions.ts`: drop `p_personal_id` from the `.rpc("register", …)` payload.
  - `app/(public)/join/JoinForm.tsx`: remove `"personalId"` from `FIELD_KEYS`; remove the `personalId` state and its `<Field label="პირადი ნომერი" …>` block with the `11 ნიშნა` hint (§1 keeps name + surname; §2 phone untouched); remove the `DUPLICATE_PERSONAL_ID_MESSAGE` branch in `handleRegisterResult` (lines 92-96 — the NOT_AUTHENTICATED and generic branches stay; the retry phase itself stays) and its now-unused import; remove `personalId` from the submit payload.
  - Run: `npx vitest run "app/(public)/join/JoinForm.test.tsx"` — Expected: PASS including Step 1's new test.

- [ ] **Step 6: The wizard starts asking.**
  - `app/(member)/me/membership/actions.ts`: pass `p_personal_id: parsed.data.personalId` in the `become_member_save_profile` RPC call.
  - `MembershipWizard.tsx`: add `"personalId"` to `FIELD_KEYS`; add `const [personalId, setPersonalId] = useState("");` and `const askPersonalId = !initialState.hasPersonalId;`; in `submitProfile` include `personalId: askPersonalId ? personalId : null` in the parsed object; map the server `duplicate_personal_id` failure onto the field (mirror JoinForm's old pattern):

```tsx
    if (!result.ok) {
      if (result.error === DUPLICATE_PERSONAL_ID_MESSAGE) {
        setErrors((prev) => ({ ...prev, personalId: result.error }));
      } else {
        setFormError(result.error);
      }
      return;
    }
```

  (import `DUPLICATE_PERSONAL_ID_MESSAGE` from `@/lib/funnel`); render at the TOP of the „იურიდიული პროფილი" field stack, strings spliced from JoinForm.tsx:

```tsx
          {askPersonalId ? (
            <div className="flex flex-col gap-1.5">
              <Field
                label="პირადი ნომერი"
                name="personalId"
                inputMode="numeric"
                maxLength={11}
                placeholder="01001000000"
                value={personalId}
                onChange={(e) => setPersonalId(e.target.value)}
                error={errors.personalId}
              />
              <p className="text-xs text-muted-fg">11 ნიშნა</p>
            </div>
          ) : null}
```

  - `ProfileForm.tsx`: render the masked `პირადი ნომერი` row (the `profile-pid` block) only when the state has an ID — a registered person who hasn't reached the wizard has none, and a dots-row for a nonexistent value lies. The page passes state; gate on `hasPersonalId`.
  - Run: `npm run typecheck` — Expected: PASS.

- [ ] **Step 7: Apply + verify against staging.**
  - `npx supabase db push`
  - Scratch check (anon client, same pattern as Task 8 Step 4): calling `register` with 4 args must fail with "function does not exist"; a member's `cabinet_state()` (via the e2e service seed or a dev login) carries `hasPersonalId`.

- [ ] **Step 8: e2e follows the flow.**
  - `funnel-helpers.ts` `passRegistration` (line 115): drop the `personalId` fill (line 121) and remove `personalId` from its `opts` type; fix its callers (`registration.spec.ts:30,103`, `membership.spec.ts:39,91,123,161`, `login.spec.ts` if it calls it, `cabinet.spec.ts:29`, `delegate-panel.spec.ts:40,61`) — each caller KEEPS its `journeyPersonalId(...)` value but now passes it to the wizard fill instead (next bullet) or drops it if the journey never reaches the wizard.
  - `fillMembershipProfile` (line 174): add `personalId?: string` to opts; when provided, `await page.getByLabel("პირადი ნომერი").fill(opts.personalId)` FIRST (the field is on top). Journeys that registered via the NEW /join (no ID yet) MUST pass it; journeys resuming from service-seeded profiles that already carry `personal_id` MUST NOT (the field doesn't render — a fill would time out).
  - Service-role seed helpers (`seedCompletedMember`, and the registered-user seeder around line 270): unchanged — they mirror pre-change accounts, which legitimately hold IDs (and members must). Update the line-160 comment ("minus personalId (now captured at registration)") to the new reality.
  - The comment/spec updates are covered by the Task 10 e2e sweep — no separate run here.

- [ ] **Step 9: Gates + commit.** `npm test && npm run typecheck && npm run lint`; ka-gate over JoinForm.tsx, MembershipWizard.tsx, funnel-schemas.ts (Georgian error strings moved, none invented). Commit: `feat(funnel): ask the personal ID at membership, not at registration (owner fix #10)`

---

### Task 10: Docs, full gates, PR + preview handoff

**Files:**
- Modify: `DECISIONS.md` (append ADR-022)
- Modify: `CHANGELOG.md` (new entry at top, matching the file's existing format)

- [ ] **Step 1: ADR-022** — append to `DECISIONS.md` (keep its voice; content, not verbatim):
  - Source: owner "What to FIX" doc (2026-07-27), items 1/4/6/7/8a/14/15 + item 10 as clarified 2026-07-28 = this branch; item 16 + remaining decision-items deferred to the next round.
  - Selects stay **native** under a design-system dress (`Select`/`SelectField`); custom listbox only if the preview verdict demands it.
  - „არ მყავს დელეგატი" replaces „ცენტრალური მოძრაობა" on **member** surfaces only; admin vocabulary waits for item 16's wording decision.
  - `cities` completed to the 64 standard municipalities + 10 Tbilisi raions; legacy თბილისი row kept for FK integrity.
  - /join loses its §-numbered section headings (owner, item 6 clarification): the phone heading is deleted outright, field labels carry the naming.
  - **Personal ID at membership, not registration** (owner, item 10): /join = name+surname+phone; the wizard captures the ID, `become_member_complete()` enforces it, immutability unchanged. Recorded consequences: LB-1 (ID squatting) moves doors but stays open and deferred; the restated `register()` carries the ADR-021 null-phone guard so the later migration timestamp cannot revert the security branch's fix.
- [ ] **Step 2: CHANGELOG** — one entry summarizing the seven fixes, plain language (owner-readable).
- [ ] **Step 3: Full gates** — `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `node scripts/ka-gate.mjs --diff main` over every touched file with Georgian.
- [ ] **Step 4: e2e sweep** — `npx playwright test` from THIS worktree (deps installed in Task 0, `.env.local` copied; per the worktree hazard, confirm the runner actually executed — look for the test-count line, not just exit 0). Expected: green, including the two updated assertions from Task 6 and the reshaped registration/membership journeys from Task 9. Known flake: red-on-main e2e flake noted in memory — one retry is acceptable, a persistent failure is not.
- [ ] **Step 5: Push + PR** — push the branch, open a PR to `main` (gh CLI), body in plain language per fix with the doc-item numbers. The PR body MUST carry the Task 9 coordination note: this branch's migration restates `register()` (now 3-arg, with the ADR-021 null-phone guard) — the security branch also rewrites `register()`, and whichever merges second must reconcile. **Never merge** — CI must be green, then the Vercel preview URL goes to the owner for /qa + sign-off. STOP at that point (owner checkpoint).

---

## Self-Review (done at plan time)

- **Spec coverage:** doc item 1 → Tasks 1–2; item 4 → Task 7; item 6 → Task 4; item 7 → Task 3; item 8a → Task 5; item 10 → Task 9; item 14 → Task 8; item 15 → Task 6. Deliberately excluded: item 16 (owner said "first 7"; also entangled with the აქტიური/წევრი wording decision), items 2/3/5/8b/9/11/12/13 (decision/spec work, next round).
- **Placeholder scan:** Task 2's admin swaps and Task 10's ADR give a deterministic transformation/content list rather than verbatim file bodies; Task 9's `become_member_complete`/`cabinet_state` restatements are verbatim-copy-plus-shown-insertion from named line ranges — the rule is fully specified; everything else carries exact code.
- **Type consistency:** `Select`/`SelectField` prop names match between Task 1 (definition), Task 2 (usage), styleguide; `variant` values `"form" | "admin"`; NewsCard `variant` values `"row" | "lead" | "tile"` consistent across Task 7 steps; Task 9's `hasPersonalId` name matches across cabinet_state SQL, `CabinetStatePresent`, and the wizard's `askPersonalId` gate; the new RPC signatures match between the migration and both actions files.
- **Known cross-task file overlaps (why order matters):** MembershipWizard (Tasks 2, 5, 9), JoinForm (Tasks 4, 9), ProfileForm (Tasks 2, 9), DelegateBinding/DelegateChange (Tasks 2, 6), funnel-helpers (Tasks 6, 9), styleguide + DESIGN.md (Tasks 1, 6, 7). Sequential execution on one branch resolves all of them.
