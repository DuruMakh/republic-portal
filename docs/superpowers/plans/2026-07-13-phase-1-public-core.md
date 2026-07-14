# Phase 1 — Public Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the real public face of the platform on seeded staging data: Home (hero + live counters), delegate directory (region filter + search), leaderboard (top-3 medals), and public delegate pages with per-delegate OG share cards — server-rendered with 60-second ISR.

**Architecture:** Public pages read Postgres **views** (`public_delegates`, `public_stats`) through a cookie-free anon Supabase client so ISR stays static; direct client access to the `delegates` base table is revoked. Ranking/slug/formatting logic is pure TypeScript in `lib/`. Staging data comes from a deterministic seed script (prototype roster). OG images are generated per-delegate at request time via `next/og`.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript 6 strict, Tailwind CSS 4, Supabase (`@supabase/supabase-js`, views + RLS), Vitest + Testing Library, Playwright, `next/og` (satori) with a bundled Noto Sans Georgian TTF.

**Spec:** `docs/superpowers/specs/2026-07-13-phase-1-public-core-design.md` — binding. UX reference: `prototype/index.html` screens `home`/`delegates`/`leaderboard`/`delegate-public`.

## Global Constraints

- TypeScript `strict: true`; **no `any`, no `@ts-ignore`** (`@ts-expect-error` with reason only if truly unavoidable).
- Domain logic = pure functions in `lib/` — no React/Next imports there (`lib/supabase/` is the sanctioned data-access location).
- **All user-facing text Georgian.** Reuse design-system components (DESIGN.md); extend components rather than restyling ad hoc.
- Schema changes ONLY via `supabase/migrations/`. Never mutate data by hand — seeding via committed script only.
- **No new npm dependencies.** `next/og` ships with Next; the OG font is a committed asset.
- Every public page: `export const revalidate = 60`. Public pages must never call `cookies()`/`headers()` (kills ISR) — use `lib/supabase/public.ts` only.
- Demo banner + robots gate on `NEXT_PUBLIC_APP_ENV !== "production"`.
- TDD: write the failing test first, run it, watch it fail, then implement. Frequent commits (conventional style), each task ends committed.
- Working directory: repo root (worktree `claude/phase-1-public-core`). Cross-shell commands (`npm`, `npx`, `git`, `node`).
- Steps marked **[OWNER-ASSIST]** need the owner (interactive password/dashboard input). Pause and give exact plain-language instructions.

---

### Task 1: Georgian transliteration + slugs (`lib/slug.ts`)

**Files:**
- Create: `lib/slug.ts`
- Test: `lib/slug.test.ts`

**Interfaces:**
- Produces: `transliterateGeorgian(text: string): string`; `makeSlug(fullName: string, taken: ReadonlySet<string>): string` (lowercase `a-z0-9-`, collision → `-2`, `-3`, …). Consumed by Task 4's roster cross-check test and (Phase 4) approval flow.

- [ ] **Step 1: Write the failing test — `lib/slug.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { makeSlug, transliterateGeorgian } from "./slug";

describe("transliterateGeorgian", () => {
  it("maps every Georgian letter (aspirates unmarked)", () => {
    expect(transliterateGeorgian("აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ")).toBe(
      "abgdevztiklmnopzhrstupkghqshchtsdztschkhjh"
    );
  });
  it("transliterates real names", () => {
    expect(transliterateGeorgian("გიორგი მაისურაძე")).toBe("giorgi maisuradze");
    expect(transliterateGeorgian("თამარ ქავთარაძე")).toBe("tamar kavtaradze");
    expect(transliterateGeorgian("მარიამ წიქარიშვილი")).toBe("mariam tsikarishvili");
    expect(transliterateGeorgian("ბექა ღოღობერიძე")).toBe("beka ghoghoberidze");
  });
  it("passes through Latin and digits untouched", () => {
    expect(transliterateGeorgian("abc 123")).toBe("abc 123");
  });
});

describe("makeSlug", () => {
  it("builds a lowercase hyphenated slug", () => {
    expect(makeSlug("გიორგი მაისურაძე", new Set())).toBe("giorgi-maisuradze");
  });
  it("collapses whitespace/punctuation runs and trims hyphens", () => {
    expect(makeSlug("  ანა   ჯაფარიძე  ", new Set())).toBe("ana-japaridze");
  });
  it("suffixes on collision", () => {
    const taken = new Set(["giorgi-maisuradze"]);
    expect(makeSlug("გიორგი მაისურაძე", taken)).toBe("giorgi-maisuradze-2");
    expect(makeSlug("გიორგი მაისურაძე", new Set(["giorgi-maisuradze", "giorgi-maisuradze-2"]))).toBe(
      "giorgi-maisuradze-3"
    );
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- lib/slug.test.ts`. Expected: FAIL — cannot resolve `./slug`.
- [ ] **Step 3: Implement `lib/slug.ts`**

```ts
/**
 * Georgian → Latin per the national romanization system with aspirate
 * apostrophes dropped (URL-safe): თ/ტ→t, ფ/პ→p, ქ/კ→k, წ/ც→ts, ჭ/ჩ→ch, ყ→q.
 */
const MAP: Readonly<Record<string, string>> = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i",
  კ: "k", ლ: "l", მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh", რ: "r", ს: "s",
  ტ: "t", უ: "u", ფ: "p", ქ: "k", ღ: "gh", ყ: "q", შ: "sh", ჩ: "ch", ც: "ts",
  ძ: "dz", წ: "ts", ჭ: "ch", ხ: "kh", ჯ: "j", ჰ: "h",
};

export function transliterateGeorgian(text: string): string {
  return [...text].map((ch) => MAP[ch] ?? ch).join("");
}

export function makeSlug(fullName: string, taken: ReadonlySet<string>): string {
  const base = transliterateGeorgian(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
```

- [ ] **Step 4: Run to verify pass.** Run: `npm run test -- lib/slug.test.ts`. Expected: all PASS.
- [ ] **Step 5: Commit**

```bash
git add lib/slug.ts lib/slug.test.ts
git commit -m "feat: Georgian transliteration and slug generation (TDD)"
```

### Task 2: Ranking, formatting, site-URL helpers (`lib/ranking.ts`, `lib/format.ts`, `lib/site.ts`)

**Files:**
- Create: `lib/ranking.ts`, `lib/format.ts`, `lib/site.ts`
- Test: `lib/ranking.test.ts`, `lib/format.test.ts`, `lib/site.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 6–10, 12):
  - `interface PublicDelegate { id: string; slug: string; first_name: string; last_name: string; region_id: number | null; region_name_ka: string | null; bio: string | null; photo_url: string | null; active_supporters: number }`
  - `interface RankedDelegate extends PublicDelegate { rank: number }`
  - `rankDelegates<T extends Rankable>(rows: T[]): (T & { rank: number })[]` — supporters desc, ties by Georgian collation of full name
  - `medalFor(rank: number): "🥇" | "🥈" | "🥉" | null`
  - `formatCountKa(n: number): string` (ka-GE locale)
  - `delegateBioFallback(regionNameKa: string): string` (prototype line)
  - `siteUrl(): string`

- [ ] **Step 1: Write the failing tests**

`lib/ranking.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { medalFor, rankDelegates } from "./ranking";

const d = (first: string, last: string, sup: number) => ({
  first_name: first,
  last_name: last,
  active_supporters: sup,
});

describe("rankDelegates", () => {
  it("orders by active supporters descending and assigns 1-based ranks", () => {
    const ranked = rankDelegates([d("ეკა", "მელაძე", 98), d("გიორგი", "მაისურაძე", 342)]);
    expect(ranked.map((r) => [r.first_name, r.rank])).toEqual([
      ["გიორგი", 1],
      ["ეკა", 2],
    ]);
  });
  it("breaks ties by Georgian collation of the full name", () => {
    const ranked = rankDelegates([d("ბექა", "ბერიძე", 50), d("ანა", "ბერიძე", 50)]);
    expect(ranked[0]?.first_name).toBe("ანა");
    expect(ranked[1]?.first_name).toBe("ბექა");
  });
  it("does not mutate its input", () => {
    const input = [d("ა", "ა", 1), d("ბ", "ბ", 2)];
    const copy = structuredClone(input);
    rankDelegates(input);
    expect(input).toEqual(copy);
  });
});

describe("medalFor", () => {
  it("maps 1/2/3 to medals and everything else to null", () => {
    expect(medalFor(1)).toBe("🥇");
    expect(medalFor(2)).toBe("🥈");
    expect(medalFor(3)).toBe("🥉");
    expect(medalFor(4)).toBeNull();
    expect(medalFor(0)).toBeNull();
  });
});
```

`lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { delegateBioFallback, formatCountKa } from "./format";

describe("formatCountKa", () => {
  it("formats with ka-GE locale grouping", () => {
    expect(formatCountKa(342)).toBe((342).toLocaleString("ka-GE"));
    expect(formatCountKa(1636)).toBe((1636).toLocaleString("ka-GE"));
  });
});

describe("delegateBioFallback", () => {
  it("renders the prototype's generated line for a region", () => {
    expect(delegateBioFallback("იმერეთი")).toBe(
      "იმერეთის რეგიონული დელეგატი. წარმოადგენს ადგილობრივი მოქალაქეების ხმას პლატფორმაზე, აშენებს გუნდს და ანგარიშვალდებულია საკუთარი მხარდამჭერების წინაშე."
    );
  });
});
```

`lib/site.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("uses the production domain in production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "portal.example.ge");
    expect(siteUrl()).toBe("https://portal.example.ge");
  });
  it("uses the deployment URL on previews", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "portal-abc123.vercel.app");
    expect(siteUrl()).toBe("https://portal-abc123.vercel.app");
  });
  it("falls back to localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "development");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- lib/ranking.test.ts lib/format.test.ts lib/site.test.ts`. Expected: FAIL — modules not found.
- [ ] **Step 3: Implement**

`lib/ranking.ts`:

```ts
export interface PublicDelegate {
  id: string;
  slug: string;
  first_name: string;
  last_name: string;
  region_id: number | null;
  region_name_ka: string | null;
  bio: string | null;
  photo_url: string | null;
  active_supporters: number;
}

export interface RankedDelegate extends PublicDelegate {
  rank: number;
}

interface Rankable {
  first_name: string;
  last_name: string;
  active_supporters: number;
}

const collator = new Intl.Collator("ka");

/** Supporters descending; ties by Georgian collation of "first last". Pure. */
export function rankDelegates<T extends Rankable>(rows: T[]): (T & { rank: number })[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.active_supporters - a.active_supporters ||
        collator.compare(`${a.first_name} ${a.last_name}`, `${b.first_name} ${b.last_name}`)
    )
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export function medalFor(rank: number): "🥇" | "🥈" | "🥉" | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}
```

`lib/format.ts`:

```ts
export function formatCountKa(n: number): string {
  return n.toLocaleString("ka-GE");
}

/** Prototype's generated bio line (pb_bioLine) for delegates without a stored bio. */
export function delegateBioFallback(regionNameKa: string): string {
  return `${regionNameKa}ის რეგიონული დელეგატი. წარმოადგენს ადგილობრივი მოქალაქეების ხმას პლატფორმაზე, აშენებს გუნდს და ანგარიშვალდებულია საკუთარი მხარდამჭერების წინაშე.`;
}
```

`lib/site.ts`:

```ts
/** Absolute origin for metadata/OG/sitemap. Env-driven, no request context. */
export function siteUrl(): string {
  if (
    process.env.NEXT_PUBLIC_APP_ENV === "production" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
```

- [ ] **Step 4: Run to verify pass.** Run: `npm run test`. Expected: all PASS (including Phase 0 suites).
- [ ] **Step 5: Commit**

```bash
git add lib/ranking.ts lib/ranking.test.ts lib/format.ts lib/format.test.ts lib/site.ts lib/site.test.ts
git commit -m "feat: ranking, ka formatting and site-url helpers (TDD)"
```

### Task 3: Migration — public read model **[OWNER-ASSIST for db password]**

**Files:**
- Create: `supabase/migrations/<timestamp>_public_read_model.sql` (via CLI)
- Modify: `scripts/verify-schema.mjs`

**Interfaces:**
- Produces: views `public_delegates` (columns exactly as `PublicDelegate` in Task 2) and `public_stats` (`approved_delegates: number`, `active_members: number`); `delegates.slug` column. Consumed by Tasks 4, 6–10.

- [ ] **Step 1: Create the migration.** Run: `npx supabase migration new public_read_model`, then fill the generated file:

```sql
-- Phase 1: public read model.
-- Views are intentionally definer-style (owned by postgres, no security_invoker):
-- they exist precisely to expose a fixed, safe column set from RLS-protected
-- tables to anonymous visitors. Supabase's linter will flag them — documented
-- exception, see docs/superpowers/specs/2026-07-13-phase-1-public-core-design.md §4.

-- Delegate page slugs (seed backfills; Phase 4 approval flow generates)
alter table delegates add column slug text unique;
alter table delegates add constraint approved_delegates_have_slug
  check (status <> 'approved' or slug is not null);

-- Serve the per-delegate active-supporter count
create index memberships_active_by_delegate
  on memberships (delegate_id) where ended_at is null;

create view public_delegates as
select
  d.id,
  d.slug,
  p.first_name,
  p.last_name,
  p.region_id,
  r.name_ka as region_name_ka,
  d.bio,
  d.photo_url,
  coalesce(s.cnt, 0)::int as active_supporters
from delegates d
join profiles p on p.id = d.id
left join regions r on r.id = p.region_id
left join lateral (
  select count(*) as cnt
  from memberships m
  join profiles mp on mp.id = m.member_id
  where m.delegate_id = d.id
    and m.ended_at is null
    and mp.status = 'active_member'
) s on true
where d.status = 'approved';

create view public_stats as
select
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int from profiles where status = 'active_member') as active_members;

grant select on public_delegates, public_stats to anon, authenticated;

-- Close the Phase 0 deferred item: public reads go ONLY through the views.
-- (The old policy exposed tc_accepted_at/verified_at/verified_by/referral_code
-- on approved rows to any client.)
drop policy "approved delegates are public" on delegates;
revoke select on delegates from anon, authenticated;

-- Deferred-item rider: created_at joins the server-managed profile columns.
create or replace function protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated')
    and (new.status is distinct from old.status
      or new.personal_id is distinct from old.personal_id
      or new.phone is distinct from old.phone
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at)
  then
    raise exception 'profiles.status, personal_id, phone, id and created_at are server-managed';
  end if;
  return new;
end $$;
```

- [ ] **Step 2: Extend the verification script.** Replace the final `console.log` line of `scripts/verify-schema.mjs` with:

```js
// --- Phase 1: public read model probes ---
const { data: viewRows, error: e4 } = await anon
  .from("public_delegates")
  .select("id, slug, first_name, last_name, region_id, region_name_ka, bio, photo_url, active_supporters")
  .limit(3);
if (e4) throw new Error(`anon cannot read public_delegates: ${e4.message}`);

const { error: e5 } = await anon.from("public_stats").select("*").single();
if (e5) throw new Error(`anon cannot read public_stats: ${e5.message}`);

const { data: baseLeak, error: e6 } = await anon.from("delegates").select("tc_accepted_at").limit(1);
if (!e6 && baseLeak && baseLeak.length > 0)
  throw new Error("LEAK: anon can read the delegates base table");
if (e6 && e6.code !== "42501")
  console.log(`note: delegates base-table probe returned ${e6.code} (${e6.message})`);

console.log(
  `OK: ${regionCount} regions, ${cityCount} cities, RLS holding, public views readable (${viewRows.length} sample rows), delegates base table sealed`
);
```

- [ ] **Step 3 [OWNER-ASSIST]: Link the CLI to staging.** Run: `npx supabase link --project-ref orcxtbedkexoclbfgvzd`. The CLI asks for the staging database password — the owner pastes it from their password manager (plain-language prompt: "please paste the staging database password you saved during Phase 0 setup; it is not stored anywhere").
- [ ] **Step 4: Apply.** Run: `npx supabase db push`. Expected: `_public_read_model.sql` applied without error.
- [ ] **Step 5: Verify.** Run: `node --env-file=.env.local scripts/verify-schema.mjs`. Expected: `OK: 11 regions, ... public views readable (0 sample rows), delegates base table sealed` (0 rows until Task 4 seeds).
- [ ] **Step 6: Commit**

```bash
git add supabase/migrations scripts/verify-schema.mjs
git commit -m "feat: public read model (views, slug column, base-table seal, created_at protection)"
```

### Task 4: Seed roster + staging seed script **[OWNER-ASSIST if re-link needed]**

**Files:**
- Create: `scripts/seed-roster.json`, `scripts/seed-staging.mjs`
- Modify: `package.json` (one script line)
- Test: `lib/seed-roster.test.ts`

**Interfaces:**
- Consumes: `makeSlug` (Task 1); views + `delegates.slug` (Task 3).
- Produces: seeded staging DB — 12 approved delegates (slugs live), 3 pending, 1,887 members, `public_stats` = `{ approved_delegates: 12, active_members: 1636 }`. Tasks 6–10 render this data; Task 12 e2e asserts on it.

- [ ] **Step 1: Write the failing cross-check test — `lib/seed-roster.test.ts`** (keeps the JSON honest against `lib/slug` and the canonical region list without a TS runtime in the seed script):

```ts
import { describe, expect, it } from "vitest";
import roster from "../scripts/seed-roster.json";
import { makeSlug } from "./slug";

const REGIONS = [
  "თბილისი", "აჭარა", "იმერეთი", "კახეთი", "ქვემო ქართლი",
  "სამეგრელო-ზემო სვანეთი", "სამცხე-ჯავახეთი", "გურია",
  "მცხეთა-მთიანეთი", "რაჭა-ლეჩხუმი და ქვემო სვანეთი", "შიდა ქართლი",
];

describe("seed roster", () => {
  it("has 12 approved and 3 pending delegates", () => {
    expect(roster.filter((d) => d.status === "approved")).toHaveLength(12);
    expect(roster.filter((d) => d.status === "pending")).toHaveLength(3);
  });
  it("uses only canonical region names", () => {
    for (const d of roster) expect(REGIONS).toContain(d.region);
  });
  it("slugs match makeSlug output in roster order", () => {
    const taken = new Set<string>();
    for (const d of roster) {
      const expected = makeSlug(`${d.first_name} ${d.last_name}`, taken);
      expect(d.slug).toBe(expected);
      taken.add(expected);
    }
  });
  it("keeps prototype supporter totals (leaderboard parity)", () => {
    const approved = roster.filter((d) => d.status === "approved");
    expect(approved.reduce((sum, d) => sum + d.supporters, 0)).toBe(1862);
    expect(Math.max(...approved.map((d) => d.supporters))).toBe(342);
  });
  it("every delegate has a non-empty Georgian bio", () => {
    for (const d of roster) expect(d.bio.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- lib/seed-roster.test.ts`. Expected: FAIL — cannot resolve `../scripts/seed-roster.json`.
- [ ] **Step 3: Create `scripts/seed-roster.json`** (prototype roster verbatim; slugs precomputed; short unique bios):

```json
[
  { "first_name": "გიორგი", "last_name": "მაისურაძე", "region": "თბილისი", "supporters": 342, "status": "approved", "slug": "giorgi-maisuradze", "bio": "თბილისელი სამოქალაქო აქტივისტი. ათი წელია მუშაობს ადგილობრივი თემების გაძლიერებასა და გამჭვირვალე მმართველობაზე." },
  { "first_name": "თამარ", "last_name": "ქავთარაძე", "region": "აჭარა", "supporters": 287, "status": "approved", "slug": "tamar-kavtaradze", "bio": "ბათუმელი იურისტი და საზოგადოებრივი ორგანიზაციის დამფუძნებელი. იცავს მოქალაქეთა უფლებებს რეგიონში." },
  { "first_name": "ლევან", "last_name": "ჩხეიძე", "region": "იმერეთი", "supporters": 256, "status": "approved", "slug": "levan-chkheidze", "bio": "ქუთაისელი ეკონომისტი. მუშაობს რეგიონული ეკონომიკის განვითარებისა და ადგილობრივი მეწარმეობის მხარდაჭერაზე." },
  { "first_name": "ნინო", "last_name": "გელაშვილი", "region": "კახეთი", "supporters": 198, "status": "approved", "slug": "nino-gelashvili", "bio": "თელაველი პედაგოგი. აერთიანებს კახეთის სოფლების თემებს განათლებისა და კულტურის ინიციატივების გარშემო." },
  { "first_name": "დავით", "last_name": "კობახიძე", "region": "ქვემო ქართლი", "supporters": 176, "status": "approved", "slug": "davit-kobakhidze", "bio": "რუსთაველი ინჟინერი. მუშაობს მუნიციპალური სერვისების გაუმჯობესებასა და ახალგაზრდების ჩართულობაზე." },
  { "first_name": "მარიამ", "last_name": "წიქარიშვილი", "region": "სამეგრელო-ზემო სვანეთი", "supporters": 154, "status": "approved", "slug": "mariam-tsikarishvili", "bio": "ზუგდიდელი ექიმი. აქტიურად იბრძვის რეგიონში ჯანდაცვის ხელმისაწვდომობის გასაუმჯობესებლად." },
  { "first_name": "ზურაბ", "last_name": "ბერიძე", "region": "სამცხე-ჯავახეთი", "supporters": 121, "status": "approved", "slug": "zurab-beridze", "bio": "ახალციხელი ისტორიკოსი. მუშაობს რეგიონის თემებს შორის დიალოგისა და თანამშრომლობის გაღრმავებაზე." },
  { "first_name": "ეკა", "last_name": "მელაძე", "region": "გურია", "supporters": 98, "status": "approved", "slug": "eka-meladze", "bio": "ოზურგეთელი აგრონომი. ეხმარება გურიის ფერმერებს კოოპერაციასა და ადგილობრივი პროდუქციის პოპულარიზაციაში." },
  { "first_name": "ირაკლი", "last_name": "ფხაკაძე", "region": "მცხეთა-მთიანეთი", "supporters": 83, "status": "approved", "slug": "irakli-pkhakadze", "bio": "მცხეთელი არქიტექტორი. იცავს კულტურული მემკვიდრეობის ძეგლებს და გეგმავს მდგრად ტურიზმს მთიანეთში." },
  { "first_name": "სოფიო", "last_name": "ლომიძე", "region": "შიდა ქართლი", "supporters": 67, "status": "approved", "slug": "sopio-lomidze", "bio": "გორელი ჟურნალისტი. მუშაობს ადგილობრივი მედიის გაძლიერებასა და საზოგადოებრივი ინფორმაციის ღიაობაზე." },
  { "first_name": "ვახტანგ", "last_name": "ნადირაძე", "region": "რაჭა-ლეჩხუმი და ქვემო სვანეთი", "supporters": 41, "status": "approved", "slug": "vakhtang-nadiradze", "bio": "ამბროლაურელი მევენახე. აერთიანებს მაღალმთიანი სოფლების მოსახლეობას რეგიონის აღორძინების იდეის გარშემო." },
  { "first_name": "ანა", "last_name": "ჯაფარიძე", "region": "თბილისი", "supporters": 39, "status": "approved", "slug": "ana-japaridze", "bio": "თბილისელი პროგრამისტი. ქმნის ციფრულ ხელსაწყოებს სამოქალაქო ჩართულობისა და ღია მონაცემებისთვის." },
  { "first_name": "ბექა", "last_name": "ღოღობერიძე", "region": "იმერეთი", "supporters": 12, "status": "pending", "slug": "beka-ghoghoberidze", "bio": "ჭიათურელი მასწავლებელი. გეგმავს ახალგაზრდული ცენტრების ქსელს იმერეთის მუნიციპალიტეტებში." },
  { "first_name": "ქეთევან", "last_name": "სვანიძე", "region": "კახეთი", "supporters": 8, "status": "pending", "slug": "ketevan-svanidze", "bio": "სიღნაღელი ენოლოგი. მუშაობს კახური ღვინის მცირე მარნების გაერთიანებასა და საექსპორტო ბაზრებზე." },
  { "first_name": "ალექსანდრე", "last_name": "თავაძე", "region": "ქვემო ქართლი", "supporters": 5, "status": "pending", "slug": "aleksandre-tavadze", "bio": "მარნეულელი სოციალური მუშაკი. ეხმარება მრავალეთნიკური თემების ინტეგრაციასა და თანასწორ ჩართულობას." }
]
```

**Note:** all bios must contain only Georgian characters and punctuation — no Latin letters mixed into Georgian words (a classic copy-paste corruption; the roster test's length check won't catch it, so eyeball each bio once).

- [ ] **Step 4: Run the cross-check.** Run: `npm run test -- lib/seed-roster.test.ts`. Expected: all PASS. (If a slug assertion fails, the JSON slug is wrong — fix the JSON, never the library.)
- [ ] **Step 5: Create `scripts/seed-staging.mjs`**

```js
/**
 * Seeds STAGING with the prototype roster. Destructive by design:
 * wipes ALL auth users (staging holds synthetic data only), then recreates
 * roster delegates + their supporter members deterministically.
 *
 * Guards: refuses on NEXT_PUBLIC_APP_ENV=production; requires
 * `--confirm-ref <project-ref>` matching NEXT_PUBLIC_SUPABASE_URL.
 *
 * Run: node --env-file=.env.local scripts/seed-staging.mjs --confirm-ref <ref>
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (process.env.NEXT_PUBLIC_APP_ENV === "production") {
  console.error("Refusing to seed: NEXT_PUBLIC_APP_ENV=production");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
const flagIdx = process.argv.indexOf("--confirm-ref");
if (flagIdx < 0 || process.argv[flagIdx + 1] !== ref) {
  console.error(`Refusing to seed: pass --confirm-ref ${ref} to confirm the target project.`);
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const roster = JSON.parse(readFileSync(new URL("./seed-roster.json", import.meta.url), "utf8"));

const pad = (n, w) => String(n).padStart(w, "0");
const phoneFor = (i) => `+99550${pad(i, 7)}`; // 9 national digits starting 5; '50' block is seed-only
const personalIdFor = (i) => `1${pad(i, 10)}`;
const ACTIVE_RATIO = 0.86; // prototype parity

const FIRST = ["ნინო", "გიორგი", "მარიამ", "დავით", "ანა", "ლევან", "სოფიო", "ზურაბ", "ეკა", "ირაკლი", "თამარ", "ლუკა", "ბარბარე", "სანდრო"];
const LAST = ["ბერიძე", "მაისურაძე", "ლომიძე", "კაპანაძე", "ჯღარკავა", "წერეთელი", "გოგოლაძე", "ხარაზი", "ნოზაძე", "ფარცხალაძე"];

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

async function insertChunked(table, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await db.from(table).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
}

console.log(`Seeding project ${ref} …`);

// 1) Full reset: delete every auth user (cascades: profiles → delegates/memberships)
let wiped = 0;
for (;;) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  if (data.users.length === 0) break;
  await mapLimit(data.users, 10, async (u) => {
    const { error: e } = await db.auth.admin.deleteUser(u.id);
    if (e) throw new Error(`deleteUser ${u.id}: ${e.message}`);
  });
  wiped += data.users.length;
}
const { error: otpWipe } = await db.from("dev_otp_inbox").delete().gte("id", 0);
if (otpWipe) throw otpWipe;
console.log(`wiped ${wiped} auth users + dev_otp_inbox`);

// 2) Region name → id
const { data: regions, error: regErr } = await db.from("regions").select("id, name_ka");
if (regErr) throw regErr;
const regionId = new Map(regions.map((r) => [r.name_ka, r.id]));
for (const d of roster) {
  if (!regionId.has(d.region)) throw new Error(`unknown region in roster: ${d.region}`);
}

// 3) Build the full person list: 15 delegates + their supporters
let seq = 0;
const people = []; // { i, first_name, last_name, region, status, delegate: rosterEntry|null, supporterOf: slug|null }
for (const d of roster) {
  people.push({ i: ++seq, first_name: d.first_name, last_name: d.last_name, region: d.region, status: "active_member", delegate: d, supporterOf: null });
}
for (const d of roster) {
  const active = Math.round(d.supporters * ACTIVE_RATIO);
  for (let k = 0; k < d.supporters; k++) {
    const i = ++seq;
    people.push({
      i,
      first_name: FIRST[(k + i) % FIRST.length],
      last_name: LAST[(k * 3 + i) % LAST.length],
      region: d.region,
      status: k < active ? "active_member" : k % 2 === 0 ? "profile_completed" : "draft",
      delegate: null,
      supporterOf: d.slug,
    });
  }
}
console.log(`creating ${people.length} auth users (a few minutes) …`);

// 4) Auth users (concurrency 10), then bulk-insert profiles/delegates/memberships
const created = await mapLimit(people, 10, async (p) => {
  const { data, error } = await db.auth.admin.createUser({ phone: phoneFor(p.i), phone_confirm: true });
  if (error) throw new Error(`createUser #${p.i}: ${error.message}`);
  return { ...p, id: data.user.id };
});

await insertChunked(
  "profiles",
  created.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    phone: phoneFor(p.i),
    personal_id: personalIdFor(p.i),
    region_id: regionId.get(p.region),
    status: p.status,
  }))
);

const delegateIdBySlug = new Map();
for (const p of created) {
  if (p.delegate) delegateIdBySlug.set(p.delegate.slug, p.id);
}
await insertChunked(
  "delegates",
  created
    .filter((p) => p.delegate)
    .map((p) => ({
      id: p.id,
      status: p.delegate.status,
      referral_code: `D${pad(p.i, 5)}`,
      slug: p.delegate.slug,
      bio: p.delegate.bio,
      tc_accepted_at: new Date().toISOString(),
    }))
);
await insertChunked(
  "memberships",
  created
    .filter((p) => p.supporterOf)
    .map((p) => ({ member_id: p.id, delegate_id: delegateIdBySlug.get(p.supporterOf) }))
);

// 5) Sanity: the views must report exactly the expected world
const { data: stats, error: statsErr } = await db.from("public_stats").select("*").single();
if (statsErr) throw statsErr;
const { data: top, error: topErr } = await db
  .from("public_delegates")
  .select("slug, active_supporters")
  .order("active_supporters", { ascending: false })
  .limit(1)
  .single();
if (topErr) throw topErr;

console.log(`public_stats: ${JSON.stringify(stats)}; top: ${JSON.stringify(top)}`);
if (stats.approved_delegates !== 12) throw new Error(`expected 12 approved delegates, got ${stats.approved_delegates}`);
if (stats.active_members !== 1636) throw new Error(`expected 1636 active members, got ${stats.active_members}`);
if (top.slug !== "giorgi-maisuradze" || top.active_supporters !== 294)
  throw new Error(`unexpected leaderboard top: ${JSON.stringify(top)}`);
console.log("SEED OK");
```

**Arithmetic note (why 294 and 1636):** a delegate's public count is their *active* supporters — `round(N × 0.86)` (342 → 294 for გიორგი). Sum over approved delegates = 1,600; pending delegates' supporters add 21; the 15 delegates' own active profiles add 15 → `active_members` = **1636**. The prototype displayed raw totals (342) but its own home counter also counted only actives — the production views make both consistent: leaderboard shows 294, matching the "active supporters" label truthfully.

- [ ] **Step 6: Add npm script.** In `package.json` scripts, after `"e2e"`, add:

```json
    "seed:staging": "node --env-file=.env.local scripts/seed-staging.mjs"
```

- [ ] **Step 7: Run the seed.** Run: `npm run seed:staging -- --confirm-ref orcxtbedkexoclbfgvzd` (3–6 minutes). Expected final lines: `public_stats: {"approved_delegates":12,"active_members":1636}; top: {"slug":"giorgi-maisuradze","active_supporters":294}` then `SEED OK`.
- [ ] **Step 8: Re-verify schema probes now that data exists.** Run: `node --env-file=.env.local scripts/verify-schema.mjs`. Expected: `... public views readable (3 sample rows), delegates base table sealed`.
- [ ] **Step 9: Commit**

```bash
git add scripts/seed-roster.json scripts/seed-staging.mjs lib/seed-roster.test.ts package.json
git commit -m "feat: deterministic staging seed (prototype roster, guarded, verified)"
```

### Task 5: Public frame — navy tokens, DemoBanner, ButtonLink, layout, /join, error page

**Files:**
- Create: `components/DemoBanner.tsx`, `components/ButtonLink.tsx`, `app/(public)/layout.tsx`, `app/(public)/join/page.tsx`, `app/(public)/error.tsx`
- Modify: `app/globals.css` (navy tokens), `components/Button.tsx` (extract shared classes, add variants), `app/layout.tsx` (metadataBase), `DESIGN.md` (navy + ButtonLink lines)
- Test: `components/DemoBanner.test.tsx`, `components/ButtonLink.test.tsx` (+ extend `components/design-system.test.tsx` for new Button variants)

**Interfaces:**
- Consumes: `siteUrl()` (Task 2).
- Produces (consumed by Tasks 6–10): `ButtonLink({ href, variant?: "primary"|"ghost"|"danger"|"dark"|"ghost-inverse", ...anchor props })`; `Button` gains the same two new variants; `DemoBanner` (env-gated); the `(public)` route-group frame wrapping all public pages (including existing `/login`, `/styleguide`); Tailwind tokens `navy` (#0E1A2B) and `navy-dark` (#16283F).

- [ ] **Step 1: Write the failing tests**

`components/DemoBanner.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoBanner } from "./DemoBanner";

afterEach(() => vi.unstubAllEnvs());

describe("DemoBanner", () => {
  it("renders the demo notice outside production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    render(<DemoBanner />);
    expect(screen.getByText("სადემონსტრაციო გარემო — მონაცემები ფიქტიურია")).toBeInTheDocument();
  });
  it("renders nothing in production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    const { container } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

`components/ButtonLink.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonLink } from "./ButtonLink";

describe("ButtonLink", () => {
  it("renders a link styled as the primary button", () => {
    render(<ButtonLink href="/join">გახდი წევრი</ButtonLink>);
    const link = screen.getByRole("link", { name: "გახდი წევრი" });
    expect(link.getAttribute("href")).toBe("/join");
    expect(link.className).toContain("bg-brand");
  });
  it("supports the dark variant", () => {
    render(<ButtonLink href="/leaderboard" variant="dark">რეიტინგი</ButtonLink>);
    expect(screen.getByRole("link", { name: "რეიტინგი" }).className).toContain("bg-navy");
  });
  it("supports the ghost-inverse variant for dark backgrounds", () => {
    render(<ButtonLink href="/join" variant="ghost-inverse">დელეგატი</ButtonLink>);
    expect(screen.getByRole("link", { name: "დელეგატი" }).className).toContain("text-white");
  });
});
```

Append to `components/design-system.test.tsx` inside `describe("Button", ...)`:

```tsx
  it("renders dark variant", () => {
    render(<Button variant="dark">რეიტინგი</Button>);
    expect(screen.getByRole("button", { name: "რეიტინგი" }).className).toContain("bg-navy");
  });
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- components`. Expected: FAIL — `DemoBanner`/`ButtonLink` not found, Button dark variant missing.
- [ ] **Step 3: Add navy tokens.** In `app/globals.css` `@theme`, after `--color-line`:

```css
  --color-navy: #0e1a2b;
  --color-navy-dark: #16283f;
```

- [ ] **Step 4: Refactor `components/Button.tsx`** (shared class map consumed by both components):

```tsx
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger" | "dark" | "ghost-inverse";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50";

const styles: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  ghost: "bg-transparent text-ink border border-line hover:bg-surface",
  danger: "bg-danger text-white hover:opacity-90",
  dark: "bg-navy text-white hover:bg-navy-dark",
  "ghost-inverse": "bg-transparent text-white border border-white/30 hover:bg-white/10",
};

export function buttonClasses(variant: ButtonVariant, extra = ""): string {
  return `${base} ${styles[variant]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}
```

- [ ] **Step 5: Create `components/ButtonLink.tsx`**

```tsx
import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClasses, type ButtonVariant } from "./Button";

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; className?: string }) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}
```

- [ ] **Step 6: Create `components/DemoBanner.tsx`**

```tsx
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") return null;
  return (
    <div className="bg-gold/15 px-4 py-1.5 text-center text-xs font-semibold text-ink">
      სადემონსტრაციო გარემო — მონაცემები ფიქტიურია
    </div>
  );
}
```

- [ ] **Step 7: Run to verify pass.** Run: `npm run test -- components`. Expected: all PASS.
- [ ] **Step 8: Create `app/(public)/layout.tsx`** (header + banner + footer frame):

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ButtonLink";
import { DemoBanner } from "@/components/DemoBanner";

const nav = [
  { href: "/", label: "მთავარი" },
  { href: "/delegates", label: "დელეგატები" },
  { href: "/leaderboard", label: "რეიტინგი" },
] as const;

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-lg text-white shadow-sm"
            >
              🏛
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold text-ink">ქართული რესპუბლიკა</span>
              <span className="block text-[11px] font-semibold text-muted-fg">
                სამოქალაქო პლატფორმა
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-ink">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-brand">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost" className="px-3 py-2 text-xs">
              შესვლა
            </ButtonLink>
            <ButtonLink href="/join" className="px-3 py-2 text-xs">
              გახდი წევრი
            </ButtonLink>
          </div>
        </div>
      </header>
      <DemoBanner />
      <div className="flex-1">{children}</div>
      <footer className="mt-16 bg-navy py-10 text-sm text-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 sm:px-6">
          <div>
            <div className="font-extrabold text-white">ქართული რესპუბლიკა</div>
            <div className="mt-1">გამჭვირვალე, ანგარიშვალდებული და შენს ხელში.</div>
          </div>
          <nav className="flex gap-5 font-semibold">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <div>© 2026 ქართული რესპუბლიკა</div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 9: Create `app/(public)/join/page.tsx`** (opening-soon; Phase 2 replaces this file in place):

```tsx
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ButtonLink";

export const metadata: Metadata = {
  title: "რეგისტრაცია მალე გაიხსნება — ქართული რესპუბლიკა",
  description: "წევრობის გახსნისთანავე აქვე შეძლებ დარეგისტრირებას.",
};

export default function JoinPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="mx-auto mb-6 h-1.5 w-28 rounded-full bg-[linear-gradient(90deg,var(--color-brand)_0_60%,var(--color-line)_60%_100%)]" />
      <h1 className="font-serif text-4xl font-bold text-ink">რეგისტრაცია მალე გაიხსნება</h1>
      <p className="mx-auto mt-4 max-w-md text-muted-fg">
        პლატფორმა მშენებლობის პროცესშია — წევრობის გახსნისთანავე აქვე შეძლებ დარეგისტრირებას.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">მთავარ გვერდზე დაბრუნება</ButtonLink>
        <ButtonLink href="/leaderboard" variant="ghost">
          ნახე დელეგატების რეიტინგი
        </ButtonLink>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: Create `app/(public)/error.tsx`** (public-group error boundary):

```tsx
"use client";

import { Button } from "@/components/Button";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-serif text-3xl font-bold text-ink">დროებითი შეფერხება</h1>
      <p className="mt-3 text-muted-fg">გვერდის ჩატვირთვა ვერ მოხერხდა. სცადე თავიდან.</p>
      <div className="mt-6">
        <Button onClick={reset}>თავიდან ცდა</Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 11: metadataBase.** In `app/layout.tsx`, import `siteUrl` and extend the metadata export (keep existing fields):

```tsx
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "ქართული რესპუბლიკა",
  description: "სამოქალაქო პლატფორმა",
};
```

- [ ] **Step 12: DESIGN.md.** Append:

```markdown
Added in Phase 1: tokens navy #0E1A2B / navy-dark #16283F (hero, footer, dark buttons);
Button/ButtonLink variants dark + ghost-inverse (ghost-inverse only on dark surfaces);
ButtonLink = Button-styled next/link, same variants.
```

- [ ] **Step 13: Verify.** Run: `npm run typecheck && npm run lint && npm run test`. Expected: all green. Start the `portal-dev` preview server and load `/join` and `/login` — expected: header + demo banner + footer around both, buttons styled.
- [ ] **Step 14: Commit**

```bash
git add app components DESIGN.md
git commit -m "feat: public frame (header/footer/demo banner), ButtonLink, navy tokens, opening-soon page"
```

### Task 6: Public data layer + Home page

**Files:**
- Create: `lib/supabase/public.ts`, `components/CountUp.tsx`
- Modify: `app/(public)/page.tsx` (replace placeholder), `vitest.setup.ts` (matchMedia stub)
- Test: `components/CountUp.test.tsx`

**Interfaces:**
- Consumes: views (Task 3), seeded data (Task 4), `PublicDelegate`/`formatCountKa` (Task 2), `ButtonLink` (Task 5).
- Produces (consumed by Tasks 7–10, 12): `fetchPublicDelegates(): Promise<PublicDelegate[]>`, `fetchDelegateBySlug(slug: string): Promise<PublicDelegate | null>`, `fetchPublicStats(): Promise<PublicStats>` (`{ approved_delegates: number; active_members: number }`), `fetchRegions(): Promise<Region[]>` (`{ id: number; name_ka: string }`); `CountUp({ value: number })`.

- [ ] **Step 1: Write the failing test — `components/CountUp.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatCountKa } from "@/lib/format";
import { CountUp } from "./CountUp";

describe("CountUp", () => {
  it("server-renders the final formatted value (no zero flash)", () => {
    render(<CountUp value={1636} />);
    expect(screen.getByText(formatCountKa(1636))).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add a matchMedia stub to `vitest.setup.ts`** (jsdom lacks it; `matches: true` = reduced motion, so tests stay deterministic):

```ts
import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
```

- [ ] **Step 3: Run to verify failure.** Run: `npm run test -- components/CountUp.test.tsx`. Expected: FAIL — `./CountUp` not found.
- [ ] **Step 4: Create `components/CountUp.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { formatCountKa } from "@/lib/format";

/** Renders the final value on the server; animates 0→value after hydration
 *  unless the visitor prefers reduced motion. */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const duration = 1100;
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatCountKa(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span ref={ref}>{formatCountKa(value)}</span>;
}
```

- [ ] **Step 5: Run to verify pass.** Run: `npm run test -- components/CountUp.test.tsx`. Expected: PASS.
- [ ] **Step 6: Create `lib/supabase/public.ts`** (cookie-free anon client — never sessions, never `cookies()`; keeps ISR static):

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { PublicDelegate } from "@/lib/ranking";

export interface PublicStats {
  approved_delegates: number;
  active_members: number;
}

export interface Region {
  id: number;
  name_ka: string;
}

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function fetchPublicDelegates(): Promise<PublicDelegate[]> {
  const { data, error } = await publicClient()
    .from("public_delegates")
    .select("*")
    .returns<PublicDelegate[]>();
  if (error) throw new Error(`public_delegates: ${error.message}`);
  return data;
}

export async function fetchDelegateBySlug(slug: string): Promise<PublicDelegate | null> {
  const { data, error } = await publicClient()
    .from("public_delegates")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<PublicDelegate>();
  if (error) throw new Error(`public_delegates by slug: ${error.message}`);
  return data;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  const { data, error } = await publicClient()
    .from("public_stats")
    .select("*")
    .single<PublicStats>();
  if (error) throw new Error(`public_stats: ${error.message}`);
  return data;
}

export async function fetchRegions(): Promise<Region[]> {
  const { data, error } = await publicClient()
    .from("regions")
    .select("id, name_ka")
    .order("id")
    .returns<Region[]>();
  if (error) throw new Error(`regions: ${error.message}`);
  return data;
}
```

- [ ] **Step 7: Replace `app/(public)/page.tsx`** (real home):

```tsx
import { ButtonLink } from "@/components/ButtonLink";
import { CountUp } from "@/components/CountUp";
import { fetchPublicStats } from "@/lib/supabase/public";

export const revalidate = 60;

const features = [
  {
    icon: "🗳",
    title: "რეგიონული წარმომადგენლობა",
    text: "ყველა მხარეს ჰყავს საკუთარი ვერიფიცირებული დელეგატი, რომელიც შენს ხმას წარადგენს.",
  },
  {
    icon: "🔒",
    title: "იურიდიული ვერიფიკაცია",
    text: "პირადი ნომრისა და ტელეფონის ვერიფიკაცია უზრუნველყოფს რეალურ, გამჭვირვალე წევრობას.",
  },
  {
    icon: "📈",
    title: "ღია რეიტინგი",
    text: "დელეგატები საჯაროდ ლაგდებიან აქტიური მხარდამჭერების მიხედვით — სრული გამჭვირვალობა.",
  },
] as const;

export default async function HomePage() {
  const stats = await fetchPublicStats();
  return (
    <main>
      <section
        className="bg-navy text-white"
        style={{
          backgroundImage:
            "radial-gradient(1200px 500px at 50% -10%, #1b2c46 0%, var(--color-navy) 55%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-6 h-1.5 w-28 rounded-full bg-[linear-gradient(90deg,var(--color-brand)_0_60%,#fff_60%_100%)]" />
          <h1 className="max-w-[16ch] font-serif text-4xl font-bold leading-tight sm:text-5xl">
            ავაშენოთ ქართული რესპუბლიკა ერთად
          </h1>
          <p className="mt-4 max-w-[52ch] text-lg text-white/70">
            გაერთიანდი მოქალაქეებისა და რეგიონული ლიდერების მოძრაობაში. გამჭვირვალე,
            ანგარიშვალდებული და შენს ხელში.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/join" className="px-6 py-3 text-base">
              გახდი წევრი
            </ButtonLink>
            <ButtonLink href="/join?role=delegate" variant="ghost-inverse" className="px-6 py-3 text-base">
              გახდი დელეგატი
            </ButtonLink>
          </div>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <div className="text-4xl font-extrabold tabular-nums" data-testid="stat-approved-delegates">
                <CountUp value={stats.approved_delegates} />
              </div>
              <div className="mt-1.5 text-sm font-semibold text-white/60">დამტკიცებული დელეგატი</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <div className="text-4xl font-extrabold tabular-nums" data-testid="stat-active-members">
                <CountUp value={stats.active_members} />
              </div>
              <div className="mt-1.5 text-sm font-semibold text-white/60">აქტიური წევრი</div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-white p-6 shadow-sm">
              <h3 className="font-bold text-ink">
                <span aria-hidden className="me-2">{f.icon}</span>
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-muted-fg">{f.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="/leaderboard" variant="dark" className="px-6 py-3 text-base">
            ნახე დელეგატების რეიტინგი →
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Verify.** Run: `npm run typecheck && npm run test`, then load `/` on the `portal-dev` preview server. Expected: navy hero, counters showing 12 and 1 636 (ka-GE grouping), feature cards, demo banner visible.
- [ ] **Step 9: Commit**

```bash
git add lib/supabase/public.ts components/CountUp.tsx components/CountUp.test.tsx vitest.setup.ts "app/(public)/page.tsx"
git commit -m "feat: public data layer and real home page with live counters"
```

### Task 7: Delegate directory

**Files:**
- Create: `components/DelegateCard.tsx`, `components/DelegateDirectory.tsx`, `app/(public)/delegates/page.tsx`
- Modify: `components/Field.tsx` (export shared `inputClasses`)
- Test: `components/DelegateCard.test.tsx`, `components/DelegateDirectory.test.tsx`

**Interfaces:**
- Consumes: `fetchPublicDelegates`, `fetchRegions`, `Region` (Task 6); `rankDelegates`, `RankedDelegate` (Task 2); `Pill` (Phase 0).
- Produces: `DelegateCard({ delegate: RankedDelegate })`; `DelegateDirectory({ delegates: RankedDelegate[], regions: Region[] })` (client component). Consumed by Task 12 e2e.

- [ ] **Step 1: Write the failing tests**

`components/DelegateCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RankedDelegate } from "@/lib/ranking";
import { DelegateCard } from "./DelegateCard";

const delegate: RankedDelegate = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "giorgi-maisuradze",
  first_name: "გიორგი",
  last_name: "მაისურაძე",
  region_id: 1,
  region_name_ka: "თბილისი",
  bio: null,
  photo_url: null,
  active_supporters: 294,
  rank: 1,
};

describe("DelegateCard", () => {
  it("shows region, name, count, approved pill and links to the delegate page", () => {
    render(<DelegateCard delegate={delegate} />);
    expect(screen.getByText("თბილისი")).toBeInTheDocument();
    expect(screen.getByText("გიორგი მაისურაძე")).toBeInTheDocument();
    expect(screen.getByText("294")).toBeInTheDocument();
    expect(screen.getByText("აქტიური მხარდამჭერი")).toBeInTheDocument();
    expect(screen.getByText("დამტკიცებული")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/delegates/giorgi-maisuradze");
  });
});
```

`components/DelegateDirectory.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RankedDelegate } from "@/lib/ranking";
import { DelegateDirectory } from "./DelegateDirectory";

const mk = (over: Partial<RankedDelegate>): RankedDelegate => ({
  id: crypto.randomUUID(),
  slug: "x",
  first_name: "ანა",
  last_name: "ჯაფარიძე",
  region_id: 1,
  region_name_ka: "თბილისი",
  bio: null,
  photo_url: null,
  active_supporters: 10,
  rank: 1,
  ...over,
});

const delegates = [
  mk({ slug: "giorgi-maisuradze", first_name: "გიორგი", last_name: "მაისურაძე", rank: 1 }),
  mk({ slug: "eka-meladze", first_name: "ეკა", last_name: "მელაძე", region_id: 8, region_name_ka: "გურია", rank: 2 }),
];
const regions = [
  { id: 1, name_ka: "თბილისი" },
  { id: 8, name_ka: "გურია" },
];

describe("DelegateDirectory", () => {
  it("shows all delegates and the count line", () => {
    render(<DelegateDirectory delegates={delegates} regions={regions} />);
    expect(screen.getByText("ნაჩვენებია 2 დელეგატი")).toBeInTheDocument();
  });
  it("filters by name search", async () => {
    render(<DelegateDirectory delegates={delegates} regions={regions} />);
    await userEvent.type(screen.getByPlaceholderText("ძებნა სახელით..."), "ეკა");
    expect(screen.getByText("ნაჩვენებია 1 დელეგატი")).toBeInTheDocument();
    expect(screen.queryByText("გიორგი მაისურაძე")).not.toBeInTheDocument();
  });
  it("filters by region", async () => {
    render(<DelegateDirectory delegates={delegates} regions={regions} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "8");
    expect(screen.getByText("ნაჩვენებია 1 დელეგატი")).toBeInTheDocument();
    expect(screen.getByText("ეკა მელაძე")).toBeInTheDocument();
  });
  it("shows the empty state when nothing matches", async () => {
    render(<DelegateDirectory delegates={delegates} regions={regions} />);
    await userEvent.type(screen.getByPlaceholderText("ძებნა სახელით..."), "zzz");
    expect(
      screen.getByText("ამ პარამეტრებით დელეგატი ვერ მოიძებნა. სცადე სხვა ძებნა ან აირჩიე „ყველა მხარე“.")
    ).toBeInTheDocument();
  });
});
```

**Note:** `@testing-library/user-event` is already a transitive install of Testing Library setups — verify with `npm ls @testing-library/user-event`. If absent, use `fireEvent` from `@testing-library/react` instead (`fireEvent.change(input, { target: { value: "ეკა" } })`); do NOT add a dependency.

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- components/DelegateCard.test.tsx components/DelegateDirectory.test.tsx`. Expected: FAIL — modules not found.
- [ ] **Step 3: Export shared input classes from `components/Field.tsx`.** Add at top level (and use inside `Field` for its input):

```tsx
export const inputClasses =
  "rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-brand";
```

(Field's input keeps its error/line border logic: `` className={`${inputClasses} ${error ? "border-danger" : "border-line"}`} ``.)

- [ ] **Step 4: Create `components/DelegateCard.tsx`**

```tsx
import Link from "next/link";
import { Pill } from "@/components/Pill";
import { formatCountKa } from "@/lib/format";
import type { RankedDelegate } from "@/lib/ranking";

export function DelegateCard({ delegate }: { delegate: RankedDelegate }) {
  return (
    <Link
      href={`/delegates/${delegate.slug}`}
      data-testid="delegate-card"
      className="block rounded-xl border border-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="text-xs font-bold uppercase tracking-wide text-brand">
        {delegate.region_name_ka}
      </div>
      <div className="mb-3 mt-1.5 text-lg font-bold text-ink">
        {delegate.first_name} {delegate.last_name}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold tabular-nums text-ink">
            {formatCountKa(delegate.active_supporters)}
          </div>
          <div className="text-xs font-semibold text-muted-fg">აქტიური მხარდამჭერი</div>
        </div>
        <Pill status="approved" />
      </div>
    </Link>
  );
}
```

- [ ] **Step 5: Create `components/DelegateDirectory.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { DelegateCard } from "@/components/DelegateCard";
import { inputClasses } from "@/components/Field";
import { formatCountKa } from "@/lib/format";
import type { RankedDelegate } from "@/lib/ranking";
import type { Region } from "@/lib/supabase/public";

export function DelegateDirectory({
  delegates,
  regions,
}: {
  delegates: RankedDelegate[];
  regions: Region[];
}) {
  const [query, setQuery] = useState("");
  const [regionId, setRegionId] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return delegates.filter((d) => {
      const name = `${d.first_name} ${d.last_name}`.toLowerCase();
      const okName = !q || name.includes(q);
      const okRegion = !regionId || String(d.region_id) === regionId;
      return okName && okRegion;
    });
  }, [delegates, query, regionId]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
        <input
          className={`${inputClasses} min-w-[220px] flex-1 border-line`}
          placeholder="ძებნა სახელით..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={`${inputClasses} max-w-[280px] border-line bg-white`}
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
          aria-label="მხარე"
        >
          <option value="">ყველა მხარე</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name_ka}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-4 text-sm text-muted-fg" data-testid="delegate-count">
        ნაჩვენებია {formatCountKa(filtered.length)} დელეგატი
      </p>
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <DelegateCard key={d.id} delegate={d} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-white p-8 text-center text-muted-fg shadow-sm">
          ამ პარამეტრებით დელეგატი ვერ მოიძებნა. სცადე სხვა ძებნა ან აირჩიე „ყველა მხარე“.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run to verify pass.** Run: `npm run test -- components`. Expected: all PASS.
- [ ] **Step 7: Create `app/(public)/delegates/page.tsx`**

```tsx
import type { Metadata } from "next";
import { DelegateDirectory } from "@/components/DelegateDirectory";
import { rankDelegates } from "@/lib/ranking";
import { fetchPublicDelegates, fetchRegions } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ჩვენი დელეგატები — ქართული რესპუბლიკა",
  description:
    "ყველა დელეგატი გადის იურიდიულ ვერიფიკაციას. ნახე, ვინ წარმოადგენს შენს რეგიონს.",
};

export default async function DelegatesPage() {
  const [delegates, regions] = await Promise.all([fetchPublicDelegates(), fetchRegions()]);
  const ranked = rankDelegates(delegates);
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-brand">
        საჯარო პორტალი
      </div>
      <h1 className="font-serif text-4xl font-bold text-ink">ჩვენი დელეგატები</h1>
      <p className="mt-3 max-w-2xl text-muted-fg">
        ყველა დელეგატი გადის იურიდიულ ვერიფიკაციას. მათი მხარდაჭერა ღიად და გამჭვირვალედ
        ლაგდება — ნახე, ვინ წარმოადგენს შენს რეგიონს.
      </p>
      <div className="mt-8">
        <DelegateDirectory delegates={ranked} regions={regions} />
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Verify.** Run: `npm run typecheck && npm run test`, then load `/delegates` — expected: 12 cards sorted by count, search "გიორგი" → 1 card, region "გურია" → 1 card, "zzz" → empty state.
- [ ] **Step 9: Commit**

```bash
git add components/DelegateCard.tsx components/DelegateCard.test.tsx components/DelegateDirectory.tsx components/DelegateDirectory.test.tsx components/Field.tsx "app/(public)/delegates/page.tsx"
git commit -m "feat: delegate directory with instant search and region filter"
```

### Task 8: Leaderboard

**Files:**
- Create: `components/LeaderRow.tsx`, `app/(public)/leaderboard/page.tsx`
- Test: `components/LeaderRow.test.tsx`

**Interfaces:**
- Consumes: `rankDelegates`, `medalFor`, `RankedDelegate`, `formatCountKa` (Task 2); `fetchPublicDelegates` (Task 6).
- Produces: `LeaderRow({ delegate: RankedDelegate })`. Consumed by Task 12 e2e (`data-testid="leader-row"`).

- [ ] **Step 1: Write the failing test — `components/LeaderRow.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RankedDelegate } from "@/lib/ranking";
import { LeaderRow } from "./LeaderRow";

const mk = (rank: number): RankedDelegate => ({
  id: `00000000-0000-0000-0000-00000000000${rank}`,
  slug: `delegate-${rank}`,
  first_name: "ეკა",
  last_name: "მელაძე",
  region_id: 8,
  region_name_ka: "გურია",
  bio: null,
  photo_url: null,
  active_supporters: 84,
  rank,
});

describe("LeaderRow", () => {
  it("shows a gold medal for rank 1", () => {
    render(<LeaderRow delegate={mk(1)} />);
    expect(screen.getByText("🥇")).toBeInTheDocument();
  });
  it("shows the plain rank number from rank 4 on", () => {
    render(<LeaderRow delegate={mk(4)} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });
  it("links to the delegate page and shows name, region, count", () => {
    render(<LeaderRow delegate={mk(2)} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/delegates/delegate-2");
    expect(screen.getByText("ეკა მელაძე")).toBeInTheDocument();
    expect(screen.getByText("გურია")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- components/LeaderRow.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Create `components/LeaderRow.tsx`**

```tsx
import Link from "next/link";
import { formatCountKa } from "@/lib/format";
import { medalFor, type RankedDelegate } from "@/lib/ranking";

const rankBox: Record<number, string> = {
  1: "bg-[linear-gradient(150deg,#F4D67A,var(--color-gold))] text-[#5a4410]",
  2: "bg-[linear-gradient(150deg,#E7EAF0,#B9C0CC)] text-[#3a4150]",
  3: "bg-[linear-gradient(150deg,#E8C4A0,#C08653)] text-[#4a2f18]",
};

export function LeaderRow({ delegate }: { delegate: RankedDelegate }) {
  const medal = medalFor(delegate.rank);
  return (
    <Link
      href={`/delegates/${delegate.slug}`}
      data-testid="leader-row"
      className="flex items-center gap-4 border-b border-line bg-white px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface sm:px-5"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold ${
          rankBox[delegate.rank] ?? "bg-surface text-muted-fg"
        }`}
      >
        {medal ?? delegate.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-ink">
          {delegate.first_name} {delegate.last_name}
        </span>
        <span className="block text-sm text-muted-fg">{delegate.region_name_ka}</span>
      </span>
      <span className="text-right">
        <span className="block text-lg font-extrabold tabular-nums text-ink">
          {formatCountKa(delegate.active_supporters)}
        </span>
        <span className="block text-[11px] font-semibold text-muted-fg">მხარდამჭერი</span>
      </span>
    </Link>
  );
}
```

- [ ] **Step 4: Run to verify pass.** Run: `npm run test -- components/LeaderRow.test.tsx`. Expected: PASS.
- [ ] **Step 5: Create `app/(public)/leaderboard/page.tsx`**

```tsx
import type { Metadata } from "next";
import { LeaderRow } from "@/components/LeaderRow";
import { formatCountKa } from "@/lib/format";
import { rankDelegates } from "@/lib/ranking";
import { fetchPublicDelegates } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "დელეგატების რეიტინგი — ქართული რესპუბლიკა",
  description: "ავტომატურად ლაგდება აქტიური გადამხდელი მხარდამჭერების მიხედვით.",
};

export default async function LeaderboardPage() {
  const ranked = rankDelegates(await fetchPublicDelegates());
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-brand">
        ლიდერბორდი
      </div>
      <h1 className="font-serif text-4xl font-bold text-ink">დელეგატების რეიტინგი</h1>
      <p className="mt-3 text-muted-fg">
        ავტომატურად ლაგდება აქტიური გადამხდელი მხარდამჭერების მიხედვით.
      </p>
      <div className="mt-8 overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <h2 className="font-bold text-ink">ცოცხალი რეიტინგი</h2>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted-fg">
            {formatCountKa(ranked.length)} დელეგატი
          </span>
        </div>
        {ranked.map((d) => (
          <LeaderRow key={d.id} delegate={d} />
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-fg/80">
        რეიტინგი ახლდება ავტომატურად ყოველი ახალი აქტიური მხარდამჭერის დამატებისას.
      </p>
    </main>
  );
}
```

- [ ] **Step 6: Verify.** Run: `npm run typecheck && npm run test`, then load `/leaderboard` — expected: 12 rows, gold/silver/bronze boxes on the first three, გიორგი მაისურაძე first with 294.
- [ ] **Step 7: Commit**

```bash
git add components/LeaderRow.tsx components/LeaderRow.test.tsx "app/(public)/leaderboard/page.tsx"
git commit -m "feat: public leaderboard with top-3 medals"
```

### Task 9: Delegate public page

**Files:**
- Create: `app/(public)/delegates/[slug]/page.tsx`, `app/(public)/delegates/[slug]/not-found.tsx`
- Modify: `components/StatCard.tsx` (accent + sub props)
- Test: extend `components/design-system.test.tsx` (StatCard extensions)

**Interfaces:**
- Consumes: `fetchPublicDelegates`, `fetchDelegateBySlug` (Task 6); `rankDelegates`, `RankedDelegate` (Task 2); `delegateBioFallback`, `formatCountKa` (Task 2); `Pill`, `StatCard` (Phase 0); `ButtonLink` (Task 5).
- Produces: `StatCard({ label, value, accent?: "brand", sub?: string })` (backwards-compatible). Route `/delegates/[slug]` with `generateStaticParams` + `generateMetadata`. Consumed by Tasks 10, 12.

- [ ] **Step 1: Write the failing test.** Append to `components/design-system.test.tsx` inside `describe("StatCard", ...)`:

```tsx
  it("supports brand accent and sub text", () => {
    render(<StatCard label="აქტიური მხარდამჭერი" value={294} accent="brand" sub="ღია რეიტინგში" />);
    expect(screen.getByText("294").className).toContain("text-brand");
    expect(screen.getByText("ღია რეიტინგში")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- components/design-system.test.tsx`. Expected: FAIL — unknown props.
- [ ] **Step 3: Extend `components/StatCard.tsx`**

```tsx
export function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: number | string;
  accent?: "brand";
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-6 text-center shadow-sm">
      <div className={`text-4xl font-bold ${accent === "brand" ? "text-brand" : "text-ink"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-fg">{label}</div>
      {sub ? <div className="mt-2 text-xs font-bold text-ok">{sub}</div> : null}
    </div>
  );
}
```

**Compatibility note:** the original `StatCard` rendered the value in `text-brand`; the styleguide page and any existing usage keep working — pass `accent="brand"` where the red number is wanted. Update `app/(public)/styleguide/page.tsx`'s two `StatCard` usages to `accent="brand"` so the gallery stays visually identical.

- [ ] **Step 4: Run to verify pass.** Run: `npm run test -- components/design-system.test.tsx`. Expected: PASS.
- [ ] **Step 5: Create `app/(public)/delegates/[slug]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import { delegateBioFallback, formatCountKa } from "@/lib/format";
import { rankDelegates } from "@/lib/ranking";
import { fetchDelegateBySlug, fetchPublicDelegates } from "@/lib/supabase/public";
import Link from "next/link";

export const revalidate = 60;

export async function generateStaticParams() {
  const delegates = await fetchPublicDelegates();
  return delegates.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const delegate = await fetchDelegateBySlug(slug);
  if (!delegate) return { title: "დელეგატი ვერ მოიძებნა — ქართული რესპუბლიკა" };
  const name = `${delegate.first_name} ${delegate.last_name}`;
  return {
    title: `${name} — ქართული რესპუბლიკა`,
    description:
      delegate.bio ?? delegateBioFallback(delegate.region_name_ka ?? "საქართველო"),
  };
}

export default async function DelegatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ranked = rankDelegates(await fetchPublicDelegates());
  const delegate = ranked.find((d) => d.slug === slug);
  if (!delegate) notFound();

  const name = `${delegate.first_name} ${delegate.last_name}`;
  const initials = `${delegate.first_name[0] ?? ""}${delegate.last_name[0] ?? ""}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/leaderboard" className="text-sm font-semibold text-brand hover:underline">
          ← უკან რეიტინგზე
        </Link>
        <Pill status="approved" />
      </div>
      <section className="rounded-xl border border-line bg-white p-6 shadow-sm">
        <div className="flex items-center gap-5">
          {delegate.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote host list not configured until real photos exist (Phase 4)
            <img
              src={delegate.photo_url}
              alt={name}
              className="h-20 w-20 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-brand/10 text-2xl font-extrabold text-brand">
              {initials}
            </span>
          )}
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-brand">
              {delegate.region_name_ka}
            </div>
            <h1 className="mt-1 font-serif text-3xl font-bold text-ink">{name}</h1>
          </div>
        </div>
        <p className="mt-5 text-muted-fg">
          {delegate.bio ?? delegateBioFallback(delegate.region_name_ka ?? "საქართველო")}
        </p>
      </section>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="აქტიური მხარდამჭერი"
          value={formatCountKa(delegate.active_supporters)}
          accent="brand"
          sub="ღია რეიტინგში"
        />
        <StatCard
          label="პოზიცია რეიტინგში"
          value={`#${delegate.rank}`}
          sub="დამტკიცებულ დელეგატებს შორის"
        />
      </div>
      <section className="mt-6 rounded-xl border border-line bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-ink">დაუდექი მხარში {delegate.first_name}-ს</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-fg">
          გახდი მისი აქტიური მხარდამჭერი — შეავსე პროფილი და ჩართე ყოველთვიური საწევრო
          რამდენიმე წუთში.
        </p>
        <div className="mt-5">
          <ButtonLink href="/join" className="px-6 py-3">
            გახდი მისი მხარდამჭერი
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Create `app/(public)/delegates/[slug]/not-found.tsx`**

```tsx
import { ButtonLink } from "@/components/ButtonLink";

export default function DelegateNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-serif text-3xl font-bold text-ink">დელეგატი ვერ მოიძებნა.</h1>
      <p className="mt-3 text-muted-fg">ბმული შეიძლება მოძველდა ან არასწორად ჩაიწერა.</p>
      <div className="mt-6">
        <ButtonLink href="/leaderboard" variant="ghost">
          დაბრუნდი რეიტინგზე
        </ButtonLink>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verify.** Run: `npm run typecheck && npm run test`, then load `/delegates/giorgi-maisuradze` (name, #1, 294, CTA) and `/delegates/no-such-slug` (Georgian 404). Run `npm run build` — expected: 12 delegate pages in the static generation output.
- [ ] **Step 8: Commit**

```bash
git add "app/(public)/delegates/[slug]" components/StatCard.tsx components/design-system.test.tsx "app/(public)/styleguide/page.tsx"
git commit -m "feat: public delegate profile pages with rank and supporter stats"
```

### Task 10: Share cards and SEO (OG images, robots, sitemap)

**Files:**
- Create: `assets/fonts/NotoSansGeorgian-Bold.ttf`, `assets/fonts/OFL.txt`, `app/(public)/delegates/[slug]/opengraph-image.tsx`, `scripts/generate-og-default.mjs`, `public/og-default.png`, `app/robots.ts`, `app/sitemap.ts`
- Modify: `next.config.ts` (file tracing), `app/layout.tsx` (default OG image)

**Interfaces:**
- Consumes: `fetchDelegateBySlug`, `fetchPublicDelegates` (Task 6); `formatCountKa` (Task 2); `siteUrl` (Task 2).
- Produces: per-delegate `/delegates/<slug>/opengraph-image` PNG; `/robots.txt` env-gated; `/sitemap.xml`. Consumed by Task 12 e2e.

- [ ] **Step 1: Fetch the font asset** (satori needs TTF/OTF/WOFF — not woff2; commit the file + license):

```bash
mkdir -p assets/fonts
curl -sSL -o assets/fonts/NotoSansGeorgian-Bold.ttf "https://raw.githubusercontent.com/notofonts/georgian/main/fonts/NotoSansGeorgian/hinted/ttf/NotoSansGeorgian-Bold.ttf"
curl -sSL -o assets/fonts/OFL.txt "https://raw.githubusercontent.com/notofonts/georgian/main/OFL.txt"
ls -la assets/fonts
```

Expected: TTF between 50 and 300 KB, OFL.txt ~4 KB. **If the URL 404s** (repo layout changed), get the TTF URL via `curl -sSL -A "" "https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@700"` — with a blank user agent Google serves `format('truetype')` URLs on fonts.gstatic.com; download that URL to the same path. Verify the file starts with bytes `00 01 00 00` (`xxd -l 4 assets/fonts/NotoSansGeorgian-Bold.ttf`).

- [ ] **Step 2: Create `app/(public)/delegates/[slug]/opengraph-image.tsx`**

```tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { formatCountKa } from "@/lib/format";
import { fetchDelegateBySlug } from "@/lib/supabase/public";

export const revalidate = 60;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [delegate, font] = await Promise.all([
    fetchDelegateBySlug(slug),
    readFile(path.join(process.cwd(), "assets/fonts/NotoSansGeorgian-Bold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(150deg, #C8102E 0%, #A30D26 100%)",
          color: "#ffffff",
          fontFamily: "NotoGeo",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 88,
              height: 88,
              borderRadius: 24,
              background: "#ffffff",
              color: "#C8102E",
              fontSize: 40,
            }}
          >
            ქრ
          </div>
          <div style={{ fontSize: 34, opacity: 0.9 }}>ქართული რესპუბლიკა</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 30, opacity: 0.75 }}>
            {delegate ? (delegate.region_name_ka ?? "") : "საჯარო პორტალი"}
          </div>
          <div style={{ fontSize: 76, lineHeight: 1.1 }}>
            {delegate ? `${delegate.first_name} ${delegate.last_name}` : "დელეგატები"}
          </div>
          {delegate ? (
            <div style={{ fontSize: 36, color: "#F4D67A" }}>
              აქტიური მხარდამჭერი: {formatCountKa(delegate.active_supporters)}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", height: 10, width: 260 }}>
          <div style={{ flex: 3, background: "#ffffff" }} />
          <div style={{ flex: 2, background: "rgba(255,255,255,0.35)" }} />
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "NotoGeo", data: font, weight: 700, style: "normal" }] }
  );
}
```

- [ ] **Step 3: Trace the font into the serverless bundle.** In `next.config.ts`, add to the config object:

```ts
  outputFileTracingIncludes: {
    "/delegates/[slug]/opengraph-image": ["./assets/fonts/*.ttf"],
  },
```

(Verification that this key works on Vercel happens on the PR preview during QA — the local `next start` reads the file directly and cannot catch a tracing miss. If the preview's OG image 500s with ENOENT, broaden the key to `"/**"`.)

- [ ] **Step 4: Default OG image.** Create `scripts/generate-og-default.mjs`:

```js
import sharp from "sharp";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <radialGradient id="g" cx="50%" cy="-10%" r="120%">
      <stop offset="0%" stop-color="#1b2c46"/>
      <stop offset="55%" stop-color="#0E1A2B"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="72" y="72" width="156" height="10" rx="5" fill="#C8102E"/>
  <rect x="228" y="72" width="104" height="10" rx="5" fill="#FFFFFF"/>
  <text x="72" y="330" font-family="Noto Sans Georgian, Sylfaen, sans-serif"
        font-size="88" font-weight="700" fill="#FFFFFF">ქართული რესპუბლიკა</text>
  <text x="74" y="404" font-family="Noto Sans Georgian, Sylfaen, sans-serif"
        font-size="40" font-weight="600" fill="#AEB9CA">სამოქალაქო პლატფორმა</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og-default.png");
console.log("public/og-default.png written");
```

Run: `node scripts/generate-og-default.mjs`. Expected: `public/og-default.png written`; open the PNG and confirm Georgian text rendered (not tofu boxes — the generating machine has Sylfaen).

- [ ] **Step 5: Reference the default image.** In `app/layout.tsx` metadata, add:

```tsx
  openGraph: {
    siteName: "ქართული რესპუბლიკა",
    images: ["/og-default.png"],
  },
```

- [ ] **Step 6: Create `app/robots.ts`**

```ts
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") {
    return { rules: { userAgent: "*", allow: "/" }, sitemap: `${siteUrl()}/sitemap.xml` };
  }
  return { rules: { userAgent: "*", disallow: "/" } };
}
```

- [ ] **Step 7: Create `app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { fetchPublicDelegates } from "@/lib/supabase/public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const delegates = await fetchPublicDelegates();
  return [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/delegates`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/leaderboard`, changeFrequency: "hourly", priority: 0.9 },
    ...delegates.map((d) => ({
      url: `${base}/delegates/${d.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
```

- [ ] **Step 8: Verify.** Run `npm run typecheck && npm run lint && npm run build`, then `npm run start` and check: `curl -s http://localhost:3000/robots.txt` contains `Disallow: /`; `curl -s http://localhost:3000/sitemap.xml` lists 15 URLs; `curl -sI http://localhost:3000/delegates/giorgi-maisuradze/opengraph-image` returns `200` with `content-type: image/png`; open that URL in the preview browser and confirm the red card renders the Georgian name. Stop the server.
- [ ] **Step 9: Commit**

```bash
git add assets app/robots.ts app/sitemap.ts "app/(public)/delegates/[slug]/opengraph-image.tsx" scripts/generate-og-default.mjs public/og-default.png next.config.ts app/layout.tsx
git commit -m "feat: per-delegate OG share cards, default OG image, robots gating, sitemap"
```

### Task 11: Hygiene riders (Phase 0 leftovers)

**Files:**
- Modify: `components/Field.tsx`, `.github/workflows/ci.yml`, `DESIGN.md`, plus the three BOM-affected files (located below)
- Test: extend `components/design-system.test.tsx`

- [ ] **Step 1: Write the failing test.** Append to `components/design-system.test.tsx` inside `describe("Field", ...)`:

```tsx
  it("respects a caller-supplied id (label stays linked)", () => {
    render(<Field label="ქალაქი" id="city-input" name="city" />);
    const input = screen.getByLabelText("ქალაქი");
    expect(input.getAttribute("id")).toBe("city-input");
  });
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- components/design-system.test.tsx`. Expected: FAIL — label points at the useId value, input id overridden by spread (or vice versa; either way the assertion fails).
- [ ] **Step 3: Fix `components/Field.tsx`** — destructure `id` and prefer it:

```tsx
import { useId, type InputHTMLAttributes } from "react";

export const inputClasses =
  "rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-brand";

export function Field({
  label,
  error,
  id: idProp,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${inputClasses} ${error ? "border-danger" : "border-line"}`}
        {...props}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
```

(Keep the `inputClasses` export added in Task 7 — if Task 7 already restructured the className, only add the `id` handling.)

- [ ] **Step 4: Run to verify pass.** Run: `npm run test -- components/design-system.test.tsx`. Expected: PASS.
- [ ] **Step 5: Strip BOMs.** Locate: `grep -rlI $'\xEF\xBB\xBF' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=prototype .` (expected: 3 files). Strip:

```bash
node -e "const fs=require('fs');for(const f of process.argv.slice(1)){const b=fs.readFileSync(f);if(b[0]===0xEF&&b[1]===0xBB&&b[2]===0xBF)fs.writeFileSync(f,b.subarray(3));}" <the three files>
```

Re-run the grep — expected: no matches. Run `npm run typecheck && npm run test` — green.

- [ ] **Step 6: Bump CI actions.** In `.github/workflows/ci.yml`: `actions/checkout@v4` → `actions/checkout@v5`; `actions/setup-node@v4` → `actions/setup-node@v5`. (If the PR's CI later fails on a v5 regression, revert this step and note it in the PR body — never ship a flaky pipeline over a version bump.)
- [ ] **Step 7: DESIGN.md.** Append:

```markdown
Page background is white (body bg-white); `surface` #F6F7F9 is for wells, inputs,
pills and inactive elements — matching prototype usage.
```

- [ ] **Step 8: Verify + commit.**

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test
git add -A
git commit -m "chore: Phase 0 hygiene riders (Field id fix, BOM strip, actions v5, DESIGN.md background rule)"
```

### Task 12: e2e suite, CI production-build serving, version bump

**Files:**
- Create: `e2e/public.spec.ts`
- Modify: `playwright.config.ts`, `package.json` (version), `CHANGELOG.md`

**Interfaces:**
- Consumes: everything above; seeded staging (Task 4 — MUST already be applied, see spec §8 sequencing constraint).

- [ ] **Step 1: Switch CI e2e to the production build.** In `playwright.config.ts`, change the `webServer.command` line to:

```ts
    command: process.env.CI ? "npm run start" : "npm run dev",
```

(CI runs `npm run build` immediately before `npm run e2e`, so `next start` serves the real production bundle; locally the dev server stays convenient.)

- [ ] **Step 2: Write `e2e/public.spec.ts`** (read-only against seeded staging):

```ts
import { expect, test } from "@playwright/test";

const DEMO_BANNER = "სადემონსტრაციო გარემო — მონაცემები ფიქტიურია";

test.describe("home", () => {
  test("hero, live counters and nav work", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ავაშენოთ ქართული რესპუბლიკა ერთად" })).toBeVisible();
    await expect(page.getByText(DEMO_BANNER)).toBeVisible();
    for (const id of ["stat-approved-delegates", "stat-active-members"]) {
      const text = await page.getByTestId(id).innerText();
      const value = Number(text.replace(/[^\d]/g, ""));
      expect(value).toBeGreaterThan(0);
    }
    await page.getByRole("navigation").first().getByRole("link", { name: "დელეგატები" }).click();
    await expect(page).toHaveURL(/\/delegates$/);
  });

  test("join CTAs land on the opening-soon page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "გახდი წევრი" }).first().click();
    await expect(page).toHaveURL(/\/join/);
    await expect(page.getByRole("heading", { name: "რეგისტრაცია მალე გაიხსნება" })).toBeVisible();
  });
});

test.describe("delegate directory", () => {
  test("lists approved delegates, search and region filter work", async ({ page }) => {
    await page.goto("/delegates");
    await expect(page.getByTestId("delegate-card")).toHaveCount(12);
    await expect(page.getByText("ბექა ღოღობერიძე")).toHaveCount(0); // pending stays hidden
    await page.getByPlaceholder("ძებნა სახელით...").fill("გიორგი");
    await expect(page.getByTestId("delegate-card")).toHaveCount(1);
    await page.getByPlaceholder("ძებნა სახელით...").fill("");
    await page.getByRole("combobox").selectOption({ label: "გურია" });
    await expect(page.getByTestId("delegate-card")).toHaveCount(1);
    await expect(page.getByText("ეკა მელაძე")).toBeVisible();
    await page.getByPlaceholder("ძებნა სახელით...").fill("zzz");
    await expect(page.getByText("ამ პარამეტრებით დელეგატი ვერ მოიძებნა", { exact: false })).toBeVisible();
  });
});

test.describe("leaderboard", () => {
  test("ranks 12 delegates with a gold medal on top", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByTestId("leader-row")).toHaveCount(12);
    const first = page.getByTestId("leader-row").first();
    await expect(first).toContainText("🥇");
    await expect(first).toContainText("გიორგი მაისურაძე");
    await expect(page.getByText("ბექა ღოღობერიძე")).toHaveCount(0);
  });
});

test.describe("delegate page", () => {
  test("renders profile, rank and share tags by slug", async ({ page, request }) => {
    await page.goto("/delegates/giorgi-maisuradze");
    await expect(page.getByRole("heading", { name: "გიორგი მაისურაძე" })).toBeVisible();
    await expect(page.getByText("#1")).toBeVisible();
    await expect(page.getByText("პოზიცია რეიტინგში")).toBeVisible();
    await expect(page.getByText("აქტიური მხარდამჭერი")).toBeVisible(); // supporter stat present
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toContain("გიორგი მაისურაძე");
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toBeTruthy();
    const image = await request.get(ogImage!);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
  });

  test("unknown slug shows the Georgian 404", async ({ page }) => {
    const response = await page.goto("/delegates/no-such-delegate");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("დელეგატი ვერ მოიძებნა.")).toBeVisible();
  });
});

test.describe("robots", () => {
  test("non-production deployments refuse indexing", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /");
  });
});
```

- [ ] **Step 3: Run the suite locally.** Run: `npm run e2e` (local mode serves via `npm run dev`; the `next start` CI path is exercised on the PR's CI run). Expected: all e2e PASS — existing `smoke.spec.ts` + `login.spec.ts` (logs in with its default phone `599123123`; the seed wiped that user, the test recreates it — its profile stays `draft`, so none of the seeded counts shift) + new `public.spec.ts`.
- [ ] **Step 4: Version + changelog.** In `package.json` set `"version": "0.2.0"`, then run `npm install --package-lock-only` so `package-lock.json` records the same version. In `CHANGELOG.md`, add above the 0.1.0 entry:

```markdown
## 0.2.0 — Phase 1: Public core

- Real public site on seeded staging data: home (hero + live counters), delegate
  directory (search + region filter), leaderboard (top-3 medals), delegate pages
  at /delegates/<slug>
- Public read model: public_delegates + public_stats views; delegates base table
  sealed from client reads; profiles.created_at now server-managed
- Per-delegate OG share cards (next/og + bundled Noto Sans Georgian), default OG
  image, env-gated robots.txt, sitemap
- Deterministic staging seed (prototype roster: 15 delegates, ~1.9k members, guarded)
- Demo-data banner on all non-production environments
- e2e: public-pages suite; CI e2e now runs against the production build (next start)
- Hygiene: BOM cleanup, Field id fix, actions v5, DESIGN.md clarifications
```

- [ ] **Step 5: Full local gate.** Run: `npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build && npm run e2e`. Expected: everything green.
- [ ] **Step 6: Commit**

```bash
git add e2e/public.spec.ts playwright.config.ts package.json package-lock.json CHANGELOG.md
git commit -m "test: public-pages e2e suite; CI e2e serves production build; v0.2.0"
```

---

## Completion (process, not tasks)

1. Final whole-branch review (superpowers:requesting-code-review) + fix loop.
2. Independent `/codex review` + fix loop.
3. Push branch, open PR to `main` (PR template; CI must be green).
4. On the Vercel preview: run `/qa`, then capture the owner sign-off package — screenshots of home (counters), directory (searched + region-filtered), leaderboard (medals), a delegate page, the OG card image itself (`/delegates/giorgi-maisuradze/opengraph-image`), plus 360 px-wide phone versions; verify robots.txt disallows and the demo banner shows on the preview AND on the current production URL (if the production URL lacks the banner, its `NEXT_PUBLIC_APP_ENV` is misconfigured — owner fixes one env var in Vercel: set `NEXT_PUBLIC_APP_ENV=preview` until Phase 6).
5. Owner sign-off on the PR → merge → tag `v0.2.0`.
