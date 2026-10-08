# Registration security fixes (R1 + R2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Close the critical phone-proof bypass (C1) on both live sites with a code-only release.
- Harden the database underneath it: explicit supersede marker, legacy `register()` revoked, a capped
  and audited personal-ID conflict path (H1), and production workflow actions pinned to commit SHAs.

**Architecture:**
- R1 is a code-only PR. Exact microsecond timestamp comparison in `lib/phone-verification/`, plus a
  membership action that understands R2's "returned error" contract. Merge = release closes C1.
- R2 is a migration-only PR (two migrations, workflow and schema-check updates, hand-maintained
  types, static tests). It merges after R1 is live, applies to staging after merge, then goes to
  production through the guarded `production-db.yml` dry-run and apply.

**Tech Stack:** Next.js 16 server actions, Supabase Postgres (plpgsql SECURITY DEFINER), vitest (static
migration-text tests, house pattern from `lib/privacy.test.ts`), Playwright e2e against staging.

**Spec:** `docs/superpowers/specs/2026-10-08-security-audit-fixes-design.md` (sections 1–3, 7, 8)

## Global Constraints

- TypeScript strict; no `any`, no `@ts-ignore`; zod at boundaries.
- All user-facing text Georgian. Never type typographic quotes in Georgian strings
  (U+201C/U+201D transcription hazard). Run `node scripts/ka-gate.mjs --diff main <files>` and
  `npm run ka:scan` on every file with Georgian.
- Gates before every push: `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `npm run ka:scan`, `npm test`, `npm run build`. CI also runs `npm run e2e` against staging.
- Never push to main. Never merge with failing CI. `quality` is not a required check: merge by hand
  after `gh pr checks` shows it pass.
- Owner reads no code: every sign-off package is plain language plus screenshots plus the preview URL.
- Merge = release for BOTH sites. After each merge, read the merge commit's `Vercel – georgia-republic`
  status (hobby daily deploy limit) and check https://georgia-republic.vercel.app yourself.
- Migrations: `supabase/migrations/` only. Restate live function bodies verbatim apart from the stated
  changes. Revoke before grant. `search_path = ''` and schema-qualified names in SECURITY DEFINER bodies.
- ADR: next free number on main (ADR-045 on 2026-10-08). Recheck main's last ADR right before merging.
- Worktrees have no `node_modules` or `.env.local`; see memory "worktree e2e invocation" before running
  e2e from a worktree.

---

## Release 1 — branch `claude/security-phone-proof-exact` (code only)

### Task 1: Exact microsecond timestamps

**Files:**
- Create: `lib/phone-verification/timestamps.ts`
- Test: `lib/phone-verification/timestamps.test.ts`

**Interfaces:**
- Produces: `timestampMicros(value: string): bigint | null` — microseconds since the epoch, exact for
  ISO/Postgres timestamps with up to 6 fraction digits; `null` for anything it cannot parse exactly.

- [ ] **Step 1: Write the failing test**

```ts
// lib/phone-verification/timestamps.test.ts
import { describe, expect, it } from "vitest";
import { timestampMicros } from "./timestamps";

describe("timestampMicros", () => {
  it("keeps the microsecond that Date.parse throws away (security audit C1)", () => {
    const expires = "2026-08-11T12:05:00.123+00:00";
    const superseded = "2026-08-11T12:05:00.123001+00:00";
    // the bug: JavaScript sees the two instants as equal
    expect(Date.parse(superseded)).toBe(Date.parse(expires));
    expect(timestampMicros(superseded)).toBe(timestampMicros(expires)! + 1n);
  });

  it("reads Z, long and short offsets, and the Postgres text separator", () => {
    const utc = timestampMicros("2026-08-11T12:05:00Z");
    expect(utc).toBe(BigInt(Date.parse("2026-08-11T12:05:00Z")) * 1000n);
    expect(timestampMicros("2026-08-11T12:05:00+00:00")).toBe(utc);
    expect(timestampMicros("2026-08-11T16:05:00+04:00")).toBe(utc);
    expect(timestampMicros("2026-08-11 16:05:00+04")).toBe(utc);
    expect(timestampMicros("2026-08-11T12:05:00.5Z")).toBe(utc! + 500_000n);
    expect(timestampMicros("2026-08-11T12:05:00.000Z")).toBe(utc);
  });

  it("refuses anything it cannot read exactly", () => {
    for (const bad of [
      "",
      "not a time",
      "2026-08-11T12:05:00", // no zone
      "2026-08-11T12:05:00.1234567Z", // finer than Postgres stores
      "2026-13-45T12:05:00Z",
    ]) {
      expect(timestampMicros(bad)).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/phone-verification/timestamps.test.ts`
Expected: FAIL — `Failed to resolve import "./timestamps"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/phone-verification/timestamps.ts
/**
 * Exact instants for the phone-proof ledger. Postgres timestamptz carries microseconds;
 * JavaScript's Date keeps milliseconds and silently drops the rest, which once let a
 * superseded challenge (consumed_at = expires_at + 1µs) read as validly consumed
 * (security audit 2026-10-08, C1). Compare ledger timestamps only through this.
 */
const TIMESTAMP_RE =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/;

function isoOffset(zone: string): string {
  if (zone === "Z") return "Z";
  if (zone.length === 3) return `${zone}:00`;
  return zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
}

export function timestampMicros(value: string): bigint | null {
  const match = TIMESTAMP_RE.exec(value);
  if (!match) return null;
  const [, date, time, fraction, zone] = match;
  if (date === undefined || time === undefined || zone === undefined) return null;
  const wholeSecondMs = Date.parse(`${date}T${time}${isoOffset(zone)}`);
  if (Number.isNaN(wholeSecondMs)) return null;
  return BigInt(wholeSecondMs) * 1000n + BigInt((fraction ?? "").padEnd(6, "0"));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/phone-verification/timestamps.test.ts`
Expected: PASS (3 tests). If `"2026-13-45T12:05:00Z"` is not refused, check that `Date.parse`
returns `NaN` for it on Node 24 (it does). Do not add a hand-written calendar check.

- [ ] **Step 5: Commit**

```bash
git add lib/phone-verification/timestamps.ts lib/phone-verification/timestamps.test.ts
git commit -m "Compare phone-proof timestamps to the microsecond"
```

### Task 2: `readOwnedChallenge` decides in exact microseconds

**Files:**
- Modify: `lib/phone-verification/store.ts:90-111`
- Test: `lib/phone-verification/store.test.ts` (add two tests after the existing
  "rejects expired, stale-consumed, foreign, and backend-failed reads")

**Interfaces:**
- Consumes: `timestampMicros` (Task 1).
- Produces: `readOwnedChallenge` keeps its signature. It now returns `null` for a consumed proof whose
  `consumed_at` is later than `expires_at` by any amount, and throws `phone verification store failed`
  for an unparseable timestamp.

- [ ] **Step 1: Write the failing tests**

```ts
  it("rejects a superseded challenge stamped one microsecond after expiry (audit C1)", async () => {
    // exactly what complete_phone_verification_send wrote for a superseded challenge
    const superseded = {
      ...baseRow,
      expires_at: "2026-08-11T12:05:00.123+00:00",
      consumed_at: "2026-08-11T12:05:00.123001+00:00",
    };
    const reader = makeReadAdmin({ data: superseded, error: null });
    await expect(
      readOwnedChallenge(reader.admin, {
        challengeId,
        userId,
        nowIso: "2026-08-11T12:06:00.000Z",
      }),
    ).resolves.toBeNull();
  });

  it("fails closed on a timestamp it cannot read exactly", async () => {
    const reader = makeReadAdmin({
      data: { ...baseRow, expires_at: "2026-08-11 garbage" },
      error: null,
    });
    await expect(
      readOwnedChallenge(reader.admin, {
        challengeId,
        userId,
        nowIso: "2026-08-11T12:01:00.000Z",
      }),
    ).rejects.toThrow("phone verification store failed");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/phone-verification/store.test.ts`
Expected:
- the C1 test FAILS (resolves to the row, not null), proving the bypass;
- the garbage test FAILS (resolves to null, not a throw).

- [ ] **Step 3: Write minimal implementation**

In `lib/phone-verification/store.ts`, add the import and replace the date logic of `readOwnedChallenge`:

```ts
import { timestampMicros } from "./timestamps";
```

```ts
/** A consumed proof stays usable for idempotent re-attachment for one day. */
const PROOF_WINDOW_MICROS = 24n * 60n * 60n * 1_000_000n;

function exactMicros(value: string): bigint {
  const micros = timestampMicros(value);
  if (micros === null) throw storeError();
  return micros;
}

export async function readOwnedChallenge(
  admin: AdminClient,
  input: { challengeId: string; userId: string; nowIso: string },
): Promise<ChallengeRow | null> {
  const { data, error } = await admin
    .from("phone_verification_challenges")
    .select("*")
    .eq("id", input.challengeId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error) throw storeError();
  if (!data) return null;

  // Exact to the microsecond (security audit C1): a superseded challenge was stamped
  // consumed_at = expires_at + 1µs, which millisecond Date math read as "in time".
  const now = exactMicros(input.nowIso);
  const expires = exactMicros(data.expires_at);
  if (data.consumed_at === null) return expires > now ? data : null;

  const consumed = exactMicros(data.consumed_at);
  const consumedIsValid =
    consumed <= expires && consumed <= now && consumed >= now - PROOF_WINDOW_MICROS;
  return consumedIsValid ? data : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/phone-verification/store.test.ts "app/(public)/join/phone-actions.test.ts"`
Expected: all PASS. The existing recovery case
(`consumed_at 12:04`, `expires_at 12:05`, `now 12:05`) still resolves to the row.

- [ ] **Step 5: Commit**

```bash
git add lib/phone-verification/store.ts lib/phone-verification/store.test.ts
git commit -m "Reject superseded phone challenges exactly (audit C1)"
```

### Task 3: Membership save understands a returned refusal

**Files:**
- Modify: `app/(member)/me/membership/actions.ts:13-29`
- Modify: `lib/funnel.ts` (`ERROR_MESSAGES`, after `duplicate_personal_id`)
- Test: `app/(member)/me/membership/actions.test.ts` (create)

**Interfaces:**
- Produces:
  - `saveMembershipProfileAction` returns `{ ok: false, error }` when the RPC resolves to
    `{ "error": "<token>" }`, with `error = mapFunnelError(token)`;
  - new `ERROR_MESSAGES` token `personal_id_attempts_exceeded`;
  - R2's migration 2 relies on both.

- [ ] **Step 1: Write the failing test**

```ts
// app/(member)/me/membership/actions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DUPLICATE_PERSONAL_ID_MESSAGE, ERROR_MESSAGES } from "@/lib/funnel";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import { saveMembershipProfileAction } from "./actions";

const input = {
  personalId: "01010101010",
  birthDate: "1990-05-20",
  regionId: 1,
  cityId: 2,
  employment: "სტუდენტი",
  delegateId: null,
};

describe("saveMembershipProfileAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a raised duplicate to the inline personal-ID message", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "duplicate_personal_id" } });
    await expect(saveMembershipProfileAction(input)).resolves.toEqual({
      ok: false,
      error: DUPLICATE_PERSONAL_ID_MESSAGE,
    });
  });

  it("maps a RETURNED duplicate the same way, never as a cabinet state (audit H1)", async () => {
    mocks.rpc.mockResolvedValue({ data: { error: "duplicate_personal_id" }, error: null });
    await expect(saveMembershipProfileAction(input)).resolves.toEqual({
      ok: false,
      error: DUPLICATE_PERSONAL_ID_MESSAGE,
    });
  });

  it("explains the cap on personal-ID tries and points to support", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "personal_id_attempts_exceeded" } });
    await expect(saveMembershipProfileAction(input)).resolves.toEqual({
      ok: false,
      error: ERROR_MESSAGES["personal_id_attempts_exceeded"],
    });
    expect(ERROR_MESSAGES["personal_id_attempts_exceeded"]).toBeDefined();
  });

  it("passes a real cabinet state through", async () => {
    const state = { exists: true, standing: "supporter" };
    mocks.rpc.mockResolvedValue({ data: state, error: null });
    await expect(saveMembershipProfileAction(input)).resolves.toEqual({ ok: true, state });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(member)/me/membership/actions.test.ts"`
Expected: FAIL:
- "RETURNED duplicate" resolves `{ ok: true, ... }`;
- "cap on personal-ID tries" maps to the generic error and `ERROR_MESSAGES[...]` is undefined.

- [ ] **Step 3: Write minimal implementation**

`lib/funnel.ts`, directly after the `duplicate_personal_id` entry:

```ts
  // Security audit H1 (2026-10-08), decision D2: after three personal-ID conflicts the account
  // stops here for good; a real person only gets here when their ID is already taken, which
  // needs a human, so the message points to support instead of "try later".
  personal_id_attempts_exceeded:
    "პირადი ნომრის დადასტურება ვერ ხერხდება — მოგვწერე მხარდაჭერის გვერდიდან და დაგეხმარებით.",
```

`app/(member)/me/membership/actions.ts`:

```ts
import { z } from "zod";
```

```ts
/**
 * become_member_save_profile RETURNS {"error": token} for a refused personal ID (security
 * audit H1), so the audit row it writes commits instead of rolling back with a raise.
 */
const returnedRefusalSchema = z.object({ error: z.string() });

export async function saveMembershipProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = membershipProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("become_member_save_profile", {
    p_birth_date: parsed.data.birthDate,
    p_region_id: parsed.data.regionId,
    p_city_id: parsed.data.cityId,
    p_employment: parsed.data.employment,
    p_delegate_id: parsed.data.delegateId,
    p_personal_id: parsed.data.personalId,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  const refused = returnedRefusalSchema.safeParse(data);
  if (refused.success) return { ok: false, error: mapFunnelError(refused.data.error) };
  return { ok: true, state: data as unknown as CabinetState };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/(member)/me/membership" lib/funnel.test.ts`
Expected: all PASS. If `lib/funnel.test.ts` pins the `ERROR_MESSAGES` key list, add
`personal_id_attempts_exceeded` there in the same commit.

- [ ] **Step 5: Georgian gates and commit**

Run: `node scripts/ka-gate.mjs --diff main lib/funnel.ts "app/(member)/me/membership/actions.test.ts"`
and `npm run ka:scan`. Expected: clean.

```bash
git add lib/funnel.ts "app/(member)/me/membership/actions.ts" "app/(member)/me/membership/actions.test.ts"
git commit -m "Membership save maps a returned personal-ID refusal (audit H1 prep)"
```

### Task 4: Release R1

**Files:**
- Modify: `DECISIONS.md` (append ADR-045, or the next free number)

- [ ] **Step 1: Write the ADR**

Append:

```markdown
## ADR-045 (2026-10-08): Phone-proof timestamps are compared to the microsecond

Security audit 2026-10-08, C1. A superseded registration challenge was marked
`consumed_at = expires_at + 1µs`; `readOwnedChallenge` compared with `Date.parse`, which drops
microseconds, so after expiry the challenge read as a validly consumed proof and the verify action
attached the phone without any code. `lib/phone-verification/timestamps.ts` parses ledger timestamps
to bigint microseconds and every comparison goes through it; an unreadable timestamp fails closed.
The database half (explicit `superseded_at`, `register()` revoked from `authenticated`) ships as R2.
```

- [ ] **Step 2: Full gates**

Run each: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run ka:scan`, `npm test`,
`npm run build`. Expected: all green. If prettier reflows a file containing Georgian, re-run the
ka-gate and `ka:scan`.

- [ ] **Step 3: Push, open the PR, bind it**

```bash
git push -u origin claude/security-phone-proof-exact
gh pr create --title "Close the phone-proof bypass (security audit C1)" --body-file <prepared body>
```

Body (plain language first, then the technical summary), ending with
`🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Bind with the ccd_pr tools
(`get_status`, then `bind_pr` if it is not reported).

- [ ] **Step 4: Review and QA**

- Run the independent per-task reviews and a whole-branch review.
- Run /qa on the demo preview: sign up through Google, prove a phone with the test provider, register.
- Confirm the unchanged happy path, plus "request a second code, enter it" still works.

- [ ] **Step 5: Owner sign-off package (plain language)**

"Before this fix, someone could attach a stranger's phone number to their own account without that
person's SMS code. After this fix, only the code sent to that phone works. Nothing changes for real
people signing up." Include the preview URL and screenshots of a normal sign-up. Wait for the
owner's explicit yes in chat.

- [ ] **Step 6: Merge after `quality` passes, verify both sites**

```bash
gh pr checks <PR>
gh pr merge <PR> --merge
```

Then:
- read the merge commit's `Vercel – georgia-republic` status;
- open https://georgia-republic.vercel.app/join and https://republic-portal.vercel.app/join and
  confirm the Google entry renders;
- report to the owner that C1 is closed on both sites.

---

## Release 2 — branch `claude/security-registration-db` (migration-only PR)

Start from main **after R1 has merged** (R2's returned-error contract needs R1's action).

### Task 5: Shared static model of the migrations

**Files:**
- Create: `lib/security/migration-model.ts`
- Test: `lib/security/migration-model.test.ts`

**Interfaces:**
- Produces:
  - `orderedMigrationSql(): string` — every `supabase/migrations/*.sql` concatenated in filename
    order;
  - `latestDefinition(fn: string): string` — the last `create [or replace] function [public.]<fn>(`
    up to its closing `$$`;
  - `lastMatchIndex(sql: string, pattern: RegExp): number` — index of the last match, or `-1`. The
    pattern must carry the `g` flag.

- [ ] **Step 1: Write the failing test**

```ts
// lib/security/migration-model.test.ts
import { describe, expect, it } from "vitest";
import { lastMatchIndex, latestDefinition, orderedMigrationSql } from "./migration-model";

describe("migration model", () => {
  it("returns the last definition of a function in filename order", () => {
    // register() was last redefined by the privacy-consent migration (four arguments)
    expect(latestDefinition("register")).toContain("p_privacy_version text default null");
  });

  it("finds the last match index, or -1", () => {
    expect(lastMatchIndex("a b a", /a/g)).toBe(4);
    expect(lastMatchIndex("abc", /z/g)).toBe(-1);
  });

  it("concatenates every migration", () => {
    expect(orderedMigrationSql()).toContain("create table public.phone_verification_challenges");
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** (`Failed to resolve import "./migration-model"`).

Run: `npx vitest run lib/security/migration-model.test.ts`

- [ ] **Step 3: Implement**

```ts
// lib/security/migration-model.ts
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Static model of the applied migrations for tests: read the real SQL, never a copy.
 * Postgres applies files in filename order, so "last in this string" = "live".
 */
const MIGRATIONS_DIR = resolve("supabase/migrations");

export function orderedMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => `\n-- file: ${file}\n${readFileSync(join(MIGRATIONS_DIR, file), "utf8")}`)
    .join("");
}

export function latestDefinition(fn: string): string {
  const sql = orderedMigrationSql();
  const header = new RegExp(`create (?:or replace )?function\\s+(?:public\\.)?${fn}\\s*\\(`, "g");
  let found: string | undefined;
  for (const match of sql.matchAll(header)) {
    const open = sql.indexOf("$$", match.index);
    const close = sql.indexOf("$$", open + 2);
    if (open < 0 || close < 0) continue;
    found = sql.slice(match.index, close);
  }
  if (found === undefined) throw new Error(`no definition of ${fn} in the migrations`);
  return found;
}

export function lastMatchIndex(sql: string, pattern: RegExp): number {
  let last = -1;
  for (const match of sql.matchAll(pattern)) last = match.index;
  return last;
}
```

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/security/migration-model.ts lib/security/migration-model.test.ts
git commit -m "Shared static model of the migrations for security tests"
```

### Task 6: Explicit supersede marker and `register()` revoked

**Files:**
- Create: `supabase/migrations/20261009100000_phone_proof_superseded_and_register_revoke.sql`
- Modify:
  - `lib/supabase/types.ts:129-160` (`phone_verification_challenges` Row/Insert/Update)
  - `lib/phone-verification/store.ts` (`ChallengeRow`, `readOwnedChallenge`)
  - `scripts/production-db-schema-check.sql:163-168` (legacy register block)
  - `.env.example:7`
- Test:
  - `lib/security/registration-hardening.test.ts` (create)
  - `lib/phone-verification/store.test.ts` (one test)

**Interfaces:**
- Consumes: `latestDefinition`, `orderedMigrationSql`, `lastMatchIndex` (Task 5).
- Produces:
  - column `phone_verification_challenges.superseded_at timestamptz`;
  - `ChallengeRow.superseded_at: string | null`;
  - `register(text,text,text,text)` is not executable by `authenticated`.

- [ ] **Step 1: Write the failing static tests**

```ts
// lib/security/registration-hardening.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lastMatchIndex, latestDefinition, orderedMigrationSql } from "./migration-model";

describe("phone proof supersede (security audit C1)", () => {
  it("marks a superseded challenge explicitly, never as consumed", () => {
    const body = latestDefinition("complete_phone_verification_send");
    expect(body).toContain("set superseded_at = v_now");
    expect(body).not.toContain("interval '1 microsecond'");
    expect(body).toContain("and superseded_at is null");
  });

  it("refuses attempts and consumption on a superseded challenge", () => {
    expect(latestDefinition("reserve_phone_verification_attempt")).toContain(
      "and superseded_at is null",
    );
    expect(latestDefinition("consume_phone_verification_challenge")).toContain(
      "and superseded_at is null",
    );
  });

  it("adds the column with its exclusivity check and backfills the old marker", () => {
    const sql = orderedMigrationSql();
    expect(sql).toMatch(/add column superseded_at timestamptz/);
    expect(sql).toMatch(/check \(consumed_at is null or superseded_at is null\)/);
    expect(sql).toMatch(
      /set superseded_at = pg_catalog\.now\(\),\s*consumed_at = null\s*where consumed_at > expires_at/,
    );
  });
});

describe("legacy register() (security audit C1)", () => {
  const sql = orderedMigrationSql();
  const signature = String.raw`(?:public\.)?register\(text, ?text, ?text, ?text\)`;

  it("ends revoked from authenticated, after every grant and every (re)definition", () => {
    const lastRevoke = lastMatchIndex(
      sql,
      new RegExp(`revoke execute on function ${signature} from [^;]*\\bauthenticated\\b`, "g"),
    );
    const lastGrant = lastMatchIndex(
      sql,
      new RegExp(`grant execute on function ${signature} to [^;]*\\bauthenticated\\b`, "g"),
    );
    const lastCreate = lastMatchIndex(sql, /create (?:or replace )?function (?:public\.)?register\s*\(/g);
    expect(lastRevoke).toBeGreaterThan(lastGrant);
    expect(lastRevoke).toBeGreaterThan(lastCreate);
  });

  it("is checked as revoked by the production schema check", () => {
    const check = readFileSync(resolve("scripts/production-db-schema-check.sql"), "utf8");
    expect(check).toContain("legacy register function is still executable by authenticated");
    expect(check).not.toContain("legacy register function privileges changed before hardening");
    expect(check).toContain("superseded_at");
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (no `superseded_at` anywhere; the last register grant still wins).

Run: `npx vitest run lib/security/registration-hardening.test.ts`

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261009100000_phone_proof_superseded_and_register_revoke.sql`:

```sql
-- Security audit 2026-10-08, C1 (database half; the exact-time check shipped in R1, ADR-045).
-- 1) A superseded challenge gets its own marker. It was encoded as
--    consumed_at = expires_at + 1µs, which millisecond JavaScript read as a valid proof.
-- 2) The legacy register() is no longer callable by clients: register_google() (SECURITY
--    DEFINER, owner-run) is the only registration path, and it checks the Google identity and
--    an exact, unsuperseded consumed proof first. Planned in 2026-08-11 plan Task 9 step 7.

alter table public.phone_verification_challenges
  add column superseded_at timestamptz,
  add constraint phone_verification_consumed_or_superseded
    check (consumed_at is null or superseded_at is null);

-- Backfill the old marker. Only a supersede can leave consumed_at > expires_at: a real consume
-- requires expires_at > now(). The real supersede time is unknown, so the backfill time is used.
update public.phone_verification_challenges
   set superseded_at = pg_catalog.now(),
       consumed_at = null
 where consumed_at > expires_at;

-- complete_phone_verification_send(): body restated verbatim from
-- 20260811182202_google_verify_phone.sql apart from the supersede UPDATE at the end.
create or replace function public.complete_phone_verification_send(
  p_reservation_id uuid,
  p_user_id uuid,
  p_provider text,
  p_provider_request_id text,
  p_expires_at timestamptz
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_phone text;
  v_linked_challenge_id uuid;
  v_challenge_id uuid;
  v_challenge_expires_at timestamptz;
begin
  select reservation.phone into v_phone
    from public.phone_verification_send_reservations as reservation
   where reservation.id = p_reservation_id
     and reservation.user_id = p_user_id;
  if not found then
    raise exception 'phone_verification_completion_failed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(8611, pg_catalog.hashtext(p_user_id::text));
  perform pg_catalog.pg_advisory_xact_lock(8612, pg_catalog.hashtext(v_phone));

  select reservation.phone, reservation.challenge_id
    into v_phone, v_linked_challenge_id
    from public.phone_verification_send_reservations as reservation
   where reservation.id = p_reservation_id
     and reservation.user_id = p_user_id
   for update;
  if not found then
    raise exception 'phone_verification_completion_failed';
  end if;

  if v_linked_challenge_id is not null then
    select challenge.id, challenge.expires_at
      into v_challenge_id, v_challenge_expires_at
      from public.phone_verification_challenges as challenge
     where challenge.id = v_linked_challenge_id
       and challenge.user_id = p_user_id
       and challenge.phone = v_phone
       and challenge.purpose = 'registration'
       and challenge.provider = p_provider
       and challenge.provider_request_id = p_provider_request_id
       and challenge.consumed_at is null
       and challenge.expires_at > v_now
     for update;
    if not found then
      raise exception 'phone_verification_completion_failed';
    end if;
  else
    select challenge.id, challenge.expires_at
      into v_challenge_id, v_challenge_expires_at
      from public.phone_verification_challenges as challenge
     where challenge.provider = p_provider
       and challenge.provider_request_id = p_provider_request_id
     for update;

    if found then
      if not exists (
        select 1
          from public.phone_verification_challenges as challenge
         where challenge.id = v_challenge_id
           and challenge.user_id = p_user_id
           and challenge.phone = v_phone
           and challenge.purpose = 'registration'
           and challenge.consumed_at is null
           and challenge.expires_at > v_now
      ) then
        raise exception 'phone_verification_completion_failed';
      end if;
    else
      if p_provider not in ('verify_ge', 'test')
         or p_provider_request_id is null
         or p_provider_request_id = ''
         or p_expires_at <= v_now then
        raise exception 'phone_verification_completion_failed';
      end if;

      insert into public.phone_verification_challenges (
        user_id, phone, purpose, provider, provider_request_id, expires_at
      ) values (
        p_user_id, v_phone, 'registration', p_provider, p_provider_request_id, p_expires_at
      ) returning id, expires_at into v_challenge_id, v_challenge_expires_at;
    end if;

    update public.phone_verification_send_reservations
       set challenge_id = v_challenge_id
     where id = p_reservation_id
       and user_id = p_user_id;
  end if;

  -- Security audit C1: an explicit marker. consumed_at stays null, so a superseded
  -- challenge can never be read as proof.
  update public.phone_verification_challenges
     set superseded_at = v_now
   where purpose = 'registration'
     and consumed_at is null
     and superseded_at is null
     and expires_at > v_now
     and id <> v_challenge_id
     and (user_id = p_user_id or phone = v_phone);

  return pg_catalog.jsonb_build_object(
    'challenge_id', v_challenge_id,
    'expires_at', v_challenge_expires_at
  );
end $$;

revoke execute on function public.complete_phone_verification_send(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.complete_phone_verification_send(uuid, uuid, text, text, timestamptz) to service_role;

create or replace function public.reserve_phone_verification_attempt(
  p_challenge_id uuid,
  p_user_id uuid
) returns smallint
language sql volatile security invoker set search_path = '' as $$
  update public.phone_verification_challenges
     set verify_attempts = verify_attempts + 1
   where id = p_challenge_id
     and user_id = p_user_id
     and consumed_at is null
     and superseded_at is null
     and expires_at > pg_catalog.now()
     and verify_attempts < 5
  returning verify_attempts;
$$;

revoke execute on function public.reserve_phone_verification_attempt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_phone_verification_attempt(uuid, uuid) to service_role;

create or replace function public.consume_phone_verification_challenge(
  p_challenge_id uuid,
  p_user_id uuid
) returns boolean
language sql volatile security invoker set search_path = '' as $$
  with consumed as (
    update public.phone_verification_challenges
       set consumed_at = pg_catalog.now()
     where id = p_challenge_id
       and user_id = p_user_id
       and consumed_at is null
       and superseded_at is null
       and expires_at > pg_catalog.now()
       and verify_attempts between 1 and 5
    returning 1
  )
  select exists(select 1 from consumed);
$$;

revoke execute on function public.consume_phone_verification_challenge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_phone_verification_challenge(uuid, uuid) to service_role;

-- 2) Legacy register(): clients go through register_google() only.
revoke execute on function public.register(text, text, text, text) from public, anon, authenticated;
```

- [ ] **Step 4: Flip the production schema check**

In `scripts/production-db-schema-check.sql`, replace the block

```sql
  -- Additive rollout: the legacy phone registration RPC remains available to
  -- authenticated users until the separately reviewed hardening migration.
  if has_function_privilege('anon', 'public.register(text,text,text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.register(text,text,text,text)', 'EXECUTE') then
    raise exception 'legacy register function privileges changed before hardening';
  end if;
```

with

```sql
  -- Security audit C1: register_google() (owner-run) is the only registration path.
  if has_function_privilege('anon', 'public.register(text,text,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.register(text,text,text,text)', 'EXECUTE') then
    raise exception 'legacy register function is still executable by authenticated';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'phone_verification_challenges'
       and column_name = 'superseded_at'
  ) then
    raise exception 'phone_verification_challenges.superseded_at is missing';
  end if;
```

- [ ] **Step 5: Types, store and `.env.example`**

`lib/supabase/types.ts`, `phone_verification_challenges`:
- add `superseded_at: string | null;` to `Row` after `consumed_at`;
- add `superseded_at?: string | null;` to `Insert` and to `Update`.

`lib/phone-verification/store.ts`: add `superseded_at: string | null;` to `ChallengeRow` after
`consumed_at`. In `readOwnedChallenge`, directly after `if (!data) return null;`:

```ts
  // R2: a superseded challenge is never usable. `typeof` keeps this safe while the column
  // does not exist yet on a database that has not received the migration (field absent).
  if (typeof data.superseded_at === "string") return null;
```

Add `superseded_at: null` to the `baseRow`/`activeRow` fixtures in `store.test.ts` and
`app/(public)/join/phone-actions.test.ts`, and add this test to `store.test.ts`:

```ts
  it("never uses a superseded challenge, live or not", async () => {
    const reader = makeReadAdmin({
      data: { ...baseRow, superseded_at: "2026-08-11T12:02:00.000Z" },
      error: null,
    });
    await expect(
      readOwnedChallenge(reader.admin, { challengeId, userId, nowIso: "2026-08-11T12:03:00.000Z" }),
    ).resolves.toBeNull();
  });
```

`.env.example` line 7: `NEXT_PUBLIC_AUTH_MODE=google`. The legacy phone registration path cannot
register once `register()` is revoked; both sites and CI already run `google`.

- [ ] **Step 6: Run the tests, expect PASS**

Run: `npx vitest run lib/security lib/phone-verification "app/(public)/join" lib/privacy.test.ts`
Expected: PASS. `lib/privacy.test.ts` still finds `public.register(text,text,text,text)` in the
check file.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261009100000_phone_proof_superseded_and_register_revoke.sql scripts/production-db-schema-check.sql lib/supabase/types.ts lib/phone-verification/store.ts lib/phone-verification/store.test.ts "app/(public)/join/phone-actions.test.ts" lib/security/registration-hardening.test.ts .env.example
git commit -m "Mark superseded phone challenges explicitly and revoke legacy register() (audit C1)"
```

### Task 7: Capped, audited personal-ID conflicts

**Files:**
- Create: `supabase/migrations/20261009100100_membership_personal_id_probe_cap.sql`
- Modify:
  - `lib/admin.ts` (`AUDIT_ACTION_LABELS_KA`)
  - `lib/admin.test.ts` ("all 29 actions" → 30, plus the new key)
- Test: `lib/security/registration-hardening.test.ts` (new `describe`)

**Interfaces:**
- Consumes:
  - `latestDefinition` (Task 5);
  - R1's returned-refusal contract and the `personal_id_attempts_exceeded` token (Task 3).
- Produces:
  - `become_member_save_profile` returns `{"error":"duplicate_personal_id"}` on a conflict;
  - it raises `personal_id_attempts_exceeded` once the account has 3 conflicts in total (no time
    window, decision D2);
  - it writes audit action `member.personal_id_conflict` (`actor_id` null,
    `target_type 'profile'`, `target_id` = the caller's id).

- [ ] **Step 1: Write the failing tests**

Append to `lib/security/registration-hardening.test.ts`:

```ts
describe("personal-ID conflicts at the membership step (security audit H1)", () => {
  const body = () => latestDefinition("become_member_save_profile");

  it("resolves the delegate before it looks at the personal ID", () => {
    const b = body();
    expect(b.indexOf("raise exception 'invalid_delegate'")).toBeGreaterThan(-1);
    expect(b.indexOf("raise exception 'invalid_delegate'")).toBeLessThan(
      b.indexOf("pr.personal_id = p_personal_id"),
    );
  });

  it("caps conflicts at three per account for good, counted from the audit log (D2)", () => {
    const b = body();
    expect(b).toContain("action = 'member.personal_id_conflict'");
    expect(b).toContain("target_id = v_uid::text");
    // no daily reset: a time window would let a patient prober keep asking
    expect(b).not.toContain("interval '24 hours'");
    expect(b).toMatch(/v_conflicts >= 3 then\s+raise exception 'personal_id_attempts_exceeded'/);
  });

  it("returns the refusal so the audit row commits, and never stores the tried ID", () => {
    const b = body();
    expect(b).toContain("return jsonb_build_object('error', 'duplicate_personal_id')");
    expect(b).not.toContain("raise exception 'duplicate_personal_id'");
    expect(b).toMatch(
      /values \(null, 'member\.personal_id_conflict', 'profile', v_uid::text, null\)/,
    );
  });
});
```

In `lib/admin.test.ts`:
- rename "all 29 actions have Georgian labels" to "all 30 actions have Georgian labels";
- add `"member.personal_id_conflict",` to the sorted list.

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run lib/security/registration-hardening.test.ts lib/admin.test.ts`

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261009100100_membership_personal_id_probe_cap.sql`:

```sql
-- Security audit 2026-10-08, H1: become_member_save_profile answered "duplicate" before it
-- checked the delegate, so a made-up delegate id rolled every probe back. One account could test
-- unlimited personal IDs, leaving no trace.
-- Now:
--   (a) every non-ID validation, delegate included, runs first;
--   (b) a conflict is RETURNED as {"error": "duplicate_personal_id"}, so its audit row commits;
--   (c) three conflicts stop the step for that account for good (decision D2: no daily reset,
--       because a reset lets a patient prober keep asking; a real person only conflicts when
--       their ID is already taken, which needs support anyway).
-- The audit row's actor_id stays NULL on purpose: audit_log.actor_id is a plain FK to profiles,
-- and a non-null actor would make the account undeletable. The tried ID is never stored.
-- Body restated from 20260728100000_personal_id_at_membership.sql; only the marked parts change.
create or replace function become_member_save_profile(
  p_birth_date date,
  p_region_id int,
  p_city_id int,
  p_employment text,
  p_delegate_id uuid default null,
  p_personal_id text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate uuid;
  v_constraint text;
  v_conflicts int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;
  if v_profile.registration_completed_at is not null
     or v_profile.status = 'active_member' then
    raise exception 'already_completed';
  end if;

  if p_birth_date is null or p_birth_date >= public.tbilisi_today()
     or p_birth_date < date '1900-01-01' then
    raise exception 'invalid_birth_date';
  end if;
  if p_employment is null or length(btrim(p_employment)) not between 1 and 100 then
    raise exception 'invalid_employment';
  end if;
  if not exists (
    select 1 from public.cities c where c.id = p_city_id and c.region_id = p_region_id
  ) then
    raise exception 'invalid_city';
  end if;

  -- H1 (a): the delegate is resolved BEFORE the personal ID is looked at.
  v_delegate := null;
  if v_profile.signup_ref_code is not null then
    select d.id into v_delegate
      from public.delegates d
      where d.referral_code = v_profile.signup_ref_code and d.status = 'approved';
  end if;
  if v_delegate is null and p_delegate_id is not null then
    select d.id into v_delegate
      from public.delegates d
      where d.id = p_delegate_id and d.status = 'approved';
    if v_delegate is null then raise exception 'invalid_delegate'; end if;
  end if;

  -- Owner fix #10: the ID is captured here. Immutable once set — a provided value for a
  -- profile that already has one is IGNORED (idempotent resume), never overwritten.
  if v_profile.personal_id is null then
    if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
      raise exception 'invalid_personal_id';
    end if;
    -- H1 (c): three conflicts, ever, stop this step for the account (decision D2).
    select count(*) into v_conflicts
      from public.audit_log a
     where a.action = 'member.personal_id_conflict'
       and a.target_id = v_uid::text;
    if v_conflicts >= 3 then
      raise exception 'personal_id_attempts_exceeded';
    end if;
    -- H1 (b): a conflict is recorded and RETURNED, so the audit row commits.
    if exists (select 1 from public.profiles pr where pr.personal_id = p_personal_id) then
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values (null, 'member.personal_id_conflict', 'profile', v_uid::text, null);
      return jsonb_build_object('error', 'duplicate_personal_id');
    end if;
  end if;

  begin
    update public.profiles set
      birth_date = p_birth_date,
      region_id = p_region_id,
      city_id = p_city_id,
      employment = btrim(p_employment),
      -- review fix F3: coalesce against the COLUMN, not v_profile.personal_id (see
      -- 20260728100000 for the full race explanation).
      personal_id = coalesce(personal_id, p_personal_id),
      pending_delegate_id = v_delegate
    where id = v_uid;
  exception when unique_violation then
    get stacked diagnostics v_constraint = CONSTRAINT_NAME;
    if v_constraint = 'profiles_personal_id_key' then
      -- H1 (b), race branch: the subtransaction undid the UPDATE; record and return.
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values (null, 'member.personal_id_conflict', 'profile', v_uid::text, null);
      return jsonb_build_object('error', 'duplicate_personal_id');
    else
      raise;
    end if;
  end;

  return public.cabinet_state();
end $$;

grant execute on function become_member_save_profile(date, int, int, text, uuid, text) to authenticated;
revoke execute on function become_member_save_profile(date, int, int, text, uuid, text) from public, anon;
```

Before committing, diff this body against `20260728100000_personal_id_at_membership.sql:123-217`.
The only differences may be:
- the delegate block moved up;
- `v_conflicts`, with its declaration and the cap;
- the two returned-refusal branches;
- the shortened F3 comment.

- [ ] **Step 4: Audit label**

`lib/admin.ts`, in `AUDIT_ACTION_LABELS_KA` after `"member.reassign"`:

```ts
  "member.personal_id_conflict": "პირადი ნომრის დამთხვევა",
```

- [ ] **Step 5: Run tests, expect PASS; Georgian gates**

Run: `npx vitest run lib/security lib/admin.test.ts`, then
`node scripts/ka-gate.mjs --diff main lib/admin.ts lib/admin.test.ts` and `npm run ka:scan`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261009100100_membership_personal_id_probe_cap.sql lib/admin.ts lib/admin.test.ts lib/security/registration-hardening.test.ts
git commit -m "Cap and audit personal-ID conflicts at the membership step (audit H1)"
```

### Task 8: Production workflow — count and pinned actions

**Files:**
- Modify: `.github/workflows/production-db.yml` (both `EXPECTED_MIGRATION_FILE_COUNT`, every `uses:`)
- Test: `lib/production-db-workflow.test.ts` (add one test)

- [ ] **Step 1: Write the failing test**

```ts
  it("pins every action to a full commit SHA (security audit H3)", () => {
    const uses = [...workflow.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const ref of uses) expect(ref).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run lib/production-db-workflow.test.ts`. Expected:
- the new test fails (tags, not SHAs);
- the count test fails (36 committed vs 38 files).

- [ ] **Step 3: Implement**

Re-resolve each tag first. Use what the API returns today, not this plan's copy:

```bash
gh api repos/actions/checkout/git/matching-refs/tags/v5 --jq '.[-1].object'
gh api repos/supabase/setup-cli/git/matching-refs/heads/v1 --jq '.[0].object.sha'
gh api repos/actions/upload-artifact/git/matching-refs/tags/v4 --jq '.[-1].object'
gh api repos/actions/download-artifact/git/matching-refs/tags/v5 --jq '.[-1].object'
```

If an `object.type` is `tag`, dereference it with `gh api repos/<o>/<r>/git/tags/<sha> --jq .object.sha`.
On 2026-10-08 the values were:
- checkout `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09`
- setup-cli `1dedf2c611547ede7232d26866dd3c56ab903bbb` (v1.7.3)
- upload-artifact `ea165f8d65b6e75b540449e92b4886f43607fa02`
- download-artifact v5 `634f93cb2916e3fdff6788551b99b062d0335ce0`

Replace each line in `production-db.yml`, keeping the tag as a comment:

```yaml
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5
      - uses: supabase/setup-cli@1dedf2c611547ede7232d26866dd3c56ab903bbb # v1.7.3
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        uses: actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0 # v5
```

Set both `EXPECTED_MIGRATION_FILE_COUNT:` values to the committed count: 38 if privacy step 2 has not
merged; one more if it has.

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run lib/production-db-workflow.test.ts lib/production-db-security-gate.test.ts lib/privacy.test.ts`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/production-db.yml lib/production-db-workflow.test.ts
git commit -m "Pin production-db actions to commit SHAs and raise the migration count"
```

### Task 9: Release R2 — PR, staging, production

- [ ] **Step 1: ADR, gates, push, PR**

Append the next ADR. Content:
- explicit `superseded_at`;
- `register()` revoked;
- personal-ID conflict cap, returned refusal, audit row with null actor (and why);
- pinned actions;
- the privacy step 2 sequencing rule (spec section 8).

Then:
- run the six gates;
- push `claude/security-registration-db`, open the PR, bind it with ccd_pr;
- the PR's e2e runs against staging **without** the migration. That must pass, because R1's code
  works either way.

- [ ] **Step 2: Owner sign-off package**

Plain language:
- "The old back-door registration is switched off."
- "A cancelled SMS code can never be reused."
- "Someone checking personal IDs gets 3 tries per account, in total; each try shows in the admin
  log as 'პირადი ნომრის დამთხვევა', and after the third the person is sent to the support page."
- "Real people see no change."

Then: preview URL, the e2e duplicate-ID journey passing, and a screenshot of the duplicate message.

- [ ] **Step 3: Merge, then apply to staging and verify**

After the owner's yes and green `quality`, merge. Apply to staging with the established staging push
(`supabase db push` against `orcxtbedkexoclbfgvzd`, never production). Then run read-only against
staging:

```sql
select has_function_privilege('authenticated', 'public.register(text,text,text,text)', 'EXECUTE') as reg_open,
       has_function_privilege('authenticated', 'public.register_google(text,text,text,text)', 'EXECUTE') as google_open;
select count(*) as old_markers from public.phone_verification_challenges where consumed_at > expires_at;
select count(*) as superseded from public.phone_verification_challenges where superseded_at is not null;
```

Expected: `reg_open = false`, `google_open = true`, `old_markers = 0`. Then run the staging e2e
journeys `e2e/membership.spec.ts` and `e2e/registration*.spec.ts`. Registration and the duplicate-ID
journey must pass.

Cleanup check: the duplicate-ID journey's user now has a `member.personal_id_conflict` row with a
null actor, so its cleanup (`deleteUser`) must still succeed. If cleanup fails with 23503, stop:
the null-actor rule was broken.

- [ ] **Step 4: Production dry run**

Dispatch `production-db.yml` from `main` with `operation=dry-run` and
`confirm_project_ref=uorvlshbrlbdnbauxsws`. Read the evidence artifact. Expected pending files:
- `20261008140000_registration_privacy_consent.sql`, if its production apply is still waiting;
- this release's two files.

Tell the owner plainly that the apply will also switch on step 1 of the privacy consent. Wait for
their yes.

- [ ] **Step 5: Apply and verify**

Dispatch `operation=apply` with the approved dry-run run id. Expected:
- the apply job succeeds, including the flipped schema check and the advisors gate;
- `georgia-republic.vercel.app/join` still renders the Google entry;
- report the run ids to the owner.

- [ ] **Step 6: Coordinate privacy step 2**

If `claude/privacy-consent-feature` is still unmerged, message its session (or note it in the PR) with
two required changes:
- its migration must be renamed to a timestamp after `20261009100100`;
- its `grant execute on function register(text, text, text, text) to authenticated;` must become
  `revoke execute on function public.register(text, text, text, text) from public, anon, authenticated;`.

`lib/security/registration-hardening.test.ts` fails on that branch until both are done.

---

## Self-review notes

- Spec sections 2 and 3 are covered by Tasks 1–3 and 5–9. H3's GitHub setting is an ops step
  outside this plan (spec section 7, D1).
- Names used across tasks:
  - `timestampMicros`, `readOwnedChallenge`, `ChallengeRow.superseded_at`;
  - `latestDefinition`, `orderedMigrationSql`, `lastMatchIndex`;
  - `personal_id_attempts_exceeded`, `member.personal_id_conflict`.
- Migration file names are fixed in Tasks 6 and 7. The count in Task 8 depends on whether privacy
  step 2 merged first.
