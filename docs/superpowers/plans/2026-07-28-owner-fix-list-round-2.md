# Owner Fix List — Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement doc items 2, 3, 5, 8b, 9, 11, 12, 16 from the owner's "What to FIX" doc as approved on 2026-07-28, plus seven ride-along polish carries from round-1 reviews.

**Architecture:** All work lands on `claude/owner-fix-list-round-2-f2c0d7`, one commit per task. Five additive migrations are **authored here and pushed by the owner** at a single checkpoint (Task 9). Two components are extracted rather than duplicated (`EventRow`, `ReferralCard`), one is created (`LeaderboardDirectory`), two are deleted (`TierPicker`, `DelegateDirectory`).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Supabase, vitest + @testing-library/react, Playwright. One new dependency: Resend (via the Vercel Marketplace, Task 8 only).

**Spec:** `docs/superpowers/specs/2026-07-28-owner-fix-list-round-2-design.md`

## Global Constraints

- **Georgian is never hand-typed.** Every string is reused whole from an existing file or derived from one by **deleting characters**. Each task names its splice source with a file path. After any task touching Georgian: `node scripts/ka-gate.mjs --diff main <touched files>`.
- The three composed strings and their sources are in the spec's §11 table. Compose with a script that reads the source files; never retype from the plan.
- **Migrations are authored, never applied, by the implementer.** No `supabase db push` in any task except the owner's command in Task 9. Timestamps run after `20260728100000`.
- **Staging holds the owner's real account.** No reseeding, wiping, or hand-editing data.
- TypeScript strict. No `any`, no `@ts-ignore`. No dependencies beyond Resend in Task 8.
- Component contracts are additive-props-only; any component change updates `/styleguide` **and** `DESIGN.md` in the same task (DESIGN.md rule).
- TDD: failing test first for every behaviour change. Pure deletions use a grep gate instead — stated inline where used.
- Commit messages: write to a temp file and use `git commit -F <file>` — `git commit -m` mangles multi-line messages in this PowerShell environment.
- Per-task verification: `npx vitest run <test file>`, then `npm test`, `npm run typecheck`, `npm run lint` before each commit.
- This worktree starts without `node_modules` or `.env.local` (Task 0 fixes that). Wrappers can exit 0 while dying — read actual test output, never trust a bare exit code.

---

### Task 0: Worktree setup + green baseline

**Files:** none (environment only)

- [ ] **Step 1: Install dependencies** — `npm install` in the worktree root. Expected: completes, `node_modules/` exists.

- [ ] **Step 2: Copy env from the primary checkout**

```powershell
Copy-Item "C:\Users\Mylaptop\Desktop\Claude\Geo Republic Portal\.env.local" ".env.local"
```

- [ ] **Step 3: Baseline gates** — `npm test`, then `npm run typecheck`. Expected: both PASS. If not green, STOP and report — never build on a red baseline.

---

### Task 1: Homepage news + events sections (doc item 2)

`EventRow` is currently a private function inside the events page. Two call sites means extraction, not duplication (CLAUDE.md forbidden patterns).

**Files:**
- Create: `components/EventRow.tsx`, `components/EventRow.test.tsx`
- Modify: `app/(public)/events/page.tsx:19-32` (delete the local function, import instead)
- Modify: `app/(public)/page.tsx`
- Modify: `app/(public)/styleguide/page.tsx`, `DESIGN.md`

**Interfaces:**
- Consumes: `formatEventTimeKa`, `splitEvents` from `lib/community.ts`; `fetchPublicEvents`, `PublicEventItem` from `lib/supabase/public.ts`; `contentPill` from `lib/admin.ts`; `cardSkin` from `components/Card.tsx`.
- Produces: `EventRow({ event: PublicEventItem })` — one linked event row. Used by `/events` and the homepage.

- [ ] **Step 1: Write the failing test** — `components/EventRow.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventRow } from "./EventRow";
import type { PublicEventItem } from "@/lib/supabase/public";

// Georgian fixture values spliced from lib/content-schemas.test.ts:41-44
// (title / description / location) — never retyped.
const EVENT: PublicEventItem = {
  id: "e1",
  slug: "shekhvedra",
  title: "შეხვედრა",
  description: "აღწერა",
  location: "თბილისი, თავისუფლების მოედანი",
  starts_at: "2026-08-01T15:00:00Z",
  ends_at: null,
  status: "published",
  published_at: "2026-07-20T10:00:00Z",
};

describe("EventRow", () => {
  it("links to the event and shows title, location and time", () => {
    render(<EventRow event={EVENT} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/events/shekhvedra");
    expect(link).toHaveTextContent(EVENT.title);
    expect(link).toHaveTextContent(EVENT.location);
  });

  it("marks a cancelled event with a pill", () => {
    render(<EventRow event={{ ...EVENT, status: "cancelled" }} />);
    expect(screen.getByRole("link")).toHaveTextContent("გაუქმებულია");
  });
});
```

The cancelled label comes from `contentPill("cancelled")` — before running, confirm its Georgian label in `lib/admin.ts` and use that exact string in the assertion (splice it, do not retype).

- [ ] **Step 2: Run it** — `npx vitest run components/EventRow.test.tsx` — Expected: FAIL (module not found).

- [ ] **Step 3: Extract the component.** Create `components/EventRow.tsx` holding the function body **byte-identical** to `app/(public)/events/page.tsx:19-32`, exported, with its imports moved over:

```tsx
import Link from "next/link";
import { cardSkin } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatEventTimeKa } from "@/lib/community";
import type { PublicEventItem } from "@/lib/supabase/public";

/** One event line — the date/title/location row shared by /events and the homepage. */
export function EventRow({ event }: { event: PublicEventItem }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className={`${cardSkin} flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:border-brand/50`}
    >
      <span className="text-sm font-semibold text-muted-fg">
        {formatEventTimeKa(event.starts_at, event.ends_at)}
      </span>
      <span className="font-bold text-ink">{event.title}</span>
      <span className="text-sm text-muted-fg">{event.location}</span>
      {event.status === "cancelled" ? <Pill {...contentPill("cancelled")} /> : null}
    </Link>
  );
}
```

In `app/(public)/events/page.tsx`: delete the local `EventRow` function and its now-unused imports (`Link`, `Pill`, `cardSkin`, `contentPill`, `formatEventTimeKa` — keep any still used elsewhere in the file), and add `import { EventRow } from "@/components/EventRow";`.

- [ ] **Step 4: Run** — `npx vitest run components/EventRow.test.tsx` — Expected: PASS. Then `npm test` — Expected: PASS (the events page renders identical markup).

- [ ] **Step 5: Homepage sections.** In `app/(public)/page.tsx`:

Add imports: `NewsCard` from `@/components/NewsCard`, `EventRow` from `@/components/EventRow`, `excerpt` from `@/lib/content-render`, and `fetchPublicEvents` + `splitEvents` (from `@/lib/community`).

Add two constants next to the existing label block. **Splice sources:** `EVENTS_LABEL` from `app/(public)/layout.tsx:24` (the nav label); `NEWS_EMPTY` from `app/(public)/news/page.tsx:24`; `EVENTS_EMPTY` from `app/(public)/events/page.tsx:45`. `NEWS_LABEL` and `FULL` already exist in this file.

```tsx
const EVENTS_LABEL = "ღონისძიებები";
const NEWS_EMPTY = "სიახლეები მალე გამოჩნდება.";
const EVENTS_EMPTY = "მომავალი ღონისძიებები მალე გამოცხადდება.";
```

Extend the data fetch:

```tsx
  const [stats, delegates, tStats, news, events] = await Promise.all([
    fetchPublicStats(),
    fetchPublicDelegates(),
    fetchTransparencyStats(),
    fetchPublicNews(),
    fetchPublicEvents(),
  ]);
  const ranked = rankDelegates(delegates);
  const { upcoming } = splitEvents(events, new Date().toISOString());
```

Insert both sections **inside the main column div**, immediately after the closing `</div>` of the `id="join-strip"` block and before that div's own closing tag:

```tsx
          <div className="mt-10">
            <SectionRule label={NEWS_LABEL} action={<Link href="/news">{FULL}</Link>} />
            {news.length === 0 ? (
              <p className="mt-4 text-muted-fg">{NEWS_EMPTY}</p>
            ) : (
              <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-3">
                {news.slice(0, 3).map((n) => (
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
            )}
          </div>
          <div className="mt-10">
            <SectionRule label={EVENTS_LABEL} action={<Link href="/events">{FULL}</Link>} />
            {upcoming.length === 0 ? (
              <p className="mt-4 text-muted-fg">{EVENTS_EMPTY}</p>
            ) : (
              <div className="mt-6 flex flex-col gap-3">
                {upcoming.slice(0, 3).map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </div>
            )}
          </div>
```

Delete the right-rail news block: the whole `<Card variant="callout">…</Card>` at the end of the `<aside>` (the one containing `{NEWS_LABEL}` and `news.slice(0, 3)`). Keep the `NEWS_LABEL` constant — the new section uses it. Remove the `Card` and `Eyebrow` imports **only if** nothing else in the file still uses them (`Eyebrow` is still used by the kicker — keep it; `Card` becomes unused — remove it).

- [ ] **Step 6: Verify** — `npm test && npm run typecheck && npm run lint`. Expected: PASS. Then `npm run dev`, open `/` and confirm: two new sections in the main column, three news tiles, up to three event rows, no news box in the right rail, `/events` unchanged.

- [ ] **Step 7: Styleguide + DESIGN.md.** Add an `EventRow` demo to the styleguide's content-components card (section 15) reusing the test fixture's shape with strings spliced from the seeded events. Add a `DESIGN.md` furniture row:

```markdown
| `EventRow` | `{ event: PublicEventItem }` | One event line: muted time, bold title, muted location, cancelled Pill when applicable. Shared by `/events` and the homepage events section — never re-declare it locally. |
```

- [ ] **Step 8: Gates + commit** — `node scripts/ka-gate.mjs --diff main components/EventRow.tsx components/EventRow.test.tsx "app/(public)/page.tsx" "app/(public)/events/page.tsx" "app/(public)/styleguide/page.tsx" DESIGN.md`; commit: `feat(home): news and events sections with see-more links (owner fix #2)`

---

### Task 2: `/delegates` index retires into რეიტინგი (doc item 3)

**Files:**
- Modify: `next.config.ts`
- Delete: `app/(public)/delegates/page.tsx`, `components/DelegateDirectory.tsx`, `components/DelegateDirectory.test.tsx`
- Create: `components/LeaderboardDirectory.tsx`, `components/LeaderboardDirectory.test.tsx`
- Modify: `app/(public)/leaderboard/page.tsx`, `app/(public)/layout.tsx:21`, `app/(public)/styleguide/page.tsx:272`, `app/sitemap.ts`, `DESIGN.md`
- Modify: `e2e/public.spec.ts`

**Interfaces:**
- Consumes: `RankedDelegate` from `lib/ranking.ts`, `Region` from `lib/supabase/public.ts`, `LeaderRow` from `components/LeaderRow.tsx`, `inputClasses` from `components/Field.tsx`, `Select` from `components/Select.tsx`.
- Produces: `LeaderboardDirectory({ delegates: RankedDelegate[], regions: Region[] })` — filter controls + the filtered ranking list.

- [ ] **Step 1: Write the failing test** — `components/LeaderboardDirectory.test.tsx`. Build fixtures the way `components/DelegateDirectory.test.tsx` does today (open it and copy its fixture shape and Georgian strings verbatim):

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeaderboardDirectory } from "./LeaderboardDirectory";

// fixtures: copy the delegate/region shapes from components/DelegateDirectory.test.tsx
describe("LeaderboardDirectory", () => {
  it("renders every delegate as a leader row by default", () => {
    render(<LeaderboardDirectory delegates={DELEGATES} regions={REGIONS} />);
    expect(screen.getAllByTestId("leader-row")).toHaveLength(DELEGATES.length);
  });

  it("filters by name", () => {
    render(<LeaderboardDirectory delegates={DELEGATES} regions={REGIONS} />);
    fireEvent.change(screen.getByPlaceholderText("ძებნა სახელით..."), {
      target: { value: DELEGATES[0]!.first_name },
    });
    expect(screen.getAllByTestId("leader-row")).toHaveLength(1);
  });

  it("filters by region", () => {
    render(<LeaderboardDirectory delegates={DELEGATES} regions={REGIONS} />);
    fireEvent.change(screen.getByRole("combobox", { name: "მხარე" }), {
      target: { value: String(REGIONS[0]!.id) },
    });
    for (const row of screen.getAllByTestId("leader-row")) {
      expect(row).toHaveTextContent(REGIONS[0]!.name_ka);
    }
  });

  it("shows the no-results notice when nothing matches", () => {
    render(<LeaderboardDirectory delegates={DELEGATES} regions={REGIONS} />);
    fireEvent.change(screen.getByPlaceholderText("ძებნა სახელით..."), {
      target: { value: "zzz" },
    });
    expect(screen.queryAllByTestId("leader-row")).toHaveLength(0);
    expect(screen.getByText(/ვერ მოიძებნა/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run components/LeaderboardDirectory.test.tsx` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement.** Create `components/LeaderboardDirectory.tsx` by taking `components/DelegateDirectory.tsx` **verbatim** and changing exactly three things: the component name, the rendered body (an `<ol role="list">` of `<li><LeaderRow delegate={d} /></li>` replacing the two-column `DelegateCard` split), and the imports. **Every Georgian string, the search placeholder, the aria-label, the no-results card and the count line stay byte-identical** — they are being moved, not rewritten.

```tsx
"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { inputClasses } from "@/components/Field";
import { LeaderRow } from "@/components/LeaderRow";
import { Select } from "@/components/Select";
import { formatCountKa } from "@/lib/format";
import type { RankedDelegate } from "@/lib/ranking";
import type { Region } from "@/lib/supabase/public";

/**
 * Ranking + filters (owner fix #3): the delegates index retired into რეიტინგი,
 * so the region/name filters that only existed there live here now. Ranks come
 * from rankDelegates() over the FULL list, so filtering never renumbers anyone.
 */
export function LeaderboardDirectory({
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
          className={`${inputClasses} min-w-[220px] flex-1`}
          placeholder="ძებნა სახელით..."
          aria-label="ძებნა სახელით"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          className="max-w-[280px]"
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
        </Select>
      </div>
      {filtered.length > 0 ? (
        <ol className="list-none" role="list">
          {filtered.map((d) => (
            <li key={d.id}>
              <LeaderRow delegate={d} />
            </li>
          ))}
        </ol>
      ) : (
        <Card>
          <div className="text-center text-muted-fg">
            ამ პარამეტრებით დელეგატი ვერ მოიძებნა. სცადე სხვა ძებნა ან აირჩიე „ყველა მხარე“.
          </div>
        </Card>
      )}
      <p
        className="mt-6 border-t-2 border-ink pt-3 text-center text-sm text-muted-fg"
        data-testid="delegate-count"
      >
        ნაჩვენებია {formatCountKa(filtered.length)} დელეგატი
      </p>
    </div>
  );
}
```

The no-results sentence and the count line **must be copied out of `components/DelegateDirectory.tsx` with an editor, not retyped** — the no-results string contains a U+201E/U+201C quote pair that hand-transcription silently corrupts (ADR-023, the ka-gate's exact failure mode).

- [ ] **Step 4: Run** — `npx vitest run components/LeaderboardDirectory.test.tsx` — Expected: PASS.

- [ ] **Step 5: Wire the leaderboard page.** In `app/(public)/leaderboard/page.tsx`: fetch regions alongside delegates and replace the bare `<ol>` with the new component.

```tsx
import { fetchPublicDelegates, fetchRegions } from "@/lib/supabase/public";
import { LeaderboardDirectory } from "@/components/LeaderboardDirectory";
// ...
  const [delegates, regions] = await Promise.all([fetchPublicDelegates(), fetchRegions()]);
  const ranked = rankDelegates(delegates);
```

Replace the `<ol className="list-none" role="list">…</ol>` block with `<LeaderboardDirectory delegates={ranked} regions={regions} />`. Keep the `SectionRule` header, the `Badge` count and the closing footnote paragraph exactly as they are.

- [ ] **Step 6: Redirect + delete the index.** In `next.config.ts`, add to the config object:

```ts
  async redirects() {
    // Owner fix #3: the delegates index duplicated რეიტინგი and retired into it.
    // EXACT source only — /delegates/<slug> profile pages must keep resolving.
    return [{ source: "/delegates", destination: "/leaderboard", permanent: true }];
  },
```

Delete `app/(public)/delegates/page.tsx`, `components/DelegateDirectory.tsx` and `components/DelegateDirectory.test.tsx`. Keep `app/(public)/delegates/[slug]/` and `components/DelegateCard.tsx` untouched.

- [ ] **Step 7: Nav, sitemap, styleguide.**
  - `app/(public)/layout.tsx:21`: delete the `{ href: "/delegates", label: "დელეგატები" }` entry.
  - `app/(public)/styleguide/page.tsx:272`: delete the same entry from the nav demo array.
  - `app/sitemap.ts`: delete the `${base}/delegates` entry. The per-delegate entries stay.
  - `DESIGN.md`: replace the `DelegateDirectory` row with a `LeaderboardDirectory` row describing the same controls over `LeaderRow`.

- [ ] **Step 8: e2e follows the change.** In `e2e/public.spec.ts`:
  - In the `home` test, the final nav assertion clicks `დელეგატები` and expects `/delegates`. Change it to click `რეიტინგი` and expect `/leaderboard$`.
  - Replace the whole `delegate directory` describe with a leaderboard-filter version: `goto("/leaderboard")`, assert `leader-row` count `>= 12`, fill `ძებნა სახელით...` with `გიორგი` and assert `გიორგი მაისურაძე` visible, clear it, `selectOption({ label: "გურია" })` and assert `ეკა მელაძე` visible, then fill "zzz" and assert the no-results text. Keep the pending-delegate absence assertion.
  - Add a redirect test to the `leaderboard` describe:

```ts
  test("the retired /delegates index redirects, profile pages still resolve", async ({ page }) => {
    await page.goto("/delegates");
    await expect(page).toHaveURL(/\/leaderboard$/);
    const profile = await page.goto("/delegates/giorgi-maisuradze");
    expect(profile?.status()).toBe(200);
  });
```

  Note: the leaderboard page now has TWO comboboxes only if another lands later — today the region `Select` is the only one, so `getByRole("combobox")` stays unambiguous.

- [ ] **Step 9: Gates + commit** — `npm test && npm run typecheck && npm run lint`; ka-gate over the new component, the leaderboard page, the layout and the styleguide; commit: `feat(leaderboard): retire the delegates index into რეიტინგი (owner fix #3)`

---

### Task 3: Finances table — members and money per region (doc item 5)

**Files:**
- Create: `supabase/migrations/20260728140000_transparency_region_money.sql`
- Modify: `lib/supabase/public.ts:124-154`
- Modify: `app/(public)/transparency/page.tsx`
- Modify: `e2e/public.spec.ts`

**Interfaces:**
- Produces: `TransparencyRegion { region_id: number; name_ka: string; members: number; collected_gel: number }` (replacing `registered`/`active`), and `TransparencyStats` gains `members: number`.

- [ ] **Step 1: Write the migration** — `supabase/migrations/20260728140000_transparency_region_money.sql`:

```sql
-- Owner fix list #5 (2026-07-27): the finances table shows collected money per
-- region, and the "member" column finally counts members instead of everyone who
-- ever registered. The column set changes, so transparency_regions is dropped and
-- recreated (create-or-replace cannot drop or rename columns); grants restated to
-- match 20260719150000 + the 20260726120000 write-grant revoke.
--
-- Money is attributed to the PAYER'S CURRENT REGION: a member who moves takes their
-- payment history with them. The page's footnote says so in plain Georgian.
drop view transparency_regions;

create view transparency_regions as
select r.id as region_id,
       r.name_ka,
       count(p.id) filter (
         where p.status in ('profile_completed', 'active_member')
       )::int as members,
       coalesce((
         select sum(pay.amount_gel)
           from payments pay
           join profiles pp on pp.id = pay.member_id
          where pp.region_id = r.id and pay.voided_at is null
       ), 0)::numeric(12, 2) as collected_gel
from regions r
left join profiles p on p.region_id = r.id
group by r.id, r.name_ka;

revoke all on transparency_regions from anon, authenticated;
grant select on transparency_regions to anon, authenticated;

-- transparency_stats carried the same lie in its "წევრი" box: registered_members
-- counts every non-draft profile. Add an honest members count; registered_members
-- stays for the box that legitimately counts everyone.
-- Same signature otherwise, and create-or-replace CAN append a trailing column.
create or replace view transparency_stats as
select
  coalesce((select sum(amount_gel) from payments where voided_at is null), 0)::numeric(12, 2)
    as total_gel,
  (select count(*)::int from profiles where status <> 'draft') as registered_members,
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int from profiles
     where status in ('profile_completed', 'active_member')) as members;
```

- [ ] **Step 2: Verify the SQL is well-formed without applying it.** `create or replace view` may only **append** columns — confirm by reading `supabase/migrations/20260719150000_community.sql:205-210` that the first three output columns of `transparency_stats` above appear in the same order with the same names and types. If they do not, the statement will fail at push time. Do not run `supabase db push` (Task 9 is the owner's).

- [ ] **Step 3: Update the TypeScript types.** In `lib/supabase/public.ts`:

```ts
export interface TransparencyStats {
  total_gel: number;
  registered_members: number;
  approved_delegates: number;
  members: number;
}

export interface TransparencyRegion {
  region_id: number;
  name_ka: string;
  members: number;
  collected_gel: number;
}
```

- [ ] **Step 4: Rebuild the page.** In `app/(public)/transparency/page.tsx`:

Sorting comparator (money first, then codepoint order — keep the existing comment about `localeCompare`):

```tsx
  const regions = [...regionsRaw].sort(
    (a, b) => b.collected_gel - a.collected_gel || (a.name_ka < b.name_ka ? -1 : 1),
  );
```

The `წევრი` StatCard reads the honest count:

```tsx
        <StatCard value={formatCountKa(stats.members)} label="წევრი" />
```

Table head and body become three columns. The money header is composed from two verified word sources — `შეგროვებული` from this file's own `TOTAL_GEL` StatCard label and `თანხა` from `app/(admin)/admin/finances/BulkMatch.tsx`; copy those words with an editor, do not retype:

```tsx
          head={
            <>
              <th className={tableThClass}>რეგიონი</th>
              <th className={`${tableThClass} text-right`}>წევრი</th>
              <th className={`${tableThClass} text-right`}>შეგროვებული თანხა (₾)</th>
            </>
          }
```

```tsx
          {regions.map((r) => (
            <tr key={r.region_id} className={tableRowClass}>
              <td className={`${tableCellClass} font-semibold text-ink`}>{r.name_ka}</td>
              <td className={`${tableCellClass} text-right`}>{formatCountKa(r.members)}</td>
              <td className={`${tableCellClass} text-right`}>
                {formatCountKa(Math.round(r.collected_gel))}
              </td>
            </tr>
          ))}
```

- [ ] **Step 5: Typecheck drives the rest** — `npm run typecheck`. Expected: PASS after the edits above. Any remaining error names a consumer of the removed `registered`/`active` fields — fix it, do not cast.

- [ ] **Step 6: e2e.** Add to `e2e/public.spec.ts` a `transparency` describe:

```ts
test.describe("transparency", () => {
  test("the region table shows members and collected money", async ({ page }) => {
    await page.goto("/transparency");
    await expect(page.getByRole("columnheader", { name: "რეგიონი" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "წევრი" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /შეგროვებული თანხა/ })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "აქტიური" })).toHaveCount(0);
  });
});
```

  This test asserts against the **live staging view**, so it only passes after Task 9's push. Mark it `test.fixme` with the reason `awaits the Task 9 migration push` and flip it to `test` in Task 9.

- [ ] **Step 7: Gates + commit** — `npm test && npm run typecheck && npm run lint`; ka-gate over the migration, the page and the spec file; commit: `feat(transparency): members and collected money per region (owner fix #5)`

---

### Task 4: Fixed 10₾ membership fee (doc item 9)

Largest task in the round. The compiler is the worklist: narrowing `Tier` surfaces every site that assumed a choice.

**Files:**
- Create: `supabase/migrations/20260728141000_fixed_membership_fee.sql`
- Modify: `lib/funnel.ts:1-2`, `lib/funnel-schemas.ts:75-80`
- Delete: `components/TierPicker.tsx`, `components/TierPicker.test.tsx`, `app/(member)/me/billing/TierChange.tsx`, `app/(member)/me/billing/TierChange.test.tsx`
- Modify: `app/(member)/me/membership/MembershipWizard.tsx`, `app/(member)/me/billing/page.tsx:48-49`, `app/(member)/me/actions.ts:85-90`, `components/TransferInstructions.tsx`, `app/(member)/me/page.tsx:37`, `app/(public)/page.tsx:23,34,53`, `app/(public)/styleguide/page.tsx:254-257`, `app/(public)/styleguide/samples.tsx:25-27`, `app/(admin)/admin/finances/page.tsx:46-51,100-105`, `DESIGN.md:120`
- Modify: `e2e/membership.spec.ts`, `e2e/funnel-helpers.ts`, `e2e/cabinet.spec.ts`

**Interfaces:**
- Produces: `MEMBERSHIP_FEE_GEL = 10` and `type Tier = typeof MEMBERSHIP_FEE_GEL` from `lib/funnel.ts`; `tierSchema` accepting only `{ tier: 10 }`; `TransferInstructions({ referenceCode })` (the `tier` prop is dropped — the fee is fixed); `changeTierAction` and the `member_change_tier` RPC removed.

- [ ] **Step 1: Write the failing test.** Add to `lib/funnel-schemas.test.ts`:

```ts
describe("tierSchema — fixed fee (owner fix #9)", () => {
  it("accepts the fixed 10 GEL fee", () => {
    expect(tierSchema.safeParse({ tier: 10 }).success).toBe(true);
  });

  it("rejects the retired 5 and 20 GEL tiers", () => {
    expect(tierSchema.safeParse({ tier: 5 }).success).toBe(false);
    expect(tierSchema.safeParse({ tier: 20 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run lib/funnel-schemas.test.ts` — Expected: the two rejection assertions FAIL (5 and 20 still parse).

- [ ] **Step 3: Narrow the types.** `lib/funnel.ts` lines 1-2 become:

```ts
/** Membership is a fixed monthly fee (owner fix #9) — the 5/10/20 choice is retired. */
export const MEMBERSHIP_FEE_GEL = 10;
export type Tier = typeof MEMBERSHIP_FEE_GEL;
```

`lib/funnel-schemas.ts:79` — replace the union with `z.literal(10)`, keeping the surrounding object and its Georgian error message byte-identical.

- [ ] **Step 4: Run** — `npx vitest run lib/funnel-schemas.test.ts` — Expected: PASS. Then `npm run typecheck` — Expected: FAILS across the tier UI. That error list is the worklist for Steps 5-8.

- [ ] **Step 5: Delete the pickers.** Delete `components/TierPicker.tsx`, `components/TierPicker.test.tsx`, `app/(member)/me/billing/TierChange.tsx`, `app/(member)/me/billing/TierChange.test.tsx`. Remove `changeTierAction` from `app/(member)/me/actions.ts` (lines 85-90) and its now-unused `tierSchema` import if nothing else in the file uses it. In `app/(public)/styleguide/samples.tsx` delete `TierPickerSample`; in `app/(public)/styleguide/page.tsx` delete the section-12 Card and the `TierPickerSample` import. Delete the `TierPicker` row from `DESIGN.md:120`.

- [ ] **Step 6: The wizard confirms instead of asking.** In `app/(member)/me/membership/MembershipWizard.tsx`: remove the `TierPicker` import; replace `const [tier, setTier] = useState<Tier>(10);` with `const tier: Tier = MEMBERSHIP_FEE_GEL;` (importing `MEMBERSHIP_FEE_GEL` from `@/lib/funnel`); delete the now-unused `setTier`. Replace the step-2 lede and picker with a confirmation panel. **Copy rule:** the "choose your fee" sentence is deleted whole; the following sentence stands alone; the amount markup is copied from the deleted `TierPicker`'s option body so the serif-amount styling is preserved:

```tsx
        <h2 className="font-serif font-bold border-b-2 border-ink pb-2">საწევრო შენატანი</h2>
        <p className="mb-5 mt-1 text-sm text-muted-fg">
          შენატანი ამყარებს მოძრაობის დამოუკიდებლობას.
        </p>
        <div className="border border-ink bg-paper-bright p-4 text-center">
          <span className="block font-serif text-3xl font-bold text-ink">
            {MEMBERSHIP_FEE_GEL}
            <small className="text-lg font-bold">₾</small>
          </span>
          <span className="mt-1 block text-[0.74rem] font-bold text-muted-fg">თვეში</span>
        </div>
```

Everything below (the error line, the completion `Button`, the bank-transfer footnote, the back `Button`) is unchanged, and `completeTier` still sends `{ tier }`.

- [ ] **Step 7: Billing and transfer instructions.** In `components/TransferInstructions.tsx`: drop the `tier` prop and its `Tier` import; replace the `{tier !== null ? … : null}` block with the unconditional sentence using `MEMBERSHIP_FEE_GEL` in place of `{tier}` (the Georgian sentence itself is unchanged). In `app/(member)/me/billing/page.tsx`: delete the `TierChange` import and its render line and the comment above it; call `<TransferInstructions referenceCode={state.referenceCode} />`. Above it, state the fee with the same markup the wizard uses, so the member sees the amount without a picker.

- [ ] **Step 8: Copy sweep — deletion only, never retype.**
  - `app/(public)/page.tsx:34` (`P2`): delete `არჩევითია ` and, inside `5, 10 ან 20₾`, delete `5, ` and ` ან 20`, leaving `10₾`. Result: `წევრობის შენატანი — 10₾ თვეში — და ყველა…`.
  - `app/(public)/page.tsx:53` (`LADDER_2_PRICE`): delete `5/` and `/20`, leaving `10₾ თვეში`.
  - `app/(public)/page.tsx:23`: the header comment claims membership is "a CHOICE of 5/10/20 GEL/month". Correct it to the fixed fee and cite owner fix #9.
  - `app/(member)/me/page.tsx:37`: `ყოველთვიური საწევრო 5₾-დან.` — delete `5₾-დან` and paste the `10₾` token spliced from `LADDER_2_PRICE` (reuse of a whole token, not a retype), giving `ყოველთვიური საწევრო 10₾.`
  - Grep gate: `grep -rn "5₾\|20₾\|5, 10\|5/10/20\|₾-დან" --include="*.tsx" --include="*.ts" app components lib` returns **0 hits** outside test fixtures asserting historical payment amounts.

- [ ] **Step 9: Admin finances loses the distribution block.** In `app/(admin)/admin/finances/page.tsx`: delete the `tierRows` array (lines 46-51), the `maxTier` constant, and the block that maps over `tierRows` (around lines 100-105) together with its surrounding Card/heading if that Card has no other content. `mrr_gel` and `active_count` displays stay.

- [ ] **Step 10: The migration** — `supabase/migrations/20260728141000_fixed_membership_fee.sql`:

```sql
-- Owner fix list #9 (2026-07-27): membership is a fixed 10 GEL/month. The 5/10/20
-- choice is retired from the product, so the database stops accepting anything else.
--
-- BACKFILL SAFETY (verified before the owner approved this): payments carry
-- tier_gel_at_payment, frozen at the moment of payment, and payments.months_covered
-- is a GENERATED column derived from it (20260717150000:43-44). Re-tagging a
-- profile's membership_tier therefore CANNOT retroactively change what any past
-- payment bought. Only future obligation changes.
--
-- protect_profile_columns() guards membership_tier only for
-- current_user in ('anon','authenticated') (20260721120000:56), so the migration
-- role updates it directly — no trigger juggling needed.

update profiles set membership_tier = 10
 where membership_tier is not null and membership_tier <> 10;

alter table profiles add constraint profiles_membership_tier_fixed
  check (membership_tier is null or membership_tier = 10);

-- The self-service tier switcher has no product surface any more.
drop function member_change_tier(int);
```

Then, in the same file, `create or replace function become_member_complete(p_tier int)` — copy the body **VERBATIM** from `20260721120000_progressive_registration.sql:529-581` (the `create function` line through its own `end $$;` — verify those boundaries by structure, not by these line numbers; 585 onward is a different function whose body contains a `'draft'` literal that would abort the push), changing exactly one line: the tier guard (`if p_tier is null or p_tier not in (5, 10, 20) then raise exception 'invalid_tier'; end if;`) becomes:

```sql
  if p_tier is distinct from 10 then raise exception 'invalid_tier'; end if;
```

Same signature, so no drop and grants survive.

Finally, the finance stats view — the column set shrinks, so drop and recreate with grants restated (copy the grant statement for `admin_finance_stats` from `20260717150000_admin_crm.sql` and repeat it verbatim):

```sql
drop view admin_finance_stats;

create view admin_finance_stats as
select
  (select coalesce(sum(membership_tier), 0)::int
     from profiles where status = 'active_member') as mrr_gel,
  (select count(*)::int from profiles where status = 'active_member') as active_count
where has_any_admin_role('super_admin', 'finance');
```

- [ ] **Step 11: e2e follows the flow.** Any spec that picks a tier in the wizard (search: `grep -rn "TierPicker\|selectOption.*20\|getByRole(\"radio\"" e2e/`) drops the selection step — the confirmation panel has no radios. `e2e/funnel-helpers.ts`'s membership completion helper likewise. Assertions on `შენი საწევრო: N ₾` from the billing page change to the new fixed-fee display.

- [ ] **Step 12: Gates + commit** — `npm test && npm run typecheck && npm run lint`; ka-gate over every touched tsx plus the migration; commit: `feat(membership): fixed 10 GEL monthly fee everywhere (owner fix #9)`

---

### Task 5: Countable referral links for members and delegates (doc item 12)

**Files:**
- Create: `supabase/migrations/20260728142000_member_referral_codes.sql`
- Move: `app/(delegate)/delegate/ReferralCard.tsx` → `components/ReferralCard.tsx`; `app/(delegate)/delegate/ReferralCard.test.tsx` → `components/ReferralCard.test.tsx`
- Modify: `app/(delegate)/delegate/page.tsx:79`, `app/(member)/me/page.tsx`, `app/(member)/me/profile/page.tsx`
- Modify: `lib/funnel.ts` (`CabinetStatePresent`), `lib/cabinet.ts` (`DelegatePanelData`)
- Modify: `app/(public)/styleguide/page.tsx`, `DESIGN.md`

**Interfaces:**
- Produces: `ReferralCard({ code: string, count: number })` from `components/ReferralCard.tsx`; `CabinetStatePresent` gains `referralCode: string | null` and `referralCount: number`; `DelegatePanelData` gains `referralCount: number`; SQL function `mint_member_referral_code()`.

- [ ] **Step 1: Write the failing test.** Rename the existing test file to `components/ReferralCard.test.tsx`, update its import to `./ReferralCard`, and append:

```tsx
  it("shows how many people registered through the link (owner fix #12)", () => {
    render(<ReferralCard code="M-ABC234" count={7} />);
    expect(screen.getByTestId("referral-count")).toHaveTextContent("7");
  });
```

- [ ] **Step 2: Run it** — `npx vitest run components/ReferralCard.test.tsx` — Expected: FAIL (module path and/or missing prop).

- [ ] **Step 3: Move and extend the component.** `git mv app/(delegate)/delegate/ReferralCard.tsx components/ReferralCard.tsx`, then add the `count` prop and the count line. **The count's label is reused byte-exact** from the delegate panel's existing registered-count label — open `app/(delegate)/delegate/page.tsx`, find the label rendered next to `panel.registeredCount`, and copy that string:

```tsx
export function ReferralCard({ code, count }: { code: string; count: number }) {
```

and, immediately above the closing explainer `<p>`:

```tsx
      <p className="mt-3 flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
        <span className="text-[0.74rem] text-muted-fg">{REGISTERED_LABEL}</span>
        <span className="font-serif text-xl font-bold text-ink" data-testid="referral-count">
          {formatCountKa(count)}
        </span>
      </p>
```

with `REGISTERED_LABEL` declared at the top of the file from the spliced label and `formatCountKa` imported from `@/lib/format`.

- [ ] **Step 4: Run** — `npx vitest run components/ReferralCard.test.tsx` — Expected: PASS.

- [ ] **Step 5: The migration** — `supabase/migrations/20260728142000_member_referral_codes.sql`:

```sql
-- Owner fix list #12 (2026-07-27): every registered person gets a countable
-- referral link, not just approved delegates.
--
-- COLLISION SAFETY: delegate codes are 6 chars from gen_funnel_code's
-- [A-HJKMNP-Z2-9] alphabet and payment references are 'GR-' || 6 chars. Member
-- codes are 'M-' || 6 chars from the same alphabet. A hyphen cannot occur inside a
-- delegate code, so a signup_ref_code can never be ambiguous between the two
-- tables — attribution is exact by construction, not by a cross-table lookup.
alter table profiles add column referral_code text unique
  check (referral_code ~ '^M-[A-HJKMNP-Z2-9]{6}$');

create function mint_member_referral_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_code text;
begin
  for i in 1..20 loop
    v_code := 'M-' || public.gen_funnel_code(6);
    if not exists (select 1 from public.profiles where referral_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'referral_code_exhausted';
end $$;

revoke execute on function mint_member_referral_code() from public, anon, authenticated;

-- Backfill every existing profile. The unique constraint is the final guard; the
-- loop re-runs only for rows a collision skipped.
do $$
declare v_left int := -1;
begin
  for i in 1..20 loop
    begin
      update public.profiles
         set referral_code = public.mint_member_referral_code()
       where referral_code is null;
    exception when unique_violation then
      null; -- retry the survivors on the next pass
    end;
    select count(*) into v_left from public.profiles where referral_code is null;
    exit when v_left = 0;
  end loop;
  if v_left <> 0 then
    raise exception 'referral_code backfill did not converge: % rows left', v_left;
  end if;
end $$;

alter table profiles alter column referral_code set not null;

-- The count query runs on every cabinet render; the existing index is partial
-- (status = 'draft', 20260716140000:89) and cannot serve it.
create index if not exists profiles_by_signup_ref_code
  on public.profiles (signup_ref_code);
```

Then three function restatements in the same file:

1. `create or replace function register(p_first_name text, p_last_name text, p_ref_code text default null)` — copy the body **VERBATIM** from `20260728100000_personal_id_at_membership.sql` (its `register()` definition), adding `referral_code` to the insert: the column list gains `, referral_code` and the values list gains `, public.mint_member_referral_code()`. Same signature, so no drop and grants survive.

2. `create or replace function cabinet_state()` — copy the body **VERBATIM** from `20260728100000_personal_id_at_membership.sql`'s `cabinet_state()`, adding two keys to the final `jsonb_build_object`, right after `'hasPersonalId', …`:

```sql
    'referralCode', coalesce(
      (select d.referral_code from public.delegates d
        where d.id = v_uid and d.status = 'approved'),
      v_profile.referral_code),
    'referralCount', (select count(*) from public.profiles p2
                       where p2.signup_ref_code = coalesce(
                         (select d.referral_code from public.delegates d
                           where d.id = v_uid and d.status = 'approved'),
                         v_profile.referral_code)),
```

   One person, one link: an approved delegate's link stays their delegate code (which also binds delegacy); everyone else uses their profile code.

3. `create or replace function delegate_panel()` — copy the body **VERBATIM** from `20260722120000_r2_ladder_and_numbers.sql:262-290`, adding one key after `'registeredCount', …`:

```sql
    'referralCount', (select count(*)
                        from public.profiles p
                       where p.signup_ref_code = v_delegate.referral_code)
```

   Distinct from `registeredCount`, which counts only `status = 'registered'`; this counts every sign-up the link produced.

- [ ] **Step 6: Types.** In `lib/funnel.ts`, `CabinetStatePresent` gains:

```ts
  /** This person's referral link code — the delegate code when approved, else their own (owner fix #12). */
  referralCode: string | null;
  /** How many profiles signed up with that code. */
  referralCount: number;
```

In `lib/cabinet.ts`, `DelegatePanelData` gains `referralCount: number;` with a one-line comment distinguishing it from `registeredCount`.

- [ ] **Step 7: Call sites.**
  - `app/(delegate)/delegate/page.tsx:79`: `{panel.referralCode ? <ReferralCard code={panel.referralCode} count={panel.referralCount} /> : null}`, import updated to `@/components/ReferralCard`.
  - `app/(member)/me/page.tsx` (registered people): render `<ReferralCard code={state.referralCode} count={state.referralCount} />` below the membership CTA Card, guarded by `state.referralCode !== null`.
  - `app/(member)/me/profile/page.tsx` (members — `/me` redirects them here): render the same card in the right-hand column stack, below the `ჩემი დელეგატი` Card, with the same null guard.

- [ ] **Step 8: Styleguide + DESIGN.md.** Add a `ReferralCard` demo (`code="M-ABC234" count={12}`) to the styleguide. Add the DESIGN.md row:

```markdown
| `ReferralCard` | `{ code, count }` | Callout with the personal referral URL, copy button, QR and the sign-up count. One card for members and delegates — the code differs, the card does not. |
```

- [ ] **Step 9: Gates + commit** — `npm test && npm run typecheck && npm run lint`; ka-gate over the moved component, both cabinet pages, the styleguide and the migration; commit: `feat(referrals): countable referral links for every member (owner fix #12)`

---

### Task 6: Admin city filter + status vocabulary (doc item 16)

**Files:**
- Create: `supabase/migrations/20260728143000_admin_members_city.sql`
- Modify: `lib/admin-schemas.ts:124-135`, `lib/admin.ts:56-60`, `lib/cabinet.ts` (`TEAM_STATUS_LABELS`)
- Modify: `app/(admin)/admin/members/page.tsx`, `app/(admin)/admin/members/ExportControls.tsx`
- Modify: `lib/admin.test.ts` / `lib/admin-schemas.test.ts`, any suite asserting the old labels

**Interfaces:**
- Produces: `admin_members` view gains `city_id`; `membersFilterSchema` gains `cityId?: number`; `MEMBER_STATUS_LABELS_KA` and `TEAM_STATUS_LABELS` carry the disambiguated wording.

- [ ] **Step 1: Write the failing tests.** In `lib/admin-schemas.test.ts`:

```ts
it("parses the city filter (owner fix #16)", () => {
  expect(membersFilterSchema.parse({ cityId: "7" }).cityId).toBe(7);
  expect(membersFilterSchema.parse({ cityId: "abc" }).cityId).toBeUndefined();
});
```

In `lib/admin.test.ts`:

```ts
it("status labels distinguish paying members from unpaid ones (owner fix #16)", () => {
  expect(MEMBER_STATUS_LABELS_KA.registered).toBe("რეგისტრირებული");
  expect(MEMBER_STATUS_LABELS_KA.profile_completed).toBe("წევრი (გადახდის გარეშე)");
  expect(MEMBER_STATUS_LABELS_KA.active_member).toBe("აქტიური წევრი");
});
```

The two new labels must be **composed by script** from their sources (spec §11 table), then pasted into the test — not retyped from this plan.

- [ ] **Step 2: Run** — `npx vitest run lib/admin-schemas.test.ts lib/admin.test.ts` — Expected: both new tests FAIL.

- [ ] **Step 3: Implement the labels.** `lib/admin.ts:56-60` gets the three composed strings. `lib/cabinet.ts`'s `TEAM_STATUS_LABELS` gets the same two replacements (`profile_completed`, `active_member`) — the delegate's team table carries the identical ambiguity and the spec requires one vocabulary. Update any suite that asserted the old labels; the CSV exporter needs no change because it receives `statusKa` from the caller.

- [ ] **Step 4: Run** — `npx vitest run lib/admin.test.ts lib/cabinet.test.ts` — Expected: PASS.

- [ ] **Step 5: The migration** — `supabase/migrations/20260728143000_admin_members_city.sql`:

```sql
-- Owner fix list #16 (2026-07-27): the member list gains a city filter. The view
-- already exposes city_name_ka for display but not the id the filter needs.
-- create-or-replace may only APPEND columns, so city_id goes last.
```

followed by `create or replace view admin_members as` with the select list copied **VERBATIM** from `20260722120000_r2_ladder_and_numbers.sql:222` through the end of that statement, adding `p.city_id` as the **last** item of the select list (immediately before `from profiles p`), everything else unchanged.

- [ ] **Step 6: Schema + page.** `lib/admin-schemas.ts`: add to `membersFilterSchema`, after `regionId`:

```ts
  cityId: z.coerce.number().int().positive().optional().catch(undefined),
```

In `app/(admin)/admin/members/page.tsx`:
  - apply the filter next to the region one: `if (filter.cityId) query = query.eq("city_id", filter.cityId);`
  - fetch cities for the dropdown, scoped to the chosen region when there is one:

```tsx
  let citiesQuery = supabase.from("cities").select("id, name_ka, region_id").order("name_ka");
  if (filter.regionId) citiesQuery = citiesQuery.eq("region_id", filter.regionId);
  const { data: cities, error: citiesError } = await citiesQuery;
  if (citiesError) throw new Error(`cities failed: ${citiesError.message}`);
```

  - add the control after the region `<label>`, reusing that label's exact class string. The label word `ქალაქი` is spliced from `lib/csv.ts`'s `BASE_HEADERS`; the "all" option text is spliced from the region select's `ყველა მხარე` pattern — copy `ყველა ` from it and `ქალაქი` from the CSV headers:

```tsx
          <label className="flex min-w-[170px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            ქალაქი
            <Select
              variant="admin"
              name="cityId"
              defaultValue={filter.cityId ? String(filter.cityId) : ""}
            >
              <option value="">ყველა ქალაქი</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ka}
                </option>
              ))}
            </Select>
          </label>
```

  - carry it through pagination and export: add `if (filter.cityId) currentParams.set("cityId", String(filter.cityId));` next to the existing params, and pass `cityId={filter.cityId}` to `<ExportControls>`, threading it into the export action so the CSV never sees a different row set than the list (that invariant is stated in the file's own comment at line 44).

- [ ] **Step 7: Verify** — `npm test && npm run typecheck && npm run lint`. Expected: PASS. The city filter itself only works against staging after Task 9's push; note that in the commit body.

- [ ] **Step 8: Gates + commit** — ka-gate over `lib/admin.ts`, `lib/cabinet.ts`, the members page and the migration; commit: `feat(admin): city filter and unambiguous member status wording (owner fix #16)`

---

### Task 7: Ride-along polish (seven round-1 review carries)

No behaviour changes except item 6. Each is independent; one commit.

**Files:** `app/(public)/styleguide/page.tsx`, `components/CabinetNav.test.tsx`, `app/(public)/join/JoinForm.test.tsx`, `components/NewsCard.test.tsx`, `components/NewsCard.tsx`, `app/(member)/me/membership/MembershipWizard.tsx:242`

- [ ] **Step 1: Label the three NewsCard demos.** In the styleguide's section-15 Card, wrap each `NewsCard` in a labelled group so `row`/`lead`/`tile` are tellable apart. Use the variant name itself (ASCII, no Georgian needed):

```tsx
            <p className="text-[0.74rem] font-bold uppercase tracking-[.08em] text-muted-fg">row</p>
```

immediately before each of the three cards, with `lead` and `tile` on the other two.

- [ ] **Step 2: Restore the `vi.hoisted` explainer.** Above the `vi.hoisted` block in `components/CabinetNav.test.tsx`:

```tsx
// vi.hoisted: vi.mock factories are hoisted above imports, so the mocks they
// close over must be created in a hoisted block too — a plain const here would
// still be in the temporal dead zone when the factory runs. pathnameRef is a
// mutable box (not a value) so a test can retarget usePathname per case.
```

- [ ] **Step 3: Clean the JoinForm test comments.** In `app/(public)/join/JoinForm.test.tsx`: delete both `// render JoinForm exactly as the first existing test in this file does` lines (lines 169 and 179 — the tests now do exactly that, so the instruction is stale). In the describe at line 167, the test name repeats `(owner fix #6)` already carried by the describe — drop it from the inner test name, leaving `it("no phone section heading — the field's own label names it", …)`.

- [ ] **Step 4: Strengthen the tile assertion.** In `components/NewsCard.test.tsx`, the tile test asserts only the image ratio. Add the two properties that actually separate tile from lead:

```tsx
    expect(screen.getByRole("heading").className).toContain("text-lg");
    expect(screen.getByText("მოკლე შინაარსი…").className).toContain("line-clamp-2");
```

  Splice the excerpt string from the test's own fixture rather than retyping it.

- [ ] **Step 5: Fix the NewsCard variant JSDoc.** `components/NewsCard.tsx:21` claims `row` is the "cabinet/homepage brief". The homepage renders `tile` (Task 1) and never rendered a `row`. Correct it:

```tsx
  /** row = cabinet brief (default) · lead = full-width opener · tile = grid card (news index + homepage) */
```

- [ ] **Step 6: Drop the ID field's maxLength.** `app/(member)/me/membership/MembershipWizard.tsx:242`: delete `maxLength={11}`. The browser cap pre-empted the paste normalisation added in round 1, so that normalisation was unreachable; zod still enforces the 11-digit rule server-side and in the schema.

- [ ] **Step 7: Merge the overlapping JoinForm tests.** The test at line 115 ("routes a generic/transient register() error to the retry phase") and the regression at line 137 now drive an identical setup — both mock `{ ok: false, error: GENERIC_FUNNEL_ERROR }` and assert the retry phase. Delete the line-115 test and keep the line-137 one, which additionally proves the successful resubmit; move the line-115 test's two unique assertions (`queryByRole("button", { name: "გაგრძელება →" })` is null, and `signInWithOtpMock` called once **before** the resubmit) into it, and retitle it to cover both:

```tsx
  it("a non-auth register failure keeps the proven session: retry phase, no second SMS, resubmit succeeds", async () => {
```

- [ ] **Step 8: Verify** — `npx vitest run components/NewsCard.test.tsx components/CabinetNav.test.tsx "app/(public)/join/JoinForm.test.tsx" "app/(member)/me/membership/MembershipWizard.test.tsx"` — Expected: PASS, with the JoinForm suite one test shorter. Then `npm test && npm run typecheck && npm run lint`.

- [ ] **Step 9: Commit** — ka-gate over the touched files; commit: `chore: round-1 review carries — test clarity, styleguide labels, ID field cap`

---

### Task 8: Support page (doc item 11) — GATED

**BLOCKED until the owner supplies all three:**
1. The Georgian copy block (heading, lede, three field labels, submit button, success line, failure line, footer link label). This is the only new Georgian prose in the round and the integrity gate forbids inventing it.
2. The destination address, set by the owner as `SUPPORT_EMAIL_TO`.
3. The Resend integration provisioned on their Vercel project, so `RESEND_API_KEY` exists.

If any is missing when this task comes up: **skip it, say so, and continue to Task 9.** Do not stub the page, do not invent Georgian, do not write code against a mocked mail client (Marketplace rule: provision first, then build).

**Files:**
- Create: `supabase/migrations/20260728144000_support_messages.sql`
- Create: `lib/support-schemas.ts` + `lib/support-schemas.test.ts`
- Create: `app/(public)/support/page.tsx`, `app/(public)/support/SupportForm.tsx`, `app/(public)/support/actions.ts`
- Create: `app/(admin)/admin/support/page.tsx`
- Modify: `app/(public)/layout.tsx` (footer link), `lib/admin.ts` (`TAB_MATRIX`), `DECISIONS.md` (dependency rationale)

**Interfaces:**
- Produces: `supportMessageSchema` (`{ name: string; contact: string; message: string }`); server action `submitSupportMessageAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }>`; RPC `submit_support_message(p_name text, p_contact text, p_message text, p_ip_hash text)`.

- [ ] **Step 1: Confirm the gate.** Verify `RESEND_API_KEY`, `SUPPORT_EMAIL_TO` and `SUPPORT_EMAIL_FROM` are present (`vercel env ls` shows names only — never echo values) and that the owner's copy block is in hand. If not, stop this task.

- [ ] **Step 2: Write the failing schema test** — `lib/support-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { supportMessageSchema } from "./support-schemas";

// NAME is spliced from an existing fixture (e.g. e2e/public.spec.ts's seeded
// delegate first name); MESSAGE from the owner's copy block. The boundary cases
// use the repo's existing repeat idiom ("ა".repeat(n), lib/content-schemas.test.ts:58)
// so no prose is invented.
describe("supportMessageSchema", () => {
  it("accepts a filled form", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      contact: "+995555123456",
      message: MESSAGE,
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty name, a too-short contact and a too-short message", () => {
    expect(
      supportMessageSchema.safeParse({ name: "", contact: "x", message: "ა".repeat(9) }).success,
    ).toBe(false);
  });

  it("rejects a message over 2000 characters", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      contact: "+995555123456",
      message: "ა".repeat(2001),
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run it** — `npx vitest run lib/support-schemas.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 4: Implement the schema** — `lib/support-schemas.ts`, error messages taken from the owner's copy block:

```ts
import { z } from "zod";

export const supportMessageSchema = z.object({
  name: z.string().trim().min(1).max(60),
  contact: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;
```

- [ ] **Step 5: Run** — `npx vitest run lib/support-schemas.test.ts` — Expected: PASS.

- [ ] **Step 6: The migration** — `supabase/migrations/20260728144000_support_messages.sql`:

```sql
-- Owner fix list #11 (2026-07-27): the support page emails the owner AND keeps a
-- durable copy, so a mail outage cannot lose a message. Insert happens only through
-- this definer RPC — the table itself is unreachable from client roles.
create table support_messages (
  id bigserial primary key,
  name text not null,
  contact text not null,
  message text not null,
  ip_hash text,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table support_messages enable row level security;
revoke all on support_messages from anon, authenticated;
revoke all on sequence support_messages_id_seq from anon, authenticated;

create index support_messages_by_ip_recent on support_messages (ip_hash, created_at desc);

create function submit_support_message(
  p_name text, p_contact text, p_message text, p_ip_hash text default null
) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare v_id bigint;
begin
  if p_name is null or length(btrim(p_name)) not between 1 and 60
     or p_contact is null or length(btrim(p_contact)) not between 3 and 120
     or p_message is null or length(btrim(p_message)) not between 10 and 2000 then
    raise exception 'invalid_support_message';
  end if;
  -- public form: throttle per hashed IP, 3 per 10 minutes
  if p_ip_hash is not null and (
    select count(*) from public.support_messages
     where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'too_many_requests';
  end if;
  insert into public.support_messages (name, contact, message, ip_hash)
  values (btrim(p_name), btrim(p_contact), btrim(p_message), p_ip_hash)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function submit_support_message(text, text, text, text) to anon, authenticated;

create function mark_support_message_emailed(p_id bigint) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.support_messages set emailed_at = now() where id = p_id;
end $$;

revoke execute on function mark_support_message_emailed(bigint) from public, anon, authenticated;

create view admin_support_messages as
select id, name, contact, message, emailed_at, created_at
from support_messages
where has_any_admin_role('super_admin');

revoke all on admin_support_messages from anon, authenticated;
grant select on admin_support_messages to authenticated;
```

- [ ] **Step 7: Provision-backed mail send.** `npm install resend`. The server action: parse with zod → hash the forwarded-for header with `SUPPORT_EMAIL_SALT` → call `submit_support_message` → then send via Resend → on success call `mark_support_message_emailed` with the service client. Row first, mail second: a mail outage must not lose the message, and the visitor still gets a success answer.

- [ ] **Step 8: Page, form, admin list, footer link.** Build `app/(public)/support/page.tsx` + `SupportForm.tsx` from the owner's copy block using `Field`, `Button` and `Card` (no ad-hoc styling — DESIGN.md rule). Add `/admin/support` as a read-only `DataTable` over `admin_support_messages`, gated on `super_admin` via the existing `TAB_MATRIX` pattern. Add the footer link to `app/(public)/layout.tsx`'s `footerLinks`.

- [ ] **Step 9: Record the dependency** — append to `DECISIONS.md` the Resend rationale (CLAUDE.md forbids adding a dependency without one): only messaging product on the Vercel Marketplace, provisioned by the owner, key never in the repo.

- [ ] **Step 10: Gates + commit** — `npm test && npm run typecheck && npm run lint`; ka-gate over every new file with Georgian; commit: `feat(support): public support page emailing the owner (owner fix #11)`

---

### Task 9: Owner pushes the migrations, then live verification

- [ ] **Step 1: List what is pending.** `git diff --name-only main -- supabase/migrations/` — expect the four (or five, with Task 8) files authored above.

- [ ] **Step 2: Hand the owner this command** (PowerShell 5.1 — no `&&`, no bash idioms):

```powershell
npx supabase db push
```

  Then STOP and wait. Do not run it from this session.

- [ ] **Step 3: Verify live, read-only.** After the owner confirms, run a scratch script (not committed) with the anon key from `.env.local`, in the pattern of round 1's Task 8 Step 4:
  - `transparency_regions` returns `members` and `collected_gel`, and the member totals are `<=` the old registered totals.
  - `profiles` has no null `referral_code`, and every value matches `^M-[A-HJKMNP-Z2-9]{6}$`.
  - No profile has a `membership_tier` other than 10 or null.
  - `register` with 4 arguments still fails; `member_change_tier` no longer exists.

- [ ] **Step 4: Flip the deferred test.** Change Task 3's `test.fixme` in `e2e/public.spec.ts` back to `test` and run it.

- [ ] **Step 5: Commit** — `test(e2e): enable the transparency assertions after the migration push`

---

### Task 10: Docs, full gates, PR + preview handoff

**Files:** `DECISIONS.md`, `CHANGELOG.md`

- [ ] **Step 1: ADR-024** — append to `DECISIONS.md` (keep its voice; content, not verbatim):
  - Source: owner "What to FIX" doc items 2/3/5/8b/9/11/12/16 as approved 2026-07-28. Item 13 not delivered — text never supplied, source doc needs the owner's login.
  - `/delegates` index retired into რეიტინგი behind a permanent redirect; profile pages and the region filter both survive, the filter having moved onto the ranking page.
  - Finances: the region "member" column now counts completed memberships, not every registrant — every regional number legitimately drops; money is attributed to the payer's current region.
  - Fixed 10₾ fee. The backfill is safe because `payments.tier_gel_at_payment` freezes each payment's price and `months_covered` is generated from it, so no past coverage is re-scored; only future obligation changes.
  - Referral codes: `M-` prefix makes member codes unambiguous against delegate codes by construction. A member's link credits a count only — it binds no delegacy, because a member has none to pass on.
  - Status vocabulary disambiguated in one place per surface (`MEMBER_STATUS_LABELS_KA`, `TEAM_STATUS_LABELS`).
  - The round-1 caption under `არ მყავს დელეგატი` stays removed by owner decision — it asserted backing that the new wording contradicts.
  - Support: Resend via the Vercel Marketplace; message saved before it is mailed; `/admin/support` exists so the durable copy is actually retrievable.
- [ ] **Step 2: CHANGELOG** — rename the existing `Unreleased` heading to `0.11.0 — Owner fix list (2026-07-28)` and fold round 2's entries into that section, in the same plain-language, owner-readable voice as the round-1 entries. Name the two visible consequences explicitly: regional member counts drop, and members previously on 5₾ or 20₾ now pay 10₾.
- [ ] **Step 3: Full gates** — `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, and `node scripts/ka-gate.mjs --diff main` over every touched file carrying Georgian.
- [ ] **Step 4: e2e sweep** — run Playwright from THIS worktree using the documented worktree invocation (absolute CLI path + the copied `.env.local`; a wrapper can exit 0 while dying, so confirm the test-count line actually printed). Expected: green. Known flake: the red-on-main flake noted in project memory — one retry is acceptable, a persistent failure is not.
- [ ] **Step 5: Push + PR** — push the branch, open a PR to `main` (gh CLI), body in plain language per fix with the doc-item numbers, and an explicit list of what was NOT delivered (item 13 always; Task 8 if it stayed gated). **Never merge.** CI green, then the Vercel preview URL goes to the owner for /qa and sign-off. STOP there — owner checkpoint.

---

## Self-Review (done at plan time)

- **Spec coverage:** item 2 → Task 1; item 3 → Task 2; item 5 → Task 3; item 9 → Task 4; item 12 → Task 5; item 16 → Task 6; polish → Task 7; item 11 → Task 8 (gated); item 8b → no code, ADR only (Task 10 Step 1); release bookkeeping → Task 10. Deliberately absent: item 13, text never supplied.
- **Placeholder scan:** Large SQL bodies use the repo's established "copy VERBATIM from `<file>:<lines>`, with exactly these insertions" pattern (round 1, Task 9) rather than restating hundreds of lines — the transformation is fully specified. Task 8's page markup is deliberately not written out because its content is owner-supplied copy that does not exist yet; that task is gated on receiving it.
- **Type consistency:** `MEMBERSHIP_FEE_GEL` / `Tier` agree across Tasks 4's schema, wizard, billing and transfer instructions. `ReferralCard({ code, count })` matches its three call sites and the `referralCode`/`referralCount` keys emitted by `cabinet_state()` and `delegate_panel()` in Task 5's migration. `TransparencyRegion.members` / `.collected_gel` match the Task 3 view columns exactly. `cityId` matches between the schema, the query filter, the URL params and `ExportControls`.
- **Known cross-task file overlaps (why order matters):** `app/(public)/page.tsx` (Tasks 1, 4), `app/(member)/me/page.tsx` (Tasks 4, 5), `MembershipWizard` (Tasks 4, 7), `app/(public)/styleguide/page.tsx` (Tasks 1, 2, 4, 5, 7), `DESIGN.md` (Tasks 1, 2, 4, 5), `e2e/public.spec.ts` (Tasks 2, 3), `lib/cabinet.ts` (Tasks 5, 6), `lib/funnel.ts` (Tasks 4, 5). Sequential execution on one branch resolves all of them.
- **Migration ordering:** 140000 (transparency) → 141000 (fee) → 142000 (referrals) → 143000 (admin city) → 144000 (support). Only 142000 restates `register()`/`cabinet_state()`; it copies from 20260728100000, which is already on main, so no round-1 behaviour is reverted.
