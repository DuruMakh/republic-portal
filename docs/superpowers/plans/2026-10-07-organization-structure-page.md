# Organization Structure Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static public page at `/structure` that explains the movement's board, members and general vote, with a board roster that launches empty, and link it from the header, phone menu, footer and sitemap.

**Architecture:** Pure logic (copy, vote thresholds, deterministic pebble geometry, board-member schema) lives in `lib/`; small presentational components in `components/` render it; one server-rendered route composes them. No database, no client JavaScript, no env vars. The approved concept `prototype/structure-concept/index.html` is the visual contract.

**Tech Stack:** Next.js 16 App Router (server components), React 19, Tailwind CSS 4.3 (`@theme` tokens, `@utility`), zod 3, Vitest + Testing Library (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-organization-structure-page-design.md`

## Global Constraints

- TypeScript strict. No `any`, no `@ts-ignore`.
- Domain logic in `lib/` has no React/Next imports. UI in `components/`. Route in `app/(public)/structure/`.
- Every user-facing Georgian string comes from `lib/structure-copy.ts`, whose values are byte-identical to the spec §2 (a unit test enforces it). Never retype Georgian: copy it from this plan with the editor's paste/write tool, then run the gates. No quotation marks anywhere in the page's copy.
- Colours: existing tokens only (`paper`, `paper-bright`, `ink`, `prose`, `muted-fg`, `line`, `brand`, `surface`). No new colour tokens, no dark mode.
- Board-member social networks are exactly `facebook`, `tiktok`, `linkedin`; each optional per person; no email or phone fields.
- Text-size floor 0.74rem; focus ring stays the global 2px `brand` outline; `prefers-reduced-motion` disables the only animation.
- No new npm dependencies.
- Per-task gates before each commit: `npx vitest run <touched tests>`, `npm run typecheck`, `npx eslint <touched files>`, `npx prettier --check <touched files>`, `node scripts/ka-gate.mjs --diff main <touched files>`, `npm run ka:scan`.
- Commits: write the message to a file and use `git commit -F <file>` (PowerShell mangles multi-line `-m`). End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Worktree note: this worktree has no `node_modules`. Run tools from it using the main checkout's binaries, e.g. `node ../../../node_modules/vitest/vitest.mjs run <file>` and `node ../../../node_modules/typescript/bin/tsc --noEmit`, or create a junction `node_modules -> ../../../node_modules` once (`cmd /c mklink /J node_modules ..\..\..\node_modules`) and never commit it (it is gitignored).

## File map

| File | Status | Responsibility |
|---|---|---|
| `lib/structure-copy.ts` | create | All Georgian strings for the page and nav label. |
| `lib/structure-copy.test.ts` | create | Every string exists verbatim in the spec. |
| `lib/board-rules.ts` | create | `BOARD_SIZE`, `votesNeeded()`. |
| `lib/board-rules.test.ts` | create | Threshold maths. |
| `lib/pebbles.ts` | create | Seeded PRNG, `councilLayout()`, `tallyLayout()`. |
| `lib/pebbles.test.ts` | create | Determinism, counts, in-bounds geometry. |
| `lib/board-members.ts` | create | `BoardMember` schema/type, `BOARD_MEMBERS` (empty). |
| `lib/board-members.test.ts` | create | Schema accepts/rejects; data parses; photos exist. |
| `app/layout.tsx` | modify | Load the `wdth` axis of Noto Sans Georgian. |
| `app/globals.css` | modify | `display-heading` and `pebble` utilities; council fade-in keyframes. |
| `components/Pebble.tsx` (+test) | create | Pebble shape primitive. |
| `components/DecisionRuleCard.tsx` (+test) | create | Rule headline/body + 5 pebbles, N filled. |
| `components/MembershipPath.tsx` (+test) | create | Three numbered steps. |
| `components/PebbleCouncil.tsx` (+test) | create | Hero SVG. |
| `components/PebbleTally.tsx` (+test) | create | Vote SVG + legend. |
| `components/SocialLinks.tsx` (+test) | create | fb / tt / in text-mark links. |
| `components/BoardMemberCard.tsx` (+test) | create | Photo, name, bio, socials. |
| `components/BoardRoster.tsx` (+test) | create | Empty state vs. cards. |
| `app/(public)/structure/page.tsx` (+`page.test.tsx`) | create | The route. |
| `app/(public)/layout.tsx` (+`layout.test.tsx`) | modify | Header + footer link. |
| `app/sitemap.ts` | modify | `/structure` entry. |
| `app/(public)/styleguide/page.tsx` | modify | Gallery entries for the new components. |
| `DESIGN.md`, `DECISIONS.md` | modify | Register rows; ADR-037. |
| `e2e/public.spec.ts`, `e2e/responsive.spec.ts` | modify | Journey + 360px overflow sweep. |

---

### Task 1: Page copy and vote thresholds

**Files:**
- Create: `lib/structure-copy.ts`, `lib/structure-copy.test.ts`, `lib/board-rules.ts`, `lib/board-rules.test.ts`

**Interfaces:**
- Produces (copy): `STRUCTURE_HREF = "/structure"`, `STRUCTURE_NAV_LABEL`, `STRUCTURE_TITLE`, `STRUCTURE_INTRO`, `BOARD_HEADING`, `BOARD_LEAD`, `BOARD_DUTIES_LABEL`, `BOARD_DUTIES: readonly string[]` (4), `BOARD_RULES_LABEL`, `RULE_TWO_THIRDS: { headline: string; body: string }`, `RULE_MAJORITY: { headline: string; body: string }`, `MEMBERS_HEADING`, `MEMBERS_LEAD`, `MEMBERS_PATH_LABEL`, `MEMBERS_PATH_STEPS: readonly string[]` (3), `MEMBERS_RIGHTS_LABEL`, `MEMBERS_RIGHTS: readonly string[]` (4), `VOTE_HEADING`, `VOTE_LEAD`, `VOTE_FOR`, `VOTE_AGAINST`, `ROSTER_HEADING`, `ROSTER_NOTICE`, `CLOSING_CTA`, `SECTION_INDEX: readonly { href: string; letter: string; label: string }[]` (3), `votesLabel(needed: number, total: number): string`.
- Produces (rules): `BOARD_SIZE = 5`, `type DecisionRule = "twoThirds" | "majority"`, `votesNeeded(rule: DecisionRule, size: number): number`.

- [ ] **Step 1: Write the failing tests**

`lib/structure-copy.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as copy from "./structure-copy";

const SPEC = readFileSync(
  path.resolve(__dirname, "../docs/superpowers/specs/2026-10-07-organization-structure-page-design.md"),
  "utf8",
);

/** Every string value reachable from the module's exports (arrays and objects flattened). */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("structure copy", () => {
  it("splices every string verbatim from the approved spec text", () => {
    const values = Object.entries(copy)
      .filter(([name]) => name !== "STRUCTURE_HREF")
      .flatMap(([, value]) => strings(value))
      .filter((s) => !s.startsWith("#"));
    expect(values.length).toBeGreaterThan(25);
    for (const value of values) expect(SPEC, value).toContain(value);
  });

  it("formats the rule-card label the way the spec shows it", () => {
    expect(copy.votesLabel(4, 5)).toBe("5-დან 4 ხმა");
    expect(SPEC).toContain(copy.votesLabel(4, 5));
  });

  it("contains no quotation marks of any kind", () => {
    const all = strings(Object.values(copy)).join("");
    expect(all).not.toMatch(/["'“”„]/);
  });

  it("keeps the list lengths the owner approved", () => {
    expect(copy.BOARD_DUTIES).toHaveLength(4);
    expect(copy.MEMBERS_PATH_STEPS).toHaveLength(3);
    expect(copy.MEMBERS_RIGHTS).toHaveLength(4);
    expect(copy.SECTION_INDEX.map((s) => s.href)).toEqual(["#board", "#members", "#vote"]);
  });
});
```

`lib/board-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOARD_SIZE, votesNeeded } from "./board-rules";

describe("votesNeeded", () => {
  it("needs 4 of 5 for a two-thirds decision and 3 of 5 for a simple majority", () => {
    expect(BOARD_SIZE).toBe(5);
    expect(votesNeeded("twoThirds", 5)).toBe(4);
    expect(votesNeeded("majority", 5)).toBe(3);
  });

  it("rounds two-thirds up and majority to more than half for other sizes", () => {
    expect([6, 7, 8, 9].map((n) => votesNeeded("twoThirds", n))).toEqual([4, 5, 6, 6]);
    expect([6, 7, 8, 9].map((n) => votesNeeded("majority", n))).toEqual([4, 4, 5, 5]);
  });

  it("rejects a board size that is not a positive whole number", () => {
    expect(() => votesNeeded("majority", 0)).toThrow(RangeError);
    expect(() => votesNeeded("majority", 2.5)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run lib/structure-copy.test.ts lib/board-rules.test.ts`
Expected: FAIL — `Failed to resolve import "./structure-copy"` / `"./board-rules"`.

- [ ] **Step 3: Implement**

`lib/board-rules.ts`:

```ts
/** The board's size as the approved page text states it (spec §2). */
export const BOARD_SIZE = 5;

export type DecisionRule = "twoThirds" | "majority";

/**
 * Minimum supporting votes among `size` board members.
 * twoThirds: "არანაკლებ 2/3" — at least two thirds, so round up.
 * majority: simple majority of all members — more than half.
 */
export function votesNeeded(rule: DecisionRule, size: number): number {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`invalid board size: ${size}`);
  return rule === "twoThirds" ? Math.ceil((2 * size) / 3) : Math.floor(size / 2) + 1;
}
```

`lib/structure-copy.ts` (paste exactly; these values are spliced from spec §2):

```ts
/**
 * Every Georgian string on /structure, in one module, spliced byte-for-byte from
 * docs/superpowers/specs/2026-10-07-organization-structure-page-design.md §2 (owner-approved
 * text, 2026-10-07). structure-copy.test.ts fails if any value drifts from the spec. The
 * page deliberately carries no quotation marks (U+201C/U+201D transcription hazard).
 */
export const STRUCTURE_HREF = "/structure";
export const STRUCTURE_NAV_LABEL = "სტრუქტურა";
export const STRUCTURE_TITLE = "ორგანიზაციული სტრუქტურა";
export const STRUCTURE_INTRO =
  "მოძრაობას მართავს ბორდი, მის გადაწყვეტილებებში კი ყველა წევრი მონაწილეობს.";

export const BOARD_HEADING = "ბორდი";
export const BOARD_LEAD = "ბორდი მოძრაობის მთავარი მმართველი ორგანოა და 5 წევრისგან შედგება.";
export const BOARD_DUTIES_LABEL = "ბორდი";
export const BOARD_DUTIES = [
  "ამტკიცებს მოძრაობის სტრატეგიასა და სამოქმედო გეგმას",
  "ამტკიცებს კვარტალურ ანგარიშს",
  "იღებს ახალ წევრებს",
  "ირჩევს ადმინისტრაციულ ხელმძღვანელს",
] as const;
export const BOARD_RULES_LABEL = "როგორ იღებს ბორდი გადაწყვეტილებას";
export const RULE_TWO_THIRDS = {
  headline: "არანაკლებ 2/3",
  body: "ბორდის ახალი წევრის დამატება და მოძრაობის წესდების დამტკიცება",
} as const;
export const RULE_MAJORITY = {
  headline: "უბრალო უმრავლესობა",
  body: "ყველა სხვა გადაწყვეტილება",
} as const;

export const MEMBERS_HEADING = "წევრები";
export const MEMBERS_LEAD =
  "წევრად მიღება ხდება ბორდის გადაწყვეტილებით, გასაუბრების ან მოქმედი წევრის რეკომენდაციის საფუძველზე.";
export const MEMBERS_PATH_LABEL = "როგორ ხდები წევრი";
export const MEMBERS_PATH_STEPS = [
  "გასაუბრება ან მოქმედი წევრის რეკომენდაცია",
  "ბორდის გადაწყვეტილება",
  "მოძრაობის წევრი",
] as const;
export const MEMBERS_RIGHTS_LABEL = "წევრს შეუძლია";
export const MEMBERS_RIGHTS = [
  "ბორდს წარუდგინოს ინიციატივა",
  "დაასახელოს კანდიდატი ბორდის წევრობისთვის",
  "რეკომენდაცია გაუწიოს ახალ წევრს",
  "მიიღოს მონაწილეობა საერთო კენჭისყრაში",
] as const;

export const VOTE_HEADING = "საერთო კენჭისყრა";
export const VOTE_LEAD =
  "ბორდს შეუძლია მნიშვნელოვანი საკითხი გადასაწყვეტად ყველა წევრს გადასცეს. გადაწყვეტილებას იღებს კენჭისყრის მონაწილეთა უმრავლესობა.";
export const VOTE_FOR = "მომხრე";
export const VOTE_AGAINST = "წინააღმდეგი";

export const ROSTER_HEADING = "ბორდის შემადგენლობა";
export const ROSTER_NOTICE = "ბორდის შემადგენლობა მალე გამოქვეყნდება";
export const CLOSING_CTA = "შემოგვიერთდი →";

export const SECTION_INDEX = [
  { href: "#board", letter: "ბ", label: BOARD_HEADING },
  { href: "#members", letter: "წ", label: MEMBERS_HEADING },
  { href: "#vote", letter: "კ", label: VOTE_HEADING },
] as const;

/** Accessible name of a rule card's pebble row, e.g. 5-დან 4 ხმა (spec §3). */
export function votesLabel(needed: number, total: number): string {
  return `${total}-დან ${needed} ხმა`;
}
```

Note: the copy test filters out values starting with `#` (the anchors) and `STRUCTURE_HREF`; `votesLabel` is a function so `strings()` skips it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/structure-copy.test.ts lib/board-rules.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Gates and commit**

Run the per-task gates on the four files, then:

```bash
git add lib/structure-copy.ts lib/structure-copy.test.ts lib/board-rules.ts lib/board-rules.test.ts
git commit -F msg.txt   # "feat(structure): page copy spliced from the spec, vote thresholds"
```

---

### Task 2: Deterministic pebble geometry

**Files:**
- Create: `lib/pebbles.ts`, `lib/pebbles.test.ts`

**Interfaces:**
- Produces: `type PebbleShape = { cx: number; cy: number; rx: number; ry: number; rotate: number; opacity: number }`; `seededRandom(seed: number): () => number`; `COUNCIL_HALF = 260`, `COUNCIL_RING = 84`; `councilLayout(seats: number, memberCount?: number, seed?: number): { seats: PebbleShape[]; members: PebbleShape[] }`; `TALLY_WIDTH = 600`, `TALLY_HEIGHT = 130`, `TALLY_DIVIDER = 300`; `tallyLayout(forCols: number, againstCols: number, rows?: number, seed?: number): { for: PebbleShape[]; against: PebbleShape[] }`.

- [ ] **Step 1: Write the failing test**

`lib/pebbles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  COUNCIL_HALF,
  councilLayout,
  seededRandom,
  TALLY_HEIGHT,
  TALLY_WIDTH,
  tallyLayout,
  type PebbleShape,
} from "./pebbles";

const reach = (p: PebbleShape) => Math.max(p.rx, p.ry);

describe("seededRandom", () => {
  it("repeats the same sequence for the same seed, in [0, 1)", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("councilLayout", () => {
  it("is identical on every call, so server output never changes between builds", () => {
    expect(councilLayout(5)).toEqual(councilLayout(5));
  });

  it("places one seat per board member and 160 member pebbles by default", () => {
    const { seats, members } = councilLayout(5);
    expect(seats).toHaveLength(5);
    expect(members).toHaveLength(160);
  });

  it("keeps every pebble inside the square viewBox (nothing clipped)", () => {
    const { seats, members } = councilLayout(5);
    for (const p of [...seats, ...members]) {
      expect(Math.abs(p.cx) + reach(p)).toBeLessThanOrEqual(COUNCIL_HALF);
      expect(Math.abs(p.cy) + reach(p)).toBeLessThanOrEqual(COUNCIL_HALF);
    }
  });
});

describe("tallyLayout", () => {
  it("builds two full rectangles: 9x4 for, 6x4 against", () => {
    const t = tallyLayout(9, 6);
    expect(t.for).toHaveLength(36);
    expect(t.against).toHaveLength(24);
  });

  it("keeps the for pile left of the divider and the against pile right of it", () => {
    const t = tallyLayout(9, 6);
    for (const p of t.for) expect(p.cx + reach(p)).toBeLessThan(TALLY_WIDTH / 2);
    for (const p of t.against) expect(p.cx - reach(p)).toBeGreaterThan(TALLY_WIDTH / 2);
  });

  it("keeps every pebble inside the viewBox (the clipped-pile bug)", () => {
    const t = tallyLayout(9, 6);
    for (const p of [...t.for, ...t.against]) {
      expect(p.cx - reach(p)).toBeGreaterThanOrEqual(0);
      expect(p.cx + reach(p)).toBeLessThanOrEqual(TALLY_WIDTH);
      expect(p.cy - reach(p)).toBeGreaterThanOrEqual(0);
      expect(p.cy + reach(p)).toBeLessThanOrEqual(TALLY_HEIGHT);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/pebbles.test.ts`
Expected: FAIL — cannot resolve `./pebbles`.

- [ ] **Step 3: Implement**

`lib/pebbles.ts`:

```ts
/**
 * Pebble geometry for /structure's two drawings (spec §3). Seeded, so the server renders the
 * same SVG on every build and the client never re-randomises. Coordinates are rounded to one
 * decimal to keep the markup small.
 */
export type PebbleShape = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate: number;
  opacity: number;
};

/** Park–Miller minimal standard generator: deterministic, values in [0, 1). */
export function seededRandom(seed: number): () => number {
  let s = Math.abs(Math.trunc(seed)) % 2147483647;
  if (s === 0) s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The council viewBox is -COUNCIL_HALF..COUNCIL_HALF on both axes. */
export const COUNCIL_HALF = 260;
export const COUNCIL_RING = 84;

export function councilLayout(
  seats: number,
  memberCount = 160,
  seed = 7,
): { seats: PebbleShape[]; members: PebbleShape[] } {
  const r = seededRandom(seed);
  const members = Array.from({ length: memberCount }, () => {
    const angle = r() * Math.PI * 2;
    const distance = 128 + Math.pow(r(), 0.8) * 120;
    const size = 5 + r() * 6;
    return {
      cx: round1(Math.cos(angle) * distance),
      cy: round1(Math.sin(angle) * distance),
      rx: round1(size),
      ry: round1(size * (0.72 + r() * 0.2)),
      rotate: Math.round(r() * 180),
      opacity: round1(0.55 + r() * 0.45),
    };
  });
  const seatShapes = Array.from({ length: seats }, (_, i) => {
    const angle = -Math.PI / 2 + i * ((Math.PI * 2) / seats);
    return {
      cx: round1(Math.cos(angle) * COUNCIL_RING),
      cy: round1(Math.sin(angle) * COUNCIL_RING),
      rx: 27,
      ry: 23,
      rotate: Math.round(r() * 60 - 30),
      opacity: 1,
    };
  });
  return { seats: seatShapes, members };
}

export const TALLY_WIDTH = 600;
export const TALLY_HEIGHT = 130;
export const TALLY_DIVIDER = 300;
const TALLY_GAP = 24;

export function tallyLayout(
  forCols: number,
  againstCols: number,
  rows = 4,
  seed = 19,
): { for: PebbleShape[]; against: PebbleShape[] } {
  const r = seededRandom(seed);
  const pile = (cols: number, dir: 1 | -1): PebbleShape[] => {
    const out: PebbleShape[] = [];
    for (let c = 0; c < cols; c++) {
      for (let row = 0; row < rows; row++) {
        out.push({
          cx: round1(TALLY_DIVIDER + dir * (22 + c * TALLY_GAP) + (r() * 4 - 2)),
          cy: round1(104 - row * TALLY_GAP + (r() * 4 - 2)),
          rx: round1(9 + r() * 1.5),
          ry: round1(7.8 + r() * 1.2),
          rotate: Math.round(r() * 180),
          opacity: 1,
        });
      }
    }
    return out;
  };
  return { for: pile(forCols, -1), against: pile(againstCols, 1) };
}
```

Bounds check (why the tests pass): council members reach at most 128+120+11 = 259 ≤ 260; tally left edge 300−22−8·24−2−10.5 = 73.5 ≥ 0, top 104−72−2−10.5 = 19.5 ≥ 0, bottom 106+10.5 = 116.5 ≤ 130.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/pebbles.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Gates and commit**

```bash
git add lib/pebbles.ts lib/pebbles.test.ts
git commit -F msg.txt   # "feat(structure): deterministic pebble geometry for the council and tally"
```

---

### Task 3: Board-member data and schema

**Files:**
- Create: `lib/board-members.ts`, `lib/board-members.test.ts`, `public/board/.gitkeep`

**Interfaces:**
- Produces: `SOCIAL_NETWORKS = ["facebook", "tiktok", "linkedin"] as const`; `type SocialNetwork`; `boardMemberSchema` (zod); `type BoardMember = { name: string; photo: string; bio: string; socials: { network: SocialNetwork; url: string }[] }`; `BOARD_MEMBERS: readonly BoardMember[]` (empty at launch).

- [ ] **Step 1: Write the failing test**

`lib/board-members.test.ts`:

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BOARD_MEMBERS, boardMemberSchema } from "./board-members";

// Latin placeholders only: real members' Georgian names arrive later via owner-approved edits.
const valid = {
  name: "Test Member",
  photo: "/board/test-member.jpg",
  bio: "Short bio.",
  socials: [
    { network: "facebook", url: "https://www.facebook.com/test.member" },
    { network: "tiktok", url: "https://www.tiktok.com/@testmember" },
    { network: "linkedin", url: "https://www.linkedin.com/in/test-member" },
  ],
};

describe("boardMemberSchema", () => {
  it("accepts a complete member, and one with no social links", () => {
    expect(boardMemberSchema.safeParse(valid).success).toBe(true);
    expect(boardMemberSchema.safeParse({ ...valid, socials: [] }).success).toBe(true);
  });

  it("rejects contact fields the owner ruled out (email, phone)", () => {
    expect(boardMemberSchema.safeParse({ ...valid, email: "a@b.ge" }).success).toBe(false);
    expect(boardMemberSchema.safeParse({ ...valid, phone: "+995555000000" }).success).toBe(false);
  });

  it("rejects networks outside facebook, tiktok, linkedin", () => {
    const socials = [{ network: "instagram", url: "https://www.instagram.com/x" }];
    expect(boardMemberSchema.safeParse({ ...valid, socials }).success).toBe(false);
  });

  it("rejects a link that is not https on that network's own host", () => {
    for (const url of [
      "http://www.facebook.com/x",
      "https://evil.example/facebook.com",
      "https://facebook.com.evil.example/x",
      "mailto:a@b.ge",
      "https://user:pass@www.facebook.com/x",
    ]) {
      const socials = [{ network: "facebook", url }];
      expect(boardMemberSchema.safeParse({ ...valid, socials }).success, url).toBe(false);
    }
  });

  it("rejects the same network twice for one person", () => {
    const socials = [valid.socials[0], valid.socials[0]];
    expect(boardMemberSchema.safeParse({ ...valid, socials }).success).toBe(false);
  });

  it("rejects photos outside /board/ and bios that are empty or over 300 characters", () => {
    expect(boardMemberSchema.safeParse({ ...valid, photo: "https://x.ge/a.jpg" }).success).toBe(false);
    expect(boardMemberSchema.safeParse({ ...valid, photo: "/board/../secret.jpg" }).success).toBe(false);
    expect(boardMemberSchema.safeParse({ ...valid, bio: " " }).success).toBe(false);
    expect(boardMemberSchema.safeParse({ ...valid, bio: "a".repeat(301) }).success).toBe(false);
  });
});

describe("BOARD_MEMBERS", () => {
  it("every entry passes the schema and its photo file exists in public/", () => {
    for (const member of BOARD_MEMBERS) {
      expect(boardMemberSchema.safeParse(member).success, member.name).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", member.photo)), member.photo).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/board-members.test.ts`
Expected: FAIL — cannot resolve `./board-members`.

- [ ] **Step 3: Implement**

`lib/board-members.ts`:

```ts
import { z } from "zod";

/**
 * The board roster shown on /structure. Edited in code (owner decision, 2026-10-07): each
 * change ships through a preview link for owner sign-off. Empty until the owner sends the
 * members; the page then shows its "coming soon" notice.
 *
 * To add a member: put the photo at public/board/<slug>.jpg (portrait, 4:5) and append
 *   { name, photo: "/board/<slug>.jpg", bio, socials: [{ network, url }] }
 * Networks are facebook, tiktok, linkedin (owner-confirmed); each is optional per person.
 */
export const SOCIAL_NETWORKS = ["facebook", "tiktok", "linkedin"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

const NETWORK_HOSTS: Record<SocialNetwork, readonly string[]> = {
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
};

function onOwnHost(network: SocialNetwork, url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.username === "" &&
      u.password === "" &&
      NETWORK_HOSTS[network].includes(u.hostname)
    );
  } catch {
    return false;
  }
}

const socialLinkSchema = z
  .object({ network: z.enum(SOCIAL_NETWORKS), url: z.string() })
  .strict()
  .refine((link) => onOwnHost(link.network, link.url), {
    message: "url must be https on the network's own host",
  });

export const boardMemberSchema = z
  .object({
    name: z.string().trim().min(1),
    photo: z.string().regex(/^\/board\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/),
    bio: z.string().trim().min(1).max(300),
    socials: z
      .array(socialLinkSchema)
      .refine((links) => new Set(links.map((l) => l.network)).size === links.length, {
        message: "one link per network",
      }),
  })
  .strict();

export type BoardMember = z.infer<typeof boardMemberSchema>;

export const BOARD_MEMBERS: readonly BoardMember[] = [];
```

Create the empty folder marker `public/board/.gitkeep` (zero bytes).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/board-members.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Gates and commit**

```bash
git add lib/board-members.ts lib/board-members.test.ts public/board/.gitkeep
git commit -F msg.txt   # "feat(structure): board-member schema; roster launches empty"
```

---

### Task 4: Display type, pebble primitive, rule card, membership path

**Files:**
- Modify: `app/layout.tsx:7-10`, `app/globals.css` (append)
- Create: `components/Pebble.tsx`, `components/Pebble.test.tsx`, `components/DecisionRuleCard.tsx`, `components/DecisionRuleCard.test.tsx`, `components/MembershipPath.tsx`, `components/MembershipPath.test.tsx`

**Interfaces:**
- Consumes: `votesLabel` (Task 1).
- Produces: CSS utilities `display-heading`, `pebble`; class `council-seat` (used in Task 5). `Pebble({ tone?: "brand" | "empty" | "outline"; className?: string; children?: ReactNode })`. `DecisionRuleCard({ headline: string; body: string; needed: number; total: number })`. `MembershipPath({ label: string; steps: readonly string[] })`.

- [ ] **Step 1: Write the failing tests**

`components/Pebble.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pebble } from "./Pebble";

describe("Pebble", () => {
  it("is decorative, carries the pebble shape and defaults to the brand tone", () => {
    const { container } = render(<Pebble className="h-3 w-3" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("data-tone", "brand");
    expect(el.className).toContain("pebble");
    expect(el.className).toContain("bg-brand");
    expect(el.className).toContain("h-3 w-3");
  });

  it("renders the empty and outline tones", () => {
    const { container } = render(
      <>
        <Pebble tone="empty" />
        <Pebble tone="outline">1</Pebble>
      </>,
    );
    const [empty, outline] = Array.from(container.children) as HTMLElement[];
    expect(empty.className).toContain("bg-surface");
    expect(outline.className).toContain("border-brand");
    expect(outline).toHaveTextContent("1");
  });
});
```

`components/DecisionRuleCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecisionRuleCard } from "./DecisionRuleCard";

describe("DecisionRuleCard", () => {
  it("shows the headline and body, and fills exactly `needed` of `total` pebbles", () => {
    render(<DecisionRuleCard headline="არანაკლებ 2/3" body="ტექსტი" needed={4} total={5} />);
    expect(screen.getByText("არანაკლებ 2/3")).toBeInTheDocument();
    expect(screen.getByText("ტექსტი")).toBeInTheDocument();
    const row = screen.getByRole("img", { name: "5-დან 4 ხმა" });
    expect(row.querySelectorAll('[data-tone="brand"]')).toHaveLength(4);
    expect(row.querySelectorAll('[data-tone="empty"]')).toHaveLength(1);
  });
});
```

`components/MembershipPath.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MembershipPath } from "./MembershipPath";

describe("MembershipPath", () => {
  it("renders the label and the steps as an ordered list, last step filled", () => {
    render(<MembershipPath label="როგორ ხდები წევრი" steps={["ერთი", "ორი", "სამი"]} />);
    expect(screen.getByText("როგორ ხდები წევრი")).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["1ერთი", "2ორი", "3სამი"]);
    expect(items[2].querySelector('[data-tone="brand"]')).not.toBeNull();
    expect(items[0].querySelector('[data-tone="outline"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run components/Pebble.test.tsx components/DecisionRuleCard.test.tsx components/MembershipPath.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`app/layout.tsx` — add the width axis to the existing sans font (lines 7-10 become):

```ts
const notoSans = Noto_Sans_Georgian({
  subsets: ["georgian"],
  variable: "--font-noto-sans-georgian",
  // The condensed display headings on /structure (ADR-037) need the width axis.
  axes: ["wdth"],
});
```

`app/globals.css` — append at the end of the file:

```css
/* /structure (ADR-037): condensed display headings and the pebble shape. */
@utility display-heading {
  font-family: var(--font-sans);
  font-stretch: 68%;
  font-weight: 850;
  letter-spacing: -0.01em;
  line-height: 1.02;
  text-wrap: balance;
}

@utility pebble {
  border-radius: 48% 52% 55% 45% / 50% 46% 54% 50%;
}

@keyframes council-seat-in {
  from {
    opacity: 0;
  }
}

.council-seat {
  animation: council-seat-in 0.6s ease both;
}

@media (prefers-reduced-motion: reduce) {
  .council-seat {
    animation: none;
  }
}
```

`components/Pebble.tsx`:

```tsx
import type { ReactNode } from "react";

export type PebbleTone = "brand" | "empty" | "outline";

const TONE: Record<PebbleTone, string> = {
  brand: "bg-brand border-[1.5px] border-brand text-paper",
  empty: "bg-surface border-[1.5px] border-line",
  outline: "bg-paper-bright border-2 border-brand text-brand",
};

/** The irregular pebble shape (/structure motif, ADR-037). Size and rotation come via className. */
export function Pebble({
  tone = "brand",
  className = "",
  children,
}: {
  tone?: PebbleTone;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={`pebble inline-grid shrink-0 place-items-center ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
```

`components/DecisionRuleCard.tsx`:

```tsx
import { votesLabel } from "@/lib/structure-copy";
import { Pebble } from "./Pebble";

// Static class strings so Tailwind generates them; index-matched to the pebbles.
const TILT = ["", "rotate-[25deg]", "", "-rotate-[30deg]", "rotate-[60deg]"];

export function DecisionRuleCard({
  headline,
  body,
  needed,
  total,
}: {
  headline: string;
  body: string;
  needed: number;
  total: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border border-line bg-paper-bright px-5 py-4">
      <div className="max-w-[22em] font-serif text-[1.02rem] leading-snug text-ink">
        <b className="display-heading mb-0.5 block text-[1.5rem] text-brand">{headline}</b>
        <span>{body}</span>
      </div>
      <div role="img" aria-label={votesLabel(needed, total)} className="flex items-center gap-[7px]">
        {Array.from({ length: total }, (_, i) => (
          <Pebble
            key={i}
            tone={i < needed ? "brand" : "empty"}
            className={`h-[26px] w-[30px] ${TILT[i % TILT.length]}`}
          />
        ))}
      </div>
    </div>
  );
}
```

`components/MembershipPath.tsx`:

```tsx
import { Pebble } from "./Pebble";

export function MembershipPath({ label, steps }: { label: string; steps: readonly string[] }) {
  return (
    <div>
      <div className="text-[0.74rem] font-bold tracking-[.2em] text-muted-fg">{label}</div>
      <ol className="relative mt-3.5 before:absolute before:top-[22px] before:bottom-[22px] before:left-[14px] before:w-0.5 before:bg-line">
        {steps.map((step, i) => (
          <li key={step} className="relative grid grid-cols-[30px_minmax(0,1fr)] items-start gap-4 py-3">
            <Pebble
              tone={i === steps.length - 1 ? "brand" : "outline"}
              className="relative z-[1] h-[27px] w-[30px] font-serif text-[0.85rem] font-bold"
            >
              {i + 1}
            </Pebble>
            <strong className="font-serif text-[1.08rem] leading-snug font-semibold text-ink">
              {step}
            </strong>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run components/Pebble.test.tsx components/DecisionRuleCard.test.tsx components/MembershipPath.test.tsx`
Expected: PASS (4 tests). Also run `npm run build` once here: it proves next/font accepts `axes: ["wdth"]` and Tailwind accepts the two `@utility` blocks. Expected: build succeeds.

- [ ] **Step 5: Gates and commit**

```bash
git add app/layout.tsx app/globals.css components/Pebble.tsx components/Pebble.test.tsx components/DecisionRuleCard.tsx components/DecisionRuleCard.test.tsx components/MembershipPath.tsx components/MembershipPath.test.tsx
git commit -F msg.txt   # "feat(structure): condensed display type, pebble primitive, rule card, membership path"
```

---

### Task 5: The two drawings — council and tally

**Files:**
- Create: `components/PebbleCouncil.tsx`, `components/PebbleCouncil.test.tsx`, `components/PebbleTally.tsx`, `components/PebbleTally.test.tsx`

**Interfaces:**
- Consumes: `councilLayout`, `COUNCIL_HALF`, `COUNCIL_RING`, `tallyLayout`, `TALLY_WIDTH`, `TALLY_HEIGHT`, `TALLY_DIVIDER`, `PebbleShape` (Task 2); `Pebble` (Task 4); class `council-seat` (Task 4).
- Produces: `PebbleCouncil({ seats: number; centerLabel: string; className?: string })`; `PebbleTally({ forLabel: string; againstLabel: string })`.

- [ ] **Step 1: Write the failing tests**

`components/PebbleCouncil.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PebbleCouncil } from "./PebbleCouncil";

describe("PebbleCouncil", () => {
  it("is a decorative drawing: one seat per board member around the label, members around them", () => {
    const { container } = render(<PebbleCouncil seats={5} centerLabel="ბორდი" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "-260 -260 520 520");
    expect(svg.querySelectorAll("ellipse.council-seat")).toHaveLength(5);
    expect(svg.querySelectorAll("ellipse.fill-line")).toHaveLength(160);
    expect(svg.querySelector("text")).toHaveTextContent("ბორდი");
  });

  it("staggers the seats' fade-in", () => {
    const { container } = render(<PebbleCouncil seats={5} centerLabel="ბორდი" />);
    const delays = Array.from(container.querySelectorAll<SVGElement>("ellipse.council-seat")).map(
      (e) => e.style.animationDelay,
    );
    expect(delays).toEqual(["0.15s", "0.27s", "0.39s", "0.51s", "0.63s"]);
  });
});
```

`components/PebbleTally.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PebbleTally } from "./PebbleTally";

describe("PebbleTally", () => {
  it("draws a wider for pile than against pile, and a visible legend", () => {
    const { container } = render(<PebbleTally forLabel="მომხრე" againstLabel="წინააღმდეგი" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll("ellipse.fill-brand")).toHaveLength(36);
    expect(svg.querySelectorAll("ellipse.fill-line")).toHaveLength(24);
    expect(screen.getByText("მომხრე")).toBeInTheDocument();
    expect(screen.getByText("წინააღმდეგი")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run components/PebbleCouncil.test.tsx components/PebbleTally.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`components/PebbleCouncil.tsx`:

```tsx
import { COUNCIL_HALF, COUNCIL_RING, councilLayout, type PebbleShape } from "@/lib/pebbles";

function Ellipse({ p, className, delay }: { p: PebbleShape; className: string; delay?: string }) {
  return (
    <ellipse
      cx={p.cx}
      cy={p.cy}
      rx={p.rx}
      ry={p.ry}
      opacity={p.opacity}
      transform={`rotate(${p.rotate} ${p.cx} ${p.cy})`}
      className={className}
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}

/** Hero drawing on /structure: the board's seats on a ring, members gathered around (spec §3.1). */
export function PebbleCouncil({
  seats,
  centerLabel,
  className = "",
}: {
  seats: number;
  centerLabel: string;
  className?: string;
}) {
  const layout = councilLayout(seats);
  const side = COUNCIL_HALF * 2;
  return (
    <svg
      aria-hidden="true"
      viewBox={`${-COUNCIL_HALF} ${-COUNCIL_HALF} ${side} ${side}`}
      className={`block h-auto w-full overflow-visible ${className}`}
    >
      {layout.members.map((p, i) => (
        <Ellipse key={`m${i}`} p={p} className="fill-line" />
      ))}
      <circle r={COUNCIL_RING} className="fill-none stroke-line" />
      {layout.seats.map((p, i) => (
        <Ellipse
          key={`s${i}`}
          p={p}
          className="council-seat fill-brand"
          delay={`${Math.round((0.15 + i * 0.12) * 100) / 100}s`}
        />
      ))}
      <text textAnchor="middle" y={9} fontSize={28} className="display-heading fill-ink">
        {centerLabel}
      </text>
    </svg>
  );
}
```

`components/PebbleTally.tsx`:

```tsx
import { TALLY_DIVIDER, TALLY_HEIGHT, TALLY_WIDTH, tallyLayout, type PebbleShape } from "@/lib/pebbles";
import { Pebble } from "./Pebble";

const shape = (p: PebbleShape, className: string, key: string) => (
  <ellipse
    key={key}
    cx={p.cx}
    cy={p.cy}
    rx={p.rx}
    ry={p.ry}
    transform={`rotate(${p.rotate} ${p.cx} ${p.cy})`}
    className={className}
  />
);

/** Illustrative general vote (spec §3.5): for pile wider than against pile. No numbers. */
export function PebbleTally({ forLabel, againstLabel }: { forLabel: string; againstLabel: string }) {
  const t = tallyLayout(9, 6);
  return (
    <div className="border border-line bg-paper-bright px-5 py-[18px]">
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${TALLY_WIDTH} ${TALLY_HEIGHT}`}
        className="mx-auto block h-auto w-full max-w-[640px]"
      >
        <line
          x1={TALLY_DIVIDER}
          x2={TALLY_DIVIDER}
          y1={8}
          y2={TALLY_HEIGHT - 8}
          strokeDasharray="3 6"
          className="stroke-line"
        />
        {t.for.map((p, i) => shape(p, "fill-brand", `f${i}`))}
        {t.against.map((p, i) => shape(p, "fill-line", `a${i}`))}
      </svg>
      <div className="mt-3.5 flex flex-wrap justify-between gap-3 text-[0.85rem] text-muted-fg">
        <span className="inline-flex items-center gap-2">
          <Pebble className="h-[11px] w-3" />
          {forLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <Pebble tone="empty" className="h-[11px] w-3 !bg-line" />
          {againstLabel}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run components/PebbleCouncil.test.tsx components/PebbleTally.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Gates and commit**

```bash
git add components/PebbleCouncil.tsx components/PebbleCouncil.test.tsx components/PebbleTally.tsx components/PebbleTally.test.tsx
git commit -F msg.txt   # "feat(structure): council and tally pebble drawings"
```

---

### Task 6: Board roster — social links, member card, empty state

**Files:**
- Create: `components/SocialLinks.tsx`, `components/SocialLinks.test.tsx`, `components/BoardMemberCard.tsx`, `components/BoardMemberCard.test.tsx`, `components/BoardRoster.tsx`, `components/BoardRoster.test.tsx`

**Interfaces:**
- Consumes: `BoardMember`, `SocialNetwork` (Task 3).
- Produces: `SocialLinks({ person: string; links: BoardMember["socials"] })`; `BoardMemberCard({ member: BoardMember })`; `BoardRoster({ members: readonly BoardMember[]; heading: string; notice: string; placeholders: number })` rendering a `<section id="roster">` with an `h2`.

- [ ] **Step 1: Write the failing tests**

`components/SocialLinks.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocialLinks } from "./SocialLinks";

describe("SocialLinks", () => {
  it("renders one safe external link per network, named for the person", () => {
    render(
      <SocialLinks
        person="Test Member"
        links={[
          { network: "facebook", url: "https://www.facebook.com/t" },
          { network: "tiktok", url: "https://www.tiktok.com/@t" },
          { network: "linkedin", url: "https://www.linkedin.com/in/t" },
        ]}
      />,
    );
    for (const [name, href, mark] of [
      ["Facebook: Test Member", "https://www.facebook.com/t", "fb"],
      ["TikTok: Test Member", "https://www.tiktok.com/@t", "tt"],
      ["LinkedIn: Test Member", "https://www.linkedin.com/in/t", "in"],
    ]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveTextContent(mark);
    }
  });

  it("renders nothing when the person has no links", () => {
    const { container } = render(<SocialLinks person="Test Member" links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

`components/BoardMemberCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardMemberCard } from "./BoardMemberCard";

describe("BoardMemberCard", () => {
  it("shows the photo with the name as alt text, the name, the bio and the links", () => {
    render(
      <BoardMemberCard
        member={{
          name: "Test Member",
          photo: "/board/test-member.jpg",
          bio: "Short bio.",
          socials: [{ network: "facebook", url: "https://www.facebook.com/t" }],
        }}
      />,
    );
    expect(screen.getByRole("img", { name: "Test Member" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Test Member" })).toBeInTheDocument();
    expect(screen.getByText("Short bio.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Facebook: Test Member" })).toBeInTheDocument();
  });
});
```

`components/BoardRoster.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardRoster } from "./BoardRoster";

const member = {
  name: "Test Member",
  photo: "/board/test-member.jpg",
  bio: "Short bio.",
  socials: [],
};

describe("BoardRoster", () => {
  it("with no members: the heading, the coming-soon notice and decorative placeholders", () => {
    const { container } = render(
      <BoardRoster members={[]} heading="ბორდის შემადგენლობა" notice="მალე" placeholders={5} />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "ბორდის შემადგენლობა" })).toBeInTheDocument();
    expect(screen.getByText("მალე")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-placeholder="true"]')).toHaveLength(5);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("with members: one card each, and no notice or placeholders", () => {
    const { container } = render(
      <BoardRoster
        members={[member, { ...member, name: "Second Member" }]}
        heading="ბორდის შემადგენლობა"
        notice="მალე"
        placeholders={5}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByText("მალე")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-placeholder="true"]')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run components/SocialLinks.test.tsx components/BoardMemberCard.test.tsx components/BoardRoster.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`components/SocialLinks.tsx`:

```tsx
import type { BoardMember, SocialNetwork } from "@/lib/board-members";

// Brand names stay in Latin (they are names, not prose); marks per the approved concept.
const NETWORK: Record<SocialNetwork, { name: string; mark: string }> = {
  facebook: { name: "Facebook", mark: "fb" },
  tiktok: { name: "TikTok", mark: "tt" },
  linkedin: { name: "LinkedIn", mark: "in" },
};

export function SocialLinks({ person, links }: { person: string; links: BoardMember["socials"] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex gap-2">
      {links.map(({ network, url }) => (
        <a
          key={network}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${NETWORK[network].name}: ${person}`}
          className="grid h-[30px] w-[30px] place-items-center border border-line text-[0.74rem] font-extrabold text-muted-fg no-underline transition-colors hover:border-ink hover:bg-ink hover:text-paper"
        >
          {NETWORK[network].mark}
        </a>
      ))}
    </div>
  );
}
```

`components/BoardMemberCard.tsx`:

```tsx
import Image from "next/image";
import type { BoardMember } from "@/lib/board-members";
import { SocialLinks } from "./SocialLinks";

export function BoardMemberCard({ member }: { member: BoardMember }) {
  return (
    <article className="grid content-start gap-3">
      <div className="relative aspect-[4/5] max-w-full overflow-hidden border border-line bg-paper-bright">
        <Image
          src={member.photo}
          alt={member.name}
          fill
          sizes="(max-width: 900px) 50vw, 230px"
          className="object-cover"
        />
      </div>
      <h3 className="font-serif text-[1.08rem] leading-snug font-bold text-ink">{member.name}</h3>
      <p className="text-[0.86rem] leading-relaxed text-muted-fg">{member.bio}</p>
      <SocialLinks person={member.name} links={member.socials} />
    </article>
  );
}
```

`components/BoardRoster.tsx`:

```tsx
import type { BoardMember } from "@/lib/board-members";
import { BoardMemberCard } from "./BoardMemberCard";

function Placeholder() {
  return (
    <div data-placeholder="true" aria-hidden="true" className="grid content-start gap-3">
      <div className="grid aspect-[4/5] max-w-full place-items-end justify-center overflow-hidden border border-line bg-paper-bright">
        <svg viewBox="0 0 100 100" className="block h-auto w-[78%] fill-line">
          <circle cx="50" cy="38" r="20" />
          <path d="M8 100c0-26 19-40 42-40s42 14 42 40z" />
        </svg>
      </div>
      <div className="h-[1.1em] w-[70%] bg-line opacity-55" />
      <div className="h-[3.6em] bg-line opacity-55" />
    </div>
  );
}

export function BoardRoster({
  members,
  heading,
  notice,
  placeholders,
}: {
  members: readonly BoardMember[];
  heading: string;
  notice: string;
  placeholders: number;
}) {
  const empty = members.length === 0;
  return (
    <section id="roster" className="scroll-mt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <h2 className="display-heading text-[clamp(2rem,4vw,3.1rem)] text-ink">{heading}</h2>
        {empty ? (
          <p className="inline-flex items-center gap-2 border border-line bg-paper-bright px-3.5 py-[7px] text-[0.85rem] font-bold text-muted-fg">
            <span className="h-2 w-2 rounded-full bg-brand motion-safe:animate-pulse" aria-hidden="true" />
            {notice}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-4 min-[900px]:grid-cols-5">
        {empty
          ? Array.from({ length: placeholders }, (_, i) => <Placeholder key={i} />)
          : members.map((m) => <BoardMemberCard key={m.name} member={m} />)}
      </div>
    </section>
  );
}
```

Note: `BoardRoster` owns its `section` and `h2` so the page composes it like the other sections; the page passes `placeholders={BOARD_SIZE}`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run components/SocialLinks.test.tsx components/BoardMemberCard.test.tsx components/BoardRoster.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Gates and commit**

```bash
git add components/SocialLinks.tsx components/SocialLinks.test.tsx components/BoardMemberCard.tsx components/BoardMemberCard.test.tsx components/BoardRoster.tsx components/BoardRoster.test.tsx
git commit -F msg.txt   # "feat(structure): board roster with coming-soon state, member card, social links"
```

---

### Task 7: The `/structure` route, navigation and sitemap

**Files:**
- Create: `app/(public)/structure/page.tsx`, `app/(public)/structure/page.test.tsx`
- Modify: `app/(public)/layout.tsx:21-36` (nav + footer arrays), `app/(public)/layout.test.tsx` (append a describe), `app/sitemap.ts:10-15`

**Interfaces:**
- Consumes: everything from Tasks 1–6; `ButtonLink` (`components/ButtonLink.tsx`, props `href`, `variant`, `size`); `SUPPORT_EYEBROW` (`lib/support-copy.ts`, the shared site-name suffix).
- Produces: route `/structure`; anchors `#board`, `#members`, `#vote`, `#roster`.

- [ ] **Step 1: Write the failing tests**

`app/(public)/structure/page.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as copy from "@/lib/structure-copy";
import StructurePage, { metadata } from "./page";

describe("/structure", () => {
  it("titles the tab with the page name and the site name", () => {
    expect(metadata.title).toBe("ორგანიზაციული სტრუქტურა — ქართული რესპუბლიკა");
  });

  it("renders the title, the intro and every approved section heading", () => {
    render(<StructurePage />);
    expect(screen.getByRole("heading", { level: 1, name: copy.STRUCTURE_TITLE })).toBeInTheDocument();
    expect(screen.getByText(copy.STRUCTURE_INTRO)).toBeInTheDocument();
    for (const h of [copy.BOARD_HEADING, copy.MEMBERS_HEADING, copy.VOTE_HEADING, copy.ROSTER_HEADING]) {
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    }
  });

  it("renders every approved sentence and list item", () => {
    render(<StructurePage />);
    for (const text of [
      copy.BOARD_LEAD,
      copy.BOARD_RULES_LABEL,
      copy.RULE_TWO_THIRDS.headline,
      copy.RULE_TWO_THIRDS.body,
      copy.RULE_MAJORITY.headline,
      copy.RULE_MAJORITY.body,
      copy.MEMBERS_LEAD,
      copy.MEMBERS_PATH_LABEL,
      copy.MEMBERS_RIGHTS_LABEL,
      copy.VOTE_LEAD,
      copy.VOTE_FOR,
      copy.VOTE_AGAINST,
      copy.ROSTER_NOTICE,
      ...copy.BOARD_DUTIES,
      ...copy.MEMBERS_PATH_STEPS,
      ...copy.MEMBERS_RIGHTS,
    ]) {
      expect(screen.getAllByText(text).length, text).toBeGreaterThan(0);
    }
  });

  it("shows 4 of 5 for the two-thirds rule and 3 of 5 for the majority rule", () => {
    render(<StructurePage />);
    expect(screen.getByRole("img", { name: "5-დან 4 ხმა" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "5-დან 3 ხმა" })).toBeInTheDocument();
  });

  it("links the section index to its anchors and the closing button to /join", () => {
    const { container } = render(<StructurePage />);
    const index = screen.getByRole("navigation", { name: copy.STRUCTURE_TITLE });
    for (const { href, label } of copy.SECTION_INDEX) {
      expect(within(index).getByRole("link", { name: label })).toHaveAttribute("href", href);
      expect(container.querySelector(href)).not.toBeNull();
    }
    expect(screen.getByRole("link", { name: copy.CLOSING_CTA })).toHaveAttribute("href", "/join");
  });

  it("launches with the coming-soon roster", () => {
    const { container } = render(<StructurePage />);
    expect(container.querySelectorAll('[data-placeholder="true"]')).toHaveLength(5);
  });
});
```

Append to `app/(public)/layout.test.tsx` (after the last `describe`):

```tsx
describe("public layout — structure link", () => {
  const STRUCTURE = "სტრუქტურა";

  it("links სტრუქტურა from the header, the footer and the phone menu", () => {
    renderLayout();
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: STRUCTURE }),
    ).toHaveAttribute("href", "/structure");
    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", { name: STRUCTURE }),
    ).toHaveAttribute("href", "/structure");
    fireEvent.click(screen.getByRole("button", { name: MENU }));
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: STRUCTURE })).toHaveAttribute(
      "href",
      "/structure",
    );
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run "app/(public)/structure/page.test.tsx" "app/(public)/layout.test.tsx"`
Expected: FAIL — page module missing; layout test "Unable to find role=link name სტრუქტურა".

- [ ] **Step 3: Implement**

`app/(public)/structure/page.tsx`:

```tsx
import type { Metadata } from "next";
import { BoardRoster } from "@/components/BoardRoster";
import { ButtonLink } from "@/components/ButtonLink";
import { DecisionRuleCard } from "@/components/DecisionRuleCard";
import { MembershipPath } from "@/components/MembershipPath";
import { Pebble } from "@/components/Pebble";
import { PebbleCouncil } from "@/components/PebbleCouncil";
import { PebbleTally } from "@/components/PebbleTally";
import { BOARD_MEMBERS } from "@/lib/board-members";
import { BOARD_SIZE, votesNeeded } from "@/lib/board-rules";
import {
  BOARD_DUTIES,
  BOARD_DUTIES_LABEL,
  BOARD_HEADING,
  BOARD_LEAD,
  BOARD_RULES_LABEL,
  CLOSING_CTA,
  MEMBERS_HEADING,
  MEMBERS_LEAD,
  MEMBERS_PATH_LABEL,
  MEMBERS_PATH_STEPS,
  MEMBERS_RIGHTS,
  MEMBERS_RIGHTS_LABEL,
  ROSTER_HEADING,
  ROSTER_NOTICE,
  RULE_MAJORITY,
  RULE_TWO_THIRDS,
  SECTION_INDEX,
  STRUCTURE_INTRO,
  STRUCTURE_TITLE,
  VOTE_AGAINST,
  VOTE_FOR,
  VOTE_HEADING,
  VOTE_LEAD,
} from "@/lib/structure-copy";
import { SUPPORT_EYEBROW } from "@/lib/support-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export const metadata: Metadata = { title: `${STRUCTURE_TITLE} — ${SUPPORT_EYEBROW}` };

const WRAP = "mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-10";
const LABEL = "text-[0.74rem] font-bold tracking-[.2em] text-muted-fg";
// Board follows the index strip's own rule, so only later sections draw a top border.
const SECTION = "scroll-mt-6 py-[clamp(36px,5vw,64px)]";
const RULED = `${SECTION} border-t border-line`;
const H2 = "display-heading text-[clamp(2rem,4vw,3.1rem)] text-ink";
const LEAD = "mt-2.5 max-w-[40em] font-serif text-[clamp(1rem,1.4vw,1.1rem)] leading-relaxed text-muted-fg";
const BIG_LETTER =
  "hidden font-serif text-[clamp(4rem,8vw,6.5rem)] leading-[.7] font-extrabold text-transparent select-none [-webkit-text-stroke:1.5px_var(--color-line)] min-[900px]:block";
const TWO_COL = "grid gap-[clamp(28px,4vw,60px)] min-[900px]:grid-cols-2";

function SectionHead({ id, letter, title, lead }: { id: string; letter: string; title: string; lead: string }) {
  return (
    <div className="mb-[clamp(20px,3vw,32px)] grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
      <div>
        <h2 id={`${id}-title`} className={H2}>
          {title}
        </h2>
        <p className={LEAD}>{lead}</p>
      </div>
      <div aria-hidden="true" className={BIG_LETTER}>
        {letter}
      </div>
    </div>
  );
}

function PebbleList({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div>
      <div className={LABEL}>{label}</div>
      <ul className="mt-3.5">
        {items.map((item, i) => (
          <li
            key={item}
            className="grid grid-cols-[22px_minmax(0,1fr)] gap-3 border-b border-line py-2.5 font-serif text-[1.02rem] leading-normal text-ink first:border-t"
          >
            <Pebble className={`mt-[0.5em] h-3 w-[13px] ${i % 2 ? "rotate-[40deg]" : ""}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StructurePage() {
  const [firstWord, ...rest] = STRUCTURE_TITLE.split(" ");
  const letter = (href: string) => SECTION_INDEX.find((s) => s.href === href)?.letter ?? "";

  return (
    <main>
      <section className={`${WRAP} grid items-center gap-[clamp(20px,4vw,56px)] py-[clamp(28px,4vw,48px)] min-[900px]:grid-cols-[minmax(0,1fr)_auto]`}>
        <div>
          <h1 className="display-heading mb-4 text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.05] text-ink">
            {firstWord} <span className="text-brand">{rest.join(" ")}</span>
          </h1>
          <p className="max-w-[36em] font-serif text-[clamp(1.02rem,1.5vw,1.15rem)] leading-relaxed text-muted-fg">
            {STRUCTURE_INTRO}
          </p>
        </div>
        <PebbleCouncil
          seats={BOARD_SIZE}
          centerLabel={BOARD_HEADING}
          className="hidden w-[clamp(150px,22vw,250px)] min-[900px]:block"
        />
      </section>

      <nav aria-label={STRUCTURE_TITLE} className="border-y border-line">
        <div className={`${WRAP} grid min-[900px]:grid-cols-3`}>
          {SECTION_INDEX.map(({ href, letter: l, label }, i) => (
            <a
              key={href}
              href={href}
              className={`group flex items-center gap-3.5 py-3.5 text-ink no-underline ${i > 0 ? "border-t border-line min-[900px]:border-t-0 min-[900px]:border-l min-[900px]:pl-5" : ""}`}
            >
              <span
                aria-hidden="true"
                className="font-serif text-[2.4rem] leading-[.8] font-extrabold text-transparent transition-colors [-webkit-text-stroke:1.5px_var(--color-brand)] group-hover:text-brand"
              >
                {l}
              </span>
              <span className="display-heading text-[1.15rem]">{label}</span>
            </a>
          ))}
        </div>
      </nav>

      <section id="board" aria-labelledby="board-title" className={SECTION}>
        <div className={WRAP}>
          <SectionHead id="board" letter={letter("#board")} title={BOARD_HEADING} lead={BOARD_LEAD} />
          <div className={TWO_COL}>
            <PebbleList label={BOARD_DUTIES_LABEL} items={BOARD_DUTIES} />
            <div>
              <div className={LABEL}>{BOARD_RULES_LABEL}</div>
              <div className="mt-3.5 grid gap-3.5">
                <DecisionRuleCard
                  headline={RULE_TWO_THIRDS.headline}
                  body={RULE_TWO_THIRDS.body}
                  needed={votesNeeded("twoThirds", BOARD_SIZE)}
                  total={BOARD_SIZE}
                />
                <DecisionRuleCard
                  headline={RULE_MAJORITY.headline}
                  body={RULE_MAJORITY.body}
                  needed={votesNeeded("majority", BOARD_SIZE)}
                  total={BOARD_SIZE}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="members" aria-labelledby="members-title" className={RULED}>
        <div className={WRAP}>
          <SectionHead id="members" letter={letter("#members")} title={MEMBERS_HEADING} lead={MEMBERS_LEAD} />
          <div className={TWO_COL}>
            <MembershipPath label={MEMBERS_PATH_LABEL} steps={MEMBERS_PATH_STEPS} />
            <PebbleList label={MEMBERS_RIGHTS_LABEL} items={MEMBERS_RIGHTS} />
          </div>
        </div>
      </section>

      <section id="vote" aria-labelledby="vote-title" className={RULED}>
        <div className={WRAP}>
          <SectionHead id="vote" letter={letter("#vote")} title={VOTE_HEADING} lead={VOTE_LEAD} />
          <PebbleTally forLabel={VOTE_FOR} againstLabel={VOTE_AGAINST} />
        </div>
      </section>

      <div className={RULED}>
        <div className={WRAP}>
          <BoardRoster
            members={BOARD_MEMBERS}
            heading={ROSTER_HEADING}
            notice={ROSTER_NOTICE}
            placeholders={BOARD_SIZE}
          />
        </div>
      </div>

      <div className="flex justify-center border-t border-line py-[clamp(28px,4vw,44px)]">
        <ButtonLink href="/join" size="lg">
          {CLOSING_CTA}
        </ButtonLink>
      </div>
    </main>
  );
}
```

`app/(public)/layout.tsx` — add the import and the two entries:

```tsx
import { STRUCTURE_HREF, STRUCTURE_NAV_LABEL } from "@/lib/structure-copy";
```

```tsx
const navItems: { href: string; label: string }[] = [
  { href: "/", label: "მთავარი" },
  { href: "/leaderboard", label: "რეიტინგი" },
  { href: "/news", label: NAV_NEWS_LABEL },
  { href: "/events", label: "ღონისძიებები" },
  { href: STRUCTURE_HREF, label: STRUCTURE_NAV_LABEL },
  { href: FINANCES_HREF, label: NAV_TRANSPARENCY_LABEL },
];

const footerLinks: { href: string; label: string }[] = [
  { href: "/join/terms", label: FOOTER_TERMS_LABEL },
  { href: "/news", label: NAV_NEWS_LABEL },
  { href: STRUCTURE_HREF, label: STRUCTURE_NAV_LABEL },
  { href: FINANCES_HREF, label: NAV_TRANSPARENCY_LABEL },
  // Footer, not top nav (spec §8): contact is a destination people go looking
  // for, not a section of the publication.
  { href: "/support", label: SUPPORT_FOOTER_LABEL },
];
```

`app/sitemap.ts` — add after the `/leaderboard` line:

```ts
    { url: `${base}/structure`, changeFrequency: "monthly", priority: 0.7 },
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run "app/(public)/structure/page.test.tsx" "app/(public)/layout.test.tsx" app/route-groups.test.tsx`
Expected: PASS (all; route-groups unchanged since `(public)` already has `not-found.tsx`).

- [ ] **Step 5: Gates, full unit suite, commit**

Run the per-task gates plus `npm test` (whole suite, to catch any other test that enumerates nav items).

```bash
git add "app/(public)/structure" "app/(public)/layout.tsx" "app/(public)/layout.test.tsx" app/sitemap.ts
git commit -F msg.txt   # "feat(structure): /structure page, header + footer + phone menu link, sitemap"
```

---

### Task 8: Living styleguide and design records

**Files:**
- Modify: `app/(public)/styleguide/page.tsx` (add one `Card` before the mobile-chrome card, item "17" → renumber the comment of the mobile card to 18), `DESIGN.md` (component register + a short "Display headings" note under Type), `DECISIONS.md` (append ADR-037)

**Interfaces:**
- Consumes: `Pebble`, `DecisionRuleCard`, `MembershipPath`, `PebbleTally`, `BoardRoster` (Tasks 4–6); copy from Task 1.

- [ ] **Step 1: Write the failing test**

Append to `app/(public)/styleguide/styleguide.test.tsx` (inside the file's existing `describe`, matching its render pattern):

```tsx
  it("shows the structure-page pieces: display heading, rule card and empty roster", () => {
    render(<StyleguidePage />);
    expect(screen.getByRole("img", { name: "5-დან 4 ხმა" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "ბორდის შემადგენლობა" })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-placeholder="true"]').length).toBeGreaterThan(0);
  });
```

(If the file's existing tests import the page under a different local name, use that name.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "app/(public)/styleguide/styleguide.test.tsx"`
Expected: FAIL — no element with role img named `5-დან 4 ხმა`.

- [ ] **Step 3: Implement**

In `app/(public)/styleguide/page.tsx` add imports:

```tsx
import { BoardRoster } from "@/components/BoardRoster";
import { DecisionRuleCard } from "@/components/DecisionRuleCard";
import { MembershipPath } from "@/components/MembershipPath";
import { PebbleTally } from "@/components/PebbleTally";
import {
  MEMBERS_PATH_LABEL,
  MEMBERS_PATH_STEPS,
  ROSTER_HEADING,
  ROSTER_NOTICE,
  RULE_TWO_THIRDS,
  STRUCTURE_TITLE,
  VOTE_AGAINST,
  VOTE_FOR,
} from "@/lib/structure-copy";
```

and, immediately before the `{/* 17. Mobile chrome.` comment (renumber that comment to 18):

```tsx
        {/* 17. /structure pieces (ADR-037): the condensed display heading, the
            pebble rule card, the membership path, the tally and the roster's
            launch (empty) state. Copy comes from lib/structure-copy.ts. */}
        <Card title={STRUCTURE_TITLE}>
          <div className="flex flex-col gap-6">
            <p className="display-heading text-[2.4rem] text-ink">{STRUCTURE_TITLE}</p>
            <DecisionRuleCard
              headline={RULE_TWO_THIRDS.headline}
              body={RULE_TWO_THIRDS.body}
              needed={4}
              total={5}
            />
            <MembershipPath label={MEMBERS_PATH_LABEL} steps={MEMBERS_PATH_STEPS} />
            <PebbleTally forLabel={VOTE_FOR} againstLabel={VOTE_AGAINST} />
            <BoardRoster members={[]} heading={ROSTER_HEADING} notice={ROSTER_NOTICE} placeholders={2} />
          </div>
        </Card>
```

`DESIGN.md` — under "## Type (spec §2.3)", after the "Sans —" bullet, add:

```md
- **Display (condensed)** — `display-heading` utility: Noto Sans Georgian at `font-stretch: 68%`,
  weight ~850, tight leading. Used only on `/structure` headings for now (ADR-037).
```

and append to the "### Furniture" component-register table these rows:

```md
| `Pebble`                 | `{ tone?, className?, children? }`                                       | The `/structure` motif (ADR-037): an irregular rounded shape via the `pebble` utility; tones `brand` (filled), `empty` (surface + line), `outline` (bright + brand ring). Decorative (`aria-hidden`). The one sanctioned organic shape; square corners stay the rule elsewhere. |
| `DecisionRuleCard`       | `{ headline, body, needed, total }`                                      | Rule headline in condensed display red, body in serif, and `total` pebbles with `needed` filled; the pebble row is `role="img"` named `5-დან 4 ხმა`.                                                                                                                   |
| `MembershipPath`         | `{ label, steps }`                                                       | Ordered steps on a vertical hairline; numbered outline pebbles, the last filled.                                                                                                                                                                                       |
| `PebbleCouncil`          | `{ seats, centerLabel, className? }`                                     | `/structure` hero drawing from `councilLayout()`; seats fade in once (reduced-motion: none).                                                                                                                                                                           |
| `PebbleTally`            | `{ forLabel, againstLabel }`                                             | Illustrative vote: 9×4 brand pebbles vs 6×4 line pebbles, dashed divider, visible legend; drawing is `aria-hidden`.                                                                                                                                                    |
| `BoardRoster`            | `{ members, heading, notice, placeholders }`                             | Empty → notice chip + silhouette placeholders; otherwise `BoardMemberCard`s (photo 4:5, name, bio, `SocialLinks` fb/tt/in).                                                                                                                                             |
```

`DECISIONS.md` — append:

```md
## ADR-037 (2026-10-07): The structure page's condensed display type and pebble motif

Owner decisions, taken in chat on 2026-10-07 while designing `/structure`.

- **Information only.** The page explains the board, members and general vote in owner-approved
  short text (spec §2); it changes no flow on the site. The board roster lives in code
  (`lib/board-members.ts`), launches empty with a coming-soon notice, and each roster change
  ships through a preview for owner sign-off. Social links are Facebook, TikTok and LinkedIn,
  each optional per person; no email or phone.
- **A deliberate departure from Kronika, scoped to this page.** The owner asked for a more
  visual page and approved a concept with condensed display headings and a pebble motif
  (კენჭისყრა is literally casting pebbles). The page keeps the public chrome and the existing
  colour tokens; the concept's cooler ground became the site's paper so it sits in the sheet.
- **Cost.** The condensed headings load the `wdth` axis of Noto Sans Georgian for the whole
  site (next/font serves one variable file), slightly heavier font bytes on every page. No new
  dependency.
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run "app/(public)/styleguide/styleguide.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

`npx prettier --write DESIGN.md` will not apply (docs are prettier-ignored); check the table renders by eye.

```bash
git add "app/(public)/styleguide/page.tsx" "app/(public)/styleguide/styleguide.test.tsx" DESIGN.md DECISIONS.md
git commit -F msg.txt   # "docs(structure): styleguide gallery, design register rows, ADR-037"
```

---

### Task 9: End-to-end journey and phone-width sweep

**Files:**
- Modify: `e2e/public.spec.ts` (append a `describe`), `e2e/responsive.spec.ts:4-19` (add the path)

- [ ] **Step 1: Write the tests**

Append to `e2e/public.spec.ts`:

```ts
test.describe("structure page", () => {
  test("the header link opens it; sections, rules, roster notice and anchors work", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation").first().getByRole("link", { name: "სტრუქტურა" }).click();
    await expect(page).toHaveURL(/\/structure$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "ორგანიზაციული სტრუქტურა" }),
    ).toBeVisible();
    for (const name of ["ბორდი", "წევრები", "საერთო კენჭისყრა", "ბორდის შემადგენლობა"]) {
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("img", { name: "5-დან 4 ხმა" })).toBeVisible();
    await expect(page.getByRole("img", { name: "5-დან 3 ხმა" })).toBeVisible();
    await expect(page.getByText("ბორდის შემადგენლობა მალე გამოქვეყნდება")).toBeVisible();

    await page
      .getByRole("navigation", { name: "ორგანიზაციული სტრუქტურა" })
      .getByRole("link", { name: "საერთო კენჭისყრა", exact: true })
      .click();
    await expect(page).toHaveURL(/\/structure#vote$/);
    await expect(page.getByRole("heading", { level: 2, name: "საერთო კენჭისყრა", exact: true })).toBeInViewport();
  });
});
```

In `e2e/responsive.spec.ts`, add `"/structure",` to `PAGES` after `"/support",`.

- [ ] **Step 2: Run them**

Run (worktree recipe — see memory "Worktree e2e invocation": absolute Playwright CLI path and a copied `.env.local`; do not trust a wrapper's exit code, read the summary line):
`node "<main checkout>/node_modules/@playwright/test/cli.js" test e2e/public.spec.ts e2e/responsive.spec.ts -g "structure|360px"`
Expected: the new structure test PASSES and `no overflow at /structure` PASSES. (They are written against finished code, so a red run here means a real bug in Tasks 1–7 — fix it there, not in the test.)

- [ ] **Step 3: Commit**

```bash
git add e2e/public.spec.ts e2e/responsive.spec.ts
git commit -F msg.txt   # "test(e2e): structure page journey and 360px overflow sweep"
```

---

## After the tasks (process, per CLAUDE.md)

1. Whole-branch review (requesting-code-review), fix findings.
2. Full gates: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && npm run ka:scan`, then e2e.
3. Push the branch, open the PR (body: plain-language summary, "merge releases to both sites; no migrations, no env vars"), let CI run.
4. `/qa` on the Vercel preview: desktop and 390px phone screenshots of every section; confirm the header, phone menu and footer links.
5. Owner sign-off on the preview link with plain-language notes and those screenshots. Merge only after an explicit yes.
6. After merge: open `https://georgia-republic.vercel.app/structure` and confirm it renders.
