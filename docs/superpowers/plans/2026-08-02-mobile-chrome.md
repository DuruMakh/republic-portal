# Mobile Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app real mobile navigation — three headers, a full-screen public menu, a sticky join CTA, and a cabinet tab bar with an overflow sheet — without touching a single page body or the desktop layout.

**Architecture:** All route→chrome decisions are pure functions in `lib/mobile-nav.ts` (no React imports), unit-tested in isolation. Five new presentational components consume them. Every mobile bottom bar renders through one `StickyBar`, which uses `position: sticky` rather than `fixed` so it occupies layout space and can never occlude page content. Everything new is `md:hidden`; everything existing gains `hidden md:flex`. Desktop output at ≥768px is unchanged.

**Tech Stack:** Next.js App Router (server + client components), TypeScript strict, Tailwind v4 (`@theme` tokens in `app/globals.css`), vitest + @testing-library/react, Playwright.

## Global Constraints

Every task's requirements implicitly include this section.

- **TypeScript strict. No `any`, no `@ts-ignore`.** (CLAUDE.md)
- **Domain logic = pure functions in `lib/`, no React/Next imports.** UI in `components/`. (CLAUDE.md)
- **Never restyle ad hoc.** Reuse or extend a design-system component; anything new gets a `/styleguide` entry in the same change. (DESIGN.md)
- **Minimum text size 0.74rem (~11.8px).** No micro-print below it. The reference prototype's 10.8px tab labels violate this and must not be copied. (DESIGN.md §2.3)
- **Focus-visible is a 2px `brand` outline, offset 2px, on every interactive element** — already global in `app/globals.css`; do not override it.
- **Georgian is never hand-retyped — splice bytes from source.** Models silently substitute homoglyphs; `\uXXXX` escapes corrupt just as literal glyphs do. Task 1 produces `scratch/mobile-strings.txt` for exactly this; copy bytes from it, never from this plan document. **This plan is not a splice source.**
- **Both Georgian gates run over every touched file before each commit:**
  ```
  node scripts/ka-gate.mjs --diff main <files>
  npm run ka:scan
  ```
- **CI runs five gates:** `lint`, `format:check`, `typecheck`, `test`, `build`. `format:check` and `build` are the ones that bite — run `npm run format` before committing.
- **Never push directly to main.** Work stays on `claude/mobile-ui-ux-brainstorm-c82af0`.
- **Adding a dependency requires a `DECISIONS.md` entry.** This plan adds none — the focus trap is ~20 lines of local code rather than a library.
- **Design tokens only.** `brand` `#9f1d35`, `ink` `#1a1611`, `paper` `#f7f2e9`, `line`/`hairline` `#c9bfac`. No new tokens, no new palette values.

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `lib/mobile-nav.ts` | Every route→chrome decision. Pure. The single source of truth for which header, which bottom bar, which tabs. |
| `lib/mobile-nav.test.ts` | Unit tests for the above. |
| `lib/nav-active.ts` | The longest-match active-nav rule (owner fix #7), extracted from `CabinetNav` so the desktop nav and the tab bar cannot drift apart. |
| `lib/nav-active.test.ts` | Unit tests for the above. |
| `components/StickyBar.tsx` | The one mobile bottom-bar shell. Makes two bottom bars structurally impossible. |
| `components/MobileBackHeader.tsx` | `← უკან` + red context label. |
| `components/MobileMenu.tsx` | Full-screen public navigation overlay + its trigger button. |
| `components/MobileJoinCta.tsx` | Session-aware sticky join / cabinet CTA. |
| `components/MobileTabBar.tsx` | Cabinet 5-slot bar. |
| `components/MobileMoreSheet.tsx` | Overflow bottom sheet. |
| `components/useSignOut.ts` | Sign-out callback shared by `CabinetNav` and `MobileMoreSheet` (extraction, not duplication). |
| `e2e/mobile-chrome.spec.ts` | Playwright coverage at 390×844. |
| plus a `*.test.tsx` beside each new component | |

**Modified**

| File | Change |
| --- | --- |
| `app/layout.tsx` | Add the `viewport` export. Without it every safe-area inset evaluates to 0. |
| `components/Masthead.tsx` | Below `md`: back header on detail routes, menu button elsewhere. Props unchanged. |
| `components/CabinetNav.tsx` | `hidden md:flex`; sign-out moves to the shared hook. |
| `app/(public)/layout.tsx`, `app/(member)/layout.tsx`, `app/(delegate)/layout.tsx` | Render the bars. |
| `app/(public)/styleguide/page.tsx`, `DESIGN.md`, `DECISIONS.md` | Document the new furniture. |

**Not touched:** any page body, anything under `app/(admin)`, `components/PageSheet.tsx` (the sticky approach removes the need), `lib/cabinet.ts`.

## Spec refinements

Three corrections to `docs/superpowers/specs/2026-08-02-mobile-chrome-design.md`, all adopted here:

1. **§4.1 / §5.3 — `sticky bottom-0`, not `fixed bottom-0`.** A sticky element still occupies layout space, so it cannot occlude the end of a page. This removes the planned `PageSheet` change and the "fixed bar covers content" risk entirely.
2. **§5.1 — `mobileTabs(items, role)` takes the role.** A single global priority order cannot satisfy both registered (profile last) and member (profile first). Callers already have the role in hand.
3. **§4.7 — the delegate's first tab is labelled `პანელი`, not `დელეგატის პანელი`.** Sixteen characters cannot fit a fifth of a 360px screen at the 0.74rem floor. This resolves §4.7's contingency without dropping the delegate bar to four slots.

---

### Task 1: Route→chrome logic and the string extraction

**Files:**
- Create: `lib/mobile-nav.ts`
- Create: `lib/mobile-nav.test.ts`
- Create: `scratch/mobile-strings.txt` (git-ignored working file, not committed)

**Interfaces:**
- Consumes: `CabinetNavItem` from `lib/cabinet.ts` (type only).
- Produces: `type MobileChrome = "public" | "back" | "cabinet"`; `interface BackTarget { href: string; label: string }`; `mobileBackTarget(pathname: string): BackTarget | null`; `mobileChrome(pathname: string): MobileChrome`; `showsJoinCta(pathname: string): boolean`; `showsTabBar(pathname: string): boolean`.

- [ ] **Step 1: Extract the new Georgian strings from the reference bundle**

The reference is a self-extracting bundle; the markup lives in a JSON-encoded `<script type="__bundler/template">` tag. Run from the repo root:

```bash
mkdir -p scratch && node -e "
const fs=require('fs');
const src=fs.readFileSync('C:/Users/Mylaptop/Downloads/geo-republic-mobile-v2.html','utf8');
const t=src.match(/<script type=\"__bundler\/template\">([\s\S]*?)<\/script>/)[1];
const html=JSON.parse(t.trim());
const want=['menu','close','back','more','tabEvents','tabPolls','tabNews','ctaSub','ctaCabinet','panel'];
const out=[];
const grab=(re,name)=>{const m=html.match(re); out.push(name+'\t'+(m?m[1]:'NOT FOUND'));};
grab(/data-act=\"menu\"[^>]*>([^<]+)</,'menu');
grab(/data-act=\"closeMenu\"[^>]*>([^<]+)</,'close');
grab(/data-act=\"back\"[^>]*>([^<]+)</,'back');
// Codepoints, not literal Georgian: a script written to avoid hand-typed
// Georgian must not itself contain hand-typed Georgian. ერთ is
// the first word of the CTA subtitle.
const sub=html.match(/>(ერთ [^<]+)</); out.push('ctaSub\t'+(sub?sub[1]:'NOT FOUND'));
const cab=html.match(/data-act=\"cabinet\"[^>]*>([^<]+)</); out.push('ctaCabinet\t'+(cab?cab[1]:'NOT FOUND'));
const js=html.match(/label: \"([^\"]+)\", on: r === \"mevents\"/); out.push('tabEvents\t'+(js?js[1]:'NOT FOUND'));
const jp=html.match(/label: \"([^\"]+)\", on: r === \"polls\"/); out.push('tabPolls\t'+(jp?jp[1]:'NOT FOUND'));
const jn=html.match(/label: \"([^\"]+)\", on: r === \"menews\"/); out.push('tabNews\t'+(jn?jn[1]:'NOT FOUND'));
const jm=html.match(/act: \"more\", label: \"([^\"]+)\"/); out.push('more\t'+(jm?jm[1]:'NOT FOUND'));
fs.writeFileSync('scratch/mobile-strings.txt', out.join('\n')+'\n');
console.log(out.join('\n'));
"
```

Expected: **nine** `name<TAB>string` lines, none reading `NOT FOUND` (verified against the bundle on 2026-08-02 — `menu`, `close`, `back`, `ctaSub`, `ctaCabinet`, `tabEvents`, `tabPolls`, `tabNews`, `more`). If any reads `NOT FOUND`, stop and read the bundle rather than typing the string by hand.

Then append the strings that already ship, copied byte-for-byte from their current homes with `grep`:

```bash
{ grep -h "BACK_TO_PUBLIC =" "app/(member)/layout.tsx"
  grep -h "CABINET_TAG =" "app/(member)/layout.tsx"
  grep -h "HEADER_CTA_LABEL =" "app/(public)/layout.tsx"
  grep -hE "label: \"" lib/cabinet.ts
  grep -h "გასვლა" components/CabinetNav.tsx
} >> scratch/mobile-strings.txt
```

`პანელი` is the second word of `დელეგატის პანელი` in `lib/cabinet.ts` — cut it from that line, do not retype it.

**Every Georgian literal in every later task is copied from this file.**

- [ ] **Step 2: Write the failing test**

Create `lib/mobile-nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mobileBackTarget, mobileChrome, showsJoinCta, showsTabBar } from "./mobile-nav";

describe("mobileBackTarget", () => {
  it("maps a news article to the news index", () => {
    expect(mobileBackTarget("/news/regional-tour")).toEqual({
      href: "/news",
      label: "სიახლეები",
    });
  });
  it("maps an event detail to the events index", () => {
    expect(mobileBackTarget("/events/tbilisi-assembly")?.href).toBe("/events");
  });
  it("maps a delegate profile to the leaderboard", () => {
    expect(mobileBackTarget("/delegates/giorgi-khachidze")?.href).toBe("/leaderboard");
  });
  it("maps the membership wizard and its done screen to the profile", () => {
    expect(mobileBackTarget("/me/membership")?.href).toBe("/me/profile");
    expect(mobileBackTarget("/me/membership/done")?.href).toBe("/me/profile");
  });
  it("returns null for index routes, which are not detail screens", () => {
    expect(mobileBackTarget("/news")).toBeNull();
    expect(mobileBackTarget("/events")).toBeNull();
    expect(mobileBackTarget("/")).toBeNull();
  });
  it("returns null for a bare prefix with no slug", () => {
    expect(mobileBackTarget("/news/")).toBeNull();
  });
  it("does not confuse the public /delegates/ prefix with the /delegate cabinet", () => {
    expect(mobileBackTarget("/delegate")).toBeNull();
    expect(mobileBackTarget("/delegate/team")).toBeNull();
  });
});

describe("mobileChrome", () => {
  it("gives public routes the public header", () => {
    for (const p of ["/", "/leaderboard", "/news", "/events", "/transparency", "/support"]) {
      expect(mobileChrome(p), p).toBe("public");
    }
  });
  it("gives detail and flow routes the back header", () => {
    for (const p of ["/news/x", "/events/x", "/delegates/x", "/join", "/join/terms", "/login"]) {
      expect(mobileChrome(p), p).toBe("back");
    }
  });
  it("gives cabinet routes the cabinet header", () => {
    for (const p of ["/me", "/me/profile", "/me/polls", "/delegate", "/delegate/team"]) {
      expect(mobileChrome(p), p).toBe("cabinet");
    }
  });
  it("lets the back header win over the cabinet header in the membership wizard", () => {
    expect(mobileChrome("/me/membership")).toBe("back");
  });
});

describe("showsJoinCta", () => {
  it("shows on public and detail routes", () => {
    expect(showsJoinCta("/")).toBe(true);
    expect(showsJoinCta("/news/x")).toBe(true);
  });
  it("hides on the routes that are themselves the call to action", () => {
    expect(showsJoinCta("/join")).toBe(false);
    expect(showsJoinCta("/join/terms")).toBe(false);
    expect(showsJoinCta("/login")).toBe(false);
  });
});

describe("showsTabBar", () => {
  it("shows across the cabinet", () => {
    expect(showsTabBar("/me/profile")).toBe(true);
    expect(showsTabBar("/delegate")).toBe(true);
  });
  it("hides in the membership wizard, which must not offer five exits", () => {
    expect(showsTabBar("/me/membership")).toBe(false);
    expect(showsTabBar("/me/membership/done")).toBe(false);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run lib/mobile-nav.test.ts`
Expected: FAIL — `Failed to resolve import "./mobile-nav"`.

- [ ] **Step 4: Write the implementation**

Create `lib/mobile-nav.ts`. **Replace every Georgian literal below with bytes from `scratch/mobile-strings.txt`.**

```ts
/**
 * Every route→chrome decision for the mobile layer (spec §4.3–§4.8), as pure
 * functions with no React or Next imports. Components read from here; nothing
 * here reads from a component.
 */

export type MobileChrome = "public" | "back" | "cabinet";

export interface BackTarget {
  href: string;
  label: string;
}

// Splice sources: the five index labels below already ship in the
// app/(public)/layout.tsx nav array; „წესები“ is its FOOTER_TERMS_LABEL.
const NEWS_INDEX = "სიახლეები";
const EVENTS_INDEX = "ღონისძიებები";
const BOARD_INDEX = "რეიტინგი";
const JOIN_LABEL = "რეგისტრაცია";
const TERMS_LABEL = "წესები";
const LOGIN_LABEL = "შესვლა";
const MEMBERSHIP_LABEL = "წევრობა";

/** Exact-match back targets. Order-independent — pathnames are unique keys. */
const STATIC_BACK: Record<string, BackTarget> = {
  "/join": { href: "/", label: JOIN_LABEL },
  "/join/terms": { href: "/join", label: TERMS_LABEL },
  "/login": { href: "/", label: LOGIN_LABEL },
  "/me/membership": { href: "/me/profile", label: MEMBERSHIP_LABEL },
  "/me/membership/done": { href: "/me/profile", label: MEMBERSHIP_LABEL },
};

/**
 * Dynamic detail routes. Matched by prefix because [slug] values are unbounded.
 * The trailing slash is load-bearing: it keeps "/news" (an index, no back
 * header) from matching, and keeps the public "/delegates/" profile prefix from
 * colliding with the "/delegate" cabinet root.
 */
const PREFIX_BACK: ReadonlyArray<{ prefix: string; target: BackTarget }> = [
  { prefix: "/news/", target: { href: "/news", label: NEWS_INDEX } },
  { prefix: "/events/", target: { href: "/events", label: EVENTS_INDEX } },
  { prefix: "/delegates/", target: { href: "/leaderboard", label: BOARD_INDEX } },
];

const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/leaderboard",
  "/news",
  "/events",
  "/transparency",
  "/support",
]);

/** Routes that ARE the call to action, so a join bar under them is noise. */
const NO_CTA_ROUTES: ReadonlySet<string> = new Set(["/join", "/join/terms", "/login"]);

function inCabinet(pathname: string): boolean {
  return (
    pathname === "/me" ||
    pathname.startsWith("/me/") ||
    pathname === "/delegate" ||
    pathname.startsWith("/delegate/")
  );
}

/**
 * The parent a „← უკან“ header links to, or null when the route is not a detail
 * screen. Deliberately a fixed parent rather than router.back(): an article
 * opened from a shared link has no history behind it, and back() would leave
 * the site entirely (spec §4.8).
 */
export function mobileBackTarget(pathname: string): BackTarget | null {
  const exact = STATIC_BACK[pathname];
  if (exact) return exact;
  for (const { prefix, target } of PREFIX_BACK) {
    if (pathname.startsWith(prefix) && pathname.length > prefix.length) return target;
  }
  return null;
}

/**
 * Which of the three headers a route gets. The back header wins over the
 * cabinet header, which is what takes the tab bar off the membership wizard.
 * Never called for /admin — admin chrome is out of scope and unchanged.
 */
export function mobileChrome(pathname: string): MobileChrome {
  if (mobileBackTarget(pathname) !== null) return "back";
  if (inCabinet(pathname)) return "cabinet";
  if (PUBLIC_ROUTES.has(pathname)) return "public";
  return "public";
}

export function showsJoinCta(pathname: string): boolean {
  return !NO_CTA_ROUTES.has(pathname);
}

export function showsTabBar(pathname: string): boolean {
  return mobileBackTarget(pathname) === null;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/mobile-nav.test.ts`
Expected: PASS, 4 suites / 15 tests.

- [ ] **Step 6: Gate, format and commit**

```bash
npm run format
node scripts/ka-gate.mjs --diff main lib/mobile-nav.ts lib/mobile-nav.test.ts
npm run ka:scan
git add lib/mobile-nav.ts lib/mobile-nav.test.ts
git commit -m "feat(mobile): route to chrome mapping"
```

Expected: `ka-gate` prints `ok ... (open=0 close=0)` for both files; `ka:scan` reports no findings.

---

### Task 2: Cabinet tab selection

**Files:**
- Modify: `lib/mobile-nav.ts` (append)
- Modify: `lib/mobile-nav.test.ts` (append)

**Interfaces:**
- Consumes: `CabinetNavItem` (`{ href: string; label: string; count?: number }`) from `lib/cabinet.ts`; the role union `"registered" | "member" | "delegate"` returned by `cabinetRole()`.
- Produces: `mobileTabs(items: CabinetNavItem[], role: "registered" | "member" | "delegate"): { tabs: CabinetNavItem[]; more: CabinetNavItem[] }`.

- [ ] **Step 1: Write the failing test**

Append to `lib/mobile-nav.test.ts`. **Do not add a second import line for `./mobile-nav`** — eslint's `no-duplicate-imports` will reject it. Extend the existing import from Task 1 to read:

```ts
import {
  mobileBackTarget,
  mobileChrome,
  mobileTabs,
  showsJoinCta,
  showsTabBar,
} from "./mobile-nav";
```

and add one new import beside it:

```ts
import { cabinetNavItems } from "./cabinet";
```

Then append the suite:

```ts
describe("mobileTabs", () => {
  it("gives a registered member four tabs and no overflow destinations", () => {
    const { tabs, more } = mobileTabs(cabinetNavItems("registered"), "registered");
    expect(tabs.map((t) => t.href)).toEqual(["/me", "/me/events", "/me/news", "/me/profile"]);
    expect(more).toEqual([]);
  });

  it("gives a member four tabs and pushes delegate and billing to the sheet", () => {
    const { tabs, more } = mobileTabs(cabinetNavItems("member"), "member");
    expect(tabs.map((t) => t.href)).toEqual([
      "/me/profile",
      "/me/polls",
      "/me/events",
      "/me/news",
    ]);
    expect(more.map((m) => m.href)).toEqual(["/me/delegate", "/me/billing"]);
  });

  it("leads the delegate bar with the panel, which is where login already sends them", () => {
    const { tabs, more } = mobileTabs(cabinetNavItems("delegate"), "delegate");
    expect(tabs[0]?.href).toBe("/delegate");
    expect(tabs.map((t) => t.href)).toEqual(["/delegate", "/me/polls", "/me/events", "/me/news"]);
    expect(more.map((m) => m.href)).toEqual(["/me/profile", "/me/billing"]);
  });

  it("shortens only the labels that cannot fit a fifth of a 360px screen", () => {
    const { tabs } = mobileTabs(cabinetNavItems("member"), "member");
    const label = (href: string) => tabs.find((t) => t.href === href)?.label;
    expect(label("/me/polls")).toBe("გამოკითხვა");
    expect(label("/me/events")).toBe("ღონისძიება");
    expect(label("/me/news")).toBe("სიახლე");
    expect(label("/me/profile")).toBe("პროფილი");
  });

  it("shortens the delegate panel label too — the full one is sixteen characters", () => {
    const { tabs } = mobileTabs(cabinetNavItems("delegate"), "delegate");
    expect(tabs[0]?.label).toBe("პანელი");
  });

  it("keeps every tab label at or under ten characters", () => {
    for (const role of ["registered", "member", "delegate"] as const) {
      for (const tab of mobileTabs(cabinetNavItems(role), role).tabs) {
        expect(tab.label.length, `${role} ${tab.href}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it("carries the open-polls count through onto the tab", () => {
    const items = cabinetNavItems("member").map((i) =>
      i.href === "/me/polls" ? { ...i, count: 3 } : i,
    );
    const { tabs } = mobileTabs(items, "member");
    expect(tabs.find((t) => t.href === "/me/polls")?.count).toBe(3);
  });

  it("always sends the admin entry to the sheet, never the bar", () => {
    const { tabs, more } = mobileTabs(cabinetNavItems("member", true), "member");
    expect(tabs.some((t) => t.href === "/admin")).toBe(false);
    expect(more.map((m) => m.href)).toContain("/admin");
  });

  it("is unaffected by the order cabinetNavItems returns", () => {
    const shuffled = [...cabinetNavItems("member")].reverse();
    const { tabs } = mobileTabs(shuffled, "member");
    expect(tabs.map((t) => t.href)).toEqual([
      "/me/profile",
      "/me/polls",
      "/me/events",
      "/me/news",
    ]);
  });

  it("drops a tab rather than throwing when an expected href is absent", () => {
    const withoutPolls = cabinetNavItems("member").filter((i) => i.href !== "/me/polls");
    const { tabs } = mobileTabs(withoutPolls, "member");
    expect(tabs.map((t) => t.href)).toEqual(["/me/profile", "/me/events", "/me/news"]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/mobile-nav.test.ts -t mobileTabs`
Expected: FAIL — `mobileTabs is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `lib/mobile-nav.ts`. **Replace every Georgian literal with bytes from `scratch/mobile-strings.txt`.**

```ts
import type { CabinetNavItem } from "./cabinet";

type CabinetRole = "registered" | "member" | "delegate";

/**
 * The four hrefs that earn a permanent slot, per role, in render order
 * (spec §4.6). Chosen by how often people return, NOT by cabinetNavItems()
 * order — a plain slice(0, 4) would put billing on the bar and bury polls.
 *
 * A single global priority list cannot serve both registered (profile last)
 * and member (profile first), which is why this is keyed by role.
 *
 * Anything not listed — including /admin — lands in the „მეტი“ sheet.
 */
const TAB_HREFS: Record<CabinetRole, ReadonlyArray<string>> = {
  registered: ["/me", "/me/events", "/me/news", "/me/profile"],
  member: ["/me/profile", "/me/polls", "/me/events", "/me/news"],
  delegate: ["/delegate", "/me/polls", "/me/events", "/me/news"],
};

/**
 * Tab-bar label overrides. DESIGN.md §2.3 sets a hard 0.74rem floor, and at
 * that size a twelve-character plural cannot fit a fifth of a 360px screen —
 * so the bar uses the singular while page headings keep the plural. Shortening
 * the font instead would break the accessibility floor (spec §4.7).
 *
 * „პანელი“ is the second word of lib/cabinet.ts's „დელეგატის პანელი“.
 */
const TAB_LABELS: Readonly<Record<string, string>> = {
  "/me/events": "ღონისძიება",
  "/me/news": "სიახლე",
  "/me/polls": "გამოკითხვა",
  "/delegate": "პანელი",
};

/**
 * Splits an ALREADY-COMPUTED cabinetNavItems() result into the four bar tabs
 * and the sheet overflow. Taking the computed items (rather than the role
 * alone) is what lets the open-polls count and the conditional admin entry
 * flow through without lib/cabinet.ts being touched at all.
 *
 * Matches on href, which is stable, never on label.
 */
export function mobileTabs(
  items: CabinetNavItem[],
  role: CabinetRole,
): { tabs: CabinetNavItem[]; more: CabinetNavItem[] } {
  const byHref = new Map(items.map((item) => [item.href, item]));
  const tabs = TAB_HREFS[role].flatMap((href) => {
    const item = byHref.get(href);
    if (!item) return [];
    const short = TAB_LABELS[href];
    return [short ? { ...item, label: short } : item];
  });
  const onBar = new Set(tabs.map((tab) => tab.href));
  return { tabs, more: items.filter((item) => !onBar.has(item.href)) };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/mobile-nav.test.ts`
Expected: PASS, all suites including the 10 new `mobileTabs` tests.

- [ ] **Step 5: Gate, format and commit**

```bash
npm run format
node scripts/ka-gate.mjs --diff main lib/mobile-nav.ts lib/mobile-nav.test.ts
npm run ka:scan
git add lib/mobile-nav.ts lib/mobile-nav.test.ts
git commit -m "feat(mobile): cabinet tab selection per role"
```

---

### Task 3: The viewport fix and the shared bottom bar

**Files:**
- Modify: `app/layout.tsx:1` (import) and after the `metadata` export
- Create: `components/StickyBar.tsx`
- Create: `components/StickyBar.test.tsx`

**Interfaces:**
- Produces: `StickyBar({ children }: { children: ReactNode })`.

- [ ] **Step 1: Write the failing test**

Create `components/StickyBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StickyBar } from "./StickyBar";

describe("StickyBar", () => {
  it("renders its children", () => {
    render(
      <StickyBar>
        <button type="button">ok</button>
      </StickyBar>,
    );
    expect(screen.getByRole("button", { name: "ok" })).toBeInTheDocument();
  });

  it("is sticky, not fixed — a fixed bar would occlude the end of the page", () => {
    const { container } = render(<StickyBar>x</StickyBar>);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("sticky");
    expect(bar.className).not.toContain("fixed");
  });

  it("is hidden from md up, so desktop chrome is untouched", () => {
    const { container } = render(<StickyBar>x</StickyBar>);
    expect((container.firstElementChild as HTMLElement).className).toContain("md:hidden");
  });

  it("pads for the iPhone home indicator", () => {
    const { container } = render(<StickyBar>x</StickyBar>);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.style.paddingBottom).toContain("safe-area-inset-bottom");
  });

  it("carries the 2px ink rule the design system uses to separate chrome", () => {
    const { container } = render(<StickyBar>x</StickyBar>);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("border-t-2");
    expect(bar.className).toContain("border-ink");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run components/StickyBar.test.tsx`
Expected: FAIL — `Failed to resolve import "./StickyBar"`.

- [ ] **Step 3: Write the implementation**

Create `components/StickyBar.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * The one mobile bottom bar (spec §4.1). Both the public join CTA and the
 * cabinet tab bar render through this, which is what makes two bottom bars on
 * one route structurally impossible.
 *
 * `sticky bottom-0` rather than `fixed`: a sticky element still occupies
 * layout space, so it can never occlude the end of a page and no caller needs
 * a spacer. It pins to the viewport bottom on long pages and sits at the foot
 * of the sheet on short ones, because PageSheet is min-h-screen.
 *
 * Hidden from `md` up — desktop chrome is unchanged.
 */
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-40 border-t-2 border-ink bg-paper md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/StickyBar.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Add the viewport export**

In `app/layout.tsx`, change line 1 from:

```ts
import type { Metadata } from "next";
```

to:

```ts
import type { Metadata, Viewport } from "next";
```

and add immediately after the closing `};` of the `metadata` export:

```ts
/**
 * `viewportFit: "cover"` is load-bearing, not cosmetic: without it every
 * env(safe-area-inset-*) in the app evaluates to 0, so the mobile bars would
 * look correct on Android and clip under the home indicator on iPhone.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
```

- [ ] **Step 6: Verify the meta tag actually renders**

```bash
npm run build
```

Expected: build succeeds.

Then confirm the tag actually renders. Start the dev server through the preview tooling (never a raw shell — this environment routes dev servers through the browser pane), open `/`, and check the head:

```
document.querySelector('meta[name="viewport"]').content
```

Expected: the value contains `viewport-fit=cover`. If it does not, the export is in the wrong file — it must be `app/layout.tsx`, the root layout, not a route-group layout. Task 10 asserts this again in Playwright so it cannot silently regress.

- [ ] **Step 7: Format and commit**

```bash
npm run format
git add app/layout.tsx components/StickyBar.tsx components/StickyBar.test.tsx
git commit -m "feat(mobile): safe-area viewport and the shared sticky bar"
```

---

### Task 4: The back header

**Files:**
- Create: `components/MobileBackHeader.tsx`
- Create: `components/MobileBackHeader.test.tsx`

**Interfaces:**
- Consumes: `BackTarget` from `lib/mobile-nav.ts`.
- Produces: `MobileBackHeader({ href, label }: { href: string; label: string })`.

- [ ] **Step 1: Write the failing test**

Create `components/MobileBackHeader.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileBackHeader } from "./MobileBackHeader";

describe("MobileBackHeader", () => {
  it("links to the declared parent, not to browser history", () => {
    render(<MobileBackHeader href="/news" label="სიახლეები" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/news");
  });

  it("shows the context label so you know which section you are inside", () => {
    render(<MobileBackHeader href="/news" label="სიახლეები" />);
    expect(screen.getByText("სიახლეები")).toBeInTheDocument();
  });

  it("is hidden from md up", () => {
    const { container } = render(<MobileBackHeader href="/news" label="სიახლეები" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("md:hidden");
  });

  it("renders a header landmark over a 2px ink rule", () => {
    const { container } = render(<MobileBackHeader href="/news" label="სიახლეები" />);
    const header = container.firstElementChild as HTMLElement;
    expect(header.tagName).toBe("HEADER");
    expect(header.className).toContain("border-b-2");
    expect(header.className).toContain("border-ink");
  });

  it("puts the context label in brand red at or above the 0.74rem floor", () => {
    render(<MobileBackHeader href="/news" label="სიახლეები" />);
    expect(screen.getByText("სიახლეები").className).toContain("text-brand");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run components/MobileBackHeader.test.tsx`
Expected: FAIL — `Failed to resolve import "./MobileBackHeader"`.

- [ ] **Step 3: Write the implementation**

Create `components/MobileBackHeader.tsx`. **Copy „← უკან“ from `scratch/mobile-strings.txt` (`back`).**

```tsx
import Link from "next/link";

// Spliced from the reference bundle's back-header row (data-act="back"),
// never hand-typed — see the Georgian rule in DESIGN.md.
const BACK = "← უკან";

/**
 * The detail-screen header (spec §4.3): a link to the declared parent on the
 * left, the section it belongs to in brand red on the right. Deliberately a
 * real link rather than router.back() — an article opened from a shared link
 * has no history behind it, and back() would leave the site (spec §4.8).
 *
 * Rendered as a sibling of Masthead and CSS-toggled: this one below `md`, the
 * Masthead from `md` up.
 */
export function MobileBackHeader({ href, label }: { href: string; label: string }) {
  return (
    <header className="flex items-center justify-between border-b-2 border-ink px-5 pb-2.5 pt-4 md:hidden">
      <Link href={href} className="text-[0.82rem] font-bold text-ink no-underline hover:text-brand">
        {BACK}
      </Link>
      <span className="text-[0.74rem] font-bold tracking-[.18em] text-brand">{label}</span>
    </header>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/MobileBackHeader.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Gate, format and commit**

```bash
npm run format
node scripts/ka-gate.mjs --diff main components/MobileBackHeader.tsx components/MobileBackHeader.test.tsx
npm run ka:scan
git add components/MobileBackHeader.tsx components/MobileBackHeader.test.tsx
git commit -m "feat(mobile): back header"
```

---

### Task 5: The full-screen public menu, wired into the masthead

**Files:**
- Create: `components/MobileMenu.tsx`
- Create: `components/MobileMenu.test.tsx`
- Modify: `components/Masthead.tsx:60-86` (the returned JSX)

**Interfaces:**
- Consumes: `NavItem` shape `{ href: string; label: string }`; `mobileBackTarget` from `lib/mobile-nav.ts`.
- Produces: `MobileMenu({ navItems, sessionSlot, cta }: { navItems: {href: string; label: string}[]; sessionSlot?: ReactNode; cta?: ReactNode })`.

- [ ] **Step 1: Write the failing test**

Create `components/MobileMenu.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileMenu } from "./MobileMenu";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const NAV = [
  { href: "/", label: "მთავარი" },
  { href: "/leaderboard", label: "რეიტინგი" },
  { href: "/news", label: "სიახლეები" },
];

describe("MobileMenu", () => {
  it("starts closed, showing only its trigger", () => {
    render(<MobileMenu navItems={NAV} />);
    expect(screen.getByRole("button", { name: "მენიუ" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on click and lists every public destination", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    for (const item of NAV) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  it("closes on the close button", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    fireEvent.click(screen.getByRole("button", { name: "დახურვა" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("locks body scroll while open and restores it on close", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).toBe("");
  });

  it("marks the current page for screen readers", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    expect(screen.getByRole("link", { name: "მთავარი" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "რეიტინგი" })).not.toHaveAttribute("aria-current");
  });

  it("is hidden from md up, where the inline masthead nav takes over", () => {
    const { container } = render(<MobileMenu navItems={NAV} />);
    expect((container.firstElementChild as HTMLElement).className).toContain("md:hidden");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run components/MobileMenu.test.tsx`
Expected: FAIL — `Failed to resolve import "./MobileMenu"`.

- [ ] **Step 3: Write the implementation**

Create `components/MobileMenu.tsx`. **Copy „მენიუ“ and „დახურვა“ from `scratch/mobile-strings.txt` (`menu`, `close`).**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Spliced from the reference bundle (data-act="menu" / data-act="closeMenu").
const MENU = "მენიუ";
const CLOSE = "დახურვა";
// The dialog and the nav inside it must not share a name, or a screen reader
// announces the same label twice on entry. The nav keeps the shipped landmark
// label; the dialog is named for the control that opened it.
const MENU_NAV_LABEL = "მთავარი ნავიგაცია";
const MENU_DIALOG_LABEL = MENU;

/**
 * The public navigation below `md` (spec §4.9): a trigger in the masthead that
 * opens a full-screen overlay listing the same destinations the desktop
 * masthead shows inline.
 *
 * The focus trap is ~20 lines of local code rather than a dependency —
 * adding one would need a DECISIONS.md entry for no real gain here.
 */
export function MobileMenu({
  navItems,
  sessionSlot,
  cta,
}: {
  navItems: { href: string; label: string }[];
  sessionSlot?: ReactNode;
  cta?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Route changes must close the overlay, or tapping a link leaves it covering
  // the page it navigated to.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>("a[href], button");
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Returning focus to the trigger is what keeps keyboard users from being
  // dumped at the top of the document when the overlay closes.
  useEffect(() => {
    if (!open) triggerRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="inline-flex h-[34px] items-center border border-ink px-3.5 text-[0.76rem] font-bold text-ink hover:bg-ink hover:text-paper"
      >
        {MENU}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={MENU_DIALOG_LABEL}
          className="fixed inset-0 z-50 flex flex-col bg-paper"
        >
          <div className="flex items-center justify-end border-b-2 border-ink px-5 pb-2.5 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-[34px] items-center border border-ink bg-ink px-3.5 text-[0.76rem] font-bold text-paper hover:border-brand hover:bg-brand"
            >
              {CLOSE}
            </button>
          </div>

          <nav aria-label={MENU_NAV_LABEL} className="flex-1 overflow-y-auto px-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className="block border-b border-hairline py-4 font-serif text-[1.18rem] font-bold text-ink no-underline aria-[current=page]:text-brand"
              >
                {item.label}
              </Link>
            ))}
            {sessionSlot ? <div className="py-4">{sessionSlot}</div> : null}
          </nav>

          {cta ? (
            <div
              className="border-t-2 border-ink px-5 pt-3"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
            >
              {cta}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/MobileMenu.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Wire it into the masthead**

In `components/Masthead.tsx`, add these imports beside the existing ones:

```tsx
import { MobileBackHeader } from "@/components/MobileBackHeader";
import { MobileMenu } from "@/components/MobileMenu";
import { mobileBackTarget } from "@/lib/mobile-nav";
```

Then replace the whole `return (...)` block (currently lines 60-86) with:

```tsx
  const back = mobileBackTarget(pathname);

  return (
    <>
      {back ? <MobileBackHeader href={back.href} label={back.label} /> : null}
      <header
        className={`items-center justify-between border-b-2 border-ink px-5 pb-2.5 pt-4 sm:px-10 ${
          back ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Link href="/" className="shrink-0">
            <Image
              src="/brand/lockup-horizontal-geo-red.png"
              alt={WORDMARK_ALT}
              width={172}
              height={58}
            />
          </Link>
          {tag ? (
            <span className="text-[0.74rem] font-semibold tracking-[.14em] text-brand">{tag}</span>
          ) : null}
        </div>
        {hasNav ? (
          <>
            <nav
              aria-label="მთავარი ნავიგაცია"
              className="hidden items-center gap-3 overflow-x-auto whitespace-nowrap text-[0.8rem] font-semibold md:flex sm:gap-4"
            >
              {navLinks}
              {sessionSlot}
              {cta}
            </nav>
            {navItems.length > 0 ? (
              <MobileMenu navItems={navItems} sessionSlot={sessionSlot} cta={cta} />
            ) : null}
          </>
        ) : null}
      </header>
    </>
  );
```

Note the two deliberate details: the desktop `<nav>` gains `hidden ... md:flex` so it never renders on a phone, and the menu button appears only when `navItems` is non-empty — the cabinet and admin layouts pass `navItems={[]}`, so they correctly get a bare nameplate with no menu trigger.

- [ ] **Step 6: Confirm the existing masthead tests still pass**

Run: `npx vitest run components/`
Expected: PASS. Nothing asserted about the masthead's desktop markup has changed.

- [ ] **Step 7: Gate, format and commit**

```bash
npm run format
node scripts/ka-gate.mjs --diff main components/MobileMenu.tsx components/MobileMenu.test.tsx components/Masthead.tsx
npm run ka:scan
git add components/MobileMenu.tsx components/MobileMenu.test.tsx components/Masthead.tsx
git commit -m "feat(mobile): full-screen public menu"
```

---

### Task 6: The sticky join CTA

**Files:**
- Create: `components/MobileJoinCta.tsx`
- Create: `components/MobileJoinCta.test.tsx`

**Interfaces:**
- Consumes: `StickyBar`; `showsJoinCta` from `lib/mobile-nav.ts`; `ButtonLink`; `createClient` from `lib/supabase/client`.
- Produces: `MobileJoinCta()` — no props.

**Load-bearing constraint:** the guest/signed-in swap **must** happen client-side after mount, exactly as `components/HeaderSessionAction.tsx` does it. Its docstring records why: the public shell is cached by the service worker (`app/sw.ts` runtime-caches same-origin HTML), so a server-rendered session state would be served to the wrong visitor.

- [ ] **Step 1: Write the failing test**

Create `components/MobileJoinCta.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileJoinCta } from "./MobileJoinCta";

const { getSession, onAuthStateChange, pathnameRef } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  pathnameRef: { current: "/" },
}));

vi.mock("next/navigation", () => ({ usePathname: () => pathnameRef.current }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession, onAuthStateChange } }),
}));

describe("MobileJoinCta", () => {
  beforeEach(() => {
    pathnameRef.current = "/";
    getSession.mockResolvedValue({ data: { session: null } });
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("invites a guest to join", async () => {
    render(<MobileJoinCta />);
    const cta = await screen.findByRole("link", { name: "შემოგვიერთდი" });
    expect(cta).toHaveAttribute("href", "/join");
  });

  it("shows the reassurance line to a guest", async () => {
    render(<MobileJoinCta />);
    expect(await screen.findByText("ერთ წუთში · გადახდის გარეშე")).toBeInTheDocument();
  });

  it("renders the guest CTA first, so the cached shell is never signed-in", () => {
    getSession.mockReturnValue(new Promise(() => {}));
    render(<MobileJoinCta />);
    expect(screen.getByRole("link", { name: "შემოგვიერთდი" })).toBeInTheDocument();
  });

  it("swaps to the cabinet link once a session resolves", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    render(<MobileJoinCta />);
    const cta = await screen.findByRole("link", { name: "ჩემი კაბინეტი →" });
    expect(cta).toHaveAttribute("href", "/me");
    expect(screen.queryByText("ერთ წუთში · გადახდის გარეშე")).toBeNull();
  });

  it("renders nothing on the routes that are themselves the call to action", () => {
    for (const path of ["/join", "/join/terms", "/login"]) {
      pathnameRef.current = path;
      const { container, unmount } = render(<MobileJoinCta />);
      expect(container, path).toBeEmptyDOMElement();
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run components/MobileJoinCta.test.tsx`
Expected: FAIL — `Failed to resolve import "./MobileJoinCta"`.

- [ ] **Step 3: Write the implementation**

Create `components/MobileJoinCta.tsx`. **Copy the two new strings from `scratch/mobile-strings.txt` (`ctaSub`, `ctaCabinet`); `შემოგვიერთდი` is the shipped `HEADER_CTA_LABEL`.**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ButtonLink";
import { StickyBar } from "@/components/StickyBar";
import { showsJoinCta } from "@/lib/mobile-nav";
import { createClient } from "@/lib/supabase/client";

// „შემოგვიერთდი“ is the shipped HEADER_CTA_LABEL from app/(public)/layout.tsx.
// The other two are spliced from the reference bundle's CTA bar.
const JOIN = "შემოგვიერთდი";
const JOIN_SUB = "ერთ წუთში · გადახდის გარეშე";
const CABINET = "ჩემი კაბინეტი →";

/**
 * The public sticky CTA (spec §4.5).
 *
 * The signed-in swap happens client-side AFTER mount, never on the server —
 * app/sw.ts runtime-caches same-origin HTML, so a server-rendered session
 * state would be handed to the next visitor. This mirrors
 * components/HeaderSessionAction.tsx, which carries the same constraint in its
 * own docstring. The guest CTA is therefore the correct cached default.
 */
export function MobileJoinCta() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setSignedIn(session !== null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(session !== null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!showsJoinCta(pathname)) return null;

  return (
    <StickyBar>
      <div className="px-5 pt-3 pb-3.5">
        {signedIn ? (
          <ButtonLink href="/me" size="lg" className="w-full">
            {CABINET}
          </ButtonLink>
        ) : (
          <>
            <ButtonLink href="/join" size="lg" className="w-full">
              {JOIN}
            </ButtonLink>
            <p className="mt-1.5 text-center text-[0.74rem] text-muted-fg">{JOIN_SUB}</p>
          </>
        )}
      </div>
    </StickyBar>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/MobileJoinCta.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Gate, format and commit**

```bash
npm run format
node scripts/ka-gate.mjs --diff main components/MobileJoinCta.tsx components/MobileJoinCta.test.tsx
npm run ka:scan
git add components/MobileJoinCta.tsx components/MobileJoinCta.test.tsx
git commit -m "feat(mobile): sticky join CTA"
```

---

### Task 7: The cabinet tab bar and overflow sheet

**Files:**
- Create: `lib/nav-active.ts`
- Create: `lib/nav-active.test.ts`
- Create: `components/useSignOut.ts`
- Create: `components/MobileTabBar.tsx`
- Create: `components/MobileTabBar.test.tsx`
- Create: `components/MobileMoreSheet.tsx`
- Create: `components/MobileMoreSheet.test.tsx`
- Modify: `components/CabinetNav.tsx:1-25` (use the shared hook) and `:42` (hide below md)

**Interfaces:**
- Consumes: `CabinetNavItem`; `mobileTabs`, `showsTabBar` from `lib/mobile-nav.ts`; `StickyBar`; `Badge`.
- Produces: `activeNavHref(items: ReadonlyArray<{ href: string }>, pathname: string): string | null`; `useSignOut(): () => Promise<void>`; `MobileTabBar({ tabs, more }: { tabs: CabinetNavItem[]; more: CabinetNavItem[] })`; `MobileMoreSheet({ items, onClose }: { items: CabinetNavItem[]; onClose: () => void })`.

- [ ] **Step 1: Extract the active-nav matcher — this prevents re-breaking owner fix #7**

`CabinetNav` already solves a problem `MobileTabBar` has too, and the naive version of it is wrong. `/me` is a prefix of every cabinet route, so plain prefix matching lights „მთავარი“ on every page — the exact bug owner fix #7 already fixed once, guarded today by the test `root „მთავარი“ is NOT marked on sibling subpages` in `components/CabinetNav.test.tsx`. The registered tab set contains `/me`, so a naive matcher in the tab bar would reintroduce it.

Extract the longest-match rule so both navs share one implementation. Create `lib/nav-active.ts`:

```ts
/**
 * Longest matching href wins (owner fix #7). „მთავარი“ (/me) is a prefix of
 * every cabinet route, so bare prefix matching keeps it lit on every page.
 * Shared by CabinetNav (desktop) and MobileTabBar (mobile) so the rule cannot
 * drift between them — it was already fixed once and must not regress.
 */
export function activeNavHref(items: ReadonlyArray<{ href: string }>, pathname: string): string | null {
  let active: string | null = null;
  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (active === null || item.href.length > active.length)) active = item.href;
  }
  return active;
}
```

Create `lib/nav-active.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { activeNavHref } from "./nav-active";

const REGISTERED = [
  { href: "/me" },
  { href: "/me/events" },
  { href: "/me/news" },
  { href: "/me/profile" },
];

describe("activeNavHref", () => {
  it("marks exactly the deepest match, never the /me root as well", () => {
    expect(activeNavHref(REGISTERED, "/me/events")).toBe("/me/events");
    expect(activeNavHref(REGISTERED, "/me/profile")).toBe("/me/profile");
  });
  it("marks the root on the root itself", () => {
    expect(activeNavHref(REGISTERED, "/me")).toBe("/me");
  });
  it("falls back to the root on a subroute no other item claims", () => {
    expect(activeNavHref(REGISTERED, "/me/membership")).toBe("/me");
  });
  it("returns null when nothing matches", () => {
    expect(activeNavHref(REGISTERED, "/news")).toBeNull();
  });
});
```

Run: `npx vitest run lib/nav-active.test.ts` — expect FAIL first (unresolved import), then PASS after creating the module.

Then replace the inline matcher in `components/CabinetNav.tsx` (the `const matches = ...` block through the `for` loop, lines 31-37) with:

```tsx
  const activeHref = activeNavHref(items, pathname);
```

adding `import { activeNavHref } from "@/lib/nav-active";`. Run `npx vitest run components/CabinetNav.test.tsx` — all 7 tests, including both owner-fix-#7 cases, must still pass.

- [ ] **Step 2: Extract the sign-out callback**

`CabinetNav` and `MobileMoreSheet` both need it, and copy-pasting a component is a forbidden pattern in CLAUDE.md. Create `components/useSignOut.ts`:

```ts
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Shared sign-out (extracted from CabinetNav when MobileMoreSheet needed the
 * same behavior). Local scope signs out this device only — the default
 * 'global' would revoke every device's refresh token and force a fresh SMS-OTP
 * login elsewhere.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  return async function signOut() {
    try {
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      // best-effort: a local session may survive a network failure — the
      // cabinet layout gates re-check server truth on the next request anyway
    }
    router.push("/");
    router.refresh();
  };
}
```

Then in `components/CabinetNav.tsx`:

- change `import { usePathname, useRouter } from "next/navigation";` to `import { usePathname } from "next/navigation";` — **`usePathname` is still needed, do not delete the whole line**;
- delete `import { createClient } from "@/lib/supabase/client";` entirely;
- delete the whole local `async function signOut()` block (lines 13-25);
- add `import { useSignOut } from "@/components/useSignOut";`;
- add `const signOut = useSignOut();` beside the existing `const pathname = usePathname();`.

The existing `onClick={signOut}` on the sign-out button is unchanged — the hook returns a callback with the same shape.

Also change the `<nav>` className on line 42 from:

```
"mb-8 flex gap-5 overflow-x-auto whitespace-nowrap border-b border-hairline text-[0.78rem] font-semibold"
```

to:

```
"mb-8 hidden gap-5 overflow-x-auto whitespace-nowrap border-b border-hairline text-[0.78rem] font-semibold md:flex"
```

- [ ] **Step 3: Confirm the existing CabinetNav suite still passes**

Run: `npx vitest run components/CabinetNav.test.tsx`
Expected: PASS, 7 tests. The suite mocks `next/navigation` and `@/lib/supabase/client` at module level, so the mocks reach the hook's imports unchanged.

- [ ] **Step 4: Write the failing tests**

Create `components/MobileTabBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "./MobileTabBar";

const { pathnameRef } = vi.hoisted(() => ({ pathnameRef: { current: "/me/polls" } }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } }),
}));

const TABS = [
  { href: "/me/profile", label: "პროფილი" },
  { href: "/me/polls", label: "გამოკითხვა", count: 2 },
  { href: "/me/events", label: "ღონისძიება" },
  { href: "/me/news", label: "სიახლე" },
];
const MORE = [
  { href: "/me/delegate", label: "ჩემი დელეგატი" },
  { href: "/me/billing", label: "გადახდები" },
];

describe("MobileTabBar", () => {
  beforeEach(() => {
    pathnameRef.current = "/me/polls";
  });

  it("renders four destinations plus the overflow trigger", () => {
    render(<MobileTabBar tabs={TABS} more={MORE} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "მეტი" })).toBeInTheDocument();
  });

  it("marks the current tab for screen readers", () => {
    render(<MobileTabBar tabs={TABS} more={MORE} />);
    expect(screen.getByRole("link", { name: /გამოკითხვა/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "პროფილი" })).not.toHaveAttribute("aria-current");
  });

  it("carries the open-polls count as a badge", () => {
    render(<MobileTabBar tabs={TABS} more={MORE} />);
    expect(screen.getByRole("link", { name: /გამოკითხვა/ })).toHaveTextContent("2");
  });

  it("opens and closes the overflow sheet", () => {
    render(<MobileTabBar tabs={TABS} more={MORE} />);
    fireEvent.click(screen.getByRole("button", { name: "მეტი" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("still offers the overflow trigger when a role has no extra destinations, because sign-out lives there", () => {
    render(<MobileTabBar tabs={TABS} more={[]} />);
    expect(screen.getByRole("button", { name: "მეტი" })).toBeInTheDocument();
  });

  it("hides itself on the membership wizard, which must not offer five exits", () => {
    pathnameRef.current = "/me/membership";
    const { container } = render(<MobileTabBar tabs={TABS} more={MORE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps every tab label at or above the 0.74rem floor", () => {
    const { container } = render(<MobileTabBar tabs={TABS} more={MORE} />);
    const bar = container.querySelector("nav")!;
    expect(bar.className).toContain("text-[0.74rem]");
  });

  // Regression guard for owner fix #7. The registered tab set contains /me,
  // which is a prefix of every other cabinet route; a naive prefix match marks
  // two tabs at once. This is the exact bug already fixed in CabinetNav.
  it("marks only the deepest tab when the registered set includes the /me root", () => {
    const registered = [
      { href: "/me", label: "მთავარი" },
      { href: "/me/events", label: "ღონისძიება" },
      { href: "/me/news", label: "სიახლე" },
      { href: "/me/profile", label: "პროფილი" },
    ];
    pathnameRef.current = "/me/events";
    const { container } = render(<MobileTabBar tabs={registered} more={[]} />);
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(screen.getByRole("link", { name: "ღონისძიება" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "მთავარი" })).not.toHaveAttribute("aria-current");
  });
});
```

Create `components/MobileMoreSheet.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileMoreSheet } from "./MobileMoreSheet";

const { push, signOut } = vi.hoisted(() => ({ push: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

const ITEMS = [
  { href: "/me/delegate", label: "ჩემი დელეგატი" },
  { href: "/me/billing", label: "გადახდები" },
];

describe("MobileMoreSheet", () => {
  beforeEach(() => {
    push.mockClear();
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
  });

  it("lists the overflow destinations", () => {
    render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    expect(screen.getByRole("link", { name: "ჩემი დელეგატი" })).toHaveAttribute(
      "href",
      "/me/delegate",
    );
  });

  it("always offers the route back to the public site and sign-out", () => {
    render(<MobileMoreSheet items={[]} onClose={vi.fn()} />);
    expect(screen.getByRole("link", { name: "← საჯარო" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "გასვლა" })).toBeInTheDocument();
  });

  it("signs out and navigates home", async () => {
    render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "გასვლა" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("closes when the scrim is clicked", () => {
    const onClose = vi.fn();
    render(<MobileMoreSheet items={ITEMS} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("more-scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is a modal dialog", () => {
    render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });
});
```

- [ ] **Step 5: Run them and confirm they fail**

Run: `npx vitest run components/MobileTabBar.test.tsx components/MobileMoreSheet.test.tsx`
Expected: FAIL — both imports unresolved.

- [ ] **Step 6: Write MobileMoreSheet**

Create `components/MobileMoreSheet.tsx`. **Copy „გასვლა“ and „← საჯარო“ from `scratch/mobile-strings.txt`.**

```tsx
"use client";

import Link from "next/link";
import type { CabinetNavItem } from "@/lib/cabinet";
import { useSignOut } from "@/components/useSignOut";

// Both already ship: „გასვლა“ from components/CabinetNav.tsx, „← საჯარო“ from
// app/(member)/layout.tsx's BACK_TO_PUBLIC.
const SIGN_OUT = "გასვლა";
const BACK_TO_PUBLIC = "← საჯარო";
const SHEET_LABEL = "პირადი კაბინეტი";
// The scrim is a close affordance, so it is labelled as one — reusing
// SHEET_LABEL here would give the dialog and its dismiss button the same name.
const CLOSE = "დახურვა";

/**
 * The „მეტი“ overflow sheet (spec §4.6). Always carries „← საჯარო“ and
 * „გასვლა“ on top of any role-specific overflow — which is why registered
 * users get a „მეტი“ tab despite having exactly four destinations, and why the
 * cabinet header is a bare nameplate with no actions.
 */
export function MobileMoreSheet({
  items,
  onClose,
}: {
  items: CabinetNavItem[];
  onClose: () => void;
}) {
  const signOut = useSignOut();

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      <button
        type="button"
        data-testid="more-scrim"
        aria-label={CLOSE}
        onClick={onClose}
        className="flex-1 bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={SHEET_LABEL}
        className="border-t-2 border-ink bg-paper px-5 pt-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="block border-b border-hairline py-3.5 font-serif text-[1.12rem] font-bold text-ink no-underline hover:text-brand"
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/"
          onClick={onClose}
          className="block border-b border-hairline py-3.5 text-[0.86rem] font-bold text-muted-fg no-underline hover:text-brand"
        >
          {BACK_TO_PUBLIC}
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="w-full py-3.5 text-left text-[0.86rem] font-bold text-brand"
        >
          {SIGN_OUT}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write MobileTabBar**

Create `components/MobileTabBar.tsx`. **Copy „მეტი“ from `scratch/mobile-strings.txt` (`more`).**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { MobileMoreSheet } from "@/components/MobileMoreSheet";
import { StickyBar } from "@/components/StickyBar";
import type { CabinetNavItem } from "@/lib/cabinet";
import { showsTabBar } from "@/lib/mobile-nav";
import { activeNavHref } from "@/lib/nav-active";

// Spliced from the reference bundle's tab definitions (act: "more").
const MORE = "მეტი";
const TABBAR_LABEL = "კაბინეტის ნავიგაცია";

/**
 * The cabinet bottom bar (spec §4.6): four destinations plus „მეტი“, for every
 * role. Text only — no icons, which is what keeps it inside the Kronika
 * rules-and-type system.
 *
 * Labels arrive already shortened by mobileTabs(); this component never
 * truncates, because the 0.74rem floor in DESIGN.md §2.3 forbids solving
 * overflow with a smaller font.
 */
export function MobileTabBar({ tabs, more }: { tabs: CabinetNavItem[]; more: CabinetNavItem[] }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => setSheetOpen(false), [pathname]);

  useEffect(() => {
    if (!sheetOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSheetOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen]);

  if (!showsTabBar(pathname)) return null;

  // Longest-match, shared with CabinetNav. A naive prefix test would light
  // „მთავარი“ (/me) on every registered page — owner fix #7, already fixed once.
  const activeHref = activeNavHref(tabs, pathname);
  const slot =
    "flex flex-1 min-w-0 h-14 items-center justify-center gap-1 px-1 text-center no-underline";

  return (
    <>
      <StickyBar>
        <nav aria-label={TABBAR_LABEL} className="flex text-[0.74rem] font-semibold">
          {tabs.map((tab) => {
            const on = tab.href === activeHref;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={`${slot} border-t-2 ${
                  on ? "border-brand font-bold text-brand" : "border-transparent text-ink"
                }`}
              >
                <span className="truncate">{tab.label}</span>
                {tab.count ? <Badge>{tab.count}</Badge> : null}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            className={`${slot} border-t-2 border-transparent text-ink`}
          >
            {MORE}
          </button>
        </nav>
      </StickyBar>
      {sheetOpen ? <MobileMoreSheet items={more} onClose={() => setSheetOpen(false)} /> : null}
    </>
  );
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run components/`
Expected: PASS — 7 new `MobileTabBar` tests, 5 new `MobileMoreSheet` tests, and the existing `CabinetNav` suite still green.

- [ ] **Step 9: Gate, format and commit**

```bash
npm run format
node scripts/ka-gate.mjs --diff main lib/nav-active.ts lib/nav-active.test.ts components/useSignOut.ts components/MobileTabBar.tsx components/MobileTabBar.test.tsx components/MobileMoreSheet.tsx components/MobileMoreSheet.test.tsx components/CabinetNav.tsx
npm run ka:scan
git add lib/nav-active.ts lib/nav-active.test.ts components/useSignOut.ts components/MobileTabBar.tsx components/MobileTabBar.test.tsx components/MobileMoreSheet.tsx components/MobileMoreSheet.test.tsx components/CabinetNav.tsx
git commit -m "feat(mobile): cabinet tab bar and overflow sheet"
```

---

### Task 8: Wire the three layouts

**Files:**
- Modify: `app/(public)/layout.tsx:42-64`
- Modify: `app/(member)/layout.tsx:53-70`
- Modify: `app/(delegate)/layout.tsx` (the returned JSX)

**Interfaces:**
- Consumes: `MobileJoinCta`, `MobileTabBar`, `mobileTabs`.
- Produces: nothing new — this is the assembly step.

- [ ] **Step 1: Wire the public layout**

In `app/(public)/layout.tsx`, add `import { MobileJoinCta } from "@/components/MobileJoinCta";` and insert the component as the **last** child of `PageSheet`, after `SiteFooter`:

```tsx
        <div className="flex-1">{children}</div>
        <SiteFooter copyright={FOOTER_COPYRIGHT} links={footerLinks} />
        <MobileJoinCta />
      </PageSheet>
```

Order matters: `StickyBar` is `position: sticky`, so it must be the final flow child for the footer to scroll above it rather than under it.

- [ ] **Step 2: Wire the member layout**

In `app/(member)/layout.tsx`, add:

```tsx
import { MobileTabBar } from "@/components/MobileTabBar";
import { cabinetNavItems, cabinetRole } from "@/lib/cabinet";
import { mobileTabs } from "@/lib/mobile-nav";
```

(`cabinetNavItems` and `cabinetRole` are already imported — do not duplicate the line.)

Then, after the existing `const items = ...` assignment, add:

```tsx
  const role = cabinetRole(state);
  const { tabs, more } = mobileTabs(items, role);
```

and change the existing `cabinetNavItems(cabinetRole(state), state.admin)` call to `cabinetNavItems(role, state.admin)` so the role is derived once.

Finally add the bar as the last child of `PageSheet`:

```tsx
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <CabinetNav items={items} />
        {children}
      </div>
      <MobileTabBar tabs={tabs} more={more} />
    </PageSheet>
```

- [ ] **Step 3: Wire the delegate layout**

In `app/(delegate)/layout.tsx`, add the same two imports, then replace the `<CabinetNav items={cabinetNavItems("delegate", state.admin)} />` line with a hoisted constant above the return:

```tsx
  const items = cabinetNavItems("delegate", state.admin);
  const { tabs, more } = mobileTabs(items, "delegate");
```

use `<CabinetNav items={items} />`, and add `<MobileTabBar tabs={tabs} more={more} />` as the last child of `PageSheet`.

- [ ] **Step 4: Verify the whole suite and the build**

```bash
npm run typecheck
npm run test
npm run build
```

Expected: typecheck clean, all vitest suites pass, build succeeds.

- [ ] **Step 5: Verify it in the browser at phone size**

Start the dev server via the preview tooling (never `npm run dev` in a raw shell for this step), open `/` at 390×844, and confirm by screenshot:
1. the header shows the logo and a `მენიუ` button, no inline nav links;
2. the join bar sits at the bottom with its reassurance line;
3. scrolling to the very bottom of `/` leaves the footer fully readable above the bar;
4. `/news/regional-tour` (or any real article slug) shows `← უკან` and a red `სიახლეები`;
5. at 1280px the page is pixel-identical to `main`.

- [ ] **Step 6: Format and commit**

```bash
npm run format
git add "app/(public)/layout.tsx" "app/(member)/layout.tsx" "app/(delegate)/layout.tsx"
git commit -m "feat(mobile): wire chrome into the three layouts"
```

---

### Task 9: Styleguide and documentation

**Files:**
- Modify: `app/(public)/styleguide/page.tsx`
- Modify: `app/(public)/styleguide/samples.tsx`
- Modify: `DESIGN.md` (the "Furniture" table, after the `ReferralCard` row)
- Modify: `DECISIONS.md` (append)

- [ ] **Step 1: Read how the styleguide renders existing furniture**

```bash
grep -n "SectionRule\|IndexRow\|EventRow" "app/(public)/styleguide/samples.tsx" | head -20
```

Follow whatever pattern that shows — a labelled section per component with a live render. Do not invent a new layout.

- [ ] **Step 2: Add gallery entries**

Add one section per new component: `StickyBar`, `MobileBackHeader`, `MobileMenu`, `MobileJoinCta`, `MobileTabBar`, `MobileMoreSheet`.

Because every one of them is `md:hidden`, they render blank on a desktop styleguide. Wrap each sample in a 390px-wide bordered frame that overrides the breakpoint for display purposes, and label it so a reviewer knows what they are looking at:

```tsx
<div className="w-[390px] max-w-full border border-frame">{/* sample */}</div>
```

Add a one-line note above the group: these are mobile-only components, shown here at 390px.

- [ ] **Step 3: Verify the styleguide renders**

Open `/styleguide` in the preview browser and screenshot the new section. Expected: six labelled samples, none blank.

- [ ] **Step 4: Update DESIGN.md**

Append to the Furniture table:

| Component | Props | Contract |
| --- | --- | --- |
| `StickyBar` | `{ children }` | The one mobile bottom bar. `sticky bottom-0`, 2px ink top rule, paper fill, safe-area padding, `md:hidden`. Both the join CTA and the tab bar render through it, so two bottom bars cannot coexist. |
| `MobileBackHeader` | `{ href, label }` | Detail-screen header below `md`: `← უკან` link to a declared parent, brand-red small-caps context label, 2px ink rule. Never `router.back()`. |
| `MobileMenu` | `{ navItems, sessionSlot?, cta? }` | Full-screen public navigation overlay and its masthead trigger. Escape closes, focus trapped, body scroll locked, focus returns to the trigger. |
| `MobileJoinCta` | — | Session-aware sticky CTA. Guest state is the cached default; the swap is client-side after mount because `app/sw.ts` caches the public shell. |
| `MobileTabBar` | `{ tabs, more }` | Cabinet bottom bar: four destinations plus `მეტი`, 56px, text only, active = brand text + 2px brand top rule, `Badge` for counts. |
| `MobileMoreSheet` | `{ items, onClose }` | Overflow bottom sheet; always carries `← საჯარო` and `გასვლა`. |

Then add a short subsection recording that the mobile tab bar uses singular labels (`ღონისძიება`, `გამოკითხვა`, `სიახლე`, `პანელი`) while page headings keep the plurals, because the 0.74rem floor makes the plurals unfittable.

- [ ] **Step 5: Append the ADR to DECISIONS.md**

Follow the file's existing numbering and format. Record three decisions with their reasons:

1. Mobile bars use document scroll with `sticky bottom-0`, rejecting the reference prototype's welded `100dvh` app shell — that approach permanently pins the mobile address bar, breaks scroll restoration, and disables pull-to-refresh.
2. Cabinet tabs are chosen by return frequency per role, not by `cabinetNavItems()` order.
3. Tab labels use singular forms; the reference's 10.8px labels sit below DESIGN.md's 0.74rem floor and could not be copied.

- [ ] **Step 6: Gate, format and commit**

```bash
npm run format
node scripts/ka-gate.mjs --diff main "app/(public)/styleguide/page.tsx" "app/(public)/styleguide/samples.tsx" DESIGN.md DECISIONS.md
npm run ka:scan
git add "app/(public)/styleguide/" DESIGN.md DECISIONS.md
git commit -m "docs(mobile): styleguide entries, DESIGN.md furniture, ADR"
```

---

### Task 10: End-to-end coverage

**Files:**
- Create: `e2e/mobile-chrome.spec.ts`
- Modify: `e2e/responsive.spec.ts` (extend `PAGES`)

**Note on running Playwright in a worktree:** worktrees have no `node_modules` or `.env.local`. Copy `.env.local` from the main checkout and invoke the Playwright CLI by absolute path; do not trust a wrapper script's exit code.

- [ ] **Step 1: Extend the existing overflow sweep**

In `e2e/responsive.spec.ts`, add `"/support"` to the `PAGES` array. The bars are new horizontal content and this suite is the cheapest guard against them overflowing.

- [ ] **Step 2: Write the new spec**

Create `e2e/mobile-chrome.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("mobile chrome at 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("public routes get the menu button, not the inline nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "მენიუ" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "მთავარი ნავიგაცია" }).first()).toBeHidden();
  });

  test("the menu opens, lists destinations, and closes on Escape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "მენიუ" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "რეიტინგი" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the join CTA is present on public routes and absent on the join flow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "შემოგვიერთდი" })).toBeVisible();
    await page.goto("/join");
    await expect(page.getByRole("link", { name: "შემოგვიერთდი" })).toHaveCount(0);
  });

  test("a detail route gets the back header pointing at its index", async ({ page }) => {
    await page.goto("/news");
    const firstArticle = page.locator("a[href^='/news/']").first();
    await firstArticle.click();
    await expect(page).toHaveURL(/\/news\/.+/);
    const back = page.getByRole("link", { name: "← უკან" });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/news$/);
  });

  test("exactly one bottom bar renders per route", async ({ page }) => {
    for (const path of ["/", "/news", "/leaderboard", "/transparency"]) {
      await page.goto(path);
      const bars = page.locator("div.sticky.bottom-0");
      await expect(bars, path).toHaveCount(1);
    }
  });

  test("the bottom bar never covers the end of the page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = page.getByText("© 2026", { exact: false });
    await expect(footer).toBeInViewport();
  });

  test("the viewport meta opts into the safe area", async ({ page }) => {
    await page.goto("/");
    const content = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(content).toContain("viewport-fit=cover");
  });
});

test.describe("desktop chrome is unchanged at 1280px", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the inline nav is visible and no mobile chrome renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "რეიტინგი" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "მენიუ" })).toBeHidden();
    await expect(page.locator("div.sticky.bottom-0")).toBeHidden();
  });
});
```

- [ ] **Step 3: Run the new spec**

```bash
npx playwright test e2e/mobile-chrome.spec.ts e2e/responsive.spec.ts
```

Expected: all tests pass. If the back-header test cannot find an article link, `/news` has no published content in the target environment — seed one rather than weakening the assertion.

- [ ] **Step 4: Run the full suite**

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

Expected: all five clean. These are the exact CI gates.

- [ ] **Step 5: Commit**

```bash
git add e2e/mobile-chrome.spec.ts e2e/responsive.spec.ts
git commit -m "test(mobile): e2e coverage for the mobile chrome"
```

---

## Cabinet coverage note

The tab bar's per-role behavior is unit-tested exhaustively in Task 2 but is **not** covered end-to-end, because reaching a member or delegate cabinet requires SMS-OTP login against staging and the existing `e2e/cabinet.spec.ts` owns that shared state. If cabinet e2e coverage is wanted, extend `e2e/cabinet.spec.ts` at a 390px viewport in a follow-up rather than adding a second spec that competes for the same staging users. This gap is deliberate and stated rather than silently accepted.

## Definition of done

- [ ] All ten tasks committed on `claude/mobile-ui-ux-brainstorm-c82af0`
- [ ] `npm run lint && npm run format:check && npm run typecheck && npm run test && npm run build` all clean
- [ ] `npm run ka:scan` clean; `ka-gate --diff main` clean on every touched file
- [ ] Screenshots at 390×844 of: public home, an article, and the cabinet with the sheet open
- [ ] A 1280px screenshot of `/` proving desktop is unchanged
- [ ] Vercel preview URL for owner sign-off
