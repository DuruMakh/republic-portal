# Phase 4 — Admin CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the movement its operational cockpit — `/admin` with delegate verification (approve mints the public slug; delegate + referral link go live instantly), member management with audited CSV export and audited personal-ID reveals, payment recording (single entry + bulk paste matching by GR-XXXXXX) feeding a new active-member derivation engine that replaces the staging seed as the only writer of active status, orphan reassignment, DB-enforced RBAC (super_admin / verifier / finance / editor), and an append-only audit log with a viewer.

**Architecture:** "Locks in the database" (ADR-014, extends ADR-009/ADR-013): every admin **read** goes through a self-gating SECURITY-DEFINER-style view that returns zero rows to non-admins and physically contains no `personal_id`/`birth_date` column; every admin **mutation** is a SECURITY DEFINER RPC that re-checks the caller's specific role and writes its `audit_log` row in the same transaction. The active-member engine (ADR-015) lives in SQL functions (30-day coverage months × `months_covered`, min 1, stacking, configurable grace) with a TS mirror in `lib/active.ts` for previews and shared test fixtures; a nightly pg_cron sweep demotes lapsed members. Admin pages are per-request server components behind a layout gate (`/admin` has been service-worker NetworkOnly since Phase 0 — verified `app/sw.ts:27`), with small client islands for interactivity.

**Tech Stack:** Next.js 16 (App Router), TypeScript 6 strict, Tailwind 4, Supabase (`@supabase/ssr`, definer views + RPCs, Storage, pg_cron), zod, Vitest + Testing Library, Playwright. **Zero new npm dependencies.**

**Spec:** `docs/superpowers/specs/2026-07-17-phase-4-admin-crm-design.md` — binding. UX reference: `prototype/index.html` screens `admin-overview`, `admin-members`, `admin-verify`, `admin-transfer`, `admin-finances` (markup ~912–1136, logic ~1966–2199; approved deviations listed in the spec header).

## Global Constraints

- TypeScript `strict: true`; **no `any`, no `@ts-ignore`**. `noUncheckedIndexedAccess` is on — index access yields `T | undefined`; use `!` only where a regex/loop invariant guarantees presence, with a comment.
- Domain logic = pure functions in `lib/` — no React/Next imports there (`lib/supabase/` is the sanctioned data-access location).
- **All user-facing text Georgian**; admin register is dense/utilitarian (DESIGN.md: calm surfaces, red only for primary actions). Reuse design-system components; extend, never restyle ad hoc. Georgian typographic quotes are `„ “` (U+201E/U+201C) — byte-exact; never "normalize" them to ASCII.
- Schema changes ONLY via `supabase/migrations/`. Local dev + previews + CI all use the STAGING Supabase project (`orcxtbedkexoclbfgvzd`).
- **Zero new npm dependencies this phase.** CSV, statement parsing, storage and cron are hand-rolled or platform-side.
- zod validation at every boundary: the same schemas drive client forms and server actions; the DB re-validates inside RPCs/grants/RLS. Server is the source of truth.
- **Every admin mutation is a definer RPC that writes `audit_log` in the same transaction.** No admin page ever reads via the service-role client; the service key appears in exactly one new app path — the photo-upload server action (behind an app-side role precheck, paired with an in-DB re-checking RPC).
- Statuses/counters stay derived. `profiles.status` is written ONLY by the engine functions (and the funnel's draft→profile_completed step). `payments.months_covered` is a GENERATED column — never written by anyone.
- **Engine semantics single source:** SQL (`active_coverage` + friends, Task 6) and TS (`lib/active.ts`, Task 1) must implement identical date math: `coverage_end = greatest(prev_end, paid_at) + months × 30 days`, active iff `today ≤ coverage_end + grace_days`, grace default 30. The §Task-1 test dates are the shared fixtures; the Task 10 probe replays them against SQL.
- TDD: write the failing test first, run it, watch it fail, then implement. Frequent commits (conventional style); each task ends committed.
- **Run `npm run format` before every commit** — CI's `format:check` is strict; prettier must only reformat files you touched.
- Working directory: repo root (worktree branch `claude/phase-4-admin-crm-1fd359`).
- The canonical staging seed must never be disturbed by e2e: per-run `55XXXXXXX` phones + `9…`-prefixed personal IDs only. **Canonical seed admins (Task 9): super `+995509000001`, verifier `+995509000002`, finance `+995509000003`, editor `+995509000004`** — e2e/probes log in as these for audited actions.
- **Audit-actor deletability invariant:** `audit_log.actor_id` FK has no cascade and the append-only trigger blocks even `ON DELETE SET NULL` — a user who ever ACTS as an admin becomes undeletable. Therefore: e2e per-run users and probe throwaway users must NEVER be granted admin roles or perform audited actions; only canonical seed admins act. Throwaways/e2e users may only be TARGETS (audit stores targets as text — safe).
- Migration → staging → seed rewrite → probes green → e2e in CI (Phases 1–3 discipline). The migration applies via the same documented pooler procedure as Phase 3 (see `docs/superpowers/plans/2026-07-15-supabase-staging-connection.md`); the owner supplies `SUPABASE_DB_PASSWORD` in `.env.local` when the apply step is reached and deletes it afterwards.

## File Structure

```
lib/
  active.ts / active.test.ts             — engine TS mirror (Task 1)
  bank-parse.ts / bank-parse.test.ts     — statement-paste parser (Task 2)
  csv.ts / csv.test.ts                   — CSV builder + member export shape (Task 3)
  admin.ts / admin.test.ts               — roles, tabs, audit labels, bar math (Task 4)
  admin-schemas.ts / admin-schemas.test.ts — zod for every admin boundary (Task 5)
  funnel.ts (modify)                     — FunnelState.admin + new error tokens (Task 4)
  cabinet.ts (modify)                    — admin cabinet-nav item + paymentStatusKa (Tasks 11, 24)
  supabase/types.ts (modify)             — new tables/views/RPCs (Task 6)
  supabase/server.ts (modify)            — getAdminRoles() (Task 11)
supabase/migrations/
  20260717150000_admin_crm.sql           — everything §4 of the spec (Task 6)
scripts/
  verify-schema.mjs (modify)             — Phase 4 probes (Task 10)
  grant-admin.mjs                        — bootstrap super_admin (Task 8)
  seed-staging.mjs (modify)              — payments + derived statuses + admins (Task 9)
app/(admin)/
  layout.tsx                             — session + any-admin gate (Task 11)
  error.tsx                              — route-group error boundary (Task 11)
  admin/page.tsx                         — მიმოხილვა (Task 12)
  admin/members/page.tsx + RevealPersonalId.tsx + actions.ts (Task 13)
  admin/members/export/route.ts + ExportControls.tsx (Task 14)
  admin/verify/page.tsx + VerifyCard.tsx + actions.ts (Task 15)
  admin/verify/[id]/page.tsx + DelegateProfileForm.tsx + actions.ts (Task 16)
  admin/finances/page.tsx + types.ts + RecordPayment.tsx + BulkMatch.tsx + VoidPaymentButton.tsx + actions.ts (Tasks 17–19)
  admin/transfer/page.tsx + ReassignRow.tsx + actions.ts (Task 20)
  admin/admins/page.tsx + GrantRoleForm.tsx + RevokeRoleButton.tsx + actions.ts (Task 21)
  admin/audit/page.tsx                   — server-only viewer (Task 22)
  admin/settings/page.tsx + SettingsForm.tsx + actions.ts (Task 23)
components/
  AdminNav.tsx / AdminNav.test.tsx       — role-filtered admin tabs + sign-out (Task 11)
app/(member)/me/billing/page.tsx (modify) — voided rows (Task 24)
components/CabinetNav.tsx (no change) — link arrives via cabinetNavItems (Task 11)
e2e/
  admin-helpers.ts                       — canonical-admin login + phase-4 phones (Task 25)
  admin-approval.spec.ts                 — critical flow 1 (Task 25)
  admin-payments.spec.ts                 — critical flow 2 (Task 26)
  admin-rbac.spec.ts                     — RBAC smoke (Task 27)
ARCHITECTURE.md / DESIGN.md / DECISIONS.md / CHANGELOG.md / package.json (Task 28)
app/api/cron/active-sweep/route.ts + vercel.json — ONLY if the pg_cron fallback is taken (Task 7)
```

Route-group note: `(admin)` carries the URL prefix inside it (`app/(admin)/admin/…` → `/admin/…`), exactly like `(member)/me` and `(delegate)/delegate`.

---

### Task 1: Engine TS mirror — `lib/active.ts`

**Files:**
- Create: `lib/active.ts`
- Create: `lib/active.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (consumed by Task 10's probe fixtures and Tasks 17–18):
  - `COVERAGE_DAYS_PER_MONTH = 30`, `DEFAULT_GRACE_DAYS = 30`
  - `monthsFor(amountGel: number, tierGel: number): number` — `max(1, floor(amount/tier))`; `0` when either input is not a positive finite number (preview renders „—“).
  - `interface CoveragePayment { paidAt: string; monthsCovered: number; voidedAt: string | null }` (`paidAt` is `YYYY-MM-DD`)
  - `interface CoverageResult { coverageEnd: string | null; activeUntil: string | null; isActive: boolean }`
  - `computeCoverage(payments: readonly CoveragePayment[], graceDays: number, today: string): CoverageResult`
  - `addDaysIso(isoDate: string, days: number): string` (exported — Task 9's seed math reuses it conceptually; tests use it)

- [ ] **Step 1: Write the failing test — `lib/active.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  computeCoverage,
  COVERAGE_DAYS_PER_MONTH,
  DEFAULT_GRACE_DAYS,
  monthsFor,
  type CoveragePayment,
} from "./active";

function pay(paidAt: string, monthsCovered: number, voidedAt: string | null = null): CoveragePayment {
  return { paidAt, monthsCovered, voidedAt };
}

describe("monthsFor (spec §2 #2)", () => {
  it("exact tier buys one month", () => {
    expect(monthsFor(20, 20)).toBe(1);
    expect(monthsFor(5, 5)).toBe(1);
  });
  it("amount buys whole months, rounded down", () => {
    expect(monthsFor(60, 20)).toBe(3);
    expect(monthsFor(50, 20)).toBe(2);
    expect(monthsFor(30, 20)).toBe(1);
    expect(monthsFor(10, 5)).toBe(2);
  });
  it("underpayment still buys the minimum 1 month", () => {
    expect(monthsFor(5, 20)).toBe(1);
    expect(monthsFor(0.01, 20)).toBe(1);
  });
  it("invalid inputs → 0 (preview shows „—“)", () => {
    expect(monthsFor(0, 20)).toBe(0);
    expect(monthsFor(-5, 20)).toBe(0);
    expect(monthsFor(20, 0)).toBe(0);
    expect(monthsFor(Number.NaN, 20)).toBe(0);
    expect(monthsFor(20, Number.NaN)).toBe(0);
  });
});

describe("addDaysIso", () => {
  it("adds days across month/year boundaries", () => {
    expect(addDaysIso("2026-07-01", 30)).toBe("2026-07-31");
    expect(addDaysIso("2026-12-15", 30)).toBe("2027-01-14");
    expect(addDaysIso("2026-07-31", 0)).toBe("2026-07-31");
  });
});

describe("computeCoverage (spec §2 #1–2 — the owner-approved date examples, verbatim)", () => {
  it("constants match the spec", () => {
    expect(COVERAGE_DAYS_PER_MONTH).toBe(30);
    expect(DEFAULT_GRACE_DAYS).toBe(30);
  });

  it("single monthly payment = active exactly 60 days (spec example 1)", () => {
    // tier 20, pays 20 ₾ on 1 ივლისი → covered through 31 ივლისი → active until 30 აგვისტო
    const r = computeCoverage([pay("2026-07-01", 1)], 30, "2026-07-01");
    expect(r.coverageEnd).toBe("2026-07-31");
    expect(r.activeUntil).toBe("2026-08-30");
    expect(r.isActive).toBe(true);
    expect(computeCoverage([pay("2026-07-01", 1)], 30, "2026-08-30").isActive).toBe(true);
    expect(computeCoverage([pay("2026-07-01", 1)], 30, "2026-08-31").isActive).toBe(false);
  });

  it("60 ₾ on tier 20 → covered through 29 სექტემბერი, active until 29 ოქტომბერი (spec example 2)", () => {
    const r = computeCoverage([pay("2026-07-01", 3)], 30, "2026-07-01");
    expect(r.coverageEnd).toBe("2026-09-29");
    expect(r.activeUntil).toBe("2026-10-29");
  });

  it("payments stack — paying early never wastes days (spec example 3)", () => {
    // 20 ₾ on 1 ივლისი + 20 ₾ on 15 ივლისი → covered through 30 აგვისტო, active until 29 სექტემბერი
    const r = computeCoverage([pay("2026-07-01", 1), pay("2026-07-15", 1)], 30, "2026-07-20");
    expect(r.coverageEnd).toBe("2026-08-30");
    expect(r.activeUntil).toBe("2026-09-29");
  });

  it("a payment after a lapse restarts from its own date, not the stale end", () => {
    const r = computeCoverage([pay("2026-01-01", 1), pay("2026-07-01", 1)], 30, "2026-07-02");
    expect(r.coverageEnd).toBe("2026-07-31");
  });

  it("voided payments are excluded", () => {
    const r = computeCoverage(
      [pay("2026-07-01", 1), pay("2026-07-15", 1, "2026-07-16T10:00:00Z")],
      30,
      "2026-07-20",
    );
    expect(r.coverageEnd).toBe("2026-07-31");
  });

  it("input order does not matter (sorted by paidAt internally)", () => {
    const sorted = computeCoverage([pay("2026-07-01", 1), pay("2026-07-15", 1)], 30, "2026-07-20");
    const shuffled = computeCoverage([pay("2026-07-15", 1), pay("2026-07-01", 1)], 30, "2026-07-20");
    expect(shuffled).toEqual(sorted);
  });

  it("no live payments → inactive, null dates", () => {
    expect(computeCoverage([], 30, "2026-07-01")).toEqual({
      coverageEnd: null,
      activeUntil: null,
      isActive: false,
    });
    expect(
      computeCoverage([pay("2026-07-01", 1, "2026-07-02T00:00:00Z")], 30, "2026-07-03").isActive,
    ).toBe(false);
  });

  it("grace 0 → active exactly through coverage end", () => {
    expect(computeCoverage([pay("2026-07-01", 1)], 0, "2026-07-31").isActive).toBe(true);
    expect(computeCoverage([pay("2026-07-01", 1)], 0, "2026-08-01").isActive).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/active.test.ts`
Expected: FAIL — `Cannot find module './active'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation — `lib/active.ts`**

```ts
/**
 * TS mirror of the active-member engine (spec §2 #1–2, §4.4; ADR-015). The SQL
 * functions in 20260717150000_admin_crm.sql implement the SAME date math — the
 * test dates in active.test.ts are the shared fixtures the schema probe replays
 * against SQL. Date-only arithmetic (YYYY-MM-DD strings), no timezones.
 */

export const COVERAGE_DAYS_PER_MONTH = 30;
export const DEFAULT_GRACE_DAYS = 30;

/** Whole months a payment buys: floor(amount ÷ tier), minimum 1. 0 = not computable. */
export function monthsFor(amountGel: number, tierGel: number): number {
  if (!Number.isFinite(amountGel) || !Number.isFinite(tierGel)) return 0;
  if (amountGel <= 0 || tierGel <= 0) return 0;
  return Math.max(1, Math.floor(amountGel / tierGel));
}

export interface CoveragePayment {
  paidAt: string; // YYYY-MM-DD
  monthsCovered: number;
  voidedAt: string | null;
}

export interface CoverageResult {
  coverageEnd: string | null; // last covered day (YYYY-MM-DD)
  activeUntil: string | null; // coverageEnd + grace — last ACTIVE day
  isActive: boolean;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  // constructing via Date.UTC keeps this ICU/timezone-free (house lesson: formatDateKa)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

export function computeCoverage(
  payments: readonly CoveragePayment[],
  graceDays: number,
  today: string,
): CoverageResult {
  const live = payments
    .filter((p) => p.voidedAt === null && p.monthsCovered > 0)
    .slice()
    .sort((a, b) => (a.paidAt < b.paidAt ? -1 : a.paidAt > b.paidAt ? 1 : 0));

  let end: string | null = null;
  for (const p of live) {
    // stack: extend from the later of current coverage end and the payment's own date
    const base = end === null || p.paidAt > end ? p.paidAt : end;
    end = addDaysIso(base, p.monthsCovered * COVERAGE_DAYS_PER_MONTH);
  }
  if (end === null) return { coverageEnd: null, activeUntil: null, isActive: false };
  const activeUntil = addDaysIso(end, graceDays);
  // ISO date strings compare correctly as strings
  return { coverageEnd: end, activeUntil, isActive: today <= activeUntil };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/active.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck && npm run format
git add lib/active.ts lib/active.test.ts
git commit -m "feat(admin): active-member engine TS mirror (months, stacking, grace)"
```

### Task 2: Statement-paste parser — `lib/bank-parse.ts`

**Files:**
- Create: `lib/bank-parse.ts`
- Create: `lib/bank-parse.test.ts`

**Interfaces:**
- Consumes: `FUNNEL_CODE_ALPHABET` from `lib/funnel.ts` (exported there: `"ABCDEFGHJKMNPQRSTUVWXYZ23456789"`).
- Produces (consumed by Task 18's preview action and its component):
  - `type ParserProblem = "no_code" | "no_amount" | "ambiguous_amount"`
  - `interface ParsedStatementRow { index: number; line: string; code: string | null; amountGel: number | null; paidAt: string | null; duplicateOfIndex: number | null; problems: ParserProblem[] }`
  - `parseStatementRows(text: string): ParsedStatementRow[]`

Parser contract (spec §5, deliberately **conservative** — never guess):
- One row per non-empty line. `code`: first `GR-XXXXXX` match (hyphen optional, any case → normalized to `GR-` + uppercase); missing → problem `no_code`.
- `amountGel`: prefer decimal-formatted candidates (dot or comma decimals, exactly 2 digits, optional space-thousands). Exactly one decimal candidate → that's the amount. None → fall back to standalone 1–5-digit integers with value ≤ 10000 (after stripping the code and date substrings so `2026` or code digits never count). More than one candidate at whichever stage decided → `ambiguous_amount`; zero overall → `no_amount`.
- `paidAt`: first `dd.mm.yyyy` or `yyyy-mm-dd` token that survives a plausibility check (month 01–12, day 01–31) → normalized `YYYY-MM-DD`; absent → `null` (the recording flow substitutes today).
- `duplicateOfIndex`: a later line whose trimmed text is byte-identical to an earlier one points at the first occurrence (UI collapses it; it is never recorded twice from one paste).

- [ ] **Step 1: Write the failing test — `lib/bank-parse.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseStatementRows } from "./bank-parse";

describe("parseStatementRows (spec §3.5, §5)", () => {
  it("extracts code, decimal amount and date from a TSV bank row", () => {
    const [r] = parseStatementRows("01.07.2026\tDOC123456\t20.00\tგადმორიცხვა GR-ABC234 საწევრო");
    expect(r!.code).toBe("GR-ABC234");
    expect(r!.amountGel).toBe(20);
    expect(r!.paidAt).toBe("2026-07-01");
    expect(r!.problems).toEqual([]);
  });

  it("normalizes lowercase and hyphen-less codes", () => {
    const rows = parseStatementRows("gr-abc234 20.00\nGRKMN789 5.00");
    expect(rows[0]!.code).toBe("GR-ABC234");
    expect(rows[1]!.code).toBe("GR-KMN789");
  });

  it("comma decimals and space-thousands parse (Georgian bank exports)", () => {
    const rows = parseStatementRows("GR-ABC234 60,00\nGR-KMN789 1 234,56");
    expect(rows[0]!.amountGel).toBe(60);
    expect(rows[1]!.amountGel).toBe(1234.56);
  });

  it("integer fallback works when no decimal-formatted number exists", () => {
    const [r] = parseStatementRows("GR-ABC234 საწევრო 20");
    expect(r!.amountGel).toBe(20);
    expect(r!.problems).toEqual([]);
  });

  it("date fragments and the code never masquerade as the amount", () => {
    // 2026 (year), 234 (code digits) must not be amount candidates; 20 is the amount
    const [r] = parseStatementRows("01.07.2026 GR-ABC234 20");
    expect(r!.amountGel).toBe(20);
    expect(r!.paidAt).toBe("2026-07-01");
  });

  it("two plausible decimal amounts → ambiguous_amount, never a guess", () => {
    const [r] = parseStatementRows("GR-ABC234 balance 100.00 amount 20.00");
    expect(r!.amountGel).toBeNull();
    expect(r!.problems).toContain("ambiguous_amount");
  });

  it("two plausible integers → ambiguous_amount", () => {
    const [r] = parseStatementRows("GR-ABC234 20 40");
    expect(r!.amountGel).toBeNull();
    expect(r!.problems).toContain("ambiguous_amount");
  });

  it("no amount at all → no_amount", () => {
    const [r] = parseStatementRows("GR-ABC234 საწევრო გადარიცხვა");
    expect(r!.amountGel).toBeNull();
    expect(r!.problems).toContain("no_amount");
  });

  it("missing code → no_code (amount still extracted for display)", () => {
    const [r] = parseStatementRows("01.07.2026 გადმორიცხვა 20.00 უცნობი");
    expect(r!.code).toBeNull();
    expect(r!.amountGel).toBe(20);
    expect(r!.problems).toContain("no_code");
  });

  it("iso dates parse; implausible dates are ignored", () => {
    expect(parseStatementRows("GR-ABC234 20.00 2026-07-15")[0]!.paidAt).toBe("2026-07-15");
    expect(parseStatementRows("GR-ABC234 20.00 99.99.2026")[0]!.paidAt).toBeNull();
  });

  it("identical duplicate lines collapse onto the first occurrence", () => {
    const rows = parseStatementRows("GR-ABC234 20.00 01.07.2026\nGR-ABC234 20.00 01.07.2026");
    expect(rows[0]!.duplicateOfIndex).toBeNull();
    expect(rows[1]!.duplicateOfIndex).toBe(0);
  });

  it("blank lines are skipped; indexes are sequential over kept lines", () => {
    const rows = parseStatementRows("\nGR-ABC234 20.00\n\n  \nGR-KMN789 5.00\n");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.index)).toEqual([0, 1]);
  });

  it("codes with excluded letters (I, L, O) or wrong length do not match", () => {
    const rows = parseStatementRows("GR-ABCIL0 20.00\nGR-ABC23 20.00");
    expect(rows[0]!.code).toBeNull();
    expect(rows[1]!.code).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/bank-parse.test.ts`
Expected: FAIL — cannot resolve `./bank-parse`.

- [ ] **Step 3: Write the implementation — `lib/bank-parse.ts`**

```ts
/**
 * Bulk-matching paste parser (spec §3.5, §5). Conservative by design: when a
 * line offers more than one plausible amount the row is flagged, never guessed —
 * finance resolves flagged rows via single entry. DB-dependent classification
 * (unknown code, duplicate reference, incomplete registration) happens in the
 * preview server action, not here.
 */
import { FUNNEL_CODE_ALPHABET } from "./funnel";

export type ParserProblem = "no_code" | "no_amount" | "ambiguous_amount";

export interface ParsedStatementRow {
  index: number;
  line: string;
  code: string | null;
  amountGel: number | null;
  paidAt: string | null;
  duplicateOfIndex: number | null;
  problems: ParserProblem[];
}

// hyphen optional, any case; captured body normalized to GR-UPPER
const CODE_RE = new RegExp(`GR-?([${FUNNEL_CODE_ALPHABET}]{6})`, "i");
// dd.mm.yyyy or yyyy-mm-dd
const DATE_DOT_RE = /\b(\d{2})\.(\d{2})\.(\d{4})\b/;
const DATE_ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
// decimals: optional space-thousands, dot/comma + exactly two digits
const DECIMAL_RE = /(?<![\d.,])\d{1,3}(?: \d{3})*[.,]\d{2}(?![\d.,])/g;
// integer fallback: standalone 1–5 digit runs
const INT_RE = /(?<![\d.,])\d{1,5}(?![\d.,])/g;

function plausibleDate(y: number, m: number, d: number): boolean {
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function extractDate(line: string): { iso: string; raw: string } | null {
  const dot = DATE_DOT_RE.exec(line);
  if (dot) {
    const [raw, dd, mm, yyyy] = dot;
    if (plausibleDate(Number(yyyy), Number(mm), Number(dd)))
      return { iso: `${yyyy}-${mm}-${dd}`, raw };
  }
  const iso = DATE_ISO_RE.exec(line);
  if (iso) {
    const [raw, yyyy, mm, dd] = iso;
    if (plausibleDate(Number(yyyy), Number(mm), Number(dd)))
      return { iso: `${yyyy}-${mm}-${dd}`, raw };
  }
  return null;
}

function toAmount(token: string): number {
  return Number(token.replaceAll(" ", "").replace(",", "."));
}

function parseLine(line: string, index: number): ParsedStatementRow {
  const problems: ParserProblem[] = [];

  const codeMatch = CODE_RE.exec(line);
  const code = codeMatch ? `GR-${codeMatch[1]!.toUpperCase()}` : null;
  if (!code) problems.push("no_code");

  const date = extractDate(line);

  // strip code + date substrings so their digits never become amount candidates
  let cleaned = line;
  if (codeMatch) cleaned = cleaned.replace(codeMatch[0], " ");
  if (date) cleaned = cleaned.replace(date.raw, " ");

  let amountGel: number | null = null;
  const decimals = [...cleaned.matchAll(DECIMAL_RE)].map((m) => toAmount(m[0]));
  const plausibleDecimals = decimals.filter((n) => n > 0 && n <= 10000);
  if (plausibleDecimals.length === 1) {
    amountGel = plausibleDecimals[0]!;
  } else if (plausibleDecimals.length > 1) {
    problems.push("ambiguous_amount");
  } else {
    const ints = [...cleaned.matchAll(INT_RE)]
      .map((m) => Number(m[0]))
      .filter((n) => n > 0 && n <= 10000);
    if (ints.length === 1) amountGel = ints[0]!;
    else if (ints.length > 1) problems.push("ambiguous_amount");
    else problems.push("no_amount");
  }

  return { index, line, code, amountGel, paidAt: date?.iso ?? null, duplicateOfIndex: null, problems };
}

export function parseStatementRows(text: string): ParsedStatementRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const rows = lines.map(parseLine).map((row, index) => ({ ...row, index }));
  const seen = new Map<string, number>();
  for (const row of rows) {
    const prior = seen.get(row.line);
    if (prior !== undefined) row.duplicateOfIndex = prior;
    else seen.set(row.line, row.index);
  }
  return rows;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/bank-parse.test.ts`
Expected: PASS. (If the lookbehind regexes trip the linter, they are supported — Node ≥22 per `package.json` engines.)

- [ ] **Step 5: Full unit suite, format, commit**

```bash
npx vitest run && npm run typecheck && npm run format
git add lib/bank-parse.ts lib/bank-parse.test.ts
git commit -m "feat(admin): conservative bank-statement paste parser"
```

---

### Task 3: CSV builder + member-export shape — `lib/csv.ts`

**Files:**
- Create: `lib/csv.ts`
- Create: `lib/csv.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (consumed by Task 13's export route):
  - `csvEscape(value: string): string`
  - `toCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string` — UTF-8 BOM prefix + CRLF line endings (Excel-compatible Georgian).
  - `interface MemberExportRow { firstName: string; lastName: string; phone: string | null; regionNameKa: string | null; cityNameKa: string | null; delegateName: string | null; statusKa: string; tier: number | null; referenceCode: string | null; registeredAt: string; personalId?: string | null }`
  - `memberExportHeaders(includeIds: boolean): string[]`
  - `memberExportCsv(rows: readonly MemberExportRow[], includeIds: boolean): string`
  - `exportFileName(todayIso: string): string` — `tsevrebi-YYYYMMDD.csv`

- [ ] **Step 1: Write the failing test — `lib/csv.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  csvEscape,
  exportFileName,
  memberExportCsv,
  memberExportHeaders,
  toCsv,
  type MemberExportRow,
} from "./csv";

describe("csvEscape (RFC 4180)", () => {
  it("passes plain values through", () => {
    expect(csvEscape("ნინო")).toBe("ნინო");
  });
  it("quotes separators, quotes and newlines; doubles inner quotes", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('სახ "ზედმეტი"')).toBe('"სახ ""ზედმეტი"""');
    expect(csvEscape("ორი\nხაზი")).toBe('"ორი\nხაზი"');
  });
});

describe("toCsv", () => {
  it("BOM + CRLF + header row (Excel opens Georgian correctly)", () => {
    const csv = toCsv(["ა", "ბ"], [["1", "2"]]);
    expect(csv.startsWith("FEFF")).toBe(true);
    expect(csv).toBe("FEFFა,ბ\r\n1,2\r\n");
  });
});

const row: MemberExportRow = {
  firstName: "ნინო",
  lastName: "ბერიძე",
  phone: "+995550001122",
  regionNameKa: "იმერეთი",
  cityNameKa: "ქუთაისი",
  delegateName: null,
  statusKa: "აქტიური",
  tier: 20,
  referenceCode: "GR-ABC234",
  registeredAt: "2026-07-01",
};

describe("member export (spec §3.3)", () => {
  it("headers without IDs end at the registration date", () => {
    expect(memberExportHeaders(false)).toEqual([
      "სახელი",
      "გვარი",
      "ტელეფონი",
      "რეგიონი",
      "ქალაქი",
      "დელეგატი",
      "სტატუსი",
      "საწევრო",
      "კოდი",
      "რეგისტრაციის თარიღი",
    ]);
  });
  it("includeIds appends the personal-ID column", () => {
    expect(memberExportHeaders(true)).toEqual([...memberExportHeaders(false), "პირადი ნომერი"]);
  });
  it("null delegate renders as ცენტრალური მოძრაობა; null cells render empty", () => {
    const csv = memberExportCsv([row], false);
    expect(csv).toContain("ცენტრალური მოძრაობა");
    expect(csv).not.toContain("null");
  });
  it("personal IDs appear only when included", () => {
    const withId = memberExportCsv([{ ...row, personalId: "01234567890" }], true);
    const withoutId = memberExportCsv([{ ...row, personalId: "01234567890" }], false);
    expect(withId).toContain("01234567890");
    expect(withoutId).not.toContain("01234567890");
  });
});

describe("exportFileName", () => {
  it("stamps the date", () => {
    expect(exportFileName("2026-07-17")).toBe("tsevrebi-20260717.csv");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/csv.test.ts`
Expected: FAIL — cannot resolve `./csv`.

- [ ] **Step 3: Write the implementation — `lib/csv.ts`**

```ts
/**
 * CSV export (spec §3.3, decision #4): UTF-8 BOM + CRLF so Excel renders
 * Georgian correctly out of a double-click. Generic roster CSV — the
 * Ministry-of-Justice template is a deferred follow-up (spec §9).
 */

export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const lines = [headers, ...rows].map((cells) => cells.map(csvEscape).join(","));
  // explicit escape — an invisible literal BOM would not survive copy-paste review
  return `FEFF${lines.join("\r\n")}\r\n`;
}

export interface MemberExportRow {
  firstName: string;
  lastName: string;
  phone: string | null;
  regionNameKa: string | null;
  cityNameKa: string | null;
  delegateName: string | null; // null = ცენტრალური მოძრაობა
  statusKa: string;
  tier: number | null;
  referenceCode: string | null;
  registeredAt: string;
  personalId?: string | null;
}

const BASE_HEADERS = [
  "სახელი",
  "გვარი",
  "ტელეფონი",
  "რეგიონი",
  "ქალაქი",
  "დელეგატი",
  "სტატუსი",
  "საწევრო",
  "კოდი",
  "რეგისტრაციის თარიღი",
] as const;

export function memberExportHeaders(includeIds: boolean): string[] {
  return includeIds ? [...BASE_HEADERS, "პირადი ნომერი"] : [...BASE_HEADERS];
}

export function memberExportCsv(
  rows: readonly MemberExportRow[],
  includeIds: boolean,
): string {
  const body = rows.map((r) => {
    const cells = [
      r.firstName,
      r.lastName,
      r.phone ?? "",
      r.regionNameKa ?? "",
      r.cityNameKa ?? "",
      r.delegateName ?? "ცენტრალური მოძრაობა",
      r.statusKa,
      r.tier === null ? "" : String(r.tier),
      r.referenceCode ?? "",
      r.registeredAt,
    ];
    if (includeIds) cells.push(r.personalId ?? "");
    return cells;
  });
  return toCsv(memberExportHeaders(includeIds), body);
}

export function exportFileName(todayIso: string): string {
  return `tsevrebi-${todayIso.replaceAll("-", "")}.csv`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/csv.test.ts`
Expected: PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add lib/csv.ts lib/csv.test.ts
git commit -m "feat(admin): BOM+CRLF CSV builder and member-export shape"
```

### Task 4: Admin domain vocabulary — `lib/admin.ts` + `lib/funnel.ts` riders

**Files:**
- Create: `lib/admin.ts`
- Create: `lib/admin.test.ts`
- Modify: `lib/funnel.ts` (FunnelState + error tokens)
- Modify: `lib/funnel.test.ts` (new-token mapping tests)
- Modify: `lib/cabinet.test.ts` (the `state()` factory gains `admin: false`)

**Interfaces:**
- Consumes: `MemberStatusRow` from `lib/supabase/types.ts` (exists).
- Produces (consumed by Tasks 5, 11–23):
  - `type AdminRole = "super_admin" | "verifier" | "finance" | "editor"`
  - `ADMIN_ROLE_VALUES: readonly ["super_admin", "verifier", "finance", "editor"]`
  - `ROLE_LABELS_KA: Record<AdminRole, string>`, `ROLE_DUTIES_KA: Record<AdminRole, string>`
  - `isStaff(roles: readonly AdminRole[]): boolean` — true for super_admin/verifier/finance (deliberately not editor)
  - `interface AdminTab { href: string; label: string }`, `adminTabs(roles: readonly AdminRole[]): AdminTab[]`
  - `MEMBER_STATUS_LABELS_KA: Record<MemberStatusRow, string>` (all three statuses — the member list/export vocabulary)
  - `AUDIT_ACTION_LABELS_KA: Record<string, string>` (the 14-action taxonomy), `auditActionLabel(action: string): string`
  - `TARGET_TYPE_LABELS_KA: Record<string, string>`
  - `barPct(count: number, max: number): number`
  - `lib/funnel.ts`: `FunnelState` gains `admin: boolean`; `mapFunnelError` learns 12 new tokens (below).

- [ ] **Step 1: Write the failing test — `lib/admin.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_VALUES,
  adminTabs,
  AUDIT_ACTION_LABELS_KA,
  auditActionLabel,
  barPct,
  isStaff,
  MEMBER_STATUS_LABELS_KA,
  ROLE_LABELS_KA,
} from "./admin";

describe("adminTabs (spec §3.1 role → tab matrix)", () => {
  it("super_admin sees all eight tabs in order", () => {
    expect(adminTabs(["super_admin"]).map((t) => t.href)).toEqual([
      "/admin",
      "/admin/members",
      "/admin/verify",
      "/admin/finances",
      "/admin/transfer",
      "/admin/admins",
      "/admin/audit",
      "/admin/settings",
    ]);
  });
  it("verifier: overview, members, verify, transfer", () => {
    expect(adminTabs(["verifier"]).map((t) => t.href)).toEqual([
      "/admin",
      "/admin/members",
      "/admin/verify",
      "/admin/transfer",
    ]);
  });
  it("finance: overview, members, finances", () => {
    expect(adminTabs(["finance"]).map((t) => t.href)).toEqual([
      "/admin",
      "/admin/members",
      "/admin/finances",
    ]);
  });
  it("editor sees no tabs (Phase 5 notice instead); combos union", () => {
    expect(adminTabs(["editor"])).toEqual([]);
    expect(adminTabs([])).toEqual([]);
    expect(adminTabs(["verifier", "finance"]).map((t) => t.href)).toEqual([
      "/admin",
      "/admin/members",
      "/admin/verify",
      "/admin/finances",
      "/admin/transfer",
    ]);
  });
  it("labels are the prototype's Georgian nav vocabulary", () => {
    const labels = adminTabs(["super_admin"]).map((t) => t.label);
    expect(labels).toEqual([
      "მიმოხილვა",
      "წევრები",
      "ვერიფიკაცია",
      "ფინანსები",
      "ტრანსფერი",
      "ადმინები",
      "აუდიტი",
      "პარამეტრები",
    ]);
  });
});

describe("isStaff (spec §4.2 gate)", () => {
  it("super_admin/verifier/finance are staff; editor alone is not", () => {
    expect(isStaff(["super_admin"])).toBe(true);
    expect(isStaff(["verifier"])).toBe(true);
    expect(isStaff(["finance"])).toBe(true);
    expect(isStaff(["editor"])).toBe(false);
    expect(isStaff([])).toBe(false);
    expect(isStaff(["editor", "finance"])).toBe(true);
  });
});

describe("audit taxonomy (spec §4.5)", () => {
  it("all 14 actions have Georgian labels", () => {
    expect(Object.keys(AUDIT_ACTION_LABELS_KA).sort()).toEqual(
      [
        "admin.grant_role",
        "admin.revoke_role",
        "delegate.approve",
        "delegate.reject",
        "delegate.reveal_personal_id",
        "delegate.update_profile",
        "member.export",
        "member.reassign",
        "member.reveal_personal_id",
        "payment.bulk_record",
        "payment.record",
        "payment.void",
        "settings.update",
        "system.active_sweep",
      ].sort(),
    );
  });
  it("unknown actions fall back to the raw string", () => {
    expect(auditActionLabel("delegate.approve")).toBe("დელეგატის დამტკიცება");
    expect(auditActionLabel("future.action")).toBe("future.action");
  });
});

describe("vocabulary and bars", () => {
  it("member statuses cover all three values", () => {
    expect(MEMBER_STATUS_LABELS_KA).toEqual({
      draft: "მონახაზი",
      profile_completed: "რეგისტრირებული",
      active_member: "აქტიური",
    });
  });
  it("role labels exist for every role", () => {
    for (const role of ADMIN_ROLE_VALUES) expect(ROLE_LABELS_KA[role]).toBeTruthy();
  });
  it("barPct is clamped and zero-safe", () => {
    expect(barPct(294, 294)).toBe(100);
    expect(barPct(0, 294)).toBe(0);
    expect(barPct(147, 294)).toBe(50);
    expect(barPct(5, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/admin.test.ts`
Expected: FAIL — cannot resolve `./admin`.

- [ ] **Step 3: Write the implementation — `lib/admin.ts`**

```ts
/**
 * Admin vocabulary and pure helpers (spec §3.1, §4.5). Client-side role checks
 * here are UX ONLY (tab filtering, control visibility) — the database re-checks
 * every read (self-gating views) and every mutation (RPC role checks). ADR-014.
 */
import type { MemberStatusRow } from "./supabase/types";

export const ADMIN_ROLE_VALUES = ["super_admin", "verifier", "finance", "editor"] as const;
export type AdminRole = (typeof ADMIN_ROLE_VALUES)[number];

export const ROLE_LABELS_KA: Record<AdminRole, string> = {
  super_admin: "სუპერ-ადმინი",
  verifier: "ვერიფიკატორი",
  finance: "ფინანსები",
  editor: "რედაქტორი",
};

export const ROLE_DUTIES_KA: Record<AdminRole, string> = {
  super_admin: "სრული წვდომა — ადმინების მართვა, აუდიტი, პარამეტრები",
  verifier: "დელეგატების ვერიფიკაცია, პროფილები, ტრანსფერი",
  finance: "გადახდების აღრიცხვა და ექსპორტი",
  editor: "სიახლეები და ღონისძიებები (ჩაირთვება მე-5 ფაზაში)",
};

/** Overview/member-list gate: every admin role except editor (spec §4.2 „staff“). */
export function isStaff(roles: readonly AdminRole[]): boolean {
  return roles.some((r) => r === "super_admin" || r === "verifier" || r === "finance");
}

export interface AdminTab {
  href: string;
  label: string;
}

const TAB_MATRIX: { href: string; label: string; roles: readonly AdminRole[] }[] = [
  { href: "/admin", label: "მიმოხილვა", roles: ["super_admin", "verifier", "finance"] },
  { href: "/admin/members", label: "წევრები", roles: ["super_admin", "verifier", "finance"] },
  { href: "/admin/verify", label: "ვერიფიკაცია", roles: ["super_admin", "verifier"] },
  { href: "/admin/finances", label: "ფინანსები", roles: ["super_admin", "finance"] },
  { href: "/admin/transfer", label: "ტრანსფერი", roles: ["super_admin", "verifier"] },
  { href: "/admin/admins", label: "ადმინები", roles: ["super_admin"] },
  { href: "/admin/audit", label: "აუდიტი", roles: ["super_admin"] },
  { href: "/admin/settings", label: "პარამეტრები", roles: ["super_admin"] },
];

export function adminTabs(roles: readonly AdminRole[]): AdminTab[] {
  return TAB_MATRIX.filter((t) => t.roles.some((r) => roles.includes(r))).map(
    ({ href, label }) => ({ href, label }),
  );
}

/** Member list / export status vocabulary — matches Pill's status colors. */
export const MEMBER_STATUS_LABELS_KA: Record<MemberStatusRow, string> = {
  draft: "მონახაზი",
  profile_completed: "რეგისტრირებული",
  active_member: "აქტიური",
};

/** The fixed audit taxonomy (spec §4.5) → viewer labels. */
export const AUDIT_ACTION_LABELS_KA: Record<string, string> = {
  "delegate.approve": "დელეგატის დამტკიცება",
  "delegate.reject": "დელეგატის უარყოფა",
  "delegate.update_profile": "დელეგატის პროფილის რედაქტირება",
  "delegate.reveal_personal_id": "განმცხადებლის პირადი ნომრის ნახვა",
  "member.reveal_personal_id": "წევრის პირადი ნომრის ნახვა",
  "member.export": "წევრების ექსპორტი",
  "member.reassign": "წევრის გადანაწილება",
  "payment.record": "გადახდის აღრიცხვა",
  "payment.bulk_record": "გადახდების ჯგუფური აღრიცხვა",
  "payment.void": "გადახდის გაუქმება",
  "admin.grant_role": "როლის მინიჭება",
  "admin.revoke_role": "როლის მოხსნა",
  "settings.update": "პარამეტრის შეცვლა",
  "system.active_sweep": "სტატუსების ავტომატური განახლება",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS_KA[action] ?? action;
}

export const TARGET_TYPE_LABELS_KA: Record<string, string> = {
  delegate: "დელეგატი",
  profile: "წევრი",
  payment: "გადახდა",
  admin_role: "ადმინის როლი",
  setting: "პარამეტრი",
  system: "სისტემა",
};

/** Proportion-bar width (overview regions, finance tiers) — clamped, zero-safe. */
export function barPct(count: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((count / max) * 100);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for the `lib/funnel.ts` riders**

Append to the `mapFunnelError` describe block in `lib/funnel.test.ts`:

```ts
  it("maps the Phase 4 admin tokens (spec §5)", () => {
    expect(mapFunnelError("P0001: missing_role")).toBe(
      "ამ მოქმედებისთვის საკმარისი უფლება არ გაქვს.",
    );
    expect(mapFunnelError("duplicate_reference")).toBe(
      "ამ საბანკო რეფერენსით გადახდა უკვე აღრიცხულია.",
    );
    expect(mapFunnelError("last_super_admin")).toBe("ბოლო super_admin-ის მოხსნა შეუძლებელია.");
    expect(mapFunnelError("already_voided")).toBe("ეს გადახდა უკვე გაუქმებულია.");
    expect(mapFunnelError("invalid_target")).toBe("ჩანაწერი ვერ მოიძებნა — განაახლე გვერდი.");
  });
```

Run: `npx vitest run lib/funnel.test.ts` — expected: FAIL (tokens unmapped → generic message).

- [ ] **Step 6: Implement the `lib/funnel.ts` riders**

In `lib/funnel.ts`:

1. `FunnelState` interface gains one field (after `membershipExists`):

```ts
  /** Phase 4: caller holds ≥1 admin_roles row — shows the cabinet's ადმინისტრირება tab. */
  admin: boolean;
```

2. `ERROR_MESSAGES` gains the Phase 4 tokens (insert after `invalid_name`):

```ts
  // Phase 4 admin tokens (spec §5)
  missing_role: "ამ მოქმედებისთვის საკმარისი უფლება არ გაქვს.",
  invalid_target: "ჩანაწერი ვერ მოიძებნა — განაახლე გვერდი.",
  already_voided: "ეს გადახდა უკვე გაუქმებულია.",
  duplicate_reference: "ამ საბანკო რეფერენსით გადახდა უკვე აღრიცხულია.",
  last_super_admin: "ბოლო super_admin-ის მოხსნა შეუძლებელია.",
  invalid_setting: "პარამეტრის მნიშვნელობა არასწორია.",
  invalid_slug: "მისამართის შექმნა ვერ მოხერხდა — სცადე თავიდან.",
  invalid_amount: "თანხა არასწორია.",
  invalid_date: "თარიღი არასწორია.",
  invalid_reason: "მიუთითე მიზეზი (3–500 სიმბოლო).",
  invalid_note: "შენიშვნა ძალიან გრძელია (მაქს. 500).",
  invalid_rows: "ცხრილის მონაცემები არასწორია — სცადე თავიდან.",
```

3. Every test-side `FunnelState` factory/literal must gain `admin: false` or TypeScript fails. Find them all:

```bash
grep -rln "membershipExists" --include="*.test.ts" --include="*.test.tsx" lib app components
```

Expected hits today: `lib/cabinet.test.ts` (the `state()` factory) and possibly funnel/cabinet component tests — add `admin: false` to each object literal that builds a full `FunnelState`.

- [ ] **Step 7: Run the full unit suite to verify everything passes**

Run: `npx vitest run && npm run typecheck`
Expected: PASS everywhere (typecheck confirms every FunnelState literal was updated).

- [ ] **Step 8: Format, commit**

```bash
npm run format
git add lib/admin.ts lib/admin.test.ts lib/funnel.ts lib/funnel.test.ts lib/cabinet.test.ts
git commit -m "feat(admin): admin vocabulary, tab matrix, audit labels; FunnelState.admin + error tokens"
```

(If Step 6.3's grep touched more test files, add them to the same commit.)

---

### Task 5: Admin zod boundary — `lib/admin-schemas.ts`

**Files:**
- Create: `lib/admin-schemas.ts`
- Create: `lib/admin-schemas.test.ts`

**Interfaces:**
- Consumes: `ADMIN_ROLE_VALUES` from `lib/admin.ts`; `isReferenceCode` from `lib/funnel.ts`.
- Produces (consumed by every Task 13–23 server action and client form):
  - `todayTbilisiIso(): string`
  - `approveDelegateSchema` `{ delegateId: uuid }`
  - `rejectDelegateSchema` `{ delegateId: uuid, note: string (trimmed, ≤500, default "") }`
  - `delegateProfileSchema` `{ delegateId: uuid, bio: string (trimmed, ≤1000, default "") }`
  - `PHOTO_MAX_BYTES = 5 * 1024 * 1024`, `PHOTO_TYPES: Record<string, string>` (mime → extension: jpeg/png/webp)
  - `recordPaymentSchema` `{ memberId: uuid, amountGel: number (>0, ≤10000, 2dp), paidAt: YYYY-MM-DD (2026-01-01…today), bankReference: string (trimmed, ≤64, default "") }`
  - `bulkPreviewSchema` `{ text: string (1…50000) }`
  - `bulkConfirmSchema` `{ rows: BulkRow[] (1…500) }` where `BulkRow = { referenceCode: GR-code, amountGel, paidAt, }`
  - `voidPaymentSchema` `{ paymentId: positive int, reason: string (trimmed, 3…500) }`
  - `reassignSchema` `{ memberId: uuid, delegateId: uuid }`
  - `grantRoleSchema` / `revokeRoleSchema` `{ userId: uuid, role: AdminRole }`
  - `graceDaysSchema` `{ graceDays: int 0…365 }`
  - `memberLookupSchema` `{ query: string (trimmed, 2…100) }`
  - `membersFilterSchema` (searchParams-tolerant: bad values degrade, never throw) `{ search?: string≤100, regionId?: positive int, status?: MemberStatusRow, page: int ≥1 (default 1) }`

- [ ] **Step 1: Write the failing test — `lib/admin-schemas.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  bulkConfirmSchema,
  delegateProfileSchema,
  graceDaysSchema,
  grantRoleSchema,
  memberLookupSchema,
  membersFilterSchema,
  recordPaymentSchema,
  rejectDelegateSchema,
  todayTbilisiIso,
  voidPaymentSchema,
} from "./admin-schemas";

const UUID = "6e08c9a1-2f5e-4b7a-9c3d-1a2b3c4d5e6f";

describe("todayTbilisiIso", () => {
  it("returns YYYY-MM-DD", () => {
    expect(todayTbilisiIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("recordPaymentSchema (spec §3.5)", () => {
  const ok = {
    memberId: UUID,
    amountGel: 20,
    paidAt: todayTbilisiIso(),
    bankReference: "TBC-123",
  };
  it("accepts a valid payment; bankReference defaults empty", () => {
    expect(recordPaymentSchema.parse(ok).bankReference).toBe("TBC-123");
    const { bankReference: _omit, ...rest } = ok;
    expect(recordPaymentSchema.parse(rest).bankReference).toBe("");
  });
  it("rejects non-positive, oversized and sub-cent amounts", () => {
    expect(recordPaymentSchema.safeParse({ ...ok, amountGel: 0 }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, amountGel: -5 }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, amountGel: 10001 }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, amountGel: 5.001 }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, amountGel: 5.5 }).success).toBe(true);
  });
  it("rejects future dates, pre-2026 dates and malformed dates", () => {
    expect(recordPaymentSchema.safeParse({ ...ok, paidAt: "2025-12-31" }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, paidAt: "2126-01-01" }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, paidAt: "01.07.2026" }).success).toBe(false);
  });
  it("caps the bank reference at 64", () => {
    expect(
      recordPaymentSchema.safeParse({ ...ok, bankReference: "x".repeat(65) }).success,
    ).toBe(false);
  });
});

describe("bulkConfirmSchema", () => {
  const row = { referenceCode: "GR-ABC234", amountGel: 20, paidAt: "2026-07-01" };
  it("accepts 1–500 valid rows", () => {
    expect(bulkConfirmSchema.safeParse({ rows: [row] }).success).toBe(true);
  });
  it("rejects empty, oversized and malformed-code batches", () => {
    expect(bulkConfirmSchema.safeParse({ rows: [] }).success).toBe(false);
    expect(bulkConfirmSchema.safeParse({ rows: Array(501).fill(row) }).success).toBe(false);
    expect(
      bulkConfirmSchema.safeParse({ rows: [{ ...row, referenceCode: "GR-ABCIL0" }] }).success,
    ).toBe(false);
  });
});

describe("void/reject/profile/grant/settings/lookup", () => {
  it("void requires a 3–500 char reason", () => {
    expect(voidPaymentSchema.safeParse({ paymentId: 1, reason: "შეცდომით" }).success).toBe(true);
    expect(voidPaymentSchema.safeParse({ paymentId: 1, reason: "აა" }).success).toBe(false);
    expect(voidPaymentSchema.safeParse({ paymentId: 0, reason: "შეცდომით" }).success).toBe(false);
  });
  it("reject note is optional but capped at 500", () => {
    expect(rejectDelegateSchema.parse({ delegateId: UUID }).note).toBe("");
    expect(
      rejectDelegateSchema.safeParse({ delegateId: UUID, note: "x".repeat(501) }).success,
    ).toBe(false);
  });
  it("bio capped at 1000", () => {
    expect(delegateProfileSchema.parse({ delegateId: UUID, bio: " ბიო " }).bio).toBe("ბიო");
    expect(
      delegateProfileSchema.safeParse({ delegateId: UUID, bio: "x".repeat(1001) }).success,
    ).toBe(false);
  });
  it("grant accepts only the four roles", () => {
    expect(grantRoleSchema.safeParse({ userId: UUID, role: "finance" }).success).toBe(true);
    expect(grantRoleSchema.safeParse({ userId: UUID, role: "root" }).success).toBe(false);
  });
  it("grace days 0–365 integer", () => {
    expect(graceDaysSchema.safeParse({ graceDays: 30 }).success).toBe(true);
    expect(graceDaysSchema.safeParse({ graceDays: -1 }).success).toBe(false);
    expect(graceDaysSchema.safeParse({ graceDays: 366 }).success).toBe(false);
    expect(graceDaysSchema.safeParse({ graceDays: 30.5 }).success).toBe(false);
  });
  it("member lookup needs ≥2 chars", () => {
    expect(memberLookupSchema.safeParse({ query: "ა" }).success).toBe(false);
    expect(memberLookupSchema.safeParse({ query: "GR-ABC234" }).success).toBe(true);
  });
});

describe("membersFilterSchema — searchParams-tolerant", () => {
  it("parses good params", () => {
    expect(
      membersFilterSchema.parse({ search: "ნინო", regionId: "3", status: "active_member", page: "2" }),
    ).toEqual({ search: "ნინო", regionId: 3, status: "active_member", page: 2 });
  });
  it("bad values degrade instead of throwing (URLs are user input)", () => {
    const f = membersFilterSchema.parse({ regionId: "abc", status: "hacker", page: "-1" });
    expect(f.regionId).toBeUndefined();
    expect(f.status).toBeUndefined();
    expect(f.page).toBe(1);
  });
  it("empty search becomes undefined", () => {
    expect(membersFilterSchema.parse({ search: "  " }).search).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/admin-schemas.test.ts`
Expected: FAIL — cannot resolve `./admin-schemas`.

- [ ] **Step 3: Write the implementation — `lib/admin-schemas.ts`**

```ts
/**
 * zod for every Phase 4 admin boundary (spec §5). Same schemas drive client
 * forms and server actions; the database re-validates inside the RPCs. House
 * pattern: Georgian messages on every user-visible failure.
 */
import { z } from "zod";
import { ADMIN_ROLE_VALUES } from "./admin";
import { isReferenceCode } from "./funnel";

/** Georgia is UTC+4 year-round — same fixed-offset trick as lib/cabinet.ts. */
export function todayTbilisiIso(): string {
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const uuid = z.string().uuid("ჩანაწერი ვერ მოიძებნა — განაახლე გვერდი.");

const amountGel = z
  .number({ invalid_type_error: "თანხა არასწორია." })
  .positive("თანხა არასწორია.")
  .max(10000, "თანხა არასწორია.")
  .multipleOf(0.01, "თანხა არასწორია.");

const paidAt = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "თარიღი არასწორია.")
  .refine((v) => v >= "2026-01-01" && v <= todayTbilisiIso(), "თარიღი არასწორია.");

export const approveDelegateSchema = z.object({ delegateId: uuid });

export const rejectDelegateSchema = z.object({
  delegateId: uuid,
  note: z.string().trim().max(500, "შენიშვნა ძალიან გრძელია (მაქს. 500).").default(""),
});

export const delegateProfileSchema = z.object({
  delegateId: uuid,
  bio: z.string().trim().max(1000, "ბიოგრაფია ძალიან გრძელია (მაქს. 1000).").default(""),
});

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Accepted upload mime types → stored file extension (spec §3.4). */
export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const recordPaymentSchema = z.object({
  memberId: uuid,
  amountGel,
  paidAt,
  bankReference: z.string().trim().max(64, "რეფერენსი ძალიან გრძელია (მაქს. 64).").default(""),
});

export const bulkPreviewSchema = z.object({
  text: z.string().min(1, "ჩასვი ამონაწერის სტრიქონები.").max(50_000, "ტექსტი ძალიან დიდია."),
});

const bulkRowSchema = z.object({
  referenceCode: z.string().refine(isReferenceCode, "კოდი არასწორია."),
  amountGel,
  paidAt,
});
export type BulkRow = z.infer<typeof bulkRowSchema>;

export const bulkConfirmSchema = z.object({
  rows: z
    .array(bulkRowSchema)
    .min(1, "ასარჩევი რიგები არ არის.")
    .max(500, "მაქს. 500 რიგი ერთ ჯერზე."),
});

export const voidPaymentSchema = z.object({
  paymentId: z.number().int().positive("ჩანაწერი ვერ მოიძებნა — განაახლე გვერდი."),
  reason: z
    .string()
    .trim()
    .min(3, "მიუთითე მიზეზი (3–500 სიმბოლო).")
    .max(500, "მიუთითე მიზეზი (3–500 სიმბოლო)."),
});

export const reassignSchema = z.object({ memberId: uuid, delegateId: uuid });

export const grantRoleSchema = z.object({
  userId: uuid,
  role: z.enum(ADMIN_ROLE_VALUES, { errorMap: () => ({ message: "როლი არასწორია." }) }),
});
export const revokeRoleSchema = grantRoleSchema;

export const graceDaysSchema = z.object({
  graceDays: z
    .number({ invalid_type_error: "დღეების რაოდენობა არასწორია." })
    .int("დღეების რაოდენობა არასწორია.")
    .min(0, "დღეების რაოდენობა არასწორია.")
    .max(365, "დღეების რაოდენობა არასწორია."),
});

export const memberLookupSchema = z.object({
  query: z.string().trim().min(2, "ჩაწერე მინ. 2 სიმბოლო.").max(100, "ძებნა ძალიან გრძელია."),
});

/** searchParams live in URLs — degrade gracefully on garbage, never 500. */
export const membersFilterSchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .catch(undefined),
  regionId: z.coerce.number().int().positive().optional().catch(undefined),
  status: z.enum(["draft", "profile_completed", "active_member"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
export type MembersFilter = z.infer<typeof membersFilterSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/admin-schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite, format, commit**

```bash
npx vitest run && npm run typecheck && npm run format
git add lib/admin-schemas.ts lib/admin-schemas.test.ts
git commit -m "feat(admin): zod schemas for every admin boundary"
```

### Task 6: The migration — `supabase/migrations/20260717150000_admin_crm.sql` + typed client

**Files:**
- Create: `supabase/migrations/20260717150000_admin_crm.sql`
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Consumes: the Phase 0–3 schema (see `supabase/migrations/*`); `funnel_state()` body from `20260715213000_cabinets.sql` (replaced here, additively).
- Produces (consumed by Tasks 7, 9–10, 11–23): the 9 admin views, 13 admin RPCs, 4 engine functions, `has_admin_role`/`has_any_admin_role`, `app_settings`, payments columns (`tier_gel_at_payment`, generated `months_covered`, `voided_at/by`, `void_reason`), `delegates.review_note`, the personal-ID column lockdown, the own-roles policy on `admin_roles`, the `delegate-photos` bucket, the pg_cron sweep, and `funnel_state().admin`.

There is no local database (ADR-005) — this task's "test" is `npm run typecheck` (types mirror) plus Task 7's live probes after the apply. The SQL below is complete; copy it verbatim.

- [ ] **Step 1: Write the migration — `supabase/migrations/20260717150000_admin_crm.sql`**

```sql
-- Phase 4: Admin CRM. Spec: docs/superpowers/specs/2026-07-17-phase-4-admin-crm-design.md
-- Access model (ADR-014): self-gating definer views for admin reads (no personal-ID
-- columns anywhere); SECURITY DEFINER RPCs for every admin mutation — role re-check +
-- audit_log row in the same transaction. Engine semantics recorded as ADR-015.

-- 1) Role helpers ---------------------------------------------------------------
create function has_admin_role(p_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid() and role = p_role
  );
$$;
grant execute on function has_admin_role(text) to authenticated;
revoke execute on function has_admin_role(text) from public, anon;

create function has_any_admin_role(variadic p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid() and role = any (p_roles)
  );
$$;
grant execute on function has_any_admin_role(text[]) to authenticated;
revoke execute on function has_any_admin_role(text[]) from public, anon;

-- 2) Settings (spec §3.9, §4.3) ---------------------------------------------------
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);
alter table app_settings enable row level security;
-- sealed: no client grants, no policies — reads via admin_settings view, writes via RPC
insert into app_settings (key, value) values ('active_grace_days', '30'::jsonb);

-- 3) payments: engine + void + dedup columns (spec §4.3) ---------------------------
-- Table is empty today (recording starts this phase) — NOT NULL add is safe.
alter table payments add column tier_gel_at_payment smallint not null
  check (tier_gel_at_payment in (5, 10, 20));
-- Derived IN the database from immutable facts — no editable derivable column.
alter table payments add column months_covered int generated always as
  (greatest(1, floor(amount_gel / tier_gel_at_payment)::int)) stored;
alter table payments add column voided_at timestamptz;
alter table payments add column voided_by uuid references profiles(id);
alter table payments add column void_reason text;

-- Double-pasting a statement cannot double-record; voiding frees the reference.
create unique index payments_bank_ref_live on payments (bank_reference)
  where bank_reference is not null and voided_at is null;
create index payments_member_paid on payments (member_id, paid_at);

-- e2e/staging deletability (spec §4.3): no product deletion flow exists; cleanup
-- deletes e2e users, and their payments must go with them (audit keeps the trail —
-- targets are stored as text, never FKs).
alter table payments drop constraint payments_member_id_fkey;
alter table payments add constraint payments_member_id_fkey
  foreign key (member_id) references profiles(id) on delete cascade;

-- 4) delegates: internal rejection note (spec §3.4) --------------------------------
alter table delegates add column review_note text;

-- 5) The active-member engine (spec §4.4, ADR-015) ----------------------------------
-- Date-only math, mirrored by lib/active.ts:
--   coverage_end = greatest(prev_end, paid_at) + months_covered × 30 days
--   active ⇔ current_date ≤ coverage_end + grace
create function active_grace_days() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (value #>> '{}')::int from public.app_settings where key = 'active_grace_days'),
    30);
$$;
revoke execute on function active_grace_days() from public, anon, authenticated;

create function active_coverage(p_member uuid) returns date
language plpgsql stable security definer set search_path = '' as $$
declare
  v_end date := null;
  r record;
begin
  for r in
    select paid_at, months_covered from public.payments
    where member_id = p_member and voided_at is null
    order by paid_at, id
  loop
    v_end := greatest(coalesce(v_end, r.paid_at), r.paid_at) + (r.months_covered * 30);
  end loop;
  return v_end;
end $$;
revoke execute on function active_coverage(uuid) from public, anon, authenticated;

-- The engine owns profile_completed ⇄ active_member. It never touches drafts —
-- the funnel owns draft → profile_completed (spec §4.4).
create function recompute_member_active(p_member uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_status public.member_status;
  v_end date;
  v_new public.member_status;
begin
  select status into v_status from public.profiles where id = p_member;
  if not found or v_status = 'draft' then return; end if;
  v_end := public.active_coverage(p_member);
  v_new := case
    when v_end is not null and current_date <= v_end + public.active_grace_days()
      then 'active_member'::public.member_status
    else 'profile_completed'::public.member_status
  end;
  if v_new is distinct from v_status then
    update public.profiles set status = v_new where id = p_member;
  end if;
end $$;
revoke execute on function recompute_member_active(uuid) from public, anon, authenticated;

create function recompute_all_active() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.profiles p set status = sub.new_status
  from (
    select p2.id,
           case
             when c.v_end is not null
                  and current_date <= c.v_end + public.active_grace_days()
               then 'active_member'::public.member_status
             else 'profile_completed'::public.member_status
           end as new_status
    from public.profiles p2
    cross join lateral (select public.active_coverage(p2.id) as v_end) c
    where p2.status <> 'draft'
  ) sub
  where p.id = sub.id and p.status is distinct from sub.new_status;
end $$;
revoke execute on function recompute_all_active() from public, anon, authenticated;
-- the seed script (service role) runs the full recompute after inserting payments
grant execute on function recompute_all_active() to service_role;

create function active_sweep() returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_demoted int;
begin
  with lapsed as (
    select p.id
    from public.profiles p
    cross join lateral (select public.active_coverage(p.id) as v_end) c
    where p.status = 'active_member'
      and (c.v_end is null or current_date > c.v_end + public.active_grace_days())
  ), upd as (
    update public.profiles set status = 'profile_completed'
    where id in (select id from lapsed)
    returning 1
  )
  select count(*)::int into v_demoted from upd;
  if v_demoted > 0 then
    insert into public.audit_log (actor_id, action, target_type, details)
    values (null, 'system.active_sweep', 'system',
            jsonb_build_object('demoted', v_demoted));
  end if;
  return v_demoted;
end $$;
revoke execute on function active_sweep() from public, anon, authenticated;
grant execute on function active_sweep() to service_role; -- probes exercise it

-- Nightly sweep, 01:00 UTC = 05:00 Tbilisi. Named risk (spec §4.4): verified live
-- in the apply step; fallback = Vercel cron calling active_sweep() via service role.
create extension if not exists pg_cron;
select cron.schedule('active-member-sweep', '0 1 * * *', 'select public.active_sweep()');

-- 6) Admin read views (spec §4.2) ----------------------------------------------------
-- Definer-style like public_delegates: fixed safe column sets, self-gated on the
-- caller's role — non-admins get ZERO rows. personal_id/birth_date appear in NO view.

create view admin_overview as
select
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int from delegates where status = 'pending') as pending_delegates,
  (select count(*)::int from profiles where status = 'active_member') as active_members,
  (select count(*)::int from profiles where status <> 'draft') as total_completed,
  (select coalesce(sum(membership_tier), 0)::int
     from profiles where status = 'active_member') as mrr_gel
where has_any_admin_role('super_admin', 'verifier', 'finance');

create view admin_region_stats as
select r.id as region_id, r.name_ka, count(p.id)::int as member_count
from regions r
join profiles p on p.region_id = r.id and p.status <> 'draft'
where has_any_admin_role('super_admin', 'verifier', 'finance')
group by r.id, r.name_ka;

create view admin_members as
select
  p.id,
  p.first_name,
  p.last_name,
  p.phone,
  p.region_id,
  r.name_ka as region_name_ka,
  c.name_ka as city_name_ka,
  m.delegate_id,
  dp.first_name as delegate_first_name,
  dp.last_name as delegate_last_name,
  p.status,
  p.membership_tier,
  p.reference_code,
  p.created_at,
  p.registration_completed_at,
  (d.id is not null) as is_delegate
from profiles p
left join regions r on r.id = p.region_id
left join cities c on c.id = p.city_id
left join delegates d on d.id = p.id
left join memberships m on m.member_id = p.id and m.ended_at is null
left join profiles dp on dp.id = m.delegate_id
where has_any_admin_role('super_admin', 'verifier', 'finance');

create view admin_delegate_queue as
select
  d.id,
  p.first_name,
  p.last_name,
  p.phone,
  p.region_id,
  r.name_ka as region_name_ka,
  d.status,
  d.slug,
  d.bio,
  d.photo_url,
  d.review_note,
  d.tc_accepted_at,
  p.created_at,
  d.verified_at,
  vp.first_name as verified_by_first_name,
  vp.last_name as verified_by_last_name,
  coalesce(act.cnt, 0)::int as active_supporters,
  coalesce(tot.cnt, 0)::int as total_supporters
from delegates d
join profiles p on p.id = d.id
left join regions r on r.id = p.region_id
left join profiles vp on vp.id = d.verified_by
left join lateral (
  select count(*) as cnt from memberships m
  join profiles mp on mp.id = m.member_id
  where m.delegate_id = d.id and m.ended_at is null and mp.status = 'active_member'
) act on true
left join lateral (
  select count(*) as cnt from memberships m
  where m.delegate_id = d.id and m.ended_at is null
) tot on true
where has_any_admin_role('super_admin', 'verifier');

create view admin_payments as
select
  pay.id,
  pay.member_id,
  p.first_name,
  p.last_name,
  p.reference_code,
  pay.amount_gel,
  pay.months_covered,
  pay.paid_at,
  pay.bank_reference,
  pay.source,
  rb.first_name as recorded_by_first_name,
  rb.last_name as recorded_by_last_name,
  pay.created_at,
  pay.voided_at,
  vb.first_name as voided_by_first_name,
  vb.last_name as voided_by_last_name,
  pay.void_reason
from payments pay
join profiles p on p.id = pay.member_id
left join profiles rb on rb.id = pay.recorded_by
left join profiles vb on vb.id = pay.voided_by
where has_any_admin_role('super_admin', 'finance');

create view admin_finance_stats as
select
  (select coalesce(sum(membership_tier), 0)::int
     from profiles where status = 'active_member') as mrr_gel,
  (select count(*)::int from profiles where status = 'active_member') as active_count,
  (select count(*)::int from profiles
     where status = 'active_member' and membership_tier = 5) as tier5_count,
  (select count(*)::int from profiles
     where status = 'active_member' and membership_tier = 10) as tier10_count,
  (select count(*)::int from profiles
     where status = 'active_member' and membership_tier = 20) as tier20_count
where has_any_admin_role('super_admin', 'finance');

create view admin_admins as
select
  ar.user_id,
  p.first_name,
  p.last_name,
  p.phone,
  ar.role,
  ar.granted_at,
  gp.first_name as granted_by_first_name,
  gp.last_name as granted_by_last_name
from admin_roles ar
join profiles p on p.id = ar.user_id
left join profiles gp on gp.id = ar.granted_by
where has_admin_role('super_admin');

create view admin_audit as
select
  a.id,
  a.created_at,
  a.actor_id,
  ap.first_name as actor_first_name,
  ap.last_name as actor_last_name,
  a.action,
  a.target_type,
  a.target_id,
  -- text-compare join: target_id is text by design (targets survive deletion);
  -- resolves display names for people-shaped targets, null otherwise
  case when tp.id is not null then tp.first_name || ' ' || tp.last_name end as target_label,
  a.details
from audit_log a
left join profiles ap on ap.id = a.actor_id
left join profiles tp
  on a.target_type in ('profile', 'delegate') and tp.id::text = a.target_id
where has_admin_role('super_admin');

create view admin_settings as
select s.key, s.value, s.updated_at,
       up.first_name as updated_by_first_name,
       up.last_name as updated_by_last_name
from app_settings s
left join profiles up on up.id = s.updated_by
where has_admin_role('super_admin');

grant select on admin_overview, admin_region_stats, admin_members,
  admin_delegate_queue, admin_payments, admin_finance_stats, admin_admins,
  admin_audit, admin_settings to authenticated;

-- 7) Mutation RPCs (spec §4.5) --------------------------------------------------------
-- Envelope: SECURITY DEFINER, search_path '', role check FIRST, every effect + its
-- audit row in this one transaction, error tokens for lib/funnel.ts mapping.

create function admin_approve_delegate(p_delegate_id uuid, p_slug text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
  v_profile public.profiles%rowtype;
  v_slug text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  select * into v_delegate from public.delegates where id = p_delegate_id;
  if not found or v_delegate.status = 'approved' then raise exception 'invalid_target'; end if;
  select * into v_profile from public.profiles where id = p_delegate_id;

  -- slug is permanent once set (URL stability); re-approval keeps the original
  v_slug := coalesce(v_delegate.slug, nullif(btrim(coalesce(p_slug, '')), ''));
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 80 then
    raise exception 'invalid_slug';
  end if;

  -- a concurrent duplicate slug surfaces as 23505; the server action retries
  update public.delegates set
    status = 'approved',
    slug = v_slug,
    verified_at = now(),
    verified_by = v_uid
  where id = p_delegate_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.approve', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'slug', v_slug,
            'priorStatus', v_delegate.status::text));
  return jsonb_build_object('slug', v_slug);
end $$;
grant execute on function admin_approve_delegate(uuid, text) to authenticated;
revoke execute on function admin_approve_delegate(uuid, text) from public, anon;

create function admin_reject_delegate(p_delegate_id uuid, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
  v_profile public.profiles%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  if v_note is not null and length(v_note) > 500 then raise exception 'invalid_note'; end if;
  select * into v_delegate from public.delegates where id = p_delegate_id;
  if not found or v_delegate.status <> 'pending' then raise exception 'invalid_target'; end if;
  select * into v_profile from public.profiles where id = p_delegate_id;

  update public.delegates set
    status = 'rejected',
    review_note = v_note,
    verified_at = now(),
    verified_by = v_uid
  where id = p_delegate_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.reject', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'note', v_note));
end $$;
grant execute on function admin_reject_delegate(uuid, text) to authenticated;
revoke execute on function admin_reject_delegate(uuid, text) from public, anon;

create function admin_update_delegate_profile(
  p_delegate_id uuid, p_bio text, p_photo_url text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
  v_profile public.profiles%rowtype;
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_photo text := nullif(btrim(coalesce(p_photo_url, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  if v_bio is not null and length(v_bio) > 1000 then raise exception 'invalid_target'; end if;
  if v_photo is not null and (v_photo !~ '^https://' or length(v_photo) > 512) then
    raise exception 'invalid_target';
  end if;
  select * into v_delegate from public.delegates where id = p_delegate_id;
  if not found or v_delegate.status <> 'approved' then raise exception 'invalid_target'; end if;
  select * into v_profile from public.profiles where id = p_delegate_id;

  update public.delegates set bio = v_bio, photo_url = v_photo where id = p_delegate_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.update_profile', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'bioChanged', v_bio is distinct from v_delegate.bio,
            'photoChanged', v_photo is distinct from v_delegate.photo_url));
end $$;
grant execute on function admin_update_delegate_profile(uuid, text, text) to authenticated;
revoke execute on function admin_update_delegate_profile(uuid, text, text) from public, anon;

create function admin_record_payment(
  p_member_id uuid, p_amount_gel numeric, p_paid_at date, p_bank_reference text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_ref text := nullif(btrim(coalesce(p_bank_reference, '')), '');
  v_months int;
  v_payment_id bigint;
  v_new_status public.member_status;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'finance') then
    raise exception 'missing_role';
  end if;
  if p_amount_gel is null or p_amount_gel <= 0 or p_amount_gel > 10000
     or p_amount_gel <> round(p_amount_gel, 2) then
    raise exception 'invalid_amount';
  end if;
  if p_paid_at is null or p_paid_at > current_date or p_paid_at < date '2026-01-01' then
    raise exception 'invalid_date';
  end if;
  if v_ref is not null and length(v_ref) > 64 then raise exception 'invalid_target'; end if;
  select * into v_profile from public.profiles where id = p_member_id;
  if not found then raise exception 'invalid_target'; end if;
  -- only completed registrations hold a reference code and a tier
  if v_profile.reference_code is null or v_profile.membership_tier is null then
    raise exception 'not_completed';
  end if;

  begin
    insert into public.payments
      (member_id, amount_gel, paid_at, bank_reference, source, recorded_by, tier_gel_at_payment)
    values
      (p_member_id, p_amount_gel, p_paid_at, v_ref, 'manual', v_uid, v_profile.membership_tier)
    returning id, months_covered into v_payment_id, v_months;
  exception when unique_violation then
    raise exception 'duplicate_reference';
  end;

  perform public.recompute_member_active(p_member_id);
  select status into v_new_status from public.profiles where id = p_member_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'payment.record', 'payment', v_payment_id::text,
          jsonb_build_object(
            'memberId', p_member_id,
            'memberName', v_profile.first_name || ' ' || v_profile.last_name,
            'referenceCode', v_profile.reference_code,
            'amountGel', p_amount_gel,
            'months', v_months,
            'paidAt', p_paid_at,
            'bankReference', v_ref,
            'newStatus', v_new_status::text));
  return jsonb_build_object('months', v_months, 'newStatus', v_new_status::text);
end $$;
grant execute on function admin_record_payment(uuid, numeric, date, text) to authenticated;
revoke execute on function admin_record_payment(uuid, numeric, date, text) from public, anon;

-- Bulk: all-or-nothing. Any invalid row aborts the whole batch with a positional
-- token 'bulk_row:<index>:<reason>' the server action surfaces on the preview.
create function admin_record_payments_bulk(p_rows jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_batch uuid := gen_random_uuid();
  v_count int := 0;
  v_total numeric := 0;
  v_row jsonb;
  v_idx int := 0;
  v_code text;
  v_amount numeric;
  v_paid date;
  v_profile public.profiles%rowtype;
  v_months int;
  v_payment_id bigint;
  v_member_ids uuid[] := '{}';
  v_member uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'finance') then
    raise exception 'missing_role';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 500 then
    raise exception 'invalid_rows';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_code := upper(btrim(coalesce(v_row->>'referenceCode', '')));
    v_amount := (v_row->>'amountGel')::numeric;
    v_paid := (v_row->>'paidAt')::date;

    if v_amount is null or v_amount <= 0 or v_amount > 10000
       or v_amount <> round(v_amount, 2) then
      raise exception 'bulk_row:%:invalid_amount', v_idx;
    end if;
    if v_paid is null or v_paid > current_date or v_paid < date '2026-01-01' then
      raise exception 'bulk_row:%:invalid_date', v_idx;
    end if;
    select * into v_profile from public.profiles where reference_code = v_code;
    if not found then raise exception 'bulk_row:%:unknown_code', v_idx; end if;
    if v_profile.membership_tier is null then
      raise exception 'bulk_row:%:not_completed', v_idx;
    end if;

    insert into public.payments
      (member_id, amount_gel, paid_at, bank_reference, source, recorded_by, tier_gel_at_payment)
    values
      (v_profile.id, v_amount, v_paid, null, 'manual', v_uid, v_profile.membership_tier)
    returning id, months_covered into v_payment_id, v_months;

    insert into public.audit_log (actor_id, action, target_type, target_id, details)
    values (v_uid, 'payment.record', 'payment', v_payment_id::text,
            jsonb_build_object(
              'memberId', v_profile.id,
              'memberName', v_profile.first_name || ' ' || v_profile.last_name,
              'referenceCode', v_code,
              'amountGel', v_amount,
              'months', v_months,
              'paidAt', v_paid,
              'batchId', v_batch));

    v_member_ids := array_append(v_member_ids, v_profile.id);
    v_count := v_count + 1;
    v_total := v_total + v_amount;
    v_idx := v_idx + 1;
  end loop;

  -- dedup before recompute: a member may appear in several batch rows
  select array_agg(distinct m) into v_member_ids from unnest(v_member_ids) m;
  foreach v_member in array v_member_ids loop
    perform public.recompute_member_active(v_member);
  end loop;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'payment.bulk_record', 'payment', v_batch::text,
          jsonb_build_object('batchId', v_batch, 'count', v_count, 'totalGel', v_total));
  return jsonb_build_object('count', v_count, 'totalGel', v_total);
end $$;
grant execute on function admin_record_payments_bulk(jsonb) to authenticated;
revoke execute on function admin_record_payments_bulk(jsonb) from public, anon;

create function admin_void_payment(p_payment_id bigint, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments%rowtype;
  v_profile public.profiles%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_new_status public.member_status;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'finance') then
    raise exception 'missing_role';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then raise exception 'invalid_reason'; end if;
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_payment.voided_at is not null then raise exception 'already_voided'; end if;
  select * into v_profile from public.profiles where id = v_payment.member_id;

  update public.payments
    set voided_at = now(), voided_by = v_uid, void_reason = v_reason
    where id = p_payment_id;

  perform public.recompute_member_active(v_payment.member_id);
  select status into v_new_status from public.profiles where id = v_payment.member_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'payment.void', 'payment', p_payment_id::text,
          jsonb_build_object(
            'memberId', v_payment.member_id,
            'memberName', v_profile.first_name || ' ' || v_profile.last_name,
            'amountGel', v_payment.amount_gel,
            'reason', v_reason,
            'newStatus', v_new_status::text));
  return jsonb_build_object('newStatus', v_new_status::text);
end $$;
grant execute on function admin_void_payment(bigint, text) to authenticated;
revoke execute on function admin_void_payment(bigint, text) from public, anon;

create function admin_reassign_member(p_member_id uuid, p_delegate_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_target uuid;
  v_open_delegate uuid;
  v_has_open boolean := false;
  v_from_name text;
  v_to_name text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  select * into v_profile from public.profiles where id = p_member_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_profile.registration_completed_at is null and v_profile.status <> 'active_member' then
    raise exception 'invalid_target';
  end if;
  if exists (select 1 from public.delegates d where d.id = p_member_id) then
    raise exception 'invalid_target'; -- delegates hold no membership (ADR-013)
  end if;
  select d.id into v_target from public.delegates d
    where d.id = p_delegate_id and d.status = 'approved';
  if v_target is null then raise exception 'invalid_delegate'; end if;

  select m.delegate_id, true into v_open_delegate, v_has_open
    from public.memberships m where m.member_id = p_member_id and m.ended_at is null;

  if coalesce(v_has_open, false) and v_open_delegate = v_target then
    return; -- same target: friendly no-op, no history row, no audit noise
  end if;

  if coalesce(v_has_open, false) then
    update public.memberships set ended_at = now()
      where member_id = p_member_id and ended_at is null;
  end if;
  insert into public.memberships (member_id, delegate_id) values (p_member_id, v_target);

  select case when v_open_delegate is null then 'ცენტრალური მოძრაობა'
              else (select pr.first_name || ' ' || pr.last_name
                      from public.profiles pr where pr.id = v_open_delegate) end
    into v_from_name;
  select pr.first_name || ' ' || pr.last_name into v_to_name
    from public.profiles pr where pr.id = v_target;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.reassign', 'profile', p_member_id::text,
          jsonb_build_object(
            'memberName', v_profile.first_name || ' ' || v_profile.last_name,
            'fromDelegateId', v_open_delegate, 'fromName', v_from_name,
            'toDelegateId', v_target, 'toName', v_to_name));
end $$;
grant execute on function admin_reassign_member(uuid, uuid) to authenticated;
revoke execute on function admin_reassign_member(uuid, uuid) from public, anon;

-- The ONLY two paths that return a personal ID to any client, both audited
-- unconditionally (spec decision #5).
create function admin_reveal_personal_id(p_member_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  select * into v_profile from public.profiles where id = p_member_id;
  if not found then raise exception 'invalid_target'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.reveal_personal_id', 'profile', p_member_id::text,
          jsonb_build_object('memberName', v_profile.first_name || ' ' || v_profile.last_name));
  return v_profile.personal_id;
end $$;
grant execute on function admin_reveal_personal_id(uuid) to authenticated;
revoke execute on function admin_reveal_personal_id(uuid) from public, anon;

create function admin_reveal_applicant_personal_id(p_delegate_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  if not exists (select 1 from public.delegates d where d.id = p_delegate_id) then
    raise exception 'invalid_target'; -- verifier's reveal scope is applicants only
  end if;
  select * into v_profile from public.profiles where id = p_delegate_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.reveal_personal_id', 'delegate', p_delegate_id::text,
          jsonb_build_object('memberName', v_profile.first_name || ' ' || v_profile.last_name));
  return v_profile.personal_id;
end $$;
grant execute on function admin_reveal_applicant_personal_id(uuid) to authenticated;
revoke execute on function admin_reveal_applicant_personal_id(uuid) from public, anon;

create function admin_export_members(
  p_search text, p_region_id int, p_status text, p_include_ids boolean
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_status public.member_status;
  v_rows jsonb;
  v_count int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'finance') then
    raise exception 'missing_role';
  end if;
  if coalesce(p_include_ids, false) and not public.has_admin_role('super_admin') then
    raise exception 'missing_role'; -- IDs are super_admin-only (spec decision #6)
  end if;
  if v_search is not null and length(v_search) > 100 then raise exception 'invalid_target'; end if;
  if p_status is not null then
    if p_status not in ('draft', 'profile_completed', 'active_member') then
      raise exception 'invalid_target';
    end if;
    v_status := p_status::public.member_status;
  end if;

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb),
         count(*)::int
    into v_rows, v_count
  from (
    select p.created_at,
           jsonb_build_object(
             'firstName', p.first_name,
             'lastName', p.last_name,
             'phone', p.phone,
             'regionNameKa', r.name_ka,
             'cityNameKa', c.name_ka,
             'delegateName', case when m.delegate_id is null then null
                                  else dp.first_name || ' ' || dp.last_name end,
             'status', p.status::text,
             'tier', p.membership_tier,
             'referenceCode', p.reference_code,
             -- Tbilisi calendar day, fixed offset (house convention)
             'registeredAt', to_char(p.created_at + interval '4 hours', 'YYYY-MM-DD'))
           || case when coalesce(p_include_ids, false)
                   then jsonb_build_object('personalId', p.personal_id)
                   else '{}'::jsonb end as row_data
    from public.profiles p
    left join public.regions r on r.id = p.region_id
    left join public.cities c on c.id = p.city_id
    left join public.memberships m on m.member_id = p.id and m.ended_at is null
    left join public.profiles dp on dp.id = m.delegate_id
    where (v_search is null
           or p.first_name ilike '%' || v_search || '%'
           or p.last_name ilike '%' || v_search || '%'
           or p.phone ilike '%' || v_search || '%'
           or p.reference_code ilike '%' || v_search || '%')
      and (p_region_id is null or p.region_id = p_region_id)
      and (v_status is null or p.status = v_status)
  ) q;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.export', 'profile', null,
          jsonb_build_object(
            'search', v_search, 'regionId', p_region_id, 'status', p_status,
            'includeIds', coalesce(p_include_ids, false), 'rowCount', v_count));
  return v_rows;
end $$;
grant execute on function admin_export_members(text, int, text, boolean) to authenticated;
revoke execute on function admin_export_members(text, int, text, boolean) from public, anon;

create function admin_grant_role(p_user_id uuid, p_role text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_inserted int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  if p_role is null or p_role not in ('super_admin', 'verifier', 'finance', 'editor') then
    raise exception 'invalid_role';
  end if;
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_profile.registration_completed_at is null and v_profile.status <> 'active_member' then
    raise exception 'not_completed'; -- admins must be completed members (spec §3.7)
  end if;

  insert into public.admin_roles (user_id, role, granted_by)
  values (p_user_id, p_role, v_uid)
  on conflict (user_id, role) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return; end if; -- already held: friendly no-op, no audit noise

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'admin.grant_role', 'admin_role', p_user_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'role', p_role));
end $$;
grant execute on function admin_grant_role(uuid, text) to authenticated;
revoke execute on function admin_grant_role(uuid, text) from public, anon;

create function admin_revoke_role(p_user_id uuid, p_role text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_deleted int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  if p_role is null or p_role not in ('super_admin', 'verifier', 'finance', 'editor') then
    raise exception 'invalid_role';
  end if;
  -- lockout guard (spec §3.7): the platform must always retain one super_admin
  if p_role = 'super_admin'
     and exists (select 1 from public.admin_roles
                 where user_id = p_user_id and role = 'super_admin')
     and (select count(*) from public.admin_roles where role = 'super_admin') = 1 then
    raise exception 'last_super_admin';
  end if;
  select * into v_profile from public.profiles where id = p_user_id;

  delete from public.admin_roles where user_id = p_user_id and role = p_role;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then return; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'admin.revoke_role', 'admin_role', p_user_id::text,
          jsonb_build_object(
            'name', coalesce(v_profile.first_name || ' ' || v_profile.last_name, p_user_id::text),
            'role', p_role));
end $$;
grant execute on function admin_revoke_role(uuid, text) to authenticated;
revoke execute on function admin_revoke_role(uuid, text) from public, anon;

create function admin_update_setting(p_key text, p_value jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_days int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  if p_key is distinct from 'active_grace_days' then raise exception 'invalid_setting'; end if;
  begin
    v_days := (p_value #>> '{}')::int;
  exception when others then
    raise exception 'invalid_setting';
  end;
  if v_days is null or v_days < 0 or v_days > 365 then raise exception 'invalid_setting'; end if;

  select value into v_old from public.app_settings where key = p_key;
  update public.app_settings
    set value = to_jsonb(v_days), updated_at = now(), updated_by = v_uid
    where key = p_key;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'settings.update', 'setting', p_key,
          jsonb_build_object('old', v_old, 'new', to_jsonb(v_days)));

  -- the rule changed — the whole platform reflects it immediately (spec §3.9)
  perform public.recompute_all_active();
end $$;
grant execute on function admin_update_setting(text, jsonb) to authenticated;
revoke execute on function admin_update_setting(text, jsonb) from public, anon;

-- 8) Grants & RLS riders (spec §4.6) ---------------------------------------------------
-- Personal-ID lockdown: the general read grant on profiles loses personal_id and
-- birth_date. Verified: no client-path code selects either (write-only through
-- funnel_save_profile; the platform never echoes them — Phase 3 stance).
revoke select on profiles from authenticated;
grant select (id, first_name, last_name, phone, region_id, city_id, employment,
              status, signup_role, signup_ref_code, membership_tier, reference_code,
              registration_completed_at, created_at, updated_at)
  on profiles to authenticated;

-- Own roles readable — the admin layout/nav reads ONLY the caller's rows.
create policy "own admin roles readable" on admin_roles
  for select using (auth.uid() = user_id);
grant select on admin_roles to authenticated;

-- 9) funnel_state(): + admin flag (additive; full replacement of the Phase 3 body) ----
create or replace function funnel_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate public.delegates%rowtype;
  v_has_delegate boolean := false;
  v_role text;
  v_referral jsonb;
  v_chosen jsonb;
  v_membership_exists boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then return jsonb_build_object('exists', false); end if;

  select * into v_delegate from public.delegates where id = v_uid;
  v_has_delegate := found;
  v_role := case when v_has_delegate then 'delegate' else v_profile.signup_role end;

  if v_role = 'member' and v_profile.signup_ref_code is not null then
    select jsonb_build_object(
        'firstName', pr.first_name,
        'lastName', pr.last_name,
        'regionNameKa', coalesce(r.name_ka, ''))
      into v_referral
      from public.delegates d
      join public.profiles pr on pr.id = d.id
      left join public.regions r on r.id = pr.region_id
      where d.referral_code = v_profile.signup_ref_code and d.status = 'approved';
  end if;

  select true,
         case when m.delegate_id is null then null
              else jsonb_build_object(
                'id', m.delegate_id,
                'firstName', pr.first_name,
                'lastName', pr.last_name) end
    into v_membership_exists, v_chosen
    from public.memberships m
    left join public.profiles pr on pr.id = m.delegate_id
    where m.member_id = v_uid and m.ended_at is null;

  return jsonb_build_object(
    'exists', true,
    'role', v_role,
    'firstName', v_profile.first_name,
    'lastName', v_profile.last_name,
    'personalIdSet', v_profile.personal_id is not null,
    'birthDate', v_profile.birth_date,
    'regionId', v_profile.region_id,
    'cityId', v_profile.city_id,
    'employment', v_profile.employment,
    'tier', v_profile.membership_tier,
    'referenceCode', v_profile.reference_code,
    'completed', v_profile.registration_completed_at is not null
                 or v_profile.status = 'active_member',
    'status', v_profile.status::text,
    'registrationCompletedAt', v_profile.registration_completed_at,
    'createdAt', v_profile.created_at,
    'delegateStatus', case when v_has_delegate then v_delegate.status::text end,
    'referral', v_referral,
    'chosenDelegate', v_chosen,
    'membershipExists', coalesce(v_membership_exists, false),
    -- Phase 4 (spec §4.6): the cabinet's ადმინისტრირება tab
    'admin', exists (select 1 from public.admin_roles ar where ar.user_id = v_uid)
  );
end $$;
-- CREATE OR REPLACE preserves existing ACLs — no re-grant needed (house note, Phase 3).

-- 10) Storage: delegate photos (spec §4.8) ---------------------------------------------
-- Public-read bucket; NO client write policies — uploads go exclusively through the
-- server action (service role) paired with admin_update_delegate_profile.
insert into storage.buckets (id, name, public)
values ('delegate-photos', 'delegate-photos', true)
on conflict (id) do update set public = true;
```

- [ ] **Step 2: Mirror the schema in `lib/supabase/types.ts`**

Apply ALL of the following to `lib/supabase/types.ts` (same commit as the migration — house rule stated in the file header):

1. `payments.Row` gains four fields (after `recorded_by: string | null;` keep `created_at` last):

```ts
          tier_gel_at_payment: number;
          months_covered: number;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
```

2. `delegates.Row` gains (after `photo_url: string | null;`):

```ts
          review_note: string | null;
```

3. Add to `Views` (after `public_stats`), matching the SQL column lists exactly:

```ts
      admin_overview: {
        Row: {
          approved_delegates: number;
          pending_delegates: number;
          active_members: number;
          total_completed: number;
          mrr_gel: number;
        };
        Relationships: [];
      };
      admin_region_stats: {
        Row: { region_id: number; name_ka: string; member_count: number };
        Relationships: [];
      };
      admin_members: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          region_id: number | null;
          region_name_ka: string | null;
          city_name_ka: string | null;
          delegate_id: string | null;
          delegate_first_name: string | null;
          delegate_last_name: string | null;
          status: MemberStatusRow;
          membership_tier: number | null;
          reference_code: string | null;
          created_at: string;
          registration_completed_at: string | null;
          is_delegate: boolean;
        };
        Relationships: [];
      };
      admin_delegate_queue: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          region_id: number | null;
          region_name_ka: string | null;
          status: DelegateStatusRow;
          slug: string | null;
          bio: string | null;
          photo_url: string | null;
          review_note: string | null;
          tc_accepted_at: string;
          created_at: string;
          verified_at: string | null;
          verified_by_first_name: string | null;
          verified_by_last_name: string | null;
          active_supporters: number;
          total_supporters: number;
        };
        Relationships: [];
      };
      admin_payments: {
        Row: {
          id: number;
          member_id: string;
          first_name: string;
          last_name: string;
          reference_code: string | null;
          amount_gel: number;
          months_covered: number;
          paid_at: string;
          bank_reference: string | null;
          source: string;
          recorded_by_first_name: string | null;
          recorded_by_last_name: string | null;
          created_at: string;
          voided_at: string | null;
          voided_by_first_name: string | null;
          voided_by_last_name: string | null;
          void_reason: string | null;
        };
        Relationships: [];
      };
      admin_finance_stats: {
        Row: {
          mrr_gel: number;
          active_count: number;
          tier5_count: number;
          tier10_count: number;
          tier20_count: number;
        };
        Relationships: [];
      };
      admin_admins: {
        Row: {
          user_id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          role: string;
          granted_at: string;
          granted_by_first_name: string | null;
          granted_by_last_name: string | null;
        };
        Relationships: [];
      };
      admin_audit: {
        Row: {
          id: number;
          created_at: string;
          actor_id: string | null;
          actor_first_name: string | null;
          actor_last_name: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          target_label: string | null;
          details: Json | null;
        };
        Relationships: [];
      };
      admin_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
          updated_by_first_name: string | null;
          updated_by_last_name: string | null;
        };
        Relationships: [];
      };
```

4. Add to `Tables` (after `dev_otp_inbox` — read via view only, but scripts insert):

```ts
      admin_roles: {
        Row: {
          user_id: string;
          role: string;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
```

5. Add to `Functions` (after `delegate_team`):

```ts
      admin_approve_delegate: {
        Args: { p_delegate_id: string; p_slug: string };
        Returns: Json;
      };
      admin_reject_delegate: {
        Args: { p_delegate_id: string; p_note: string | null };
        Returns: undefined;
      };
      admin_update_delegate_profile: {
        Args: { p_delegate_id: string; p_bio: string | null; p_photo_url: string | null };
        Returns: undefined;
      };
      admin_record_payment: {
        Args: {
          p_member_id: string;
          p_amount_gel: number;
          p_paid_at: string;
          p_bank_reference: string | null;
        };
        Returns: Json;
      };
      admin_record_payments_bulk: { Args: { p_rows: Json }; Returns: Json };
      admin_void_payment: { Args: { p_payment_id: number; p_reason: string }; Returns: Json };
      admin_reassign_member: {
        Args: { p_member_id: string; p_delegate_id: string };
        Returns: undefined;
      };
      admin_reveal_personal_id: { Args: { p_member_id: string }; Returns: string | null };
      admin_reveal_applicant_personal_id: {
        Args: { p_delegate_id: string };
        Returns: string | null;
      };
      admin_export_members: {
        Args: {
          p_search: string | null;
          p_region_id: number | null;
          p_status: string | null;
          p_include_ids: boolean;
        };
        Returns: Json;
      };
      admin_grant_role: { Args: { p_user_id: string; p_role: string }; Returns: undefined };
      admin_revoke_role: { Args: { p_user_id: string; p_role: string }; Returns: undefined };
      admin_update_setting: { Args: { p_key: string; p_value: Json }; Returns: undefined };
```

- [ ] **Step 3: Typecheck and unit suite**

Run: `npm run typecheck && npx vitest run`
Expected: PASS (nothing consumes the new types yet; existing tests untouched).

- [ ] **Step 4: Format, commit**

```bash
npm run format
git add supabase/migrations/20260717150000_admin_crm.sql lib/supabase/types.ts
git commit -m "feat(admin): Phase 4 migration — views, RPCs, engine, lockdown, bucket, cron"
```

### Task 7: Apply the migration to staging (+ the pg_cron decision point)

**Files:**
- Execute: `supabase/migrations/20260717150000_admin_crm.sql` (committed in Task 6)
- Create ONLY IF pg_cron is unavailable (fallback below): `app/api/cron/active-sweep/route.ts`, `vercel.json`

Operational task — no code changes on the happy path. The project is already linked (`supabase/.temp/project-ref` = `orcxtbedkexoclbfgvzd`); the procedure is the documented Phase 3 one (`docs/superpowers/plans/2026-07-15-supabase-staging-connection.md`, Task 4).

- [ ] **Step 1: Ask the owner for the database password**

Ask the owner (plain language) to add the `SUPABASE_DB_PASSWORD=...` line to `.env.local` — same as during Phase 3's rollout — and to say when it's there. Never echo the value; never commit it.

- [ ] **Step 2: Compare migration history, dry-run, push**

```powershell
$env:SUPABASE_DB_PASSWORD = (Get-Content .env.local | Where-Object { $_ -match '^SUPABASE_DB_PASSWORD=' }) -replace '^SUPABASE_DB_PASSWORD=', ''
npx --no-install supabase migration list
npx --no-install supabase db push --dry-run
npx --no-install supabase db push
npx --no-install supabase migration list
```

Expected: `migration list` shows the 8 applied Phase 0–3 timestamps on both sides plus `20260717150000` local-only; dry-run proposes exactly `20260717150000_admin_crm.sql`; push applies it; the final list shows `20260717150000` on both sides.

**pg_cron decision point (spec §4.4):** the migration runs in one transaction — if `create extension pg_cron` or `cron.schedule` is unsupported on this project, the WHOLE push fails and nothing is applied. That failure (and only that failure) triggers the fallback:

1. Edit `supabase/migrations/20260717150000_admin_crm.sql`: delete the two lines `create extension if not exists pg_cron;` and `select cron.schedule('active-member-sweep', '0 1 * * *', 'select public.active_sweep()');` (the `active_sweep()` function stays).
2. Create `vercel.json` at the repo root:

```json
{
  "crons": [{ "path": "/api/cron/active-sweep", "schedule": "0 1 * * *" }]
}
```

3. Create `app/api/cron/active-sweep/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * pg_cron fallback (spec §4.4): Vercel Cron calls this daily at 01:00 UTC.
 * Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the env var is set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("active_sweep");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demoted: data });
}
```

4. Add to `lib/supabase/types.ts` `Functions`: `active_sweep: { Args: Record<PropertyKey, never>; Returns: number };` — and ask the owner to add a `CRON_SECRET` env var in Vercel (any long random string).
5. Re-run Step 2; commit the fallback files:

```bash
git add supabase/migrations/20260717150000_admin_crm.sql vercel.json app/api/cron/active-sweep/route.ts lib/supabase/types.ts
git commit -m "feat(admin): Vercel-cron fallback for the nightly active sweep (pg_cron unavailable)"
```

Record whichever branch was taken — Task 28's ADR-015 documents it.

- [ ] **Step 3: Ask the owner to remove the password line**

Confirm the push output, then ask the owner to delete the `SUPABASE_DB_PASSWORD` line from `.env.local`. Clear it from the shell: `$env:SUPABASE_DB_PASSWORD = $null`.

---

### Task 8: Bootstrap script — `scripts/grant-admin.mjs`

**Files:**
- Create: `scripts/grant-admin.mjs`

**Interfaces:**
- Consumes: `admin_roles`, `profiles`, `audit_log` tables via service role.
- Produces: the documented one-time bootstrap path (spec §3.7); Task 28's docs reference it.

No unit test (service-role .mjs, same category as seed/verify scripts — exercised live in Step 2).

- [ ] **Step 1: Write `scripts/grant-admin.mjs`**

```js
/**
 * Grants an admin role to a REGISTERED, COMPLETED member — the bootstrap path
 * for the very first super_admin (spec §3.7); after that, use /admin/admins.
 *
 * Run: node --env-file=.env.local scripts/grant-admin.mjs \
 *        --phone +995509000001 --role super_admin --confirm-ref <project-ref>
 *
 * Writes the same audit action the RPC writes, with actor null + via marker —
 * bootstrap grants stay visible in the audit viewer.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const phone = arg("--phone");
const role = arg("--role");
const ROLES = ["super_admin", "verifier", "finance", "editor"];
if (!phone || !/^\+995\d{9}$/.test(phone) || !ROLES.includes(role)) {
  console.error(
    "Usage: node --env-file=.env.local scripts/grant-admin.mjs --phone +995XXXXXXXXX --role <super_admin|verifier|finance|editor> --confirm-ref <ref>",
  );
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
if (arg("--confirm-ref") !== ref) {
  console.error(`Refusing: pass --confirm-ref ${ref} to confirm the target project.`);
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: rows, error } = await db
  .from("profiles")
  .select("id, first_name, last_name, status, registration_completed_at")
  .in("phone", [phone, phone.slice(1)]);
if (error) throw error;
if (!rows || rows.length !== 1) {
  console.error(`Expected exactly one profile for ${phone}, found ${rows?.length ?? 0}.`);
  process.exit(1);
}
const p = rows[0];
if (p.registration_completed_at === null && p.status !== "active_member") {
  console.error("Refusing: admins must be completed members (spec §3.7).");
  process.exit(1);
}

const { error: grantErr } = await db
  .from("admin_roles")
  .upsert({ user_id: p.id, role, granted_by: null }, { onConflict: "user_id,role", ignoreDuplicates: true });
if (grantErr) throw grantErr;

const { error: auditErr } = await db.from("audit_log").insert({
  actor_id: null,
  action: "admin.grant_role",
  target_type: "admin_role",
  target_id: p.id,
  details: { name: `${p.first_name} ${p.last_name}`, role, via: "grant-admin.mjs" },
});
if (auditErr) throw auditErr;

console.log(`OK: ${p.first_name} ${p.last_name} (${phone}) ← ${role} on project ${ref}`);
```

- [ ] **Step 2: Typecheck-adjacent sanity + argument-guard dry run**

```bash
node scripts/grant-admin.mjs
```
Expected: the usage error and exit code 1 (no env needed to hit the guard). Live use happens after Task 9's seed (the canonical admins are created by the seed itself; this script is for the owner's own account and, later, production).

- [ ] **Step 3: Format, commit**

```bash
npm run format
git add scripts/grant-admin.mjs
git commit -m "feat(admin): grant-admin bootstrap script (audited, completed-members only)"
```

---

### Task 9: Seed rewrite — payments in, hand-written statuses out

**Files:**
- Modify: `scripts/seed-staging.mjs`

**Interfaces:**
- Consumes: the Task 6 schema (payments columns, `recompute_all_active` granted to service_role, cascade FK).
- Produces (consumed by Tasks 10, 25–27): canonical admin accounts — super `+995509000001` / verifier `+995509000002` / finance `+995509000003` / editor `+995509000004`; every non-draft seeded person has `reference_code` (`GR-…`, deterministic), `membership_tier` (5/10/20 by index), `registration_completed_at`; every active person has a seeded payment (`bank_reference` `SEED-<i>`); statuses are **derived** by `recompute_all_active()`. Existing assertions (12 approved delegates, 1636 actives, top `giorgi-maisuradze` = 294) keep holding — the same people are active, now honestly.

- [ ] **Step 1: Update the header + constants**

Replace the header comment (lines 1–10) with:

```js
/**
 * Seeds STAGING with the prototype roster. Destructive by design:
 * wipes ALL auth users (staging holds synthetic data only), then recreates
 * roster delegates + their supporter members deterministically.
 *
 * Phase 4: statuses are NO LONGER hand-written. The seed writes payment
 * histories (bank_reference "SEED-<i>") and lets the engine derive
 * active_member via recompute_all_active(). Staging activity therefore decays
 * honestly over time (members lapse ~60 days after their seeded payment) —
 * re-run this seed to refresh. Also seeds 4 canonical admin accounts
 * (+99550900000{1..4}: super_admin/verifier/finance/editor) used by e2e and
 * the schema probes as audit ACTORS (never deleted — audit_log.actor_id is a
 * plain FK and audit rows are append-only).
 *
 * Guards: refuses on NEXT_PUBLIC_APP_ENV=production; requires
 * `--confirm-ref <project-ref>` matching NEXT_PUBLIC_SUPABASE_URL.
 *
 * Run: node --env-file=.env.local scripts/seed-staging.mjs --confirm-ref <ref>
 */
```

After the `ACTIVE_RATIO` line add:

```js
const TIERS = [5, 10, 20];
const tierFor = (i) => TIERS[i % 3];
// GR-code alphabet (lib/funnel.ts FUNNEL_CODE_ALPHABET) — deterministic base-31
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const refCodeFor = (i) => {
  let n = i;
  let out = "";
  for (let k = 0; k < 6; k++) {
    out = CODE_ALPHABET[n % 31] + out;
    n = Math.floor(n / 31);
  }
  return `GR-${out}`;
};
const daysAgoIso = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
const daysAgoDate = (d) => daysAgoIso(d).slice(0, 10);
```

- [ ] **Step 2: Switch the people list from statuses to kinds**

In the people-building block (currently sets `status:`), replace the two loops' bodies:

```js
for (const d of roster) {
  people.push({
    i: ++seq,
    first_name: d.first_name,
    last_name: d.last_name,
    region: d.region,
    kind: "active", // delegates pay too — the engine derives their status
    delegate: d,
    supporterOf: null,
  });
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
      kind: k < active ? "active" : k % 2 === 0 ? "completed" : "draft",
      delegate: null,
      supporterOf: d.slug,
    });
  }
}
```

- [ ] **Step 3: Profiles insert — completion columns instead of status**

Replace the `insertChunked("profiles", …)` call with:

```js
await insertChunked(
  "profiles",
  created.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    phone: phoneFor(p.i),
    personal_id: personalIdFor(p.i),
    region_id: regionId.get(p.region),
    // the engine owns profile_completed ⇄ active_member; seed never writes 'active_member'
    status: p.kind === "draft" ? "draft" : "profile_completed",
    ...(p.kind === "draft"
      ? {}
      : {
          membership_tier: tierFor(p.i),
          reference_code: refCodeFor(p.i),
          registration_completed_at: daysAgoIso(30 + (p.i % 200)),
        }),
    ...(p.delegate ? { signup_role: "delegate" } : {}),
  })),
);
```

- [ ] **Step 4: Seed payments for active people (after the memberships insert)**

```js
// Payments make people active — the engine derives status from these rows.
// paid_at within the last 25 days ⇒ coverage (30d) + grace (30d) safely covers today.
// Every 7th active person prepays 3 months (multi-month coverage in the demo data).
await insertChunked(
  "payments",
  created
    .filter((p) => p.kind === "active")
    .map((p) => {
      const tier = tierFor(p.i);
      const months = p.i % 7 === 0 ? 3 : 1;
      return {
        member_id: p.id,
        amount_gel: tier * months,
        paid_at: daysAgoDate(p.i % 25),
        bank_reference: `SEED-${p.i}`,
        source: "manual",
        recorded_by: null,
        tier_gel_at_payment: tier,
      };
    }),
);
```

- [ ] **Step 5: Seed the canonical admin accounts (after payments)**

```js
// Canonical admins (spec §7): fixed phones, completed members, roles attached.
// e2e + probes sign in as these via the dev OTP inbox. NEVER deleted — they are
// audit ACTORS (audit_log.actor_id FK + append-only trigger make actors permanent).
const ADMIN_SEED = [
  { n: 1, role: "super_admin", first_name: "ადმინი", last_name: "მთავარი" },
  { n: 2, role: "verifier", first_name: "ვერიფიკატორი", last_name: "გუნდი" },
  { n: 3, role: "finance", first_name: "ფინანსური", last_name: "გუნდი" },
  { n: 4, role: "editor", first_name: "რედაქტორი", last_name: "გუნდი" },
];
const tbilisiId = regionId.get("თბილისი");
const firstDelegateId = delegateIdBySlug.get(roster[0].slug);
for (const a of ADMIN_SEED) {
  const phone = `+99550900000${a.n}`;
  const { data: u, error: uErr } = await db.auth.admin.createUser({
    phone,
    phone_confirm: true,
  });
  if (uErr) throw new Error(`admin createUser ${phone}: ${uErr.message}`);
  const { error: pErr } = await db.from("profiles").insert({
    id: u.user.id,
    first_name: a.first_name,
    last_name: a.last_name,
    phone,
    personal_id: `1${pad(9000000 + a.n, 10)}`,
    region_id: tbilisiId,
    status: "profile_completed",
    membership_tier: 10,
    reference_code: refCodeFor(900000 + a.n),
    registration_completed_at: daysAgoIso(10),
  });
  if (pErr) throw new Error(`admin profile ${phone}: ${pErr.message}`);
  const { error: mErr } = await db
    .from("memberships")
    .insert({ member_id: u.user.id, delegate_id: firstDelegateId });
  if (mErr) throw new Error(`admin membership ${phone}: ${mErr.message}`);
  const { error: rErr } = await db
    .from("admin_roles")
    .insert({ user_id: u.user.id, role: a.role, granted_by: null });
  if (rErr) throw new Error(`admin role ${phone}: ${rErr.message}`);
}
console.log("seeded 4 canonical admin accounts (+99550900000{1..4})");
```

- [ ] **Step 6: Derive statuses, then extend the sanity block**

Immediately before the existing `public_stats` sanity read:

```js
// The engine, not the seed, decides who is active (spec §8).
const { error: recomputeErr } = await db.rpc("recompute_all_active");
if (recomputeErr) throw new Error(`recompute_all_active failed: ${recomputeErr.message}`);
```

The existing assertions (12 approved / 1636 active / top 294) stay byte-identical — the same people are active, now derived. After them, add:

```js
const { count: paymentCount, error: payCountErr } = await db
  .from("payments")
  .select("*", { count: "exact", head: true })
  .like("bank_reference", "SEED-%");
if (payCountErr) throw payCountErr;
if (paymentCount !== 1636)
  throw new Error(`expected 1636 seeded payments, got ${paymentCount}`);
const { count: adminCount, error: adminCountErr } = await db
  .from("admin_roles")
  .select("*", { count: "exact", head: true });
if (adminCountErr) throw adminCountErr;
if (adminCount !== 4) throw new Error(`expected 4 admin roles, got ${adminCount}`);
```

- [ ] **Step 7: Reseed staging and watch the assertions**

```bash
node --env-file=.env.local scripts/seed-staging.mjs --confirm-ref orcxtbedkexoclbfgvzd
```

Expected output ends with the seeded-admins line, `public_stats: {"approved_delegates":12,"active_members":1636}`, the top-delegate line, and `SEED OK`. (This wipes prior e2e leftovers too — by design.)

- [ ] **Step 8: Format, commit**

```bash
npm run format
git add scripts/seed-staging.mjs
git commit -m "feat(admin): seed writes payment histories; engine derives statuses; canonical admins"
```

### Task 10: Schema probes — `scripts/verify-schema.mjs` Phase 4 block

**Files:**
- Modify: `scripts/verify-schema.mjs` (append the Phase 4 block BEFORE the final `console.log`)

**Interfaces:**
- Consumes: Task 6's schema on staging (applied in Task 7), Task 9's canonical admins + seed.
- Produces: the live security proof (spec §4.7) that Tasks 25–27's e2e and the sign-off package lean on.

Probe design rules (Global Constraints): throwaway users are TARGETS only — every audited action is performed by a canonical seeded admin (audit actors are permanent). Canonical admins sign in via phone OTP against the dev inbox (the e2e pattern, scripted).

- [ ] **Step 1: Append the Phase 4 probes**

Insert before the final `console.log(` at the bottom of `scripts/verify-schema.mjs`:

```js
// --- Phase 4: admin CRM probes (spec §4.7) ---
{
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ADMIN_VIEWS = [
    "admin_overview",
    "admin_region_stats",
    "admin_members",
    "admin_delegate_queue",
    "admin_payments",
    "admin_finance_stats",
    "admin_admins",
    "admin_audit",
    "admin_settings",
  ];

  /** Canonical seeded admins (seed-staging.mjs): audit ACTORS must be permanent. */
  async function signInAsSeededAdmin(phoneNational) {
    const phone = `+995${phoneNational}`;
    const client = createClient(url, ANON_KEY);
    const { error: sendErr } = await client.auth.signInWithOtp({ phone });
    if (sendErr) throw new Error(`OTP send to ${phone} failed: ${sendErr.message}`);
    // dev hook writes the code to dev_otp_inbox; auth may store phones without '+'
    const { data: otpRow, error: otpErr } = await db
      .from("dev_otp_inbox")
      .select("otp")
      .in("phone", [phone, phone.slice(1)])
      .order("id", { ascending: false })
      .limit(1)
      .single();
    if (otpErr) throw new Error(`dev OTP read for ${phone} failed: ${otpErr.message}`);
    const { error: verifyErr } = await client.auth.verifyOtp({
      phone,
      token: otpRow.otp,
      type: "sms",
    });
    if (verifyErr) throw new Error(`verifyOtp for ${phone} failed: ${verifyErr.message}`);
    return client;
  }

  async function expectToken(promise, token, what) {
    const { error } = await promise;
    if (!error) throw new Error(`LEAK: ${what} unexpectedly succeeded`);
    if (!error.message.includes(token))
      throw new Error(`${what}: expected '${token}', got: ${error.message}`);
  }

  // ---- (1) a non-admin authenticated user: zero rows everywhere, refusals on RPCs ----
  const NA_EMAIL = "admin-probe-nonadmin@example.com";
  const naLeftover = await findUserByEmail(NA_EMAIL);
  if (naLeftover) await db.auth.admin.deleteUser(naLeftover.id);
  const naPassword = randomBytes(24).toString("hex");
  const { data: naUser, error: naCreateErr } = await db.auth.admin.createUser({
    email: NA_EMAIL,
    password: naPassword,
    email_confirm: true,
  });
  if (naCreateErr) throw new Error(`nonadmin createUser failed: ${naCreateErr.message}`);
  const naId = naUser.user.id;
  try {
    const na = createClient(url, ANON_KEY);
    const { error: naSignIn } = await na.auth.signInWithPassword({
      email: NA_EMAIL,
      password: naPassword,
    });
    if (naSignIn) throw new Error(`nonadmin sign-in failed: ${naSignIn.message}`);
    // complete a registration the house way (funnel RPCs) — target material for later probes
    await na.rpc("funnel_start", {
      p_first_name: "პრობი",
      p_last_name: "ადმინობის",
      p_role: "member",
      p_ref_code: null,
    });
    const { data: probeCity } = await db
      .from("cities")
      .select("id, region_id")
      .limit(1)
      .single();
    await na.rpc("funnel_save_profile", {
      p_personal_id: "98765432110",
      p_birth_date: "1991-02-02",
      p_region_id: probeCity.region_id,
      p_city_id: probeCity.id,
      p_employment: "პრობა",
      p_delegate_id: null,
      p_tc_accepted: false,
    });
    const { data: naDone, error: naDoneErr } = await na.rpc("funnel_complete", { p_tier: 10 });
    if (naDoneErr) throw new Error(`probe funnel_complete failed: ${naDoneErr.message}`);
    const naCode = naDone.referenceCode;

    for (const view of ADMIN_VIEWS) {
      const { data, error } = await na.from(view).select("*").limit(1);
      if (error) throw new Error(`non-admin ${view} select errored: ${error.message}`);
      if (data.length !== 0) throw new Error(`LEAK: non-admin got rows from ${view}`);
    }
    console.log("OK: all 9 admin views return zero rows to a non-admin");

    // personal_id exists in NO admin view (42703 undefined column), and the
    // base-table grant no longer includes it (42501)
    const { error: colErr } = await na.from("admin_members").select("personal_id").limit(1);
    if (!colErr || colErr.code !== "42703")
      throw new Error(`admin_members must not have personal_id: ${colErr?.code}`);
    const { error: baseErr } = await na.from("profiles").select("personal_id").eq("id", naId);
    if (!baseErr || baseErr.code !== "42501")
      throw new Error(`profiles.personal_id must be revoked: ${baseErr?.code}`);
    const { error: birthErr } = await na.from("profiles").select("birth_date").eq("id", naId);
    if (!birthErr || birthErr.code !== "42501")
      throw new Error(`profiles.birth_date must be revoked: ${birthErr?.code}`);
    // the surviving columns still read fine (own row)
    const { error: okColsErr } = await na
      .from("profiles")
      .select("first_name, phone, status, reference_code")
      .eq("id", naId)
      .single();
    if (okColsErr) throw new Error(`scoped profile select broke: ${okColsErr.message}`);
    console.log("OK: personal_id/birth_date locked down (views 42703, base grant 42501)");

    await expectToken(
      na.rpc("admin_reveal_personal_id", { p_member_id: naId }),
      "missing_role",
      "non-admin reveal",
    );
    await expectToken(
      na.rpc("admin_record_payment", {
        p_member_id: naId,
        p_amount_gel: 10,
        p_paid_at: "2026-07-01",
        p_bank_reference: null,
      }),
      "missing_role",
      "non-admin record_payment",
    );
    await expectToken(
      na.rpc("admin_grant_role", { p_user_id: naId, p_role: "editor" }),
      "missing_role",
      "non-admin grant_role",
    );
    const { error: anonAdminErr } = await anon.rpc("admin_reveal_personal_id", {
      p_member_id: naId,
    });
    if (!anonAdminErr) throw new Error("LEAK: anon can call admin_reveal_personal_id");
    console.log("OK: admin RPCs refuse non-admins and anon");

    // own admin_roles are readable (empty for a non-admin) — the layout's gate read
    const { data: ownRoles, error: ownRolesErr } = await na
      .from("admin_roles")
      .select("role")
      .eq("user_id", naId);
    if (ownRolesErr) throw new Error(`own admin_roles read failed: ${ownRolesErr.message}`);
    if (ownRoles.length !== 0) throw new Error("non-admin should hold no roles");

    // ---- (2) verifier: scope edges + audited applicant reveal ----
    const verifier = await signInAsSeededAdmin("509000002");
    const { data: vMembers, error: vMembersErr } = await verifier
      .from("admin_members")
      .select("id")
      .limit(1);
    if (vMembersErr || vMembers.length !== 1)
      throw new Error(`verifier should read admin_members: ${vMembersErr?.message}`);
    const { data: vPay, error: vPayErr } = await verifier
      .from("admin_payments")
      .select("id")
      .limit(1);
    if (vPayErr) throw new Error(`verifier admin_payments errored: ${vPayErr.message}`);
    if (vPay.length !== 0) throw new Error("LEAK: verifier got rows from admin_payments");
    await expectToken(
      verifier.rpc("admin_record_payment", {
        p_member_id: naId,
        p_amount_gel: 10,
        p_paid_at: "2026-07-01",
        p_bank_reference: null,
      }),
      "missing_role",
      "verifier record_payment",
    );
    await expectToken(
      verifier.rpc("admin_export_members", {
        p_search: null,
        p_region_id: null,
        p_status: null,
        p_include_ids: false,
      }),
      "missing_role",
      "verifier export",
    );
    await expectToken(
      verifier.rpc("admin_reveal_personal_id", { p_member_id: naId }),
      "missing_role",
      "verifier member-scope reveal",
    );
    // applicant-scope reveal: the probe member is NOT a delegate → invalid_target
    await expectToken(
      verifier.rpc("admin_reveal_applicant_personal_id", { p_delegate_id: naId }),
      "invalid_target",
      "verifier reveal of a non-delegate",
    );
    console.log("OK: verifier scope edges hold (no finance surface, member-reveal denied)");

    // ---- (3) finance: record → duplicate blocked → void frees → bulk is atomic ----
    const finance = await signInAsSeededAdmin("509000003");
    const probeRef = `PROBE-${Date.now()}`;
    const { data: rec1, error: rec1Err } = await finance.rpc("admin_record_payment", {
      p_member_id: naId,
      p_amount_gel: 10,
      p_paid_at: "2026-07-01",
      p_bank_reference: probeRef,
    });
    if (rec1Err) throw new Error(`finance record failed: ${rec1Err.message}`);
    if (rec1.months !== 1 || rec1.newStatus !== "active_member")
      throw new Error(`record result unexpected: ${JSON.stringify(rec1)}`);
    await expectToken(
      finance.rpc("admin_record_payment", {
        p_member_id: naId,
        p_amount_gel: 10,
        p_paid_at: "2026-07-02",
        p_bank_reference: probeRef,
      }),
      "duplicate_reference",
      "duplicate bank reference",
    );
    const { data: payRow, error: payRowErr } = await finance
      .from("admin_payments")
      .select("id, months_covered")
      .eq("bank_reference", probeRef)
      .single();
    if (payRowErr) throw new Error(`admin_payments lookup failed: ${payRowErr.message}`);
    if (payRow.months_covered !== 1)
      throw new Error(`generated months_covered wrong: ${payRow.months_covered}`);
    const { data: voided, error: voidErr } = await finance.rpc("admin_void_payment", {
      p_payment_id: payRow.id,
      p_reason: "პრობის გაუქმება",
    });
    if (voidErr) throw new Error(`void failed: ${voidErr.message}`);
    if (voided.newStatus !== "profile_completed")
      throw new Error(`void must demote the probe member: ${JSON.stringify(voided)}`);
    const { error: reuseErr } = await finance.rpc("admin_record_payment", {
      p_member_id: naId,
      p_amount_gel: 60,
      p_paid_at: "2026-07-01",
      p_bank_reference: probeRef,
    });
    if (reuseErr) throw new Error(`voided reference must be reusable: ${reuseErr.message}`);
    // engine math via SQL: 60 GEL on tier 10 = 6 months → months_covered 6
    const { data: reuseRow } = await finance
      .from("admin_payments")
      .select("months_covered")
      .eq("bank_reference", probeRef)
      .is("voided_at", null)
      .single();
    if (reuseRow.months_covered !== 6)
      throw new Error(`SQL months math diverges from lib/active.ts: ${reuseRow.months_covered}`);

    const { count: beforeBulk } = await db
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("member_id", naId);
    await expectToken(
      finance.rpc("admin_record_payments_bulk", {
        p_rows: [
          { referenceCode: naCode, amountGel: 10, paidAt: "2026-07-03" },
          { referenceCode: "GR-ZZZZZ9", amountGel: 10, paidAt: "2026-07-03" },
        ],
      }),
      "bulk_row:1:unknown_code",
      "bulk with an unknown code",
    );
    const { count: afterBulk } = await db
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("member_id", naId);
    if (beforeBulk !== afterBulk)
      throw new Error("LEAK: failed bulk landed rows — batch must be all-or-nothing");
    console.log("OK: finance flows — record, dedup, void-frees-ref, months math, atomic bulk");

    // ---- (4) super_admin: audited reveal, grant/revoke, lockout guard, settings ----
    const superAdmin = await signInAsSeededAdmin("509000001");
    const { data: revealed, error: revealErr } = await superAdmin.rpc(
      "admin_reveal_personal_id",
      { p_member_id: naId },
    );
    if (revealErr) throw new Error(`super reveal failed: ${revealErr.message}`);
    if (revealed !== "98765432110") throw new Error("reveal returned the wrong personal ID");
    const { data: revealAudit } = await db
      .from("audit_log")
      .select("id")
      .eq("action", "member.reveal_personal_id")
      .eq("target_id", naId)
      .limit(1);
    if (!revealAudit || revealAudit.length === 0)
      throw new Error("reveal must write its audit row in the same transaction");

    const { error: grantErr } = await superAdmin.rpc("admin_grant_role", {
      p_user_id: naId,
      p_role: "editor",
    });
    if (grantErr) throw new Error(`grant editor failed: ${grantErr.message}`);
    // editor is not staff: still zero rows from admin_members
    const { data: editorRows, error: editorErr } = await na
      .from("admin_members")
      .select("id")
      .limit(1);
    if (editorErr || editorRows.length !== 0)
      throw new Error("editor-only user must get zero rows from admin_members");
    const { error: revokeErr } = await superAdmin.rpc("admin_revoke_role", {
      p_user_id: naId,
      p_role: "editor",
    });
    if (revokeErr) throw new Error(`revoke editor failed: ${revokeErr.message}`);

    const { data: superRow } = await db
      .from("profiles")
      .select("id")
      .eq("phone", "+995509000001")
      .single();
    await expectToken(
      superAdmin.rpc("admin_revoke_role", { p_user_id: superRow.id, p_role: "super_admin" }),
      "last_super_admin",
      "removing the last super_admin",
    );
    await expectToken(
      superAdmin.rpc("admin_update_setting", { p_key: "active_grace_days", p_value: 999 }),
      "invalid_setting",
      "out-of-range grace",
    );
    await expectToken(
      superAdmin.rpc("admin_update_setting", { p_key: "other_key", p_value: 30 }),
      "invalid_setting",
      "unknown setting key",
    );
    console.log("OK: super flows — audited reveal, grant/revoke, lockout + settings guards");

    // ---- (5) the sweep demotes a synthetically-expired member ----
    const { error: expireErr } = await db
      .from("payments")
      .update({ voided_at: new Date().toISOString(), void_reason: "probe expiry setup" })
      .eq("member_id", naId)
      .is("voided_at", null);
    if (expireErr) throw new Error(`probe expiry setup failed: ${expireErr.message}`);
    const { error: forceActiveErr } = await db
      .from("profiles")
      .update({ status: "active_member" })
      .eq("id", naId);
    if (forceActiveErr) throw new Error(`probe force-active failed: ${forceActiveErr.message}`);
    const { data: swept, error: sweepErr } = await db.rpc("active_sweep");
    if (sweepErr) throw new Error(`active_sweep failed: ${sweepErr.message}`);
    if (typeof swept !== "number" || swept < 1)
      throw new Error(`sweep should demote ≥1 (the probe member), got ${swept}`);
    const { data: sweptProfile } = await db
      .from("profiles")
      .select("status")
      .eq("id", naId)
      .single();
    if (sweptProfile.status !== "profile_completed")
      throw new Error(`sweep must demote the lapsed probe member: ${sweptProfile.status}`);
    console.log(`OK: active_sweep demoted ${swept} lapsed member(s), audited`);

    // ---- (6) storage bucket exists and is public ----
    const { data: bucket, error: bucketErr } = await db.storage.getBucket("delegate-photos");
    if (bucketErr || !bucket) throw new Error(`delegate-photos bucket missing: ${bucketErr?.message}`);
    if (!bucket.public) throw new Error("delegate-photos bucket must be public-read");
    console.log("OK: delegate-photos bucket present and public");
  } finally {
    const { error } = await db.auth.admin.deleteUser(naId);
    if (error)
      console.error(`WARNING: admin-probe cleanup (deleteUser ${naId}) failed: ${error.message}`);
  }
  console.log("OK: Phase 4 admin probes complete");
}
```

- [ ] **Step 2: Run the probes against staging**

```bash
node --env-file=.env.local scripts/verify-schema.mjs
```

Expected: every existing Phase 0–3 probe still green, then the six `OK:` Phase 4 lines, exit 0. (The canonical-admin OTP sign-ins depend on Task 9's seed; if a sign-in rate-limits, wait 60 seconds and re-run.)

- [ ] **Step 3: Format, commit**

```bash
npm run format
git add scripts/verify-schema.mjs
git commit -m "test(admin): live schema probes — lockdown, scopes, engine, sweep, bucket"
```

### Task 11: Admin shell — layout gate, AdminNav, cabinet link

**Files:**
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/error.tsx`
- Create: `components/AdminNav.tsx`
- Create: `components/AdminNav.test.tsx`
- Modify: `lib/supabase/server.ts` (add `getAdminRoles`)
- Modify: `lib/admin.ts` + `lib/admin.test.ts` (add `hasAnyRole`)
- Modify: `lib/cabinet.ts` + `lib/cabinet.test.ts` (`cabinetNavItems` admin item)
- Modify: `app/(member)/layout.tsx`, `app/(delegate)/layout.tsx` (pass the admin flag)

**Interfaces:**
- Consumes: `adminTabs`, `AdminRole` (Task 4); `funnel_state().admin` + `admin_roles` own-rows policy (Task 6); `CabinetNav` pattern.
- Produces (consumed by Tasks 12–23):
  - `getAdminRoles(): Promise<AdminRole[]>` in `lib/supabase/server.ts` — request-memoized (React `cache`), returns `[]` for signed-out/roleless callers, throws on query failure.
  - `hasAnyRole(roles: readonly AdminRole[], allowed: readonly AdminRole[]): boolean` in `lib/admin.ts`.
  - `AdminNav` client component: `{ tabs: AdminTab[] }` props, sign-out included.
  - Every `/admin/*` request passes the layout gate: session required, ≥1 admin role required (others bounce via `deriveDestination`).
  - `cabinetNavItems(role, isAdmin)` — second parameter appends `{ href: "/admin", label: "ადმინისტრირება" }`.

- [ ] **Step 1: Write the failing tests**

Append to `lib/admin.test.ts`:

```ts
import { hasAnyRole } from "./admin"; // merge into the existing import

describe("hasAnyRole (page gates)", () => {
  it("checks intersection", () => {
    expect(hasAnyRole(["verifier"], ["super_admin", "verifier"])).toBe(true);
    expect(hasAnyRole(["finance"], ["super_admin", "verifier"])).toBe(false);
    expect(hasAnyRole([], ["super_admin"])).toBe(false);
  });
});
```

In `lib/cabinet.test.ts`, extend the `cabinetNavItems` describe block:

```ts
  it("admins get the ადმინისტრირება tab appended (spec §3.1)", () => {
    expect(cabinetNavItems("member", true).at(-1)).toEqual({
      href: "/admin",
      label: "ადმინისტრირება",
    });
    expect(cabinetNavItems("delegate", true).at(-1)).toEqual({
      href: "/admin",
      label: "ადმინისტრირება",
    });
    expect(cabinetNavItems("member", false).some((i) => i.href === "/admin")).toBe(false);
    expect(cabinetNavItems("member")).toEqual(cabinetNavItems("member", false));
  });
```

Create `components/AdminNav.test.tsx` (follow `components/CabinetNav.test.tsx`'s mocking of `next/navigation` and `@/lib/supabase/client` exactly — same module paths, same `vi.mock` shape):

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminNav } from "./AdminNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/members",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

describe("AdminNav (spec §3.1)", () => {
  const tabs = [
    { href: "/admin", label: "მიმოხილვა" },
    { href: "/admin/members", label: "წევრები" },
  ];
  it("renders the eyebrow, tabs, active marker and sign-out", () => {
    render(<AdminNav tabs={tabs} />);
    expect(screen.getByText("ადმინისტრირება")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "მიმოხილვა" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "წევრები" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "გასვლა" })).toBeInTheDocument();
  });
  it("„მიმოხილვა“ is active only on the exact /admin path", () => {
    render(<AdminNav tabs={tabs} />);
    expect(screen.getByRole("link", { name: "მიმოხილვა" })).not.toHaveAttribute("aria-current");
  });
  it("renders no tab links for an empty tab list (editor) but keeps sign-out", () => {
    render(<AdminNav tabs={[]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "გასვლა" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/admin.test.ts lib/cabinet.test.ts components/AdminNav.test.tsx`
Expected: FAIL — `hasAnyRole` not exported, `cabinetNavItems` ignores the second argument, `./AdminNav` unresolved.

- [ ] **Step 3: Implement**

Append to `lib/admin.ts`:

```ts
/** Page-level gate helper (UX; the views/RPCs re-check in-DB). */
export function hasAnyRole(
  roles: readonly AdminRole[],
  allowed: readonly AdminRole[],
): boolean {
  return roles.some((r) => allowed.includes(r));
}
```

In `lib/cabinet.ts`, replace `cabinetNavItems` with:

```ts
export function cabinetNavItems(role: "member" | "delegate", isAdmin = false): CabinetNavItem[] {
  const items: CabinetNavItem[] =
    role === "delegate"
      ? [
          { href: "/me/profile", label: "პროფილი" },
          { href: "/me/billing", label: "გადახდები" },
          { href: "/delegate", label: "დელეგატის პანელი" },
        ]
      : [
          { href: "/me/profile", label: "პროფილი" },
          { href: "/me/delegate", label: "ჩემი დელეგატი" },
          { href: "/me/billing", label: "გადახდები" },
        ];
  // Phase 4 (spec §3.1): admins reach /admin from their own cabinet
  if (isAdmin) items.push({ href: "/admin", label: "ადმინისტრირება" });
  return items;
}
```

Create `components/AdminNav.tsx` (CabinetNav's structure — same sign-out semantics, admin eyebrow row added; dense register):

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Eyebrow } from "@/components/Eyebrow";
import type { AdminTab } from "@/lib/admin";
import { createClient } from "@/lib/supabase/client";

export function AdminNav({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    try {
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      // best-effort — the layout gate re-checks the server truth next request
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mb-8">
      <Eyebrow>ადმინისტრირება</Eyebrow>
      <nav
        aria-label="ადმინისტრირების ნავიგაცია"
        className="mt-2 flex flex-wrap items-center gap-1 border-b border-line pb-2"
      >
        {tabs.map((tab) => {
          // „მიმოხილვა“ (/admin) matches exactly; subpages match by prefix
          const active =
            tab.href === "/admin"
              ? pathname === "/admin"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                active ? "bg-brand/10 text-brand" : "text-muted-fg hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={signOut}
          className="ms-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-fg hover:text-brand"
        >
          გასვლა
        </button>
      </nav>
    </div>
  );
}
```

Append to `lib/supabase/server.ts`:

```ts
import type { AdminRole } from "../admin"; // add to the imports block

/**
 * Request-memoized own-roles read (Phase 4 §3.1). Backed by the `admin_roles`
 * "own roles readable" RLS policy — a caller can only ever see their own rows.
 * UX-only signal (nav filtering, layout gate); every view/RPC re-checks in-DB.
 */
export const getAdminRoles = cache(async (): Promise<AdminRole[]> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id);
  if (error) throw new Error(`admin_roles read failed: ${error.message}`);
  return (data ?? []).map((r) => r.role as AdminRole);
});
```

Create `app/(admin)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { adminTabs } from "@/lib/admin";
import { deriveDestination } from "@/lib/cabinet";
import { createServerSupabase, getAdminRoles, getFunnelState } from "@/lib/supabase/server";

/**
 * Admin gate (spec §3.1): session + ≥1 admin role, server-side on every request —
 * safe because /admin has been NetworkOnly in the service worker since Phase 0.
 * Role-specific page gates live in each page; the DB re-checks everything anyway.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const roles = await getAdminRoles();
  if (roles.length === 0) redirect(deriveDestination(await getFunnelState()));
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <AdminNav tabs={adminTabs(roles)} />
      {children}
    </div>
  );
}
```

Create `app/(admin)/error.tsx` with the byte-identical content of `app/(member)/error.tsx` (the established route-group error boundary — read it and copy verbatim).

Update the two cabinet layout call sites:
- `app/(member)/layout.tsx`: `<CabinetNav items={cabinetNavItems(state.role, state.admin)} />`
- `app/(delegate)/layout.tsx`: find its `cabinetNavItems(...)` call and pass `state.admin` the same way (read the file; it follows the member layout's shape).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: PASS across the suite (typecheck also proves both layouts pass the new argument correctly).

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/layout.tsx app/\(admin\)/error.tsx components/AdminNav.tsx components/AdminNav.test.tsx lib/supabase/server.ts lib/admin.ts lib/admin.test.ts lib/cabinet.ts lib/cabinet.test.ts app/\(member\)/layout.tsx app/\(delegate\)/layout.tsx
git commit -m "feat(admin): /admin shell — layout gate, AdminNav, cabinet link"
```

---

### Task 12: მიმოხილვა — `/admin` overview

**Files:**
- Create: `app/(admin)/admin/page.tsx`

**Interfaces:**
- Consumes: `admin_overview`, `admin_region_stats`, `admin_payments` views (Task 6); `getAdminRoles`, `hasAnyRole`, `isStaff`, `barPct`, `MEMBER_STATUS_LABELS_KA` (Tasks 4, 11); `StatCard`, `Card`, `ButtonLink`, `CenteredNotice`, `DataTable`, `formatAmountGel`, `formatDateKa`.
- Produces: the `/admin` landing page; the editor-only notice lives here (other pages redirect editors to `/admin`).

Server-only page — no client islands, no component test (the DB probes + e2e cover its data; JSX-only composition). Recent-payments card renders **only** for finance/super_admin (the view returns zero rows to a verifier anyway — the conditional keeps the layout honest instead of showing an empty card).

- [ ] **Step 1: Write `app/(admin)/admin/page.tsx`**

```tsx
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { CenteredNotice } from "@/components/CenteredNotice";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { barPct, hasAnyRole, isStaff } from "@/lib/admin";
import { formatAmountGel, formatDateKa } from "@/lib/cabinet";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ადმინისტრირება — ქართული რესპუბლიკა" };

export default async function AdminOverviewPage() {
  const roles = await getAdminRoles();
  if (!isStaff(roles)) {
    // editor-only (spec §3.1): no dead links — a single honest notice
    return (
      <CenteredNotice
        icon="🗞️"
        title="შენი განყოფილება მე-5 ფაზაში ჩაირთვება"
        body="სიახლეებისა და ღონისძიებების მართვა (რედაქტორის როლი) მომდევნო ფაზაში ამოქმედდება."
      />
    );
  }
  const supabase = await createServerSupabase();
  const canSeePayments = hasAnyRole(roles, ["finance", "super_admin"]);

  const { data: overview, error: overviewError } = await supabase
    .from("admin_overview")
    .select("*")
    .single();
  if (overviewError) throw new Error(`admin_overview failed: ${overviewError.message}`);

  const { data: regions, error: regionsError } = await supabase
    .from("admin_region_stats")
    .select("*")
    .order("member_count", { ascending: false })
    .limit(5);
  if (regionsError) throw new Error(`admin_region_stats failed: ${regionsError.message}`);
  const maxRegion = regions[0]?.member_count ?? 0;

  const recent = canSeePayments
    ? await supabase
        .from("admin_payments")
        .select("id, first_name, last_name, amount_gel, paid_at")
        .is("voided_at", null)
        .order("created_at", { ascending: false })
        .limit(6)
    : null;
  if (recent?.error) throw new Error(`admin_payments failed: ${recent.error.message}`);

  return (
    <main>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">მიმოხილვა</h1>
        <p className="mt-2 text-sm text-muted-fg">
          პლატფორმის ცოცხალი მაჩვენებლები — წევრები, დელეგატები, შემოსავალი და ვერიფიკაციის
          რიგი.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard n={overview.approved_delegates} label="დამტკიცებული დელეგატი" trend="↑ აქტიური რეგიონული ქსელი" />
        <StatCard n={overview.active_members} label="აქტიური წევრი" trend="↑ გადამხდელი მხარდამჭერები" />
        <StatCard n={overview.pending_delegates} label="ვერიფიკაციის მოლოდინში" trend="საჭიროებს გადახედვას" accent />
        <StatCard n={`${overview.mrr_gel.toLocaleString("ka-GE")} ₾`} label="სავარაუდო MRR" trend="აქტიური წევრების საწევროების ჯამი" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {canSeePayments && recent ? (
          <Card
            header={
              <>
                <h3 className="text-base font-bold text-ink">ბოლო ტრანზაქციები</h3>
                <ButtonLink href="/admin/finances" variant="ghost" size="sm">
                  ყველა →
                </ButtonLink>
              </>
            }
            padded={false}
          >
            {recent.data && recent.data.length > 0 ? (
              <DataTable
                head={
                  <>
                    <th className={tableThClass}>წევრი</th>
                    <th className={tableThClass}>თანხა ₾</th>
                    <th className={tableThClass}>თარიღი</th>
                  </>
                }
              >
                {recent.data.map((p) => (
                  <tr key={p.id} className={tableRowClass}>
                    <td className={`${tableCellClass} font-semibold`}>
                      {p.first_name} {p.last_name}
                    </td>
                    <td className={tableCellClass}>{formatAmountGel(p.amount_gel)}</td>
                    <td className={`${tableCellClass} text-muted-fg`}>{formatDateKa(p.paid_at)}</td>
                  </tr>
                ))}
              </DataTable>
            ) : (
              <p className="p-6 text-sm text-muted-fg">გადახდები ჯერ არ არის აღრიცხული.</p>
            )}
          </Card>
        ) : null}

        <div className="flex flex-col gap-6">
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-brand">
              ვერიფიკაციის რიგი
            </p>
            <p className="mt-2 text-4xl font-extrabold text-brand">
              {overview.pending_delegates.toLocaleString("ka-GE")}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-fg">
              დელეგატი ელოდება დადასტურებას
            </p>
            {hasAnyRole(roles, ["verifier", "super_admin"]) ? (
              <div className="mt-4">
                <ButtonLink href="/admin/verify" variant="primary">
                  გადადი ვერიფიკაციაზე →
                </ButtonLink>
              </div>
            ) : null}
          </Card>

          <Card
            header={<h3 className="text-base font-bold text-ink">წევრები მხარეების მიხედვით</h3>}
          >
            <div className="flex flex-col gap-3">
              {regions.map((r) => (
                <div key={r.region_id}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-ink">{r.name_ka}</span>
                    <span className="text-sm font-extrabold text-ink">
                      {r.member_count.toLocaleString("ka-GE")}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-md bg-surface">
                    <div
                      className="h-full rounded-md bg-brand"
                      style={{ width: `${barPct(r.member_count, maxRegion)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
```

Adjust `StatCard`/`CenteredNotice` props to their REAL signatures — read `components/StatCard.tsx` and `components/CenteredNotice.tsx` first and adapt the JSX above to the actual prop names (e.g. StatCard may use `value`/`hint` naming; keep the Georgian strings byte-identical). Do not restyle the components.

- [ ] **Step 2: Verify build + suite**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: PASS; build compiles `/admin` (page renders live on the preview once deployed — DB reads need the staging env of `.env.local` for local `next dev` checks).

- [ ] **Step 3: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/page.tsx
git commit -m "feat(admin): overview dashboard — real stat cards, regions, queue shortcut"
```

---

### Task 13: წევრები — `/admin/members` list + audited reveal

**Files:**
- Create: `app/(admin)/admin/members/page.tsx`
- Create: `app/(admin)/admin/members/RevealPersonalId.tsx`
- Create: `app/(admin)/admin/members/RevealPersonalId.test.tsx`
- Create: `app/(admin)/admin/members/actions.ts`

**Interfaces:**
- Consumes: `admin_members` view, `admin_reveal_personal_id` RPC (Task 6); `membersFilterSchema`, `MembersFilter` (Task 5); `MEMBER_STATUS_LABELS_KA`, `hasAnyRole`, `isStaff` (Task 4/11); `formatDateKa`, `formatPhoneKa` (lib/cabinet).
- Produces (consumed by Task 14): the filter form + URL-param convention (`search`, `regionId`, `status`, `page`); `RevealResult` action contract.

Filters are a plain GET form (server round-trip, shareable URLs, zero client state). Pagination is 50/page via PostgREST `range` + exact count. Reveal is a client island taking the server action as a prop (house-testable without module mocks).

- [ ] **Step 1: Write the failing component test — `RevealPersonalId.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RevealPersonalId } from "./RevealPersonalId";

describe("RevealPersonalId (spec §3.3 — audited click-to-reveal)", () => {
  it("shows the mask until clicked, then the returned ID", async () => {
    const reveal = vi.fn().mockResolvedValue({ ok: true, personalId: "01017056789" });
    render(<RevealPersonalId memberId="m-1" reveal={reveal} />);
    expect(screen.getByText("•••••••••••")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ჩვენება" }));
    await waitFor(() => expect(screen.getByText("01017056789")).toBeInTheDocument());
    expect(reveal).toHaveBeenCalledWith("m-1");
    expect(screen.queryByRole("button", { name: "ჩვენება" })).not.toBeInTheDocument();
  });
  it("renders a Georgian error and keeps the mask on failure", async () => {
    const reveal = vi.fn().mockResolvedValue({ ok: false, error: "შეცდომა" });
    render(<RevealPersonalId memberId="m-1" reveal={reveal} />);
    await userEvent.click(screen.getByRole("button", { name: "ჩვენება" }));
    await waitFor(() => expect(screen.getByText("შეცდომა")).toBeInTheDocument());
    expect(screen.getByText("•••••••••••")).toBeInTheDocument();
  });
  it("null ID (legacy row) renders an em dash", async () => {
    const reveal = vi.fn().mockResolvedValue({ ok: true, personalId: null });
    render(<RevealPersonalId memberId="m-1" reveal={reveal} />);
    await userEvent.click(screen.getByRole("button", { name: "ჩვენება" }));
    await waitFor(() => expect(screen.getByText("—")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run app/\(admin\)/admin/members/RevealPersonalId.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the action, the island and the page**

`app/(admin)/admin/members/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type RevealResult =
  | { ok: true; personalId: string | null }
  | { ok: false; error: string };

/** super_admin-only member-scope reveal; the RPC re-checks and audits in-DB. */
export async function revealPersonalIdAction(memberId: unknown): Promise<RevealResult> {
  const parsed = z.string().uuid().safeParse(memberId);
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_reveal_personal_id", {
    p_member_id: parsed.data,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, personalId: data ?? null };
}
```

`app/(admin)/admin/members/RevealPersonalId.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { RevealResult } from "./actions";

/**
 * Masked personal ID with deliberate, audited reveal (spec decision #5).
 * The server action is injected as a prop — testable without module mocks.
 */
export function RevealPersonalId({
  memberId,
  reveal,
}: {
  memberId: string;
  reveal: (memberId: string) => Promise<RevealResult>;
}) {
  const [state, setState] = useState<
    | { kind: "masked"; busy: boolean; error: string | null }
    | { kind: "revealed"; personalId: string | null }
  >({ kind: "masked", busy: false, error: null });

  async function onReveal() {
    setState({ kind: "masked", busy: true, error: null });
    const result = await reveal(memberId);
    if (result.ok) setState({ kind: "revealed", personalId: result.personalId });
    else setState({ kind: "masked", busy: false, error: result.error });
  }

  if (state.kind === "revealed") {
    return <span className="font-mono text-sm text-ink">{state.personalId ?? "—"}</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="text-muted-fg">
        •••••••••••
      </span>
      <button
        type="button"
        onClick={onReveal}
        disabled={state.busy}
        className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
      >
        ჩვენება
      </button>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </span>
  );
}
```

`app/(admin)/admin/members/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { hasAnyRole, isStaff, MEMBER_STATUS_LABELS_KA } from "@/lib/admin";
import { membersFilterSchema } from "@/lib/admin-schemas";
import { formatDateKa, formatPhoneKa } from "@/lib/cabinet";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { revealPersonalIdAction } from "./actions";
import { RevealPersonalId } from "./RevealPersonalId";

export const metadata: Metadata = { title: "წევრები — ადმინისტრირება" };

const PAGE_SIZE = 50;

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/members?${next.toString()}`;
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!isStaff(roles)) redirect("/admin");
  const supabase = await createServerSupabase();
  const raw = await searchParams;
  const filter = membersFilterSchema.parse(raw);
  const canReveal = hasAnyRole(roles, ["super_admin"]);
  const canExport = hasAnyRole(roles, ["finance", "super_admin"]);

  let query = supabase.from("admin_members").select("*", { count: "exact" });
  if (filter.search) {
    // strip PostgREST or() syntax + wildcards from user input
    const s = filter.search.replaceAll(/[,%()]/g, " ").trim();
    if (s.length > 0) {
      query = query.or(
        `first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,reference_code.ilike.%${s}%`,
      );
    }
  }
  if (filter.regionId) query = query.eq("region_id", filter.regionId);
  if (filter.status) query = query.eq("status", filter.status);
  const from = (filter.page - 1) * PAGE_SIZE;
  const { data: members, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`admin_members failed: ${error.message}`);

  const { data: regions, error: regionsError } = await supabase
    .from("regions")
    .select("id, name_ka")
    .order("id");
  if (regionsError) throw new Error(`regions failed: ${regionsError.message}`);

  const total = count ?? 0;
  const shownFrom = total === 0 ? 0 : from + 1;
  const shownTo = Math.min(from + PAGE_SIZE, total);
  const currentParams = new URLSearchParams();
  if (filter.search) currentParams.set("search", filter.search);
  if (filter.regionId) currentParams.set("regionId", String(filter.regionId));
  if (filter.status) currentParams.set("status", filter.status);

  return (
    <main>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">წევრების მართვა</h1>
        <p className="mt-2 text-sm text-muted-fg">
          გაფილტრე, მოძებნე და დაათვალიერე ყველა რეგისტრირებული წევრი.
        </p>
      </div>

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-2 flex-col gap-1 text-sm font-semibold text-ink">
            ძებნა
            <input
              type="text"
              name="search"
              defaultValue={filter.search ?? ""}
              placeholder="სახელი, ტელეფონი ან GR-კოდი…"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="flex min-w-[170px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            რეგიონი
            <select
              name="regionId"
              defaultValue={filter.regionId ? String(filter.regionId) : ""}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"
            >
              <option value="">ყველა მხარე</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name_ka}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            სტატუსი
            <select
              name="status"
              defaultValue={filter.status ?? ""}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"
            >
              <option value="">ყველა სტატუსი</option>
              <option value="active_member">აქტიური</option>
              <option value="profile_completed">რეგისტრირებული</option>
              <option value="draft">მონახაზი</option>
            </select>
          </label>
          <Button type="submit" variant="dark">
            ფილტრი
          </Button>
        </form>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-fg">
          ნაჩვენებია {shownFrom.toLocaleString("ka-GE")}–{shownTo.toLocaleString("ka-GE")} /{" "}
          {total.toLocaleString("ka-GE")}
        </p>
        {/* Export controls arrive in Task 14 for finance/super_admin */}
        {canExport ? <div data-slot="export-controls" /> : null}
      </div>

      <Card padded={false} className="mt-2">
        {members.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-fg">შედეგი ვერ მოიძებნა.</p>
        ) : (
          <DataTable
            bodyTestId="admin-members-body"
            head={
              <>
                <th className={tableThClass}>სახელი გვარი</th>
                <th className={tableThClass}>ტელეფონი</th>
                <th className={tableThClass}>რეგიონი</th>
                <th className={tableThClass}>დელეგატი</th>
                <th className={tableThClass}>საწევრო</th>
                <th className={tableThClass}>კოდი</th>
                <th className={tableThClass}>სტატუსი</th>
                <th className={tableThClass}>თარიღი</th>
                {canReveal ? <th className={tableThClass}>პირადი ნომერი</th> : null}
              </>
            }
          >
            {members.map((m) => (
              <tr key={m.id} className={tableRowClass}>
                <td className={`${tableCellClass} font-semibold`}>
                  {m.first_name} {m.last_name}
                  {m.is_delegate ? <span className="ms-1 text-xs text-muted-fg">· დელეგატი</span> : null}
                </td>
                <td className={tableCellClass}>{formatPhoneKa(m.phone)}</td>
                <td className={tableCellClass}>{m.region_name_ka ?? "—"}</td>
                <td className={tableCellClass}>
                  {m.delegate_id ? `${m.delegate_first_name} ${m.delegate_last_name}` : "ცენტრალური მოძრაობა"}
                </td>
                <td className={tableCellClass}>
                  {m.membership_tier === null ? "—" : `${m.membership_tier} ₾`}
                </td>
                <td className={`${tableCellClass} font-mono text-xs`}>{m.reference_code ?? "—"}</td>
                <td className={tableCellClass}>
                  <Pill status={m.status} label={MEMBER_STATUS_LABELS_KA[m.status]} />
                </td>
                <td className={`${tableCellClass} text-muted-fg`}>{formatDateKa(m.created_at)}</td>
                {canReveal ? (
                  <td className={tableCellClass}>
                    <RevealPersonalId memberId={m.id} reveal={revealPersonalIdAction} />
                  </td>
                ) : null}
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between">
        {filter.page > 1 ? (
          <ButtonLink href={pageHref(currentParams, filter.page - 1)} variant="ghost" size="sm">
            ← წინა
          </ButtonLink>
        ) : (
          <span />
        )}
        {shownTo < total ? (
          <ButtonLink href={pageHref(currentParams, filter.page + 1)} variant="ghost" size="sm">
            შემდეგი →
          </ButtonLink>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
```

Check `Card`'s real props first (Phase 1 added `header` + `padded`; if `className` is not a prop, wrap in a `<div className="mt-2">` instead — never restyle the component).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/members
git commit -m "feat(admin): member list — search/filters/pagination + audited ID reveal"
```

### Task 14: Audited CSV export — route + controls

**Files:**
- Create: `app/(admin)/admin/members/export/route.ts`
- Create: `app/(admin)/admin/members/ExportControls.tsx`
- Create: `app/(admin)/admin/members/ExportControls.test.tsx`
- Modify: `app/(admin)/admin/members/page.tsx` (mount the controls in the reserved slot)

**Interfaces:**
- Consumes: `admin_export_members` RPC (Task 6); `memberExportCsv`, `exportFileName`, `MemberExportRow` (Task 3); `membersFilterSchema`, `todayTbilisiIso` (Task 5); `MEMBER_STATUS_LABELS_KA` (Task 4); Task 13's URL-param convention.
- Produces: `GET /admin/members/export?search=&regionId=&status=&includeIds=1` → `text/csv` download; one `member.export` audit row per download (written by the RPC).

- [ ] **Step 1: Write the failing component test — `ExportControls.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ExportControls } from "./ExportControls";

describe("ExportControls (spec §3.3 — decision #4/#6)", () => {
  it("builds the export URL from the active filters", () => {
    render(
      <ExportControls
        search="ნინო"
        regionId={3}
        status="active_member"
        canIncludeIds={false}
      />,
    );
    const link = screen.getByRole("link", { name: "ექსპორტი (CSV)" });
    expect(link).toHaveAttribute(
      "href",
      "/admin/members/export?search=%E1%83%9C%E1%83%98%E1%83%9C%E1%83%9D&regionId=3&status=active_member",
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("super_admin sees the include-IDs checkbox, off by default; ticking adds includeIds=1", async () => {
    render(<ExportControls search={undefined} regionId={undefined} status={undefined} canIncludeIds />);
    const checkbox = screen.getByRole("checkbox", { name: "პირადი ნომრების ჩართვა" });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("link", { name: "ექსპორტი (CSV)" })).toHaveAttribute(
      "href",
      "/admin/members/export?",
    );
    await userEvent.click(checkbox);
    expect(screen.getByRole("link", { name: "ექსპორტი (CSV)" })).toHaveAttribute(
      "href",
      "/admin/members/export?includeIds=1",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run app/\(admin\)/admin/members/ExportControls.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement controls + route**

`app/(admin)/admin/members/ExportControls.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { MemberStatusRow } from "@/lib/supabase/types";

/** Export honors the active filters; the IDs checkbox exists only for super_admin. */
export function ExportControls({
  search,
  regionId,
  status,
  canIncludeIds,
}: {
  search: string | undefined;
  regionId: number | undefined;
  status: MemberStatusRow | undefined;
  canIncludeIds: boolean;
}) {
  const [includeIds, setIncludeIds] = useState(false);
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (regionId) params.set("regionId", String(regionId));
  if (status) params.set("status", status);
  if (canIncludeIds && includeIds) params.set("includeIds", "1");

  return (
    <div className="flex items-center gap-4">
      {canIncludeIds ? (
        <label className="flex items-center gap-2 text-sm text-muted-fg">
          <input
            type="checkbox"
            checked={includeIds}
            onChange={(e) => setIncludeIds(e.target.checked)}
          />
          პირადი ნომრების ჩართვა
        </label>
      ) : null}
      <a
        href={`/admin/members/export?${params.toString()}`}
        className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
      >
        ექსპორტი (CSV)
      </a>
    </div>
  );
}
```

(If a `ButtonLink` `dark` variant fits without restyling, prefer it over the raw anchor classes — check `components/ButtonLink.tsx`; a plain `<a>` is used above because the download must NOT go through the Next router.)

`app/(admin)/admin/members/export/route.ts`:

```ts
import { hasAnyRole, MEMBER_STATUS_LABELS_KA } from "@/lib/admin";
import { membersFilterSchema, todayTbilisiIso } from "@/lib/admin-schemas";
import { exportFileName, memberExportCsv, type MemberExportRow } from "@/lib/csv";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import type { MemberStatusRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface ExportedRow {
  firstName: string;
  lastName: string;
  phone: string | null;
  regionNameKa: string | null;
  cityNameKa: string | null;
  delegateName: string | null;
  status: MemberStatusRow;
  tier: number | null;
  referenceCode: string | null;
  registeredAt: string;
  personalId?: string | null;
}

/** Audited roster export (spec §3.3): the RPC re-checks roles and writes member.export. */
export async function GET(request: Request) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["finance", "super_admin"])) {
    return new Response("forbidden", { status: 403 });
  }
  const url = new URL(request.url);
  const filter = membersFilterSchema.parse(Object.fromEntries(url.searchParams));
  const includeIds = url.searchParams.get("includeIds") === "1";
  if (includeIds && !hasAnyRole(roles, ["super_admin"])) {
    return new Response("forbidden", { status: 403 });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_export_members", {
    p_search: filter.search ?? null,
    p_region_id: filter.regionId ?? null,
    p_status: filter.status ?? null,
    p_include_ids: includeIds,
  });
  if (error) return new Response(`export failed: ${error.message}`, { status: 500 });

  const rows = (data as unknown as ExportedRow[]).map(
    (r): MemberExportRow => ({
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone,
      regionNameKa: r.regionNameKa,
      cityNameKa: r.cityNameKa,
      delegateName: r.delegateName,
      statusKa: MEMBER_STATUS_LABELS_KA[r.status],
      tier: r.tier,
      referenceCode: r.referenceCode,
      registeredAt: r.registeredAt,
      personalId: r.personalId ?? null,
    }),
  );
  const csv = memberExportCsv(rows, includeIds);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFileName(todayTbilisiIso())}"`,
      "cache-control": "no-store",
    },
  });
}
```

In `app/(admin)/admin/members/page.tsx`, replace the reserved slot line `{canExport ? <div data-slot="export-controls" /> : null}` with:

```tsx
        {canExport ? (
          <ExportControls
            search={filter.search}
            regionId={filter.regionId}
            status={filter.status}
            canIncludeIds={hasAnyRole(roles, ["super_admin"])}
          />
        ) : null}
```

and add `import { ExportControls } from "./ExportControls";`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/members
git commit -m "feat(admin): audited CSV export — filtered roster, super-only ID inclusion"
```

---

### Task 15: ვერიფიკაცია — queue with three tabs, approve/reject

**Files:**
- Create: `app/(admin)/admin/verify/page.tsx`
- Create: `app/(admin)/admin/verify/VerifyCard.tsx`
- Create: `app/(admin)/admin/verify/VerifyCard.test.tsx`
- Create: `app/(admin)/admin/verify/actions.ts`

**Interfaces:**
- Consumes: `admin_delegate_queue` view, `admin_approve_delegate`, `admin_reject_delegate`, `admin_reveal_applicant_personal_id` RPCs (Task 6); `makeSlug` from `lib/slug.ts` (Phase 1, consumed HERE); `approveDelegateSchema`, `rejectDelegateSchema` (Task 5); `RevealPersonalId` (Task 13 — reused with the applicant-scope action).
- Produces (consumed by Tasks 16, 25): `/admin/verify?tab=pending|approved|rejected`; `ApproveResult = { ok: true; slug: string } | { ok: false; error: string }`; `VerifyActionResult = { ok: true } | { ok: false; error: string }`.

- [ ] **Step 1: Write the failing component test — `VerifyCard.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VerifyCard } from "./VerifyCard";

const applicant = {
  id: "d-1",
  firstName: "გიორგი",
  lastName: "მელაძე",
  regionNameKa: "იმერეთი",
  phone: "+995551112233",
  createdAt: "2026-07-10T10:00:00Z",
  reviewNote: null as string | null,
};

function noopReveal() {
  return Promise.resolve({ ok: true as const, personalId: "01017056789" });
}

describe("VerifyCard (spec §3.4)", () => {
  it("renders applicant facts with the ID masked and both actions", () => {
    render(
      <VerifyCard
        applicant={applicant}
        mode="pending"
        reveal={noopReveal}
        approve={vi.fn()}
        reject={vi.fn()}
      />,
    );
    expect(screen.getByText("გიორგი მელაძე")).toBeInTheDocument();
    expect(screen.getByText("იმერეთი")).toBeInTheDocument();
    expect(screen.getByText("•••••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "დადასტურება" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "უარყოფა" })).toBeInTheDocument();
  });

  it("approve calls the action and shows the public-page link on success", async () => {
    const approve = vi.fn().mockResolvedValue({ ok: true, slug: "giorgi-meladze" });
    render(
      <VerifyCard
        applicant={applicant}
        mode="pending"
        reveal={noopReveal}
        approve={approve}
        reject={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "დადასტურება" }));
    await waitFor(() =>
      expect(screen.getByText(/დელეგატი დამტკიცდა/)).toBeInTheDocument(),
    );
    expect(approve).toHaveBeenCalledWith("d-1");
    expect(screen.getByRole("link", { name: /საჯარო გვერდი/ })).toHaveAttribute(
      "href",
      "/delegates/giorgi-meladze",
    );
  });

  it("reject asks for an optional note, then confirms", async () => {
    const reject = vi.fn().mockResolvedValue({ ok: true });
    render(
      <VerifyCard
        applicant={applicant}
        mode="pending"
        reveal={noopReveal}
        approve={vi.fn()}
        reject={reject}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "უარყოფა" }));
    await userEvent.type(screen.getByLabelText(/შიდა შენიშვნა/), "დოკუმენტები აკლია");
    await userEvent.click(screen.getByRole("button", { name: "უარყოფის დადასტურება" }));
    await waitFor(() => expect(screen.getByText(/უარყოფილია/)).toBeInTheDocument());
    expect(reject).toHaveBeenCalledWith("d-1", "დოკუმენტები აკლია");
  });

  it("rejected mode shows the stored note and only the re-approve action", () => {
    render(
      <VerifyCard
        applicant={{ ...applicant, reviewNote: "დოკუმენტები აკლია" }}
        mode="rejected"
        reveal={noopReveal}
        approve={vi.fn()}
        reject={vi.fn()}
      />,
    );
    expect(screen.getByText(/დოკუმენტები აკლია/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "დადასტურება" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "უარყოფა" })).not.toBeInTheDocument();
  });

  it("surfaces action errors in Georgian", async () => {
    const approve = vi.fn().mockResolvedValue({ ok: false, error: "შეცდომა" });
    render(
      <VerifyCard
        applicant={applicant}
        mode="pending"
        reveal={noopReveal}
        approve={approve}
        reject={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "დადასტურება" }));
    await waitFor(() => expect(screen.getByText("შეცდომა")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run app/\(admin\)/admin/verify/VerifyCard.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement actions, card, page**

`app/(admin)/admin/verify/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { approveDelegateSchema, rejectDelegateSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { makeSlug } from "@/lib/slug";
import { createServerSupabase } from "@/lib/supabase/server";

export type ApproveResult = { ok: true; slug: string } | { ok: false; error: string };
export type VerifyActionResult = { ok: true } | { ok: false; error: string };
export type RevealResult = { ok: true; personalId: string | null } | { ok: false; error: string };

/**
 * Approve (spec §3.4): the server computes the slug with Phase 1's makeSlug over
 * the currently-taken set and retries on a concurrent duplicate (23505) — the RPC
 * stamps status/verified_at/verified_by and writes the audit row atomically.
 */
export async function approveDelegateAction(delegateId: unknown): Promise<ApproveResult> {
  const parsed = approveDelegateSchema.safeParse({ delegateId });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();

  const { data: applicant, error: applicantError } = await supabase
    .from("admin_delegate_queue")
    .select("first_name, last_name")
    .eq("id", parsed.data.delegateId)
    .single();
  if (applicantError || !applicant) {
    return { ok: false, error: mapFunnelError(applicantError?.message ?? "invalid_target") };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: taken, error: takenError } = await supabase
      .from("admin_delegate_queue")
      .select("slug")
      .not("slug", "is", null);
    if (takenError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
    const takenSet = new Set((taken ?? []).map((t) => t.slug as string));
    const slug = makeSlug(`${applicant.first_name} ${applicant.last_name}`, takenSet);

    const { data, error } = await supabase.rpc("admin_approve_delegate", {
      p_delegate_id: parsed.data.delegateId,
      p_slug: slug,
    });
    if (!error) {
      const approvedSlug = (data as { slug: string }).slug;
      revalidatePath("/admin/verify");
      revalidatePath(`/delegates/${approvedSlug}`);
      return { ok: true, slug: approvedSlug };
    }
    // 23505 = a concurrent approval took this slug — refetch and retry
    if (error.code !== "23505") return { ok: false, error: mapFunnelError(error.message) };
  }
  return { ok: false, error: mapFunnelError("invalid_slug") };
}

export async function rejectDelegateAction(
  delegateId: unknown,
  note: unknown,
): Promise<VerifyActionResult> {
  const parsed = rejectDelegateSchema.safeParse({ delegateId, note: note ?? "" });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_reject_delegate", {
    p_delegate_id: parsed.data.delegateId,
    p_note: parsed.data.note === "" ? null : parsed.data.note,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/verify");
  return { ok: true };
}

/** verifier/super_admin — applicant scope only; audited by the RPC. */
export async function revealApplicantIdAction(delegateId: unknown): Promise<RevealResult> {
  const parsed = approveDelegateSchema.safeParse({ delegateId });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_reveal_applicant_personal_id", {
    p_delegate_id: parsed.data.delegateId,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, personalId: data ?? null };
}
```

`app/(admin)/admin/verify/VerifyCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { formatDateKa, formatPhoneKa, initialsKa } from "@/lib/cabinet";
import { RevealPersonalId } from "../members/RevealPersonalId";
import type { ApproveResult, RevealResult, VerifyActionResult } from "./actions";

export interface QueueApplicant {
  id: string;
  firstName: string;
  lastName: string;
  regionNameKa: string | null;
  phone: string | null;
  createdAt: string;
  reviewNote: string | null;
}

export function VerifyCard({
  applicant,
  mode,
  reveal,
  approve,
  reject,
}: {
  applicant: QueueApplicant;
  mode: "pending" | "rejected";
  reveal: (delegateId: string) => Promise<RevealResult>;
  approve: (delegateId: string) => Promise<ApproveResult>;
  reject: (delegateId: string, note: string) => Promise<VerifyActionResult>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ kind: "approved"; slug: string } | { kind: "rejected" } | null>(
    null,
  );

  async function onApprove() {
    setBusy(true);
    setError(null);
    const result = await approve(applicant.id);
    setBusy(false);
    if (result.ok) setDone({ kind: "approved", slug: result.slug });
    else setError(result.error);
  }

  async function onReject() {
    setBusy(true);
    setError(null);
    const result = await reject(applicant.id, note.trim());
    setBusy(false);
    if (result.ok) setDone({ kind: "rejected" });
    else setError(result.error);
  }

  if (done?.kind === "approved") {
    return (
      <div className="rounded-xl border border-line bg-white p-5">
        <p className="text-sm font-semibold text-ok">
          დელეგატი დამტკიცდა ✓ · რეფერალური ბმული აქტიურია
        </p>
        <a
          href={`/delegates/${done.slug}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-sm font-semibold text-brand hover:underline"
        >
          საჯარო გვერდი →
        </a>
      </div>
    );
  }
  if (done?.kind === "rejected") {
    return (
      <div className="rounded-xl border border-line bg-white p-5">
        <p className="text-sm font-semibold text-danger">განაცხადი უარყოფილია.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-[260px] flex-1 items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-sm font-bold text-ink">
            {initialsKa(applicant.firstName, applicant.lastName)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-ink">
                {applicant.firstName} {applicant.lastName}
              </h3>
              <Pill
                status={mode === "pending" ? "pending" : "rejected"}
                label={mode === "pending" ? "მოლოდინში" : "უარყოფილი"}
              />
            </div>
            <p className="text-sm font-semibold text-muted-fg">
              {applicant.regionNameKa ?? "—"}
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-fg">
                  პირადი ნომერი
                </dt>
                <dd>
                  <RevealPersonalId memberId={applicant.id} reveal={reveal} />
                </dd>
              </div>
              <div>
                <dt className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-fg">
                  ტელეფონი
                </dt>
                <dd className="font-semibold">{formatPhoneKa(applicant.phone)}</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-fg">
                  რეგისტრაცია
                </dt>
                <dd className="font-semibold">{formatDateKa(applicant.createdAt)}</dd>
              </div>
            </dl>
            {applicant.reviewNote ? (
              <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-muted-fg">
                შიდა შენიშვნა: {applicant.reviewNote}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          {mode === "pending" && !rejecting ? (
            <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy}>
              უარყოფა
            </Button>
          ) : null}
          <Button variant="primary" onClick={onApprove} disabled={busy}>
            დადასტურება
          </Button>
        </div>
      </div>

      {rejecting && mode === "pending" ? (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <label className="flex min-w-[280px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            შიდა შენიშვნა (არასავალდებულო — განმცხადებელი ვერ ხედავს)
            <input
              type="text"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"
            />
          </label>
          <Button variant="danger" onClick={onReject} disabled={busy}>
            უარყოფის დადასტურება
          </Button>
          <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
            გაუქმება
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
```

`app/(admin)/admin/verify/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { hasAnyRole } from "@/lib/admin";
import { formatDateKa } from "@/lib/cabinet";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { approveDelegateAction, rejectDelegateAction, revealApplicantIdAction } from "./actions";
import { VerifyCard } from "./VerifyCard";

export const metadata: Metadata = { title: "ვერიფიკაცია — ადმინისტრირება" };

const TABS = [
  { key: "pending", label: "მოლოდინში" },
  { key: "approved", label: "დამტკიცებული" },
  { key: "rejected", label: "უარყოფილი" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["verifier", "super_admin"])) redirect("/admin");
  const raw = await searchParams;
  const tab: TabKey = raw.tab === "approved" || raw.tab === "rejected" ? raw.tab : "pending";

  const supabase = await createServerSupabase();
  const { data: rows, error } = await supabase
    .from("admin_delegate_queue")
    .select("*")
    .eq("status", tab)
    .order(tab === "pending" ? "created_at" : "verified_at", {
      ascending: tab === "pending", // oldest applications first; newest decisions first
    });
  if (error) throw new Error(`admin_delegate_queue failed: ${error.message}`);

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">დელეგატების ვერიფიკაცია</h1>
        <p className="mt-2 text-sm text-muted-fg">
          დადასტურება ააქტიურებს დელეგატის რეფერალურ ბმულს და აქცევს პროფილს საჯაროდ ხილვადს
          რეიტინგსა და პორტალზე.
        </p>
      </div>

      <nav className="mb-6 flex gap-1 border-b border-line pb-2" aria-label="სტატუსის ფილტრი">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/verify?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === t.key ? "bg-brand/10 text-brand" : "text-muted-fg hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "approved" ? (
        <Card padded={false}>
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-fg">
              დამტკიცებული დელეგატები ჯერ არ არის.
            </p>
          ) : (
            <DataTable
              head={
                <>
                  <th className={tableThClass}>დელეგატი</th>
                  <th className={tableThClass}>რეგიონი</th>
                  <th className={tableThClass}>საჯარო გვერდი</th>
                  <th className={tableThClass}>მხარდამჭერები</th>
                  <th className={tableThClass}>ბიო / ფოტო</th>
                  <th className={tableThClass}>დამტკიცდა</th>
                  <th className={tableThClass}></th>
                </>
              }
            >
              {rows.map((d) => (
                <tr key={d.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-semibold`}>
                    {d.first_name} {d.last_name}
                  </td>
                  <td className={tableCellClass}>{d.region_name_ka ?? "—"}</td>
                  <td className={tableCellClass}>
                    {d.slug ? (
                      <a
                        href={`/delegates/${d.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand hover:underline"
                      >
                        /{d.slug}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={tableCellClass}>
                    {d.active_supporters} აქტიური · {d.total_supporters} სულ
                  </td>
                  <td className={tableCellClass}>
                    {d.bio ? "ბიო ✓" : "ბიო —"} · {d.photo_url ? "ფოტო ✓" : "ფოტო —"}
                  </td>
                  <td className={`${tableCellClass} text-muted-fg`}>
                    {d.verified_at ? formatDateKa(d.verified_at) : "—"}
                  </td>
                  <td className={tableCellClass}>
                    <ButtonLink href={`/admin/verify/${d.id}`} variant="ghost" size="sm">
                      რედაქტირება
                    </ButtonLink>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl">🗂️</p>
            <h3 className="mt-2 text-base font-bold text-ink">
              {tab === "pending"
                ? "ვერიფიკაციის მოლოდინში დელეგატები არ არის"
                : "უარყოფილი განაცხადები არ არის"}
            </h3>
            {tab === "pending" ? (
              <p className="mt-1 text-sm text-muted-fg">ყველა განაცხადი დამუშავებულია.</p>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((d) => (
            <VerifyCard
              key={d.id}
              applicant={{
                id: d.id,
                firstName: d.first_name,
                lastName: d.last_name,
                regionNameKa: d.region_name_ka,
                phone: d.phone,
                createdAt: d.created_at,
                reviewNote: d.review_note,
              }}
              mode={tab}
              reveal={revealApplicantIdAction}
              approve={approveDelegateAction}
              reject={rejectDelegateAction}
            />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/verify
git commit -m "feat(admin): verification queue — three tabs, slug-minting approve, reversible reject"
```

---

### Task 16: Delegate bio/photo editor — `/admin/verify/[id]`

**Files:**
- Create: `app/(admin)/admin/verify/[id]/page.tsx`
- Create: `app/(admin)/admin/verify/[id]/DelegateProfileForm.tsx`
- Create: `app/(admin)/admin/verify/[id]/DelegateProfileForm.test.tsx`
- Create: `app/(admin)/admin/verify/[id]/actions.ts`

**Interfaces:**
- Consumes: `admin_delegate_queue` view, `admin_update_delegate_profile` RPC, `delegate-photos` bucket (Task 6); `delegateProfileSchema`, `PHOTO_MAX_BYTES`, `PHOTO_TYPES` (Task 5); `createAdminClient` (the ONE service-role app path this phase — behind the role precheck + in-DB re-check).
- Produces: photo URLs shaped `https://<project>.supabase.co/storage/v1/object/public/delegate-photos/<id>-<ts>.<ext>` stored on `delegates.photo_url`; public pages render them via their existing `<img>`.

- [ ] **Step 1: Write the failing component test — `DelegateProfileForm.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DelegateProfileForm } from "./DelegateProfileForm";

describe("DelegateProfileForm (spec §3.4)", () => {
  it("prefills the bio and submits FormData through the injected action", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    render(
      <DelegateProfileForm delegateId="d-1" initialBio="ძველი ბიო" photoUrl={null} save={save} />,
    );
    const bio = screen.getByLabelText(/ბიოგრაფია/);
    expect(bio).toHaveValue("ძველი ბიო");
    await userEvent.clear(bio);
    await userEvent.type(bio, "ახალი ბიო");
    await userEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(screen.getByText(/პროფილი განახლდა/)).toBeInTheDocument());
    const fd = save.mock.calls[0]![0] as FormData;
    expect(fd.get("delegateId")).toBe("d-1");
    expect(fd.get("bio")).toBe("ახალი ბიო");
  });

  it("refuses an oversized photo client-side without calling the action", async () => {
    const save = vi.fn();
    render(<DelegateProfileForm delegateId="d-1" initialBio="" photoUrl={null} save={save} />);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    await userEvent.upload(screen.getByLabelText(/ფოტო/), big);
    await userEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(screen.getByText(/ფოტო არ უნდა აღემატებოდეს 5 MB-ს/)).toBeInTheDocument(),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("refuses a wrong file type client-side", async () => {
    const save = vi.fn();
    render(<DelegateProfileForm delegateId="d-1" initialBio="" photoUrl={null} save={save} />);
    const pdf = new File([new Uint8Array(10)], "cv.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText(/ფოტო/), pdf);
    await userEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(screen.getByText(/დაშვებულია მხოლოდ JPEG, PNG ან WebP/)).toBeInTheDocument(),
    );
    expect(save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run "app/(admin)/admin/verify/[id]/DelegateProfileForm.test.tsx"`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the action, form and page**

`app/(admin)/admin/verify/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { hasAnyRole } from "@/lib/admin";
import { delegateProfileSchema, PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export type SaveProfileResult = { ok: true } | { ok: false; error: string };

/**
 * The one service-role path of this phase (spec §6): the storage upload. Guarded
 * app-side by the role precheck AND paired with the in-DB re-checking RPC — the
 * URL only lands on the delegate row if admin_update_delegate_profile accepts it.
 */
export async function updateDelegateProfileAction(formData: FormData): Promise<SaveProfileResult> {
  const parsed = delegateProfileSchema.safeParse({
    delegateId: formData.get("delegateId"),
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["verifier", "super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const supabase = await createServerSupabase();

  const { data: current, error: currentError } = await supabase
    .from("admin_delegate_queue")
    .select("photo_url, slug")
    .eq("id", parsed.data.delegateId)
    .single();
  if (currentError || !current) return { ok: false, error: mapFunnelError("invalid_target") };

  let photoUrl = current.photo_url;
  let oldPath: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const ext = PHOTO_TYPES[photo.type];
    if (!ext) return { ok: false, error: "დაშვებულია მხოლოდ JPEG, PNG ან WebP ფოტო." };
    if (photo.size > PHOTO_MAX_BYTES) {
      return { ok: false, error: "ფოტო არ უნდა აღემატებოდეს 5 MB-ს." };
    }
    const admin = createAdminClient();
    // versioned filename: an updated photo must never serve stale from CDN caches
    const path = `${parsed.data.delegateId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("delegate-photos")
      .upload(path, await photo.arrayBuffer(), { contentType: photo.type });
    if (uploadError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
    photoUrl = admin.storage.from("delegate-photos").getPublicUrl(path).data.publicUrl;
    const marker = "/delegate-photos/";
    const idx = current.photo_url?.indexOf(marker) ?? -1;
    oldPath = idx >= 0 ? (current.photo_url as string).slice(idx + marker.length) : null;
  }

  const { error: rpcError } = await supabase.rpc("admin_update_delegate_profile", {
    p_delegate_id: parsed.data.delegateId,
    p_bio: parsed.data.bio === "" ? null : parsed.data.bio,
    p_photo_url: photoUrl,
  });
  if (rpcError) return { ok: false, error: mapFunnelError(rpcError.message) };

  if (oldPath) {
    // best-effort — a stale object is harmless; the row already points at the new one
    await createAdminClient().storage.from("delegate-photos").remove([oldPath]);
  }
  revalidatePath(`/admin/verify/${parsed.data.delegateId}`);
  if (current.slug) revalidatePath(`/delegates/${current.slug}`);
  return { ok: true };
}
```

`app/(admin)/admin/verify/[id]/DelegateProfileForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/admin-schemas";
import type { SaveProfileResult } from "./actions";

export function DelegateProfileForm({
  delegateId,
  initialBio,
  photoUrl,
  save,
}: {
  delegateId: string;
  initialBio: string;
  photoUrl: string | null;
  save: (formData: FormData) => Promise<SaveProfileResult>;
}) {
  const [bio, setBio] = useState(initialBio);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (!PHOTO_TYPES[photo.type]) {
        setNotice({ kind: "error", text: "დაშვებულია მხოლოდ JPEG, PNG ან WebP ფოტო." });
        return;
      }
      if (photo.size > PHOTO_MAX_BYTES) {
        setNotice({ kind: "error", text: "ფოტო არ უნდა აღემატებოდეს 5 MB-ს." });
        return;
      }
    }
    setBusy(true);
    const result = await save(formData);
    setBusy(false);
    if (result.ok) setNotice({ kind: "ok", text: "პროფილი განახლდა ✓" });
    else setNotice({ kind: "error", text: result.error });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="delegateId" value={delegateId} />
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        ბიოგრაფია (საჯარო გვერდზე ჩანს)
        <textarea
          name="bio"
          value={bio}
          maxLength={1000}
          rows={6}
          onChange={(e) => setBio(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"
        />
        <span className="text-xs font-normal text-muted-fg">{bio.length} / 1000</span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        ფოტო (JPEG/PNG/WebP, მაქს. 5 MB)
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm font-normal"
        />
      </label>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage-hosted; next/image host config is a Phase 6 item (spec §3.4)
        <img
          src={photoUrl}
          alt="დელეგატის მიმდინარე ფოტო"
          className="h-32 w-32 rounded-xl border border-line object-cover"
        />
      ) : (
        <p className="text-sm text-muted-fg">ფოტო ჯერ არ არის ატვირთული.</p>
      )}
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          შენახვა
        </Button>
      </div>
      {notice ? (
        <p className={`text-sm ${notice.kind === "ok" ? "text-ok" : "text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </form>
  );
}
```

`app/(admin)/admin/verify/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { hasAnyRole } from "@/lib/admin";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { updateDelegateProfileAction } from "./actions";
import { DelegateProfileForm } from "./DelegateProfileForm";

export const metadata: Metadata = { title: "დელეგატის პროფილი — ადმინისტრირება" };

export default async function DelegateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["verifier", "super_admin"])) redirect("/admin");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: delegate, error } = await supabase
    .from("admin_delegate_queue")
    .select("id, first_name, last_name, region_name_ka, status, slug, bio, photo_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`admin_delegate_queue failed: ${error.message}`);
  if (!delegate || delegate.status !== "approved") redirect("/admin/verify");

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">
          {delegate.first_name} {delegate.last_name}
        </h1>
        <p className="mt-1 text-sm text-muted-fg">
          {delegate.region_name_ka ?? "—"} ·{" "}
          {delegate.slug ? (
            <a
              href={`/delegates/${delegate.slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand hover:underline"
            >
              საჯარო გვერდი →
            </a>
          ) : null}
        </p>
      </div>
      <Card header={<h3 className="text-base font-bold text-ink">ბიო და ფოტო</h3>}>
        <DelegateProfileForm
          delegateId={delegate.id}
          initialBio={delegate.bio ?? ""}
          photoUrl={delegate.photo_url}
          save={updateDelegateProfileAction}
        />
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add "app/(admin)/admin/verify/[id]"
git commit -m "feat(admin): delegate bio/photo editor — versioned storage uploads, audited"
```

### Task 17: ფინანსები — single-entry recording

**Files:**
- Create: `app/(admin)/admin/finances/types.ts`
- Create: `app/(admin)/admin/finances/actions.ts`
- Create: `app/(admin)/admin/finances/RecordPayment.tsx`
- Create: `app/(admin)/admin/finances/RecordPayment.test.tsx`
- Create: `app/(admin)/admin/finances/page.tsx`

**Interfaces:**
- Consumes: `admin_members` view, `admin_record_payment` RPC (Task 6); `memberLookupSchema`, `recordPaymentSchema`, `todayTbilisiIso` (Task 5); `monthsFor` (Task 1); `isReferenceCode` (lib/funnel); `MEMBER_STATUS_LABELS_KA` (Task 4).
- Produces (consumed by Tasks 18–19): the `/admin/finances` page skeleton with two replacement markers (`{/* BULK-MATCH (Task 18) */}`, `{/* FINANCE-STATS (Task 19) */}`); `app/(admin)/admin/finances/types.ts` with:

```ts
import type { MemberStatusRow } from "@/lib/supabase/types";

export interface MemberCandidate {
  id: string;
  name: string;
  regionNameKa: string | null;
  tier: number | null;
  status: MemberStatusRow;
  referenceCode: string;
}
export type LookupResult =
  | { ok: true; candidates: MemberCandidate[] }
  | { ok: false; error: string };
export type RecordResult =
  | { ok: true; months: number; newStatus: MemberStatusRow }
  | { ok: false; error: string };

export type BulkStatus =
  | "ok"
  | "no_code"
  | "no_amount"
  | "ambiguous_amount"
  | "unknown_code"
  | "duplicate"
  | "duplicate_line";
export interface BulkPreviewRow {
  index: number;
  line: string;
  code: string | null;
  amountGel: number | null;
  paidAt: string | null;
  status: BulkStatus;
  memberName: string | null;
  months: number | null;
}
export type BulkPreviewResult =
  | { ok: true; rows: BulkPreviewRow[] }
  | { ok: false; error: string };
export type BulkConfirmResult =
  | { ok: true; count: number; totalGel: number }
  | { ok: false; error: string; rowIndex: number | null };
```

(Write the full `types.ts` above verbatim in this task — Task 18 uses the Bulk* types.)

- [ ] **Step 1: Write the failing component test — `RecordPayment.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordPayment } from "./RecordPayment";

const candidate = {
  id: "m-1",
  name: "ნინო ბერიძე",
  regionNameKa: "იმერეთი",
  tier: 20,
  status: "profile_completed" as const,
  referenceCode: "GR-ABC234",
};

describe("RecordPayment (spec §3.5 — single entry)", () => {
  it("looks up, picks a member, previews months live, records", async () => {
    const lookup = vi.fn().mockResolvedValue({ ok: true, candidates: [candidate] });
    const record = vi.fn().mockResolvedValue({ ok: true, months: 3, newStatus: "active_member" });
    render(<RecordPayment lookup={lookup} record={record} />);

    await userEvent.type(screen.getByLabelText(/წევრის ძებნა/), "GR-ABC234");
    await userEvent.click(screen.getByRole("button", { name: "ძებნა" }));
    await waitFor(() => expect(screen.getByText(/ნინო ბერიძე/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /ნინო ბერიძე/ }));

    const amount = screen.getByLabelText(/თანხა/);
    await userEvent.clear(amount);
    await userEvent.type(amount, "60");
    expect(screen.getByText(/→ 3 თვე/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "აღრიცხვა" }));
    await waitFor(() => expect(screen.getByText(/აღირიცხა — 3 თვე/)).toBeInTheDocument());
    expect(screen.getByText(/წევრი ახლა აქტიურია/)).toBeInTheDocument();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: "m-1", amountGel: 60 }),
    );
  });

  it("no candidates → honest empty result", async () => {
    const lookup = vi.fn().mockResolvedValue({ ok: true, candidates: [] });
    render(<RecordPayment lookup={lookup} record={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/წევრის ძებნა/), "არავინ");
    await userEvent.click(screen.getByRole("button", { name: "ძებნა" }));
    await waitFor(() => expect(screen.getByText(/ვერ მოიძებნა/)).toBeInTheDocument());
  });

  it("surfaces record errors in Georgian and keeps the form", async () => {
    const lookup = vi.fn().mockResolvedValue({ ok: true, candidates: [candidate] });
    const record = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "ამ საბანკო რეფერენსით გადახდა უკვე აღრიცხულია." });
    render(<RecordPayment lookup={lookup} record={record} />);
    await userEvent.type(screen.getByLabelText(/წევრის ძებნა/), "GR-ABC234");
    await userEvent.click(screen.getByRole("button", { name: "ძებნა" }));
    await waitFor(() => expect(screen.getByText(/ნინო ბერიძე/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /ნინო ბერიძე/ }));
    await userEvent.type(screen.getByLabelText(/თანხა/), "20");
    await userEvent.click(screen.getByRole("button", { name: "აღრიცხვა" }));
    await waitFor(() =>
      expect(screen.getByText(/უკვე აღრიცხულია/)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/თანხა/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run app/\(admin\)/admin/finances/RecordPayment.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement types, actions, component, page**

Write `types.ts` (the Interfaces block above, verbatim).

`app/(admin)/admin/finances/actions.ts`:

```ts
"use server";

import { hasAnyRole } from "@/lib/admin";
import { memberLookupSchema, recordPaymentSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, isReferenceCode, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import type { LookupResult, MemberCandidate, RecordResult } from "./types";
import type { MemberStatusRow } from "@/lib/supabase/types";

export async function lookupMemberAction(query: unknown): Promise<LookupResult> {
  const parsed = memberLookupSchema.safeParse({ query });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["finance", "super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const supabase = await createServerSupabase();
  const q = parsed.data.query;
  let builder = supabase
    .from("admin_members")
    .select("id, first_name, last_name, region_name_ka, membership_tier, status, reference_code")
    // only completed members can be paid for — they are exactly those with a code
    .not("reference_code", "is", null)
    .limit(8);
  if (isReferenceCode(q.toUpperCase())) {
    builder = builder.eq("reference_code", q.toUpperCase());
  } else {
    const s = q.replaceAll(/[,%()]/g, " ").trim();
    builder = builder.or(
      `first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%`,
    );
  }
  const { data, error } = await builder;
  if (error) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const candidates: MemberCandidate[] = (data ?? []).map((m) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`,
    regionNameKa: m.region_name_ka,
    tier: m.membership_tier,
    status: m.status,
    referenceCode: m.reference_code as string,
  }));
  return { ok: true, candidates };
}

export async function recordPaymentAction(input: unknown): Promise<RecordResult> {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_record_payment", {
    p_member_id: parsed.data.memberId,
    p_amount_gel: parsed.data.amountGel,
    p_paid_at: parsed.data.paidAt,
    p_bank_reference: parsed.data.bankReference === "" ? null : parsed.data.bankReference,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  const result = data as { months: number; newStatus: MemberStatusRow };
  return { ok: true, months: result.months, newStatus: result.newStatus };
}
```

`app/(admin)/admin/finances/RecordPayment.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { MEMBER_STATUS_LABELS_KA } from "@/lib/admin";
import { todayTbilisiIso } from "@/lib/admin-schemas";
import { monthsFor } from "@/lib/active";
import type { LookupResult, MemberCandidate, RecordResult } from "./types";

export function RecordPayment({
  lookup,
  record,
}: {
  lookup: (query: string) => Promise<LookupResult>;
  record: (input: {
    memberId: string;
    amountGel: number;
    paidAt: string;
    bankReference: string;
  }) => Promise<RecordResult>;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<MemberCandidate[] | null>(null);
  const [member, setMember] = useState<MemberCandidate | null>(null);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayTbilisiIso());
  const [bankReference, setBankReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const amountNum = Number(amount);
  const previewMonths = member?.tier ? monthsFor(amountNum, member.tier) : 0;

  async function onLookup() {
    setBusy(true);
    setNotice(null);
    setMember(null);
    const result = await lookup(query);
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      setCandidates(null);
      return;
    }
    setCandidates(result.candidates);
  }

  async function onRecord() {
    if (!member) return;
    setBusy(true);
    setNotice(null);
    const result = await record({
      memberId: member.id,
      amountGel: amountNum,
      paidAt,
      bankReference: bankReference.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setNotice({
      kind: "ok",
      text: `აღირიცხა — ${result.months} თვე${
        result.newStatus === "active_member" ? " · წევრი ახლა აქტიურია ✓" : ""
      }`,
    });
    setMember(null);
    setCandidates(null);
    setQuery("");
    setAmount("");
    setBankReference("");
    setPaidAt(todayTbilisiIso());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
          წევრის ძებნა (GR-კოდი, სახელი ან ტელეფონი)
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="GR-XXXXXX…"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"
          />
        </label>
        <Button variant="dark" onClick={onLookup} disabled={busy || query.trim().length < 2}>
          ძებნა
        </Button>
      </div>

      {candidates !== null && !member ? (
        candidates.length === 0 ? (
          <p className="text-sm text-muted-fg">წევრი ვერ მოიძებნა.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setMember(c)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-brand"
              >
                <span className="font-semibold text-ink">
                  {c.name}
                  <span className="ms-2 font-mono text-xs text-muted-fg">{c.referenceCode}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-fg">
                  {c.regionNameKa ?? "—"} · {c.tier === null ? "—" : `${c.tier} ₾`}
                  <Pill status={c.status} label={MEMBER_STATUS_LABELS_KA[c.status]} />
                </span>
              </button>
            ))}
          </div>
        )
      ) : null}

      {member ? (
        <div className="rounded-xl border border-line bg-surface/50 p-4">
          <p className="text-sm font-semibold text-ink">
            {member.name} <span className="font-mono text-xs">{member.referenceCode}</span> ·
            საწევრო: {member.tier === null ? "—" : `${member.tier} ₾`}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex w-32 flex-col gap-1 text-sm font-semibold text-ink">
              თანხა (₾)
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="10000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="flex w-44 flex-col gap-1 text-sm font-semibold text-ink">
              თარიღი
              <input
                type="date"
                value={paidAt}
                max={todayTbilisiIso()}
                onChange={(e) => setPaidAt(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
              საბანკო რეფერენსი (არასავალდებულო)
              <input
                type="text"
                value={bankReference}
                maxLength={64}
                onChange={(e) => setBankReference(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <p className="pb-2 text-sm font-bold text-ink">
              {previewMonths > 0 ? `→ ${previewMonths} თვე` : "→ —"}
            </p>
            <Button
              variant="primary"
              onClick={onRecord}
              disabled={busy || previewMonths === 0}
            >
              აღრიცხვა
            </Button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p className={`text-sm font-semibold ${notice.kind === "ok" ? "text-ok" : "text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
```

`app/(admin)/admin/finances/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { hasAnyRole } from "@/lib/admin";
import { getAdminRoles } from "@/lib/supabase/server";
import { lookupMemberAction, recordPaymentAction } from "./actions";
import { RecordPayment } from "./RecordPayment";

export const metadata: Metadata = { title: "ფინანსები — ადმინისტრირება" };

export default async function AdminFinancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["finance", "super_admin"])) redirect("/admin");
  await searchParams; // txPage arrives in Task 19

  return (
    <main>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">ფინანსები</h1>
        <p className="mt-2 text-sm text-muted-fg">
          გადახდების აღრიცხვა, ბალკ შესატყვისება და შემოსავლის სტატისტიკა.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Card header={<h3 className="text-base font-bold text-ink">ერთეული აღრიცხვა</h3>}>
          <RecordPayment lookup={lookupMemberAction} record={recordPaymentAction} />
        </Card>

        {/* BULK-MATCH (Task 18) */}

        {/* FINANCE-STATS (Task 19) */}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/finances
git commit -m "feat(admin): single-entry payment recording with live month preview"
```

---

### Task 18: ფინანსები — bulk paste matching

**Files:**
- Create: `app/(admin)/admin/finances/BulkMatch.tsx`
- Create: `app/(admin)/admin/finances/BulkMatch.test.tsx`
- Modify: `app/(admin)/admin/finances/actions.ts` (add preview + confirm)
- Modify: `app/(admin)/admin/finances/page.tsx` (replace the `{/* BULK-MATCH (Task 18) */}` marker)

**Interfaces:**
- Consumes: `parseStatementRows` (Task 2); `admin_record_payments_bulk` RPC (Task 6); `bulkPreviewSchema`, `bulkConfirmSchema`, `todayTbilisiIso` (Task 5); `monthsFor` (Task 1); Task 17's `types.ts` Bulk* types.
- Produces: the classify-then-confirm bulk flow (spec §3.5): only ✓ rows are sent; all-or-nothing recording; failed batches re-mark the offending row.

- [ ] **Step 1: Write the failing component test — `BulkMatch.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BulkMatch } from "./BulkMatch";
import type { BulkPreviewRow } from "./types";

const rows: BulkPreviewRow[] = [
  { index: 0, line: "GR-ABC234 20.00", code: "GR-ABC234", amountGel: 20, paidAt: "2026-07-01", status: "ok", memberName: "ნინო ბერიძე", months: 1 },
  { index: 1, line: "GR-ZZZZZ9 20.00", code: "GR-ZZZZZ9", amountGel: 20, paidAt: "2026-07-01", status: "unknown_code", memberName: null, months: null },
  { index: 2, line: "უცნობი 20.00", code: null, amountGel: 20, paidAt: "2026-07-01", status: "no_code", memberName: null, months: null },
  { index: 3, line: "GR-ABC234 20.00 დუბლი", code: "GR-ABC234", amountGel: 20, paidAt: "2026-07-01", status: "duplicate", memberName: "ნინო ბერიძე", months: null },
];

describe("BulkMatch (spec §3.5 — classify, then confirm only ✓)", () => {
  it("previews rows with status pills and a summary; confirms only the ✓ rows", async () => {
    const preview = vi.fn().mockResolvedValue({ ok: true, rows });
    const confirm = vi.fn().mockResolvedValue({ ok: true, count: 1, totalGel: 20 });
    render(<BulkMatch preview={preview} confirm={confirm} />);

    await userEvent.type(screen.getByLabelText(/ამონაწერის სტრიქონები/), "რამე ტექსტი");
    await userEvent.click(screen.getByRole("button", { name: "გადამოწმება" }));
    await waitFor(() => expect(screen.getByText("ნაპოვნია")).toBeInTheDocument());
    expect(screen.getByText("უცნობი კოდი")).toBeInTheDocument();
    expect(screen.getByText("კოდი ვერ მოიძებნა")).toBeInTheDocument();
    expect(screen.getByText("დუბლიკატი")).toBeInTheDocument();
    expect(screen.getByText(/ჩაიწერება: 1/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /დადასტურება/ }));
    await waitFor(() => expect(screen.getByText(/აღირიცხა 1 გადახდა/)).toBeInTheDocument());
    expect(confirm).toHaveBeenCalledWith([
      { referenceCode: "GR-ABC234", amountGel: 20, paidAt: "2026-07-01" },
    ]);
  });

  it("zero ✓ rows disables the confirm button", async () => {
    const preview = vi.fn().mockResolvedValue({ ok: true, rows: [rows[1]!] });
    render(<BulkMatch preview={preview} confirm={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/ამონაწერის სტრიქონები/), "x");
    await userEvent.click(screen.getByRole("button", { name: "გადამოწმება" }));
    await waitFor(() => expect(screen.getByText("უცნობი კოდი")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /დადასტურება/ })).toBeDisabled();
  });

  it("a failed batch surfaces the error against the preview", async () => {
    const preview = vi.fn().mockResolvedValue({ ok: true, rows: [rows[0]!] });
    const confirm = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "უცნობი კოდი", rowIndex: 0 });
    render(<BulkMatch preview={preview} confirm={confirm} />);
    await userEvent.type(screen.getByLabelText(/ამონაწერის სტრიქონები/), "x");
    await userEvent.click(screen.getByRole("button", { name: "გადამოწმება" }));
    await waitFor(() => expect(screen.getByText("ნაპოვნია")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /დადასტურება/ }));
    await waitFor(() =>
      expect(screen.getByText(/ვერ ჩაიწერა — შეცდომა მე-1 რიგში/)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run app/\(admin\)/admin/finances/BulkMatch.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the actions + component**

Append to `app/(admin)/admin/finances/actions.ts`:

```ts
import { parseStatementRows } from "@/lib/bank-parse";
import { bulkConfirmSchema, bulkPreviewSchema, todayTbilisiIso } from "@/lib/admin-schemas";
import type { BulkConfirmResult, BulkPreviewResult, BulkPreviewRow } from "./types";
// (merge these into the existing import block at the top of the file)

export async function previewBulkAction(text: unknown): Promise<BulkPreviewResult> {
  const parsed = bulkPreviewSchema.safeParse({ text });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["finance", "super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const supabase = await createServerSupabase();
  const parsedRows = parseStatementRows(parsed.data.text);

  const codes = [...new Set(parsedRows.flatMap((r) => (r.code ? [r.code] : [])))];
  const { data: matches, error: matchError } =
    codes.length > 0
      ? await supabase
          .from("admin_members")
          .select("id, first_name, last_name, membership_tier, reference_code")
          .in("reference_code", codes)
      : { data: [], error: null };
  if (matchError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const byCode = new Map((matches ?? []).map((m) => [m.reference_code as string, m]));

  // duplicate check: an identical LIVE payment (member+amount+date) already recorded
  const memberIds = [...new Set((matches ?? []).map((m) => m.id))];
  const { data: existing, error: existingError } =
    memberIds.length > 0
      ? await supabase
          .from("admin_payments")
          .select("member_id, amount_gel, paid_at")
          .in("member_id", memberIds)
          .is("voided_at", null)
      : { data: [], error: null };
  if (existingError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const existingKeys = new Set(
    (existing ?? []).map((p) => `${p.member_id}|${p.amount_gel}|${p.paid_at}`),
  );

  const today = todayTbilisiIso();
  const rows: BulkPreviewRow[] = parsedRows.map((r) => {
    const paidAt = r.paidAt ?? today; // the date that WILL be recorded is shown
    const base: BulkPreviewRow = {
      index: r.index,
      line: r.line,
      code: r.code,
      amountGel: r.amountGel,
      paidAt,
      status: "ok",
      memberName: null,
      months: null,
    };
    if (r.duplicateOfIndex !== null) return { ...base, status: "duplicate_line" };
    if (r.problems.includes("no_code")) return { ...base, status: "no_code" };
    if (r.problems.includes("ambiguous_amount")) return { ...base, status: "ambiguous_amount" };
    if (r.problems.includes("no_amount")) return { ...base, status: "no_amount" };
    const member = byCode.get(r.code as string);
    if (!member) return { ...base, status: "unknown_code" };
    const name = `${member.first_name} ${member.last_name}`;
    if (existingKeys.has(`${member.id}|${r.amountGel}|${paidAt}`)) {
      return { ...base, status: "duplicate", memberName: name };
    }
    return {
      ...base,
      memberName: name,
      months: member.membership_tier ? monthsFor(r.amountGel as number, member.membership_tier) : null,
    };
  });
  return { ok: true, rows };
}

export async function confirmBulkAction(rows: unknown): Promise<BulkConfirmResult> {
  const parsed = bulkConfirmSchema.safeParse({ rows });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR,
      rowIndex: null,
    };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_record_payments_bulk", {
    p_rows: parsed.data.rows as unknown as Json,
  });
  if (error) {
    // 'bulk_row:<index>:<reason>' — surface the offending row (spec §4.5)
    const match = /bulk_row:(\d+):(\w+)/.exec(error.message);
    if (match) {
      return { ok: false, error: mapFunnelError(match[2]), rowIndex: Number(match[1]) };
    }
    return { ok: false, error: mapFunnelError(error.message), rowIndex: null };
  }
  const result = data as { count: number; totalGel: number };
  return { ok: true, count: result.count, totalGel: result.totalGel };
}
```

Also add `monthsFor` (from `@/lib/active`) and `Json` (from `@/lib/supabase/types`) to the import block, and map `unknown_code` in `lib/funnel.ts` ERROR_MESSAGES if the reason tokens should read well:
append to the Phase 4 token block in `lib/funnel.ts` (and a matching test line in `lib/funnel.test.ts`):

```ts
  unknown_code: "უცნობი კოდი",
```

`app/(admin)/admin/finances/BulkMatch.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { formatAmountGel } from "@/lib/cabinet";
import type { BulkConfirmResult, BulkPreviewResult, BulkPreviewRow, BulkStatus } from "./types";

const STATUS_LABELS: Record<BulkStatus, string> = {
  ok: "ნაპოვნია",
  no_code: "კოდი ვერ მოიძებნა",
  no_amount: "თანხა ვერ დადგინდა",
  ambiguous_amount: "გაურკვეველი თანხა",
  unknown_code: "უცნობი კოდი",
  duplicate: "დუბლიკატი",
  duplicate_line: "განმეორებული ხაზი",
};

export function BulkMatch({
  preview,
  confirm,
}: {
  preview: (text: string) => Promise<BulkPreviewResult>;
  confirm: (
    rows: { referenceCode: string; amountGel: number; paidAt: string }[],
  ) => Promise<BulkConfirmResult>;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<BulkPreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const okRows = (rows ?? []).filter((r) => r.status === "ok");

  async function onPreview() {
    setBusy(true);
    setNotice(null);
    const result = await preview(text);
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      setRows(null);
      return;
    }
    setRows(result.rows);
  }

  async function onConfirm() {
    setBusy(true);
    setNotice(null);
    const result = await confirm(
      okRows.map((r) => ({
        referenceCode: r.code as string,
        amountGel: r.amountGel as number,
        paidAt: r.paidAt as string,
      })),
    );
    setBusy(false);
    if (!result.ok) {
      setNotice({
        kind: "error",
        text:
          result.rowIndex === null
            ? `ვერ ჩაიწერა — ${result.error}`
            : `ვერ ჩაიწერა — შეცდომა მე-${result.rowIndex + 1} რიგში: ${result.error}. არცერთი რიგი არ ჩაწერილა.`,
      });
      return;
    }
    setNotice({
      kind: "ok",
      text: `აღირიცხა ${result.count} გადახდა (${formatAmountGel(result.totalGel)} ₾). დანარჩენი რიგები აღრიცხე ერთეულად.`,
    });
    setRows(null);
    setText("");
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        ამონაწერის სტრიქონები (ჩასვი ბანკიდან ან Excel-იდან)
        <textarea
          value={text}
          rows={6}
          onChange={(e) => setText(e.target.value)}
          placeholder={"01.07.2026\tGR-ABC234 საწევრო\t20.00"}
          className="rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs font-normal"
        />
      </label>
      <div>
        <Button variant="dark" onClick={onPreview} disabled={busy || text.trim().length === 0}>
          გადამოწმება
        </Button>
      </div>

      {rows !== null ? (
        <>
          <DataTable
            bodyTestId="bulk-preview-body"
            head={
              <>
                <th className={tableThClass}>სტრიქონი</th>
                <th className={tableThClass}>კოდი</th>
                <th className={tableThClass}>თანხა</th>
                <th className={tableThClass}>თარიღი</th>
                <th className={tableThClass}>წევრი</th>
                <th className={tableThClass}>შედეგი</th>
              </>
            }
          >
            {rows.map((r) => (
              <tr key={r.index} className={tableRowClass}>
                <td className={`${tableCellClass} max-w-[260px] truncate font-mono text-xs`}>
                  {r.line}
                </td>
                <td className={`${tableCellClass} font-mono text-xs`}>{r.code ?? "—"}</td>
                <td className={tableCellClass}>
                  {r.amountGel === null ? "—" : formatAmountGel(r.amountGel)}
                </td>
                <td className={tableCellClass}>{r.paidAt ?? "—"}</td>
                <td className={tableCellClass}>
                  {r.memberName ?? "—"}
                  {r.months !== null ? (
                    <span className="ms-1 text-xs text-muted-fg">→ {r.months} თვე</span>
                  ) : null}
                </td>
                <td className={tableCellClass}>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === "ok"
                        ? "bg-ok/10 text-ok"
                        : r.status === "duplicate" || r.status === "duplicate_line"
                          ? "bg-warn/10 text-warn"
                          : "bg-danger/10 text-danger"
                    }`}
                  >
                    {STATUS_LABELS[r.status]}
                  </span>
                </td>
              </tr>
            ))}
          </DataTable>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-fg">
              ჩაიწერება: {okRows.length} · გამოტოვებული: {(rows.length - okRows.length)}
            </p>
            <Button variant="primary" onClick={onConfirm} disabled={busy || okRows.length === 0}>
              დადასტურება ({okRows.length})
            </Button>
          </div>
        </>
      ) : null}

      {notice ? (
        <p className={`text-sm font-semibold ${notice.kind === "ok" ? "text-ok" : "text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
```

In `page.tsx`, replace `{/* BULK-MATCH (Task 18) */}` with:

```tsx
        <Card header={<h3 className="text-base font-bold text-ink">ბალკ შესატყვისება</h3>}>
          <BulkMatch preview={previewBulkAction} confirm={confirmBulkAction} />
        </Card>
```

adding the imports `import { BulkMatch } from "./BulkMatch";` and extending the actions import with `previewBulkAction, confirmBulkAction`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/finances lib/funnel.ts lib/funnel.test.ts
git commit -m "feat(admin): bulk paste matching — classify preview, all-or-nothing confirm"
```

---

### Task 19: ფინანსები — statistics, transactions, void

**Files:**
- Create: `app/(admin)/admin/finances/VoidPaymentButton.tsx`
- Create: `app/(admin)/admin/finances/VoidPaymentButton.test.tsx`
- Modify: `app/(admin)/admin/finances/actions.ts` (add `voidPaymentAction`)
- Modify: `app/(admin)/admin/finances/page.tsx` (replace the `{/* FINANCE-STATS (Task 19) */}` marker)

**Interfaces:**
- Consumes: `admin_finance_stats`, `admin_payments` views, `admin_void_payment` RPC (Task 6); `voidPaymentSchema` (Task 5); `barPct` (Task 4); `paymentMethodLabel`, `formatAmountGel`, `formatDateKa` (lib/cabinet).
- Produces: the transactions surface Task 26's e2e drives; `VoidResult = { ok: true } | { ok: false; error: string }`.

- [ ] **Step 1: Write the failing component test — `VoidPaymentButton.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VoidPaymentButton } from "./VoidPaymentButton";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("VoidPaymentButton (spec §3.5 — void with required reason)", () => {
  it("reveals the reason field, requires ≥3 chars, then voids", async () => {
    const voidPayment = vi.fn().mockResolvedValue({ ok: true });
    render(<VoidPaymentButton paymentId={7} voidPayment={voidPayment} />);
    await userEvent.click(screen.getByRole("button", { name: "გაუქმება" }));
    const confirmButton = screen.getByRole("button", { name: "გაუქმების დადასტურება" });
    expect(confirmButton).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/მიზეზი/), "შეცდომით ჩაიწერა");
    expect(confirmButton).toBeEnabled();
    await userEvent.click(confirmButton);
    await waitFor(() => expect(voidPayment).toHaveBeenCalledWith(7, "შეცდომით ჩაიწერა"));
  });
  it("shows the action's Georgian error", async () => {
    const voidPayment = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "ეს გადახდა უკვე გაუქმებულია." });
    render(<VoidPaymentButton paymentId={7} voidPayment={voidPayment} />);
    await userEvent.click(screen.getByRole("button", { name: "გაუქმება" }));
    await userEvent.type(screen.getByLabelText(/მიზეზი/), "შეცდომით");
    await userEvent.click(screen.getByRole("button", { name: "გაუქმების დადასტურება" }));
    await waitFor(() =>
      expect(screen.getByText("ეს გადახდა უკვე გაუქმებულია.")).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run app/\(admin\)/admin/finances/VoidPaymentButton.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

Append to `app/(admin)/admin/finances/actions.ts` (and export the type from `types.ts`: `export type VoidResult = { ok: true } | { ok: false; error: string };`):

```ts
export async function voidPaymentAction(paymentId: unknown, reason: unknown): Promise<VoidResult> {
  const parsed = voidPaymentSchema.safeParse({ paymentId, reason });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_void_payment", {
    p_payment_id: parsed.data.paymentId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true };
}
```

(add `voidPaymentSchema` and `VoidResult` to the import blocks.)

`app/(admin)/admin/finances/VoidPaymentButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import type { VoidResult } from "./types";

export function VoidPaymentButton({
  paymentId,
  voidPayment,
}: {
  paymentId: number;
  voidPayment: (paymentId: number, reason: string) => Promise<VoidResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    const result = await voidPayment(paymentId, reason.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh(); // the row re-renders server-side as გაუქმებული
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        გაუქმება
      </Button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-xs font-semibold text-ink">
        მიზეზი
        <input
          type="text"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-normal"
        />
      </label>
      <Button
        variant="danger"
        size="sm"
        onClick={onConfirm}
        disabled={busy || reason.trim().length < 3}
      >
        გაუქმების დადასტურება
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
        არა
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
```

In `page.tsx`, replace `{/* FINANCE-STATS (Task 19) */}` with the stats + transactions sections and extend the page's data loading (before the `return`):

```tsx
  const supabase = await createServerSupabase();
  const raw = await searchParams;
  const txPage = Math.max(1, Number(typeof raw.txPage === "string" ? raw.txPage : "1") || 1);
  const TX_PAGE_SIZE = 20;

  const { data: stats, error: statsError } = await supabase
    .from("admin_finance_stats")
    .select("*")
    .single();
  if (statsError) throw new Error(`admin_finance_stats failed: ${statsError.message}`);
  const avgGel = stats.active_count > 0 ? stats.mrr_gel / stats.active_count : 0;
  const tierRows = [
    { tier: 5, count: stats.tier5_count },
    { tier: 10, count: stats.tier10_count },
    { tier: 20, count: stats.tier20_count },
  ];
  const maxTier = Math.max(1, ...tierRows.map((t) => t.count));

  const txFrom = (txPage - 1) * TX_PAGE_SIZE;
  const { data: transactions, count: txCount, error: txError } = await supabase
    .from("admin_payments")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(txFrom, txFrom + TX_PAGE_SIZE - 1);
  if (txError) throw new Error(`admin_payments failed: ${txError.message}`);
```

and render (JSX in place of the marker):

```tsx
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard n={`${stats.mrr_gel.toLocaleString("ka-GE")} ₾`} label="თვიური შემოსავალი (MRR)" trend="აქტიური საწევროების ჯამი" accent />
          <StatCard n={stats.active_count} label="აქტიური გამომწერი" trend="გადამხდელი წევრები" />
          <StatCard n={`${avgGel.toFixed(2)} ₾`} label="საშ. შენატანი" trend="ერთ წევრზე თვეში" />
        </div>

        <Card header={<h3 className="text-base font-bold text-ink">განმეორებადი შენატანები დონეების მიხედვით</h3>}>
          <div className="flex flex-col gap-3">
            {tierRows.map((t) => (
              <div key={t.tier}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-ink">
                    {t.tier} ₾ <span className="font-semibold text-muted-fg">/ თვეში</span>
                  </span>
                  <span className="text-sm font-extrabold text-ink">
                    {t.count.toLocaleString("ka-GE")} გამომწერი
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-md bg-surface">
                  <div
                    className="h-full rounded-md bg-brand"
                    style={{ width: `${barPct(t.count, maxTier)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          header={
            <>
              <h3 className="text-base font-bold text-ink">ტრანზაქციები</h3>
              <span className="text-xs font-semibold text-muted-fg">
                ნაჩვენებია {transactions.length} / {(txCount ?? 0).toLocaleString("ka-GE")}
              </span>
            </>
          }
          padded={false}
        >
          {transactions.length === 0 ? (
            <p className="p-6 text-sm text-muted-fg">გადახდები ჯერ არ არის აღრიცხული.</p>
          ) : (
            <DataTable
              bodyTestId="admin-tx-body"
              head={
                <>
                  <th className={tableThClass}>თარიღი</th>
                  <th className={tableThClass}>წევრი</th>
                  <th className={tableThClass}>თანხა ₾</th>
                  <th className={tableThClass}>თვეები</th>
                  <th className={tableThClass}>მეთოდი</th>
                  <th className={tableThClass}>ვინ აღრიცხა</th>
                  <th className={tableThClass}>სტატუსი</th>
                  <th className={tableThClass}></th>
                </>
              }
            >
              {transactions.map((t) => (
                <tr key={t.id} className={tableRowClass}>
                  <td className={`${tableCellClass} text-muted-fg`}>{formatDateKa(t.paid_at)}</td>
                  <td className={`${tableCellClass} font-semibold`}>
                    {t.first_name} {t.last_name}
                  </td>
                  <td className={`${tableCellClass} ${t.voided_at ? "line-through opacity-60" : ""}`}>
                    {formatAmountGel(t.amount_gel)}
                  </td>
                  <td className={tableCellClass}>{t.months_covered}</td>
                  <td className={`${tableCellClass} text-muted-fg`}>
                    {paymentMethodLabel(t.source)}
                  </td>
                  <td className={`${tableCellClass} text-muted-fg`}>
                    {t.recorded_by_first_name
                      ? `${t.recorded_by_first_name} ${t.recorded_by_last_name}`
                      : "სისტემა"}
                  </td>
                  <td className={tableCellClass} title={t.void_reason ?? undefined}>
                    {t.voided_at ? (
                      <Pill status="rejected" label="გაუქმებული" />
                    ) : (
                      <Pill status="active_member" label="აქტიური" />
                    )}
                  </td>
                  <td className={tableCellClass}>
                    {t.voided_at ? null : (
                      <VoidPaymentButton paymentId={t.id} voidPayment={voidPaymentAction} />
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <div className="flex items-center justify-between">
          {txPage > 1 ? (
            <ButtonLink href={`/admin/finances?txPage=${txPage - 1}`} variant="ghost" size="sm">
              ← წინა
            </ButtonLink>
          ) : (
            <span />
          )}
          {txFrom + TX_PAGE_SIZE < (txCount ?? 0) ? (
            <ButtonLink href={`/admin/finances?txPage=${txPage + 1}`} variant="ghost" size="sm">
              შემდეგი →
            </ButtonLink>
          ) : (
            <span />
          )}
        </div>
```

Extend the page's imports accordingly (`StatCard`, `ButtonLink`, `DataTable` + cell classes, `Pill`, `barPct`, `formatAmountGel`, `formatDateKa`, `paymentMethodLabel`, `createServerSupabase`, `VoidPaymentButton`, `voidPaymentAction`). Verify `StatCard`'s real prop names as in Task 12.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/finances
git commit -m "feat(admin): finance stats, transactions table, void with reason"
```

### Task 20: ტრანსფერი — orphan reassignment

**Files:**
- Create: `app/(admin)/admin/transfer/page.tsx`
- Create: `app/(admin)/admin/transfer/ReassignRow.tsx`
- Create: `app/(admin)/admin/transfer/ReassignRow.test.tsx`
- Create: `app/(admin)/admin/transfer/actions.ts`

**Interfaces:**
- Consumes: `admin_members` + `public_delegates` views, `admin_reassign_member` RPC (Task 6); `reassignSchema` (Task 5).
- Produces: `ReassignResult = { ok: true } | { ok: false; error: string }`.

- [ ] **Step 1: Write the failing component test — `ReassignRow.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReassignRow } from "./ReassignRow";

const options = [
  { id: "d-1", name: "გიორგი მაისურაძე" },
  { id: "d-2", name: "ნინო ლომიძე" },
];

describe("ReassignRow (spec §3.6)", () => {
  it("reassigns to the selected same-region delegate", async () => {
    const reassign = vi.fn().mockResolvedValue({ ok: true });
    render(<ReassignRow memberId="m-1" options={options} reassign={reassign} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "d-2");
    await userEvent.click(screen.getByRole("button", { name: "გადანაწილება" }));
    await waitFor(() => expect(screen.getByText(/გადანაწილდა/)).toBeInTheDocument());
    expect(reassign).toHaveBeenCalledWith("m-1", "d-2");
  });
  it("no approved delegate in the region → prototype note + disabled action", () => {
    render(<ReassignRow memberId="m-1" options={[]} reassign={vi.fn()} />);
    expect(
      screen.getByText("ამ მხარეს დამტკიცებული დელეგატი არ ჰყავს"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "გადანაწილება" })).toBeDisabled();
  });
  it("surfaces errors and keeps the row usable", async () => {
    const reassign = vi.fn().mockResolvedValue({ ok: false, error: "შეცდომა" });
    render(<ReassignRow memberId="m-1" options={options} reassign={reassign} />);
    await userEvent.click(screen.getByRole("button", { name: "გადანაწილება" }));
    await waitFor(() => expect(screen.getByText("შეცდომა")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "გადანაწილება" })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run app/\(admin\)/admin/transfer/ReassignRow.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

`app/(admin)/admin/transfer/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { reassignSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type ReassignResult = { ok: true } | { ok: false; error: string };

/** ADR-013 semantics in-DB: close the central row, open the new one, audited. */
export async function reassignMemberAction(
  memberId: unknown,
  delegateId: unknown,
): Promise<ReassignResult> {
  const parsed = reassignSchema.safeParse({ memberId, delegateId });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_reassign_member", {
    p_member_id: parsed.data.memberId,
    p_delegate_id: parsed.data.delegateId,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/transfer");
  return { ok: true };
}
```

`app/(admin)/admin/transfer/ReassignRow.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import type { ReassignResult } from "./actions";

export function ReassignRow({
  memberId,
  options,
  reassign,
}: {
  memberId: string;
  options: { id: string; name: string }[];
  reassign: (memberId: string, delegateId: string) => Promise<ReassignResult>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onReassign() {
    setBusy(true);
    setError(null);
    const result = await reassign(memberId, selected);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) return <span className="text-sm font-semibold text-ok">გადანაწილდა ✓</span>;
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      {options.length === 0 ? (
        <span className="text-sm text-muted-fg">ამ მხარეს დამტკიცებული დელეგატი არ ჰყავს</span>
      ) : (
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-w-[200px] rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
      <Button
        variant="primary"
        size="sm"
        onClick={onReassign}
        disabled={busy || options.length === 0}
      >
        გადანაწილება
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
```

`app/(admin)/admin/transfer/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { hasAnyRole } from "@/lib/admin";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { reassignMemberAction } from "./actions";
import { ReassignRow } from "./ReassignRow";

export const metadata: Metadata = { title: "ტრანსფერი — ადმინისტრირება" };

const PAGE_SIZE = 50;

export default async function AdminTransferPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["verifier", "super_admin"])) redirect("/admin");
  const raw = await searchParams;
  const page = Math.max(1, Number(typeof raw.page === "string" ? raw.page : "1") || 1);
  const supabase = await createServerSupabase();

  const from = (page - 1) * PAGE_SIZE;
  const { data: orphans, count, error } = await supabase
    .from("admin_members")
    .select("*", { count: "exact" })
    .is("delegate_id", null)
    .neq("status", "draft")
    .eq("is_delegate", false)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`admin_members failed: ${error.message}`);

  const { data: delegates, error: delegatesError } = await supabase
    .from("public_delegates")
    .select("id, first_name, last_name, region_id")
    .order("first_name");
  if (delegatesError) throw new Error(`public_delegates failed: ${delegatesError.message}`);
  const byRegion = new Map<number, { id: string; name: string }[]>();
  for (const d of delegates) {
    if (d.region_id === null) continue;
    const list = byRegion.get(d.region_id) ?? [];
    list.push({ id: d.id, name: `${d.first_name} ${d.last_name}` });
    byRegion.set(d.region_id, list);
  }

  const total = count ?? 0;

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">ადმინისტრაციული ტრანსფერი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          ცენტრალურ მოძრაობაზე მიბმული (ობოლი) წევრები გადაანაწილე შესაბამისი მხარის
          დამტკიცებულ დელეგატებზე.
        </p>
      </div>

      <Card>
        <p className="text-sm text-muted-fg">
          ℹ️ როცა წევრი რეგისტრირდება პირდაპირი დელეგატის გარეშე, ის ავტომატურად ებმის
          „ცენტრალურ მოძრაობას“. აქ შეგიძლია გადაანაწილო ის ადგილობრივ დელეგატზე —
          გადანაწილება ზრდის დელეგატის მხარდამჭერთა რაოდენობას.
        </p>
      </Card>

      <p className="mt-4 text-sm text-muted-fg">
        ობოლი წევრები: {total.toLocaleString("ka-GE")}
      </p>

      {total === 0 ? (
        <Card className="mt-2">
          <div className="p-4 text-center">
            <p className="text-2xl">✅</p>
            <h3 className="mt-2 text-base font-bold text-ink">ყველა წევრი გადანაწილებულია</h3>
            <p className="mt-1 text-sm text-muted-fg">
              ცენტრალურ მოძრაობაზე მიბმული ობოლი წევრები აღარ დარჩა.
            </p>
          </div>
        </Card>
      ) : (
        <Card padded={false} className="mt-2">
          <DataTable
            bodyTestId="admin-transfer-body"
            head={
              <>
                <th className={tableThClass}>წევრი</th>
                <th className={tableThClass}>რეგიონი</th>
                <th className={`${tableThClass} text-right`}>მიმღები დელეგატი / მოქმედება</th>
              </>
            }
          >
            {orphans.map((m) => (
              <tr key={m.id} className={tableRowClass}>
                <td className={`${tableCellClass} font-semibold`}>
                  {m.first_name} {m.last_name}
                </td>
                <td className={tableCellClass}>{m.region_name_ka ?? "—"}</td>
                <td className={`${tableCellClass} text-right`}>
                  <ReassignRow
                    memberId={m.id}
                    options={m.region_id === null ? [] : (byRegion.get(m.region_id) ?? [])}
                    reassign={reassignMemberAction}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      <div className="mt-4 flex items-center justify-between">
        {page > 1 ? (
          <ButtonLink href={`/admin/transfer?page=${page - 1}`} variant="ghost" size="sm">
            ← წინა
          </ButtonLink>
        ) : (
          <span />
        )}
        {from + PAGE_SIZE < total ? (
          <ButtonLink href={`/admin/transfer?page=${page + 1}`} variant="ghost" size="sm">
            შემდეგი →
          </ButtonLink>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
```

(As in Task 13: if `Card` has no `className` prop, wrap in a `<div className="mt-2">`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build` — expected PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/transfer
git commit -m "feat(admin): orphan reassignment — same-region picker, history-keeping RPC"
```

---

### Task 21: ადმინები — role management (super_admin only)

**Files:**
- Create: `app/(admin)/admin/admins/page.tsx`
- Create: `app/(admin)/admin/admins/GrantRoleForm.tsx`
- Create: `app/(admin)/admin/admins/GrantRoleForm.test.tsx`
- Create: `app/(admin)/admin/admins/RevokeRoleButton.tsx`
- Create: `app/(admin)/admin/admins/RevokeRoleButton.test.tsx`
- Create: `app/(admin)/admin/admins/actions.ts`

**Interfaces:**
- Consumes: `admin_admins` + `admin_members` views, `admin_grant_role` / `admin_revoke_role` RPCs (Task 6); `grantRoleSchema`, `revokeRoleSchema` (Task 5); `ROLE_LABELS_KA`, `ROLE_DUTIES_KA`, `ADMIN_ROLE_VALUES` (Task 4).
- Produces: `AdminRoleActionResult = { ok: true } | { ok: false; error: string }`; `AdminCandidateResult = { ok: true; candidate: { id: string; name: string; phone: string | null } | null } | { ok: false; error: string }`.

- [ ] **Step 1: Write the failing component tests**

`GrantRoleForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GrantRoleForm } from "./GrantRoleForm";

describe("GrantRoleForm (spec §3.7)", () => {
  it("finds a member by phone, grants the chosen role", async () => {
    const find = vi
      .fn()
      .mockResolvedValue({ ok: true, candidate: { id: "u-1", name: "ნინო ბერიძე", phone: "+995509000009" } });
    const grant = vi.fn().mockResolvedValue({ ok: true });
    render(<GrantRoleForm find={find} grant={grant} />);
    await userEvent.type(screen.getByLabelText(/ტელეფონი/), "509000009");
    await userEvent.click(screen.getByRole("button", { name: "მოძებნა" }));
    await waitFor(() => expect(screen.getByText(/ნინო ბერიძე/)).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText(/როლი/), "finance");
    await userEvent.click(screen.getByRole("button", { name: "მინიჭება" }));
    await waitFor(() => expect(screen.getByText(/როლი მიენიჭა/)).toBeInTheDocument());
    expect(grant).toHaveBeenCalledWith("u-1", "finance");
  });
  it("member not found → honest notice", async () => {
    const find = vi.fn().mockResolvedValue({ ok: true, candidate: null });
    render(<GrantRoleForm find={find} grant={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/ტელეფონი/), "500000000");
    await userEvent.click(screen.getByRole("button", { name: "მოძებნა" }));
    await waitFor(() =>
      expect(screen.getByText(/წევრი ვერ მოიძებნა/)).toBeInTheDocument(),
    );
  });
});
```

`RevokeRoleButton.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RevokeRoleButton } from "./RevokeRoleButton";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("RevokeRoleButton (spec §3.7)", () => {
  it("asks for confirmation, then revokes", async () => {
    const revoke = vi.fn().mockResolvedValue({ ok: true });
    render(<RevokeRoleButton userId="u-1" role="finance" revoke={revoke} />);
    await userEvent.click(screen.getByRole("button", { name: "✕" }));
    await userEvent.click(screen.getByRole("button", { name: "მოხსნა" }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith("u-1", "finance"));
  });
  it("surfaces the last-super_admin lockout error", async () => {
    const revoke = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "ბოლო super_admin-ის მოხსნა შეუძლებელია." });
    render(<RevokeRoleButton userId="u-1" role="super_admin" revoke={revoke} />);
    await userEvent.click(screen.getByRole("button", { name: "✕" }));
    await userEvent.click(screen.getByRole("button", { name: "მოხსნა" }));
    await waitFor(() =>
      expect(screen.getByText("ბოლო super_admin-ის მოხსნა შეუძლებელია.")).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run app/\(admin\)/admin/admins`
Expected: FAIL — components missing.

- [ ] **Step 3: Implement**

`app/(admin)/admin/admins/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasAnyRole } from "@/lib/admin";
import { grantRoleSchema, revokeRoleSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export type AdminRoleActionResult = { ok: true } | { ok: false; error: string };
export type AdminCandidateResult =
  | { ok: true; candidate: { id: string; name: string; phone: string | null } | null }
  | { ok: false; error: string };

const phoneInput = z
  .string()
  .trim()
  .transform((v) => v.replaceAll(/[\s-]/g, ""))
  .refine((v) => /^(\+?995)?5\d{8}$/.test(v), "ტელეფონის ფორმატი არასწორია.");

function normalizePhone(v: string): string {
  const digits = v.replace(/^\+/, "");
  return digits.startsWith("995") ? `+${digits}` : `+995${digits}`;
}

export async function findAdminCandidateAction(phone: unknown): Promise<AdminCandidateResult> {
  const parsed = phoneInput.safeParse(phone);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const canonical = normalizePhone(parsed.data);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("admin_members")
    .select("id, first_name, last_name, phone, registration_completed_at, status")
    .in("phone", [canonical, canonical.slice(1)])
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  if (!data) return { ok: true, candidate: null };
  if (data.registration_completed_at === null && data.status !== "active_member") {
    return { ok: false, error: mapFunnelError("not_completed") };
  }
  return {
    ok: true,
    candidate: { id: data.id, name: `${data.first_name} ${data.last_name}`, phone: data.phone },
  };
}

export async function grantRoleAction(userId: unknown, role: unknown): Promise<AdminRoleActionResult> {
  const parsed = grantRoleSchema.safeParse({ userId, role });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_grant_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/admins");
  return { ok: true };
}

export async function revokeRoleAction(userId: unknown, role: unknown): Promise<AdminRoleActionResult> {
  const parsed = revokeRoleSchema.safeParse({ userId, role });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_revoke_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/admins");
  return { ok: true };
}
```

`GrantRoleForm.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { ADMIN_ROLE_VALUES, ROLE_DUTIES_KA, ROLE_LABELS_KA, type AdminRole } from "@/lib/admin";
import type { AdminCandidateResult, AdminRoleActionResult } from "./actions";

export function GrantRoleForm({
  find,
  grant,
}: {
  find: (phone: string) => Promise<AdminCandidateResult>;
  grant: (userId: string, role: AdminRole) => Promise<AdminRoleActionResult>;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [candidate, setCandidate] = useState<{ id: string; name: string } | null>(null);
  const [searched, setSearched] = useState(false);
  const [role, setRole] = useState<AdminRole>("verifier");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function onFind() {
    setBusy(true);
    setNotice(null);
    setCandidate(null);
    const result = await find(phone);
    setBusy(false);
    setSearched(true);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setCandidate(result.candidate);
  }

  async function onGrant() {
    if (!candidate) return;
    setBusy(true);
    setNotice(null);
    const result = await grant(candidate.id, role);
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setNotice({ kind: "ok", text: `როლი მიენიჭა ✓ — ${candidate.name}` });
    setCandidate(null);
    setPhone("");
    setSearched(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
          ტელეფონი (რეგისტრირებული წევრის)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="5XX XX XX XX"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"
          />
        </label>
        <Button variant="dark" onClick={onFind} disabled={busy || phone.trim().length < 9}>
          მოძებნა
        </Button>
      </div>

      {searched && !candidate && !notice ? (
        <p className="text-sm text-muted-fg">
          წევრი ვერ მოიძებნა — ადმინი ჯერ უნდა დარეგისტრირდეს პლატფორმაზე.
        </p>
      ) : null}

      {candidate ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface/50 p-4">
          <p className="text-sm font-bold text-ink">{candidate.name}</p>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            როლი
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal"
            >
              {ADMIN_ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS_KA[r]} — {ROLE_DUTIES_KA[r]}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" onClick={onGrant} disabled={busy}>
            მინიჭება
          </Button>
        </div>
      ) : null}

      {notice ? (
        <p className={`text-sm font-semibold ${notice.kind === "ok" ? "text-ok" : "text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
```

`RevokeRoleButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminRole } from "@/lib/admin";
import type { AdminRoleActionResult } from "./actions";

export function RevokeRoleButton({
  userId,
  role,
  revoke,
}: {
  userId: string;
  role: AdminRole;
  revoke: (userId: string, role: AdminRole) => Promise<AdminRoleActionResult>;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRevoke() {
    setBusy(true);
    setError(null);
    const result = await revoke(userId, role);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setConfirming(false);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-1">
      {confirming ? (
        <>
          <button
            type="button"
            onClick={onRevoke}
            disabled={busy}
            className="rounded px-1.5 text-xs font-bold text-danger hover:underline"
          >
            მოხსნა
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded px-1.5 text-xs text-muted-fg hover:underline"
          >
            არა
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="✕"
          title="როლის მოხსნა"
          className="rounded px-1 text-xs font-bold text-muted-fg hover:text-danger"
        >
          ✕
        </button>
      )}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
```

`app/(admin)/admin/admins/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { hasAnyRole, ROLE_LABELS_KA, type AdminRole } from "@/lib/admin";
import { formatDateKa, formatPhoneKa } from "@/lib/cabinet";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { findAdminCandidateAction, grantRoleAction, revokeRoleAction } from "./actions";
import { GrantRoleForm } from "./GrantRoleForm";
import { RevokeRoleButton } from "./RevokeRoleButton";

export const metadata: Metadata = { title: "ადმინები — ადმინისტრირება" };

export default async function AdminAdminsPage() {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) redirect("/admin");
  const supabase = await createServerSupabase();
  const { data: rows, error } = await supabase
    .from("admin_admins")
    .select("*")
    .order("granted_at", { ascending: true });
  if (error) throw new Error(`admin_admins failed: ${error.message}`);

  const byUser = new Map<
    string,
    { name: string; phone: string | null; roles: { role: AdminRole; grantedAt: string; grantedBy: string | null }[] }
  >();
  for (const r of rows) {
    const entry = byUser.get(r.user_id) ?? {
      name: `${r.first_name} ${r.last_name}`,
      phone: r.phone,
      roles: [],
    };
    entry.roles.push({
      role: r.role as AdminRole,
      grantedAt: r.granted_at,
      grantedBy: r.granted_by_first_name
        ? `${r.granted_by_first_name} ${r.granted_by_last_name}`
        : null,
    });
    byUser.set(r.user_id, entry);
  }

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">ადმინების მართვა</h1>
        <p className="mt-2 text-sm text-muted-fg">
          როლების მინიჭება და მოხსნა — ყველა ცვლილება აღირიცხება აუდიტის ჟურნალში.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Card header={<h3 className="text-base font-bold text-ink">როლის მინიჭება</h3>}>
          <GrantRoleForm find={findAdminCandidateAction} grant={grantRoleAction} />
        </Card>

        <Card header={<h3 className="text-base font-bold text-ink">მიმდინარე ადმინები</h3>} padded={false}>
          <DataTable
            bodyTestId="admin-admins-body"
            head={
              <>
                <th className={tableThClass}>ადმინი</th>
                <th className={tableThClass}>ტელეფონი</th>
                <th className={tableThClass}>როლები</th>
                <th className={tableThClass}>მინიჭების თარიღი</th>
              </>
            }
          >
            {[...byUser.entries()].map(([userId, admin]) => (
              <tr key={userId} className={tableRowClass}>
                <td className={`${tableCellClass} font-semibold`}>{admin.name}</td>
                <td className={tableCellClass}>{formatPhoneKa(admin.phone)}</td>
                <td className={tableCellClass}>
                  <span className="flex flex-wrap gap-2">
                    {admin.roles.map((r) => (
                      <span
                        key={r.role}
                        className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink"
                      >
                        {ROLE_LABELS_KA[r.role]}
                        <RevokeRoleButton userId={userId} role={r.role} revoke={revokeRoleAction} />
                      </span>
                    ))}
                  </span>
                </td>
                <td className={`${tableCellClass} text-muted-fg`}>
                  {formatDateKa(admin.roles[0]!.grantedAt)}
                  {admin.roles[0]!.grantedBy ? ` · ${admin.roles[0]!.grantedBy}` : ""}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build` — expected PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/admins
git commit -m "feat(admin): admin-user management — grant by phone, revoke with lockout guard"
```

---

### Task 22: აუდიტი — the log viewer (super_admin only)

**Files:**
- Create: `app/(admin)/admin/audit/page.tsx`
- Modify: `lib/admin.ts` + `lib/admin.test.ts` (add `formatDateTimeKa`)

**Interfaces:**
- Consumes: `admin_audit` + `admin_admins` views (Task 6); `AUDIT_ACTION_LABELS_KA`, `auditActionLabel`, `TARGET_TYPE_LABELS_KA` (Task 4).
- Produces: `formatDateTimeKa(iso: string): string` — `dd.mm.yyyy HH:MM` in Tbilisi time.

- [ ] **Step 1: Write the failing test — append to `lib/admin.test.ts`**

```ts
import { formatDateTimeKa } from "./admin"; // merge into the existing import

describe("formatDateTimeKa", () => {
  it("renders Tbilisi wall-clock time (UTC+4, no DST)", () => {
    expect(formatDateTimeKa("2026-07-17T20:30:00Z")).toBe("18.07.2026 00:30");
    expect(formatDateTimeKa("2026-07-17T08:05:00Z")).toBe("17.07.2026 12:05");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/admin.test.ts` — expected FAIL (`formatDateTimeKa` missing).

- [ ] **Step 3: Implement**

Append to `lib/admin.ts` (same fixed-offset trick as `lib/cabinet.ts` — no ICU):

```ts
const TBILISI_OFFSET_MS = 4 * 60 * 60 * 1000;

/** dd.mm.yyyy HH:MM in Tbilisi wall-clock time (audit viewer). */
export function formatDateTimeKa(iso: string): string {
  const d = new Date(new Date(iso).getTime() + TBILISI_OFFSET_MS);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
```

Run `npx vitest run lib/admin.test.ts` — PASS. Then write `app/(admin)/admin/audit/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import {
  AUDIT_ACTION_LABELS_KA,
  auditActionLabel,
  formatDateTimeKa,
  hasAnyRole,
  TARGET_TYPE_LABELS_KA,
} from "@/lib/admin";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "აუდიტი — ადმინისტრირება" };

const PAGE_SIZE = 50;

function detailsLabel(details: Json | null): string | null {
  if (details === null || typeof details !== "object" || Array.isArray(details)) return null;
  const d = details as Record<string, Json | undefined>;
  const name = d.memberName ?? d.name;
  return typeof name === "string" ? name : null;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) redirect("/admin");
  const raw = await searchParams;
  const page = Math.max(1, Number(typeof raw.page === "string" ? raw.page : "1") || 1);
  const action =
    typeof raw.action === "string" && raw.action in AUDIT_ACTION_LABELS_KA ? raw.action : undefined;
  const actorId = typeof raw.actorId === "string" && raw.actorId !== "" ? raw.actorId : undefined;
  const from = typeof raw.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.from) ? raw.from : undefined;
  const to = typeof raw.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.to) ? raw.to : undefined;

  const supabase = await createServerSupabase();
  let query = supabase.from("admin_audit").select("*", { count: "exact" });
  if (action) query = query.eq("action", action);
  if (actorId) query = query.eq("actor_id", actorId);
  if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59Z`);
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const { data: entries, count, error } = await query
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeFrom + PAGE_SIZE - 1);
  if (error) throw new Error(`admin_audit failed: ${error.message}`);

  const { data: admins, error: adminsError } = await supabase
    .from("admin_admins")
    .select("user_id, first_name, last_name");
  if (adminsError) throw new Error(`admin_admins failed: ${adminsError.message}`);
  const uniqueAdmins = [...new Map(admins.map((a) => [a.user_id, a])).values()];

  const total = count ?? 0;
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (actorId) params.set("actorId", actorId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const pageHref = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    return `/admin/audit?${next.toString()}`;
  };

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">აუდიტის ჟურნალი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          ყველა ადმინისტრაციული მოქმედება — უახლესი პირველ ადგილას. ჩანაწერები წაუშლელია.
        </p>
      </div>

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            მოქმედება
            <select name="action" defaultValue={action ?? ""} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal">
              <option value="">ყველა მოქმედება</option>
              {Object.entries(AUDIT_ACTION_LABELS_KA).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            ადმინი
            <select name="actorId" defaultValue={actorId ?? ""} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal">
              <option value="">ყველა ადმინი</option>
              {uniqueAdmins.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            დან
            <input type="date" name="from" defaultValue={from ?? ""} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            მდე
            <input type="date" name="to" defaultValue={to ?? ""} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal" />
          </label>
          <Button type="submit" variant="dark">
            ფილტრი
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-sm text-muted-fg">სულ: {total.toLocaleString("ka-GE")}</p>

      <Card padded={false} className="mt-2">
        {entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-fg">ჩანაწერები ვერ მოიძებნა.</p>
        ) : (
          <DataTable
            bodyTestId="admin-audit-body"
            head={
              <>
                <th className={tableThClass}>დრო</th>
                <th className={tableThClass}>ვინ</th>
                <th className={tableThClass}>მოქმედება</th>
                <th className={tableThClass}>ობიექტი</th>
                <th className={tableThClass}>დეტალები</th>
              </>
            }
          >
            {entries.map((e) => (
              <tr key={e.id} className={tableRowClass}>
                <td className={`${tableCellClass} whitespace-nowrap text-muted-fg`}>
                  {formatDateTimeKa(e.created_at)}
                </td>
                <td className={`${tableCellClass} font-semibold`}>
                  {e.actor_first_name ? `${e.actor_first_name} ${e.actor_last_name}` : "სისტემა"}
                </td>
                <td className={tableCellClass}>{auditActionLabel(e.action)}</td>
                <td className={tableCellClass}>
                  {e.target_label ??
                    detailsLabel(e.details) ??
                    `${TARGET_TYPE_LABELS_KA[e.target_type] ?? e.target_type}${
                      e.target_id ? ` · ${e.target_id.slice(0, 8)}` : ""
                    }`}
                </td>
                <td className={tableCellClass}>
                  {e.details !== null ? (
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-brand">
                        დეტალები
                      </summary>
                      <pre className="mt-1 max-w-[360px] overflow-x-auto rounded bg-surface p-2 text-xs">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between">
        {page > 1 ? (
          <ButtonLink href={pageHref(page - 1)} variant="ghost" size="sm">
            ← წინა
          </ButtonLink>
        ) : (
          <span />
        )}
        {rangeFrom + PAGE_SIZE < total ? (
          <ButtonLink href={pageHref(page + 1)} variant="ghost" size="sm">
            შემდეგი →
          </ButtonLink>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build` — expected PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/audit lib/admin.ts lib/admin.test.ts
git commit -m "feat(admin): audit-log viewer — filters, Georgian labels, expandable details"
```

---

### Task 23: პარამეტრები — the active rule (super_admin only)

**Files:**
- Create: `app/(admin)/admin/settings/page.tsx`
- Create: `app/(admin)/admin/settings/SettingsForm.tsx`
- Create: `app/(admin)/admin/settings/SettingsForm.test.tsx`
- Create: `app/(admin)/admin/settings/actions.ts`

**Interfaces:**
- Consumes: `admin_settings` view, `admin_update_setting` RPC (Task 6); `graceDaysSchema` (Task 5).
- Produces: `SettingsActionResult = { ok: true } | { ok: false; error: string }`.

- [ ] **Step 1: Write the failing component test — `SettingsForm.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./SettingsForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("SettingsForm (spec §3.9)", () => {
  it("prefills, explains in a plain sentence, saves and confirms the recompute", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    render(<SettingsForm initialGraceDays={30} save={save} />);
    const input = screen.getByLabelText(/დამატებითი დღეები/);
    expect(input).toHaveValue(30);
    expect(screen.getByText(/კიდევ 30 დღე/)).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, "45");
    expect(screen.getByText(/კიდევ 45 დღე/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(screen.getByText(/შენახულია ✓ — სტატუსები გადაითვალა/)).toBeInTheDocument(),
    );
    expect(save).toHaveBeenCalledWith(45);
  });
  it("blocks out-of-range values client-side", async () => {
    const save = vi.fn();
    render(<SettingsForm initialGraceDays={30} save={save} />);
    const input = screen.getByLabelText(/დამატებითი დღეები/);
    await userEvent.clear(input);
    await userEvent.type(input, "400");
    await userEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(screen.getByText(/0-დან 365-მდე/)).toBeInTheDocument(),
    );
    expect(save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run app/\(admin\)/admin/settings/SettingsForm.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

`app/(admin)/admin/settings/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { graceDaysSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

/** Updates the rule AND recomputes every member in the same transaction (spec §3.9). */
export async function updateGraceDaysAction(graceDays: unknown): Promise<SettingsActionResult> {
  const parsed = graceDaysSchema.safeParse({ graceDays });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_update_setting", {
    p_key: "active_grace_days",
    p_value: parsed.data.graceDays,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/settings");
  return { ok: true };
}
```

`app/(admin)/admin/settings/SettingsForm.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import type { SettingsActionResult } from "./actions";

export function SettingsForm({
  initialGraceDays,
  save,
}: {
  initialGraceDays: number;
  save: (graceDays: number) => Promise<SettingsActionResult>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialGraceDays));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const days = Number(value);
  const valid = Number.isInteger(days) && days >= 0 && days <= 365;

  async function onSave() {
    if (!valid) {
      setNotice({ kind: "error", text: "მიუთითე რიცხვი 0-დან 365-მდე." });
      return;
    }
    setBusy(true);
    setNotice(null);
    const result = await save(days);
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setNotice({ kind: "ok", text: "შენახულია ✓ — სტატუსები გადაითვალა." });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink">
        წევრი აქტიურია გადახდილი პერიოდის ბოლოდან კიდევ{" "}
        <strong>{valid ? days : "—"} დღე</strong>. მაგალითად: 20 ₾ (ერთი თვის საწევრო),
        გადახდილი 1 ივლისს, ფარავს 31 ივლისამდე — წევრი აქტიური რჩება კიდევ{" "}
        {valid ? days : "—"} დღე.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-56 flex-col gap-1 text-sm font-semibold text-ink">
          დამატებითი დღეები (0–365)
          <input
            type="number"
            min={0}
            max={365}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"
          />
        </label>
        <Button variant="primary" onClick={onSave} disabled={busy}>
          შენახვა
        </Button>
      </div>
      <p className="text-xs text-muted-fg">
        შენახვისას ყველა წევრის სტატუსი მაშინვე გადაითვლება ახალი წესით.
      </p>
      {notice ? (
        <p className={`text-sm font-semibold ${notice.kind === "ok" ? "text-ok" : "text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
```

`app/(admin)/admin/settings/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { formatDateTimeKa, hasAnyRole } from "@/lib/admin";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { updateGraceDaysAction } from "./actions";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "პარამეტრები — ადმინისტრირება" };

export default async function AdminSettingsPage() {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) redirect("/admin");
  const supabase = await createServerSupabase();
  const { data: setting, error } = await supabase
    .from("admin_settings")
    .select("*")
    .eq("key", "active_grace_days")
    .single();
  if (error) throw new Error(`admin_settings failed: ${error.message}`);
  const graceDays = Number(setting.value);

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">პარამეტრები</h1>
        <p className="mt-2 text-sm text-muted-fg">აქტიური წევრის წესის მართვა.</p>
      </div>
      <Card header={<h3 className="text-base font-bold text-ink">აქტიური წევრის წესი</h3>}>
        <SettingsForm initialGraceDays={graceDays} save={updateGraceDaysAction} />
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted-fg">
          ბოლო ცვლილება: {formatDateTimeKa(setting.updated_at)}
          {setting.updated_by_first_name
            ? ` · ${setting.updated_by_first_name} ${setting.updated_by_last_name}`
            : ""}
        </p>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build` — expected PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add app/\(admin\)/admin/settings
git commit -m "feat(admin): active-rule setting — plain-sentence editor, instant recompute"
```

---

### Task 24: Member cabinet rider — voided rows in `/me/billing`

**Files:**
- Modify: `lib/cabinet.ts` + `lib/cabinet.test.ts` (add `paymentStatusKa`)
- Modify: `app/(member)/me/billing/page.tsx`

**Interfaces:**
- Consumes: `payments.voided_at` (Task 6 — readable via the existing own-payments RLS policy).
- Produces: `paymentStatusKa(voidedAt: string | null): { label: string; pillStatus: "active_member" | "rejected" }`.

- [ ] **Step 1: Write the failing test — append to `lib/cabinet.test.ts`**

```ts
import { paymentStatusKa } from "./cabinet"; // merge into the existing import

describe("paymentStatusKa (Phase 4 §8 — honest voids)", () => {
  it("live rows are დადასტურებული, voided rows are გაუქმებული", () => {
    expect(paymentStatusKa(null)).toEqual({ label: "დადასტურებული", pillStatus: "active_member" });
    expect(paymentStatusKa("2026-07-17T10:00:00Z")).toEqual({
      label: "გაუქმებული",
      pillStatus: "rejected",
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/cabinet.test.ts` — expected FAIL.

- [ ] **Step 3: Implement**

Append to `lib/cabinet.ts`:

```ts
/** Billing-history status cell (Phase 4: voided payments stay visible, honestly). */
export function paymentStatusKa(voidedAt: string | null): {
  label: string;
  pillStatus: "active_member" | "rejected";
} {
  return voidedAt === null
    ? { label: "დადასტურებული", pillStatus: "active_member" }
    : { label: "გაუქმებული", pillStatus: "rejected" };
}
```

In `app/(member)/me/billing/page.tsx`:
1. Extend the select: `.select("id, amount_gel, paid_at, source, voided_at")`.
2. Add `paymentStatusKa` to the `@/lib/cabinet` import.
3. Replace the status cell (`<Pill status="active_member" label="დადასტურებული" />`) and strike voided amounts — the row body becomes:

```tsx
              {rows.map((p) => {
                const status = paymentStatusKa(p.voided_at);
                return (
                  <tr key={p.id} className={tableRowClass}>
                    <td className={tableCellClass}>{formatDateKa(p.paid_at)}</td>
                    <td
                      className={`${tableCellClass} font-semibold text-ink ${
                        p.voided_at ? "line-through opacity-60" : ""
                      }`}
                    >
                      {formatAmountGel(p.amount_gel)} ₾
                    </td>
                    <td className={tableCellClass}>{paymentMethodLabel(p.source)}</td>
                    <td className={tableCellClass}>
                      <Pill status={status.pillStatus} label={status.label} />
                    </td>
                  </tr>
                );
              })}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck` — expected PASS.

- [ ] **Step 5: Format, commit**

```bash
npm run format
git add lib/cabinet.ts lib/cabinet.test.ts app/\(member\)/me/billing/page.tsx
git commit -m "feat(cabinet): billing history shows voided payments honestly"
```

### Task 25: e2e — helpers + delegate-approval critical flow

**Files:**
- Create: `e2e/admin-helpers.ts`
- Create: `e2e/admin-approval.spec.ts`

**Interfaces:**
- Consumes: Task 9's canonical admins; `passStep1`, `fillStep2Basics` from `e2e/funnel-helpers.ts`; the existing funnel journeys in `e2e/funnel.spec.ts` (the delegate and referral journeys are the copy-source for registration steps).
- Produces (consumed by Tasks 26–27): `ADMIN_PHONES`, `phase4Phone(k)`, `phase4PersonalId(k)`, `loginAs(page, phone)`, `signOutViaNav(page)`, `serviceClient()`, `getReferenceCode(phone)`, `getReferralCode(phone)`, `getAuditRows(action, targetId)`, `cleanupPhase4Users(ks)`.

Phase-4 phone scheme: `BASE7 + "8" + k` (replaces the run block's last TWO digits — digit 8 was the only free single slot). The attempt digit is consumed, so every phase-4 spec cleans its own phones in `beforeAll` AND `afterAll` (a crashed previous attempt can't collide). Personal IDs stay 9-prefixed. E2e users are only ever audit TARGETS — the seeded canonical admins act (Global Constraints).

- [ ] **Step 1: Write `e2e/admin-helpers.ts`**

```ts
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Canonical seeded admins (scripts/seed-staging.mjs) — permanent audit actors. */
export const ADMIN_PHONES = {
  super: "509000001",
  verifier: "509000002",
  finance: "509000003",
  editor: "509000004",
} as const;

const LOGIN_PHONE = process.env.E2E_TEST_PHONE ?? "550009999";
const BASE7 = LOGIN_PHONE.slice(0, 7);

/** Phase-4 per-run users: 55-block, '8'+k tail. Cleaned beforeAll AND afterAll. */
export function phase4Phone(k: number): string {
  return `${BASE7}8${k}`;
}
export function phase4PersonalId(k: number): string {
  return `9${BASE7.slice(1)}8${k}00`; // 11 digits, reserved 9-prefix
}

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("admin e2e needs staging service credentials");
  return createClient(url, key);
}

/** /login flow (mirrors e2e/login.spec.ts); admins are completed members → cabinet. */
export async function loginAs(page: Page, phoneNational: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("ტელეფონის ნომერი").fill(phoneNational);
  await page.getByRole("button", { name: "კოდის მიღება" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await page.getByTestId("otp-0").fill(otp);
  await page.getByRole("button", { name: "დადასტურება" }).click();
  await expect(page).toHaveURL(/\/(me\/profile|delegate)$/, { timeout: 15_000 });
}

/** Both CabinetNav and AdminNav expose the same გასვლა control. */
export async function signOutViaNav(page: Page): Promise<void> {
  await page.getByRole("button", { name: "გასვლა" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

async function profileIdByPhone(db: SupabaseClient, phoneNational: string): Promise<string> {
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .in("phone", [`+995${phoneNational}`, `995${phoneNational}`]);
  if (error || !data || data.length !== 1) {
    throw new Error(`profile lookup for ${phoneNational} failed: ${error?.message ?? data?.length}`);
  }
  return data[0]!.id as string;
}

export async function getReferenceCode(phoneNational: string): Promise<string> {
  const db = serviceClient();
  const id = await profileIdByPhone(db, phoneNational);
  const { data, error } = await db.from("profiles").select("reference_code").eq("id", id).single();
  if (error || !data?.reference_code) throw new Error(`no reference code for ${phoneNational}`);
  return data.reference_code as string;
}

export async function getReferralCode(phoneNational: string): Promise<string> {
  const db = serviceClient();
  const id = await profileIdByPhone(db, phoneNational);
  const { data, error } = await db.from("delegates").select("referral_code").eq("id", id).single();
  if (error || !data?.referral_code) throw new Error(`no referral code for ${phoneNational}`);
  return data.referral_code as string;
}

export async function getAuditRows(action: string, targetId: string): Promise<number> {
  const db = serviceClient();
  const { count, error } = await db
    .from("audit_log")
    .select("*", { count: "exact", head: true })
    .eq("action", action)
    .eq("target_id", targetId);
  if (error) throw new Error(`audit read failed: ${error.message}`);
  return count ?? 0;
}

/** Deletes this run's phase-4 users (payments cascade; memberships detached first). */
export async function cleanupPhase4Users(ks: readonly number[]): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("phase-4 e2e cleanup skipped: staging service credentials not in env");
    return;
  }
  const db = createClient(url, key);
  const phones = ks.flatMap((k) => [`+995${phase4Phone(k)}`, `995${phase4Phone(k)}`]);
  const { data: rows } = await db.from("profiles").select("id").in("phone", phones);
  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return;
  const { error: detachErr } = await db.from("memberships").delete().in("delegate_id", ids);
  if (detachErr) console.warn(`phase-4 cleanup: membership detach failed: ${detachErr.message}`);
  for (const id of ids) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) console.warn(`phase-4 cleanup: deleteUser ${id} failed: ${error.message}`);
  }
}
```

- [ ] **Step 2: Write `e2e/admin-approval.spec.ts` (critical flow 1)**

Registration steps must mirror the EXISTING journeys byte-for-byte where labels are involved: open `e2e/funnel.spec.ts`, copy its **delegate journey** steps (role choice → step 1 → step 2 with the T&C checkbox → step 3 tier → pending screen) and its **referral journey** steps (`/join?ref=…` → member registration), substituting the phase-4 phones/IDs. The skeleton below marks those two blocks; everything else is complete.

```ts
import { expect, test } from "@playwright/test";
import { fillStep2Basics, passStep1 } from "./funnel-helpers";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getAuditRows,
  getReferralCode,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  serviceClient,
  signOutViaNav,
} from "./admin-helpers";

const APPLICANT = 0; // phase4Phone(0) — the delegate applicant (target only)
const SUPPORTER = 1; // phase4Phone(1) — registers through the referral link

test.describe.configure({ mode: "serial" });
test.beforeAll(() => cleanupPhase4Users([APPLICANT, SUPPORTER]));
test.afterAll(() => cleanupPhase4Users([APPLICANT, SUPPORTER]));

test("delegate applies and lands in the pending queue", async ({ page }) => {
  // >>> copy e2e/funnel.spec.ts's delegate journey here, with:
  //     phone: phase4Phone(APPLICANT), personalId: phase4PersonalId(APPLICANT),
  //     firstName: "ვაჟა", lastName: "ფშაველა"
  //     (choice → passStep1 → fillStep2Basics + T&C → tier → /join/pending) <<<
  await expect(page).toHaveURL(/\/join\/pending$/);
});

test("verifier reveals, rejects with a note, then re-approves — public page goes live", async ({
  page,
}) => {
  await loginAs(page, ADMIN_PHONES.verifier);
  await page.goto("/admin/verify");
  const card = page.locator("div").filter({ hasText: "ვაჟა ფშაველა" }).last();
  await expect(card).toBeVisible();

  // audited reveal: masked → full personal ID
  await page.getByRole("button", { name: "ჩვენება" }).first().click();
  await expect(page.getByText(phase4PersonalId(APPLICANT))).toBeVisible();

  // reject with an internal note
  await page.getByRole("button", { name: "უარყოფა" }).first().click();
  await page.getByLabel(/შიდა შენიშვნა/).fill("დოკუმენტები გადასამოწმებელია");
  await page.getByRole("button", { name: "უარყოფის დადასტურება" }).click();
  await expect(page.getByText("განაცხადი უარყოფილია.")).toBeVisible();

  // rejected tab holds the applicant + the note; re-approve from there
  await page.goto("/admin/verify?tab=rejected");
  await expect(page.getByText("ვაჟა ფშაველა")).toBeVisible();
  await expect(page.getByText(/დოკუმენტები გადასამოწმებელია/)).toBeVisible();
  await page.getByRole("button", { name: "დადასტურება" }).first().click();
  await expect(page.getByText(/დელეგატი დამტკიცდა/)).toBeVisible();

  // the success notice links the live public page — open it and see the applicant
  const publicHref = await page
    .getByRole("link", { name: /საჯარო გვერდი/ })
    .getAttribute("href");
  expect(publicHref).toMatch(/^\/delegates\/.+/);
  await page.goto(publicHref as string);
  await expect(page.getByText("ვაჟა ფშაველა")).toBeVisible();

  await page.goto("/admin");
  await signOutViaNav(page);
});

test("audit trail holds the reveal, reject and approve rows", async () => {
  const db = serviceClient();
  const { data } = await db
    .from("profiles")
    .select("id")
    .in("phone", [`+995${phase4Phone(APPLICANT)}`, `995${phase4Phone(APPLICANT)}`]);
  const applicantId = data![0]!.id as string;
  expect(await getAuditRows("delegate.reveal_personal_id", applicantId)).toBeGreaterThan(0);
  expect(await getAuditRows("delegate.reject", applicantId)).toBe(1);
  expect(await getAuditRows("delegate.approve", applicantId)).toBe(1);
});

test("the activated referral link registers a real supporter", async ({ page }) => {
  const refCode = await getReferralCode(phase4Phone(APPLICANT));
  // >>> copy e2e/funnel.spec.ts's referral journey here, with:
  //     entry URL `/join?ref=${refCode}`, phone: phase4Phone(SUPPORTER),
  //     personalId: phase4PersonalId(SUPPORTER), firstName: "მხარდამჭერი", lastName: "პირველი"
  //     (assert the referral banner shows „ვაჟა ფშაველა“, then complete through step 3) <<<
  await expect(page).toHaveURL(/\/join\/done$/);
  // the supporter's cabinet shows the applicant as their delegate
  await page.goto("/me/delegate");
  await expect(page.getByText("ვაჟა ფშაველა")).toBeVisible();
});
```

- [ ] **Step 3: Run the suite against staging**

```bash
npx playwright test e2e/admin-approval.spec.ts
```
Expected: all 4 serial tests green. (Requires Tasks 7–10 done on staging; run the full `npx playwright test` afterwards to confirm the existing suites stayed green.)

- [ ] **Step 4: Format, commit**

```bash
npm run format
git add e2e/admin-helpers.ts e2e/admin-approval.spec.ts
git commit -m "test(e2e): delegate approval critical flow — reveal, reject, re-approve, live referral"
```

---

### Task 26: e2e — payment recording critical flow

**Files:**
- Create: `e2e/admin-payments.spec.ts`

**Interfaces:**
- Consumes: Task 25's helpers; the member funnel journey in `e2e/funnel.spec.ts` (copy-source); Tasks 17–19's UI.

- [ ] **Step 1: Write `e2e/admin-payments.spec.ts` (critical flow 2)**

```ts
import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getReferenceCode,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  signOutViaNav,
} from "./admin-helpers";

const PAYER = 2; // phase4Phone(2) — fresh member, ცენტრალური მოძრაობა, tier 10

test.describe.configure({ mode: "serial" });
test.beforeAll(() => cleanupPhase4Users([PAYER]));
test.afterAll(() => cleanupPhase4Users([PAYER]));

test("a fresh member registers (tier 10, central)", async ({ page }) => {
  // >>> copy e2e/funnel.spec.ts's member journey here, with:
  //     phone: phase4Phone(PAYER), personalId: phase4PersonalId(PAYER),
  //     firstName: "გადამხდელი", lastName: "პირველი", central delegate, tier 10 <<<
  await expect(page).toHaveURL(/\/join\/done$/);
});

test("finance records a single payment by GR-code — the member turns active", async ({
  page,
}) => {
  const code = await getReferenceCode(phase4Phone(PAYER));
  await loginAs(page, ADMIN_PHONES.finance);
  await page.goto("/admin/finances");

  await page.getByLabel(/წევრის ძებნა/).fill(code);
  await page.getByRole("button", { name: "ძებნა" }).click();
  await page.getByRole("button", { name: /გადამხდელი პირველი/ }).click();
  await page.getByLabel(/თანხა/).fill("10");
  await expect(page.getByText("→ 1 თვე")).toBeVisible();
  await page.getByRole("button", { name: "აღრიცხვა" }).click();
  await expect(page.getByText(/აღირიცხა — 1 თვე · წევრი ახლა აქტიურია/)).toBeVisible();

  // derivation is visible platform-wide: the member list shows აქტიური
  await page.goto(`/admin/members?search=${code}`);
  await expect(page.getByTestId("admin-members-body").getByText("აქტიური")).toBeVisible();
});

test("bulk paste classifies five row kinds and records exactly the two valid ones", async ({
  page,
}) => {
  const code = await getReferenceCode(phase4Phone(PAYER));
  await loginAs(page, ADMIN_PHONES.finance);
  await page.goto("/admin/finances");

  const paste = [
    `${code} 20.00`, // ok (2 months on tier 10)
    `${code} 30,00 01.07.2026`, // ok (comma decimal + explicit date)
    "GR-ZZZZZ9 10.00", // unknown code
    `${code} 20.00`, // byte-identical → duplicate line
    "გადმორიცხვა 15.00", // no code
  ].join("\n");
  await page.getByLabel(/ამონაწერის სტრიქონები/).fill(paste);
  await page.getByRole("button", { name: "გადამოწმება" }).click();

  const preview = page.getByTestId("bulk-preview-body");
  await expect(preview.getByText("ნაპოვნია")).toHaveCount(2);
  await expect(preview.getByText("უცნობი კოდი")).toBeVisible();
  await expect(preview.getByText("განმეორებული ხაზი")).toBeVisible();
  await expect(preview.getByText("კოდი ვერ მოიძებნა")).toBeVisible();
  await expect(page.getByText(/ჩაიწერება: 2/)).toBeVisible();

  await page.getByRole("button", { name: /დადასტურება \(2\)/ }).click();
  await expect(page.getByText(/აღირიცხა 2 გადახდა/)).toBeVisible();
});

test("void demotes nothing here (two live payments remain) but marks the row", async ({
  page,
}) => {
  await loginAs(page, ADMIN_PHONES.finance);
  await page.goto("/admin/finances");
  const txBody = page.getByTestId("admin-tx-body");
  await expect(txBody.getByText("გადამხდელი პირველი").first()).toBeVisible();

  await txBody.getByRole("button", { name: "გაუქმება" }).first().click();
  await page.getByLabel(/მიზეზი/).fill("სატესტო გაუქმება");
  await page.getByRole("button", { name: "გაუქმების დადასტურება" }).click();
  await expect(txBody.getByText("გაუქმებული").first()).toBeVisible({ timeout: 15_000 });
  await signOutViaNav(page);
});

test("the member's own cabinet shows the history, including the voided row", async ({
  page,
}) => {
  await loginAs(page, phase4Phone(PAYER));
  await page.goto("/me/billing");
  await expect(page.getByText("გაუქმებული")).toBeVisible();
  await expect(page.getByText("დადასტურებული").first()).toBeVisible();
  // two live payments keep them active
  await page.goto("/me/profile");
  await expect(page.getByText("აქტიური")).toBeVisible();
});
```

- [ ] **Step 2: Run it against staging**

```bash
npx playwright test e2e/admin-payments.spec.ts
```
Expected: all 5 serial tests green.

- [ ] **Step 3: Format, commit**

```bash
npm run format
git add e2e/admin-payments.spec.ts
git commit -m "test(e2e): payment recording critical flow — single, bulk classify, void, cabinet"
```

---

### Task 27: e2e — RBAC smoke

**Files:**
- Create: `e2e/admin-rbac.spec.ts`

**Interfaces:**
- Consumes: Task 25's helpers; the member funnel journey (copy-source) for the ordinary-member check.

- [ ] **Step 1: Write `e2e/admin-rbac.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  signOutViaNav,
} from "./admin-helpers";

const CIVILIAN = 3; // phase4Phone(3) — ordinary member for the bounce check

test.describe.configure({ mode: "serial" });
test.beforeAll(() => cleanupPhase4Users([CIVILIAN]));
test.afterAll(() => cleanupPhase4Users([CIVILIAN]));

test("verifier is blocked from finance surfaces server-side, not just hidden tabs", async ({
  page,
}) => {
  await loginAs(page, ADMIN_PHONES.verifier);
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "ვერიფიკაცია" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ფინანსები" })).not.toBeVisible();

  await page.goto("/admin/finances");
  await expect(page).toHaveURL(/\/admin$/); // server redirect, not a rendered page
  await page.goto("/admin/admins");
  await expect(page).toHaveURL(/\/admin$/);
  await signOutViaNav(page);
});

test("editor-only admin sees the Phase 5 notice and no tabs", async ({ page }) => {
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin");
  await expect(page.getByText("შენი განყოფილება მე-5 ფაზაში ჩაირთვება")).toBeVisible();
  await expect(page.getByRole("link", { name: "წევრები" })).not.toBeVisible();
  await signOutViaNav(page);
});

test("an ordinary member is bounced from /admin to their cabinet", async ({ page }) => {
  // >>> copy e2e/funnel.spec.ts's member journey here, with:
  //     phone: phase4Phone(CIVILIAN), personalId: phase4PersonalId(CIVILIAN),
  //     firstName: "რიგითი", lastName: "წევრი" <<<
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/me\/profile$/);
});

test("anonymous visitors land on /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 2: Run the full e2e suite against staging**

```bash
npx playwright test
```
Expected: the three new specs AND every existing suite (funnel, cabinet, delegate-panel, login, public, smoke) green. If `smoke.spec.ts` or `public.spec.ts` assert exact public counters, they may move by the payer member's ±1 — read those assertions and, if (and only if) they hardcode counts, relax them to `≥` the seeded constant in this same task with a comment referencing this phase.

- [ ] **Step 3: Format, commit**

```bash
npm run format
git add e2e/admin-rbac.spec.ts
git commit -m "test(e2e): RBAC smoke — server-side scope enforcement, editor notice, bounces"
```

### Task 28: Docs, ADRs, version — and the final gates

**Files:**
- Modify: `ARCHITECTURE.md`, `DESIGN.md`, `DECISIONS.md`, `CHANGELOG.md`, `package.json`
- Check: `app/(public)/styleguide` (mirror how CabinetNav was or wasn't included; follow suit for AdminNav)

- [ ] **Step 1: ARCHITECTURE.md — append the Admin CRM section**

Append after the "Cabinets (Phase 3)" section:

```markdown
## Admin CRM (Phase 4)

`/admin/*` (route group `app/(admin)`) is per-request server-rendered behind a
layout gate (session + ≥1 `admin_roles` row, read via the own-rows RLS policy);
role-specific pages re-gate and the database re-checks everything regardless.
Reads go through self-gating definer views (`admin_overview`, `admin_region_stats`,
`admin_members`, `admin_delegate_queue`, `admin_payments`, `admin_finance_stats`,
`admin_admins`, `admin_audit`, `admin_settings`) — zero rows for non-admins, and
no view contains `personal_id`/`birth_date`. Every mutation is a SECURITY DEFINER
RPC that re-checks the caller's role and writes its `audit_log` row in the same
transaction (ADR-014). Personal IDs: masked with audited click-to-reveal (two RPC
paths) and super_admin-only export inclusion; since Phase 4 the `authenticated`
column grant on `profiles` excludes `personal_id`/`birth_date`.

The active-member engine (ADR-015): payments carry a tier snapshot and a GENERATED
`months_covered`; coverage folds `greatest(prev_end, paid_at) + months × 30 days`;
a member is active while `today ≤ coverage_end + active_grace_days` (app_settings,
default 30). Status recomputes on record/void/setting change; a nightly pg_cron
sweep demotes lapsed members (`system.active_sweep` audit rows). The staging seed
writes payment histories — statuses are always derived. Delegate photos live in the
public `delegate-photos` bucket; uploads go only through the admin server action
(the single service-role app path), paired with the re-checking RPC.
```

If Task 7 took the Vercel-cron fallback, replace the pg_cron sentence accordingly.

- [ ] **Step 2: DESIGN.md — append the Phase 4 note**

```markdown
Phase 4: AdminNav (role-filtered admin tabs + გასვლა; dense register). Admin list
pattern: GET-form filters + server-side range pagination (50/page) + DataTable;
masked personal IDs with an audited ჩვენება reveal; bulk-preview status chips
(ok=ok-green, duplicates=warn, failures=danger). StatCard reused for admin KPIs.
```

- [ ] **Step 3: DECISIONS.md — append ADR-014 and ADR-015**

```markdown
## ADR-014 (2026-07-17): Admin access = self-gating definer views + in-transaction-audit RPCs

Admin reads are owner-executed views that check has_any_admin_role(auth.uid()) in
their WHERE — non-admins get zero rows — and physically exclude personal_id and
birth_date. Admin mutations are SECURITY DEFINER RPCs: role check first, all
effects plus the audit_log insert in ONE transaction, so an unaudited admin action
is unrepresentable. Rider: the blanket authenticated SELECT grant on profiles was
narrowed to an explicit column list without personal_id/birth_date (verified: no
client-path code ever read them — they are write-only through funnel_save_profile).
Exactly two audited paths return a personal ID: the reveal RPCs
(admin_reveal_personal_id — super_admin; admin_reveal_applicant_personal_id —
verifier scope) and admin_export_members with p_include_ids (super_admin).
Rejected: service-role reads behind app checks (one forgotten check = full
exposure, no DB backstop) and all-RPC reads (hand-wired filter/paging plumbing for
zero extra safety over self-gating views). Operational consequence: audit_log
actors are permanent (plain FK + append-only trigger blocks even ON DELETE SET
NULL), so e2e/probe users must never act as admins — canonical seeded admins
(+99550900000{1..4}) do; targets are stored as text and stay deletable.

## ADR-015 (2026-07-17): Active-member engine — 30-day months, snapshot tiers, grace, nightly sweep

months = greatest(1, floor(amount_gel / tier_gel_at_payment)) as a GENERATED
STORED column — tier snapshotted at recording so later tier changes never rewrite
history. Coverage folds payments in paid_at order:
end = greatest(prev_end, paid_at) + months × 30 days; a member is active while
current_date ≤ end + active_grace_days (app_settings, default 30 → a single
monthly payment = exactly 60 days, the owner's chosen window). lib/active.ts
mirrors the SQL; the schema probe replays the shared fixtures against both.
profiles.status is written ONLY by the engine (plus the funnel's
draft→profile_completed); the seed now writes payment histories and derives.
Payments are immutable — corrections are voids (voided_at/by/reason, audited,
required reason); the live-rows-only unique index on bank_reference makes
double-pasting a statement unrecordable while letting a voided reference be
re-entered. payments.member_id now cascades on profile deletion (e2e/staging
cleanup; the platform has no member-deletion flow; audit targets are text).
Expiry runs nightly via pg_cron ('active-member-sweep', 01:00 UTC = 05:00
Tbilisi), auditing system.active_sweep with the demoted count.
[If Task 7 took the fallback: replace the last sentence with the Vercel-cron
route + CRON_SECRET description and why pg_cron was unavailable.]
```

- [ ] **Step 4: CHANGELOG.md + version**

Match the existing entry format (read the file first). Entry:

```markdown
## v0.5.0 — Phase 4: Admin CRM (2026-07-17)

- /admin area with DB-enforced roles (super_admin / verifier / finance / editor)
- Delegate verification: approve (mints the public slug — page + referral link live
  instantly), reversible reject with internal notes, bio/photo editing (Storage)
- Member management: search/filter/pagination, audited personal-ID reveals,
  audited CSV export (personal IDs super_admin-only, off by default)
- Payment recording: single entry + bulk paste matching by GR-code with
  classify-then-confirm preview (all-or-nothing), void with required reason
- Active-member engine: amount buys 30-day months (min 1, stacking), configurable
  grace (default 30), instant recompute + nightly sweep; seed now derives statuses
- Reassignment of ცენტრალური მოძრაობა members to delegates (history kept)
- Append-only audit log for every admin action + viewer with filters
- Personal-ID column lockdown: exactly two audited read paths remain
```

In `package.json`: `"version": "0.5.0"`.

- [ ] **Step 5: Final gates and push**

```bash
npm run lint && npm run typecheck && npx vitest run && npm run build && npm run format:check
git add ARCHITECTURE.md DESIGN.md DECISIONS.md CHANGELOG.md package.json
git commit -m "docs: Phase 4 — architecture, ADR-014/015, changelog, v0.5.0"
git push -u origin claude/phase-4-admin-crm-1fd359
```

Expected: every gate green locally; CI green on the pushed branch (unit + e2e against staging). What follows is process, not plan: independent per-task reviews already happened during execution; now the whole-branch review, `/qa` on the Vercel preview, the owner sign-off package (per spec §10 — preview URL, per-role demo logins, scripted walkthrough with screenshots), and the PR "Phase 4 — Admin CRM (v0.5.0)". Never merge with failing CI; owner approves in chat first.

---

## Execution sequencing (dependency notes)

- Tasks 1–5 are pure `lib/` — parallel-safe, no staging needed.
- Task 6 (migration file + types) must precede Task 7 (apply), which must precede
  Tasks 9 (seed), 10 (probes) and any LIVE verification of Tasks 11–24's pages;
  the UI tasks' unit/component tests and builds pass without staging.
- Tasks 25–27 (e2e) require Tasks 7–10 completed on staging AND Tasks 11–24 deployed
  to the preview/CI environment. Existing suites must stay green throughout.
- Task 28 is last.
