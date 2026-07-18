# Phase 5 — Community Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the movement's engagement layer — editor-published news (per-article public/member-only visibility) with shareable OG-tagged article pages, events with member RSVP and a delegate team-attendance overview, member-cabinet polls whose one-vote-per-member rule is the `poll_votes` primary key, and a public transparency page derived live from recorded payments and the member register — all under the Phase 4 access model (self-gating views, audited SECURITY DEFINER RPCs, RLS mirroring every visibility rule).

**Architecture:** Base tables get zero client grants; every read goes through views (`public_*` for anon, self-gating `member_*` for completed members, self-gating `admin_*` for editor|super_admin) and every mutation through SECURITY DEFINER RPCs — editor RPCs write their `audit_log` row in the same transaction (ADR-014), member RPCs (RSVP, vote) validate in-DB with the subject always `auth.uid()` (ADR-009). Public pages are ISR (`revalidate = 60`) + `revalidatePath` on publish; member-only content renders exclusively under `/me/*` (service-worker NetworkOnly since Phase 0). The one new service-role app path is the news-cover upload action, paired with the re-checking `admin_set_news_image` RPC — the exact Phase 4 delegate-photo envelope.

**Tech Stack:** Next.js 16 (App Router), TypeScript 6 strict, Tailwind 4, Supabase (`@supabase/ssr`, definer views + RPCs, Storage), zod, Vitest + Testing Library, Playwright. **Zero new npm dependencies.**

**Spec:** `docs/superpowers/specs/2026-07-19-phase-5-community-design.md` — binding. UX reference: `prototype/index.html` screen `me-polls` (markup ~792–806, logic ~1845–1883); news/events/transparency have no prototype screens (parent-spec extras; DESIGN.md registers apply). Approved deviations are in the spec header.

## Global Constraints

- TypeScript `strict: true`; **no `any`, no `@ts-ignore`**. `noUncheckedIndexedAccess` is on — index access yields `T | undefined`; use `!` only where a regex/loop invariant guarantees presence, with a comment (in test/e2e files, a preceding assertion or fetch-check may establish presence without a comment — existing suite style).
- Domain logic = pure functions in `lib/` — no React/Next imports there (`lib/supabase/` is the sanctioned data-access location).
- **All user-facing text Georgian.** Public pages = bold/patriotic register (serif display headlines); cabinet = calm; admin = dense/utilitarian (DESIGN.md). Reuse design-system components; extend, never restyle ad hoc. Georgian typographic quotes are `„ “` (U+201E/U+201C) — byte-exact; never "normalize" them to ASCII.
- Schema changes ONLY via `supabase/migrations/`. Local dev + previews + CI all use the STAGING Supabase project (`orcxtbedkexoclbfgvzd`).
- **Zero new npm dependencies this phase.** Body rendering, transliteration, percentages are hand-rolled pure functions.
- zod validation at every boundary: the same schemas drive client forms and server actions; the DB re-validates inside RPCs/CHECKs/RLS. Server is the source of truth.
- **Every editor mutation is a definer RPC that writes `audit_log` in the same transaction** (`insert into public.audit_log (actor_id, action, target_type, target_id, details)`). Member mutations (`member_rsvp`, `member_cast_vote`) are definer RPCs WITHOUT audit rows (audit_log is the admin trail — funnel/cabinet precedent). No admin/cabinet page ever reads via the service-role client; the service key appears in exactly one new app path — the news-cover upload server action (app-side editor precheck, paired with the re-checking audited RPC).
- Derived values stay derived: transparency numbers exist only as aggregate views; RSVP/vote counts are always `count(*)` — never stored columns.
- All timestamptz comparisons in RPCs are instant-in-time (`now()`); event/poll times are entered and displayed as Tbilisi wall time via `TBILISI_OFFSET_MS` (lib/cabinet.ts, ADR-016). Never `new Date().toLocaleString` with ICU-dependent locales.
- Next.js metadata merging is shallow per top-level key: any page that sets `openGraph` must restate `images` (cover URL or `"/og-default.png"`) — the root default does NOT survive a partial `openGraph` override.
- TDD: write the failing test first, run it, watch it fail, then implement. Frequent commits (conventional style); each task ends committed.
- **Run `npm run format` before every commit** — CI's `format:check` is strict; prettier must only reformat files you touched.
- Working directory: repo root (worktree branch `claude/phase-5-community-8f6517`).
- e2e discipline: canonical seeded admins (super `+995509000001`, verifier `…2`, finance `…3`, **editor `+995509000004`**) perform ALL audited actions; per-run users (phones via `phase4Phone(k)`, personal IDs via `phase4PersonalId(k)`) may only be targets/voters/RSVPers — never authors, never role holders (audit-actor deletability invariant, ADR-014). **Phase 4 owns k = 0–4; Phase 5 allocates k = 5 (news member), 6 (events applicant→delegate), 7 (events supporter), 8 (polls voter), 9 (polls non-voter).**
- Migration → staging apply → seed rewrite → probes green → e2e in CI (Phases 1–4 discipline). The migration applies via the same documented pooler procedure as Phases 3–4 (`docs/superpowers/plans/2026-07-15-supabase-staging-connection.md`); the owner supplies `SUPABASE_DB_PASSWORD` in `.env.local` when the apply step is reached and deletes it afterwards.
- Existing e2e suites (funnel, cabinet, delegate-panel, admin-*) must stay green throughout.

## File Structure

```
lib/
  content-render.ts / content-render.test.ts   — body parser + excerpt (Task 1)
  slug.ts / slug.test.ts (modify)              — slugFrom/makeSlugFrom generalization (Task 2)
  community.ts / community.test.ts             — events split/RSVP windows, poll view/percentages, Tbilisi datetime-local (Task 3; +Task 16 adds TeamRsvp types)
  content-schemas.ts / content-schemas.test.ts — zod for every Phase 5 boundary (Task 4)
  admin.ts / admin.test.ts (modify)            — შიგთავსი tab, audit labels, content pills (Task 5; +Task 18 adds VISIBILITY_LABELS_KA)
  funnel.ts / funnel.test.ts (modify)          — new error tokens (Task 5)
  cabinet.ts / cabinet.test.ts (modify)        — three cabinet nav items (Task 5)
  supabase/types.ts (modify)                   — 6 tables, 13 views, 16 RPCs (Task 6)
  supabase/public.ts (modify)                  — news/events/transparency fetchers (Tasks 10–12)
components/
  ContentBody.tsx / ContentBody.test.tsx       — paragraphs+links renderer (Task 1)
  NewsCard.tsx / NewsCard.test.tsx             — shared article card (Task 10)
  ContentNav.tsx / ContentNav.test.tsx         — admin content sub-nav (Task 17)
supabase/migrations/
  20260719150000_community.sql                 — everything spec §4 (Task 6)
scripts/
  seed-staging.mjs (modify)                    — news/events/rsvps/polls/votes (Task 8)
  verify-schema.mjs (modify)                   — Phase 5 probe block (Task 9)
app/(public)/
  layout.tsx (modify)                          — nav gains 3 links (Task 12)
  news/page.tsx + news/[slug]/page.tsx         — Task 10
  events/page.tsx + events/[slug]/page.tsx     — Task 11
  transparency/page.tsx                        — Task 12
app/(member)/me/
  news/page.tsx + news/[slug]/page.tsx         — Task 13
  events/page.tsx + events/EventRsvp.tsx (+test) + events/actions.ts — Task 14
  polls/page.tsx + polls/PollCard.tsx (+test) + polls/actions.ts     — Task 15
app/(delegate)/delegate/
  page.tsx (modify) + TeamRsvpCard.tsx (+test) — team RSVP overview (Task 16)
app/(admin)/admin/
  page.tsx (modify)                            — editor branch → redirect /admin/content (Task 17)
  content/layout.tsx + content/page.tsx        — editor|super gate + ContentNav (Task 17)
  content/news/page.tsx + new/page.tsx + [id]/page.tsx + NewsForm.tsx (+test) + ArticleActions.tsx + CoverUpload.tsx + actions.ts — Task 18
  content/events/page.tsx + new/page.tsx + [id]/page.tsx + EventForm.tsx (+test) + EventActions.tsx + actions.ts — Task 19
  content/polls/page.tsx + new/page.tsx + [id]/page.tsx + PollForm.tsx (+test) + PollActions.tsx + actions.ts — Task 20
e2e/
  community-helpers.ts                          — shared per-run member creation + content cleanup (Task 21)
  community-news.spec.ts                        — critical flow 1 (Task 21)
  community-events.spec.ts                      — critical flow 2 (Task 22)
  community-polls.spec.ts                       — critical flow 3 + transparency (Task 23)
ARCHITECTURE.md / DESIGN.md / DECISIONS.md / CHANGELOG.md / package.json /
app/(public)/styleguide/page.tsx               — Task 24
```

Route-group note: `(admin)` carries the URL prefix inside it (`app/(admin)/admin/content/…` → `/admin/content/…`); `(member)/me/news` → `/me/news` — exactly like Phase 3/4.

## Execution sequencing (dependency notes)

- Tasks 1–5 are pure `lib/`/`components/` — parallel-safe, no staging needed.
- Task 6 (migration file + types) must precede Task 7 (apply), which must precede Tasks 8 (seed), 9 (probes) and any LIVE verification of Tasks 10–20's pages; the UI tasks' unit/component tests and builds pass without staging.
- Tasks 10–20 consume lib/ + types only — they can be built after Task 6 in any order, but verify against staging only after Task 7.
- Tasks 21–23 (e2e) require Tasks 7–9 completed on staging AND Tasks 10–20 deployed to the preview/CI environment.
- Task 24 (docs/version/final gates) is last.

---

### Task 1: Body renderer — `lib/content-render.ts` + `components/ContentBody.tsx`

**Files:**
- Create: `lib/content-render.ts`
- Create: `lib/content-render.test.ts`
- Create: `components/ContentBody.tsx`
- Create: `components/ContentBody.test.tsx`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (consumed by Tasks 10, 11, 13, 18 and the styleguide):
  - `type BodySpan = { type: "text"; text: string } | { type: "link"; href: string }`
  - `type BodyParagraph = BodySpan[]`
  - `parseBody(body: string): BodyParagraph[]` — blank-line paragraph split, `https?://` auto-links, trailing punctuation trimmed off links
  - `excerpt(body: string, max?: number): string` — first paragraph's plain text, word-boundary trim, `…` suffix; default max 160
  - `<ContentBody body={string} className?={string} />` — server-component renderer; links get `target="_blank" rel="noopener noreferrer nofollow"`

- [ ] **Step 1: Write the failing tests — `lib/content-render.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { excerpt, parseBody } from "./content-render";

describe("parseBody (spec §5, decision #12)", () => {
  it("splits paragraphs on blank lines, collapsing inner newlines to spaces", () => {
    expect(parseBody("პირველი აბზაცი.\n\nმეორე\nაბზაცი.")).toEqual([
      [{ type: "text", text: "პირველი აბზაცი." }],
      [{ type: "text", text: "მეორე აბზაცი." }],
    ]);
  });

  it("tolerates \\r\\n and 3+ blank lines, drops empty blocks", () => {
    expect(parseBody("ა\r\n\r\n\r\n\r\nბ\n\n   \n\nგ")).toEqual([
      [{ type: "text", text: "ა" }],
      [{ type: "text", text: "ბ" }],
      [{ type: "text", text: "გ" }],
    ]);
  });

  it("returns [] for whitespace-only bodies", () => {
    expect(parseBody("  \n\n \n ")).toEqual([]);
  });

  it("tokenizes http/https URLs as link spans", () => {
    expect(parseBody("იხილე https://example.ge/გვერდი და დაგვიკავშირდი.")).toEqual([
      [
        { type: "text", text: "იხილე " },
        { type: "link", href: "https://example.ge/გვერდი" },
        { type: "text", text: " და დაგვიკავშირდი." },
      ],
    ]);
  });

  it("trims trailing punctuation (incl. Georgian quotes) off links, keeping it as text", () => {
    expect(parseBody("წაიკითხე: https://a.ge/x, შემდეგ https://b.ge/y.")).toEqual([
      [
        { type: "text", text: "წაიკითხე: " },
        { type: "link", href: "https://a.ge/x" },
        { type: "text", text: ", შემდეგ " },
        { type: "link", href: "https://b.ge/y" },
        { type: "text", text: "." },
      ],
    ]);
    expect(parseBody("(დეტალები: https://c.ge/z)")).toEqual([
      [
        { type: "text", text: "(დეტალები: " },
        { type: "link", href: "https://c.ge/z" },
        { type: "text", text: ")" },
      ],
    ]);
    expect(parseBody("„https://d.ge/w“")).toEqual([
      [
        { type: "text", text: "„" },
        { type: "link", href: "https://d.ge/w" },
        { type: "text", text: "“" },
      ],
    ]);
  });

  it("handles a paragraph that is exactly one URL", () => {
    expect(parseBody("https://example.ge")).toEqual([[{ type: "link", href: "https://example.ge" }]]);
  });

  it("does not link bare domains or other schemes", () => {
    expect(parseBody("example.ge და ftp://x.y")).toEqual([
      [{ type: "text", text: "example.ge და ftp://x.y" }],
    ]);
  });
});

describe("excerpt (spec §3.1: list cards + OG description)", () => {
  it("returns a short first paragraph unchanged", () => {
    expect(excerpt("მოკლე ტექსტი.\n\nმეორე აბზაცი.")).toBe("მოკლე ტექსტი.");
  });

  it("cuts at a word boundary and appends … when over max", () => {
    const body = "სიტყვა ".repeat(40).trim(); // 279 chars
    const cut = excerpt(body, 160);
    expect(cut.length).toBeLessThanOrEqual(161); // 160 + ellipsis
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/სიტყვ…$/); // no mid-word cut
  });

  it("renders link spans as their URL text", () => {
    expect(excerpt("ნახე https://a.ge აქ.")).toBe("ნახე https://a.ge აქ.");
  });

  it("returns empty string for empty body", () => {
    expect(excerpt("")).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/content-render.test.ts`
Expected: FAIL — `Cannot find module './content-render'`

- [ ] **Step 3: Implement `lib/content-render.ts`**

```ts
/**
 * News/event body format (spec decision #12): plain text; a blank line starts a
 * new paragraph; http(s) URLs become links. No HTML is ever stored or parsed —
 * the renderer builds React elements, so the XSS surface is zero by construction.
 */
export type BodySpan = { type: "text"; text: string } | { type: "link"; href: string };
export type BodyParagraph = BodySpan[];

const URL_RE = /https?:\/\/\S+/g;
// Punctuation that ends a sentence around a URL, not the URL itself. Includes
// Georgian typographic quotes „ “ ” and closing brackets.
const TRAILING_PUNCT_RE = /[.,;:!?)\]}»'"„“”]+$/;

function paragraphSpans(text: string): BodyParagraph {
  const spans: BodySpan[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const href = match[0].replace(TRAILING_PUNCT_RE, "");
    if (start > last) spans.push({ type: "text", text: text.slice(last, start) });
    spans.push({ type: "link", href });
    last = start + href.length;
  }
  if (last < text.length) spans.push({ type: "text", text: text.slice(last) });
  return spans;
}

export function parseBody(body: string): BodyParagraph[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\n/g, " ").trim())
    .filter((block) => block.length > 0)
    .map(paragraphSpans);
}

/** First paragraph as plain text, word-boundary-trimmed to `max`, for cards + OG. */
export function excerpt(body: string, max = 160): string {
  const first = parseBody(body)[0] ?? [];
  const text = first
    .map((span) => (span.type === "text" ? span.text : span.href))
    .join("")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // fall back to the hard cut when the first "word" alone exceeds half the budget
  const head = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${head.trimEnd()}…`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/content-render.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Write the failing component test — `components/ContentBody.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentBody } from "./ContentBody";

describe("ContentBody", () => {
  it("renders one <p> per paragraph", () => {
    const { container } = render(<ContentBody body={"პირველი.\n\nმეორე."} />);
    const ps = container.querySelectorAll("p");
    expect(ps).toHaveLength(2);
    expect(ps[0]).toHaveTextContent("პირველი.");
    expect(ps[1]).toHaveTextContent("მეორე.");
  });

  it("renders links with safe rel/target and the URL as text", () => {
    render(<ContentBody body="ნახე https://example.ge/x დღეს." />);
    const link = screen.getByRole("link", { name: "https://example.ge/x" });
    expect(link).toHaveAttribute("href", "https://example.ge/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("appends custom className to the wrapper", () => {
    const { container } = render(<ContentBody body="ა" className="text-lg" />);
    expect(container.firstElementChild).toHaveClass("text-lg");
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run components/ContentBody.test.tsx`
Expected: FAIL — `Cannot find module './ContentBody'`

- [ ] **Step 7: Implement `components/ContentBody.tsx`**

```tsx
import { parseBody } from "@/lib/content-render";

/**
 * The one renderer for news/event bodies (public pages, cabinet, admin preview).
 * Server-component-safe (no hooks); builds elements, never injects HTML.
 */
export function ContentBody({ body, className = "" }: { body: string; className?: string }) {
  return (
    <div className={`space-y-4 leading-relaxed text-ink ${className}`.trim()}>
      {parseBody(body).map((paragraph, pi) => (
        <p key={pi}>
          {paragraph.map((span, si) =>
            span.type === "link" ? (
              <a
                key={si}
                href={span.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-brand underline underline-offset-2"
              >
                {span.href}
              </a>
            ) : (
              <span key={si}>{span.text}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Run the component test to verify it passes, then the full unit suite**

Run: `npx vitest run components/ContentBody.test.tsx && npx vitest run`
Expected: PASS; no other suite broken

- [ ] **Step 9: Commit**

```bash
npm run format
git add lib/content-render.ts lib/content-render.test.ts components/ContentBody.tsx components/ContentBody.test.tsx
git commit -m "feat: plain-text body renderer with auto-links (lib/content-render + ContentBody)"
```

---

### Task 2: Slug generalization — `lib/slug.ts`

**Files:**
- Modify: `lib/slug.ts`
- Modify: `lib/slug.test.ts`

**Interfaces:**
- Consumes: existing `transliterateGeorgian(text): string`, `slugBase(fullName): string`, `makeSlug(fullName, taken): string` (Phase 1 — delegate approval depends on them; **signatures and behavior must not change**).
- Produces (consumed by Tasks 18–19 publish actions):
  - `slugFrom(text: string, fallback: string): string` — transliterate → lowercase → non-`[a-z0-9]` runs → single `-` → trim; returns `fallback` when empty
  - `makeSlugFrom(text: string, fallback: string, taken: ReadonlySet<string>): string` — `slugFrom` + `-2`/`-3`… suffix on collision

- [ ] **Step 1: Add failing tests to `lib/slug.test.ts`** (append; do not touch existing cases)

```ts
import { makeSlugFrom, slugFrom } from "./slug";

describe("slugFrom / makeSlugFrom (Phase 5: news + events)", () => {
  it("romanizes Georgian titles", () => {
    expect(slugFrom("ახალი წელი თბილისში", "article")).toBe("akhali-tseli-tbilisshi");
  });

  it("collapses punctuation/whitespace runs and trims hyphens", () => {
    expect(slugFrom('„დიდი შეხვედრა“ — 2026!', "event")).toBe("didi-shekhvedra-2026");
  });

  it("falls back when nothing romanizes", () => {
    expect(slugFrom("Прага 2026", "article")).toBe("2026"); // digits survive
    expect(slugFrom("Прага", "article")).toBe("article");
    expect(slugFrom("", "event")).toBe("event");
  });

  it("suffixes -2, -3 on collision", () => {
    const taken = new Set(["akhali-tseli", "akhali-tseli-2"]);
    expect(makeSlugFrom("ახალი წელი", "article", taken)).toBe("akhali-tseli-3");
    expect(makeSlugFrom("ახალი წელი", "article", new Set())).toBe("akhali-tseli");
  });

  it("keeps the delegate wrappers byte-identical", () => {
    expect(slugFrom("გიორგი მაისურაძე", "delegati")).toBe("giorgi-maisuradze");
  });
});
```

(The second test's title deliberately mixes Georgian typographic quotes `„ “` and an em-dash — all must collapse into hyphens/nothing.)

- [ ] **Step 2: Run to verify the new cases fail**

Run: `npx vitest run lib/slug.test.ts`
Expected: FAIL — `slugFrom is not a function` (existing cases still pass)

- [ ] **Step 3: Generalize `lib/slug.ts`** — replace the `slugBase`/`makeSlug` bodies with thin wrappers; keep `transliterateGeorgian` and the MAP untouched:

```ts
/**
 * Generalized slug minting (Phase 5): news uses fallback "article", events
 * "event", delegates keep "delegati". Empty romanization (Cyrillic, emoji…)
 * falls back so every item stays publishable — the RPCs reject empty slugs.
 */
export function slugFrom(text: string, fallback: string): string {
  const base = transliterateGeorgian(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base === "" ? fallback : base;
}

export function makeSlugFrom(text: string, fallback: string, taken: ReadonlySet<string>): string {
  const base = slugFrom(text, fallback);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function slugBase(fullName: string): string {
  return slugFrom(fullName, "delegati");
}

export function makeSlug(fullName: string, taken: ReadonlySet<string>): string {
  return makeSlugFrom(fullName, "delegati", taken);
}
```

(Keep the existing doc comments on `slugBase`; delete the now-duplicated body logic.)

- [ ] **Step 4: Run the slug suite AND the full unit suite**

Run: `npx vitest run lib/slug.test.ts && npx vitest run`
Expected: PASS — including every pre-existing slug/delegate test, unchanged

- [ ] **Step 5: Commit**

```bash
npm run format
git add lib/slug.ts lib/slug.test.ts
git commit -m "refactor: generalize slug minting for news/events (slugFrom/makeSlugFrom)"
```

---

### Task 3: Community domain logic — `lib/community.ts`

**Files:**
- Create: `lib/community.ts`
- Create: `lib/community.test.ts`

**Interfaces:**
- Consumes: `TBILISI_OFFSET_MS`, `formatDateKa` from `lib/cabinet.ts`.
- Produces (consumed by Tasks 11, 14, 15, 16, 19, 20):
  - `interface EventTimeFields { starts_at: string; ends_at: string | null }`
  - `eventEndIso(e: EventTimeFields): string` — `ends_at ?? starts_at`
  - `splitEvents<T extends EventTimeFields>(events: readonly T[], nowIso: string): { upcoming: T[]; past: T[] }` — upcoming = end instant ≥ now, sorted soonest-first; past sorted most-recent-first
  - `rsvpOpen(e: { starts_at: string; status: string }, nowIso: string): boolean` — `status === "published"` AND now strictly before start
  - `type PollViewState = "buttons" | "results-own" | "results-closed"`
  - `pollView(status: "open" | "closed", hasVoted: boolean): PollViewState` — decision #4 as one pure function
  - `percentages(votes: readonly number[]): number[]` — integers summing to 100 (largest remainder; all-zeros when no votes)
  - `tbilisiLocalToIso(local: string): string | null` — `"YYYY-MM-DDTHH:mm"` Tbilisi wall time → ISO UTC; null on malformed input
  - `isoToTbilisiLocal(iso: string): string` — inverse, for `<input type="datetime-local">` prefill; `""` on malformed
  - `formatEventTimeKa(startsAt: string, endsAt: string | null): string` — `"25.07.2026, 19:00"`, same-day range `"…, 19:00–21:00"`, cross-day `"…, 19:00 — 26.07.2026, 11:00"`

- [ ] **Step 1: Write the failing tests — `lib/community.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  eventEndIso,
  formatEventTimeKa,
  isoToTbilisiLocal,
  percentages,
  pollView,
  rsvpOpen,
  splitEvents,
  tbilisiLocalToIso,
} from "./community";

const NOW = "2026-07-19T12:00:00.000Z";

function ev(starts_at: string, ends_at: string | null = null) {
  return { starts_at, ends_at };
}

describe("splitEvents (spec §3.2: past = coalesce(ends_at, starts_at) has passed)", () => {
  it("splits and orders: upcoming soonest-first, past most-recent-first", () => {
    const a = ev("2026-07-20T15:00:00.000Z"); // upcoming, sooner
    const b = ev("2026-08-01T15:00:00.000Z"); // upcoming, later
    const c = ev("2026-07-01T15:00:00.000Z"); // past, older
    const d = ev("2026-07-10T15:00:00.000Z"); // past, newer
    const { upcoming, past } = splitEvents([b, c, a, d], NOW);
    expect(upcoming).toEqual([a, b]);
    expect(past).toEqual([d, c]);
  });

  it("an event whose end instant is exactly now is still upcoming", () => {
    const edge = ev("2026-07-19T10:00:00.000Z", NOW);
    expect(splitEvents([edge], NOW).upcoming).toEqual([edge]);
  });

  it("a started event with a future end stays upcoming (ongoing)", () => {
    const ongoing = ev("2026-07-19T10:00:00.000Z", "2026-07-19T14:00:00.000Z");
    expect(splitEvents([ongoing], NOW).upcoming).toEqual([ongoing]);
  });

  it("eventEndIso falls back to starts_at", () => {
    expect(eventEndIso(ev("2026-07-01T00:00:00.000Z"))).toBe("2026-07-01T00:00:00.000Z");
    expect(eventEndIso(ev("a", "b"))).toBe("b");
  });
});

describe("rsvpOpen (decision #6/#7: toggle until start; cancelled locks)", () => {
  it("open for a published future event", () => {
    expect(rsvpOpen({ starts_at: "2026-07-20T15:00:00.000Z", status: "published" }, NOW)).toBe(true);
  });
  it("closed at the exact start instant and after", () => {
    expect(rsvpOpen({ starts_at: NOW, status: "published" }, NOW)).toBe(false);
    expect(rsvpOpen({ starts_at: "2026-07-19T00:00:00.000Z", status: "published" }, NOW)).toBe(false);
  });
  it("closed for cancelled events regardless of time", () => {
    expect(rsvpOpen({ starts_at: "2026-07-20T15:00:00.000Z", status: "cancelled" }, NOW)).toBe(false);
  });
});

describe("pollView (decision #4)", () => {
  it("open + not voted → buttons", () => expect(pollView("open", false)).toBe("buttons"));
  it("open + voted → results-own", () => expect(pollView("open", true)).toBe("results-own"));
  it("closed → results for everyone", () => {
    expect(pollView("closed", false)).toBe("results-closed");
    expect(pollView("closed", true)).toBe("results-closed");
  });
});

describe("percentages (largest remainder, sums to 100)", () => {
  it("thirds round deterministically", () => {
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
  });
  it("typical splits", () => {
    expect(percentages([2, 1])).toEqual([67, 33]);
    expect(percentages([71, 14, 15])).toEqual([71, 14, 15]);
  });
  it("zero votes → all zeros (no NaN)", () => {
    expect(percentages([0, 0, 0])).toEqual([0, 0, 0]);
  });
  it("empty array → empty", () => {
    expect(percentages([])).toEqual([]);
  });
});

describe("Tbilisi datetime-local bridge (ADR-016: UTC+4, no DST)", () => {
  it("wall time → ISO UTC (−4h)", () => {
    expect(tbilisiLocalToIso("2026-07-25T19:00")).toBe("2026-07-25T15:00:00.000Z");
  });
  it("round-trips through isoToTbilisiLocal", () => {
    expect(isoToTbilisiLocal("2026-07-25T15:00:00.000Z")).toBe("2026-07-25T19:00");
  });
  it("crosses date lines correctly (00:30 Tbilisi = 20:30 UTC prior day)", () => {
    expect(tbilisiLocalToIso("2026-07-25T00:30")).toBe("2026-07-24T20:30:00.000Z");
    expect(isoToTbilisiLocal("2026-07-24T20:30:00.000Z")).toBe("2026-07-25T00:30");
  });
  it("rejects malformed input", () => {
    expect(tbilisiLocalToIso("2026-07-25")).toBeNull();
    expect(tbilisiLocalToIso("garbage")).toBeNull();
    expect(isoToTbilisiLocal("garbage")).toBe("");
  });
});

describe("formatEventTimeKa", () => {
  it("start only", () => {
    expect(formatEventTimeKa("2026-07-25T15:00:00.000Z", null)).toBe("25.07.2026, 19:00");
  });
  it("same-day range uses an en-dash", () => {
    expect(formatEventTimeKa("2026-07-25T15:00:00.000Z", "2026-07-25T17:00:00.000Z")).toBe(
      "25.07.2026, 19:00–21:00",
    );
  });
  it("cross-day range repeats the date", () => {
    expect(formatEventTimeKa("2026-07-25T15:00:00.000Z", "2026-07-26T07:00:00.000Z")).toBe(
      "25.07.2026, 19:00 — 26.07.2026, 11:00",
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/community.test.ts`
Expected: FAIL — `Cannot find module './community'`

- [ ] **Step 3: Implement `lib/community.ts`**

```ts
/**
 * Pure domain logic for Phase 5 (spec §5): event windows, poll view states,
 * result percentages, and the Tbilisi wall-time bridge for datetime-local
 * inputs. All instants compare as epoch ms; wall-time math shifts by the fixed
 * TBILISI_OFFSET_MS (Georgia is UTC+4 year-round — ADR-016).
 */
import { formatDateKa, TBILISI_OFFSET_MS } from "./cabinet";

export interface EventTimeFields {
  starts_at: string;
  ends_at: string | null;
}

export function eventEndIso(e: EventTimeFields): string {
  return e.ends_at ?? e.starts_at;
}

export function splitEvents<T extends EventTimeFields>(
  events: readonly T[],
  nowIso: string,
): { upcoming: T[]; past: T[] } {
  const now = new Date(nowIso).getTime();
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const e of events) {
    (new Date(eventEndIso(e)).getTime() >= now ? upcoming : past).push(e);
  }
  upcoming.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  past.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  return { upcoming, past };
}

export function rsvpOpen(e: { starts_at: string; status: string }, nowIso: string): boolean {
  return e.status === "published" && new Date(nowIso).getTime() < new Date(e.starts_at).getTime();
}

export type PollViewState = "buttons" | "results-own" | "results-closed";

/** Decision #4: voters see results while open; after close, everyone does. */
export function pollView(status: "open" | "closed", hasVoted: boolean): PollViewState {
  if (status === "closed") return "results-closed";
  return hasVoted ? "results-own" : "buttons";
}

/** Integer percentages summing to exactly 100 (largest remainder; ties → lower index). */
export function percentages(votes: readonly number[]): number[] {
  const total = votes.reduce((s, v) => s + v, 0);
  if (total === 0) return votes.map(() => 0);
  const exact = votes.map((v) => (v * 100) / total);
  const out = exact.map(Math.floor);
  let remainder = 100 - out.reduce((s, v) => s + v, 0);
  const byFraction = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (remainder <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    remainder--;
  }
  return out;
}

const LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** `<input type="datetime-local">` value (Tbilisi wall time) → ISO UTC instant. */
export function tbilisiLocalToIso(local: string): string | null {
  if (!LOCAL_RE.test(local)) return null;
  const wallAsUtc = Date.parse(`${local}:00.000Z`);
  if (Number.isNaN(wallAsUtc)) return null;
  return new Date(wallAsUtc - TBILISI_OFFSET_MS).toISOString();
}

function toTbilisiParts(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + TBILISI_OFFSET_MS);
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** ISO instant → `"YYYY-MM-DDTHH:mm"` in Tbilisi wall time (datetime-local prefill). */
export function isoToTbilisiLocal(iso: string): string {
  const t = toTbilisiParts(iso);
  if (!t) return "";
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}T${pad2(
    t.getUTCHours(),
  )}:${pad2(t.getUTCMinutes())}`;
}

function timeKa(iso: string): string {
  const t = toTbilisiParts(iso);
  if (!t) return "";
  return `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`;
}

export function formatEventTimeKa(startsAt: string, endsAt: string | null): string {
  const startDate = formatDateKa(startsAt);
  const startTime = timeKa(startsAt);
  if (!endsAt) return `${startDate}, ${startTime}`;
  const endDate = formatDateKa(endsAt);
  const endTime = timeKa(endsAt);
  if (endDate === startDate) return `${startDate}, ${startTime}–${endTime}`;
  return `${startDate}, ${startTime} — ${endDate}, ${endTime}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/community.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
npm run format
git add lib/community.ts lib/community.test.ts
git commit -m "feat: community domain logic (event windows, poll views, percentages, Tbilisi bridge)"
```

---

### Task 4: Content zod boundary — `lib/content-schemas.ts`

**Files:**
- Create: `lib/content-schemas.ts`
- Create: `lib/content-schemas.test.ts`

**Interfaces:**
- Consumes: nothing (zod only; the local-datetime regex matches Task 3's).
- Produces (consumed by Tasks 14, 15, 18, 19, 20 server actions and forms):
  - `newsFormSchema` — `{ id?: uuid; title: 1–160 trimmed; body: 1–20000 trimmed; visibility: "public" | "members" }`
  - `eventFormSchema` — `{ id?: uuid; title; description: 1–20000; location: 1–200; startsAt: "YYYY-MM-DDTHH:mm"; endsAt?: same | "" }` + refinement `endsAt > startsAt` (lexicographic compare is chronological for this format)
  - `pollFormSchema` — `{ id?: uuid; question: 1–300; options: string[2..10] each 1–120, unique after trim; endsAt?: local | "" }`
  - `rsvpInputSchema` — `{ eventId: uuid; going: boolean }`
  - `voteInputSchema` — `{ pollId: uuid; optionId: uuid }`
  - `contentIdSchema` — `{ id: uuid }`
  - `POLL_MIN_OPTIONS = 2`, `POLL_MAX_OPTIONS = 10`
  - Inferred types: `NewsFormInput`, `EventFormInput`, `PollFormInput`

- [ ] **Step 1: Write the failing tests — `lib/content-schemas.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  contentIdSchema,
  eventFormSchema,
  newsFormSchema,
  pollFormSchema,
  rsvpInputSchema,
  voteInputSchema,
} from "./content-schemas";

const UUID = "6f1b0a9e-0000-4000-8000-000000000001";

describe("newsFormSchema", () => {
  it("accepts a valid article (id optional)", () => {
    const r = newsFormSchema.safeParse({ title: "სათაური", body: "ტექსტი", visibility: "members" });
    expect(r.success).toBe(true);
  });
  it("trims and rejects empty/overlong title and body", () => {
    expect(newsFormSchema.safeParse({ title: "  ", body: "ბ", visibility: "public" }).success).toBe(false);
    expect(
      newsFormSchema.safeParse({ title: "ა".repeat(161), body: "ბ", visibility: "public" }).success,
    ).toBe(false);
    expect(
      newsFormSchema.safeParse({ title: "ა", body: "ბ".repeat(20001), visibility: "public" }).success,
    ).toBe(false);
  });
  it("rejects unknown visibility and bad id", () => {
    expect(newsFormSchema.safeParse({ title: "ა", body: "ბ", visibility: "secret" }).success).toBe(false);
    expect(
      newsFormSchema.safeParse({ id: "nope", title: "ა", body: "ბ", visibility: "public" }).success,
    ).toBe(false);
  });
});

describe("eventFormSchema", () => {
  const base = {
    title: "შეხვედრა",
    description: "აღწერა",
    location: "თბილისი, თავისუფლების მოედანი",
    startsAt: "2026-08-01T19:00",
  };
  it("accepts without endsAt and with empty endsAt", () => {
    expect(eventFormSchema.safeParse(base).success).toBe(true);
    expect(eventFormSchema.safeParse({ ...base, endsAt: "" }).success).toBe(true);
  });
  it("accepts a later endsAt, rejects equal/earlier", () => {
    expect(eventFormSchema.safeParse({ ...base, endsAt: "2026-08-01T21:00" }).success).toBe(true);
    expect(eventFormSchema.safeParse({ ...base, endsAt: "2026-08-01T19:00" }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...base, endsAt: "2026-08-01T18:00" }).success).toBe(false);
  });
  it("rejects malformed datetimes and overlong location", () => {
    expect(eventFormSchema.safeParse({ ...base, startsAt: "2026-08-01" }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...base, location: "ა".repeat(201) }).success).toBe(false);
  });
});

describe("pollFormSchema", () => {
  const base = { question: "პრიორიტეტი 2026?", options: ["დიახ", "არა"] };
  it("accepts 2–10 unique options; optional endsAt", () => {
    expect(pollFormSchema.safeParse(base).success).toBe(true);
    expect(pollFormSchema.safeParse({ ...base, endsAt: "2026-08-01T12:00" }).success).toBe(true);
    expect(pollFormSchema.safeParse({ ...base, endsAt: "" }).success).toBe(true);
  });
  it("rejects <2, >10, empty, overlong and duplicate options", () => {
    expect(pollFormSchema.safeParse({ ...base, options: ["ერთი"] }).success).toBe(false);
    expect(
      pollFormSchema.safeParse({ ...base, options: Array.from({ length: 11 }, (_, i) => `v${i}`) })
        .success,
    ).toBe(false);
    expect(pollFormSchema.safeParse({ ...base, options: ["ა", " "] }).success).toBe(false);
    expect(pollFormSchema.safeParse({ ...base, options: ["ა", "ბ".repeat(121)] }).success).toBe(false);
    expect(pollFormSchema.safeParse({ ...base, options: ["იგივე", "იგივე "] }).success).toBe(false);
  });
  it("rejects an overlong question", () => {
    expect(pollFormSchema.safeParse({ ...base, question: "კ".repeat(301) }).success).toBe(false);
  });
});

describe("member input schemas", () => {
  it("rsvpInputSchema", () => {
    expect(rsvpInputSchema.safeParse({ eventId: UUID, going: true }).success).toBe(true);
    expect(rsvpInputSchema.safeParse({ eventId: "x", going: true }).success).toBe(false);
    expect(rsvpInputSchema.safeParse({ eventId: UUID, going: "yes" }).success).toBe(false);
  });
  it("voteInputSchema", () => {
    expect(voteInputSchema.safeParse({ pollId: UUID, optionId: UUID }).success).toBe(true);
    expect(voteInputSchema.safeParse({ pollId: UUID }).success).toBe(false);
  });
  it("contentIdSchema", () => {
    expect(contentIdSchema.safeParse({ id: UUID }).success).toBe(true);
    expect(contentIdSchema.safeParse({ id: 5 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/content-schemas.test.ts`
Expected: FAIL — `Cannot find module './content-schemas'`

- [ ] **Step 3: Implement `lib/content-schemas.ts`**

Before writing, open `lib/admin-schemas.ts` and reuse its exact zod message idiom (Georgian `message` strings on each rule) — the file below follows it:

```ts
/**
 * zod for every Phase 5 boundary (spec §5). The same schemas drive client
 * forms and server actions; the DB re-validates inside RPCs/CHECKs. Local
 * datetimes are Tbilisi wall time "YYYY-MM-DDTHH:mm" — lexicographic order IS
 * chronological order for this fixed-width format, so refinements compare
 * strings directly; conversion to instants happens in the actions
 * (tbilisiLocalToIso, lib/community.ts).
 */
import { z } from "zod";

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;

const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const titleField = z
  .string()
  .trim()
  .min(1, { message: "სათაური სავალდებულოა." })
  .max(160, { message: "სათაური არ უნდა აღემატებოდეს 160 სიმბოლოს." });

const longTextField = z
  .string()
  .trim()
  .min(1, { message: "ტექსტი სავალდებულოა." })
  .max(20000, { message: "ტექსტი ძალიან გრძელია (მაქს. 20 000 სიმბოლო)." });

const localDatetimeField = z
  .string()
  .regex(LOCAL_DATETIME_RE, { message: "მიუთითე თარიღი და დრო." });

export const newsFormSchema = z.object({
  id: z.string().uuid().optional(),
  title: titleField,
  body: longTextField,
  visibility: z.enum(["public", "members"]),
});
export type NewsFormInput = z.infer<typeof newsFormSchema>;

export const eventFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: titleField,
    description: longTextField,
    location: z
      .string()
      .trim()
      .min(1, { message: "მიუთითე ადგილმდებარეობა." })
      .max(200, { message: "ადგილმდებარეობა ძალიან გრძელია (მაქს. 200)." }),
    startsAt: localDatetimeField,
    endsAt: z.union([localDatetimeField, z.literal("")]).optional(),
  })
  .refine((v) => !v.endsAt || v.endsAt === "" || v.endsAt > v.startsAt, {
    message: "დასრულების დრო დაწყების შემდეგ უნდა იყოს.",
    path: ["endsAt"],
  });
export type EventFormInput = z.infer<typeof eventFormSchema>;

export const pollFormSchema = z.object({
  id: z.string().uuid().optional(),
  question: z
    .string()
    .trim()
    .min(1, { message: "კითხვა სავალდებულოა." })
    .max(300, { message: "კითხვა ძალიან გრძელია (მაქს. 300)." }),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, { message: "პასუხი ცარიელია." })
        .max(120, { message: "პასუხი ძალიან გრძელია (მაქს. 120)." }),
    )
    .min(POLL_MIN_OPTIONS, { message: "მინიმუმ 2 პასუხია საჭირო." })
    .max(POLL_MAX_OPTIONS, { message: "მაქსიმუმ 10 პასუხი დაიშვება." })
    .refine((opts) => new Set(opts).size === opts.length, {
      message: "პასუხები უნიკალური უნდა იყოს.",
    }),
  endsAt: z.union([localDatetimeField, z.literal("")]).optional(),
});
export type PollFormInput = z.infer<typeof pollFormSchema>;

export const rsvpInputSchema = z.object({
  eventId: z.string().uuid(),
  going: z.boolean(),
});

export const voteInputSchema = z.object({
  pollId: z.string().uuid(),
  optionId: z.string().uuid(),
});

export const contentIdSchema = z.object({ id: z.string().uuid() });
```

(If the installed zod major requires a different custom-message parameter shape than `{ message }`, mirror whatever `lib/admin-schemas.ts` actually uses — that file compiles against the installed version by definition. The trim-before-validate order matters: `"იგივე "` must collide with `"იგივე"`.)

- [ ] **Step 4: Run to verify it passes, plus typecheck**

Run: `npx vitest run lib/content-schemas.test.ts && npm run typecheck`
Expected: PASS; no type errors

- [ ] **Step 5: Commit**

```bash
npm run format
git add lib/content-schemas.ts lib/content-schemas.test.ts
git commit -m "feat: zod boundary for news/events/polls/rsvp/vote (lib/content-schemas)"
```

---

### Task 5: Vocabulary riders — `lib/admin.ts`, `lib/funnel.ts`, `lib/cabinet.ts`

**Files:**
- Modify: `lib/admin.ts` (TAB_MATRIX, audit labels, content pill helper)
- Modify: `lib/admin.test.ts`
- Modify: `lib/funnel.ts` (ERROR_MESSAGES tokens)
- Modify: `lib/funnel.test.ts`
- Modify: `lib/cabinet.ts` (cabinetNavItems)
- Modify: `lib/cabinet.test.ts`

**Interfaces:**
- Consumes: existing `TAB_MATRIX` shape, `AUDIT_ACTION_LABELS_KA`, `ERROR_MESSAGES`/`mapFunnelError`, `cabinetNavItems(role, isAdmin)`.
- Produces (consumed by Tasks 11, 13–20):
  - AdminNav tab `{ href: "/admin/content", label: "შიგთავსი", roles: ["super_admin", "editor"] }`
  - `type ContentStatus = "draft" | "published" | "cancelled" | "open" | "closed"`
  - `contentPill(status: ContentStatus): { status: "draft" | "approved" | "rejected"; label: string }` — draft→(draft, „მონახაზი“), published→(approved, „გამოქვეყნებული“), cancelled→(rejected, „გაუქმებული“), open→(approved, „ღია“), closed→(draft, „დახურული“) — rendered via `<Pill status={…} label={…} />`
  - 15 new audit labels (list below)
  - Error tokens: `already_voted`, `poll_closed`, `rsvp_closed`, `invalid_options`, `invalid_option`, `invalid_status`, `invalid_title`, `invalid_body`, `invalid_location`, `invalid_event_dates`, `invalid_question`, `invalid_image` (RPCs in Task 6 raise exactly these)
  - Cabinet nav: member = პროფილი, ჩემი დელეგატი, გადახდები, **სიახლეები `/me/news`, ღონისძიებები `/me/events`, გამოკითხვები `/me/polls`**; delegate = პროფილი, გადახდები, the same three, დელეგატის პანელი (kept last before the admin link)

- [ ] **Step 1: Write the failing tests**

Append to `lib/admin.test.ts`:

```ts
import { adminTabs, AUDIT_ACTION_LABELS_KA, contentPill } from "./admin";

describe("Phase 5: შიგთავსი tab", () => {
  it("editor sees exactly the content tab", () => {
    expect(adminTabs(["editor"])).toEqual([{ href: "/admin/content", label: "შიგთავსი" }]);
  });
  it("super_admin gains the content tab; staff-only roles do not", () => {
    expect(adminTabs(["super_admin"]).map((t) => t.href)).toContain("/admin/content");
    expect(adminTabs(["verifier"]).map((t) => t.href)).not.toContain("/admin/content");
    expect(adminTabs(["finance"]).map((t) => t.href)).not.toContain("/admin/content");
  });
});

describe("Phase 5: audit labels + content pills", () => {
  it("labels every content action", () => {
    for (const action of [
      "news.save",
      "news.update",
      "news.publish",
      "news.unpublish",
      "news.delete",
      "news.set_image",
      "event.save",
      "event.update",
      "event.publish",
      "event.cancel",
      "event.delete",
      "poll.save",
      "poll.open",
      "poll.close",
      "poll.delete",
    ]) {
      expect(AUDIT_ACTION_LABELS_KA[action], action).toBeTruthy();
    }
  });
  it("contentPill maps every status to a Pill config", () => {
    expect(contentPill("draft")).toEqual({ status: "draft", label: "მონახაზი" });
    expect(contentPill("published")).toEqual({ status: "approved", label: "გამოქვეყნებული" });
    expect(contentPill("cancelled")).toEqual({ status: "rejected", label: "გაუქმებული" });
    expect(contentPill("open")).toEqual({ status: "approved", label: "ღია" });
    expect(contentPill("closed")).toEqual({ status: "draft", label: "დახურული" });
  });
});
```

Append to `lib/funnel.test.ts`:

```ts
describe("Phase 5 error tokens", () => {
  it("maps every community token to Georgian", () => {
    expect(mapFunnelError("already_voted")).toBe("ხმა უკვე მიცემულია.");
    expect(mapFunnelError("P0001: poll_closed")).toBe("გამოკითხვა დახურულია.");
    expect(mapFunnelError("rsvp_closed")).toBe("რეგისტრაცია ამ ღონისძიებაზე დახურულია.");
    expect(mapFunnelError("invalid_option")).toBe("აირჩიე პასუხი სიიდან.");
    expect(mapFunnelError("invalid_options")).toBe("პასუხის ვარიანტები არასწორია (2–10, უნიკალური).");
    expect(mapFunnelError("invalid_status")).toBe(
      "მოქმედება ამ მდგომარეობაში შეუძლებელია — განაახლე გვერდი.",
    );
    expect(mapFunnelError("invalid_event_dates")).toBe("თარიღები არასწორია.");
    expect(mapFunnelError("invalid_image")).toBe("სურათის შენახვა ვერ მოხერხდა.");
  });
});
```

(`mapFunnelError` is already imported at the top of `lib/funnel.test.ts` — extend the existing import if not.)

Append to `lib/cabinet.test.ts`:

```ts
describe("Phase 5 cabinet nav", () => {
  it("member gains news/events/polls after billing", () => {
    expect(cabinetNavItems("member").map((i) => i.href)).toEqual([
      "/me/profile",
      "/me/delegate",
      "/me/billing",
      "/me/news",
      "/me/events",
      "/me/polls",
    ]);
  });
  it("delegate gains the same three, panel stays last", () => {
    expect(cabinetNavItems("delegate").map((i) => i.href)).toEqual([
      "/me/profile",
      "/me/billing",
      "/me/news",
      "/me/events",
      "/me/polls",
      "/delegate",
    ]);
  });
  it("admin link still appends last", () => {
    expect(cabinetNavItems("member", true).map((i) => i.href).at(-1)).toBe("/admin");
    expect(cabinetNavItems("delegate", true).map((i) => i.href).at(-1)).toBe("/admin");
  });
});
```

- [ ] **Step 2: Run to verify the new cases fail**

Run: `npx vitest run lib/admin.test.ts lib/funnel.test.ts lib/cabinet.test.ts`
Expected: FAIL — missing tab, missing labels, `contentPill is not a function`, missing tokens, nav mismatch. **Every pre-existing case must still pass.** If an existing nav/tab assertion enumerates the old lists exactly, UPDATE that existing test to the new expected lists in this same step — that is the failing-test edit, not a shortcut.

- [ ] **Step 3: Implement the riders**

`lib/admin.ts` — in `TAB_MATRIX`, insert after the `ტრანსფერი` row:

```ts
  { href: "/admin/content", label: "შიგთავსი", roles: ["super_admin", "editor"] },
```

Update `ROLE_DUTIES_KA.editor` (the "(ჩაირთვება მე-5 ფაზაში)" note is now false):

```ts
  editor: "სიახლეები, ღონისძიებები და გამოკითხვები",
```

Append to `AUDIT_ACTION_LABELS_KA`:

```ts
  "news.save": "სიახლის შენახვა",
  "news.update": "სიახლის რედაქტირება",
  "news.publish": "სიახლის გამოქვეყნება",
  "news.unpublish": "სიახლის მოხსნა",
  "news.delete": "სიახლის წაშლა",
  "news.set_image": "სიახლის ყდის განახლება",
  "event.save": "ღონისძიების შენახვა",
  "event.update": "ღონისძიების რედაქტირება",
  "event.publish": "ღონისძიების გამოქვეყნება",
  "event.cancel": "ღონისძიების გაუქმება",
  "event.delete": "ღონისძიების წაშლა",
  "poll.save": "გამოკითხვის შენახვა",
  "poll.open": "გამოკითხვის გახსნა",
  "poll.close": "გამოკითხვის დახურვა",
  "poll.delete": "გამოკითხვის წაშლა",
```

Add at the end of `lib/admin.ts`:

```ts
export type ContentStatus = "draft" | "published" | "cancelled" | "open" | "closed";

/** Content-status → Pill props (status drives the color, label overrides the text). */
export function contentPill(status: ContentStatus): {
  status: "draft" | "approved" | "rejected";
  label: string;
} {
  switch (status) {
    case "published":
      return { status: "approved", label: "გამოქვეყნებული" };
    case "cancelled":
      return { status: "rejected", label: "გაუქმებული" };
    case "open":
      return { status: "approved", label: "ღია" };
    case "closed":
      return { status: "draft", label: "დახურული" };
    default:
      return { status: "draft", label: "მონახაზი" };
  }
}
```

`lib/funnel.ts` — append to `ERROR_MESSAGES` (before the closing `};`):

```ts
  // Phase 5 community tokens (spec §6). ORDER MATTERS: mapFunnelError matches by
  // substring in insertion order, so the longer `invalid_options` must precede
  // its prefix `invalid_option`; and the token is `invalid_event_dates` (NOT
  // `invalid_dates`) because Phase 4's earlier `invalid_date` entry would
  // substring-shadow it.
  already_voted: "ხმა უკვე მიცემულია.",
  poll_closed: "გამოკითხვა დახურულია.",
  rsvp_closed: "რეგისტრაცია ამ ღონისძიებაზე დახურულია.",
  invalid_options: "პასუხის ვარიანტები არასწორია (2–10, უნიკალური).",
  invalid_option: "აირჩიე პასუხი სიიდან.",
  invalid_status: "მოქმედება ამ მდგომარეობაში შეუძლებელია — განაახლე გვერდი.",
  invalid_title: "სათაური არასწორია (1–160 სიმბოლო).",
  invalid_body: "ტექსტი ცარიელია ან ძალიან გრძელია.",
  invalid_location: "ადგილმდებარეობა არასწორია (1–200 სიმბოლო).",
  invalid_event_dates: "თარიღები არასწორია.",
  invalid_question: "კითხვა არასწორია (1–300 სიმბოლო).",
  invalid_image: "სურათის შენახვა ვერ მოხერხდა.",
```

(The Step 1 funnel tests cover both collision hazards: the `invalid_options` assertion fails if it sits after `invalid_option`, and the `invalid_event_dates` assertion fails if the token were named `invalid_dates`.)

`lib/cabinet.ts` — replace the two arrays in `cabinetNavItems`:

```ts
  const items: CabinetNavItem[] =
    role === "delegate"
      ? [
          { href: "/me/profile", label: "პროფილი" },
          { href: "/me/billing", label: "გადახდები" },
          { href: "/me/news", label: "სიახლეები" },
          { href: "/me/events", label: "ღონისძიებები" },
          { href: "/me/polls", label: "გამოკითხვები" },
          { href: "/delegate", label: "დელეგატის პანელი" },
        ]
      : [
          { href: "/me/profile", label: "პროფილი" },
          { href: "/me/delegate", label: "ჩემი დელეგატი" },
          { href: "/me/billing", label: "გადახდები" },
          { href: "/me/news", label: "სიახლეები" },
          { href: "/me/events", label: "ღონისძიებები" },
          { href: "/me/polls", label: "გამოკითხვები" },
        ];
```

- [ ] **Step 4: Run the three suites, then the whole unit suite**

Run: `npx vitest run lib/admin.test.ts lib/funnel.test.ts lib/cabinet.test.ts && npx vitest run`
Expected: PASS everywhere. If `components/CabinetNav.test.tsx` or `AdminNav.test.tsx` assert old item sets, update those assertions to the new lists (they are UX-truth tests, and the UX truth changed by spec).

- [ ] **Step 5: Commit**

```bash
npm run format
git add lib/admin.ts lib/admin.test.ts lib/funnel.ts lib/funnel.test.ts lib/cabinet.ts lib/cabinet.test.ts
git commit -m "feat: Phase 5 vocabulary — შიგთავსი tab, audit labels, error tokens, cabinet nav"
```

---

### Task 6: The migration — `supabase/migrations/20260719150000_community.sql` + typed client

**Files:**
- Create: `supabase/migrations/20260719150000_community.sql`
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Consumes: existing `set_updated_at()` (initial schema), `has_any_admin_role(variadic text[])` (Phase 4), `audit_log(actor_id, action, target_type, target_id, details)`, `tbilisi-consistent now()` discipline, `profiles.registration_completed_at`, `memberships(member_id, delegate_id, ended_at)`.
- Produces (consumed by every later task): the six tables, `is_completed_member()`, 13 views, 16 RPCs, the `news-images` bucket — names and signatures exactly as below.
- ADR-005: unit tests never touch the DB — this task's checks are typecheck/build; live verification is Task 7 (apply) + Task 9 (probes).

- [ ] **Step 1: Write `supabase/migrations/20260719150000_community.sql`** — the complete file:

```sql
-- Phase 5 — Community (spec §4): news / events / event_rsvps / polls /
-- poll_options / poll_votes; member/public/admin read views; transparency
-- aggregates; audited editor RPCs; member RSVP/vote RPCs; news-images bucket.
-- Access model: base tables carry ZERO client grants; reads go through views,
-- writes through SECURITY DEFINER RPCs (ADR-014; extends ADR-009).

-- 1) Tables ---------------------------------------------------------------------

create table news (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint news_title_len check (char_length(btrim(title)) between 1 and 160),
  body text not null
    constraint news_body_len check (char_length(body) between 1 and 20000),
  visibility text not null default 'public'
    constraint news_visibility check (visibility in ('public', 'members')),
  status text not null default 'draft'
    constraint news_status check (status in ('draft', 'published')),
  slug text unique
    constraint news_slug_format
    check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80)),
  image_url text,
  published_at timestamptz,
  -- published rows are complete rows (delegates' approved-slug backstop
  -- precedent): the seed writes status directly, so the RPC path must not be
  -- the only guard
  constraint published_news_complete
    check (status <> 'published' or (slug is not null and published_at is not null)),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger news_updated_at before update on news
  for each row execute function set_updated_at();
create index news_public_list on news (published_at desc) where status = 'published';

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint events_title_len check (char_length(btrim(title)) between 1 and 160),
  description text not null
    constraint events_description_len check (char_length(description) between 1 and 20000),
  location text not null
    constraint events_location_len check (char_length(btrim(location)) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  constraint events_dates check (ends_at is null or ends_at > starts_at),
  status text not null default 'draft'
    constraint events_status check (status in ('draft', 'published', 'cancelled')),
  slug text unique
    constraint events_slug_format
    check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80)),
  published_at timestamptz,
  -- cancelled rows stay publicly visible, so they too must keep slug/published_at
  constraint published_events_complete
    check (status = 'draft' or (slug is not null and published_at is not null)),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger events_updated_at before update on events
  for each row execute function set_updated_at();
create index events_public_list on events (starts_at) where status <> 'draft';

-- member_id cascades on profile deletion: e2e/staging cleanup only — the
-- platform has no member-deletion flow (payments.member_id precedent, ADR-015).
create table event_rsvps (
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  status text not null
    constraint event_rsvps_status check (status in ('going', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create trigger event_rsvps_updated_at before update on event_rsvps
  for each row execute function set_updated_at();

create table polls (
  id uuid primary key default gen_random_uuid(),
  question text not null
    constraint polls_question_len check (char_length(btrim(question)) between 1 and 300),
  status text not null default 'draft'
    constraint polls_status check (status in ('draft', 'open', 'closed')),
  ends_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger polls_updated_at before update on polls
  for each row execute function set_updated_at();

create table poll_options (
  id uuid not null default gen_random_uuid() primary key,
  poll_id uuid not null references polls(id) on delete cascade,
  position int not null,
  label text not null
    constraint poll_options_label_len check (char_length(btrim(label)) between 1 and 120),
  unique (poll_id, id),
  unique (poll_id, position)
);

create table poll_votes (
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null,
  member_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- THE one-vote-per-member rule (parent spec §4): a second vote is a PK
  -- violation, not an application decision.
  primary key (poll_id, member_id),
  -- a vote can never point at another poll's option
  foreign key (poll_id, option_id) references poll_options (poll_id, id) on delete cascade
);

-- 2) Lockdown -------------------------------------------------------------------

alter table news enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;

revoke all on news, events, event_rsvps, polls, poll_options, poll_votes
  from anon, authenticated;

-- Own-row read-backs (spec §4.2): how the cabinet knows "did I RSVP / vote".
create policy "own rsvps readable" on event_rsvps
  for select to authenticated using (member_id = auth.uid());
grant select (event_id, member_id, status) on event_rsvps to authenticated;

create policy "own votes readable" on poll_votes
  for select to authenticated using (member_id = auth.uid());
grant select (poll_id, option_id, member_id) on poll_votes to authenticated;

-- 3) Member gate helper ----------------------------------------------------------

-- View-callable completed-registration check (the DB-level meaning of
-- „წევრებისთვის"). Definer so it can read profiles regardless of the caller's
-- column grants; callers still need EXECUTE (functions in views run as the
-- calling user — has_any_admin_role precedent). Stamp-only by design (spec
-- §4.2): registration_completed_at, not status.
create function is_completed_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and registration_completed_at is not null
  );
$$;
grant execute on function is_completed_member() to authenticated;
revoke execute on function is_completed_member() from public, anon;

-- 4) Read views (spec §4.2–§4.3) -------------------------------------------------

create view public_news as
select id, slug, title, body, image_url, published_at
from news
where status = 'published' and visibility = 'public';

create view member_news as
select id, slug, title, body, image_url, visibility, published_at
from news
where status = 'published' and is_completed_member();

create view public_events as
select id, slug, title, description, location, starts_at, ends_at, status, published_at
from events
where status in ('published', 'cancelled');

create view member_event_going_counts as
select e.id as event_id,
       count(r.member_id) filter (where r.status = 'going')::int as going
from events e
left join event_rsvps r on r.event_id = e.id
where e.status in ('published', 'cancelled') and is_completed_member()
group by e.id;

create view member_polls as
select id, question, status, ends_at, opened_at, closed_at
from polls
where status in ('open', 'closed') and is_completed_member();

-- Labels are always member-visible (they render the vote buttons); only COUNTS
-- are gated (decision #4) — poll_option_counts below.
create view member_poll_options as
select po.poll_id, po.id as option_id, po.position, po.label
from poll_options po
join polls p on p.id = po.poll_id
where p.status in ('open', 'closed') and is_completed_member();

create view poll_option_counts as
select po.poll_id, po.id as option_id, count(v.member_id)::int as votes
from poll_options po
join polls p on p.id = po.poll_id
left join poll_votes v on v.poll_id = po.poll_id and v.option_id = po.id
where p.status in ('open', 'closed')
  and is_completed_member()
  and (p.status = 'closed'
       or exists (select 1 from poll_votes mine
                  where mine.poll_id = po.poll_id and mine.member_id = auth.uid()))
group by po.poll_id, po.id;

create view transparency_stats as
select
  coalesce((select sum(amount_gel) from payments where voided_at is null), 0)::numeric(12, 2)
    as total_gel,
  (select count(*)::int from profiles where status <> 'draft') as registered_members,
  (select count(*)::int from delegates where status = 'approved') as approved_delegates;

create view transparency_regions as
select r.id as region_id,
       r.name_ka,
       count(p.id) filter (where p.status <> 'draft')::int as registered,
       count(p.id) filter (where p.status = 'active_member')::int as active
from regions r
left join profiles p on p.region_id = r.id
group by r.id, r.name_ka;

create view admin_news as
select n.id, n.title, n.body, n.visibility, n.status, n.slug, n.image_url,
       n.published_at, n.updated_at
from news n
where has_any_admin_role('super_admin', 'editor');

create view admin_events as
select e.id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.status,
       e.slug, e.published_at, e.updated_at,
       (select count(*)::int from event_rsvps r
        where r.event_id = e.id and r.status = 'going') as going_count
from events e
where has_any_admin_role('super_admin', 'editor');

create view admin_polls as
select p.id, p.question, p.status, p.ends_at, p.opened_at, p.closed_at, p.updated_at,
       (select count(*)::int from poll_votes v where v.poll_id = p.id) as total_votes
from polls p
where has_any_admin_role('super_admin', 'editor');

create view admin_poll_options as
select po.poll_id, po.id as option_id, po.position, po.label,
       (select count(*)::int from poll_votes v
        where v.poll_id = po.poll_id and v.option_id = po.id) as votes
from poll_options po
where has_any_admin_role('super_admin', 'editor');

-- Defense-in-depth (portability): on instances with classic default privileges,
-- views are born with ALL granted to client roles, and single-relation views
-- are auto-updatable with OWNER (RLS-exempt) rights — revoke everything before
-- granting exactly SELECT.
revoke all on public_news, member_news, public_events, member_event_going_counts,
  member_polls, member_poll_options, poll_option_counts, transparency_stats,
  transparency_regions, admin_news, admin_events, admin_polls, admin_poll_options
  from anon, authenticated;

grant select on public_news, public_events, transparency_stats, transparency_regions
  to anon, authenticated;
grant select on member_news, member_polls, member_poll_options, poll_option_counts,
  member_event_going_counts, admin_news, admin_events, admin_polls, admin_poll_options
  to authenticated;

-- 5) Editor mutation RPCs (ADR-014 envelope: role check first, every effect +
--    the audit row in ONE transaction, token errors) ------------------------------

create function admin_save_news(p_id uuid, p_title text, p_body text, p_visibility text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := coalesce(p_body, '');
  v_row public.news%rowtype;
  v_action text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid_title'; end if;
  if char_length(v_body) not between 1 and 20000 then raise exception 'invalid_body'; end if;
  if p_visibility not in ('public', 'members') then raise exception 'invalid_status'; end if;

  if p_id is null then
    insert into public.news (title, body, visibility, created_by)
    values (v_title, v_body, p_visibility, v_uid)
    returning * into v_row;
    v_action := 'news.save';
  else
    select * into v_row from public.news where id = p_id;
    if not found then raise exception 'invalid_target'; end if;
    v_action := case when v_row.status = 'published' then 'news.update' else 'news.save' end;
    update public.news
    set title = v_title, body = v_body, visibility = p_visibility
    where id = p_id
    returning * into v_row;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, v_action, 'news', v_row.id::text,
          jsonb_build_object('title', v_title, 'visibility', p_visibility,
                             'status', v_row.status));
  return v_row.id;
end $$;

create function admin_publish_news(p_id uuid, p_slug text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.news%rowtype;
  v_slug text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.news where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status = 'published' then raise exception 'invalid_status'; end if;

  -- slug is permanent once set (URL stability — delegate precedent); a
  -- re-publish keeps the original. Concurrent duplicate surfaces as 23505 and
  -- the server action retries with a new suffix.
  v_slug := coalesce(v_row.slug, nullif(btrim(coalesce(p_slug, '')), ''));
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 80 then
    raise exception 'invalid_slug';
  end if;

  -- conditional DML (race guard): a concurrent transition surfaces as
  -- invalid_status instead of clobbering. Re-publish keeps the ORIGINAL
  -- published_at (accepted: list order stays stable across unpublish cycles).
  update public.news
  set status = 'published', slug = v_slug, published_at = coalesce(published_at, now())
  where id = p_id and status = 'draft';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'news.publish', 'news', p_id::text,
          jsonb_build_object('title', v_row.title, 'slug', v_slug,
                             'visibility', v_row.visibility));
  return jsonb_build_object('slug', v_slug);
end $$;

create function admin_unpublish_news(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.news%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.news where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'published' then raise exception 'invalid_status'; end if;

  update public.news set status = 'draft'
  where id = p_id and status = 'published';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'news.unpublish', 'news', p_id::text,
          jsonb_build_object('title', v_row.title, 'slug', v_row.slug));
end $$;

create function admin_delete_news(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.news%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.news where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  -- only never-published drafts are deletable; published articles are
  -- unpublished instead (spec §3.7 — history stays, audit stays meaningful)
  if v_row.status <> 'draft' or v_row.published_at is not null then
    raise exception 'invalid_status';
  end if;

  -- conditional DML: re-checks in the DELETE itself so a racing publish can
  -- never lose a published article (check-then-act guard)
  delete from public.news
  where id = p_id and status = 'draft' and published_at is null;
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'news.delete', 'news', p_id::text,
          jsonb_build_object('title', v_row.title));
end $$;

create function admin_set_news_image(p_id uuid, p_image_url text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.news%rowtype;
  v_url text := nullif(btrim(coalesce(p_image_url, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.news where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  -- pinned to the news-images bucket: this RPC pairs with the upload action,
  -- so arbitrary external URLs have no business here
  if v_url is null or char_length(v_url) > 600
     or v_url not like 'https://%/storage/v1/object/public/news-images/%' then
    raise exception 'invalid_image';
  end if;

  update public.news set image_url = v_url where id = p_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'news.set_image', 'news', p_id::text,
          jsonb_build_object('title', v_row.title));
end $$;

create function admin_save_event(
  p_id uuid, p_title text, p_description text, p_location text,
  p_starts_at timestamptz, p_ends_at timestamptz
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := coalesce(p_description, '');
  v_location text := btrim(coalesce(p_location, ''));
  v_row public.events%rowtype;
  v_action text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid_title'; end if;
  if char_length(v_description) not between 1 and 20000 then raise exception 'invalid_body'; end if;
  if char_length(v_location) not between 1 and 200 then raise exception 'invalid_location'; end if;
  if p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'invalid_event_dates';
  end if;

  if p_id is null then
    insert into public.events (title, description, location, starts_at, ends_at, created_by)
    values (v_title, v_description, v_location, p_starts_at, p_ends_at, v_uid)
    returning * into v_row;
    v_action := 'event.save';
  else
    select * into v_row from public.events where id = p_id;
    if not found then raise exception 'invalid_target'; end if;
    -- cancelled events are frozen history (only draft/published are editable)
    if v_row.status = 'cancelled' then raise exception 'invalid_status'; end if;
    v_action := case when v_row.status = 'published' then 'event.update' else 'event.save' end;
    update public.events
    set title = v_title, description = v_description, location = v_location,
        starts_at = p_starts_at, ends_at = p_ends_at
    where id = p_id
    returning * into v_row;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, v_action, 'event', v_row.id::text,
          jsonb_build_object('title', v_title, 'startsAt', p_starts_at,
                             'status', v_row.status));
  return v_row.id;
end $$;

create function admin_publish_event(p_id uuid, p_slug text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.events%rowtype;
  v_slug text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.events where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'draft' then raise exception 'invalid_status'; end if;

  v_slug := coalesce(v_row.slug, nullif(btrim(coalesce(p_slug, '')), ''));
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 80 then
    raise exception 'invalid_slug';
  end if;

  update public.events
  set status = 'published', slug = v_slug, published_at = coalesce(published_at, now())
  where id = p_id and status = 'draft';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'event.publish', 'event', p_id::text,
          jsonb_build_object('title', v_row.title, 'slug', v_slug));
  return jsonb_build_object('slug', v_slug);
end $$;

create function admin_cancel_event(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.events where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'published' then raise exception 'invalid_status'; end if;

  update public.events set status = 'cancelled'
  where id = p_id and status = 'published';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'event.cancel', 'event', p_id::text,
          jsonb_build_object('title', v_row.title, 'slug', v_row.slug));
end $$;

create function admin_delete_event(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.events where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'draft' or v_row.published_at is not null then
    raise exception 'invalid_status';
  end if;

  delete from public.events
  where id = p_id and status = 'draft' and published_at is null;
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'event.delete', 'event', p_id::text,
          jsonb_build_object('title', v_row.title));
end $$;

create function admin_save_poll(p_id uuid, p_question text, p_options text[], p_ends_at timestamptz)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_question text := btrim(coalesce(p_question, ''));
  v_options text[];
  v_row public.polls%rowtype;
  v_opt text;
  v_pos int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_question) not between 1 and 300 then raise exception 'invalid_question'; end if;

  select array_agg(btrim(o)) into v_options
  from unnest(coalesce(p_options, '{}')) as o;
  if v_options is null
     or array_length(v_options, 1) not between 2 and 10
     or exists (select 1 from unnest(v_options) o where char_length(o) not between 1 and 120)
     or (select count(distinct o) from unnest(v_options) o) <> array_length(v_options, 1) then
    raise exception 'invalid_options';
  end if;

  if p_id is null then
    insert into public.polls (question, ends_at, created_by)
    values (v_question, p_ends_at, v_uid)
    returning * into v_row;
  else
    select * into v_row from public.polls where id = p_id;
    if not found then raise exception 'invalid_target'; end if;
    -- content is frozen the moment a poll opens (spec §3.7)
    if v_row.status <> 'draft' then raise exception 'invalid_status'; end if;
    update public.polls set question = v_question, ends_at = p_ends_at
    where id = p_id and status = 'draft'
    returning * into v_row;
    if not found then raise exception 'invalid_status'; end if;
    delete from public.poll_options where poll_id = v_row.id;
  end if;

  foreach v_opt in array v_options loop
    v_pos := v_pos + 1;
    insert into public.poll_options (poll_id, position, label)
    values (v_row.id, v_pos, v_opt);
  end loop;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'poll.save', 'poll', v_row.id::text,
          jsonb_build_object('question', v_question,
                             'optionCount', array_length(v_options, 1)));
  return v_row.id;
end $$;

create function admin_open_poll(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.polls%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.polls where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'draft' then raise exception 'invalid_status'; end if;
  -- an "open" poll nobody can vote in is a trap — fix the date first
  if v_row.ends_at is not null and v_row.ends_at <= now() then
    raise exception 'invalid_event_dates';
  end if;
  if (select count(*) from public.poll_options where poll_id = p_id) < 2 then
    raise exception 'invalid_options';
  end if;

  update public.polls set status = 'open', opened_at = now()
  where id = p_id and status = 'draft';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'poll.open', 'poll', p_id::text,
          jsonb_build_object('question', v_row.question, 'endsAt', v_row.ends_at));
end $$;

create function admin_close_poll(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.polls%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.polls where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'open' then raise exception 'invalid_status'; end if;

  update public.polls set status = 'closed', closed_at = now()
  where id = p_id and status = 'open';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'poll.close', 'poll', p_id::text,
          jsonb_build_object('question', v_row.question));
end $$;

create function admin_delete_poll(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.polls%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.polls where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_row.status <> 'draft' then raise exception 'invalid_status'; end if;

  delete from public.polls
  where id = p_id and status = 'draft';
  if not found then raise exception 'invalid_status'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'poll.delete', 'poll', p_id::text,
          jsonb_build_object('question', v_row.question));
end $$;

-- 6) Member RPCs (ADR-009 envelope: subject always auth.uid(), completed
--    registration required, validation in-DB, NO audit rows) ----------------------

create function member_rsvp(p_event_id uuid, p_going boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles
                 where id = v_uid and registration_completed_at is not null) then
    raise exception 'not_completed';
  end if;
  if p_going is null then raise exception 'invalid_status'; end if;
  select * into v_event from public.events where id = p_event_id;
  if not found or v_event.status = 'draft' then raise exception 'invalid_target'; end if;
  if v_event.status = 'cancelled' or v_event.starts_at <= now() then
    raise exception 'rsvp_closed';
  end if;

  insert into public.event_rsvps (event_id, member_id, status)
  values (p_event_id, v_uid, case when p_going then 'going' else 'cancelled' end)
  on conflict (event_id, member_id)
  do update set status = excluded.status;
end $$;

create function member_cast_vote(p_poll_id uuid, p_option_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles
                 where id = v_uid and registration_completed_at is not null) then
    raise exception 'not_completed';
  end if;
  -- FOR SHARE serializes this vote against admin_close_poll's row update
  -- (check-then-insert race) without votes blocking each other
  select * into v_poll from public.polls where id = p_poll_id for share;
  if not found or v_poll.status = 'draft' then raise exception 'invalid_target'; end if;
  if v_poll.status <> 'open'
     or (v_poll.ends_at is not null and now() > v_poll.ends_at) then
    raise exception 'poll_closed';
  end if;
  if not exists (select 1 from public.poll_options
                 where id = p_option_id and poll_id = p_poll_id) then
    raise exception 'invalid_option';
  end if;

  begin
    insert into public.poll_votes (poll_id, option_id, member_id)
    values (p_poll_id, p_option_id, v_uid);
  exception when unique_violation then
    raise exception 'already_voted';
  end;
end $$;

-- 7) Delegate read RPC (delegate_team precedent: gated to the caller's own
--    delegates row) ---------------------------------------------------------------

create function delegate_team_rsvps() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.delegates where id = v_uid) then
    raise exception 'not_a_delegate';
  end if;
  -- approved-only, mirroring delegate_team's hardening migration
  -- (20260716120000_delegate_team_approved_gate.sql): pending/rejected
  -- delegates get no team PII. Unreachable via UI (delegate pages gate
  -- pre-approval) — this is the DB boundary.
  if not exists (select 1 from public.delegates
                 where id = v_uid and status = 'approved') then
    raise exception 'not_approved';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'eventId', e.id,
             'title', e.title,
             'startsAt', e.starts_at,
             'goingCount', t.going_count,
             'going', t.names)
           order by e.starts_at)
    from public.events e
    cross join lateral (
      select count(*)::int as going_count,
             coalesce(jsonb_agg(jsonb_build_object(
               'firstName', pr.first_name, 'lastName', pr.last_name)
               order by pr.first_name, pr.last_name), '[]'::jsonb) as names
      from public.event_rsvps r
      join public.memberships m
        on m.member_id = r.member_id and m.delegate_id = v_uid and m.ended_at is null
      join public.profiles pr on pr.id = r.member_id
      where r.event_id = e.id and r.status = 'going'
    ) t
    where e.status = 'published' and coalesce(e.ends_at, e.starts_at) >= now()
  ), '[]'::jsonb);
end $$;

grant execute on function
  admin_save_news(uuid, text, text, text),
  admin_publish_news(uuid, text),
  admin_unpublish_news(uuid),
  admin_delete_news(uuid),
  admin_set_news_image(uuid, text),
  admin_save_event(uuid, text, text, text, timestamptz, timestamptz),
  admin_publish_event(uuid, text),
  admin_cancel_event(uuid),
  admin_delete_event(uuid),
  admin_save_poll(uuid, text, text[], timestamptz),
  admin_open_poll(uuid),
  admin_close_poll(uuid),
  admin_delete_poll(uuid),
  member_rsvp(uuid, boolean),
  member_cast_vote(uuid, uuid),
  delegate_team_rsvps()
to authenticated;
revoke execute on function
  admin_save_news(uuid, text, text, text),
  admin_publish_news(uuid, text),
  admin_unpublish_news(uuid),
  admin_delete_news(uuid),
  admin_set_news_image(uuid, text),
  admin_save_event(uuid, text, text, text, timestamptz, timestamptz),
  admin_publish_event(uuid, text),
  admin_cancel_event(uuid),
  admin_delete_event(uuid),
  admin_save_poll(uuid, text, text[], timestamptz),
  admin_open_poll(uuid),
  admin_close_poll(uuid),
  admin_delete_poll(uuid),
  member_rsvp(uuid, boolean),
  member_cast_vote(uuid, uuid),
  delegate_team_rsvps()
from public, anon;

-- 8) Storage --------------------------------------------------------------------

-- Public bucket, delegate-photos precedent: public read; writes only via the
-- service-role upload action paired with admin_set_news_image (spec §4.4, §6).
insert into storage.buckets (id, name, public)
values ('news-images', 'news-images', true)
on conflict (id) do update set public = true;
```

- [ ] **Step 2: Append the new tables/views/functions to `lib/supabase/types.ts`** (same commit as the migration — file-header rule). Add row aliases near the top with the existing ones:

```ts
export type NewsVisibilityRow = "public" | "members";
export type NewsStatusRow = "draft" | "published";
export type EventStatusRow = "draft" | "published" | "cancelled";
export type PollStatusRow = "draft" | "open" | "closed";
export type RsvpStatusRow = "going" | "cancelled";
```

Into `Tables` (each with `Insert: never; Update: never; Relationships: []` — no typed-client code path ever writes them directly):

```ts
      news: {
        Row: {
          id: string;
          title: string;
          body: string;
          visibility: NewsVisibilityRow;
          status: NewsStatusRow;
          slug: string | null;
          image_url: string | null;
          published_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string;
          location: string;
          starts_at: string;
          ends_at: string | null;
          status: EventStatusRow;
          slug: string | null;
          published_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      event_rsvps: {
        Row: {
          event_id: string;
          member_id: string;
          status: RsvpStatusRow;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      polls: {
        Row: {
          id: string;
          question: string;
          status: PollStatusRow;
          ends_at: string | null;
          opened_at: string | null;
          closed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      poll_options: {
        Row: { id: string; poll_id: string; position: number; label: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      poll_votes: {
        Row: { poll_id: string; option_id: string; member_id: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
```

Into `Views` (mirror the existing view-entry shape — `Row` only):

```ts
      public_news: {
        Row: {
          id: string;
          slug: string;
          title: string;
          body: string;
          image_url: string | null;
          published_at: string;
        };
        Relationships: [];
      };
      member_news: {
        Row: {
          id: string;
          slug: string;
          title: string;
          body: string;
          image_url: string | null;
          visibility: NewsVisibilityRow;
          published_at: string;
        };
        Relationships: [];
      };
      public_events: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string;
          location: string;
          starts_at: string;
          ends_at: string | null;
          status: "published" | "cancelled";
          published_at: string;
        };
        Relationships: [];
      };
      member_event_going_counts: {
        Row: { event_id: string; going: number };
        Relationships: [];
      };
      member_polls: {
        Row: {
          id: string;
          question: string;
          status: "open" | "closed";
          ends_at: string | null;
          opened_at: string | null;
          closed_at: string | null;
        };
        Relationships: [];
      };
      member_poll_options: {
        Row: { poll_id: string; option_id: string; position: number; label: string };
        Relationships: [];
      };
      poll_option_counts: {
        Row: { poll_id: string; option_id: string; votes: number };
        Relationships: [];
      };
      transparency_stats: {
        Row: { total_gel: number; registered_members: number; approved_delegates: number };
        Relationships: [];
      };
      transparency_regions: {
        Row: { region_id: number; name_ka: string; registered: number; active: number };
        Relationships: [];
      };
      admin_news: {
        Row: {
          id: string;
          title: string;
          body: string;
          visibility: NewsVisibilityRow;
          status: NewsStatusRow;
          slug: string | null;
          image_url: string | null;
          published_at: string | null;
          updated_at: string;
        };
        Relationships: [];
      };
      admin_events: {
        Row: {
          id: string;
          title: string;
          description: string;
          location: string;
          starts_at: string;
          ends_at: string | null;
          status: EventStatusRow;
          slug: string | null;
          published_at: string | null;
          updated_at: string;
          going_count: number;
        };
        Relationships: [];
      };
      admin_polls: {
        Row: {
          id: string;
          question: string;
          status: PollStatusRow;
          ends_at: string | null;
          opened_at: string | null;
          closed_at: string | null;
          updated_at: string;
          total_votes: number;
        };
        Relationships: [];
      };
      admin_poll_options: {
        Row: { poll_id: string; option_id: string; position: number; label: string; votes: number };
        Relationships: [];
      };
```

Into `Functions` (mirror the existing function-entry shape):

```ts
      admin_save_news: {
        Args: { p_id: string | null; p_title: string; p_body: string; p_visibility: string };
        Returns: string;
      };
      admin_publish_news: { Args: { p_id: string; p_slug: string }; Returns: Json };
      admin_unpublish_news: { Args: { p_id: string }; Returns: undefined };
      admin_delete_news: { Args: { p_id: string }; Returns: undefined };
      admin_set_news_image: { Args: { p_id: string; p_image_url: string }; Returns: undefined };
      admin_save_event: {
        Args: {
          p_id: string | null;
          p_title: string;
          p_description: string;
          p_location: string;
          p_starts_at: string;
          p_ends_at: string | null;
        };
        Returns: string;
      };
      admin_publish_event: { Args: { p_id: string; p_slug: string }; Returns: Json };
      admin_cancel_event: { Args: { p_id: string }; Returns: undefined };
      admin_delete_event: { Args: { p_id: string }; Returns: undefined };
      admin_save_poll: {
        Args: {
          p_id: string | null;
          p_question: string;
          p_options: string[];
          p_ends_at: string | null;
        };
        Returns: string;
      };
      admin_open_poll: { Args: { p_id: string }; Returns: undefined };
      admin_close_poll: { Args: { p_id: string }; Returns: undefined };
      admin_delete_poll: { Args: { p_id: string }; Returns: undefined };
      member_rsvp: { Args: { p_event_id: string; p_going: boolean }; Returns: undefined };
      member_cast_vote: { Args: { p_poll_id: string; p_option_id: string }; Returns: undefined };
      delegate_team_rsvps: { Args: Record<PropertyKey, never>; Returns: Json };
```

(Before writing, open `lib/supabase/types.ts` and match the EXACT existing shape of a view entry and a zero-arg function entry — e.g. how `funnel_state`/`public_stats` are declared — and follow it byte-for-byte in style.)

- [ ] **Step 3: Verify gates**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: all green (nothing imports the new types yet; the migration is not applied — ADR-005 keeps unit tests DB-free)

- [ ] **Step 4: Commit**

```bash
npm run format
git add supabase/migrations/20260719150000_community.sql lib/supabase/types.ts
git commit -m "feat: community schema — tables, views, audited RPCs, transparency aggregates, news-images bucket"
```

---

### Task 7: Apply the migration to staging

**Files:** none (operational).

- [ ] **Step 1:** Follow the documented pooler procedure (`docs/superpowers/plans/2026-07-15-supabase-staging-connection.md`) exactly as Phases 3–4 did: the owner supplies `SUPABASE_DB_PASSWORD` in `.env.local` when this step is reached; run the apply against the staging project (`orcxtbedkexoclbfgvzd`); the owner deletes the line afterwards.
- [ ] **Step 2:** Sanity-check from the repo (anon key, no password):

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
db.from('transparency_stats').select('*').single().then(({ data, error }) => {
  console.log(error ? 'ERROR: ' + error.message : data);
});
"
```

Expected: `{ total_gel: …, registered_members: …, approved_delegates: … }` — real numbers from the seeded staging data (payments already exist from Phase 4's seed).
- [ ] **Step 3:** No commit (nothing changed in the repo). Mark the task done in the execution tracker.

---

### Task 8: Staging seed — community content

**Files:**
- Modify: `scripts/seed-staging.mjs`

**Interfaces:**
- Consumes: the seed's existing service client `db`, `daysAgoIso(d)`, `insertChunked(table, rows, chunk)`, the canonical-admin phone constants, and the wipe-safety rules (never touch canonical admins / audit actors).
- Produces: deterministic demo content the preview walkthrough and e2e rely on — **4 published public news + 1 published member-only + 1 draft; 2 upcoming + 2 past + 1 cancelled events with RSVPs; 1 closed poll with votes + 1 open poll with votes (future `ends_at`) + 1 open untouched poll.**

- [ ] **Step 1: Add the community section to `scripts/seed-staging.mjs`** — after the existing payments/admin sections (content references member ids, so it must run after members exist). Reuse the file's existing Georgian→Latin slug helper if one exists (search `slug` — Phase 1 backfilled delegate slugs); otherwise add this local helper next to the other top-level helpers:

```js
const KA_LAT = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i",
  კ: "k", ლ: "l", მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh", რ: "r", ს: "s",
  ტ: "t", უ: "u", ფ: "p", ქ: "k", ღ: "gh", ყ: "q", შ: "sh", ჩ: "ch", ც: "ts",
  ძ: "dz", წ: "ts", ჭ: "ch", ხ: "kh", ჯ: "j", ჰ: "h",
};
const slugify = (text, fallback) => {
  const s = [...text].map((c) => KA_LAT[c] ?? c).join("").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || fallback;
};
const hoursFromNowIso = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
```

Then the section itself:

```js
// --- Phase 5: community content ------------------------------------------------
console.log("Seeding community content…");

// wipe (uuid PKs — filter on created_at; votes/options/rsvps cascade)
for (const table of ["news", "events", "polls"]) {
  const { error } = await db.from(table).delete().gte("created_at", "1970-01-01T00:00:00Z");
  if (error) throw new Error(`${table} wipe failed: ${error.message}`);
}

// author: the canonical editor (never wiped — audit-actor invariant)
const { data: editorProfile, error: editorErr } = await db
  .from("profiles").select("id").in("phone", ["+995509000004", "995509000004"]).single();
if (editorErr || !editorProfile) throw new Error("canonical editor profile missing — run the admin section first");
const editorId = editorProfile.id;

// a completed-member pool for votes/RSVPs (never canonical admins as SUBJECTS is
// fine — votes/RSVPs are member acts, not audited admin acts; still, use roster members)
const { data: memberPool, error: poolErr } = await db
  .from("profiles").select("id").neq("status", "draft").not("phone", "like", "+9955090000%")
  .order("created_at").limit(120);
if (poolErr || !memberPool || memberPool.length < 30) {
  throw new Error(`member pool too small for community seed: ${poolErr?.message ?? memberPool?.length}`);
}
const poolIds = memberPool.map((r) => r.id);

// news: 4 public published, 1 members-only published, 1 draft
const NEWS = [
  { t: "მოძრაობა იწყებს რეგიონულ ტურს", d: 2, vis: "public" },
  { t: "გამოქვეყნდა პლატფორმის განახლება", d: 5, vis: "public" },
  { t: "შეხვედრა თბილისის გუნდთან", d: 9, vis: "public" },
  { t: "როგორ მუშაობს დელეგატების სისტემა", d: 14, vis: "public" },
  { t: "შიდა შეხვედრის ოქმი — მხოლოდ წევრებისთვის", d: 3, vis: "members" },
  { t: "მონახაზი: მომავალი კამპანია", d: 0, vis: "public", draft: true },
];
const newsRows = NEWS.map((n) => ({
  title: n.t,
  body: `${n.t} — სრული ტექსტი.\n\nდეტალები: https://respublika.ge/rules\n\nშემოგვიერთდი და მიიღე მონაწილეობა.`,
  visibility: n.vis,
  status: n.draft ? "draft" : "published",
  slug: n.draft ? null : slugify(n.t, "article"),
  published_at: n.draft ? null : daysAgoIso(n.d),
  created_by: editorId,
}));
await insertChunked("news", newsRows);

// one seeded cover on the first article (public bucket, tiny valid PNG)
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
{
  const path = "seed-cover.png";
  const { error: upErr } = await db.storage.from("news-images")
    .upload(path, PNG_1PX, { contentType: "image/png", upsert: true });
  if (upErr) throw new Error(`seed cover upload failed: ${upErr.message}`);
  const url = db.storage.from("news-images").getPublicUrl(path).data.publicUrl;
  const { data: first } = await db.from("news").select("id").eq("slug", newsRows[0].slug).single();
  if (first) {
    const { error } = await db.from("news").update({ image_url: url }).eq("id", first.id);
    if (error) throw new Error(`seed cover attach failed: ${error.message}`);
  }
}

// events: 2 upcoming, 2 past, 1 cancelled-upcoming
const EVENTS = [
  { t: "საერთო კრება თბილისში", startH: 24 * 7, endH: 24 * 7 + 2, status: "published" },
  { t: "რეგიონული შეხვედრა ქუთაისში", startH: 24 * 21, endH: null, status: "published" },
  { t: "გუნდის ვორქშოპი", startH: -24 * 7, endH: -24 * 7 + 3, status: "published" },
  { t: "წევრების პიკნიკი", startH: -24 * 30, endH: null, status: "published" },
  { t: "გაუქმებული ბრიფინგი", startH: 24 * 10, endH: null, status: "cancelled" },
];
const eventRows = EVENTS.map((e) => ({
  title: e.t,
  description: `${e.t}.\n\nდღის წესრიგი: https://respublika.ge/agenda`,
  location: "თბილისი, თავისუფლების მოედანი 1",
  starts_at: hoursFromNowIso(e.startH),
  ends_at: e.endH === null ? null : hoursFromNowIso(e.endH),
  status: e.status,
  slug: slugify(e.t, "event"),
  published_at: daysAgoIso(30),
  created_by: editorId,
}));
await insertChunked("events", eventRows);
const { data: seededEvents } = await db.from("events").select("id, slug, status, starts_at");
const upcomingIds = (seededEvents ?? [])
  .filter((e) => e.status === "published" && new Date(e.starts_at) > new Date())
  .map((e) => e.id);
const pastIds = (seededEvents ?? [])
  .filter((e) => e.status === "published" && new Date(e.starts_at) <= new Date())
  .map((e) => e.id);
const rsvpRows = [];
upcomingIds.forEach((eventId, ei) => {
  poolIds.slice(0, 40 + ei * 10).forEach((memberId, mi) => {
    rsvpRows.push({ event_id: eventId, member_id: memberId, status: mi % 6 === 5 ? "cancelled" : "going" });
  });
});
pastIds.forEach((eventId) => {
  poolIds.slice(0, 25).forEach((memberId) => {
    rsvpRows.push({ event_id: eventId, member_id: memberId, status: "going" });
  });
});
await insertChunked("event_rsvps", rsvpRows);

// polls: closed-with-votes, open-with-votes (future ends_at), open-untouched
const POLLS = [
  {
    q: "უნდა ჩატარდეს თუ არა ღია პრაიმერიზი რეგიონულ დელეგატებზე?",
    opts: ["დიახ", "არა", "თავს ვიკავებ"],
    status: "closed", openedD: 30, closedD: 10, weights: [0.71, 0.14, 0.15], turnout: 90,
  },
  {
    q: "რომელი მიმართულება უნდა იყოს პრიორიტეტი 2026-ში?",
    opts: ["დეცენტრალიზაცია", "სასამართლო რეფორმა", "ეკონომიკა"],
    status: "open", openedD: 5, endsH: 24 * 10, weights: [0.44, 0.38, 0.18], turnout: 60,
  },
  { q: "სად გავმართოთ შემდეგი საერთო კრება?", opts: ["თბილისი", "ქუთაისი", "ბათუმი", "ონლაინ"], status: "open", openedD: 1, turnout: 0 },
];
for (const p of POLLS) {
  const { data: poll, error: pollErr } = await db.from("polls").insert({
    question: p.q,
    status: p.status,
    ends_at: p.endsH ? hoursFromNowIso(p.endsH) : null,
    opened_at: daysAgoIso(p.openedD),
    closed_at: p.closedD ? daysAgoIso(p.closedD) : null,
    created_by: editorId,
  }).select("id").single();
  if (pollErr || !poll) throw new Error(`poll insert failed: ${pollErr?.message}`);
  const optionRows = p.opts.map((label, i) => ({ poll_id: poll.id, position: i + 1, label }));
  const { data: options, error: optErr } = await db.from("poll_options").insert(optionRows).select("id, position");
  if (optErr || !options) throw new Error(`poll options failed: ${optErr?.message}`);
  if (p.turnout > 0) {
    const sorted = [...options].sort((a, b) => a.position - b.position);
    const voters = poolIds.slice(0, p.turnout);
    let cursor = 0;
    const voteRows = [];
    p.weights.forEach((w, oi) => {
      const n = oi === p.weights.length - 1 ? voters.length - cursor : Math.round(voters.length * w);
      voters.slice(cursor, cursor + n).forEach((memberId) => {
        voteRows.push({ poll_id: poll.id, option_id: sorted[oi].id, member_id: memberId });
      });
      cursor += n;
    });
    await insertChunked("poll_votes", voteRows);
  }
}
console.log(`Community: ${newsRows.length} news, ${eventRows.length} events, ${rsvpRows.length} rsvps, ${POLLS.length} polls`);
```

- [ ] **Step 2: Extend the seed's final assertion block** (it already asserts roster/payment invariants — match its style) with:

```js
const { count: pubNewsCount } = await db.from("news").select("*", { count: "exact", head: true })
  .eq("status", "published").eq("visibility", "public");
if (pubNewsCount !== 4) throw new Error(`expected 4 public published news, got ${pubNewsCount}`);
const { count: voteCount } = await db.from("poll_votes").select("*", { count: "exact", head: true });
if (!voteCount || voteCount < 100) throw new Error(`expected ≥100 seeded votes, got ${voteCount}`);
```

- [ ] **Step 3: Run the seed against staging** (service key from `.env.local`, same confirm-ref flow as always):

```bash
node scripts/seed-staging.mjs --confirm-ref orcxtbedkexoclbfgvzd
```

Expected: completes with the community summary line and no assertion failures. Re-run it a second time immediately — it must survive its own output (wipe-safety).

- [ ] **Step 4: Commit**

```bash
npm run format
git add scripts/seed-staging.mjs
git commit -m "feat: seed staging with community content (news, events+rsvps, polls+votes)"
```

---

### Task 9: Schema probes — `scripts/verify-schema.mjs` Phase 5 block

**Files:**
- Modify: `scripts/verify-schema.mjs`

**Interfaces:**
- Consumes: the script's existing `db` (service), `anon` clients, `signInAsSeededAdmin(phoneNational)` helper, the Phase 2 probe user (a COMPLETED member by the time earlier blocks ran), and the seeded content from Task 8.
- Produces: the spec §4.6 guarantees, executable. Mirror the file's existing assertion style — it throws on failure (`if (cond) throw new Error("…")`) and has an `expectToken(promise, token, what)` helper for RPC-error assertions; match the Phase 4 block byte-for-byte in style.

- [ ] **Step 1: Append the Phase 5 block** at the end of the script (after the Phase 4 block), implementing exactly these probes — complete logic, adapted to the file's helper idiom:

```js
// --- Phase 5: community probes (spec §4.6) ---

// P5.1 anon reads: public views yes, member views no, base tables no
{
  const { data, error } = await anon.from("public_news").select("slug, title").limit(50);
  // expect: no error, ≥1 row, every slug non-null
  const { error: memberViewErr } = await anon.from("member_news").select("*").limit(1);
  // expect: memberViewErr truthy (permission denied — view granted to authenticated only)
  const { data: baseLeak, error: baseErr } = await anon.from("news").select("*").limit(1);
  // expect: baseErr truthy OR zero rows (table grants revoked)
  const { data: stats, error: statsErr } = await anon.from("transparency_stats").select("*").single();
  // expect: no error; total_gel ≥ 0; registered_members > 0; approved_delegates > 0
  const { data: regions, error: regionsErr } = await anon.from("transparency_regions").select("*");
  // expect: no error; exactly 11 rows; every row has registered ≥ active ≥ 0
  // expect: anon public_news count === 4 (the seed's public published set) AND
  //         the members-only article's slug is NOT among the returned slugs
  //         (fetch that slug via the service client by visibility='members')
  // expect: extend the script's existing non-admin zero-row/denial loop to
  //         cover admin_news / admin_events / admin_polls / admin_poll_options
}

// P5.2 transparency figures equal service-side ground truth (derived, never stored)
{
  const { data: livePayments } = await db.from("payments").select("amount_gel").is("voided_at", null);
  const expectedTotal = (livePayments ?? []).reduce((s, p) => s + Number(p.amount_gel), 0);
  const { data: stats } = await anon.from("transparency_stats").select("*").single();
  // expect: Math.abs(Number(stats.total_gel) - expectedTotal) < 0.005
}

// P5.3 pre-completion authenticated user: member views return ZERO rows (not errors)
//   (reuse the incomplete-profile probe user pattern from the Phase 2 block — a
//   fresh email+password auth user with no funnel completion)
{
  // member_news → 0 rows; member_polls → 0 rows; member_poll_options → 0 rows
  // member_rsvp(anyUpcomingEventId, true) → error containing 'not_completed'
  // member_cast_vote(openPollId, anyOptionId) → error containing 'not_completed'
}

// P5.4 completed member (the Phase 2 probe user, already completed by that block).
// RE-RUNNABLE: first, service-delete this user's poll_votes/event_rsvps rows on
// the probe targets — prior runs leave them behind.
{
  // member_news: ≥1 row with visibility = 'members' (the seeded internal article)
  // member_polls: both open polls + the closed poll visible
  // the untouched open poll (question "სად გავმართოთ შემდეგი საერთო კრება?"):
  //   member_poll_options → 4 rows BEFORE voting (labels render the buttons)
  //   poll_option_counts for that poll → 0 rows (counts stay hidden pre-vote)
  // member_cast_vote(untouchedPollId, firstOptionId) → ok
  //   poll_option_counts for that poll → now 4 rows, votes summing ≥ 1
  //   own-vote readback: authed.from("poll_votes").select("poll_id, option_id, member_id")
  //     → EXACTLY 1 row (RLS own-row). NOTE: select("*") would 42501 —
  //     created_at is deliberately OUTSIDE the column grant; never widen it
  // member_cast_vote(same poll, secondOptionId) → error containing 'already_voted'
  //   (this is the PK, not app code — assert the error, then confirm the vote count is still 1)
  // member_cast_vote(untouchedPollId, an option id belonging to ANOTHER poll) → 'invalid_option'
  // member_cast_vote(a service-created DRAFT poll's id, any option) → 'invalid_target'
  //   (service-create + delete that draft inside this block)
  // the closed poll: poll_option_counts → rows visible WITHOUT this user voting
  // member_event_going_counts: the upcomingEventId row equals a service-side
  //   count of live 'going' rsvps for that event
  // RSVP toggle: member_rsvp(upcomingEventId, true) → ok; member_rsvp(same, false) → ok;
  //   authed.from("event_rsvps").select("event_id, member_id, status")
  //     .eq("event_id", upcomingEventId) → EXACTLY 1 row, status 'cancelled'
  //     (same column-grant note as poll_votes — select("*") would 42501)
  // member_rsvp(pastEventId, true) → error 'rsvp_closed'
  // member_rsvp(cancelledEventId, true) → error 'rsvp_closed'
  // write-denial: authed.from("news").insert({ title: "x", body: "y" }) → error
  //   (zero client write paths on the six base tables)
}

// Worked example of the expected idiom for the vote sequence (the file's
// throw/expectToken style — every other P5 bullet follows this shape):
//
//   const { data: openPoll } = await db.from("polls")
//     .select("id").eq("question", "სად გავმართოთ შემდეგი საერთო კრება?").single();
//   if (!openPoll) throw new Error("P5: seeded untouched poll missing");
//   const { data: opts } = await db.from("poll_options")
//     .select("id, position").eq("poll_id", openPoll.id).order("position");
//   if (!opts || opts.length !== 4) throw new Error("P5: expected 4 options");
//   const { error: voteErr } = await authed.rpc("member_cast_vote", {
//     p_poll_id: openPoll.id, p_option_id: opts[0].id });
//   if (voteErr) throw new Error(`P5: first vote failed: ${voteErr.message}`);
//   await expectToken(
//     authed.rpc("member_cast_vote", { p_poll_id: openPoll.id, p_option_id: opts[1].id }),
//     "already_voted", "second vote must hit the PK");
//   const { count: voteCount } = await db.from("poll_votes")
//     .select("*", { count: "exact", head: true }).eq("poll_id", openPoll.id);
//   if (voteCount !== 1) throw new Error(`P5: expected exactly 1 vote, got ${voteCount}`);

// P5.5 editor RPCs: audit-in-transaction + role gate + late-vote wall
{
  // const editor = await signInAsSeededAdmin("509000004");
  // pollId = editor.rpc admin_save_poll(null, "პრობის გამოკითხვა?", ["ა","ბ"], null) → uuid
  //   service: audit_log rows where action='poll.save' and target_id=pollId → 1
  // editor.rpc admin_open_poll(pollId) → ok; audit 'poll.open' → 1
  // service: update polls set ends_at = now()-1h where id=pollId  (direct — probes may)
  // completed member: member_cast_vote(pollId, optionId) → error containing 'poll_closed'
  // editor.rpc admin_close_poll(pollId) → ok; audit 'poll.close' → 1
  // verifier = await signInAsSeededAdmin("509000002");
  // verifier.rpc admin_save_news(null, "X", "Y", "public") → error containing 'missing_role'
  // slug permanence + delete guard (editor):
  //   articleId = admin_save_news(null, "პრობის სიახლე", "პრობის ტანი", "public")
  //   admin_publish_news(articleId, "probis-siakhle") → slug S; audit 'news.publish' → 1
  //   admin_unpublish_news(articleId) → anon public_news no longer returns S
  //   admin_publish_news(articleId, "sxva-slagi") → returned slug is STILL S (permanent)
  //   admin_delete_news(articleId) → error 'invalid_status' (was published once)
  // cleanup: service delete polls where id=pollId AND the probe article
  //   (closed/once-published content is not deletable via RPC — probes clean directly)
}

// P5.7 delegate_team_rsvps — the one PII-bearing surface
{
  // the P5.4 completed member (not a delegate): rpc → error 'not_a_delegate'
  // a seeded APPROVED delegate: sign in via the dev_otp_inbox flow (same
  //   mechanics as signInAsSeededAdmin, phone = an approved delegate's, read
  //   from the roster via the service client): rpc → jsonb array of upcoming
  //   published events; TEAM ISOLATION: every 'going' name in the result must
  //   belong to THAT delegate's current team (service-verify the name set
  //   against memberships where delegate_id = that delegate and ended_at is null)
  // (the pending-delegate 'not_approved' branch is enforced by the migration's
  //  gate mirroring 20260716120000 and checked in code review — seeded pending
  //  delegates carry no team, so a live probe would assert nothing)
}

// P5.6 storage: news-images bucket exists and is public
{
  // db.storage.getBucket("news-images") → { public: true }
}
```

Every `// expect:` line above is an assertion to implement — the block must FAIL the script (existing failure convention) when any expectation breaks. Fetch the ids it needs (`upcomingEventId`, `pastEventId`, `cancelledEventId`, poll ids by question text) via the service client from the seeded rows — never hardcode uuids.

- [ ] **Step 2: Run the probes against staging**

```bash
node scripts/verify-schema.mjs
```

Expected: every existing block still green + the Phase 5 block green. (If P5.4's probe user already voted on a previous run: the block must be re-runnable — before voting, service-delete that user's `poll_votes`/`event_rsvps` rows for the probe targets. Build that cleanup INTO the block, first thing.)

- [ ] **Step 3: Commit**

```bash
npm run format
git add scripts/verify-schema.mjs
git commit -m "test: Phase 5 schema probes — visibility gates, vote PK, rsvp toggle, transparency derivation"
```

---

### Task 10: Public news — `/news`, `/news/[slug]`

**Files:**
- Modify: `lib/supabase/public.ts`
- Create: `components/NewsCard.tsx`
- Create: `components/NewsCard.test.tsx`
- Create: `app/(public)/news/page.tsx`
- Create: `app/(public)/news/[slug]/page.tsx`

**Interfaces:**
- Consumes: `public_news` view (Task 6), `excerpt`/`ContentBody` (Task 1), `formatDateKa` (lib/cabinet), `Eyebrow`, `cardSkin` (components/Card).
- Produces (consumed by Tasks 13, 19):
  - `interface PublicNewsItem { id: string; slug: string; title: string; body: string; image_url: string | null; published_at: string }`
  - `fetchPublicNews(): Promise<PublicNewsItem[]>` (newest first), `fetchPublicNewsBySlug(slug: string): Promise<PublicNewsItem | null>`
  - `<NewsCard href title publishedAt imageUrl excerptText pill? />` — shared by `/news` and `/me/news`
- Page logic already TDD'd in lib (Tasks 1, 5); page behavior is locked by the Task 19 e2e + Task 9 probes.

- [ ] **Step 1: Write the failing component test — `components/NewsCard.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pill } from "./Pill";
import { NewsCard } from "./NewsCard";

describe("NewsCard", () => {
  it("renders a link with title, date and excerpt", () => {
    render(
      <NewsCard
        href="/news/testi"
        title="სატესტო სიახლე"
        publishedAt="19.07.2026"
        imageUrl={null}
        excerptText="მოკლე შინაარსი…"
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/news/testi");
    expect(screen.getByText("სატესტო სიახლე")).toBeInTheDocument();
    expect(screen.getByText("19.07.2026")).toBeInTheDocument();
    expect(screen.getByText("მოკლე შინაარსი…")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the cover thumbnail and an optional pill", () => {
    render(
      <NewsCard
        href="/me/news/shida"
        title="შიდა"
        publishedAt="18.07.2026"
        imageUrl="https://x.supabase.co/storage/v1/object/public/news-images/a.png"
        excerptText="ტექსტი"
        pill={<Pill status="pending" label="წევრებისთვის" />}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://x.supabase.co/storage/v1/object/public/news-images/a.png",
    );
    expect(screen.getByText("წევრებისთვის")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/NewsCard.test.tsx`
Expected: FAIL — `Cannot find module './NewsCard'`

- [ ] **Step 3: Implement `components/NewsCard.tsx`**

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { cardSkin } from "@/components/Card";

/** Article list card — shared by /news (public) and /me/news (cabinet feed). */
export function NewsCard({
  href,
  title,
  publishedAt,
  imageUrl,
  excerptText,
  pill,
}: {
  href: string;
  title: string;
  publishedAt: string;
  imageUrl: string | null;
  excerptText: string;
  pill?: ReactNode;
}) {
  return (
    <Link href={href} className={`${cardSkin} flex gap-4 p-4 transition-colors hover:border-brand/50`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
        <img
          src={imageUrl}
          alt=""
          className="h-20 w-28 shrink-0 rounded-lg border border-line object-cover"
        />
      ) : null}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-fg">
          <span>{publishedAt}</span>
          {pill}
        </div>
        <h3 className="mt-1 font-bold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted-fg">{excerptText}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/NewsCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Add the fetchers to `lib/supabase/public.ts`** (below the existing ones, same style):

```ts
export interface PublicNewsItem {
  id: string;
  slug: string;
  title: string;
  body: string;
  image_url: string | null;
  published_at: string;
}

export async function fetchPublicNews(): Promise<PublicNewsItem[]> {
  const { data, error } = await publicClient()
    .from("public_news")
    .select("*")
    .order("published_at", { ascending: false })
    .returns<PublicNewsItem[]>();
  if (error) throw new Error(`public_news: ${error.message}`);
  return data ?? [];
}

export async function fetchPublicNewsBySlug(slug: string): Promise<PublicNewsItem | null> {
  const { data, error } = await publicClient()
    .from("public_news")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<PublicNewsItem>();
  if (error) throw new Error(`public_news by slug: ${error.message}`);
  return data;
}
```

- [ ] **Step 6: Create `app/(public)/news/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Eyebrow } from "@/components/Eyebrow";
import { NewsCard } from "@/components/NewsCard";
import { excerpt } from "@/lib/content-render";
import { formatDateKa } from "@/lib/cabinet";
import { fetchPublicNews } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "სიახლეები — ქართული რესპუბლიკა",
  description: "მოძრაობის სიახლეები და განცხადებები.",
  openGraph: { images: ["/og-default.png"] },
};

export default async function NewsPage() {
  const news = await fetchPublicNews();
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>ქართული რესპუბლიკა</Eyebrow>
      <h1 className="mt-1 font-serif text-4xl font-bold text-ink">სიახლეები</h1>
      {news.length === 0 ? (
        <p className="mt-8 text-muted-fg">სიახლეები მალე გამოჩნდება.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {news.map((n) => (
            <NewsCard
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
    </main>
  );
}
```

- [ ] **Step 7: Create `app/(public)/news/[slug]/page.tsx`** (delegate-page pattern: ISR + static params + metadata + 404):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBody } from "@/components/ContentBody";
import { Eyebrow } from "@/components/Eyebrow";
import { excerpt } from "@/lib/content-render";
import { formatDateKa } from "@/lib/cabinet";
import { fetchPublicNews, fetchPublicNewsBySlug } from "@/lib/supabase/public";

export const revalidate = 60;

export async function generateStaticParams() {
  const news = await fetchPublicNews();
  return news.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchPublicNewsBySlug(slug);
  if (!article) return { title: "სიახლე ვერ მოიძებნა — ქართული რესპუბლიკა" };
  return {
    title: `${article.title} — ქართული რესპუბლიკა`,
    description: excerpt(article.body),
    openGraph: {
      type: "article",
      title: article.title,
      description: excerpt(article.body),
      images: [article.image_url ?? "/og-default.png"],
    },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await fetchPublicNewsBySlug(slug);
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/news" className="text-sm font-semibold text-brand hover:underline">
        ← სიახლეები
      </Link>
      <article className="mt-6">
        <Eyebrow>{formatDateKa(article.published_at)}</Eyebrow>
        <h1 className="mt-1 font-serif text-4xl font-bold text-ink">{article.title}</h1>
        {article.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
          <img
            src={article.image_url}
            alt=""
            className="mt-6 w-full rounded-xl border border-line object-cover"
          />
        ) : null}
        <ContentBody body={article.body} className="mt-6" />
      </article>
    </main>
  );
}
```

- [ ] **Step 8: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green. Then `npm run dev` and open `http://localhost:3000/news` (staging is seeded from Task 8): 4 public articles, newest first, cover on the first; open one — paragraphs + a working link; a member-only slug under `/news/...` → 404. View source of an article: `og:title`, `og:description`, `og:image` present.

- [ ] **Step 9: Commit**

```bash
npm run format
git add lib/supabase/public.ts components/NewsCard.tsx components/NewsCard.test.tsx "app/(public)/news"
git commit -m "feat: public news list + article pages with OG tags"
```

---

### Task 11: Public events — `/events`, `/events/[slug]`

**Files:**
- Modify: `lib/supabase/public.ts`
- Create: `app/(public)/events/page.tsx`
- Create: `app/(public)/events/[slug]/page.tsx`

**Interfaces:**
- Consumes: `public_events` view, `splitEvents`/`formatEventTimeKa`/`eventEndIso` (Task 3), `ContentBody`, `ButtonLink`, `Pill`, `contentPill` (Task 5).
- Produces (consumed by Tasks 14, 20):
  - `interface PublicEventItem { id: string; slug: string; title: string; description: string; location: string; starts_at: string; ends_at: string | null; status: "published" | "cancelled"; published_at: string }`
  - `fetchPublicEvents(): Promise<PublicEventItem[]>`, `fetchPublicEventBySlug(slug: string): Promise<PublicEventItem | null>`
- No attendee counts anywhere here (decision #8); the RSVP CTA is one static link for every visitor (session-agnostic cached shell).

- [ ] **Step 1: Add the fetchers to `lib/supabase/public.ts`**

```ts
export interface PublicEventItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  status: "published" | "cancelled";
  published_at: string;
}

export async function fetchPublicEvents(): Promise<PublicEventItem[]> {
  const { data, error } = await publicClient()
    .from("public_events")
    .select("*")
    .returns<PublicEventItem[]>();
  if (error) throw new Error(`public_events: ${error.message}`);
  return data ?? [];
}

export async function fetchPublicEventBySlug(slug: string): Promise<PublicEventItem | null> {
  const { data, error } = await publicClient()
    .from("public_events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<PublicEventItem>();
  if (error) throw new Error(`public_events by slug: ${error.message}`);
  return data;
}
```

- [ ] **Step 2: Create `app/(public)/events/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { cardSkin } from "@/components/Card";
import { contentPill } from "@/lib/admin";
import { formatEventTimeKa, splitEvents } from "@/lib/community";
import { fetchPublicEvents, type PublicEventItem } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ღონისძიებები — ქართული რესპუბლიკა",
  description: "მოძრაობის შეხვედრები და ღონისძიებები.",
  openGraph: { images: ["/og-default.png"] },
};

function EventRow({ event }: { event: PublicEventItem }) {
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

export default async function EventsPage() {
  const events = await fetchPublicEvents();
  const { upcoming, past } = splitEvents(events, new Date().toISOString());
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>ქართული რესპუბლიკა</Eyebrow>
      <h1 className="mt-1 font-serif text-4xl font-bold text-ink">ღონისძიებები</h1>

      <h2 className="mt-10 text-lg font-bold text-ink">მომავალი</h2>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-muted-fg">მომავალი ღონისძიებები მალე გამოცხადდება.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {upcoming.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      )}

      {past.length > 0 ? (
        <>
          <h2 className="mt-12 text-lg font-bold text-ink">გასული</h2>
          <div className="mt-3 flex flex-col gap-3">
            {past.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 3: Create `app/(public)/events/[slug]/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { ContentBody } from "@/components/ContentBody";
import { Eyebrow } from "@/components/Eyebrow";
import { excerpt } from "@/lib/content-render";
import { eventEndIso, formatEventTimeKa } from "@/lib/community";
import { fetchPublicEventBySlug, fetchPublicEvents } from "@/lib/supabase/public";

export const revalidate = 60;

export async function generateStaticParams() {
  const events = await fetchPublicEvents();
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchPublicEventBySlug(slug);
  if (!event) return { title: "ღონისძიება ვერ მოიძებნა — ქართული რესპუბლიკა" };
  return {
    title: `${event.title} — ქართული რესპუბლიკა`,
    description: `${formatEventTimeKa(event.starts_at, event.ends_at)} · ${event.location}`,
    openGraph: {
      title: event.title,
      description: excerpt(event.description),
      images: ["/og-default.png"],
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await fetchPublicEventBySlug(slug);
  if (!event) notFound();
  const isPast = new Date(eventEndIso(event)).getTime() < Date.now();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/events" className="text-sm font-semibold text-brand hover:underline">
        ← ღონისძიებები
      </Link>
      <article className="mt-6">
        <Eyebrow>{formatEventTimeKa(event.starts_at, event.ends_at)}</Eyebrow>
        <h1 className="mt-1 font-serif text-4xl font-bold text-ink">{event.title}</h1>
        <p className="mt-2 font-semibold text-muted-fg">{event.location}</p>

        {event.status === "cancelled" ? (
          <p className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 font-semibold text-danger">
            ღონისძიება გაუქმებულია
          </p>
        ) : null}

        <ContentBody body={event.description} className="mt-6" />

        {event.status === "published" && !isPast ? (
          <div className="mt-8">
            <ButtonLink href="/me/events">დასწრების აღნიშვნა კაბინეტში</ButtonLink>
          </div>
        ) : null}
        {event.status === "published" && isPast ? (
          <p className="mt-8 text-sm font-semibold text-muted-fg">ღონისძიება დასრულებულია.</p>
        ) : null}
      </article>
    </main>
  );
}
```

- [ ] **Step 4: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green. Dev server: `/events` shows 3 upcoming (one with the გაუქმებული pill) and 2 past; a cancelled event's page shows the banner and NO CTA; a past event says დასრულებულია; an upcoming one shows the cabinet CTA. No attendee numbers anywhere.

- [ ] **Step 5: Commit**

```bash
npm run format
git add lib/supabase/public.ts "app/(public)/events"
git commit -m "feat: public events list + detail with archive split and cancelled banner"
```

---

### Task 12: Transparency page + public nav

**Files:**
- Modify: `lib/supabase/public.ts`
- Create: `app/(public)/transparency/page.tsx`
- Modify: `app/(public)/layout.tsx` (the shared `nav` const feeds header AND footer)

**Interfaces:**
- Consumes: `transparency_stats`, `transparency_regions` views; `StatCard`, `Card`, `Eyebrow`; `formatCountKa` (lib/format).
- Produces: `fetchTransparencyStats(): Promise<TransparencyStats>`, `fetchTransparencyRegions(): Promise<TransparencyRegion[]>`.
- Spec §3.3 microcopy is owner-approved — byte-exact, Georgian quotes included.

- [ ] **Step 1: Add the fetchers to `lib/supabase/public.ts`**

```ts
export interface TransparencyStats {
  total_gel: number;
  registered_members: number;
  approved_delegates: number;
}

export interface TransparencyRegion {
  region_id: number;
  name_ka: string;
  registered: number;
  active: number;
}

export async function fetchTransparencyStats(): Promise<TransparencyStats> {
  const { data, error } = await publicClient()
    .from("transparency_stats")
    .select("*")
    .single<TransparencyStats>();
  if (error) throw new Error(`transparency_stats: ${error.message}`);
  if (!data) throw new Error("transparency_stats: empty response");
  return data;
}

export async function fetchTransparencyRegions(): Promise<TransparencyRegion[]> {
  const { data, error } = await publicClient()
    .from("transparency_regions")
    .select("*")
    .returns<TransparencyRegion[]>();
  if (error) throw new Error(`transparency_regions: ${error.message}`);
  return data ?? [];
}
```

- [ ] **Step 2: Create `app/(public)/transparency/page.tsx`** — the approved §3.3 content, exactly:

```tsx
import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { StatCard } from "@/components/StatCard";
import { formatCountKa } from "@/lib/format";
import { fetchTransparencyRegions, fetchTransparencyStats } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "გამჭვირვალობა — ქართული რესპუბლიკა",
  description: "ღია მონაცემები მოძრაობის წევრობასა და შემოსავლებზე — პირდაპირ რეესტრიდან.",
  openGraph: { images: ["/og-default.png"] },
};

export default async function TransparencyPage() {
  const [stats, regionsRaw] = await Promise.all([
    fetchTransparencyStats(),
    fetchTransparencyRegions(),
  ]);
  // codepoint compare, not localeCompare: mkhedruli is codepoint-alphabetical and
  // Node/browser ICU disagreements have broken ka-GE rendering before (DECISIONS)
  const regions = [...regionsRaw].sort(
    (a, b) => b.registered - a.registered || (a.name_ka < b.name_ka ? -1 : 1),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>ქართული რესპუბლიკა</Eyebrow>
      <h1 className="mt-1 font-serif text-4xl font-bold text-ink">გამჭვირვალობა</h1>
      <p className="mt-3 max-w-2xl text-muted-fg">
        ღია მონაცემები მოძრაობის წევრობასა და შემოსავლებზე — პირდაპირ რეესტრიდან.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          value={`${formatCountKa(Math.round(stats.total_gel))} ₾`}
          label="შეგროვებული საწევრო შენატანები"
          sub="სულ, დაარსებიდან"
        />
        <StatCard value={formatCountKa(stats.registered_members)} label="რეგისტრირებული წევრი" />
        <StatCard value={formatCountKa(stats.approved_delegates)} label="დამტკიცებული დელეგატი" />
      </div>

      <div className="mt-10">
        <Card title="წევრები რეგიონების მიხედვით" padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold text-muted-fg">
                <th className="px-5 py-3">რეგიონი</th>
                <th className="px-5 py-3 text-right">რეგისტრირებული</th>
                <th className="px-5 py-3 text-right">აქტიური</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.region_id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-semibold text-ink">{r.name_ka}</td>
                  <td className="px-5 py-3 text-right">{formatCountKa(r.registered)}</td>
                  <td className="px-5 py-3 text-right">{formatCountKa(r.active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-fg">
        მონაცემები გამოითვლება ავტომატურად: შენატანები — აღრიცხული საბანკო გადარიცხვებიდან,
        წევრობა — რეგისტრაციის რეესტრიდან. გვერდი ახლდება უწყვეტად.
      </p>
    </main>
  );
}
```

If `StatCard`'s props differ (open `components/StatCard.tsx` first — Phase 1 signature is `value`/`label`, `sub` added later), pass exactly its real prop names; never restyle it.

- [ ] **Step 3: Add the three public nav links — `app/(public)/layout.tsx`**

Replace the `nav` const:

```tsx
const nav = [
  { href: "/", label: "მთავარი" },
  { href: "/delegates", label: "დელეგატები" },
  { href: "/leaderboard", label: "რეიტინგი" },
  { href: "/news", label: "სიახლეები" },
  { href: "/events", label: "ღონისძიებები" },
  { href: "/transparency", label: "გამჭვირვალობა" },
] as const;
```

(Header and footer both map this const — one edit covers both. The header already flex-wraps.)

- [ ] **Step 4: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green (`public.spec.ts` e2e still passes in CI later — it asserts the header; if it enumerates nav links exactly, update it to the new six as part of this task).
Dev server: `/transparency` shows three counters with real seeded numbers, an 11-row region table (zeros included), the method note; header + footer show the three new links.

- [ ] **Step 5: Commit**

```bash
npm run format
git add lib/supabase/public.ts "app/(public)/transparency" "app/(public)/layout.tsx"
git commit -m "feat: transparency page (derived aggregates) + public nav links"
```

---

### Task 13: Cabinet news feed — `/me/news`, `/me/news/[slug]`

**Files:**
- Create: `app/(member)/me/news/page.tsx`
- Create: `app/(member)/me/news/[slug]/page.tsx`

**Interfaces:**
- Consumes: `member_news` view (per-request, cookie-bound `createServerSupabase`), `NewsCard` (Task 10), `ContentBody`, `Pill`, `excerpt`, `formatDateKa`. The `(member)/layout.tsx` gate + CabinetNav (Task 5 items) already wrap these routes.
- Member-only articles link INSIDE the cabinet; public ones link to their shareable public URL (spec §3.5). `/me/*` is NetworkOnly in the service worker — nothing here is ever cached.
- No new unit surface (all logic TDD'd in Tasks 1, 5); behavior locked by Task 9 probes + Task 21 e2e.

- [ ] **Step 1: Create `app/(member)/me/news/page.tsx`**

```tsx
import type { Metadata } from "next";
import { NewsCard } from "@/components/NewsCard";
import { Pill } from "@/components/Pill";
import { excerpt } from "@/lib/content-render";
import { formatDateKa } from "@/lib/cabinet";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "სიახლეები — ქართული რესპუბლიკა" };

export default async function MemberNewsPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("member_news")
    .select("*")
    .order("published_at", { ascending: false });
  if (error) throw new Error(`member_news failed: ${error.message}`);
  const items = data ?? [];

  return (
    <main>
      <h1 className="text-2xl font-bold text-ink">სიახლეები</h1>
      <p className="mt-1 text-sm text-muted-fg">
        მოძრაობის სიახლეები — წევრებისთვის განკუთვნილი მასალების ჩათვლით.
      </p>
      {items.length === 0 ? (
        <p className="mt-8 text-muted-fg">სიახლეები მალე გამოჩნდება.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {items.map((n) => (
            <NewsCard
              key={n.id}
              href={n.visibility === "members" ? `/me/news/${n.slug}` : `/news/${n.slug}`}
              title={n.title}
              publishedAt={formatDateKa(n.published_at)}
              imageUrl={n.image_url}
              excerptText={excerpt(n.body)}
              pill={
                n.visibility === "members" ? (
                  <Pill status="profile_completed" label="წევრებისთვის" />
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create `app/(member)/me/news/[slug]/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBody } from "@/components/ContentBody";
import { Pill } from "@/components/Pill";
import { formatDateKa } from "@/lib/cabinet";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "სიახლე — ქართული რესპუბლიკა" };

export default async function MemberArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const { data: article, error } = await supabase
    .from("member_news")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`member_news by slug failed: ${error.message}`);
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-3xl">
      <Link href="/me/news" className="text-sm font-semibold text-brand hover:underline">
        ← სიახლეები
      </Link>
      <article className="mt-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted-fg">
          <span>{formatDateKa(article.published_at)}</span>
          {article.visibility === "members" ? (
            <Pill status="profile_completed" label="წევრებისთვის" />
          ) : null}
        </div>
        <h1 className="mt-2 text-3xl font-bold text-ink">{article.title}</h1>
        {article.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
          <img
            src={article.image_url}
            alt=""
            className="mt-6 w-full rounded-xl border border-line object-cover"
          />
        ) : null}
        <ContentBody body={article.body} className="mt-6" />
      </article>
    </main>
  );
}
```

(Calm register: sans-serif heading — `font-serif` display type is the PUBLIC register only.)

- [ ] **Step 3: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green. Dev server, logged in as a seeded completed member: `/me/news` shows public + member-only articles (pill on the member-only one); the member-only article opens under `/me/news/…`; the same slug under `/news/…` is a 404; logged out, `/me/news` bounces to `/login` (existing layout gate).

- [ ] **Step 4: Commit**

```bash
npm run format
git add "app/(member)/me/news"
git commit -m "feat: cabinet news feed with member-only articles"
```

---

### Task 14: Cabinet events + RSVP — `/me/events`

**Files:**
- Create: `app/(member)/me/events/page.tsx`
- Create: `app/(member)/me/events/EventRsvp.tsx`
- Create: `app/(member)/me/events/EventRsvp.test.tsx`
- Create: `app/(member)/me/events/actions.ts`

**Interfaces:**
- Consumes: `public_events` + `member_event_going_counts` + own-row `event_rsvps` reads; `member_rsvp` RPC; `splitEvents`/`rsvpOpen`/`formatEventTimeKa` (Task 3); `rsvpInputSchema` (Task 4); `mapFunnelError`; `Card`, `Pill`, `Button`, `contentPill`.
- Produces (consumed by Task 22 e2e): `rsvpAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }>`; testids `rsvp-<eventId>` on the control block, buttons named მოვალ / გაუქმება, status text „✓ შენ მოდიხარ", lock text „რეგისტრაცია დახურულია", count line „სულ მოდის N წევრი".

- [ ] **Step 1: Write the failing component test — `app/(member)/me/events/EventRsvp.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rsvpMock = vi.fn();
vi.mock("./actions", () => ({ rsvpAction: (input: unknown) => rsvpMock(input) }));
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { EventRsvp } from "./EventRsvp";

const EVENT_ID = "6f1b0a9e-0000-4000-8000-00000000000e";

describe("EventRsvp", () => {
  beforeEach(() => {
    rsvpMock.mockReset();
    refreshMock.mockReset();
  });

  it("shows მოვალ when not RSVPed and submits going=true", async () => {
    rsvpMock.mockResolvedValue({ ok: true });
    render(<EventRsvp eventId={EVENT_ID} status={null} open />);
    fireEvent.click(screen.getByRole("button", { name: "მოვალ" }));
    await waitFor(() =>
      expect(rsvpMock).toHaveBeenCalledWith({ eventId: EVENT_ID, going: true }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("shows the going state with a cancel toggle", async () => {
    rsvpMock.mockResolvedValue({ ok: true });
    render(<EventRsvp eventId={EVENT_ID} status="going" open />);
    expect(screen.getByText("✓ შენ მოდიხარ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "გაუქმება" }));
    await waitFor(() =>
      expect(rsvpMock).toHaveBeenCalledWith({ eventId: EVENT_ID, going: false }),
    );
  });

  it("renders the lock text instead of controls when closed", () => {
    render(<EventRsvp eventId={EVENT_ID} status="going" open={false} />);
    expect(screen.getByText("რეგისტრაცია დახურულია")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("surfaces the server's Georgian error inline", async () => {
    rsvpMock.mockResolvedValue({ ok: false, error: "რეგისტრაცია ამ ღონისძიებაზე დახურულია." });
    render(<EventRsvp eventId={EVENT_ID} status={null} open />);
    fireEvent.click(screen.getByRole("button", { name: "მოვალ" }));
    expect(await screen.findByText("რეგისტრაცია ამ ღონისძიებაზე დახურულია.")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "app/(member)/me/events/EventRsvp.test.tsx"`
Expected: FAIL — `Cannot find module './EventRsvp'`

- [ ] **Step 3: Implement `app/(member)/me/events/actions.ts`**

```ts
"use server";

import { rsvpInputSchema } from "@/lib/content-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type RsvpResult = { ok: true } | { ok: false; error: string };

/** Thin action in front of member_rsvp (ADR-009 envelope: the RPC re-validates everything). */
export async function rsvpAction(input: unknown): Promise<RsvpResult> {
  const parsed = rsvpInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("member_rsvp", {
    p_event_id: parsed.data.eventId,
    p_going: parsed.data.going,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true };
}
```

- [ ] **Step 4: Implement `app/(member)/me/events/EventRsvp.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { rsvpAction } from "./actions";

export function EventRsvp({
  eventId,
  status,
  open,
}: {
  eventId: string;
  status: "going" | "cancelled" | null;
  open: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return <p className="text-sm font-semibold text-muted-fg">რეგისტრაცია დახურულია</p>;
  }
  const going = status === "going";

  function submit(next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await rsvpAction({ eventId, going: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2" data-testid={`rsvp-${eventId}`}>
      <div className="flex items-center gap-3">
        {going ? (
          <>
            <span className="text-sm font-semibold text-ok">✓ შენ მოდიხარ</span>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => submit(false)}>
              გაუქმება
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => submit(true)}>
            მოვალ
          </Button>
        )}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
```

(Open `components/Button.tsx` first: if `disabled` isn't a supported prop or variants differ, follow its real API — never restyle.)

- [ ] **Step 5: Run to verify the component test passes**

Run: `npx vitest run "app/(member)/me/events/EventRsvp.test.tsx"`
Expected: PASS

- [ ] **Step 6: Create `app/(member)/me/events/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa, rsvpOpen, splitEvents } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventRsvp } from "./EventRsvp";

export const metadata: Metadata = { title: "ღონისძიებები — ქართული რესპუბლიკა" };

export default async function MemberEventsPage() {
  const supabase = await createServerSupabase();
  const [eventsRes, countsRes, mineRes] = await Promise.all([
    supabase.from("public_events").select("*"),
    supabase.from("member_event_going_counts").select("*"),
    supabase.from("event_rsvps").select("event_id, status"),
  ]);
  if (eventsRes.error) throw new Error(`public_events failed: ${eventsRes.error.message}`);
  if (countsRes.error) throw new Error(`going counts failed: ${countsRes.error.message}`);
  if (mineRes.error) throw new Error(`own rsvps failed: ${mineRes.error.message}`);

  const nowIso = new Date().toISOString();
  const goingByEvent = new Map((countsRes.data ?? []).map((c) => [c.event_id, c.going]));
  const myStatusByEvent = new Map((mineRes.data ?? []).map((r) => [r.event_id, r.status]));
  const { upcoming, past } = splitEvents(eventsRes.data ?? [], nowIso);

  return (
    <main>
      <h1 className="text-2xl font-bold text-ink">ღონისძიებები</h1>
      <p className="mt-1 text-sm text-muted-fg">აღნიშნე დასწრება — გუნდი შენზეა დამოკიდებული.</p>

      <div className="mt-6 flex flex-col gap-4">
        {upcoming.length === 0 ? (
          <p className="text-muted-fg">მომავალი ღონისძიებები მალე გამოცხადდება.</p>
        ) : (
          upcoming.map((e) => (
            <Card key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-muted-fg">
                    {formatEventTimeKa(e.starts_at, e.ends_at)} · {e.location}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-ink">{e.title}</h3>
                  <p className="mt-1 text-sm text-muted-fg">
                    სულ მოდის {formatCountKa(goingByEvent.get(e.id) ?? 0)} წევრი
                  </p>
                </div>
                {e.status === "cancelled" ? <Pill {...contentPill("cancelled")} /> : null}
              </div>
              <div className="mt-4">
                <EventRsvp
                  eventId={e.id}
                  status={myStatusByEvent.get(e.id) ?? null}
                  open={rsvpOpen(e, nowIso)}
                />
              </div>
            </Card>
          ))
        )}
      </div>

      {past.length > 0 ? (
        <>
          <h2 className="mt-10 text-lg font-bold text-ink">გასული</h2>
          <div className="mt-3 flex flex-col gap-2">
            {past.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm"
              >
                <span className="font-semibold text-muted-fg">
                  {formatEventTimeKa(e.starts_at, e.ends_at)}
                </span>
                <span className="font-semibold text-ink">{e.title}</span>
                {myStatusByEvent.get(e.id) === "going" ? (
                  <span className="text-xs font-semibold text-ok">დაესწარი ✓</span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 7: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green. Dev server as a completed member: upcoming events show the count + მოვალ; clicking flips to „✓ შენ მოდიხარ · გაუქმება" and the count grows by one after refresh; the cancelled event shows its pill with „რეგისტრაცია დახურულია"; past events are compact rows.

- [ ] **Step 8: Commit**

```bash
npm run format
git add "app/(member)/me/events"
git commit -m "feat: cabinet events with RSVP toggle and internal going counts"
```

---

### Task 15: Cabinet polls — `/me/polls`

**Files:**
- Create: `app/(member)/me/polls/page.tsx`
- Create: `app/(member)/me/polls/PollCard.tsx`
- Create: `app/(member)/me/polls/PollCard.test.tsx`
- Create: `app/(member)/me/polls/actions.ts`

**Interfaces:**
- Consumes: `member_polls` + `member_poll_options` + `poll_option_counts` + own-row `poll_votes` reads; `member_cast_vote` RPC; `pollView`/`percentages`/`formatEventTimeKa` (Task 3); `voteInputSchema`; `formatCountKa`; `Card`, `Button`.
- Produces (consumed by Task 23 e2e): `voteAction(input): Promise<{ ok: true } | { ok: false; error: string }>`; testid `poll-<pollId>` per card; option buttons named by label; voted line „✓ შენ უკვე მიეცი ხმა · სულ N ხმა"; closed line „გამოკითხვა დასრულებულია · სულ N ხმა"; deadline line „ბოლო ვადა: <time>".
- UX contract = prototype `me-polls` (page head copy, ghost block option buttons, result bars) with the approved deviations (inline errors, closed-state results for everyone).

- [ ] **Step 1: Write the failing component test — `app/(member)/me/polls/PollCard.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const voteMock = vi.fn();
vi.mock("./actions", () => ({ voteAction: (input: unknown) => voteMock(input) }));
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { PollCard } from "./PollCard";

const POLL_ID = "6f1b0a9e-0000-4000-8000-0000000000aa";
const OPT_A = "6f1b0a9e-0000-4000-8000-0000000000a1";
const OPT_B = "6f1b0a9e-0000-4000-8000-0000000000a2";

describe("PollCard", () => {
  beforeEach(() => {
    voteMock.mockReset();
    refreshMock.mockReset();
  });

  it("buttons view: one ghost button per option, vote submits", async () => {
    voteMock.mockResolvedValue({ ok: true });
    render(
      <PollCard
        pollId={POLL_ID}
        question="პრიორიტეტი?"
        view="buttons"
        deadlineKa="ბოლო ვადა: 29.07.2026, 12:00"
        options={[
          { optionId: OPT_A, label: "დიახ", pct: 0, votes: 0, mine: false },
          { optionId: OPT_B, label: "არა", pct: 0, votes: 0, mine: false },
        ]}
        total={0}
      />,
    );
    expect(screen.getByText("ბოლო ვადა: 29.07.2026, 12:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "დიახ" }));
    await waitFor(() =>
      expect(voteMock).toHaveBeenCalledWith({ pollId: POLL_ID, optionId: OPT_A }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("results-own view: bars with percentages, own choice marked, total line", () => {
    render(
      <PollCard
        pollId={POLL_ID}
        question="პრიორიტეტი?"
        view="results-own"
        deadlineKa={null}
        options={[
          { optionId: OPT_A, label: "დიახ", pct: 67, votes: 2, mine: true },
          { optionId: OPT_B, label: "არა", pct: 33, votes: 1, mine: false },
        ]}
        total={3}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText(/შენი არჩევანი/)).toBeInTheDocument();
    expect(screen.getByText("✓ შენ უკვე მიეცი ხმა · სულ 3 ხმა")).toBeInTheDocument();
  });

  it("results-closed view: bars for everyone, closed line", () => {
    render(
      <PollCard
        pollId={POLL_ID}
        question="დახურული?"
        view="results-closed"
        deadlineKa={null}
        options={[{ optionId: OPT_A, label: "დიახ", pct: 100, votes: 5, mine: false }]}
        total={5}
      />,
    );
    expect(screen.getByText("გამოკითხვა დასრულებულია · სულ 5 ხმა")).toBeInTheDocument();
  });

  it("surfaces the server error inline and keeps the buttons", async () => {
    voteMock.mockResolvedValue({ ok: false, error: "გამოკითხვა დახურულია." });
    render(
      <PollCard
        pollId={POLL_ID}
        question="გვიანი?"
        view="buttons"
        deadlineKa={null}
        options={[{ optionId: OPT_A, label: "დიახ", pct: 0, votes: 0, mine: false }]}
        total={0}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "დიახ" }));
    expect(await screen.findByText("გამოკითხვა დახურულია.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "დიახ" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "app/(member)/me/polls/PollCard.test.tsx"`
Expected: FAIL — `Cannot find module './PollCard'`

- [ ] **Step 3: Implement `app/(member)/me/polls/actions.ts`**

```ts
"use server";

import { voteInputSchema } from "@/lib/content-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type VoteResult = { ok: true } | { ok: false; error: string };

/** Thin action in front of member_cast_vote — the PK makes double votes impossible. */
export async function voteAction(input: unknown): Promise<VoteResult> {
  const parsed = voteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("member_cast_vote", {
    p_poll_id: parsed.data.pollId,
    p_option_id: parsed.data.optionId,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true };
}
```

- [ ] **Step 4: Implement `app/(member)/me/polls/PollCard.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { formatCountKa } from "@/lib/format";
import type { PollViewState } from "@/lib/community";
import { voteAction } from "./actions";

export interface PollCardOption {
  optionId: string;
  label: string;
  pct: number;
  votes: number;
  mine: boolean;
}

export function PollCard({
  pollId,
  question,
  view,
  deadlineKa,
  options,
  total,
}: {
  pollId: string;
  question: string;
  view: PollViewState;
  deadlineKa: string | null;
  options: PollCardOption[];
  total: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function vote(optionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await voteAction({ pollId, optionId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div data-testid={`poll-${pollId}`}>
      <Card title={question}>
        {deadlineKa ? <p className="mb-3 text-xs font-semibold text-muted-fg">{deadlineKa}</p> : null}

        {view === "buttons" ? (
          <div className="flex flex-col gap-2.5">
            {options.map((o) => (
              <Button
                key={o.optionId}
                variant="ghost"
                disabled={pending}
                onClick={() => vote(o.optionId)}
                className="w-full justify-start"
              >
                {o.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {options.map((o) => (
              <div key={o.optionId}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">
                    {o.label}
                    {o.mine ? (
                      <span className="ms-2 text-xs font-semibold text-brand">
                        ✓ შენი არჩევანი
                      </span>
                    ) : null}
                  </span>
                  <span className="font-semibold text-muted-fg">{o.pct}%</span>
                </div>
                <div className="overflow-hidden rounded-md bg-surface">
                  <div className="h-2.5 rounded-md bg-brand" style={{ width: `${o.pct}%` }} />
                </div>
              </div>
            ))}
            <p className="mt-1 text-xs text-muted-fg">
              {view === "results-closed"
                ? `გამოკითხვა დასრულებულია · სულ ${formatCountKa(total)} ხმა`
                : `✓ შენ უკვე მიეცი ხმა · სულ ${formatCountKa(total)} ხმა`}
            </p>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>
    </div>
  );
}
```

(If `Button` doesn't accept `className` merging for `w-full justify-start`, wrap in a full-width div per its real API — check `components/Button.tsx` first; DESIGN.md forbids padding/size classes, not width/justify utilities. If even that is off-pattern, use the block-button layout the prototype shows via a plain flex column of default ghost Buttons.)

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run "app/(member)/me/polls/PollCard.test.tsx"`
Expected: PASS

- [ ] **Step 6: Create `app/(member)/me/polls/page.tsx`**

```tsx
import type { Metadata } from "next";
import { formatEventTimeKa, percentages, pollView } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";
import { PollCard, type PollCardOption } from "./PollCard";

export const metadata: Metadata = { title: "შიდა გამოკითხვები — ქართული რესპუბლიკა" };

export default async function MemberPollsPage() {
  const supabase = await createServerSupabase();
  const [pollsRes, optionsRes, countsRes, mineRes] = await Promise.all([
    supabase.from("member_polls").select("*"),
    supabase.from("member_poll_options").select("*").order("position"),
    supabase.from("poll_option_counts").select("*"),
    supabase.from("poll_votes").select("poll_id, option_id"),
  ]);
  if (pollsRes.error) throw new Error(`member_polls failed: ${pollsRes.error.message}`);
  if (optionsRes.error) throw new Error(`member_poll_options failed: ${optionsRes.error.message}`);
  if (countsRes.error) throw new Error(`poll_option_counts failed: ${countsRes.error.message}`);
  if (mineRes.error) throw new Error(`own votes failed: ${mineRes.error.message}`);

  const votesByOption = new Map(
    (countsRes.data ?? []).map((c) => [`${c.poll_id}:${c.option_id}`, c.votes]),
  );
  const myVoteByPoll = new Map((mineRes.data ?? []).map((v) => [v.poll_id, v.option_id]));

  const polls = [...(pollsRes.data ?? [])].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    const aAt = a.opened_at ?? "";
    const bAt = b.opened_at ?? "";
    return bAt.localeCompare(aAt);
  });

  return (
    <main>
      <h1 className="text-2xl font-bold text-ink">შიდა გამოკითხვები</h1>
      <p className="mt-1 text-sm text-muted-fg">
        მიიღე მონაწილეობა მოძრაობის შიდა გადაწყვეტილებებში.
      </p>

      <div className="mt-6 flex max-w-3xl flex-col gap-5">
        {polls.length === 0 ? (
          <p className="text-muted-fg">გამოკითხვები მალე გამოჩნდება.</p>
        ) : (
          polls.map((poll) => {
            const pollOptions = (optionsRes.data ?? []).filter((o) => o.poll_id === poll.id);
            const counts = pollOptions.map(
              (o) => votesByOption.get(`${poll.id}:${o.option_id}`) ?? 0,
            );
            const pcts = percentages(counts);
            const myOption = myVoteByPoll.get(poll.id);
            const options: PollCardOption[] = pollOptions.map((o, i) => ({
              optionId: o.option_id,
              label: o.label,
              pct: pcts[i] ?? 0,
              votes: counts[i] ?? 0,
              mine: o.option_id === myOption,
            }));
            return (
              <PollCard
                key={poll.id}
                pollId={poll.id}
                question={poll.question}
                view={pollView(poll.status, myOption !== undefined)}
                deadlineKa={
                  poll.status === "open" && poll.ends_at
                    ? `ბოლო ვადა: ${formatEventTimeKa(poll.ends_at, null)}`
                    : null
                }
                options={options}
                total={counts.reduce((s, v) => s + v, 0)}
              />
            );
          })
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green. Dev server as a seeded member who has NOT voted: the untouched poll shows buttons (labels visible — the Task 6 `member_poll_options` guarantee); the open-with-votes poll shows buttons too (this member hasn't voted); the closed poll shows bars + „გამოკითხვა დასრულებულია". Vote on the untouched poll → bars + „✓ შენ უკვე მიეცი ხმა" + your choice marked. Reload — state persists.

- [ ] **Step 8: Commit**

```bash
npm run format
git add "app/(member)/me/polls"
git commit -m "feat: cabinet polls — prototype voting UX on the real one-vote constraint"
```

---

### Task 16: Delegate team RSVP overview

**Files:**
- Modify: `lib/community.ts` (RPC mirror types)
- Create: `app/(delegate)/delegate/TeamRsvpCard.tsx`
- Create: `app/(delegate)/delegate/TeamRsvpCard.test.tsx`
- Modify: `app/(delegate)/delegate/page.tsx`

**Interfaces:**
- Consumes: `delegate_team_rsvps()` RPC (Task 6), `formatEventTimeKa`, `formatCountKa`, `Card`.
- Deliberate scope: the overview lists PUBLISHED upcoming events only (the RPC filters `status = 'published'`) — a cancelled event's attendance is operationally moot, so it drops off the delegate's list while the member cabinet still shows the cancelled card (pill, no controls). Intentional asymmetry, per review.
- Produces:
  - `interface TeamRsvpName { firstName: string; lastName: string }`
  - `interface TeamRsvpEvent { eventId: string; title: string; startsAt: string; goingCount: number; going: TeamRsvpName[] }` (mirrors the RPC jsonb exactly — DelegatePanelData precedent)
  - `<TeamRsvpCard events={TeamRsvpEvent[]} />` — testid `team-rsvp`, per-event „შენი გუნდიდან მოდის N", `<details>` disclosure with the names.

- [ ] **Step 1: Add the mirror types to `lib/community.ts`** (types only — no test needed):

```ts
/** Mirrors one delegate_team_rsvps() jsonb element (spec §4.5). */
export interface TeamRsvpName {
  firstName: string;
  lastName: string;
}

export interface TeamRsvpEvent {
  eventId: string;
  title: string;
  startsAt: string;
  goingCount: number;
  going: TeamRsvpName[];
}
```

- [ ] **Step 2: Write the failing component test — `app/(delegate)/delegate/TeamRsvpCard.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeamRsvpCard } from "./TeamRsvpCard";

describe("TeamRsvpCard", () => {
  it("renders one row per upcoming event with the team going count and names", () => {
    render(
      <TeamRsvpCard
        events={[
          {
            eventId: "e1",
            title: "საერთო კრება",
            startsAt: "2026-07-26T15:00:00.000Z",
            goingCount: 2,
            going: [
              { firstName: "ნინო", lastName: "ბერიძე" },
              { firstName: "გიორგი", lastName: "ლომიძე" },
            ],
          },
          { eventId: "e2", title: "ვორქშოპი", startsAt: "2026-08-02T15:00:00.000Z", goingCount: 0, going: [] },
        ]}
      />,
    );
    expect(screen.getByText("საერთო კრება")).toBeInTheDocument();
    expect(screen.getByText("შენი გუნდიდან მოდის 2")).toBeInTheDocument();
    expect(screen.getByText("ნინო ბერიძე")).toBeInTheDocument();
    expect(screen.getByText("შენი გუნდიდან მოდის 0")).toBeInTheDocument();
  });

  it("renders the empty state when there are no upcoming events", () => {
    render(<TeamRsvpCard events={[]} />);
    expect(screen.getByText("მომავალი ღონისძიებები ჯერ არ არის.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run "app/(delegate)/delegate/TeamRsvpCard.test.tsx"`
Expected: FAIL — `Cannot find module './TeamRsvpCard'`

- [ ] **Step 4: Implement `app/(delegate)/delegate/TeamRsvpCard.tsx`** (server component — props only):

```tsx
import { Card } from "@/components/Card";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa, type TeamRsvpEvent } from "@/lib/community";

export function TeamRsvpCard({ events }: { events: TeamRsvpEvent[] }) {
  return (
    <div data-testid="team-rsvp">
      <Card title="გუნდის RSVP">
        {events.length === 0 ? (
          <p className="text-sm text-muted-fg">მომავალი ღონისძიებები ჯერ არ არის.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {events.map((e) => (
              <div key={e.eventId} className="border-b border-line pb-4 last:border-0 last:pb-0">
                <p className="text-xs font-semibold text-muted-fg">
                  {formatEventTimeKa(e.startsAt, null)}
                </p>
                <p className="mt-0.5 font-bold text-ink">{e.title}</p>
                <p className="mt-1 text-sm text-muted-fg">
                  შენი გუნდიდან მოდის {formatCountKa(e.goingCount)}
                </p>
                {e.going.length > 0 ? (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-sm font-semibold text-brand">
                      ვინ მოდის
                    </summary>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
                      {e.going.map((n, i) => (
                        <li key={i}>
                          {n.firstName} {n.lastName}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run "app/(delegate)/delegate/TeamRsvpCard.test.tsx"`
Expected: PASS

- [ ] **Step 6: Mount it on the delegate panel — `app/(delegate)/delegate/page.tsx`**

In the APPROVED branch only (a pending/rejected delegate has no team surface — mirror where the existing team/stat cards render). Add to the panel's data fetching:

```tsx
import { TeamRsvpCard } from "./TeamRsvpCard";
import type { TeamRsvpEvent } from "@/lib/community";
```

…and, alongside the existing `delegate_panel` RPC call (extend the existing `Promise.all` if one is there):

```tsx
  const { data: teamRsvpsRaw, error: teamRsvpsError } =
    panel.status === "approved"
      ? await supabase.rpc("delegate_team_rsvps")
      : { data: null, error: null };
  if (teamRsvpsError) {
    throw new Error(`delegate_team_rsvps failed: ${teamRsvpsError.message}`);
  }
  const teamRsvps = (teamRsvpsRaw ?? []) as unknown as TeamRsvpEvent[];
```

…and render `<TeamRsvpCard events={teamRsvps} />` as the LAST card of the approved branch (after the existing team card). Follow the page's existing data-flow style; do not reorder the existing cards.

- [ ] **Step 7: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green. Dev server as a seeded approved delegate: the panel shows გუნდის RSVP with the two upcoming published events (cancelled one absent), per-event team counts matching the seed, and the names disclosure. Existing `delegate-panel.spec.ts` e2e must still pass in CI.

- [ ] **Step 8: Commit**

```bash
npm run format
git add lib/community.ts "app/(delegate)/delegate"
git commit -m "feat: delegate panel — team RSVP overview"
```

---

### Task 17: Admin content shell — hub layout, ContentNav, editor landing

**Files:**
- Create: `components/ContentNav.tsx`
- Create: `components/ContentNav.test.tsx`
- Create: `app/(admin)/admin/content/layout.tsx`
- Create: `app/(admin)/admin/content/page.tsx`
- Modify: `app/(admin)/admin/page.tsx`

**Interfaces:**
- Consumes: `getAdminRoles`, `hasAnyRole` (lib/admin), the `(admin)/layout.tsx` outer gate + AdminNav (the შიგთავსი tab arrived in Task 5).
- Produces: `/admin/content` hub — secondary nav over three sections; editor-only admins land here from `/admin`; non-content staff hitting `/admin/content` bounce to `/admin`.

- [ ] **Step 1: Write the failing component test — `components/ContentNav.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/content/events" }));

import { ContentNav } from "./ContentNav";

describe("ContentNav", () => {
  it("renders the three sections and marks the active one", () => {
    render(<ContentNav />);
    expect(screen.getByRole("link", { name: "სიახლეები" })).toHaveAttribute(
      "href",
      "/admin/content/news",
    );
    expect(screen.getByRole("link", { name: "ღონისძიებები" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "გამოკითხვები" })).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/ContentNav.test.tsx`
Expected: FAIL — `Cannot find module './ContentNav'`

- [ ] **Step 3: Implement `components/ContentNav.tsx`** (AdminNav's link styling, no sign-out — it's a secondary nav inside the admin shell):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/admin/content/news", label: "სიახლეები" },
  { href: "/admin/content/events", label: "ღონისძიებები" },
  { href: "/admin/content/polls", label: "გამოკითხვები" },
] as const;

export function ContentNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="შიგთავსის ნავიგაცია" className="mb-6 flex flex-wrap items-center gap-1">
      {SECTIONS.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              active ? "bg-brand/10 text-brand" : "text-muted-fg hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/ContentNav.test.tsx`
Expected: PASS

- [ ] **Step 5: Create `app/(admin)/admin/content/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { ContentNav } from "@/components/ContentNav";
import { hasAnyRole } from "@/lib/admin";
import { getAdminRoles } from "@/lib/supabase/server";

/**
 * Content gate (spec §3.7): editor | super_admin. The outer (admin) layout has
 * already required a session + ≥1 admin role; the DB re-checks every read
 * (admin_* content views) and mutation (RPC role checks) regardless.
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["editor", "super_admin"])) redirect("/admin");
  return (
    <div>
      <ContentNav />
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Create `app/(admin)/admin/content/page.tsx`** (hub index → first section):

```tsx
import { redirect } from "next/navigation";

export default function ContentIndexPage() {
  redirect("/admin/content/news");
}
```

- [ ] **Step 7: Modify `app/(admin)/admin/page.tsx`** — the editor-only branch stops apologizing and starts working. Replace the `CenteredNotice` block inside `if (!isStaff(roles)) { … }` with:

```tsx
  if (!isStaff(roles)) {
    // editor-only admins live in the content hub (spec §3.7)
    redirect("/admin/content");
  }
```

Add `redirect` to the page's `next/navigation` import; remove the now-unused `CenteredNotice` import (and its decoration constant if any). Nothing else on the page changes.

- [ ] **Step 8: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green. Dev server: log in as canonical editor (+995509000004) → lands on `/admin/content/news` (via `/admin` redirect + hub index); AdminNav shows exactly შიგთავსი; canonical verifier browsing to `/admin/content` bounces to `/admin`; super_admin sees all tabs incl. შიგთავსი.

- [ ] **Step 9: Commit**

```bash
npm run format
git add components/ContentNav.tsx components/ContentNav.test.tsx "app/(admin)/admin/content" "app/(admin)/admin/page.tsx"
git commit -m "feat: admin content hub — shell, secondary nav, editor landing"
```

---

### Task 18: Admin news — list, form with live preview, publish lifecycle, cover upload

**Files:**
- Modify: `lib/admin.ts` (visibility labels)
- Create: `app/(admin)/admin/content/news/page.tsx`
- Create: `app/(admin)/admin/content/news/new/page.tsx`
- Create: `app/(admin)/admin/content/news/[id]/page.tsx`
- Create: `app/(admin)/admin/content/news/NewsForm.tsx`
- Create: `app/(admin)/admin/content/news/NewsForm.test.tsx`
- Create: `app/(admin)/admin/content/news/ArticleActions.tsx`
- Create: `app/(admin)/admin/content/news/CoverUpload.tsx`
- Create: `app/(admin)/admin/content/news/actions.ts`

**Interfaces:**
- Consumes: `admin_news` view; `admin_save_news` / `admin_publish_news` / `admin_unpublish_news` / `admin_delete_news` / `admin_set_news_image` RPCs; `newsFormSchema`, `contentIdSchema`; `makeSlugFrom` (fallback `"article"`); `ContentBody` (the SAME renderer the public page uses — that's what makes the preview honest); `PHOTO_TYPES`, `PHOTO_MAX_BYTES` (lib/admin-schemas — identical constraints for covers); `createAdminClient` (the ONE service-role path); `contentPill`, `adminControlClasses` (components/Field), `DataTable` + its cell classes, `Button`, `ButtonLink`.
- Produces:
  - `VISIBILITY_LABELS_KA: Record<"public" | "members", string>` in lib/admin.ts — `{ public: "საჯარო", members: "წევრებისთვის" }`
  - Actions: `saveNewsAction(input): Promise<{ ok: true; id: string } | { ok: false; error: string }>`, `publishNewsAction(id)`, `unpublishNewsAction(id)`, `deleteNewsAction(id)`, `setNewsCoverAction(formData)` — every mutation lands in `audit_log` via its RPC.
  - Testids for e2e (Task 21): form fields named სათაური / ტექსტი / ხილვადობა radios, buttons შენახვა / გამოქვეყნება / მოხსნა / წაშლა / დაადასტურე წაშლა, preview block `news-preview`.

- [ ] **Step 1: Add the labels to `lib/admin.ts`** (next to the other label records):

```ts
export const VISIBILITY_LABELS_KA: Record<"public" | "members", string> = {
  public: "საჯარო",
  members: "წევრებისთვის",
};
```

- [ ] **Step 2: Write the failing component test — `app/(admin)/admin/content/news/NewsForm.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
vi.mock("./actions", () => ({ saveNewsAction: (input: unknown) => saveMock(input) }));
const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { NewsForm } from "./NewsForm";

describe("NewsForm", () => {
  beforeEach(() => {
    saveMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("live preview renders the body through the real renderer", () => {
    render(<NewsForm article={null} />);
    fireEvent.change(screen.getByLabelText("ტექსტი"), {
      target: { value: "პირველი.\n\nმეორე https://a.ge ბმულით." },
    });
    const preview = screen.getByTestId("news-preview");
    expect(preview.querySelectorAll("p")).toHaveLength(2);
    expect(preview.querySelector("a")).toHaveAttribute("href", "https://a.ge");
  });

  it("creating: submits title/visibility/body and navigates to the editor", async () => {
    saveMock.mockResolvedValue({ ok: true, id: "new-id" });
    render(<NewsForm article={null} />);
    fireEvent.change(screen.getByLabelText("სათაური"), { target: { value: "ახალი" } });
    fireEvent.click(screen.getByLabelText("წევრებისთვის"));
    fireEvent.change(screen.getByLabelText("ტექსტი"), { target: { value: "ტანი" } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith({
        id: undefined,
        title: "ახალი",
        body: "ტანი",
        visibility: "members",
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/content/news/new-id"));
  });

  it("editing: prefills and refreshes on save", async () => {
    saveMock.mockResolvedValue({ ok: true, id: "a1" });
    render(
      <NewsForm
        article={{ id: "a1", title: "ძველი", body: "ტანი", visibility: "public" }}
      />,
    );
    expect(screen.getByLabelText("სათაური")).toHaveValue("ძველი");
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(await screen.findByText("შენახულია.")).toBeInTheDocument();
  });

  it("shows the server error inline", async () => {
    saveMock.mockResolvedValue({ ok: false, error: "სათაური არასწორია (1–160 სიმბოლო)." });
    render(<NewsForm article={null} />);
    fireEvent.change(screen.getByLabelText("სათაური"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("ტექსტი"), { target: { value: "y" } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    expect(await screen.findByText("სათაური არასწორია (1–160 სიმბოლო).")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run "app/(admin)/admin/content/news/NewsForm.test.tsx"`
Expected: FAIL — `Cannot find module './NewsForm'`

- [ ] **Step 4: Implement `app/(admin)/admin/content/news/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { hasAnyRole } from "@/lib/admin";
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/admin-schemas";
import { contentIdSchema, newsFormSchema } from "@/lib/content-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { makeSlugFrom } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export type SaveNewsResult = { ok: true; id: string } | { ok: false; error: string };
export type NewsActionResult = { ok: true } | { ok: false; error: string };

function revalidateNews(slug: string | null) {
  revalidatePath("/news");
  revalidatePath("/me/news");
  if (slug) revalidatePath(`/news/${slug}`);
}

export async function saveNewsAction(input: unknown): Promise<SaveNewsResult> {
  const parsed = newsFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_save_news", {
    p_id: parsed.data.id ?? null,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_visibility: parsed.data.visibility,
  });
  if (error || !data) return { ok: false, error: mapFunnelError(error?.message) };
  // an edit to an already-published article must reach the live pages
  const { data: row } = await supabase.from("admin_news").select("slug").eq("id", data).single();
  revalidateNews(row?.slug ?? null);
  return { ok: true, id: data };
}

/**
 * Publish mints the permanent slug (delegate-approval pattern: server computes
 * from the taken set scoped to this title's base, RPC enforces regex+uniqueness,
 * 23505 → refetch and retry).
 */
export async function publishNewsAction(id: unknown): Promise<NewsActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();

  const { data: article, error: articleError } = await supabase
    .from("admin_news")
    .select("title, slug")
    .eq("id", parsed.data.id)
    .single();
  if (articleError || !article) {
    return { ok: false, error: mapFunnelError(articleError?.message ?? "invalid_target") };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    let slug = article.slug;
    if (!slug) {
      const base = makeSlugFrom(article.title, "article", new Set());
      const { data: taken, error: takenError } = await supabase
        .from("admin_news")
        .select("slug")
        .like("slug", `${base}%`);
      if (takenError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
      const takenSet = new Set((taken ?? []).map((t) => t.slug).filter((s): s is string => !!s));
      slug = makeSlugFrom(article.title, "article", takenSet);
    }
    const { data, error } = await supabase.rpc("admin_publish_news", {
      p_id: parsed.data.id,
      p_slug: slug,
    });
    if (!error) {
      revalidateNews((data as { slug: string }).slug);
      return { ok: true };
    }
    if (error.code !== "23505") return { ok: false, error: mapFunnelError(error.message) };
  }
  return { ok: false, error: mapFunnelError("invalid_slug") };
}

export async function unpublishNewsAction(id: unknown): Promise<NewsActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("admin_news")
    .select("slug")
    .eq("id", parsed.data.id)
    .single();
  const { error } = await supabase.rpc("admin_unpublish_news", { p_id: parsed.data.id });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidateNews(row?.slug ?? null);
  return { ok: true };
}

export async function deleteNewsAction(id: unknown): Promise<NewsActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_delete_news", { p_id: parsed.data.id });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/content/news");
  return { ok: true };
}

/**
 * The ONE service-role path of this phase (spec §6): cover upload to the public
 * news-images bucket — app-side editor precheck + the re-checking audited RPC,
 * byte-for-byte the Phase 4 delegate-photo envelope.
 */
export async function setNewsCoverAction(formData: FormData): Promise<NewsActionResult> {
  const parsed = contentIdSchema.safeParse({ id: formData.get("newsId") });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["editor", "super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const supabase = await createServerSupabase();

  const { data: current, error: currentError } = await supabase
    .from("admin_news")
    .select("image_url, slug")
    .eq("id", parsed.data.id)
    .single();
  if (currentError || !current) return { ok: false, error: mapFunnelError("invalid_target") };

  const cover = formData.get("cover");
  if (!(cover instanceof File) || cover.size === 0) {
    return { ok: false, error: mapFunnelError("invalid_image") };
  }
  const ext = PHOTO_TYPES[cover.type];
  if (!ext) return { ok: false, error: "დაშვებულია მხოლოდ JPEG, PNG ან WebP სურათი." };
  if (cover.size > PHOTO_MAX_BYTES) {
    return { ok: false, error: "სურათი არ უნდა აღემატებოდეს 5 MB-ს." };
  }

  const admin = createAdminClient();
  // versioned filename — an updated cover must never serve stale from CDN caches
  const newPath = `${parsed.data.id}-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("news-images")
    .upload(newPath, await cover.arrayBuffer(), { contentType: cover.type });
  if (uploadError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const imageUrl = admin.storage.from("news-images").getPublicUrl(newPath).data.publicUrl;

  const { error: rpcError } = await supabase.rpc("admin_set_news_image", {
    p_id: parsed.data.id,
    p_image_url: imageUrl,
  });
  if (rpcError) {
    // the row never got the URL — remove the just-uploaded object (best-effort)
    await admin.storage.from("news-images").remove([newPath]);
    return { ok: false, error: mapFunnelError(rpcError.message) };
  }

  const marker = "/news-images/";
  const idx = current.image_url?.indexOf(marker) ?? -1;
  const oldPath = idx >= 0 ? (current.image_url as string).slice(idx + marker.length) : null;
  if (oldPath) {
    // best-effort — a stale object is harmless; the row already points at the new one
    await admin.storage.from("news-images").remove([oldPath]);
  }
  revalidateNews(current.slug);
  revalidatePath(`/admin/content/news/${parsed.data.id}`);
  return { ok: true };
}
```

- [ ] **Step 5: Implement `app/(admin)/admin/content/news/NewsForm.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ContentBody } from "@/components/ContentBody";
import { adminControlClasses } from "@/components/Field";
import { VISIBILITY_LABELS_KA } from "@/lib/admin";
import { saveNewsAction } from "./actions";

export interface EditableArticle {
  id: string;
  title: string;
  body: string;
  visibility: "public" | "members";
}

export function NewsForm({ article }: { article: EditableArticle | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [visibility, setVisibility] = useState<"public" | "members">(
    article?.visibility ?? "public",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveNewsAction({ id: article?.id, title, body, visibility });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!article) {
        router.push(`/admin/content/news/${result.id}`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          სათაური
          <input
            className={adminControlClasses}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
          />
        </label>

        <fieldset className="flex items-center gap-5 text-sm">
          <legend className="mb-1.5 font-semibold text-ink">ხილვადობა</legend>
          {(["public", "members"] as const).map((v) => (
            <label key={v} className="flex items-center gap-1.5 font-semibold text-muted-fg">
              <input
                type="radio"
                name="visibility"
                checked={visibility === v}
                onChange={() => setVisibility(v)}
              />
              {VISIBILITY_LABELS_KA[v]}
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          ტექსტი
          <textarea
            className={`${adminControlClasses} min-h-72 font-sans`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted-fg">
          ცარიელი ხაზი იწყებს ახალ აბზაცს; ბმულები ავტომატურად აქტიურდება.
        </p>

        <div className="flex items-center gap-3">
          <Button disabled={pending} onClick={submit}>
            შენახვა
          </Button>
          {saved ? <span className="text-sm font-semibold text-ok">შენახულია.</span> : null}
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-muted-fg">გადახედვა</p>
        <div data-testid="news-preview" className="rounded-xl border border-line p-5">
          {body.trim() === "" ? (
            <p className="text-sm text-muted-fg">ტექსტი ჯერ ცარიელია.</p>
          ) : (
            <ContentBody body={body} />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run to verify the form test passes**

Run: `npx vitest run "app/(admin)/admin/content/news/NewsForm.test.tsx"`
Expected: PASS

- [ ] **Step 7: Implement `app/(admin)/admin/content/news/ArticleActions.tsx`** (publish lifecycle, armed delete):

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { deleteNewsAction, publishNewsAction, unpublishNewsAction } from "./actions";

export function ArticleActions({
  id,
  status,
  everPublished,
}: {
  id: string;
  status: "draft" | "published";
  everPublished: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (after) after();
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {status === "draft" ? (
          <Button disabled={pending} onClick={() => run((i) => publishNewsAction(i))}>
            გამოქვეყნება
          </Button>
        ) : (
          <Button variant="ghost" disabled={pending} onClick={() => run((i) => unpublishNewsAction(i))}>
            მოხსნა
          </Button>
        )}
        {status === "draft" && !everPublished ? (
          armed ? (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => run((i) => deleteNewsAction(i), () => router.push("/admin/content/news"))}
            >
              დაადასტურე წაშლა
            </Button>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => setArmed(true)}>
              წაშლა
            </Button>
          )
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 8: Implement `app/(admin)/admin/content/news/CoverUpload.tsx`**

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { setNewsCoverAction } from "./actions";

export function CoverUpload({ newsId, imageUrl }: { newsId: string; imageUrl: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("აირჩიე ფაილი.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("newsId", newsId);
      formData.set("cover", file);
      const result = await setNewsCoverAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
        <img src={imageUrl} alt="" className="h-28 w-44 rounded-lg border border-line object-cover" />
      ) : (
        <p className="text-sm text-muted-fg">ყდა არ არის ატვირთული.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
        <Button variant="ghost" size="sm" disabled={pending} onClick={submit}>
          ყდის ატვირთვა
        </Button>
      </div>
      <p className="text-xs text-muted-fg">JPEG/PNG/WebP, მაქს. 5 MB. გამოჩნდება ბარათზე და OG სურათად.</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 9: Create the three pages**

`app/(admin)/admin/content/news/page.tsx` (list — dense register, admin table pattern):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { contentPill, VISIBILITY_LABELS_KA } from "@/lib/admin";
import { formatDateKa } from "@/lib/cabinet";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "შიგთავსი: სიახლეები — ქართული რესპუბლიკა" };

export default async function AdminNewsListPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("admin_news")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`admin_news failed: ${error.message}`);
  const rows = data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">სიახლეები</h1>
        <ButtonLink href="/admin/content/news/new" size="sm">
          ახალი სიახლე
        </ButtonLink>
      </div>
      <DataTable
        bodyTestId="admin-news-body"
        head={
          <>
            <th className={tableThClass}>სათაური</th>
            <th className={tableThClass}>ხილვადობა</th>
            <th className={tableThClass}>სტატუსი</th>
            <th className={tableThClass}>გამოქვეყნდა</th>
            <th className={tableThClass}></th>
          </>
        }
      >
        {rows.map((n) => (
          <tr key={n.id} className={tableRowClass}>
            <td className={`${tableCellClass} font-semibold text-ink`}>{n.title}</td>
            <td className={tableCellClass}>{VISIBILITY_LABELS_KA[n.visibility]}</td>
            <td className={tableCellClass}>
              <Pill {...contentPill(n.status)} />
            </td>
            <td className={tableCellClass}>
              {n.published_at ? formatDateKa(n.published_at) : "—"}
            </td>
            <td className={tableCellClass}>
              <Link
                href={`/admin/content/news/${n.id}`}
                className="font-semibold text-brand hover:underline"
              >
                რედაქტირება
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>
      {rows.length === 0 ? <p className="mt-4 text-sm text-muted-fg">ჯერ ცარიელია.</p> : null}
    </div>
  );
}
```

(This matches the REAL DataTable API — a required `head` prop taking the `<th>` fragment and bare `<tr>` rows as children; `app/(admin)/admin/audit/page.tsx` is the reference usage. Never pass `<thead>`/`<tbody>` as children — `head` is required and the component builds the table skeleton itself.)

`app/(admin)/admin/content/news/new/page.tsx`:

```tsx
import type { Metadata } from "next";
import { NewsForm } from "../NewsForm";

export const metadata: Metadata = { title: "ახალი სიახლე — ქართული რესპუბლიკა" };

export default function NewNewsPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-ink">ახალი სიახლე</h1>
      <NewsForm article={null} />
    </div>
  );
}
```

`app/(admin)/admin/content/news/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { ArticleActions } from "../ArticleActions";
import { CoverUpload } from "../CoverUpload";
import { NewsForm } from "../NewsForm";

export const metadata: Metadata = { title: "სიახლის რედაქტირება — ქართული რესპუბლიკა" };

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: article, error } = await supabase
    .from("admin_news")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`admin_news by id failed: ${error.message}`);
  if (!article) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-ink">სიახლის რედაქტირება</h1>
        <Pill {...contentPill(article.status)} />
        {article.slug && article.status === "published" ? (
          <a
            href={`/news/${article.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-brand hover:underline"
          >
            ნახე საიტზე ↗
          </a>
        ) : null}
      </div>

      <NewsForm
        article={{
          id: article.id,
          title: article.title,
          body: article.body,
          visibility: article.visibility,
        }}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-fg">ყდის სურათი</h2>
          <CoverUpload newsId={article.id} imageUrl={article.image_url} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-fg">მოქმედებები</h2>
          <ArticleActions
            id={article.id}
            status={article.status}
            everPublished={article.published_at !== null}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green. Dev server as editor: create a draft (lands on the editor page), preview matches the public renderer, upload a cover, publish → the article appears on `/news` immediately (revalidatePath) with the cover as OG image; member-only article publishes without appearing on `/news`; unpublish → public 404; a never-published draft deletes after arming; audit viewer (as super_admin) shows `news.save` / `news.publish` / `news.set_image` rows with Georgian labels.

- [ ] **Step 11: Commit**

```bash
npm run format
git add lib/admin.ts "app/(admin)/admin/content/news"
git commit -m "feat: admin news — list, live-preview form, publish lifecycle, audited cover upload"
```

---

### Task 19: Admin events — list, form, publish/cancel lifecycle

**Files:**
- Create: `app/(admin)/admin/content/events/page.tsx`
- Create: `app/(admin)/admin/content/events/new/page.tsx`
- Create: `app/(admin)/admin/content/events/[id]/page.tsx`
- Create: `app/(admin)/admin/content/events/EventForm.tsx`
- Create: `app/(admin)/admin/content/events/EventForm.test.tsx`
- Create: `app/(admin)/admin/content/events/EventActions.tsx`
- Create: `app/(admin)/admin/content/events/actions.ts`

**Interfaces:**
- Consumes: `admin_events` view; `admin_save_event` / `admin_publish_event` / `admin_cancel_event` / `admin_delete_event` RPCs; `eventFormSchema`, `contentIdSchema`; `tbilisiLocalToIso` / `isoToTbilisiLocal` / `formatEventTimeKa` (Task 3); `makeSlugFrom` (fallback `"event"`); `contentPill`, `adminControlClasses`, `DataTable`, `Button`, `ButtonLink`, `Pill`.
- Produces: `saveEventAction` (returns `{ ok: true; id }`), `publishEventAction`, `cancelEventAction`, `deleteEventAction`. Datetime fields travel as Tbilisi wall-time `"YYYY-MM-DDTHH:mm"` strings from the form; the ACTION converts to ISO with `tbilisiLocalToIso` before calling the RPC.

- [ ] **Step 1: Write the failing component test — `app/(admin)/admin/content/events/EventForm.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
vi.mock("./actions", () => ({ saveEventAction: (input: unknown) => saveMock(input) }));
const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { EventForm } from "./EventForm";

describe("EventForm", () => {
  beforeEach(() => {
    saveMock.mockReset();
    pushMock.mockReset();
  });

  it("creating: submits Tbilisi wall-time strings verbatim", async () => {
    saveMock.mockResolvedValue({ ok: true, id: "e-new" });
    render(<EventForm event={null} />);
    fireEvent.change(screen.getByLabelText("დასახელება"), { target: { value: "კრება" } });
    fireEvent.change(screen.getByLabelText("ადგილმდებარეობა"), { target: { value: "თბილისი" } });
    fireEvent.change(screen.getByLabelText("დაწყება"), { target: { value: "2026-08-01T19:00" } });
    fireEvent.change(screen.getByLabelText("აღწერა"), { target: { value: "დღის წესრიგი." } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith({
        id: undefined,
        title: "კრება",
        description: "დღის წესრიგი.",
        location: "თბილისი",
        startsAt: "2026-08-01T19:00",
        endsAt: "",
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/content/events/e-new"));
  });

  it("editing: prefills the datetime-local values it was given", () => {
    render(
      <EventForm
        event={{
          id: "e1",
          title: "ძველი",
          description: "აღწერა",
          location: "ქუთაისი",
          startsAtLocal: "2026-08-01T19:00",
          endsAtLocal: "2026-08-01T21:00",
        }}
      />,
    );
    expect(screen.getByLabelText("დაწყება")).toHaveValue("2026-08-01T19:00");
    expect(screen.getByLabelText("დასრულება (არასავალდებულო)")).toHaveValue("2026-08-01T21:00");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "app/(admin)/admin/content/events/EventForm.test.tsx"`
Expected: FAIL — `Cannot find module './EventForm'`

- [ ] **Step 3: Implement `app/(admin)/admin/content/events/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { contentIdSchema, eventFormSchema } from "@/lib/content-schemas";
import { tbilisiLocalToIso } from "@/lib/community";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { makeSlugFrom } from "@/lib/slug";
import { createServerSupabase } from "@/lib/supabase/server";

export type SaveEventResult = { ok: true; id: string } | { ok: false; error: string };
export type EventActionResult = { ok: true } | { ok: false; error: string };

function revalidateEvents(slug: string | null) {
  revalidatePath("/events");
  revalidatePath("/me/events");
  if (slug) revalidatePath(`/events/${slug}`);
}

export async function saveEventAction(input: unknown): Promise<SaveEventResult> {
  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const startsAtIso = tbilisiLocalToIso(parsed.data.startsAt);
  const endsAtIso =
    parsed.data.endsAt && parsed.data.endsAt !== "" ? tbilisiLocalToIso(parsed.data.endsAt) : null;
  if (!startsAtIso) return { ok: false, error: mapFunnelError("invalid_event_dates") };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_save_event", {
    p_id: parsed.data.id ?? null,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_location: parsed.data.location,
    p_starts_at: startsAtIso,
    p_ends_at: endsAtIso,
  });
  if (error || !data) return { ok: false, error: mapFunnelError(error?.message) };
  const { data: row } = await supabase.from("admin_events").select("slug").eq("id", data).single();
  revalidateEvents(row?.slug ?? null);
  return { ok: true, id: data };
}

export async function publishEventAction(id: unknown): Promise<EventActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();

  const { data: event, error: eventError } = await supabase
    .from("admin_events")
    .select("title, slug")
    .eq("id", parsed.data.id)
    .single();
  if (eventError || !event) {
    return { ok: false, error: mapFunnelError(eventError?.message ?? "invalid_target") };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    let slug = event.slug;
    if (!slug) {
      const base = makeSlugFrom(event.title, "event", new Set());
      const { data: taken, error: takenError } = await supabase
        .from("admin_events")
        .select("slug")
        .like("slug", `${base}%`);
      if (takenError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
      const takenSet = new Set((taken ?? []).map((t) => t.slug).filter((s): s is string => !!s));
      slug = makeSlugFrom(event.title, "event", takenSet);
    }
    const { data, error } = await supabase.rpc("admin_publish_event", {
      p_id: parsed.data.id,
      p_slug: slug,
    });
    if (!error) {
      revalidateEvents((data as { slug: string }).slug);
      return { ok: true };
    }
    if (error.code !== "23505") return { ok: false, error: mapFunnelError(error.message) };
  }
  return { ok: false, error: mapFunnelError("invalid_slug") };
}

export async function cancelEventAction(id: unknown): Promise<EventActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("admin_events")
    .select("slug")
    .eq("id", parsed.data.id)
    .single();
  const { error } = await supabase.rpc("admin_cancel_event", { p_id: parsed.data.id });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidateEvents(row?.slug ?? null);
  return { ok: true };
}

export async function deleteEventAction(id: unknown): Promise<EventActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_delete_event", { p_id: parsed.data.id });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/content/events");
  return { ok: true };
}
```

- [ ] **Step 4: Implement `app/(admin)/admin/content/events/EventForm.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { adminControlClasses } from "@/components/Field";
import { saveEventAction } from "./actions";

export interface EditableEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAtLocal: string;
  endsAtLocal: string;
}

export function EventForm({ event }: { event: EditableEvent | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startsAt, setStartsAt] = useState(event?.startsAtLocal ?? "");
  const [endsAt, setEndsAt] = useState(event?.endsAtLocal ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveEventAction({
        id: event?.id,
        title,
        description,
        location,
        startsAt,
        endsAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!event) {
        router.push(`/admin/content/events/${result.id}`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        დასახელება
        <input
          className={adminControlClasses}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        ადგილმდებარეობა
        <input
          className={adminControlClasses}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={200}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          დაწყება
          <input
            type="datetime-local"
            className={adminControlClasses}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          დასრულება (არასავალდებულო)
          <input
            type="datetime-local"
            className={adminControlClasses}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-muted-fg">დრო — თბილისის დროით.</p>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        აღწერა
        <textarea
          className={`${adminControlClasses} min-h-48`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button disabled={pending} onClick={submit}>
          შენახვა
        </Button>
        {saved ? <span className="text-sm font-semibold text-ok">შენახულია.</span> : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Run to verify the form test passes**

Run: `npx vitest run "app/(admin)/admin/content/events/EventForm.test.tsx"`
Expected: PASS

- [ ] **Step 6: Implement `app/(admin)/admin/content/events/EventActions.tsx`** (same armed pattern as ArticleActions):

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { cancelEventAction, deleteEventAction, publishEventAction } from "./actions";

export function EventActions({
  id,
  status,
  everPublished,
}: {
  id: string;
  status: "draft" | "published" | "cancelled";
  everPublished: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState<"cancel" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>,
    after?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setArmed(null);
      if (after) after();
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {status === "draft" ? (
          <Button disabled={pending} onClick={() => run((i) => publishEventAction(i))}>
            გამოქვეყნება
          </Button>
        ) : null}
        {status === "published" ? (
          armed === "cancel" ? (
            <Button variant="danger" disabled={pending} onClick={() => run((i) => cancelEventAction(i))}>
              დაადასტურე გაუქმება
            </Button>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => setArmed("cancel")}>
              გაუქმება
            </Button>
          )
        ) : null}
        {status === "draft" && !everPublished ? (
          armed === "delete" ? (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => run((i) => deleteEventAction(i), () => router.push("/admin/content/events"))}
            >
              დაადასტურე წაშლა
            </Button>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => setArmed("delete")}>
              წაშლა
            </Button>
          )
        ) : null}
        {status === "cancelled" ? (
          <p className="text-sm font-semibold text-muted-fg">ღონისძიება გაუქმებულია.</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 7: Create the three pages** (mirror the Task 18 page trio exactly, events flavor):

`app/(admin)/admin/content/events/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "შიგთავსი: ღონისძიებები — ქართული რესპუბლიკა" };

export default async function AdminEventsListPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("admin_events")
    .select("*")
    .order("starts_at", { ascending: false });
  if (error) throw new Error(`admin_events failed: ${error.message}`);
  const rows = data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">ღონისძიებები</h1>
        <ButtonLink href="/admin/content/events/new" size="sm">
          ახალი ღონისძიება
        </ButtonLink>
      </div>
      <DataTable
        bodyTestId="admin-events-body"
        head={
          <>
            <th className={tableThClass}>დასახელება</th>
            <th className={tableThClass}>დრო</th>
            <th className={tableThClass}>ადგილი</th>
            <th className={tableThClass}>სტატუსი</th>
            <th className={tableThClass}>მოდის</th>
            <th className={tableThClass}></th>
          </>
        }
      >
        {rows.map((e) => (
          <tr key={e.id} className={tableRowClass}>
            <td className={`${tableCellClass} font-semibold text-ink`}>{e.title}</td>
            <td className={tableCellClass}>{formatEventTimeKa(e.starts_at, e.ends_at)}</td>
            <td className={tableCellClass}>{e.location}</td>
            <td className={tableCellClass}>
              <Pill {...contentPill(e.status)} />
            </td>
            <td className={tableCellClass}>{formatCountKa(e.going_count)}</td>
            <td className={tableCellClass}>
              <Link
                href={`/admin/content/events/${e.id}`}
                className="font-semibold text-brand hover:underline"
              >
                რედაქტირება
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>
      {rows.length === 0 ? <p className="mt-4 text-sm text-muted-fg">ჯერ ცარიელია.</p> : null}
    </div>
  );
}
```

`app/(admin)/admin/content/events/new/page.tsx`:

```tsx
import type { Metadata } from "next";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "ახალი ღონისძიება — ქართული რესპუბლიკა" };

export default function NewEventPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-ink">ახალი ღონისძიება</h1>
      <EventForm event={null} />
    </div>
  );
}
```

`app/(admin)/admin/content/events/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { isoToTbilisiLocal } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventActions } from "../EventActions";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "ღონისძიების რედაქტირება — ქართული რესპუბლიკა" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: event, error } = await supabase
    .from("admin_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`admin_events by id failed: ${error.message}`);
  if (!event) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-ink">ღონისძიების რედაქტირება</h1>
        <Pill {...contentPill(event.status)} />
        <span className="text-sm font-semibold text-muted-fg">
          მოდის: {formatCountKa(event.going_count)}
        </span>
        {event.slug && event.status !== "draft" ? (
          <a
            href={`/events/${event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-brand hover:underline"
          >
            ნახე საიტზე ↗
          </a>
        ) : null}
      </div>

      <EventForm
        event={{
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          startsAtLocal: isoToTbilisiLocal(event.starts_at),
          endsAtLocal: event.ends_at ? isoToTbilisiLocal(event.ends_at) : "",
        }}
      />

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-muted-fg">მოქმედებები</h2>
        <EventActions
          id={event.id}
          status={event.status}
          everPublished={event.published_at !== null}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green. Dev server as editor: create an event with Tbilisi times, publish → appears on `/events` under მომავალი with the exact wall time entered; cancel (armed) → banner on the public page and „რეგისტრაცია დახურულია" in cabinets; RSVP counts show in the admin list; audit rows `event.save`/`event.publish`/`event.cancel` visible to super_admin.

- [ ] **Step 9: Commit**

```bash
npm run format
git add "app/(admin)/admin/content/events"
git commit -m "feat: admin events — Tbilisi-time form, publish/cancel lifecycle"
```

---

### Task 20: Admin polls — list, option-row form, open/close, live results

**Files:**
- Create: `app/(admin)/admin/content/polls/page.tsx`
- Create: `app/(admin)/admin/content/polls/new/page.tsx`
- Create: `app/(admin)/admin/content/polls/[id]/page.tsx`
- Create: `app/(admin)/admin/content/polls/PollForm.tsx`
- Create: `app/(admin)/admin/content/polls/PollForm.test.tsx`
- Create: `app/(admin)/admin/content/polls/PollActions.tsx`
- Create: `app/(admin)/admin/content/polls/actions.ts`

**Interfaces:**
- Consumes: `admin_polls` + `admin_poll_options` views; `admin_save_poll` / `admin_open_poll` / `admin_close_poll` / `admin_delete_poll` RPCs; `pollFormSchema`, `contentIdSchema`, `POLL_MIN_OPTIONS`, `POLL_MAX_OPTIONS`; `percentages`, `tbilisiLocalToIso`, `isoToTbilisiLocal`, `formatEventTimeKa`; `contentPill`, `adminControlClasses`, `DataTable`, `Button`, `ButtonLink`, `Pill`, `formatCountKa`.
- Produces: `savePollAction` (`{ ok: true; id }`), `openPollAction`, `closePollAction`, `deletePollAction`. Editor sees live per-option counts at ALL times (staff need; the anchoring rule protects voters, not staff — spec §3.7).

- [ ] **Step 1: Write the failing component test — `app/(admin)/admin/content/polls/PollForm.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
vi.mock("./actions", () => ({ savePollAction: (input: unknown) => saveMock(input) }));
const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { PollForm } from "./PollForm";

describe("PollForm", () => {
  beforeEach(() => {
    saveMock.mockReset();
    pushMock.mockReset();
  });

  it("starts with two option rows; rows are addable and removable to a floor of 2", () => {
    render(<PollForm poll={null} />);
    expect(screen.getAllByLabelText(/^პასუხი \d+$/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "პასუხის დამატება" }));
    expect(screen.getAllByLabelText(/^პასუხი \d+$/)).toHaveLength(3);
    const removes = screen.getAllByRole("button", { name: "წაშალე პასუხი" });
    fireEvent.click(removes[2]!);
    expect(screen.getAllByLabelText(/^პასუხი \d+$/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "წაშალე პასუხი" })).not.toBeInTheDocument();
  });

  it("submits question, trimmed options and empty endsAt", async () => {
    saveMock.mockResolvedValue({ ok: true, id: "p-new" });
    render(<PollForm poll={null} />);
    fireEvent.change(screen.getByLabelText("კითხვა"), { target: { value: "სად?" } });
    const options = screen.getAllByLabelText(/^პასუხი \d+$/);
    fireEvent.change(options[0]!, { target: { value: "თბილისი" } });
    fireEvent.change(options[1]!, { target: { value: "ბათუმი" } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith({
        id: undefined,
        question: "სად?",
        options: ["თბილისი", "ბათუმი"],
        endsAt: "",
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/content/polls/p-new"));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "app/(admin)/admin/content/polls/PollForm.test.tsx"`
Expected: FAIL — `Cannot find module './PollForm'`

- [ ] **Step 3: Implement `app/(admin)/admin/content/polls/actions.ts`**

```ts
"use server";

import { contentIdSchema, pollFormSchema } from "@/lib/content-schemas";
import { tbilisiLocalToIso } from "@/lib/community";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type SavePollResult = { ok: true; id: string } | { ok: false; error: string };
export type PollActionResult = { ok: true } | { ok: false; error: string };

export async function savePollAction(input: unknown): Promise<SavePollResult> {
  const parsed = pollFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const endsAtIso =
    parsed.data.endsAt && parsed.data.endsAt !== "" ? tbilisiLocalToIso(parsed.data.endsAt) : null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_save_poll", {
    p_id: parsed.data.id ?? null,
    p_question: parsed.data.question,
    p_options: parsed.data.options,
    p_ends_at: endsAtIso,
  });
  if (error || !data) return { ok: false, error: mapFunnelError(error?.message) };
  return { ok: true, id: data };
}

function makeStatusAction(rpc: "admin_open_poll" | "admin_close_poll" | "admin_delete_poll") {
  return async function pollStatusAction(id: unknown): Promise<PollActionResult> {
    const parsed = contentIdSchema.safeParse({ id });
    if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
    const supabase = await createServerSupabase();
    const { error } = await supabase.rpc(rpc, { p_id: parsed.data.id });
    if (error) return { ok: false, error: mapFunnelError(error.message) };
    return { ok: true };
  };
}

export const openPollAction = makeStatusAction("admin_open_poll");
export const closePollAction = makeStatusAction("admin_close_poll");
export const deletePollAction = makeStatusAction("admin_delete_poll");
```

(If `"use server"` files reject non-async exports of wrapped functions in the installed Next version — the build will say so — inline the three actions as plain `async function`s with the shared body instead. Same behavior, three declarations.)

- [ ] **Step 4: Implement `app/(admin)/admin/content/polls/PollForm.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { adminControlClasses } from "@/components/Field";
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "@/lib/content-schemas";
import { savePollAction } from "./actions";

export interface EditablePoll {
  id: string;
  question: string;
  options: string[];
  endsAtLocal: string;
}

export function PollForm({ poll }: { poll: EditablePoll | null }) {
  const router = useRouter();
  const [question, setQuestion] = useState(poll?.question ?? "");
  const [options, setOptions] = useState<string[]>(poll?.options ?? ["", ""]);
  const [endsAt, setEndsAt] = useState(poll?.endsAtLocal ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function setOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await savePollAction({
        id: poll?.id,
        question,
        options: options.map((o) => o.trim()),
        endsAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!poll) {
        router.push(`/admin/content/polls/${result.id}`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        კითხვა
        <input
          className={adminControlClasses}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
        />
      </label>

      <div className="flex flex-col gap-2.5">
        {options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-semibold text-ink">
              პასუხი {i + 1}
              <input
                className={adminControlClasses}
                value={option}
                onChange={(e) => setOption(i, e.target.value)}
                maxLength={120}
              />
            </label>
            {options.length > POLL_MIN_OPTIONS ? (
              <button
                type="button"
                aria-label="წაშალე პასუხი"
                className="mt-6 text-sm font-semibold text-muted-fg hover:text-danger"
                onClick={() => setOptions((prev) => prev.filter((_, x) => x !== i))}
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
        {options.length < POLL_MAX_OPTIONS ? (
          <Button variant="ghost" size="sm" onClick={() => setOptions((prev) => [...prev, ""])}>
            პასუხის დამატება
          </Button>
        ) : null}
      </div>

      <label className="flex max-w-xs flex-col gap-1.5 text-sm font-semibold text-ink">
        ბოლო ვადა (არასავალდებულო)
        <input
          type="datetime-local"
          className={adminControlClasses}
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
      </label>
      <p className="text-xs text-muted-fg">
        გახსნის შემდეგ კითხვა და პასუხები იყინება. ვადის გასვლის შემდეგ ხმებს სერვერი აღარ იღებს.
      </p>

      <div className="flex items-center gap-3">
        <Button disabled={pending} onClick={submit}>
          შენახვა
        </Button>
        {saved ? <span className="text-sm font-semibold text-ok">შენახულია.</span> : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Run to verify the form test passes**

Run: `npx vitest run "app/(admin)/admin/content/polls/PollForm.test.tsx"`
Expected: PASS

- [ ] **Step 6: Implement `app/(admin)/admin/content/polls/PollActions.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { closePollAction, deletePollAction, openPollAction } from "./actions";

export function PollActions({ id, status }: { id: string; status: "draft" | "open" | "closed" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState<"close" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>,
    after?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setArmed(null);
      if (after) after();
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {status === "draft" ? (
          <>
            <Button disabled={pending} onClick={() => run((i) => openPollAction(i))}>
              გახსნა
            </Button>
            {armed === "delete" ? (
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => run((i) => deletePollAction(i), () => router.push("/admin/content/polls"))}
              >
                დაადასტურე წაშლა
              </Button>
            ) : (
              <Button variant="ghost" disabled={pending} onClick={() => setArmed("delete")}>
                წაშლა
              </Button>
            )}
          </>
        ) : null}
        {status === "open" ? (
          armed === "close" ? (
            <Button variant="danger" disabled={pending} onClick={() => run((i) => closePollAction(i))}>
              დაადასტურე დახურვა
            </Button>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => setArmed("close")}>
              დახურვა
            </Button>
          )
        ) : null}
        {status === "closed" ? (
          <p className="text-sm font-semibold text-muted-fg">გამოკითხვა დახურულია.</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 7: Create the three pages**

`app/(admin)/admin/content/polls/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatDateKa } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "შიგთავსი: გამოკითხვები — ქართული რესპუბლიკა" };

export default async function AdminPollsListPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("admin_polls")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`admin_polls failed: ${error.message}`);
  const rows = data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">გამოკითხვები</h1>
        <ButtonLink href="/admin/content/polls/new" size="sm">
          ახალი გამოკითხვა
        </ButtonLink>
      </div>
      <DataTable
        bodyTestId="admin-polls-body"
        head={
          <>
            <th className={tableThClass}>კითხვა</th>
            <th className={tableThClass}>სტატუსი</th>
            <th className={tableThClass}>ხმები</th>
            <th className={tableThClass}>თარიღები</th>
            <th className={tableThClass}>ბოლო ვადა</th>
            <th className={tableThClass}></th>
          </>
        }
      >
        {rows.map((p) => (
          <tr key={p.id} className={tableRowClass}>
            <td className={`${tableCellClass} font-semibold text-ink`}>{p.question}</td>
            <td className={tableCellClass}>
              <Pill {...contentPill(p.status)} />
            </td>
            <td className={tableCellClass}>{formatCountKa(p.total_votes)}</td>
            <td className={tableCellClass}>
              {p.opened_at ? `გაიხსნა ${formatDateKa(p.opened_at)}` : "—"}
              {p.closed_at ? ` · დაიხურა ${formatDateKa(p.closed_at)}` : ""}
            </td>
            <td className={tableCellClass}>
              {p.ends_at ? formatEventTimeKa(p.ends_at, null) : "—"}
            </td>
            <td className={tableCellClass}>
              <Link
                href={`/admin/content/polls/${p.id}`}
                className="font-semibold text-brand hover:underline"
              >
                {p.status === "draft" ? "რედაქტირება" : "ნახვა"}
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>
      {rows.length === 0 ? <p className="mt-4 text-sm text-muted-fg">ჯერ ცარიელია.</p> : null}
    </div>
  );
}
```

`app/(admin)/admin/content/polls/new/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PollForm } from "../PollForm";

export const metadata: Metadata = { title: "ახალი გამოკითხვა — ქართული რესპუბლიკა" };

export default function NewPollPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-ink">ახალი გამოკითხვა</h1>
      <PollForm poll={null} />
    </div>
  );
}
```

`app/(admin)/admin/content/polls/[id]/page.tsx` — draft → form; open/closed → frozen question + live result bars:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa, isoToTbilisiLocal, percentages } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";
import { PollActions } from "../PollActions";
import { PollForm } from "../PollForm";

export const metadata: Metadata = { title: "გამოკითხვა — ქართული რესპუბლიკა" };

export default async function EditPollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const [pollRes, optionsRes] = await Promise.all([
    supabase.from("admin_polls").select("*").eq("id", id).maybeSingle(),
    supabase.from("admin_poll_options").select("*").eq("poll_id", id).order("position"),
  ]);
  if (pollRes.error) throw new Error(`admin_polls by id failed: ${pollRes.error.message}`);
  if (!pollRes.data) notFound();
  const poll = pollRes.data;
  const options = optionsRes.data ?? [];
  const counts = options.map((o) => o.votes);
  const pcts = percentages(counts);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-ink">გამოკითხვა</h1>
        <Pill {...contentPill(poll.status)} />
        <span className="text-sm font-semibold text-muted-fg">
          სულ {formatCountKa(poll.total_votes)} ხმა
        </span>
        {poll.ends_at ? (
          <span className="text-sm font-semibold text-muted-fg">
            ბოლო ვადა: {formatEventTimeKa(poll.ends_at, null)}
          </span>
        ) : null}
      </div>

      {poll.status === "draft" ? (
        <PollForm
          poll={{
            id: poll.id,
            question: poll.question,
            options: options.map((o) => o.label),
            endsAtLocal: poll.ends_at ? isoToTbilisiLocal(poll.ends_at) : "",
          }}
        />
      ) : (
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold text-ink">{poll.question}</h2>
          <div className="mt-4 flex flex-col gap-3.5">
            {options.map((o, i) => (
              <div key={o.option_id}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">{o.label}</span>
                  <span className="font-semibold text-muted-fg">
                    {formatCountKa(o.votes)} · {pcts[i] ?? 0}%
                  </span>
                </div>
                <div className="overflow-hidden rounded-md bg-surface">
                  <div className="h-2.5 rounded-md bg-brand" style={{ width: `${pcts[i] ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-muted-fg">მოქმედებები</h2>
        <PollActions id={poll.id} status={poll.status} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Gates + live check**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: green. Dev server as editor: create a poll (2→4 options), save, გახსნა → appears in `/me/polls` with buttons; votes tick up live on the admin page (counts visible to staff at all times); დახურვა → members all see results; a member's second-vote attempt shows „ხმა უკვე მიცემულია."; audit shows `poll.save`/`poll.open`/`poll.close`.

- [ ] **Step 9: Commit**

```bash
npm run format
git add "app/(admin)/admin/content/polls"
git commit -m "feat: admin polls — option-row form, open/close lifecycle, live results"
```

---

### Task 21: e2e — community helpers + news publishing critical flow

**Files:**
- Create: `e2e/community-helpers.ts`
- Create: `e2e/community-news.spec.ts`

**Interfaces:**
- Consumes: `e2e/admin-helpers.ts` (`loginAs`, `ADMIN_PHONES`, `phase4Phone`, `phase4PersonalId`, `serviceClient`, `profileIdByPhone`, `getAuditRows`, `cleanupPhase4Users`, `signOutViaNav`), `e2e/funnel-helpers.ts` (`passStep1`, `fillStep2Basics`), the seeded staging content.
- Produces (consumed by Tasks 22–23): `registerCompletedMember(page: Page, k: number): Promise<void>` — drives a per-run member registration to completion using slot `k`; `cleanupCommunityContent(marker: string): Promise<void>` — service-deletes news/events/polls whose title/question contains the per-run marker.
- **k slots: 5 (this spec), 6+7 (Task 22), 8+9 (Task 23).** Per-run users are voters/RSVPers/targets ONLY; every authored/audited act is performed by canonical admins (editor +995509000004) — the audit-actor invariant.

- [ ] **Step 1: Create `e2e/community-helpers.ts`**

```ts
import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "./admin-helpers";

/**
 * Drive a per-run user (phase4Phone(k)) through the FULL member funnel to
 * completed registration. Implementation: extract the working member-creation
 * sequence VERBATIM from e2e/admin-payments.spec.ts — its FIRST test block
 * ("a fresh member registers…", ~lines 19–43; the beforeAll only does
 * cleanup) — same passStep1/fillStep2Basics calls, same tier-step
 * interactions, same expectations — parameterized by k. Do not invent new
 * selectors; if admin-payments wraps any step in helpers, reuse those helpers.
 */
export async function registerCompletedMember(page: Page, k: number): Promise<void> {
  // (verbatim extraction as described above)
}

/**
 * A supabase-js client authenticated AS the browser's current member, for
 * direct RPC assertions (spec §7: "asserted via a direct second RPC call").
 * Reads the @supabase/ssr auth cookie(s) from the Playwright context —
 * possibly chunked (`sb-…-auth-token.0/.1`), possibly `base64-`-prefixed —
 * and mounts the access token as a Bearer header. If the cookie format ever
 * shifts, inspect the sb-*-auth-token cookie(s): the access_token JWT is
 * inside; adapt the decode, do not weaken the assertion.
 */
export async function memberRpcClient(page: Page): Promise<SupabaseClient> {
  const cookies = await page.context().cookies();
  const joined = cookies
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((c) => c.value)
    .join("");
  if (!joined) throw new Error("memberRpcClient: no sb auth cookie in context");
  const raw = joined.startsWith("base64-")
    ? Buffer.from(joined.slice("base64-".length), "base64").toString("utf8")
    : decodeURIComponent(joined);
  const session = JSON.parse(raw) as { access_token?: string };
  if (!session.access_token) throw new Error("memberRpcClient: no access_token in cookie");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("memberRpcClient needs staging env");
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-side cleanup of per-run content by title marker (cascades votes/rsvps/options). */
export async function cleanupCommunityContent(marker: string): Promise<void> {
  const db = serviceClient();
  for (const table of ["news", "events"] as const) {
    const { error } = await db.from(table).delete().like("title", `%${marker}%`);
    if (error) console.warn(`community cleanup ${table}: ${error.message}`);
  }
  const { error } = await db.from("polls").delete().like("question", `%${marker}%`);
  if (error) console.warn(`community cleanup polls: ${error.message}`);
}
```

The one intentionally-not-inlined body above is a VERBATIM extraction task from a named existing file — open `e2e/admin-payments.spec.ts`, copy its member-creation sequence, parameterize the phone/ID by `k`. Everything it needs already exists and passes CI today.

- [ ] **Step 2: Write `e2e/community-news.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { ADMIN_PHONES, cleanupPhase4Users, getAuditRows, loginAs, serviceClient, signOutViaNav } from "./admin-helpers";
import { cleanupCommunityContent, registerCompletedMember } from "./community-helpers";

const MEMBER = 5; // phase4Phone(5) — reads the feed; never authors
const RUN = `e2e-news-${Date.now().toString(36)}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupPhase4Users([MEMBER]);
  await cleanupCommunityContent("e2e-news-");
});

test.afterAll(async () => {
  await cleanupCommunityContent("e2e-news-");
  await cleanupPhase4Users([MEMBER]);
});

test("editor publishes public + member-only articles; visibility holds everywhere", async ({ page }) => {
  // 1) editor drafts + publishes a PUBLIC article
  await loginAs(page, ADMIN_PHONES.editor);
  await expect(page).toHaveURL(/\/admin\/content\/news$/); // editor lands on the hub
  await page.getByRole("link", { name: "ახალი სიახლე" }).click();
  await page.getByLabel("სათაური").fill(`საჯარო ${RUN}`);
  await page.getByLabel("ტექსტი").fill("პირველი აბზაცი.\n\nდეტალები: https://example.ge/x");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/news\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "გამოქვეყნება" }).click();
  await expect(page.getByText("გამოქვეყნებული")).toBeVisible();

  // audit row exists for the publish (in-transaction guarantee, viewed via service)
  const db = serviceClient();
  const { data: pubRow } = await db.from("news").select("id, slug").eq("title", `საჯარო ${RUN}`).single();
  expect(pubRow?.slug).toBeTruthy();
  expect(await getAuditRows("news.publish", pubRow!.id as string)).toBe(1);

  // 2) editor publishes a MEMBER-ONLY article
  await page.goto("/admin/content/news/new");
  await page.getByLabel("სათაური").fill(`შიდა ${RUN}`);
  await page.getByLabel("წევრებისთვის").check();
  await page.getByLabel("ტექსტი").fill("მხოლოდ წევრებისთვის.");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/news\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "გამოქვეყნება" }).click();
  await expect(page.getByText("გამოქვეყნებული")).toBeVisible();
  const { data: memRow } = await db.from("news").select("slug").eq("title", `შიდა ${RUN}`).single();
  const memberSlug = memRow!.slug as string;
  await signOutViaNav(page);

  // 3) public site: public article visible with OG tags; member-only 404s
  await page.goto("/news");
  await expect(page.getByText(`საჯარო ${RUN}`)).toBeVisible();
  await expect(page.getByText(`შიდა ${RUN}`)).not.toBeVisible();
  await page.getByText(`საჯარო ${RUN}`).click();
  await expect(page.getByRole("heading", { name: `საჯარო ${RUN}` })).toBeVisible();
  await expect(page.getByRole("link", { name: "https://example.ge/x" })).toBeVisible();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", new RegExp(RUN));
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og-default|news-images/);
  const missing = await page.goto(`/news/${memberSlug}`);
  expect(missing?.status()).toBe(404);

  // 4) a completed member sees BOTH in the cabinet feed; member-only opens under /me
  await registerCompletedMember(page, MEMBER);
  await page.goto("/me/news");
  await expect(page.getByText(`საჯარო ${RUN}`)).toBeVisible();
  await expect(page.getByText(`შიდა ${RUN}`)).toBeVisible();
  await expect(page.getByText("წევრებისთვის").first()).toBeVisible();
  await page.getByText(`შიდა ${RUN}`).click();
  await expect(page).toHaveURL(`/me/news/${memberSlug}`);
  await expect(page.getByRole("heading", { name: `შიდა ${RUN}` })).toBeVisible();
  await signOutViaNav(page);

  // 5) unpublish retracts the public article
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/news");
  await page.getByText(`საჯარო ${RUN}`).click();
  await page.getByRole("button", { name: "მოხსნა" }).click();
  await expect(page.getByText("მონახაზი")).toBeVisible();
  const gone = await page.goto(`/news/${pubRow!.slug as string}`);
  expect(gone?.status()).toBe(404);
});
```

- [ ] **Step 3: Run it against the local dev server + staging**

Run: `npx playwright test e2e/community-news.spec.ts`
Expected: PASS. (First run watch for selector drift against the real pages — fix the PAGES only if a testid/name from Tasks 13–18 was missed, never weaken assertions.)

- [ ] **Step 4: Commit**

```bash
npm run format
git add e2e/community-helpers.ts e2e/community-news.spec.ts
git commit -m "test(e2e): news publishing + visibility critical flow"
```

---

### Task 22: e2e — RSVP toggle + delegate team overview

**Files:**
- Create: `e2e/community-events.spec.ts`

**Interfaces:**
- Consumes: helpers as in Task 21 + `funnel-helpers`' `approveOwnDelegate`, `getReferralCode` (admin-helpers). k = 6 (delegate applicant), 7 (supporter).

- [ ] **Step 1: Write `e2e/community-events.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { ADMIN_PHONES, cleanupPhase4Users, getReferralCode, loginAs, phase4Phone, serviceClient, signOutViaNav } from "./admin-helpers";
import { approveOwnDelegate } from "./funnel-helpers";
import { cleanupCommunityContent } from "./community-helpers";

const DELEGATE = 6; // phase4Phone(6) — registers as delegate, service-approved
const SUPPORTER = 7; // phase4Phone(7) — joins via referral, RSVPs
const RUN = `e2e-event-${Date.now().toString(36)}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupPhase4Users([DELEGATE, SUPPORTER]);
  await cleanupCommunityContent("e2e-event-");
});

test.afterAll(async () => {
  await cleanupCommunityContent("e2e-event-");
  await cleanupPhase4Users([DELEGATE, SUPPORTER]);
});

test("member RSVPs and cancels; delegate sees the team overview", async ({ page }) => {
  // 0) editor publishes a future event
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/events/new");
  await page.getByLabel("დასახელება").fill(`კრება ${RUN}`);
  await page.getByLabel("ადგილმდებარეობა").fill("თბილისი");
  const in7d = new Date(Date.now() + 7 * 86_400_000);
  const local = `${in7d.toISOString().slice(0, 10)}T19:00`;
  await page.getByLabel("დაწყება").fill(local);
  await page.getByLabel("აღწერა").fill("დღის წესრიგი.");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/events\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "გამოქვეყნება" }).click();
  await expect(page.getByText("გამოქვეყნებული")).toBeVisible();
  await signOutViaNav(page);

  // 1) delegate applicant registers (delegate variant), service-approved; supporter joins via referral
  //    — the registration sequences mirror admin-approval.spec.ts's applicant/supporter
  //    journeys VERBATIM, parameterized by DELEGATE/SUPPORTER slots.
  //    After both: supporter is a completed member bound to the delegate.
  //    (delegate journey → approveOwnDelegate(phase4Phone(DELEGATE)) → referral =
  //     await getReferralCode(phase4Phone(DELEGATE)) → supporter joins via /join?ref=referral)

  // 2) supporter RSVPs, sees own state, cancels, re-RSVPs
  await page.goto("/me/events");
  const eventCard = page.locator("section", { hasText: `კრება ${RUN}` });
  await eventCard.getByRole("button", { name: "მოვალ" }).click();
  await expect(eventCard.getByText("✓ შენ მოდიხარ")).toBeVisible();
  await expect(eventCard.getByText(/სულ მოდის 1 წევრი/)).toBeVisible();
  await eventCard.getByRole("button", { name: "გაუქმება" }).click();
  await expect(eventCard.getByRole("button", { name: "მოვალ" })).toBeVisible();
  await expect(eventCard.getByText(/სულ მოდის 0 წევრი/)).toBeVisible();
  await eventCard.getByRole("button", { name: "მოვალ" }).click();
  await expect(eventCard.getByText("✓ შენ მოდიხარ")).toBeVisible();

  // DB truth: exactly ONE row for (event, member) after the toggle dance
  const db = serviceClient();
  const { data: eventRow } = await db.from("events").select("id").eq("title", `კრება ${RUN}`).single();
  const { count } = await db
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventRow!.id as string);
  expect(count).toBe(1);
  await signOutViaNav(page);

  // 3) delegate sees the team overview with the supporter's name
  await loginAs(page, phase4Phone(DELEGATE));
  await page.goto("/delegate");
  const overview = page.getByTestId("team-rsvp");
  await expect(overview.getByText(`კრება ${RUN}`)).toBeVisible();
  await expect(overview.getByText("შენი გუნდიდან მოდის 1")).toBeVisible();
  await overview.getByText("ვინ მოდის").click();
  // the supporter's seeded first name appears (use the exact name fillStep2Basics writes)
  await signOutViaNav(page);

  // 4) editor cancels → public banner + cabinet lock
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/events");
  await page.getByText(`კრება ${RUN}`).click();
  await page.getByRole("button", { name: "გაუქმება" }).click();
  await page.getByRole("button", { name: "დაადასტურე გაუქმება" }).click();
  await expect(page.getByText("ღონისძიება გაუქმებულია.")).toBeVisible();
  await signOutViaNav(page);
  const { data: slugRow } = await db.from("events").select("slug").eq("id", eventRow!.id as string).single();
  await page.goto(`/events/${slugRow!.slug as string}`);
  await expect(page.getByText("ღონისძიება გაუქმებულია")).toBeVisible();
});
```

Fill the step-1 comment block with the verbatim journeys from `e2e/admin-approval.spec.ts` (applicant + supporter), exactly as Task 21's helper extraction — the supporter must end COMPLETED (through the tier step) and bound to the delegate; assert the supporter's `/me/delegate` shows the delegate if the source spec does so. `page.locator("section", …)`: if the member event card renders as a different element, scope by the `rsvp-<eventId>` testid from Task 14 instead — never loosen to page-wide text matches.

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/community-events.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
npm run format
git add e2e/community-events.spec.ts
git commit -m "test(e2e): RSVP toggle + delegate team overview critical flow"
```

---

### Task 23: e2e — polls + transparency derivation

**Files:**
- Create: `e2e/community-polls.spec.ts`

**Interfaces:**
- Consumes: helpers as above. k = 8 (voter), 9 (non-voter).

- [ ] **Step 1: Write `e2e/community-polls.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { formatCountKa } from "../lib/format";
import { ADMIN_PHONES, cleanupPhase4Users, loginAs, phase4Phone, serviceClient, signOutViaNav } from "./admin-helpers";
import { cleanupCommunityContent, memberRpcClient, registerCompletedMember } from "./community-helpers";

const VOTER = 8; // phase4Phone(8)
const WATCHER = 9; // phase4Phone(9) — never votes; sees results only after close
const RUN = `e2e-poll-${Date.now().toString(36)}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupPhase4Users([VOTER, WATCHER]);
  await cleanupCommunityContent("e2e-poll-");
});

test.afterAll(async () => {
  await cleanupCommunityContent("e2e-poll-");
  await cleanupPhase4Users([VOTER, WATCHER]);
});

test("vote once, results per the visibility rule, transparency derives from the register", async ({ page }) => {
  // 0) editor creates + opens a poll
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/polls/new");
  await page.getByLabel("კითხვა").fill(`არჩევანი ${RUN}?`);
  const options = page.getByLabel(/^პასუხი \d+$/);
  await options.nth(0).fill("დიახ");
  await options.nth(1).fill("არა");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/polls\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "გახსნა" }).click();
  await expect(page.getByText("ღია")).toBeVisible();
  await signOutViaNav(page);

  // 1) voter registers, sees BUTTONS (labels visible pre-vote), votes, sees bars + own mark
  await registerCompletedMember(page, VOTER);
  await page.goto("/me/polls");
  const pollCard = page.locator("[data-testid^='poll-']", { hasText: RUN });
  await expect(pollCard.getByRole("button", { name: "დიახ" })).toBeVisible();
  await pollCard.getByRole("button", { name: "დიახ" }).click();
  await expect(pollCard.getByText(/✓ შენ უკვე მიეცი ხმა · სულ 1 ხმა/)).toBeVisible();
  await expect(pollCard.getByText("✓ შენი არჩევანი")).toBeVisible();
  await expect(pollCard.getByRole("button", { name: "დიახ" })).not.toBeVisible();
  await page.reload();
  await expect(pollCard.getByText(/✓ შენ უკვე მიეცი ხმა/)).toBeVisible(); // persisted

  // DB truth: the vote is a single PK row
  const db = serviceClient();
  const { data: pollRow } = await db.from("polls").select("id").like("question", `%${RUN}%`).single();
  const { count } = await db
    .from("poll_votes")
    .select("*", { count: "exact", head: true })
    .eq("poll_id", pollRow!.id as string);
  expect(count).toBe(1);

  // Spec §7: the constraint itself, via a DIRECT second RPC call as the voter
  // (the UI can't even attempt it — the buttons are gone once voted). Runs
  // BEFORE sign-out: memberRpcClient reads the live session cookie.
  const { data: optRows } = await db
    .from("poll_options")
    .select("id, position")
    .eq("poll_id", pollRow!.id as string)
    .order("position");
  const voterRpc = await memberRpcClient(page);
  const { error: directErr } = await voterRpc.rpc("member_cast_vote", {
    p_poll_id: pollRow!.id as string,
    p_option_id: optRows![1]!.id as string,
  });
  expect(directErr?.message ?? "").toContain("already_voted");
  const { count: afterDirect } = await db
    .from("poll_votes")
    .select("*", { count: "exact", head: true })
    .eq("poll_id", pollRow!.id as string);
  expect(afterDirect).toBe(1);

  // 2) a NON-voter sees buttons, not results, while open
  await registerCompletedMember(page, WATCHER);
  await page.goto("/me/polls");
  await expect(pollCard.getByRole("button", { name: "დიახ" })).toBeVisible();
  await expect(pollCard.getByText(/სულ 1 ხმა/)).not.toBeVisible();
  await signOutViaNav(page);

  // 3) editor closes → the non-voter now sees results
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/polls");
  await page.getByText(`არჩევანი ${RUN}?`).click();
  await page.getByRole("button", { name: "დახურვა" }).click();
  await page.getByRole("button", { name: "დაადასტურე დახურვა" }).click();
  await expect(page.getByText("გამოკითხვა დახურულია.")).toBeVisible();
  await signOutViaNav(page);
  await loginAs(page, phase4Phone(WATCHER));
  await page.goto("/me/polls");
  await expect(pollCard.getByText(/გამოკითხვა დასრულებულია · სულ 1 ხმა/)).toBeVisible();
  await expect(pollCard.getByRole("button", { name: "დიახ" })).not.toBeVisible();
  await signOutViaNav(page);

  // 4) transparency equals the register (derived, never stored)
  const { data: livePayments } = await db.from("payments").select("amount_gel").is("voided_at", null);
  const expectedTotal = Math.round(
    (livePayments ?? []).reduce((s, p) => s + Number(p.amount_gel), 0),
  );
  const { count: registered } = await db
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .neq("status", "draft");
  await page.goto("/transparency");
  await expect(page.getByText(`${formatCountKa(expectedTotal)} ₾`)).toBeVisible();
  await expect(
    page
      .locator("div", { hasText: /^რეგისტრირებული წევრი$/ })
      .locator("..")
      .getByText(formatCountKa(registered ?? 0)),
  ).toBeVisible();
  const { count: approvedDelegates } = await db
    .from("delegates")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");
  await expect(
    page
      .locator("div", { hasText: /^დამტკიცებული დელეგატი$/ })
      .locator("..")
      .getByText(formatCountKa(approvedDelegates ?? 0)),
  ).toBeVisible();
  // one region row (spec §7): the busiest region's numbers, in its table row
  // (if registered === active there, disambiguate the second assertion with .first())
  const { data: topRegion } = await db
    .from("transparency_regions")
    .select("*")
    .order("registered", { ascending: false })
    .limit(1)
    .single();
  const regionRow = page.getByRole("row", { name: new RegExp(topRegion!.name_ka) });
  await expect(regionRow.getByText(formatCountKa(topRegion!.registered))).toBeVisible();
  await expect(regionRow.getByText(formatCountKa(topRegion!.active))).toBeVisible();
});
```

Transparency-number caveat: the page is ISR-cached up to 60s, and this spec REGISTERS two members mid-run — compute `registered` AFTER both registrations (as written) and, if the assertion flakes on cache lag, add `await page.waitForTimeout(61_000)` + reload once before the transparency block (matched to `revalidate = 60`, not a poll loop). The `StatCard` locator: mirror how existing e2e asserts StatCard values (see `public.spec.ts` home counters) rather than the `..` traversal if that pattern differs.

- [ ] **Step 2: Run it, then the ENTIRE e2e suite**

Run: `npx playwright test e2e/community-polls.spec.ts && npx playwright test`
Expected: all Phase 5 specs pass AND every pre-existing suite stays green (k-slots 0–4 untouched, canonical seed undisturbed).

- [ ] **Step 3: Commit**

```bash
npm run format
git add e2e/community-polls.spec.ts
git commit -m "test(e2e): poll voting/results rules + transparency derivation"
```

---

### Task 24: Docs, ADR-017, styleguide, version — and the final gates

**Files:**
- Modify: `ARCHITECTURE.md`, `DESIGN.md`, `DECISIONS.md`, `CHANGELOG.md`, `package.json`
- Modify: `app/(public)/styleguide/page.tsx`

- [ ] **Step 1: ARCHITECTURE.md — append after the "Admin CRM (Phase 4)" section:**

```markdown
## Community (Phase 5)

News, events and polls live behind the same locks as Phase 4: base tables carry
zero client grants; anon reads only `public_news`/`public_events` and the
aggregate-only `transparency_stats`/`transparency_regions`; completed members
read self-gating `member_*` views (the DB-level meaning of „წევრებისთვის");
editors read self-gating `admin_*` views. Every editor mutation is a SECURITY
DEFINER RPC writing audit_log in-transaction (ADR-014); member acts
(member_rsvp, member_cast_vote) are definer RPCs without audit rows. One vote
per member is the poll_votes PRIMARY KEY (poll_id, member_id); RSVPs are one
row per (event, member) flipped between going/cancelled. Slugs mint at first
publish (delegate pattern: server suggests via lib/slug, RPC enforces,
23505 → retry) and are permanent. Member-only articles render ONLY under
/me/news/* (service-worker NetworkOnly) — the public cache never sees them.
Public pages are ISR (60s) + revalidatePath on publish/unpublish/cancel.
News covers ride the Phase 4 photo envelope (editor-prechecked service-role
upload to the public news-images bucket + audited re-checking RPC) — the one
service-role app path added this phase. Bodies are plain text rendered to React
elements (paragraphs + auto-links, lib/content-render) — no HTML round-trips.
```

- [ ] **Step 2: DESIGN.md — append:**

```markdown
Phase 5: ContentBody (paragraphs+auto-links renderer — the one renderer for
news/event bodies everywhere incl. the admin live preview), NewsCard (shared by
/news and /me/news), ContentNav (admin content sub-nav), poll bars (surface
track + brand fill, prototype me-polls parity), RSVP toggle (მოვალ ⇄ გაუქმება +
„✓ შენ მოდიხარ"). Content-status pills via contentPill() label overrides.
Cabinet nav grew to six member tabs; AdminNav gained შიგთავსი (editor +
super_admin).
```

- [ ] **Step 3: styleguide — add gallery samples** to `app/(public)/styleguide/page.tsx`, next to the existing component samples, following the page's established section markup exactly:

```tsx
          <ContentBody body={"აბზაცი პირველი.\n\nბმულით: https://example.ge"} />
          <NewsCard
            href="/styleguide"
            title="სიახლის ბარათი"
            publishedAt="19.07.2026"
            imageUrl={null}
            excerptText="მოკლე შინაარსი ბარათისთვის…"
            pill={<Pill status="profile_completed" label="წევრებისთვის" />}
          />
          <ContentNav />
```

with imports `ContentBody`, `NewsCard`, `ContentNav` added to the existing `@/components` imports. (ContentNav renders fine on a public page — it only reads `usePathname`.)

- [ ] **Step 4: DECISIONS.md — append ADR-017:**

```markdown
## ADR-017 (2026-07-19): Community content model — visibility views, PK votes, plain-text bodies

News/events/polls extend the Phase 4 lock pattern instead of inventing a new
one: zero client grants on base tables; anon → public_* views (published+public
only) and aggregate-only transparency views; completed members → self-gating
member_* views (registration_completed_at is the DB meaning of „წევრებისთვის");
editor|super_admin → self-gating admin_* views; every editor mutation a
SECURITY DEFINER RPC with its audit row in the same transaction. Member-only
articles render exclusively under /me/news/* — the service worker's NetworkOnly
zone — so shared-device caches never hold them; their covers sit in the public
news-images bucket (delegate-photos model: unguessable UUID paths, illustrative
by policy; private bucket + signed URLs recorded as the later fix). One vote
per member is the poll_votes PRIMARY KEY with a composite FK
(poll_id, option_id) → poll_options — a second vote or a cross-poll option is
unrepresentable; votes are immutable (prototype lock) and results visibility
(voted-or-closed) is enforced IN the poll_option_counts view, with option
LABELS separately member-visible via member_poll_options so ballots can render.
Bodies are plain text (blank-line paragraphs + auto-linked URLs) rendered to
React elements by lib/content-render — no markdown dependency, no stored HTML,
no dangerouslySetInnerHTML; escalate to a markdown subset only via a future
ADR. Slugs romanize titles through the existing lib/slug (national 2002,
apostrophes dropped), mint at first publish, permanent thereafter. Rejected:
RLS-policy-per-table reads (views centralize the visibility rules exactly like
public_delegates/admin_*), stored RSVP/vote counters (derivable — forbidden),
event capacity/waitlists and vote-changing (out of scope v1, spec §9).
```

- [ ] **Step 5: CHANGELOG.md + version** (match the existing entry format — read the file first):

```markdown
## 0.6.0 — Phase 5: Community (2026-07-19)

- Public news (/news + article pages with OG tags), per-article visibility:
  public or member-only (member-only lives in the cabinet feed only)
- Public events (/events + detail): upcoming/past archive, cancellation banner,
  Tbilisi wall-time display; no public attendee counts
- Transparency page (/transparency): total membership contributions (GEL,
  all-time), registered members, approved delegates, region table
  (registered + active) — every figure derived live, nothing stored
- Member cabinet: news feed (member-only pill), events with RSVP toggle
  (მოვალ ⇄ გაუქმება until start) + internal going counts, polls with the
  prototype voting UX — one vote per member enforced by the database
- Delegate panel: team RSVP overview (who from my team is coming)
- Admin შიგთავსი hub (editor + super_admin): news with live preview + audited
  cover upload, events publish/cancel, polls draft→open→closed with optional
  end date; every action audited in-transaction
- 15 new audit actions with Georgian viewer labels
```

In `package.json`: `"version": "0.6.0"`.

- [ ] **Step 6: Final gates and push**

```bash
npm run format
npm run lint && npm run typecheck && npx vitest run && npm run build && npm run format:check
node scripts/verify-schema.mjs
npx playwright test
git add ARCHITECTURE.md DESIGN.md DECISIONS.md CHANGELOG.md package.json "app/(public)/styleguide/page.tsx"
git commit -m "docs: Phase 5 — architecture, ADR-017, changelog, v0.6.0"
git push -u origin claude/phase-5-community-8f6517
```

Expected: every gate green locally; CI green on the pushed branch (unit + e2e against staging). What follows is process, not plan: per-task reviews already happened during execution; now the whole-branch review, `/qa` on the Vercel preview, the owner sign-off package (spec §10 — preview URL; demo logins: editor +995509000004, super_admin +995509000001, a seeded member and a seeded approved delegate; plain-language walkthrough with screenshots of public news/article/OG preview, events + cancelled banner, transparency, member feed with the member-only pill, RSVP toggle, poll voting before/after, delegate team RSVP, admin შიგთავსი, audit rows), and the PR "Phase 5 — Community (v0.6.0)". Never merge with failing CI; owner approves in chat first.










