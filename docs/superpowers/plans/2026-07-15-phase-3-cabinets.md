# Phase 3 — Cabinets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every completed registrant a home — a member cabinet (`/me/profile`, `/me/delegate`, `/me/billing`: profile editing via the Phase-2-prepared scoped path, delegate changing with history, reference code + transfer instructions + tier change + honest empty payment history) and a delegate panel (`/delegate`, `/delegate/team`: live referral link + QR, live counts, team table) — with login/funnel routing handing off so completed users land in the cabinet and the funnel becomes one-way.

**Architecture:** Mixed DB access model (ADR-013): plain profile fields go through a column-scoped `UPDATE` grant + the dormant "own profile updatable" RLS policy + the `protect_profile_columns()` trigger backstop; everything compound or protected (change delegate, change tier, delegate panel reads) is SECURITY DEFINER RPCs per ADR-009. Cabinet pages are per-request **server-rendered** behind server-side layout gates (the service worker has treated `/me` and `/delegate` as NetworkOnly since Phase 0 — verified in `app/sw.ts:27`), with small client components for interactivity. Pure logic in `lib/`.

**Tech Stack:** Next.js 16 (App Router), TypeScript 6 strict, Tailwind 4, Supabase (`@supabase/ssr` + RPCs), zod, `uqr` (QR SVG — the one new dependency, ADR-011), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-15-phase-3-cabinets-design.md` — binding. UX reference: `prototype/index.html` screens `me-profile`, `me-delegate`, `me-billing`, `delegate-dashboard`, `delegate-team` (approved deviations listed in the spec header).

## Global Constraints

- TypeScript `strict: true`; **no `any`, no `@ts-ignore`**. (`noUncheckedIndexedAccess` is on — index access yields `T | undefined`; guard or use `!` only where a regex/loop invariant guarantees presence, with a comment.)
- Domain logic = pure functions in `lib/` — no React/Next imports there (`lib/supabase/` is the sanctioned data-access location).
- **All user-facing text Georgian.** Reuse design-system components (DESIGN.md); extend, never restyle ad hoc. Button/ButtonLink size via the `size` prop only; **exactly one shadow utility per element** (arbitrary `shadow-[...]` loses to `shadow-sm` by stylesheet order).
- Schema changes ONLY via `supabase/migrations/`. Local dev + previews + CI all use the STAGING Supabase project (`orcxtbedkexoclbfgvzd`).
- **One new npm dependency only: `uqr`** (zero-dependency QR SVG generator, ADR-011). Nothing else.
- zod validation at every boundary: the same schemas drive client forms and server actions; the DB re-validates inside RPCs / trigger / grants. Server is the source of truth.
- Cabinet pages are server components gated in layouts (`redirect()` is allowed there — the SW never caches `/me`/`/delegate`). Funnel pages keep their client-fetch guard pattern untouched.
- Statuses/counters stay derived. Nothing in this phase stores a computed value or sets `active_member`.
- TDD: write the failing test first, run it, watch it fail, then implement. Frequent commits (conventional style); each task ends committed.
- **Run `npm run format` before every commit** — CI's `format:check` is strict, and prettier must only ever reformat files you touched (line endings are pinned by `.gitattributes`; never commit end-of-line noise).
- Working directory: repo root (worktree branch `claude/phase-3-cabinets-a070f4`).
- The canonical staging seed (12 approved delegates, home counters) must never be disturbed; e2e uses only per-run `55XXXXXXX` phones and `9…` personal IDs, and may only mutate rows belonging to those per-run users.
- Georgian typographic quotes are `„ “` — byte-exact (U+201E/U+201C); never let a subagent "normalize" them to ASCII.

---

### Task 1: Cabinet domain logic (`lib/cabinet.ts`) + `lib/funnel.ts` extensions

**Files:**
- Create: `lib/cabinet.ts`
- Create: `lib/cabinet.test.ts`
- Modify: `lib/funnel.ts`
- Modify: `lib/funnel.test.ts`

**Interfaces:**
- Consumes: `deriveFunnelStep`, `funnelRoute`, `FunnelState` from `lib/funnel.ts`; `EMPLOYMENT_PRESETS` from `lib/funnel-schemas.ts` (already exported).
- Produces (consumed by Tasks 3, 5–12):
  - `lib/funnel.ts` — `FunnelState` gains `status: MemberStatus`, `registrationCompletedAt: string | null` and `createdAt: string` (legacy member-since fallback, spec §3.3); new `export type MemberStatus = "draft" | "profile_completed" | "active_member"`; `REFERENCE_CODE_RE` now derived from `FUNNEL_CODE_ALPHABET`; `mapFunnelError` learns tokens `not_completed`, `not_a_member`, `not_a_delegate`.
  - `lib/cabinet.ts` —
    - `deriveDestination(state: FunnelState | null): string`
    - `interface CabinetNavItem { href: string; label: string }`, `cabinetNavItems(role: "member" | "delegate"): CabinetNavItem[]`
    - `EMPLOYMENT_OTHER = "__other"`, `interface EmploymentFormValue { choice: string; custom: string }`, `employmentToForm(stored: string | null): EmploymentFormValue`, `formToEmployment(value: EmploymentFormValue): string`
    - `memberSinceKa(isoTimestamp: string | null): string | null`
    - `formatPhoneKa(phone: string | null | undefined): string`
    - `formatDateKa(iso: string): string`
    - `initialsKa(firstName: string, lastName: string): string`
    - `interface DelegatePanelData { status: "pending" | "approved" | "rejected"; referralCode: string; activeCount: number; totalCount: number; draftCount: number }`
    - `type TeamMemberStatus = "profile_completed" | "active_member"`, `interface TeamMember { firstName: string; lastName: string; registeredAt: string; status: TeamMemberStatus }`
    - `TEAM_STATUS_LABELS: Record<TeamMemberStatus, string>`
    - `paymentMethodLabel(source: string): string`
    - `buildReferralUrl(origin: string, code: string): string`

- [ ] **Step 1: Write the failing test — `lib/cabinet.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  buildReferralUrl,
  cabinetNavItems,
  deriveDestination,
  EMPLOYMENT_OTHER,
  employmentToForm,
  formatDateKa,
  formatPhoneKa,
  formToEmployment,
  initialsKa,
  memberSinceKa,
  paymentMethodLabel,
  TEAM_STATUS_LABELS,
} from "./cabinet";
import type { FunnelState } from "./funnel";

function state(overrides: Partial<FunnelState>): FunnelState {
  return {
    exists: true,
    role: "member",
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalIdSet: false,
    birthDate: null,
    regionId: null,
    cityId: null,
    employment: null,
    tier: null,
    referenceCode: null,
    completed: false,
    status: "draft",
    registrationCompletedAt: null,
    createdAt: "2026-07-01T00:00:00Z",
    delegateStatus: null,
    referral: null,
    chosenDelegate: null,
    membershipExists: false,
    ...overrides,
  };
}

describe("deriveDestination (spec §3.2)", () => {
  it("no session state or no profile → /join", () => {
    expect(deriveDestination(null)).toBe("/join");
    expect(deriveDestination(state({ exists: false }))).toBe("/join");
  });
  it("unfinished registration → the derived funnel step", () => {
    expect(deriveDestination(state({}))).toBe("/join/step-2");
    expect(deriveDestination(state({ personalIdSet: true }))).toBe("/join/step-3");
  });
  it("completed member → /me/profile", () => {
    expect(
      deriveDestination(
        state({
          personalIdSet: true,
          completed: true,
          status: "profile_completed",
          registrationCompletedAt: "2026-07-15T10:00:00Z",
        }),
      ),
    ).toBe("/me/profile");
  });
  it("delegate (any verification status) → /delegate", () => {
    for (const delegateStatus of ["pending", "approved", "rejected"] as const) {
      expect(
        deriveDestination(
          state({ role: "delegate", personalIdSet: true, completed: true, delegateStatus }),
        ),
      ).toBe("/delegate");
    }
  });
  it("legacy active_member (no registration_completed_at) counts as completed", () => {
    expect(
      deriveDestination(state({ personalIdSet: true, completed: true, status: "active_member" })),
    ).toBe("/me/profile");
  });
});

describe("cabinetNavItems (spec §3.1)", () => {
  it("member: profile / my delegate / billing", () => {
    expect(cabinetNavItems("member")).toEqual([
      { href: "/me/profile", label: "პროფილი" },
      { href: "/me/delegate", label: "ჩემი დელეგატი" },
      { href: "/me/billing", label: "გადახდები" },
    ]);
  });
  it("delegate: profile / billing / panel — no „ჩემი დელეგატი“", () => {
    expect(cabinetNavItems("delegate")).toEqual([
      { href: "/me/profile", label: "პროფილი" },
      { href: "/me/billing", label: "გადახდები" },
      { href: "/delegate", label: "დელეგატის პანელი" },
    ]);
  });
});

describe("employment mapping (spec §3.3)", () => {
  it("preset value round-trips", () => {
    expect(employmentToForm("სტუდენტი")).toEqual({ choice: "სტუდენტი", custom: "" });
    expect(formToEmployment({ choice: "სტუდენტი", custom: "" })).toBe("სტუდენტი");
  });
  it("non-preset value renders as „სხვა“ with the text filled", () => {
    expect(employmentToForm("მეწარმე")).toEqual({ choice: EMPLOYMENT_OTHER, custom: "მეწარმე" });
    expect(formToEmployment({ choice: EMPLOYMENT_OTHER, custom: "  მეწარმე " })).toBe("მეწარმე");
  });
  it("null (legacy) → empty „სხვა“", () => {
    expect(employmentToForm(null)).toEqual({ choice: EMPLOYMENT_OTHER, custom: "" });
  });
});

describe("memberSinceKa", () => {
  it("formats year + -დან month (syncope forms correct)", () => {
    expect(memberSinceKa("2026-02-10T08:30:00Z")).toBe("2026 წლის თებერვლიდან");
    expect(memberSinceKa("2026-01-01T00:00:00Z")).toBe("2026 წლის იანვრიდან");
    expect(memberSinceKa("2026-08-31T23:59:59Z")).toBe("2026 წლის აგვისტოდან");
    expect(memberSinceKa("2026-09-15T12:00:00Z")).toBe("2026 წლის სექტემბრიდან");
  });
  it("null / invalid → null", () => {
    expect(memberSinceKa(null)).toBeNull();
    expect(memberSinceKa("garbage")).toBeNull();
  });
});

describe("formatPhoneKa", () => {
  it("formats E.164 with and without + (auth stores it without)", () => {
    expect(formatPhoneKa("+995599123456")).toBe("+995 599 12 34 56");
    expect(formatPhoneKa("995599123456")).toBe("+995 599 12 34 56");
  });
  it("unknown shapes pass through; empty → —", () => {
    expect(formatPhoneKa("12345")).toBe("12345");
    expect(formatPhoneKa(null)).toBe("—");
    expect(formatPhoneKa(undefined)).toBe("—");
  });
});

describe("formatDateKa / initialsKa / labels", () => {
  it("dd.mm.yyyy, deterministic (no ICU)", () => {
    expect(formatDateKa("2026-07-15")).toBe("15.07.2026");
    expect(formatDateKa("2026-07-15T22:10:00Z")).toBe("15.07.2026");
    expect(formatDateKa("garbage")).toBe("garbage");
  });
  it("initials from Georgian names", () => {
    expect(initialsKa("ნინო", "ბერიძე")).toBe("ნბ");
  });
  it("team status labels (spec §3.7)", () => {
    expect(TEAM_STATUS_LABELS.profile_completed).toBe("რეგისტრირებული");
    expect(TEAM_STATUS_LABELS.active_member).toBe("აქტიური");
  });
  it("payment method label", () => {
    expect(paymentMethodLabel("manual")).toBe("გადარიცხვა");
    expect(paymentMethodLabel("future_gateway")).toBe("future_gateway");
  });
});

describe("buildReferralUrl", () => {
  it("joins origin + /join?ref=, stripping trailing slashes and encoding the code", () => {
    expect(buildReferralUrl("https://republic-portal.vercel.app", "D00101")).toBe(
      "https://republic-portal.vercel.app/join?ref=D00101",
    );
    expect(buildReferralUrl("http://localhost:3000/", "AB2C3D")).toBe(
      "http://localhost:3000/join?ref=AB2C3D",
    );
  });
});
```

- [ ] **Step 2: Extend `lib/funnel.test.ts`** — update the `state()` fixture for the two new fields and add coverage for the derived regex + new error tokens. In `lib/funnel.test.ts`, add to the fixture object literal (after `completed: false,`):

```ts
    status: "draft",
    registrationCompletedAt: null,
    createdAt: "2026-07-01T00:00:00Z",
```

and append these tests at the end of the file:

```ts
describe("isReferenceCode — derived from FUNNEL_CODE_ALPHABET (Phase 3 hygiene)", () => {
  it("accepts exactly the Phase 2 fixtures", () => {
    expect(isReferenceCode("GR-APQ694")).toBe(true);
    expect(isReferenceCode("GR-7K3M9Q")).toBe(true);
  });
  it("rejects excluded characters I/L/O/0/1, lowercase, wrong length", () => {
    for (const bad of ["GR-AAAAI2", "GR-AAAAL2", "GR-AAAAO2", "GR-AAAA02", "GR-AAAA12"]) {
      expect(isReferenceCode(bad)).toBe(false);
    }
    expect(isReferenceCode("gr-apq694")).toBe(false);
    expect(isReferenceCode("GR-APQ69")).toBe(false);
    expect(isReferenceCode("GR-APQ6944")).toBe(false);
  });
});

describe("mapFunnelError — Phase 3 tokens", () => {
  it("maps the cabinet RPC tokens to Georgian", () => {
    expect(mapFunnelError("not_completed")).toBe("ჯერ დაასრულე რეგისტრაცია.");
    expect(mapFunnelError('P0001: not_a_member')).toBe("ეს მოქმედება მხოლოდ წევრებისთვისაა.");
    expect(mapFunnelError("not_a_delegate")).toBe(
      "დელეგატის პანელი მხოლოდ დელეგატებისთვისაა.",
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/cabinet.test.ts lib/funnel.test.ts`
Expected: FAIL — `lib/cabinet.ts` does not exist; funnel fixture type error (`status` missing on `FunnelState`) and the new `mapFunnelError` cases return the generic message.

- [ ] **Step 4: Modify `lib/funnel.ts`**

Three edits:

(a) After the `FunnelChosenDelegate` interface, add:

```ts
/** profiles.status values a signed-in client can ever see for itself. */
export type MemberStatus = "draft" | "profile_completed" | "active_member";
```

(b) In `interface FunnelState`, after `completed: boolean;` add:

```ts
  status: MemberStatus;
  registrationCompletedAt: string | null; // ISO timestamptz; null on legacy pre-Phase-2 rows
  createdAt: string; // profile creation — member-since fallback for legacy rows (spec §3.3)
```

(c) Replace the hardcoded regex line

```ts
const REFERENCE_CODE_RE = /^GR-[A-HJKMNP-Z2-9]{6}$/;
```

with the derived version (hygiene queue item — the alphabet is 31 literal alphanumerics, safe inside a character class unescaped):

```ts
const REFERENCE_CODE_RE = new RegExp(`^GR-[${FUNNEL_CODE_ALPHABET}]{6}$`);
```

(d) In `ERROR_MESSAGES`, after the `not_authenticated` entry, add:

```ts
  not_completed: "ჯერ დაასრულე რეგისტრაცია.",
  not_a_member: "ეს მოქმედება მხოლოდ წევრებისთვისაა.",
  not_a_delegate: "დელეგატის პანელი მხოლოდ დელეგატებისთვისაა.",
```

(Token-collision note for the reviewer: `mapFunnelError` matches by `message.includes(token)`; none of the three new tokens is a substring of any existing token or vice versa.)

- [ ] **Step 5: Create `lib/cabinet.ts`**

```ts
import { EMPLOYMENT_PRESETS } from "./funnel-schemas";
import { deriveFunnelStep, funnelRoute, type FunnelState } from "./funnel";

/**
 * Post-login / guard destination (spec §3.2): cabinet for completed users,
 * funnel otherwise. Legacy rows are first-class exactly like deriveFunnelStep —
 * funnel_state() already folds `status = 'active_member'` into `completed`.
 */
export function deriveDestination(state: FunnelState | null): string {
  if (!state || !state.exists) return "/join";
  if (!state.completed) return funnelRoute(deriveFunnelStep(state));
  return state.role === "delegate" ? "/delegate" : "/me/profile";
}

/** Cabinet navigation (spec §3.1): delegates have no membership → no „ჩემი დელეგატი“. */
export interface CabinetNavItem {
  href: string;
  label: string;
}

export function cabinetNavItems(role: "member" | "delegate"): CabinetNavItem[] {
  if (role === "delegate") {
    return [
      { href: "/me/profile", label: "პროფილი" },
      { href: "/me/billing", label: "გადახდები" },
      { href: "/delegate", label: "დელეგატის პანელი" },
    ];
  }
  return [
    { href: "/me/profile", label: "პროფილი" },
    { href: "/me/delegate", label: "ჩემი დელეგატი" },
    { href: "/me/billing", label: "გადახდები" },
  ];
}

/** Select value for the employment „სხვა (მიუთითე)“ branch (never a stored value). */
export const EMPLOYMENT_OTHER = "__other";

export interface EmploymentFormValue {
  choice: string; // one of EMPLOYMENT_PRESETS, or EMPLOYMENT_OTHER
  custom: string;
}

export function employmentToForm(stored: string | null): EmploymentFormValue {
  if (stored !== null && (EMPLOYMENT_PRESETS as readonly string[]).includes(stored)) {
    return { choice: stored, custom: "" };
  }
  return { choice: EMPLOYMENT_OTHER, custom: stored ?? "" };
}

export function formToEmployment(value: EmploymentFormValue): string {
  return value.choice === EMPLOYMENT_OTHER ? value.custom.trim() : value.choice;
}

/**
 * „წევრი — 2026 წლის თებერვლიდან“: -დან month forms, hand-coded because Georgian
 * syncope (იანვარი→იანვრიდან, თებერვალი→თებერვლიდან) is irregular — same lesson
 * as Phase 1's region genitives.
 */
const MONTHS_FROM_KA = [
  "იანვრიდან",
  "თებერვლიდან",
  "მარტიდან",
  "აპრილიდან",
  "მაისიდან",
  "ივნისიდან",
  "ივლისიდან",
  "აგვისტოდან",
  "სექტემბრიდან",
  "ოქტომბრიდან",
  "ნოემბრიდან",
  "დეკემბრიდან",
] as const;

export function memberSinceKa(isoTimestamp: string | null): string | null {
  if (!isoTimestamp) return null;
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return null;
  const month = MONTHS_FROM_KA[d.getUTCMonth()];
  if (!month) return null;
  return `${d.getUTCFullYear()} წლის ${month}`;
}

/** "+9955XXXXXXXX" / "9955XXXXXXXX" → "+995 5XX XX XX XX" (prototype spacing). */
export function formatPhoneKa(phone: string | null | undefined): string {
  if (!phone) return "—";
  const m = /^\+?995(5\d{8})$/.exec(phone.replace(/\s/g, ""));
  if (!m) return phone;
  const n = m[1]!; // regex group 1 always present on match
  return `+995 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
}

/** Deterministic dd.mm.yyyy — Node/browser ICU disagreements broke ka-GE once already. */
export function formatDateKa(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getUTCFullYear()}`;
}

export function initialsKa(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`;
}

/** Mirrors the delegate_panel() RPC jsonb exactly (spec §4.4). */
export interface DelegatePanelData {
  status: "pending" | "approved" | "rejected";
  referralCode: string;
  activeCount: number;
  totalCount: number;
  draftCount: number;
}

export type TeamMemberStatus = "profile_completed" | "active_member";

/** Mirrors one delegate_team() RPC array element (spec §4.5). */
export interface TeamMember {
  firstName: string;
  lastName: string;
  registeredAt: string;
  status: TeamMemberStatus;
}

/** Team-table / summary-pill vocabulary (spec §3.3, §3.7); rendered via Pill's label override. */
export const TEAM_STATUS_LABELS: Record<TeamMemberStatus, string> = {
  profile_completed: "რეგისტრირებული",
  active_member: "აქტიური",
};

export function paymentMethodLabel(source: string): string {
  return source === "manual" ? "გადარიცხვა" : source;
}

export function buildReferralUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/join?ref=${encodeURIComponent(code)}`;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/cabinet.test.ts lib/funnel.test.ts`
Expected: PASS (all new tests + all existing funnel tests).

- [ ] **Step 7: Full unit suite + typecheck** (the `FunnelState` widening must not break any other consumer — `useFunnelGuard`, login, JoinChoice, actions all only *read* fields)

Run: `npm run test && npm run typecheck`
Expected: PASS. If typecheck flags a `FunnelState` object literal somewhere else, that literal needs the two new fields — fix it there, never by widening the type with optionals.

- [ ] **Step 8: Format + commit**

```bash
npm run format
git add lib/cabinet.ts lib/cabinet.test.ts lib/funnel.ts lib/funnel.test.ts
git commit -m "feat: cabinet domain logic — destination routing, employment mapping, labels"
```

---

### Task 2: Cabinet zod schemas (`lib/cabinet-schemas.ts`)

**Files:**
- Create: `lib/cabinet-schemas.ts`
- Create: `lib/cabinet-schemas.test.ts`
- Modify: `lib/funnel-schemas.ts` (export two building blocks; zero behavior change)

**Interfaces:**
- Consumes: `nameSchema`, `employmentSchema` (newly exported from `lib/funnel-schemas.ts`).
- Produces (consumed by Tasks 6–9):
  - `profileUpdateSchema` — parses `{ firstName: string, lastName: string, regionId: number, cityId: number, employment: string }`
  - `changeDelegateSchema` — parses `{ delegateId: string(uuid) | null }`
  - (tier changes reuse the existing `tierSchema` from `lib/funnel-schemas.ts` — do NOT duplicate it)

- [ ] **Step 1: Write the failing test — `lib/cabinet-schemas.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { changeDelegateSchema, profileUpdateSchema } from "./cabinet-schemas";

const valid = {
  firstName: "ნინო",
  lastName: "ბერიძე",
  regionId: 1,
  cityId: 3,
  employment: "სტუდენტი",
};

describe("profileUpdateSchema", () => {
  it("accepts a full valid update and trims names/employment", () => {
    const parsed = profileUpdateSchema.parse({
      ...valid,
      firstName: " ნინო ",
      employment: " მეწარმე ",
    });
    expect(parsed.firstName).toBe("ნინო");
    expect(parsed.employment).toBe("მეწარმე");
  });
  it("rejects empty / too-long names with the funnel's Georgian messages", () => {
    expect(profileUpdateSchema.safeParse({ ...valid, firstName: "  " }).success).toBe(false);
    const long = profileUpdateSchema.safeParse({ ...valid, lastName: "ა".repeat(61) });
    expect(long.success).toBe(false);
    if (!long.success) expect(long.error.issues[0]?.message).toBe("მაქსიმუმ 60 სიმბოლო");
  });
  it("rejects missing/non-positive region or city ids", () => {
    expect(profileUpdateSchema.safeParse({ ...valid, regionId: 0 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...valid, cityId: -1 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...valid, cityId: 1.5 }).success).toBe(false);
  });
  it("rejects empty or >100-char employment", () => {
    expect(profileUpdateSchema.safeParse({ ...valid, employment: " " }).success).toBe(false);
    expect(
      profileUpdateSchema.safeParse({ ...valid, employment: "ა".repeat(101) }).success,
    ).toBe(false);
  });
});

describe("changeDelegateSchema", () => {
  it("accepts a uuid and null (null = ცენტრალური მოძრაობა)", () => {
    expect(
      changeDelegateSchema.safeParse({ delegateId: "6f9619ff-8b86-d011-b42d-00c04fc964ff" })
        .success,
    ).toBe(true);
    expect(changeDelegateSchema.safeParse({ delegateId: null }).success).toBe(true);
  });
  it("rejects non-uuid strings and undefined", () => {
    const bad = changeDelegateSchema.safeParse({ delegateId: "not-a-uuid" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0]?.message).toBe("არასწორი დელეგატი");
    expect(changeDelegateSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/cabinet-schemas.test.ts`
Expected: FAIL — module `./cabinet-schemas` not found.

- [ ] **Step 3: Export the building blocks from `lib/funnel-schemas.ts`**

Two mechanical edits (no behavior change, existing tests stay green):

(a) `const nameSchema = z` → `export const nameSchema = z`

(b) Extract the employment rule out of `profileBase` into an exported const directly above it, and reference it:

```ts
export const employmentSchema = z
  .string()
  .trim()
  .min(1, { message: "მიუთითე საქმიანობა." })
  .max(100, { message: "მაქსიმუმ 100 სიმბოლო" });
```

and inside `profileBase` replace the inline employment schema with:

```ts
  employment: employmentSchema,
```

- [ ] **Step 4: Create `lib/cabinet-schemas.ts`**

```ts
import { z } from "zod";
import { employmentSchema, nameSchema } from "./funnel-schemas";

/**
 * Cabinet profile edit (spec §3.3): exactly the five re-granted columns.
 * Region+city are always submitted together — the composite FK enforces the
 * pairing in-DB whenever both are set (ADR-009 note).
 */
export const profileUpdateSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  regionId: z.number().int().positive({ message: "აირჩიე მხარე." }),
  cityId: z.number().int().positive({ message: "აირჩიე ქალაქი." }),
  employment: employmentSchema,
});

/** Change delegate (spec §4.2): null = ცენტრალური მოძრაობა. */
export const changeDelegateSchema = z.object({
  delegateId: z.string().uuid({ message: "არასწორი დელეგატი" }).nullable(),
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/cabinet-schemas.test.ts lib/funnel-schemas.test.ts`
Expected: PASS — new suite green, existing funnel-schemas suite untouched and green.

- [ ] **Step 6: Format + commit**

```bash
npm run format
git add lib/cabinet-schemas.ts lib/cabinet-schemas.test.ts lib/funnel-schemas.ts
git commit -m "feat: cabinet zod schemas (profile update, change delegate)"
```

---

### Task 3: Typed `Database` generic for the Supabase client factories (hygiene queue)

**Files:**
- Create: `lib/supabase/types.ts`
- Modify: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/public.ts`, `lib/supabase/middleware.ts`
- Modify: `app/(public)/login/page.tsx`, `app/(public)/join/useFunnelGuard.ts`, `app/(public)/join/JoinChoice.tsx`, `app/(public)/join/actions.ts` (RPC result casts only)

**Interfaces:**
- Produces: `Database` and `Json` types from `lib/supabase/types.ts`; every factory returns a typed client. RPC `data` is now `Json`, so domain casts become `as unknown as FunnelState` (established pattern for later tasks: RPC jsonb → `as unknown as <lib type>`).
- The typecheck run is the failing test for this task: adding the generic surfaces every unsound cast; the task is done when `npm run typecheck` is green again.

- [ ] **Step 1: Create `lib/supabase/types.ts`**

```ts
/**
 * Hand-maintained Database definitions (ADR-005: staging is the only database,
 * no local Docker — so no `supabase gen types`). Source of truth:
 * supabase/migrations/*. Update this file in the same commit as any migration.
 * Only columns/functions app code touches are listed; additive DB drift is
 * harmless at runtime. Insert/Update are `never` where no typed-client code
 * path writes the table — RPCs, SQL and untyped script clients do instead.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberStatusRow = "draft" | "profile_completed" | "active_member";
export type DelegateStatusRow = "pending" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          personal_id: string | null;
          birth_date: string | null;
          region_id: number | null;
          city_id: number | null;
          employment: string | null;
          status: MemberStatusRow;
          signup_role: "member" | "delegate";
          signup_ref_code: string | null;
          membership_tier: number | null;
          reference_code: string | null;
          registration_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        // Type-level mirror of the Phase 3 column-scoped UPDATE grant (spec §4.1).
        Update: {
          first_name?: string;
          last_name?: string;
          region_id?: number;
          city_id?: number;
          employment?: string;
        };
      };
      delegates: {
        Row: {
          id: string;
          status: DelegateStatusRow;
          referral_code: string;
          slug: string | null;
          bio: string | null;
          photo_url: string | null;
          tc_accepted_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: never;
        Update: never;
      };
      memberships: {
        Row: {
          id: number;
          member_id: string;
          delegate_id: string | null;
          started_at: string;
          ended_at: string | null;
        };
        Insert: never;
        Update: never;
      };
      payments: {
        Row: {
          id: number;
          member_id: string;
          amount_gel: number;
          paid_at: string;
          bank_reference: string | null;
          source: string;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      regions: {
        Row: { id: number; name_ka: string };
        Insert: never;
        Update: never;
      };
      cities: {
        Row: { id: number; region_id: number; name_ka: string };
        Insert: never;
        Update: never;
      };
      dev_otp_inbox: {
        Row: { id: number; phone: string; otp: string; created_at: string };
        Insert: never;
        Update: never;
      };
    };
    Views: {
      public_delegates: {
        Row: {
          id: string;
          slug: string | null;
          first_name: string;
          last_name: string;
          region_id: number | null;
          region_name_ka: string | null;
          bio: string | null;
          photo_url: string | null;
          active_supporters: number;
        };
      };
      public_stats: {
        Row: { approved_delegates: number; active_members: number };
      };
    };
    Functions: {
      funnel_state: { Args: Record<PropertyKey, never>; Returns: Json };
      funnel_start: {
        Args: {
          p_first_name: string;
          p_last_name: string;
          p_role: string;
          p_ref_code: string | null;
        };
        Returns: Json;
      };
      funnel_save_profile: {
        Args: {
          p_personal_id: string;
          p_birth_date: string;
          p_region_id: number;
          p_city_id: number;
          p_employment: string;
          p_delegate_id: string | null;
          p_tc_accepted: boolean;
        };
        Returns: Json;
      };
      funnel_complete: { Args: { p_tier: number }; Returns: Json };
      member_change_delegate: { Args: { p_delegate_id: string | null }; Returns: Json };
      member_change_tier: { Args: { p_tier: number }; Returns: Json };
      delegate_panel: { Args: Record<PropertyKey, never>; Returns: Json };
      delegate_team: { Args: Record<PropertyKey, never>; Returns: Json };
    };
    Enums: {
      member_status: MemberStatusRow;
      delegate_status: DelegateStatusRow;
    };
    CompositeTypes: Record<string, never>;
  };
}
```

- [ ] **Step 2: Add the generic to all five factories**

`lib/supabase/client.ts` — add import + generic:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`lib/supabase/server.ts` — `import type { Database } from "./types";` and `createServerClient(` → `createServerClient<Database>(`.

`lib/supabase/admin.ts` — `import type { Database } from "./types";` and `createSupabaseClient(` → `createSupabaseClient<Database>(`.

`lib/supabase/public.ts` — `import type { Database } from "./types";` and `createClient(` → `createClient<Database>(` inside `publicClient()`. The existing `.returns<PublicDelegate[]>()` / `.single<PublicStats>()` overrides stay (they narrow view rows to the lib interfaces).

`lib/supabase/middleware.ts` — same treatment for its `createServerClient` call: add the import and the `<Database>` generic. Change nothing else in the file.

- [ ] **Step 3: Run typecheck to surface the now-unsound casts (the failing check)**

Run: `npm run typecheck`
Expected: FAIL with ~6 errors of the shape `Conversion of type 'Json' to type 'FunnelState' may be a mistake` at:
- `app/(public)/login/page.tsx` (1× `data as FunnelState`)
- `app/(public)/join/useFunnelGuard.ts` (1× `data as FunnelState`)
- `app/(public)/join/JoinChoice.tsx` (1× `data as FunnelState`)
- `app/(public)/join/actions.ts` (3× `data as FunnelState`)

If other errors appear (e.g. a select on a column missing from `types.ts`), the type file has drift — fix `types.ts` against the migrations, never the call site.

- [ ] **Step 4: Fix the six casts**

In each of the four files, change every `data as FunnelState` to:

```ts
data as unknown as FunnelState
```

(`FunnelState` mirrors the RPC's jsonb by construction; `unknown` is the honest bridge from `Json`.)

- [ ] **Step 5: Verify green**

Run: `npm run typecheck && npm run test`
Expected: PASS (typecheck clean; all unit suites green — no runtime behavior changed).

- [ ] **Step 6: Format + commit**

```bash
npm run format
git add lib/supabase/ "app/(public)/login/page.tsx" "app/(public)/join/useFunnelGuard.ts" "app/(public)/join/JoinChoice.tsx" "app/(public)/join/actions.ts"
git commit -m "feat: typed Database generic for all supabase client factories"
```

---

### Task 4: Migration — scoped re-grant, cabinet RPCs, riders (+ apply to staging)

**Files:**
- Create: `supabase/migrations/20260715213000_cabinets.sql`
- Modify: `scripts/verify-schema.mjs` (flip one Phase 2 probe; append the Phase 3 probe block)
- Modify: `DECISIONS.md` (append ADR-013 — text below; DECISIONS.md is append-only)

**Interfaces:**
- Consumes: Phase 2 objects — `funnel_state()`, `funnel_start()`, `gen_funnel_code()`, `protect_profile_columns()` trigger, `one_active_membership` unique index.
- Produces (consumed by Tasks 6–12):
  - Column-scoped `UPDATE (first_name, last_name, region_id, city_id, employment)` grant on `profiles` for `authenticated`.
  - `member_change_delegate(p_delegate_id uuid default null) returns jsonb` — errors: `not_authenticated`, `not_completed`, `not_a_member`, `invalid_delegate`.
  - `member_change_tier(p_tier int) returns jsonb` — errors: `not_authenticated`, `not_completed`, `invalid_tier`.
  - `delegate_panel() returns jsonb` — `{status, referralCode, activeCount, totalCount, draftCount}`; error `not_a_delegate`.
  - `delegate_team() returns jsonb` — array of `{firstName, lastName, registeredAt, status}`; error `not_a_delegate`.
  - `funnel_state()` additionally returns `status` and `registrationCompletedAt` (additive).
  - `funnel_start()` silently nulls referral inputs not matching `^[A-Za-z0-9-]{1,32}$`.

- [ ] **Step 1: Write the failing probes first — `scripts/verify-schema.mjs`**

Two edits. **(a)** Replace the Phase 2 direct-update probe (currently asserting the UPDATE grant is fully revoked):

```js
    const { error: directErr } = await authed
      .from("profiles")
      .update({ first_name: "შეცვლილი" })
      .eq("id", fpId);
    if (!directErr)
      throw new Error("LEAK: authenticated can still UPDATE profiles directly (grant not revoked)");
    console.log("OK: direct authenticated profiles UPDATE denied");
```

with the Phase 3 scoped-grant probes (allowed column succeeds; protected column dies at the **column grant** with 42501 — the column list is the first lock, so the trigger never even sees it; the trigger remains depth against future grant-widening):

```js
    // Phase 3 (spec §4.1): the scoped re-grant. An allowed column writes; a
    // server-managed column is refused at the column-privilege level (42501) —
    // the protect_profile_columns() trigger stays behind it as defense-in-depth.
    const { error: scopedOkErr } = await authed
      .from("profiles")
      .update({ first_name: "შეცვლილი" })
      .eq("id", fpId);
    if (scopedOkErr)
      throw new Error(`scoped profiles UPDATE (allowed column) failed: ${scopedOkErr.message}`);
    const { error: protectedErr } = await authed
      .from("profiles")
      .update({ reference_code: "GR-AAAAAA" })
      .eq("id", fpId);
    if (!protectedErr)
      throw new Error("LEAK: authenticated changed a server-managed profile column");
    if (protectedErr.code !== "42501")
      throw new Error(
        `protected-column probe: expected 42501, got ${protectedErr.code} (${protectedErr.message})`,
      );
    console.log("OK: profiles UPDATE column-scoped (allowed column writes, protected column 42501)");
```

Note: `reference_code` is not in the typed `Update` shape — this probe file is plain JS (`.mjs`), so it can express the attack; that is exactly why it lives here and not in app code.

**(b)** Append the cabinet-RPC probes directly after the line
`console.log(\`OK: funnel RPCs end-to-end (code ${c1.referenceCode}, idempotent complete)\`);`
(still inside the `try` — the `finally` cleanup below it must keep deleting the probe user):

```js
    // --- Phase 3: cabinet RPCs (spec §4.2–§4.5) ---
    const { data: approvedDelegate, error: apErr } = await db
      .from("delegates")
      .select("id")
      .eq("status", "approved")
      .order("id")
      .limit(1)
      .single();
    if (apErr) throw new Error(`no approved delegate for change probe: ${apErr.message}`);

    const countMemberships = async () => {
      const { count, error } = await db
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("member_id", fpId);
      if (error) throw new Error(`membership count failed: ${error.message}`);
      return count ?? 0;
    };

    const before = await countMemberships(); // funnel_save_profile opened one (central)
    const { error: cdErr } = await authed.rpc("member_change_delegate", {
      p_delegate_id: approvedDelegate.id,
    });
    if (cdErr) throw new Error(`member_change_delegate failed: ${cdErr.message}`);
    if ((await countMemberships()) !== before + 1)
      throw new Error("change_delegate must close-and-open (history row expected)");
    const { data: openRows, error: openErr } = await db
      .from("memberships")
      .select("delegate_id")
      .eq("member_id", fpId)
      .is("ended_at", null);
    if (openErr) throw new Error(openErr.message);
    if (openRows.length !== 1 || openRows[0].delegate_id !== approvedDelegate.id)
      throw new Error("exactly one open membership pointing at the new delegate expected");

    const { error: noopErr } = await authed.rpc("member_change_delegate", {
      p_delegate_id: approvedDelegate.id,
    });
    if (noopErr) throw new Error(`same-delegate no-op errored: ${noopErr.message}`);
    if ((await countMemberships()) !== before + 1)
      throw new Error("same-delegate call must not mint a history row");

    const { data: tierState, error: tierErr } = await authed.rpc("member_change_tier", {
      p_tier: 5,
    });
    if (tierErr) throw new Error(`member_change_tier failed: ${tierErr.message}`);
    if (tierState.tier !== 5) throw new Error(`tier should be 5, got ${tierState.tier}`);
    if (tierState.referenceCode !== c1.referenceCode)
      throw new Error("tier change must never touch the reference code");
    if (tierState.status !== "profile_completed" || typeof tierState.registrationCompletedAt !== "string")
      throw new Error("funnel_state must expose status + registrationCompletedAt (spec §4.6)");

    const { error: notDelegateErr } = await authed.rpc("delegate_panel");
    if (!notDelegateErr || !notDelegateErr.message.includes("not_a_delegate"))
      throw new Error("delegate_panel must refuse a non-delegate caller");
    const { error: teamGateErr } = await authed.rpc("delegate_team");
    if (!teamGateErr || !teamGateErr.message.includes("not_a_delegate"))
      throw new Error("delegate_team must refuse a non-delegate caller");

    const { error: anonRpcErr } = await anon.rpc("member_change_delegate", {
      p_delegate_id: null,
    });
    if (!anonRpcErr) throw new Error("LEAK: anon can execute member_change_delegate");

    // referral-cap rider (spec §4.6): oversized ref must be silently nulled, not error
    const { data: capState, error: capErr } = await authed.rpc("funnel_start", {
      p_first_name: "პრობა",
      p_last_name: "პრობიშვილი",
      p_role: "member",
      p_ref_code: "x".repeat(64),
    });
    if (capErr) throw new Error(`funnel_start with oversized ref must not error: ${capErr.message}`);
    if (capState.referral !== null)
      throw new Error("oversized referral input must resolve to null referral");
    console.log("OK: cabinet RPCs — history-keeping change, no-op guard, tier change, gates, ref cap");
```

Also update the script's **final success log line** (last statement of the file): replace the phrase `client profiles UPDATE revoked` with `profiles UPDATE column-scoped`, and in the big explanatory comment above the probe block replace the sentence about "(b) a created_at write is denied the same way; the trigger-message assertion returns when Phase 3 re-grants scoped updates" with: `(b) a server-managed column write is denied at the column grant (42501); the protect trigger stays behind it as depth`.

- [ ] **Step 2: Run the probes to verify they fail (functions don't exist yet)**

Run: `node --env-file=.env.local scripts/verify-schema.mjs`
Expected: FAIL at the scoped-update probe (`scoped profiles UPDATE (allowed column) failed: permission denied for table profiles` — grant not yet applied). This is the red state.

- [ ] **Step 3: Write the migration — `supabase/migrations/20260715213000_cabinets.sql`**

```sql
-- Phase 3: cabinets. Spec: docs/superpowers/specs/2026-07-15-phase-3-cabinets-design.md
-- Mixed access model (ADR-013): column-scoped grant for plain profile fields;
-- SECURITY DEFINER RPCs for compound/protected mutations and delegate reads.

-- 1) Scoped profile re-grant (spec §4.1) --------------------------------------
-- Three independent locks: this column list (anything else is 42501), the
-- Phase-0 "own profile updatable" RLS policy (kept dormant by Phase 2 exactly
-- for this), and protect_profile_columns() as depth against grant-widening.
-- No insert/delete grants — profile creation stays funnel-only.
grant update (first_name, last_name, region_id, city_id, employment)
  on profiles to authenticated;

-- 2) funnel_state(): + status, registrationCompletedAt (additive; spec §4.6) --
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
    -- Phase 3 (spec §4.6): cabinet needs the raw status + timestamps
    'status', v_profile.status::text,
    'registrationCompletedAt', v_profile.registration_completed_at,
    'createdAt', v_profile.created_at,
    'delegateStatus', case when v_has_delegate then v_delegate.status::text end,
    'referral', v_referral,
    'chosenDelegate', v_chosen,
    'membershipExists', coalesce(v_membership_exists, false)
  );
end $$;

-- 3) funnel_start(): p_ref_code cap rider (spec §4.6) --------------------------
-- Identical to Phase 2 except referral input is charset/length-checked and
-- silently nulled when invalid (matching invalid-referral-degrades-silently).
create or replace function funnel_start(
  p_first_name text,
  p_last_name text,
  p_role text,
  p_ref_code text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_status public.member_status;
  v_completed timestamptz;
  v_ref text := nullif(btrim(coalesce(p_ref_code, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_role is null or p_role not in ('member', 'delegate') then
    raise exception 'invalid_role';
  end if;
  if p_first_name is null or length(btrim(p_first_name)) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name)) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  -- Phase 3 rider (spec §4.6): mirrors lib isReferralCodeCandidate
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9-]{1,32}$' then
    v_ref := null;
  end if;

  select status, registration_completed_at into v_status, v_completed
    from public.profiles where id = v_uid;

  if not found then
    -- canonical phone format is E.164 with '+'; Supabase auth stores it without
    select case
             when u.phone is null then null
             when left(u.phone, 1) = '+' then u.phone
             else '+' || u.phone
           end
      into v_phone
      from auth.users u where u.id = v_uid;
    insert into public.profiles
      (id, first_name, last_name, phone, status, signup_role, signup_ref_code)
    values (
      v_uid, btrim(p_first_name), btrim(p_last_name), v_phone, 'draft', p_role,
      case when p_role = 'member' then v_ref end
    );
  elsif v_completed is null and v_status <> 'active_member' then
    update public.profiles set
      first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      -- path + referral only change while nothing role-specific exists yet (spec §4.3)
      signup_role = case when status = 'draft' then p_role else signup_role end,
      signup_ref_code = case
        when status <> 'draft' then signup_ref_code
        when p_role = 'delegate' then null
        else coalesce(v_ref, signup_ref_code)
      end
    where id = v_uid;
  end if;
  -- completed profiles: no-op; state below routes them onward

  return public.funnel_state();
end $$;

-- 4) member_change_delegate (spec §4.2) ----------------------------------------
create function member_change_delegate(p_delegate_id uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_target uuid;
  v_open_delegate uuid;
  v_has_open boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'not_completed'; end if;
  if v_profile.registration_completed_at is null
     and v_profile.status <> 'active_member' then
    raise exception 'not_completed';
  end if;
  if exists (select 1 from public.delegates d where d.id = v_uid) then
    raise exception 'not_a_member'; -- delegates hold no membership (spec §3.1)
  end if;

  v_target := null;
  if p_delegate_id is not null then
    select d.id into v_target from public.delegates d
      where d.id = p_delegate_id and d.status = 'approved';
    if v_target is null then raise exception 'invalid_delegate'; end if;
  end if;

  select m.delegate_id, true into v_open_delegate, v_has_open
    from public.memberships m
    where m.member_id = v_uid and m.ended_at is null;

  if not coalesce(v_has_open, false) then
    insert into public.memberships (member_id, delegate_id) values (v_uid, v_target);
  elsif v_open_delegate is distinct from v_target then
    -- close-then-open, same pattern as funnel_save_profile: history never deleted
    update public.memberships set ended_at = now()
      where member_id = v_uid and ended_at is null;
    insert into public.memberships (member_id, delegate_id) values (v_uid, v_target);
  end if; -- same target: no-op, no history row minted (spec §4.2)

  return public.funnel_state();
end $$;

-- 5) member_change_tier (spec §4.3) ----------------------------------------------
-- Members AND delegates (both pay). Definer context passes the protect trigger,
-- exactly like funnel_complete. Reference code and completion stamp untouched.
create function member_change_tier(p_tier int) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'not_completed'; end if;
  if v_profile.registration_completed_at is null
     and v_profile.status <> 'active_member' then
    raise exception 'not_completed';
  end if;
  if p_tier is null or p_tier not in (5, 10, 20) then raise exception 'invalid_tier'; end if;

  update public.profiles set membership_tier = p_tier where id = v_uid;
  return public.funnel_state();
end $$;

-- 6) delegate_panel (spec §4.4) ---------------------------------------------------
-- The ONLY client path to the caller's own referral_code — no table grant, no
-- public view exposes it (Phase 2's non-harvestable stance holds).
create function delegate_panel() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_delegate from public.delegates where id = v_uid;
  if not found then raise exception 'not_a_delegate'; end if;

  return jsonb_build_object(
    'status', v_delegate.status::text,
    'referralCode', v_delegate.referral_code,
    'activeCount', (select count(*)
                      from public.memberships m
                      join public.profiles p on p.id = m.member_id
                      where m.delegate_id = v_uid and m.ended_at is null
                        and p.status = 'active_member'),
    'totalCount', (select count(*)
                     from public.memberships m
                     where m.delegate_id = v_uid and m.ended_at is null),
    -- opened the link, started step 1, not yet reached step 2; from step 2 on
    -- they appear in the membership counts instead — no double counting
    'draftCount', (select count(*)
                     from public.profiles p
                     where p.signup_ref_code = v_delegate.referral_code
                       and p.status = 'draft')
  );
end $$;

-- 7) delegate_team (spec §4.5) ------------------------------------------------------
-- Names, dates, statuses only — no phones, no personal IDs, no tiers, no money.
create function delegate_team() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_team jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.delegates d where d.id = v_uid) then
    raise exception 'not_a_delegate';
  end if;

  select coalesce(
      jsonb_agg(jsonb_build_object(
        'firstName', p.first_name,
        'lastName', p.last_name,
        'registeredAt', p.created_at,
        'status', p.status::text
      ) order by p.created_at desc),
      '[]'::jsonb)
    into v_team
    from public.memberships m
    join public.profiles p on p.id = m.member_id
    where m.delegate_id = v_uid and m.ended_at is null;

  return v_team;
end $$;

-- 8) Grants (house pattern: authenticated only; Postgres grants new functions
-- to PUBLIC by default, so the explicit revoke matters) -------------------------
grant execute on function member_change_delegate(uuid) to authenticated;
revoke execute on function member_change_delegate(uuid) from public, anon;
grant execute on function member_change_tier(int) to authenticated;
revoke execute on function member_change_tier(int) from public, anon;
grant execute on function delegate_panel() to authenticated;
revoke execute on function delegate_panel() from public, anon;
grant execute on function delegate_team() to authenticated;
revoke execute on function delegate_team() from public, anon;
-- funnel_state / funnel_start were CREATE OR REPLACEd: existing grants survive
-- replacement (Postgres preserves ACLs on replace), so no re-grant needed.
```

- [ ] **Step 4: Append ADR-013 to `DECISIONS.md`**

```markdown
## ADR-013 (2026-07-15): Cabinet DB access is a mixed model — scoped grant + definer RPCs

Phase 2 revoked the blanket client `update` on profiles and kept the "own profile
updatable" RLS policy dormant for exactly this phase. Phase 3 re-grants `UPDATE`
on precisely (first_name, last_name, region_id, city_id, employment): three
independent locks — the column-scoped grant (any other column is 42501), the
own-row RLS policy, and the protect_profile_columns() trigger as depth against
future grant-widening. Everything compound or protected stays SECURITY DEFINER
RPCs per ADR-009: member_change_delegate (atomic close-then-open membership
history), member_change_tier (trigger-protected column), delegate_panel /
delegate_team (own-delegates-row-gated reads; referral codes stay out of every
table grant and public view). Rejected: all-RPC uniformity (wastes the prepared
RLS path and adds definer surface for single-column own-row writes) and
client-direct membership writes (close/open is not atomic from the client).
```

- [ ] **Step 5: Apply to staging via the pooler host**

The password already sits in `.env.local` (line `SUPABASE_DB_PASSWORD=…`, left over from Phase 2 by owner's choice — do not comment on it). The direct db host does not resolve on this network; use the **pooler**:

```bash
export SUPABASE_DB_PASSWORD="$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2-)"
npx supabase db push --db-url "postgresql://postgres.orcxtbedkexoclbfgvzd:${SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
```

Expected: `Applying migration 20260715213000_cabinets.sql... Finished supabase db push.`
If the variable is empty (owner removed the line), STOP and ask the owner in plain language to re-add `SUPABASE_DB_PASSWORD=<value>` to `.env.local` (never paste it in chat), then rerun. If the password contains URL-special characters (`@ : / ? # [ ] %`), percent-encode them in the URL.

- [ ] **Step 6: Run the probes to verify green**

Run: `node --env-file=.env.local scripts/verify-schema.mjs`
Expected: PASS — all existing probes plus `OK: profiles UPDATE column-scoped …` and `OK: cabinet RPCs — history-keeping change, no-op guard, tier change, gates, ref cap`, ending with the final summary line. The probe user is deleted in `finally` (its memberships cascade away; the seed's counters are untouched because the probe user is never `active_member`).

- [ ] **Step 7: Format + commit**

```bash
npm run format
git add supabase/migrations/20260715213000_cabinets.sql scripts/verify-schema.mjs DECISIONS.md
git commit -m "feat: cabinets migration — scoped profile re-grant, cabinet RPCs, ref-code cap (applied to staging)"
```

---

### Task 5: Shared components — CabinetNav, QrCode (`uqr` + ADR-011), CopyButton, moves

**Files:**
- Create: `components/CabinetNav.tsx`, `components/CabinetNav.test.tsx`
- Create: `components/QrCode.tsx`, `components/QrCode.test.tsx`
- Create: `components/CopyButton.tsx`, `components/CopyButton.test.tsx`
- Create: `components/PendingExplainer.tsx` (extracted from the pending page)
- Move: `app/(public)/join/TransferInstructions.tsx` → `components/TransferInstructions.tsx`
- Modify: `components/Pill.tsx` (optional `label` override), `components/design-system.test.tsx` (one new case)
- Modify: `app/(public)/join/done/page.tsx`, `app/(public)/join/pending/page.tsx` (import paths only in this task)
- Modify: `app/(public)/styleguide/samples.tsx`, `DESIGN.md`, `DECISIONS.md` (ADR-011), `package.json` (+`uqr`)

**Interfaces:**
- Consumes: `CabinetNavItem` from `lib/cabinet.ts` (Task 1); `Button` from `components/Button.tsx`; `createClient` from `lib/supabase/client.ts`.
- Produces (consumed by Tasks 6–11):
  - `CabinetNav({ items: CabinetNavItem[] })` — client; active tab via `usePathname`, sign-out button („გასვლა“) doing `auth.signOut()` → `router.push("/")` + `router.refresh()`.
  - `QrCode({ value: string; label: string; size?: number })` — client; inline SVG via `uqr`'s `renderSVG`.
  - `CopyButton({ text: string })` — client; clipboard write, label flips to „დაკოპირდა ✓“ for 2 s.
  - `PendingExplainer()` — the three-row 🔗/🙈/✅ block, shared by `/join/pending` and the pending panel.
  - `TransferInstructions` — same props as today (`{ tier: Tier | null; referenceCode: string | null }`), now importable as `@/components/TransferInstructions`.
  - `Pill({ status, label? })` — `label` overrides the text; color mapping stays keyed by `status`.

- [ ] **Step 1: Write the failing tests**

`components/CabinetNav.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CabinetNav } from "./CabinetNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/me/profile",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } }),
}));

const ITEMS = [
  { href: "/me/profile", label: "პროფილი" },
  { href: "/me/delegate", label: "ჩემი დელეგატი" },
  { href: "/me/billing", label: "გადახდები" },
];

describe("CabinetNav", () => {
  it("renders all items and marks the current one", () => {
    render(<CabinetNav items={ITEMS} />);
    const active = screen.getByRole("link", { name: "პროფილი" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "გადახდები" })).not.toHaveAttribute("aria-current");
  });
  it("has a sign-out button", () => {
    render(<CabinetNav items={ITEMS} />);
    expect(screen.getByRole("button", { name: "გასვლა" })).toBeInTheDocument();
  });
});
```

`components/QrCode.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QrCode } from "./QrCode";

describe("QrCode", () => {
  it("renders an inline SVG for the value with an accessible label", () => {
    render(<QrCode value="https://example.org/join?ref=D00101" label="რეფერალური QR კოდი" />);
    const figure = screen.getByRole("img", { name: "რეფერალური QR კოდი" });
    expect(figure.innerHTML).toContain("<svg");
  });
});
```

`components/CopyButton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

describe("CopyButton", () => {
  it("copies the text and confirms in Georgian", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const user = userEvent.setup();
    render(<CopyButton text="https://example.org/join?ref=AB2C3D" />);
    await user.click(screen.getByRole("button", { name: "კოპირება" }));
    expect(writeText).toHaveBeenCalledWith("https://example.org/join?ref=AB2C3D");
    expect(await screen.findByRole("button", { name: "დაკოპირდა ✓" })).toBeInTheDocument();
  });
});
```

(If `@testing-library/user-event` is not in devDependencies, use `fireEvent.click` from `@testing-library/react` instead — check `package.json` first; do NOT add a dependency for this.)

In `components/design-system.test.tsx` add one case to the existing Pill coverage:

```tsx
  it("Pill label override keeps status colors but swaps text (Phase 3)", () => {
    render(<Pill status="profile_completed" label="რეგისტრირებული" />);
    expect(screen.getByText("რეგისტრირებული")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/CabinetNav.test.tsx components/QrCode.test.tsx components/CopyButton.test.tsx components/design-system.test.tsx`
Expected: FAIL — modules missing; Pill has no `label` prop (TS error).

- [ ] **Step 3: Install `uqr` and record ADR-011**

```bash
npm install uqr
```

Expected: `package.json` gains `"uqr": "^0.1.3"` under dependencies (zero transitive deps — `npm ls uqr` shows a leaf).

Append to `DECISIONS.md`:

```markdown
## ADR-011 (2026-07-15): QR codes via `uqr` (first new dependency since zod)

The delegate panel needs a QR of the referral link (parent spec §6). Writing a
QR encoder is wheel-reinvention with real failure modes; `uqr` (MIT, unjs) is
zero-dependency, TypeScript-native ESM with a pure `renderSVG(value): string` —
no canvas, no DOM, works identically in jsdom tests and the browser. Rejected:
`qrcode` (drags pngjs/dijkstrajs and server-canvas paths we don't need),
`qrcode-generator` (venerable but untyped UMD-global style). Rendered client-side
so the encoded origin is the one the delegate is actually on
(window.location.origin — previews encode the preview URL, production the real one).
```

- [ ] **Step 4: Implement the components**

`components/QrCode.tsx`:

```tsx
"use client";

import { renderSVG } from "uqr";

/**
 * QR of a URL as inline SVG. The markup comes from uqr (pure, zero-dep —
 * ADR-011) applied to our own value, never to user input, so inlining is safe.
 */
export function QrCode({
  value,
  label,
  size = 200,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const svg = renderSVG(value);
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size }}
      className="mx-auto overflow-hidden rounded-lg border border-line bg-white p-2 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
```

`components/CopyButton.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-secure context) — keep the neutral label
    }
  }

  return (
    <Button size="sm" onClick={copy}>
      {copied ? "დაკოპირდა ✓" : "კოპირება"}
    </Button>
  );
}
```

`components/CabinetNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CabinetNavItem } from "@/lib/cabinet";
import { createClient } from "@/lib/supabase/client";

export function CabinetNav({ items }: { items: CabinetNavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      aria-label="კაბინეტის ნავიგაცია"
      className="mb-8 flex flex-wrap items-center gap-1 border-b border-line pb-2"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              active ? "bg-brand/10 text-brand" : "text-muted-fg hover:text-ink"
            }`}
          >
            {item.label}
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
  );
}
```

`components/Pill.tsx` — change the function signature and the label line only:

```tsx
export function Pill({ status, label }: { status: Status; label?: string }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}>
      {label ?? config.label}
    </span>
  );
}
```

(Rename the module-level `config` map to `STATUS_CONFIG` to free the local name, or keep the map name and destructure differently — either is fine as long as behavior is identical and existing tests stay green.)

`components/PendingExplainer.tsx` — move the `POINTS` array and its rendering block verbatim out of `app/(public)/join/pending/page.tsx`:

```tsx
const POINTS: { icon: string; title: string; body: string }[] = [
  {
    icon: "🔗",
    title: "რეფერალური ბმული ჯერ დეაქტივირებულია.",
    body: "დამტკიცების შემდეგ პერსონალური ბმული გააქტიურდება და შეძლებ გუნდის აწყობას.",
  },
  {
    icon: "🙈",
    title: "პროფილი ჯერ არ არის საჯარო.",
    body: "დელეგატი არ ჩანს პორტალსა და რეიტინგში, სანამ მონაცემები არ დადასტურდება.",
  },
  {
    icon: "✅",
    title: "დამტკიცების შემდეგ.",
    body: "ბმული გააქტიურდება, პროფილი გახდება საჯარო და გამოჩნდები დელეგატების რეიტინგში.",
  },
];

export function PendingExplainer() {
  return (
    <div className="mt-6 flex flex-col gap-4">
      {POINTS.map((p) => (
        <div key={p.icon} className="flex items-start gap-3">
          <span className="text-lg" aria-hidden>
            {p.icon}
          </span>
          <div>
            <p className="text-sm font-bold text-ink">{p.title}</p>
            <p className="text-sm text-muted-fg">{p.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Then in `app/(public)/join/pending/page.tsx`: delete the local `POINTS` array, replace the `<div className="mt-6 flex flex-col gap-4">…</div>` block with `<PendingExplainer />`, and add `import { PendingExplainer } from "@/components/PendingExplainer";`.

Move the instructions block:

```bash
git mv "app/(public)/join/TransferInstructions.tsx" components/TransferInstructions.tsx
```

then in `app/(public)/join/done/page.tsx` and `app/(public)/join/pending/page.tsx` change
`import { TransferInstructions } from "../TransferInstructions";` →
`import { TransferInstructions } from "@/components/TransferInstructions";`

- [ ] **Step 5: Styleguide + DESIGN.md**

In `app/(public)/styleguide/samples.tsx`, append a Phase 3 section following the file's existing section pattern (a heading + sample blocks; match the local structure exactly — read the file first):

```tsx
      <QrCode value="https://example.org/join?ref=D00101" label="ნიმუში QR" size={140} />
      <CopyButton text="https://example.org/join?ref=D00101" />
      <CabinetNav
        items={[
          { href: "/styleguide", label: "პროფილი" },
          { href: "/me/billing", label: "გადახდები" },
        ]}
      />
      <Pill status="profile_completed" label="რეგისტრირებული" />
```

Append to `DESIGN.md` (after the Phase 2 paragraph):

```markdown
Phase 3: CabinetNav (role-aware cabinet tabs + გასვლა sign-out), QrCode (uqr
inline SVG, ADR-011), CopyButton, PendingExplainer (shared by /join/pending and
the pending delegate panel). Pill gains an optional `label` override (colors
stay keyed by status). TransferInstructions moved from app/(public)/join/ to
components/ — now shared by /join/done, /join/pending and /me/billing.
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run components/ && npm run typecheck`
Expected: PASS — new component suites green, existing design-system/OtpInput/TierPicker/DelegateBinding suites green, typecheck clean (catches any missed import path from the move).

- [ ] **Step 7: Format + commit**

```bash
npm run format
git add -A
git commit -m "feat: cabinet shared components — CabinetNav, QrCode (uqr, ADR-011), CopyButton, moves"
```

---

### Task 6: Cabinet server actions + member layout gate + `/me` entry redirect

**Files:**
- Create: `app/(member)/me/actions.ts`
- Create: `app/(member)/me/page.tsx`
- Modify: `app/(member)/layout.tsx` (replace the Phase 0 stub gate)

**Interfaces:**
- Consumes: `profileUpdateSchema`, `changeDelegateSchema` (Task 2), `tierSchema` (existing), `mapFunnelError`/`GENERIC_FUNNEL_ERROR`/`FunnelState` (Task 1), `deriveDestination`/`cabinetNavItems` (Task 1), `CabinetNav` (Task 5), RPCs (Task 4).
- Produces (consumed by Tasks 7–9):
  - `export type CabinetActionResult = { ok: true; state: FunnelState } | { ok: false; error: string }`
  - `updateProfileAction(input: unknown): Promise<CabinetActionResult>`
  - `changeDelegateAction(input: unknown): Promise<CabinetActionResult>`
  - `changeTierAction(input: unknown): Promise<CabinetActionResult>`
  - `(member)` layout: session + completion gate, renders `CabinetNav` inside `max-w-5xl`.
- Test boundary note (house precedent from Phase 2 Task 6): server actions import `next/headers` and are not unit-testable in jsdom — their validation logic is already unit-tested via the Task 2 schemas, the DB behavior via Task 4 probes, and the wiring via Task 12 e2e. This task's checks are `typecheck` + existing suites + a dev-server smoke.

- [ ] **Step 1: Create `app/(member)/me/actions.ts`**

```ts
"use server";

import { changeDelegateSchema, profileUpdateSchema } from "@/lib/cabinet-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError, type FunnelState } from "@/lib/funnel";
import { tierSchema } from "@/lib/funnel-schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export type CabinetActionResult = { ok: true; state: FunnelState } | { ok: false; error: string };

function zodFail(message: string | undefined): CabinetActionResult {
  return { ok: false, error: message ?? GENERIC_FUNNEL_ERROR };
}

async function freshState(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
): Promise<CabinetActionResult> {
  const { data, error } = await supabase.rpc("funnel_state");
  if (error || data === null) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  return { ok: true, state: data as unknown as FunnelState };
}

/**
 * Scoped-path profile edit (spec §4.1, ADR-013): a plain UPDATE through the
 * caller's own cookie-bound client — the column-scoped grant, own-row RLS and
 * the protect trigger enforce everything in-DB. No service role anywhere.
 */
export async function updateProfileAction(input: unknown): Promise<CabinetActionResult> {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: mapFunnelError("not_authenticated") };
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      region_id: parsed.data.regionId,
      city_id: parsed.data.cityId,
      employment: parsed.data.employment,
    })
    .eq("id", user.id);
  if (error) {
    // 23503 = composite (city_id, region_id) FK — the city isn't in the chosen region
    if (error.code === "23503") return { ok: false, error: "აირჩიე ქალაქი არჩეული მხარიდან." };
    return { ok: false, error: GENERIC_FUNNEL_ERROR };
  }
  return freshState(supabase);
}

export async function changeDelegateAction(input: unknown): Promise<CabinetActionResult> {
  const parsed = changeDelegateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("member_change_delegate", {
    p_delegate_id: parsed.data.delegateId,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as unknown as FunnelState };
}

export async function changeTierAction(input: unknown): Promise<CabinetActionResult> {
  const parsed = tierSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("member_change_tier", { p_tier: parsed.data.tier });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as unknown as FunnelState };
}
```

- [ ] **Step 2: Replace `app/(member)/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/CabinetNav";
import { cabinetNavItems, deriveDestination } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Completion gate (spec §3.2): only completed registrants enter /me/*; everyone
 * else is bounced to their exact funnel step. Runs server-side on every request —
 * safe because the service worker has never cached /me (NetworkOnly, app/sw.ts).
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("funnel_state");
  const state = data === null ? null : (data as unknown as FunnelState);
  if (!state || !state.exists || !state.completed) redirect(deriveDestination(state));
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <CabinetNav items={cabinetNavItems(state.role)} />
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create `app/(member)/me/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { deriveDestination } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

/** Single cabinet entry point (header „კაბინეტი“): members → profile, delegates → panel. */
export default async function CabinetEntryPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("funnel_state");
  const state = data === null ? null : (data as unknown as FunnelState);
  redirect(deriveDestination(state));
}
```

(The layout has already enforced auth + completion by the time this runs; `deriveDestination` sends members to `/me/profile` and delegates to `/delegate`.)

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run test`
Expected: PASS.

Dev smoke (staging DB, signed out): run `npx next dev` in the background, then

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/me
```

Expected: `307 http://localhost:3000/login` (signed-out gate works). Stop the dev server afterwards.

- [ ] **Step 5: Format + commit**

```bash
npm run format
git add "app/(member)/"
git commit -m "feat: cabinet gate, entry redirect and server actions (scoped update + RPCs)"
```

---

### Task 7: ჩემი პროფილი — `/me/profile`

**Files:**
- Rewrite: `app/(member)/me/profile/page.tsx` (replaces the Phase 0 stub)
- Create: `app/(member)/me/profile/ProfileForm.tsx`
- Create: `app/(member)/me/profile/ProfileForm.test.tsx`

**Interfaces:**
- Consumes: `updateProfileAction`/`CabinetActionResult` (Task 6); `employmentToForm`/`formToEmployment`/`EMPLOYMENT_OTHER`/`formatPhoneKa`/`initialsKa`/`memberSinceKa` (Task 1); `profileUpdateSchema` (Task 2); `EMPLOYMENT_PRESETS` (existing); `Field`/`inputClasses`, `Card`, `Pill`, `Button` (design system).
- Produces: `ProfileForm({ initial: { firstName: string; lastName: string; regionId: number | null; cityId: number | null; employment: string | null }; phone: string | null; regions: { id: number; name_ka: string }[] })`.
- Accessible names MUST match funnel step 2 exactly (e2e reuses them): selects labeled „მხარე“, „ქალაქი / მუნიციპალიტეტი“, „სამუშაო ადგილი / სტატუსი“; fields „სახელი“, „გვარი“.

- [ ] **Step 1: Write the failing test — `app/(member)/me/profile/ProfileForm.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./ProfileForm";

const updateProfileAction = vi.fn();
vi.mock("../actions", () => ({
  updateProfileAction: (input: unknown) => updateProfileAction(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                { id: 3, name_ka: "თბილისი" },
                { id: 4, name_ka: "რუსთავი" },
              ],
            }),
        }),
      }),
    }),
  }),
}));

const REGIONS = [
  { id: 1, name_ka: "თბილისი" },
  { id: 2, name_ka: "იმერეთი" },
];

function renderForm(employment: string) {
  return render(
    <ProfileForm
      initial={{
        firstName: "ნინო",
        lastName: "ბერიძე",
        regionId: 1,
        cityId: 3,
        employment,
      }}
      phone="995599123456"
      regions={REGIONS}
    />,
  );
}

describe("ProfileForm", () => {
  it("prefills preset employment; phone is formatted read-only; PID fully masked", async () => {
    renderForm("სტუდენტი");
    expect(screen.getByLabelText("სახელი")).toHaveValue("ნინო");
    expect(screen.getByLabelText("სამუშაო ადგილი / სტატუსი")).toHaveValue("სტუდენტი");
    expect(screen.getByTestId("profile-phone")).toHaveValue("+995 599 12 34 56");
    expect(screen.getByTestId("profile-phone")).toHaveAttribute("readonly");
    expect(screen.getByTestId("profile-pid")).toHaveValue("•••••••••••");
    await waitFor(() =>
      expect(screen.getByLabelText("ქალაქი / მუნიციპალიტეტი")).toHaveValue("3"),
    );
  });

  it("non-preset employment renders as „სხვა“ with the custom text", () => {
    renderForm("მეწარმე");
    expect(screen.getByLabelText("სამუშაო ადგილი / სტატუსი")).toHaveValue("__other");
    expect(screen.getByLabelText("მიუთითე საქმიანობა")).toHaveValue("მეწარმე");
  });

  it("submits the mapped employment and confirms in Georgian", async () => {
    updateProfileAction.mockResolvedValue({ ok: true, state: {} });
    const user = userEvent.setup();
    renderForm("სტუდენტი");
    await waitFor(() =>
      expect(screen.getByLabelText("ქალაქი / მუნიციპალიტეტი")).toHaveValue("3"),
    );
    await user.selectOptions(screen.getByLabelText("სამუშაო ადგილი / სტატუსი"), "__other");
    await user.type(screen.getByLabelText("მიუთითე საქმიანობა"), "მეწარმე");
    await user.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(updateProfileAction).toHaveBeenCalled());
    expect(updateProfileAction.mock.calls[0]?.[0]).toMatchObject({ employment: "მეწარმე" });
    expect(await screen.findByTestId("profile-saved")).toHaveTextContent("პროფილი განახლდა ✓");
  });
});
```

(If `@testing-library/user-event` is absent from devDependencies, use `fireEvent` equivalents — no new dependency.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(member)/me/profile/ProfileForm.test.tsx"`
Expected: FAIL — `./ProfileForm` not found.

- [ ] **Step 3: Create `app/(member)/me/profile/ProfileForm.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field, inputClasses } from "@/components/Field";
import {
  EMPLOYMENT_OTHER,
  employmentToForm,
  formatPhoneKa,
  formToEmployment,
} from "@/lib/cabinet";
import { profileUpdateSchema } from "@/lib/cabinet-schemas";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { EMPLOYMENT_PRESETS } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";
import { updateProfileAction } from "../actions";

interface CityOption {
  id: number;
  name_ka: string;
}

export function ProfileForm({
  initial,
  phone,
  regions,
}: {
  initial: {
    firstName: string;
    lastName: string;
    regionId: number | null;
    cityId: number | null;
    employment: string | null;
  };
  phone: string | null;
  regions: { id: number; name_ka: string }[];
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [regionId, setRegionId] = useState(initial.regionId ?? regions[0]?.id ?? 0);
  const [cityId, setCityId] = useState(initial.cityId ?? 0);
  const initialEmployment = employmentToForm(initial.employment);
  const [employmentChoice, setEmploymentChoice] = useState(initialEmployment.choice);
  const [employmentCustom, setEmploymentCustom] = useState(initialEmployment.custom);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void supabase
      .from("cities")
      .select("id, name_ka")
      .eq("region_id", regionId)
      .order("id")
      .then(({ data }) => {
        if (cancelled || !data) return;
        setCities(data);
        setCityId((current) => (data.some((c) => c.id === current) ? current : (data[0]?.id ?? 0)));
      });
    return () => {
      cancelled = true;
    };
  }, [regionId]);

  async function save() {
    setError(undefined);
    setSaved(false);
    const parsed = profileUpdateSchema.safeParse({
      firstName,
      lastName,
      regionId,
      cityId,
      employment: formToEmployment({ choice: employmentChoice, custom: employmentCustom }),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR);
      return;
    }
    setBusy(true);
    const result = await updateProfileAction(parsed.data);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh(); // summary card re-renders with the new values
  }

  return (
    <Card title="პირადი მონაცემები">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="სახელი"
            name="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Field
            label="გვარი"
            name="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">ტელეფონი</span>
            <div className="flex items-center gap-2">
              <input
                className={`${inputClasses} w-full border-line bg-surface`}
                value={formatPhoneKa(phone)}
                readOnly
                aria-label="ტელეფონი"
                data-testid="profile-phone"
              />
              <span className="whitespace-nowrap rounded-full bg-ok/10 px-2 py-1 text-xs font-semibold text-ok">
                ✓ ვერიფიც.
              </span>
            </div>
            <p className="text-xs text-muted-fg">ნომრის შესაცვლელად საჭიროა ხელახალი დადასტურება.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">პირადი ნომერი</span>
            <input
              className={`${inputClasses} border-line bg-surface tracking-widest`}
              value="•••••••••••"
              readOnly
              aria-label="პირადი ნომერი"
              data-testid="profile-pid"
            />
            <p className="text-xs text-muted-fg">ვერიფიცირებული · დაცული მონაცემი.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-region" className="text-sm font-semibold text-ink">
              მხარე
            </label>
            <select
              id="profile-region"
              className={`${inputClasses} border-line`}
              value={regionId}
              onChange={(e) => setRegionId(Number(e.target.value))}
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name_ka}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-city" className="text-sm font-semibold text-ink">
              ქალაქი / მუნიციპალიტეტი
            </label>
            <select
              id="profile-city"
              className={`${inputClasses} border-line`}
              value={cityId}
              onChange={(e) => setCityId(Number(e.target.value))}
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ka}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-employment" className="text-sm font-semibold text-ink">
            სამუშაო ადგილი / სტატუსი
          </label>
          <select
            id="profile-employment"
            className={`${inputClasses} border-line`}
            value={employmentChoice}
            onChange={(e) => setEmploymentChoice(e.target.value)}
          >
            {EMPLOYMENT_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={EMPLOYMENT_OTHER}>სხვა (მიუთითე)</option>
          </select>
          {employmentChoice === EMPLOYMENT_OTHER ? (
            <Field
              label="მიუთითე საქმიანობა"
              name="employmentCustom"
              value={employmentCustom}
              maxLength={100}
              onChange={(e) => setEmploymentCustom(e.target.value)}
            />
          ) : null}
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {saved ? (
          <p className="text-sm font-semibold text-ok" data-testid="profile-saved">
            პროფილი განახლდა ✓
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            შენახვა
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Rewrite `app/(member)/me/profile/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { initialsKa, memberSinceKa } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "ჩემი პროფილი — ქართული რესპუბლიკა" };

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("funnel_state");
  const state = data as unknown as FunnelState; // (member) layout guarantees exists+completed
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: regions } = await supabase.from("regions").select("id, name_ka").order("id");
  const regionName = (regions ?? []).find((r) => r.id === state.regionId)?.name_ka ?? "—";
  const since = memberSinceKa(state.registrationCompletedAt ?? state.createdAt);

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>პირადი კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">ჩემი პროფილი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          მართე შენი პერსონალური მონაცემები და წევრობის სტატუსი.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        <Card>
          <div className="text-center">
            <div
              className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-xl font-bold text-brand"
              aria-hidden
            >
              {initialsKa(state.firstName, state.lastName)}
            </div>
            <h2 className="text-lg font-bold text-ink">
              {state.firstName} {state.lastName}
            </h2>
            <div className="mt-2">
              <Pill
                status={state.status === "active_member" ? "active_member" : "profile_completed"}
                label={state.status === "active_member" ? "აქტიური" : "რეგისტრირებული"}
              />
            </div>
          </div>
          <dl className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4 text-sm">
            {since ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-fg">წევრი</dt>
                <dd className="font-semibold text-ink">{since}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-fg">რეგიონი</dt>
              <dd className="font-semibold text-ink" data-testid="summary-region">
                {regionName}
              </dd>
            </div>
            {state.role === "member" ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-fg">დელეგატი</dt>
                <dd className="font-semibold text-ink" data-testid="summary-delegate">
                  {state.chosenDelegate
                    ? `${state.chosenDelegate.firstName} ${state.chosenDelegate.lastName}`
                    : "ცენტრალური მოძრაობა"}
                </dd>
              </div>
            ) : null}
          </dl>
          {state.role === "member" ? (
            <Link
              href="/me/delegate"
              className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
            >
              დელეგატის შეცვლა →
            </Link>
          ) : null}
        </Card>
        <ProfileForm
          initial={{
            firstName: state.firstName,
            lastName: state.lastName,
            regionId: state.regionId,
            cityId: state.cityId,
            employment: state.employment,
          }}
          phone={user?.phone ?? null}
          regions={regions ?? []}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run tests to verify green**

Run: `npx vitest run "app/(member)/me/profile/ProfileForm.test.tsx" && npm run typecheck`
Expected: the test run FAILS to find the file at first — `vitest.config.ts` currently has `include: ["lib/**/*.test.ts", "components/**/*.test.tsx"]` (verified). Change it to:

```ts
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "app/**/*.test.{ts,tsx}"],
```

then rerun — expected PASS. (Tasks 8, 10 and 11 put more tests under `app/`; this one-line widening covers them all.)

- [ ] **Step 6: Format + commit**

```bash
npm run format
git add "app/(member)/me/profile/" vitest.config.ts
git commit -m "feat: member profile page — summary card + scoped edit form"
```

---

### Task 8: ჩემი დელეგატი — `/me/delegate`

**Files:**
- Create: `app/(member)/me/delegate/page.tsx`
- Create: `app/(member)/me/delegate/DelegateChange.tsx`
- Create: `app/(member)/me/delegate/DelegateChange.test.tsx`

**Interfaces:**
- Consumes: `changeDelegateAction` (Task 6); `changeDelegateSchema` (Task 2); `initialsKa` (Task 1); `formatCountKa` (existing `lib/format.ts`); `Card`, `Pill`, `Button`, `inputClasses`.
- Produces: `DelegateChange({ regions: { id: number; name_ka: string }[]; delegates: PickerDelegate[]; currentDelegateId: string | null; initialRegionId: number })` with `export interface PickerDelegate { id: string; first_name: string; last_name: string; region_id: number | null }`.
- The delegate select is labeled „დელეგატი“; the „ცენტრალური მოძრაობა“ option is FIRST and uses value `"central"`; the current choice carries the suffix „ (მიმდინარე)“.

- [ ] **Step 1: Write the failing test — `app/(member)/me/delegate/DelegateChange.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DelegateChange } from "./DelegateChange";

const changeDelegateAction = vi.fn();
vi.mock("../actions", () => ({
  changeDelegateAction: (input: unknown) => changeDelegateAction(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const REGIONS = [
  { id: 1, name_ka: "თბილისი" },
  { id: 2, name_ka: "იმერეთი" },
];
const DELEGATES = [
  { id: "aaaaaaaa-0000-4000-8000-000000000001", first_name: "გიორგი", last_name: "მაისურაძე", region_id: 1 },
  { id: "aaaaaaaa-0000-4000-8000-000000000002", first_name: "თამარ", last_name: "კვარაცხელია", region_id: 2 },
];

beforeEach(() => changeDelegateAction.mockReset());

describe("DelegateChange", () => {
  it("lists central first, filters by region, marks the current choice", async () => {
    render(
      <DelegateChange
        regions={REGIONS}
        delegates={DELEGATES}
        currentDelegateId={DELEGATES[0]!.id}
        initialRegionId={1}
      />,
    );
    const select = screen.getByLabelText("დელეგატი");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options[0]).toBe("ცენტრალური მოძრაობა");
    expect(options[1]).toBe("გიორგი მაისურაძე (მიმდინარე)");
    expect(options).toHaveLength(2); // Imereti delegate filtered out
  });

  it("refuses re-choosing the current delegate without a server call", async () => {
    const user = userEvent.setup();
    render(
      <DelegateChange
        regions={REGIONS}
        delegates={DELEGATES}
        currentDelegateId={DELEGATES[0]!.id}
        initialRegionId={1}
      />,
    );
    await user.selectOptions(screen.getByLabelText("დელეგატი"), DELEGATES[0]!.id);
    await user.click(screen.getByRole("button", { name: "დელეგატის შეცვლა" }));
    expect(screen.getByText("ეს დელეგატი უკვე არჩეულია")).toBeInTheDocument();
    expect(changeDelegateAction).not.toHaveBeenCalled();
  });

  it("changes to central (null) and confirms", async () => {
    changeDelegateAction.mockResolvedValue({ ok: true, state: {} });
    const user = userEvent.setup();
    render(
      <DelegateChange
        regions={REGIONS}
        delegates={DELEGATES}
        currentDelegateId={DELEGATES[0]!.id}
        initialRegionId={1}
      />,
    );
    await user.selectOptions(screen.getByLabelText("დელეგატი"), "central");
    await user.click(screen.getByRole("button", { name: "დელეგატის შეცვლა" }));
    expect(changeDelegateAction).toHaveBeenCalledWith({ delegateId: null });
    expect(await screen.findByText("დელეგატი შეიცვალა ✓")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(member)/me/delegate/DelegateChange.test.tsx"`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/(member)/me/delegate/DelegateChange.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { inputClasses } from "@/components/Field";
import { changeDelegateSchema } from "@/lib/cabinet-schemas";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { changeDelegateAction } from "../actions";

const CENTRAL = "central";

export interface PickerDelegate {
  id: string;
  first_name: string;
  last_name: string;
  region_id: number | null;
}

export function DelegateChange({
  regions,
  delegates,
  currentDelegateId,
  initialRegionId,
}: {
  regions: { id: number; name_ka: string }[];
  delegates: PickerDelegate[];
  currentDelegateId: string | null;
  initialRegionId: number;
}) {
  const router = useRouter();
  const [regionId, setRegionId] = useState(initialRegionId);
  const [choice, setChoice] = useState(currentDelegateId ?? CENTRAL);
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "info"; text: string }>();
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () => delegates.filter((d) => d.region_id === regionId),
    [delegates, regionId],
  );

  async function change() {
    setMessage(undefined);
    const selected = choice === CENTRAL ? null : choice;
    if (selected === currentDelegateId) {
      setMessage({ kind: "info", text: "ეს დელეგატი უკვე არჩეულია" });
      return; // the RPC would no-op anyway (spec §4.2) — save the round-trip
    }
    const parsed = changeDelegateSchema.safeParse({ delegateId: selected });
    if (!parsed.success) {
      setMessage({ kind: "error", text: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR });
      return;
    }
    setBusy(true);
    const result = await changeDelegateAction(parsed.data);
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "ok", text: "დელეგატი შეიცვალა ✓" });
    router.refresh(); // current-delegate card + summary re-render server-side
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="change-region" className="text-sm font-semibold text-ink">
          რეგიონი
        </label>
        <select
          id="change-region"
          className={`${inputClasses} border-line`}
          value={regionId}
          onChange={(e) => setRegionId(Number(e.target.value))}
        >
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name_ka}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="change-delegate" className="text-sm font-semibold text-ink">
          დელეგატი
        </label>
        <select
          id="change-delegate"
          className={`${inputClasses} border-line`}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value={CENTRAL}>
            {currentDelegateId === null ? "ცენტრალური მოძრაობა (მიმდინარე)" : "ცენტრალური მოძრაობა"}
          </option>
          {options.map((d) => (
            <option key={d.id} value={d.id}>
              {d.first_name} {d.last_name}
              {d.id === currentDelegateId ? " (მიმდინარე)" : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-fg">
          აჩვენებს მხოლოდ დამტკიცებულ დელეგატებს არჩეულ რეგიონში.
        </p>
      </div>
      {message ? (
        <p
          className={`text-sm font-semibold ${
            message.kind === "ok"
              ? "text-ok"
              : message.kind === "error"
                ? "text-danger"
                : "text-muted-fg"
          }`}
          data-testid="change-delegate-message"
        >
          {message.text}
        </p>
      ) : null}
      <Button className="w-full" onClick={change} disabled={busy}>
        დელეგატის შეცვლა
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Create `app/(member)/me/delegate/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { initialsKa } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";
import { DelegateChange } from "./DelegateChange";

export const metadata: Metadata = { title: "ჩემი დელეგატი — ქართული რესპუბლიკა" };

export default async function MyDelegatePage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("funnel_state");
  const state = data as unknown as FunnelState; // layout guarantees exists+completed
  if (state.role === "delegate") redirect("/delegate"); // members-only page (spec §3.1)

  const [{ data: delegates }, { data: regions }] = await Promise.all([
    supabase
      .from("public_delegates")
      .select("id, first_name, last_name, region_id, region_name_ka, active_supporters"),
    supabase.from("regions").select("id, name_ka").order("id"),
  ]);
  const current = state.chosenDelegate
    ? ((delegates ?? []).find((d) => d.id === state.chosenDelegate?.id) ?? null)
    : null;

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>პირადი კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">ჩემი დელეგატი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          დელეგატი შენს ხმას წარადგენს მოძრაობაში. არჩევანი ყოველთვის შენზეა.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4">
        <span className="text-xl" aria-hidden>
          🔄
        </span>
        <div>
          <p className="text-sm font-bold text-ink">
            შენ შეგიძლია ნებისმიერ დროს, შეზღუდვის გარეშე შეცვალო დელეგატი.
          </p>
          <p className="mt-1 text-sm text-muted-fg">
            არჩევანი ძალაში შედის მყისიერად და აისახება დელეგატის რეიტინგზე.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card title="მიმდინარე დელეგატი">
          {state.chosenDelegate ? (
            <div>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 font-bold text-brand"
                  aria-hidden
                >
                  {initialsKa(state.chosenDelegate.firstName, state.chosenDelegate.lastName)}
                </div>
                <div>
                  <h3 className="font-bold text-ink" data-testid="current-delegate">
                    {state.chosenDelegate.firstName} {state.chosenDelegate.lastName}
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <Pill status="approved" />
                    {current?.region_name_ka ? (
                      <span className="text-sm text-muted-fg">{current.region_name_ka}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-muted-fg">აქტიური მხარდამჭერი</span>
                <strong className="text-lg text-ink">
                  {formatCountKa(current?.active_supporters ?? 0)}
                </strong>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 font-bold text-brand"
                aria-hidden
              >
                ცმ
              </div>
              <div>
                <h3 className="font-bold text-ink" data-testid="current-delegate">
                  ცენტრალური მოძრაობა
                </h3>
                <p className="mt-1 text-sm text-muted-fg">
                  შენ პირდაპირ ცენტრალურ მოძრაობას უჭერ მხარს.
                </p>
              </div>
            </div>
          )}
        </Card>

        <Card title="დელეგატის შეცვლა">
          <DelegateChange
            regions={regions ?? []}
            delegates={delegates ?? []}
            currentDelegateId={state.chosenDelegate?.id ?? null}
            initialRegionId={state.regionId ?? regions?.[0]?.id ?? 1}
          />
        </Card>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run tests to verify green**

Run: `npx vitest run "app/(member)/me/delegate/DelegateChange.test.tsx" && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Format + commit**

```bash
npm run format
git add "app/(member)/me/delegate/"
git commit -m "feat: my-delegate page — current card + history-keeping change"
```

---

### Task 9: გადახდები — `/me/billing`

**Files:**
- Create: `app/(member)/me/billing/page.tsx`
- Create: `app/(member)/me/billing/TierChange.tsx`
- Create: `app/(member)/me/billing/TierChange.test.tsx`

**Interfaces:**
- Consumes: `changeTierAction` (Task 6); `tierSchema` (existing); `TierPicker` (existing, reused verbatim); `TransferInstructions` (Task 5 location); `formatDateKa`/`paymentMethodLabel` (Task 1); `Card`, `Pill`, `Button`.
- Produces: `TierChange({ currentTier: Tier })` — collapsed „შენი საწევრო: N ₾ / თვეში“ + „შეცვლა“; expanded shows `TierPicker` + შენახვა/გაუქმება.

- [ ] **Step 1: Write the failing test — `app/(member)/me/billing/TierChange.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TierChange } from "./TierChange";

const changeTierAction = vi.fn();
vi.mock("../actions", () => ({
  changeTierAction: (input: unknown) => changeTierAction(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

beforeEach(() => changeTierAction.mockReset());

describe("TierChange", () => {
  it("shows the current tier and reveals the picker on შეცვლა", async () => {
    const user = userEvent.setup();
    render(<TierChange currentTier={10} />);
    expect(screen.getByTestId("current-tier")).toHaveTextContent("10 ₾");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "შეცვლა" }));
    expect(screen.getByRole("radiogroup", { name: "ყოველთვიური საწევრო" })).toBeInTheDocument();
  });

  it("saves a new tier and confirms; cancel restores the collapsed view", async () => {
    changeTierAction.mockResolvedValue({ ok: true, state: {} });
    const user = userEvent.setup();
    render(<TierChange currentTier={10} />);
    await user.click(screen.getByRole("button", { name: "შეცვლა" }));
    await user.click(screen.getByRole("radio", { name: /5/ }));
    await user.click(screen.getByRole("button", { name: "შენახვა" }));
    expect(changeTierAction).toHaveBeenCalledWith({ tier: 5 });
    expect(await screen.findByText("საწევრო შეიცვალა ✓")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(member)/me/billing/TierChange.test.tsx"`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/(member)/me/billing/TierChange.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { TierPicker } from "@/components/TierPicker";
import { GENERIC_FUNNEL_ERROR, type Tier } from "@/lib/funnel";
import { tierSchema } from "@/lib/funnel-schemas";
import { changeTierAction } from "../actions";

export function TierChange({ currentTier }: { currentTier: Tier }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<Tier>(currentTier);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string }>();
  const [busy, setBusy] = useState(false);

  async function save() {
    setMessage(undefined);
    const parsed = tierSchema.safeParse({ tier });
    if (!parsed.success) {
      setMessage({ kind: "error", text: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR });
      return;
    }
    setBusy(true);
    const result = await changeTierAction(parsed.data);
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setOpen(false);
    setMessage({ kind: "ok", text: "საწევრო შეიცვალა ✓" });
    router.refresh(); // instructions block re-renders with the new amount
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xl font-extrabold text-ink" data-testid="current-tier">
          შენი საწევრო: {currentTier} ₾{" "}
          <span className="text-sm font-semibold text-muted-fg">/ თვეში</span>
        </p>
        {!open ? (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            შეცვლა
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          <TierPicker value={tier} onChange={setTier} />
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              შენახვა
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setTier(currentTier);
                setMessage(undefined);
              }}
            >
              გაუქმება
            </Button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p
          className={`mt-3 text-sm font-semibold ${message.kind === "ok" ? "text-ok" : "text-danger"}`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Create `app/(member)/me/billing/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "@/components/TransferInstructions";
import { formatDateKa, paymentMethodLabel } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";
import { TierChange } from "./TierChange";

export const metadata: Metadata = { title: "გადახდები — ქართული რესპუბლიკა" };

export default async function BillingPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("funnel_state");
  const state = data as unknown as FunnelState; // layout guarantees exists+completed
  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount_gel, paid_at, source")
    .order("paid_at", { ascending: false }); // RLS scopes to own rows

  const rows = payments ?? [];

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>პირადი კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">გადახდები</h1>
        <p className="mt-2 text-sm text-muted-fg">მართე შენი საწევრო და ნახე გადახდების ისტორია.</p>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          {state.tier !== null ? <TierChange currentTier={state.tier} /> : null}
          <TransferInstructions tier={state.tier} referenceCode={state.referenceCode} />
          {state.status !== "active_member" ? (
            <p className="mt-4 text-sm text-muted-fg">
              აქტიური წევრის სტატუსი გააქტიურდება პირველი შენატანის დადასტურების შემდეგ.
            </p>
          ) : null}
        </Card>

        <Card
          header={
            <>
              <h3 className="text-base font-bold text-ink">გადახდების ისტორია</h3>
              {rows.length > 0 ? (
                <span className="text-xs text-muted-fg">ბოლო {rows.length} გადახდა</span>
              ) : null}
            </>
          }
          padded={false}
        >
          {rows.length === 0 ? (
            <div className="p-6 text-sm" data-testid="billing-empty">
              <p className="font-semibold text-ink">გადახდები ჯერ არ არის აღრიცხული</p>
              <p className="mt-1 text-muted-fg">
                გადარიცხვებს ადასტურებს ფინანსური გუნდი — დადასტურებული გადახდები აქ გამოჩნდება.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted-fg">
                    <th className="px-6 py-3 font-semibold">თარიღი</th>
                    <th className="px-6 py-3 font-semibold">თანხა</th>
                    <th className="px-6 py-3 font-semibold">მეთოდი</th>
                    <th className="px-6 py-3 font-semibold">სტატუსი</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-6 py-3">{formatDateKa(p.paid_at)}</td>
                      <td className="px-6 py-3 font-semibold text-ink">{p.amount_gel} ₾</td>
                      <td className="px-6 py-3">{paymentMethodLabel(p.source)}</td>
                      <td className="px-6 py-3">
                        <Pill status="active_member" label="დადასტურებული" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run tests to verify green**

Run: `npx vitest run "app/(member)/me/billing/TierChange.test.tsx" && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Format + commit**

```bash
npm run format
git add "app/(member)/me/billing/"
git commit -m "feat: billing page — tier change, reference code + instructions, honest empty history"
```

---

### Task 10: Delegate panel — `/delegate` + `/delegate/team`

**Files:**
- Create: `app/(delegate)/layout.tsx`
- Create: `app/(delegate)/delegate/page.tsx`
- Create: `app/(delegate)/delegate/ReferralCard.tsx`, `app/(delegate)/delegate/ReferralCard.test.tsx`
- Create: `app/(delegate)/delegate/team/page.tsx`
- Create: `app/(delegate)/delegate/team/TeamTable.tsx`, `app/(delegate)/delegate/team/TeamTable.test.tsx`
- Create: `app/(delegate)/error.tsx`, `app/(member)/error.tsx` (one-line re-exports of the public error boundary)

**Interfaces:**
- Consumes: `delegate_panel`/`delegate_team` RPCs (Task 4); `DelegatePanelData`/`TeamMember`/`TEAM_STATUS_LABELS`/`formatDateKa`/`buildReferralUrl`/`cabinetNavItems`/`deriveDestination` (Task 1); `CabinetNav`/`QrCode`/`CopyButton`/`PendingExplainer` (Task 5); `rankDelegates` (existing `lib/ranking.ts`); `StatCard`, `Card`, `Pill`, `ButtonLink`, `Eyebrow`.
- Produces: `ReferralCard({ code: string })` (client — origin from `window.location.origin`); `TeamTable({ members: TeamMember[] })` (client search + status filter).
- Delegate-status pills use the Pill component's canonical labels (pending → „განხილვის პროცესში“ — the Phase 2 owner-approved deviation; approved → „დამტკიცებული“; rejected → „უარყოფილი“). The spec's „მოლოდინში“ shorthand resolves to the canonical pending label for consistency with `/join/pending` and the directory.

- [ ] **Step 1: Write the failing tests**

`app/(delegate)/delegate/ReferralCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferralCard } from "./ReferralCard";

describe("ReferralCard", () => {
  it("builds the link from the current origin, with copy button and QR", async () => {
    render(<ReferralCard code="AB2C3D" />);
    const url = await screen.findByTestId("referral-url");
    expect(url.textContent).toBe(`${window.location.origin}/join?ref=AB2C3D`);
    expect(screen.getByRole("button", { name: "კოპირება" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "რეფერალური ბმულის QR კოდი" }).innerHTML).toContain(
      "<svg",
    );
  });
});
```

`app/(delegate)/delegate/team/TeamTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { TeamMember } from "@/lib/cabinet";
import { TeamTable } from "./TeamTable";

const MEMBERS: TeamMember[] = [
  {
    firstName: "ნინო",
    lastName: "ბერიძე",
    registeredAt: "2026-07-10T09:00:00Z",
    status: "active_member",
  },
  {
    firstName: "გიორგი",
    lastName: "წიკლაური",
    registeredAt: "2026-07-14T12:00:00Z",
    status: "profile_completed",
  },
];

describe("TeamTable", () => {
  it("renders rows with dates and status labels", () => {
    render(<TeamTable members={MEMBERS} />);
    expect(screen.getByText("ნინო ბერიძე")).toBeInTheDocument();
    expect(screen.getByText("10.07.2026")).toBeInTheDocument();
    expect(screen.getByText("აქტიური")).toBeInTheDocument();
    expect(screen.getByText("რეგისტრირებული")).toBeInTheDocument();
  });

  it("filters by search and by status", async () => {
    const user = userEvent.setup();
    render(<TeamTable members={MEMBERS} />);
    await user.type(screen.getByLabelText("ძებნა სახელით ან გვარით"), "გიორგი");
    expect(screen.queryByText("ნინო ბერიძე")).not.toBeInTheDocument();
    expect(screen.getByText("გიორგი წიკლაური")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("ძებნა სახელით ან გვარით"));
    await user.selectOptions(screen.getByLabelText("სტატუსის ფილტრი"), "active_member");
    expect(screen.getByText("ნინო ბერიძე")).toBeInTheDocument();
    expect(screen.queryByText("გიორგი წიკლაური")).not.toBeInTheDocument();
  });

  it("shows the empty state for a fresh delegate and a no-results state when filtered", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TeamTable members={[]} />);
    expect(screen.getByTestId("team-empty")).toHaveTextContent(
      "ჯერ არავინ დარეგისტრირებულა შენი ბმულით",
    );
    rerender(<TeamTable members={MEMBERS} />);
    await user.type(screen.getByLabelText("ძებნა სახელით ან გვარით"), "zzz");
    expect(screen.getByTestId("team-no-results")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/(delegate)"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `app/(delegate)/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/CabinetNav";
import { cabinetNavItems, deriveDestination } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Delegate gate (spec §3.2): completed delegates only (any verification
 * status); members and unfinished registrants bounce to their own area.
 */
export default async function DelegateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("funnel_state");
  const state = data === null ? null : (data as unknown as FunnelState);
  if (!state || !state.exists || !state.completed || state.role !== "delegate") {
    redirect(deriveDestination(state));
  }
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <CabinetNav items={cabinetNavItems("delegate")} />
      {children}
    </div>
  );
}
```

Then the two error boundaries (route groups need their own `error.tsx`; both reuse the public one's component — no markup duplication):

`app/(delegate)/error.tsx` and `app/(member)/error.tsx`, identical one line each:

```tsx
export { default } from "../(public)/error";
```

- [ ] **Step 4: Create `app/(delegate)/delegate/ReferralCard.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { CopyButton } from "@/components/CopyButton";
import { QrCode } from "@/components/QrCode";
import { buildReferralUrl } from "@/lib/cabinet";

/**
 * Origin is read client-side so the link is truthful on every deployment
 * (previews show the preview URL, production the real one) — ADR-011.
 */
export function ReferralCard({ code }: { code: string }) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    setUrl(buildReferralUrl(window.location.origin, code));
  }, [code]);

  return (
    <Card>
      <p className="text-xs font-extrabold uppercase tracking-wider text-brand">
        შენი პერსონალური რეფერალური ბმული
      </p>
      {url ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3">
            <code
              className="min-w-0 flex-1 break-all font-mono text-sm text-ink"
              data-testid="referral-url"
            >
              {url}
            </code>
            <CopyButton text={url} />
          </div>
          <div className="mt-4">
            <QrCode value={url} label="რეფერალური ბმულის QR კოდი" size={180} />
          </div>
        </>
      ) : null}
      <p className="mt-3 text-xs text-muted-fg">
        ყველა, ვინც ამ ბმულით დარეგისტრირდება, ავტომატურად შენს გუნდში ჩაითვლება.
      </p>
    </Card>
  );
}
```

- [ ] **Step 5: Create `app/(delegate)/delegate/page.tsx`**

```tsx
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { PendingExplainer } from "@/components/PendingExplainer";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import type { DelegatePanelData } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
import { rankDelegates } from "@/lib/ranking";
import { createServerSupabase } from "@/lib/supabase/server";
import { ReferralCard } from "./ReferralCard";

export const metadata: Metadata = { title: "დელეგატის პანელი — ქართული რესპუბლიკა" };

export default async function DelegateDashboardPage() {
  const supabase = await createServerSupabase();
  const [{ data: stateData }, { data: panelData, error: panelError }] = await Promise.all([
    supabase.rpc("funnel_state"),
    supabase.rpc("delegate_panel"),
  ]);
  if (panelError || panelData === null) {
    throw new Error(`delegate_panel failed: ${panelError?.message ?? "empty"}`);
  }
  const state = stateData as unknown as FunnelState; // layout guarantees delegate+completed
  const panel = panelData as unknown as DelegatePanelData;

  // Rank reuses the leaderboard's exact inputs + math (spec §3.6) so the two
  // surfaces can never disagree.
  let rankValue: string = "—";
  let rankSub: string | undefined;
  if (panel.status === "approved") {
    const [{ data: publicDelegates }, authResult] = await Promise.all([
      supabase.from("public_delegates").select("id, first_name, last_name, active_supporters"),
      supabase.auth.getUser(),
    ]);
    const ranked = rankDelegates(publicDelegates ?? []);
    const mine = ranked.find((d) => d.id === authResult.data.user?.id);
    if (mine) {
      rankValue = `#${mine.rank}`;
      rankSub = `${mine.rank} / ${ranked.length} დელეგატი`;
    }
  }

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>დელეგატის კაბინეტი</Eyebrow>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">გამარჯობა, {state.firstName}</h1>
          <Pill status={panel.status} />
        </div>
        <p className="mt-2 text-sm text-muted-fg">
          მართე შენი გუნდი და თვალი ადევნე მხარდაჭერას რეალურ დროში.
        </p>
      </div>

      {panel.status === "approved" ? (
        <div className="flex flex-col gap-6">
          <ReferralCard code={panel.referralCode} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              value={panel.activeCount}
              label="აქტიური მხარდამჭერი"
              sub="ლიმიტის გარეშე"
              accent="brand"
            />
            <StatCard value={panel.totalCount} label="სულ გუნდში" />
            <StatCard value={panel.draftCount} label="მონახაზები (Draft)" />
            <StatCard value={rankValue} label="რეიტინგში ადგილი" sub={rankSub} />
          </div>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-ink">გუნდის დეტალური სია</h3>
                <p className="mt-1 text-sm text-muted-fg">
                  იხილე ყველა წევრი, მათი სტატუსი და რეგისტრაციის თარიღი.
                </p>
              </div>
              <ButtonLink href="/delegate/team" variant="dark">
                ნახე შენი გუნდი
              </ButtonLink>
            </div>
          </Card>
        </div>
      ) : panel.status === "pending" ? (
        <Card>
          <h2 className="text-lg font-bold text-ink">შენი დელეგატის პროფილი განიხილება</h2>
          <PendingExplainer />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value={0} label="აქტიური მხარდამჭერი" />
            <StatCard value={0} label="სულ გუნდში" />
            <StatCard value={0} label="მონახაზები (Draft)" />
            <StatCard value="—" label="რეიტინგში ადგილი" />
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm font-semibold text-danger" data-testid="rejected-notice">
            დელეგატის პროფილი უარყოფილია — დაგვიკავშირდი დეტალებისთვის.
          </p>
        </Card>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Create the team page + table**

`app/(delegate)/delegate/team/TeamTable.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { inputClasses } from "@/components/Field";
import { Pill } from "@/components/Pill";
import {
  formatDateKa,
  TEAM_STATUS_LABELS,
  type TeamMember,
  type TeamMemberStatus,
} from "@/lib/cabinet";

type StatusFilter = "all" | TeamMemberStatus;

export function TeamTable({ members }: { members: TeamMember[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (q && !`${m.firstName} ${m.lastName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [members, query, status]);

  return (
    <Card
      header={
        <>
          <h3 className="text-base font-bold text-ink">წევრების სია</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputClasses} border-line`}
              style={{ width: 220 }}
              placeholder="ძებნა სახელით ან გვარით…"
              aria-label="ძებნა სახელით ან გვარით"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className={`${inputClasses} border-line`}
              aria-label="სტატუსის ფილტრი"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">ყველა სტატუსი</option>
              <option value="active_member">აქტიური</option>
              <option value="profile_completed">რეგისტრირებული</option>
            </select>
          </div>
        </>
      }
      padded={false}
    >
      {members.length === 0 ? (
        <div className="p-6 text-sm" data-testid="team-empty">
          <p className="font-semibold text-ink">ჯერ არავინ დარეგისტრირებულა შენი ბმულით</p>
          <p className="mt-1 text-muted-fg">გააზიარე ბმული და გუნდი აქ გამოჩნდება.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="p-6 text-sm text-muted-fg" data-testid="team-no-results">
          ვერაფერი მოიძებნა ამ ფილტრით.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted-fg">
                <th className="px-6 py-3 font-semibold">წევრი</th>
                <th className="px-6 py-3 font-semibold">რეგისტრაციის თარიღი</th>
                <th className="px-6 py-3 font-semibold">სტატუსი</th>
              </tr>
            </thead>
            <tbody data-testid="team-rows">
              {filtered.map((m, i) => (
                <tr
                  key={`${m.firstName}-${m.lastName}-${m.registeredAt}-${i}`}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-6 py-3 font-semibold text-ink">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="px-6 py-3">{formatDateKa(m.registeredAt)}</td>
                  <td className="px-6 py-3">
                    <Pill status={m.status} label={TEAM_STATUS_LABELS[m.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
```

`app/(delegate)/delegate/team/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Eyebrow } from "@/components/Eyebrow";
import type { DelegatePanelData, TeamMember } from "@/lib/cabinet";
import { createServerSupabase } from "@/lib/supabase/server";
import { TeamTable } from "./TeamTable";

export const metadata: Metadata = { title: "ჩემი გუნდი — ქართული რესპუბლიკა" };

export default async function DelegateTeamPage() {
  const supabase = await createServerSupabase();
  const { data: panelData, error: panelError } = await supabase.rpc("delegate_panel");
  if (panelError || panelData === null) {
    throw new Error(`delegate_panel failed: ${panelError?.message ?? "empty"}`);
  }
  const panel = panelData as unknown as DelegatePanelData;
  if (panel.status !== "approved") redirect("/delegate"); // no team pre-approval (spec §3.7)
  const { data: teamData, error: teamError } = await supabase.rpc("delegate_team");
  if (teamError || teamData === null) {
    throw new Error(`delegate_team failed: ${teamError?.message ?? "empty"}`);
  }
  const team = teamData as unknown as TeamMember[];

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>დელეგატის კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">ჩემი გუნდი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          შენს გუნდში{" "}
          <strong className="text-ink" data-testid="team-count">
            {team.length}
          </strong>{" "}
          წევრი
        </p>
      </div>
      <TeamTable members={team} />
    </main>
  );
}
```

- [ ] **Step 7: Run tests to verify green**

Run: `npx vitest run "app/(delegate)" && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Format + commit**

```bash
npm run format
git add "app/(delegate)/" "app/(member)/error.tsx"
git commit -m "feat: delegate panel — live referral link + QR, stats, team table, status states"
```

---

### Task 11: Routing handoff — login, /join guards, one-time completion screens, header

**Files:**
- Create: `app/(public)/join/fresh-completion.ts`, `app/(public)/join/fresh-completion.test.ts`
- Create: `components/HeaderSessionAction.tsx`, `components/HeaderSessionAction.test.tsx`
- Modify: `app/(public)/login/page.tsx`, `app/(public)/join/JoinChoice.tsx`, `app/(public)/join/useFunnelGuard.ts`, `app/(public)/join/step-3/page.tsx`, `app/(public)/join/done/page.tsx`, `app/(public)/join/pending/page.tsx`, `app/(public)/layout.tsx`

**Interfaces:**
- Consumes: `deriveDestination` (Task 1).
- Produces: `markFreshCompletion()`, `peekFreshCompletion(): boolean`, `clearFreshCompletion()` (sessionStorage one-shot marker; peek is idempotent — React StrictMode double-renders must not consume it); `HeaderSessionAction()` client component.
- After this task the funnel is one-way: completed users landing anywhere in `/join/*` or `/login`'s post-verify path are forwarded to their cabinet; the done/pending screens render only straight after `funnel_complete`.

- [ ] **Step 1: Write the failing tests**

`app/(public)/join/fresh-completion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clearFreshCompletion,
  markFreshCompletion,
  peekFreshCompletion,
} from "./fresh-completion";

describe("fresh-completion marker", () => {
  it("peek is idempotent until cleared (StrictMode double-render safe)", () => {
    markFreshCompletion();
    expect(peekFreshCompletion()).toBe(true);
    expect(peekFreshCompletion()).toBe(true);
    clearFreshCompletion();
    expect(peekFreshCompletion()).toBe(false);
  });
});
```

`components/HeaderSessionAction.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import { HeaderSessionAction } from "./HeaderSessionAction";

describe("HeaderSessionAction", () => {
  it("shows შესვლა while signed out", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<HeaderSessionAction />);
    expect(await screen.findByRole("link", { name: "შესვლა" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
  it("swaps to კაბინეტი when a session exists", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "x" } } } });
    render(<HeaderSessionAction />);
    expect(await screen.findByRole("link", { name: "კაბინეტი" })).toHaveAttribute("href", "/me");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/(public)/join/fresh-completion.test.ts" components/HeaderSessionAction.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `app/(public)/join/fresh-completion.ts`**

```ts
/**
 * One-shot "just completed the funnel" marker (spec §3.2). Step 3 sets it right
 * before navigating to /join/done|/join/pending; those screens render only when
 * it is present and forward to the cabinet otherwise. peek/clear are separate
 * because React StrictMode double-invokes render-phase initializers — peeking
 * must not consume.
 */
export const FRESH_COMPLETION_KEY = "gr:fresh-completion";

export function markFreshCompletion(): void {
  try {
    sessionStorage.setItem(FRESH_COMPLETION_KEY, "1");
  } catch {
    // storage unavailable → the completion screens will forward to the cabinet
  }
}

export function peekFreshCompletion(): boolean {
  try {
    return sessionStorage.getItem(FRESH_COMPLETION_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearFreshCompletion(): void {
  try {
    sessionStorage.removeItem(FRESH_COMPLETION_KEY);
  } catch {
    // nothing to clear
  }
}
```

- [ ] **Step 4: Create `components/HeaderSessionAction.tsx` and wire the header**

```tsx
"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ButtonLink";
import { createClient } from "@/lib/supabase/client";

/**
 * Session-aware header action (spec §3.1). Renders „შესვლა“ in the cached shell
 * and swaps after mount — the public shell must stay session-agnostic because
 * the service worker precaches it (same reason the funnel fetches client-side).
 */
export function HeaderSessionAction() {
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

  return signedIn ? (
    <ButtonLink href="/me" variant="ghost" size="sm">
      კაბინეტი
    </ButtonLink>
  ) : (
    <ButtonLink href="/login" variant="ghost" size="sm">
      შესვლა
    </ButtonLink>
  );
}
```

In `app/(public)/layout.tsx`: add `import { HeaderSessionAction } from "@/components/HeaderSessionAction";` and replace

```tsx
            <ButtonLink href="/login" variant="ghost" size="sm">
              შესვლა
            </ButtonLink>
```

with

```tsx
            <HeaderSessionAction />
```

(the „გახდი წევრი“ ButtonLink next to it stays).

- [ ] **Step 5: Point login + /join guards at `deriveDestination`**

`app/(public)/login/page.tsx` — replace the import line
`import { deriveFunnelStep, funnelRoute, type FunnelState } from "@/lib/funnel";` with

```ts
import { deriveDestination } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
```

and the body of `routeByFunnelState`'s tail (after the early-return error branch) from

```ts
    const state = data as unknown as FunnelState;
    router.replace(state.exists ? funnelRoute(deriveFunnelStep(state)) : "/join");
```

to

```ts
    router.replace(deriveDestination(data as unknown as FunnelState));
```

`app/(public)/join/JoinChoice.tsx` — swap the same import pair (`deriveFunnelStep, funnelRoute` → keep `isReferralCodeCandidate, type FunnelState` from `@/lib/funnel`, add `deriveDestination` from `@/lib/cabinet`) and change

```ts
      if (state.exists) router.replace(funnelRoute(deriveFunnelStep(state)));
```

to

```ts
      if (state.exists) router.replace(deriveDestination(state));
```

`app/(public)/join/useFunnelGuard.ts` — add `import { deriveDestination } from "@/lib/cabinet";`, drop `deriveFunnelStep`/`funnelRoute` from the `@/lib/funnel` import (keep `canAccess`, types), and change

```ts
        } else if (!canAccess(step, fetched)) {
          router.replace(funnelRoute(deriveFunnelStep(fetched)));
        }
```

to

```ts
        } else if (!canAccess(step, fetched)) {
          router.replace(deriveDestination(fetched));
        }
```

(Completed users hitting steps 1–3 now go straight to the cabinet with no intermediate hop; unfinished ones keep landing on their derived step — `deriveDestination` delegates to `deriveFunnelStep` for them.)

- [ ] **Step 6: One-time completion screens**

`app/(public)/join/step-3/page.tsx` — add `import { markFreshCompletion } from "../fresh-completion";` and in `complete()`, right before `router.replace(...)`:

```ts
    markFreshCompletion();
```

`app/(public)/join/done/page.tsx` — three changes: (1) new imports, (2) the one-shot gate, (3) cabinet buttons. Full new file:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "@/components/TransferInstructions";
import { deriveDestination } from "@/lib/cabinet";
import { clearFreshCompletion, peekFreshCompletion } from "../fresh-completion";
import { useFunnelGuard } from "../useFunnelGuard";

export default function DonePage() {
  const router = useRouter();
  const { state, ready } = useFunnelGuard("done");
  const [fresh] = useState(() => peekFreshCompletion()); // idempotent — StrictMode-safe

  useEffect(() => {
    clearFreshCompletion(); // consume once mounted; later visits forward below
  }, []);

  useEffect(() => {
    if (ready && state && !fresh) router.replace(deriveDestination(state));
  }, [ready, state, fresh, router]);

  if (!ready || !state || !fresh) return null;

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-10">
      <Card>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-ink">რეგისტრაცია დასრულებულია ✓</h2>
          <div className="mt-2">
            <Pill status="profile_completed" />
          </div>
        </div>
        <TransferInstructions tier={state.tier} referenceCode={state.referenceCode} />
        <p className="mt-4 text-sm text-muted-fg">
          დელეგატი:{" "}
          <strong className="text-ink" data-testid="chosen-delegate">
            {state.chosenDelegate
              ? `${state.chosenDelegate.firstName} ${state.chosenDelegate.lastName}`
              : "ცენტრალური მოძრაობა"}
          </strong>
        </p>
        <p className="mt-2 text-sm text-muted-fg">
          აქტიური წევრის სტატუსი გააქტიურდება პირველი შენატანის დადასტურების შემდეგ.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <ButtonLink href="/me/profile">ჩემი კაბინეტი</ButtonLink>
          <ButtonLink href="/" variant="ghost">
            მთავარი გვერდი
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
```

`app/(public)/join/pending/page.tsx` — same one-shot gate pattern; the explainer now comes from the shared component (Task 5); buttons gain the returning „გადადი პანელზე“. Full new file:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { PendingExplainer } from "@/components/PendingExplainer";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "@/components/TransferInstructions";
import { deriveDestination } from "@/lib/cabinet";
import { clearFreshCompletion, peekFreshCompletion } from "../fresh-completion";
import { useFunnelGuard } from "../useFunnelGuard";

export default function PendingPage() {
  const router = useRouter();
  const { state, ready } = useFunnelGuard("pending");
  const [fresh] = useState(() => peekFreshCompletion()); // idempotent — StrictMode-safe

  useEffect(() => {
    clearFreshCompletion();
  }, []);

  useEffect(() => {
    if (ready && state && !fresh) router.replace(deriveDestination(state));
  }, [ready, state, fresh, router]);

  if (!ready || !state || !fresh) return null;

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-10">
      <Card>
        <div className="text-center">
          <p className="text-5xl" aria-hidden>
            ⏳
          </p>
          <h2 className="mt-3 text-2xl font-bold text-ink">შენი დელეგატის პროფილი განიხილება</h2>
          <div className="mt-2">
            <Pill status="pending" />
          </div>
          <p className="mx-auto mt-3 max-w-prose text-sm text-muted-fg">
            რეგისტრაცია დასრულებულია — ახლა შენი მონაცემები გადამოწმების პროცესშია. სუპერ-ადმინი
            ადასტურებს დელეგატის იურიდიულ ვერიფიკაციას.
          </p>
        </div>
        <PendingExplainer />
        <TransferInstructions tier={state.tier} referenceCode={state.referenceCode} />
        <div className="mt-6 flex flex-col gap-2">
          <ButtonLink href="/delegate">გადადი პანელზე</ButtonLink>
          <ButtonLink href="/" variant="ghost">
            მთავარი გვერდი
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
```

- [ ] **Step 7: Run tests + typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS — the two new suites green, every existing suite green (nothing else changed behavior for unauthenticated/unfinished users).

- [ ] **Step 8: Format + commit**

```bash
npm run format
git add "app/(public)/" components/HeaderSessionAction.tsx components/HeaderSessionAction.test.tsx
git commit -m "feat: routing handoff — cabinet destinations, one-time completion screens, session header"
```

---

### Task 12: e2e — cabinet journey, delegate lifecycle, helper refactor, staging sweep

**Files:**
- Modify: `e2e/funnel-helpers.ts` (export step helpers, new journeys, `approveOwnDelegate`, `cleanupLoginUser`, `.order("id")` hygiene)
- Modify: `e2e/funnel.spec.ts` (import the moved helpers — no assertion changes)
- Modify: `e2e/login.spec.ts` (teardown fix)
- Create: `e2e/cabinet.spec.ts`, `e2e/delegate-panel.spec.ts`
- Create: `scripts/sweep-staging-e2e.mjs` (one-time staging hygiene, dry-run first)
- Check/modify: `playwright.config.ts` (spec files must not run in parallel — see Step 1)

**Interfaces:**
- Consumes: everything shipped in Tasks 1–11 plus the staging migration (Task 4).
- Produces: `passStep1(page, { phone, firstName, lastName })`, `fillStep2Basics(page, { personalId, regionLabel })` exported from `funnel-helpers.ts`; `JOURNEY` gains `cabinet: 5`, `panelDelegate: 6`, `viaLink: 7`; `approveOwnDelegate(phoneNational: string)`; `cleanupLoginUser()`.
- **Isolation invariants:** only per-run 55-block phones and 9-prefix personal IDs; `approveOwnDelegate` hard-refuses any phone not starting with `55`; every user this suite creates is deleted in teardown (memberships cascade); the canonical seed (12 approved delegates / 1636 actives) is never mutated.
- **Known impossibility, documented:** a completed member's *re-login* cannot be e2e'd on staging — the Phase 2 dev-OTP hardening 404s completed accounts by design. The login→cabinet mapping is covered by `deriveDestination` unit tests; e2e covers every same-session routing assertion instead.

- [ ] **Step 1: Serialize spec files if needed**

Open `playwright.config.ts`. The delegate-lifecycle spec temporarily makes a 13th approved delegate visible on public pages; `public.spec.ts` asserts the seeded counts. If the config does not already force one worker (`workers: 1`) or file-serial execution, set `workers: 1` at the top level with this comment: `// shared staging state (per-run users + seed-count assertions) — spec files must never overlap`. If `workers: 1` is already effective in CI, leave it and note that in the task report.

- [ ] **Step 2: Refactor `e2e/funnel-helpers.ts`**

(a) Add `import type { Page } from "@playwright/test";` and `import { expect } from "@playwright/test";` at the top.
(b) Move `passStep1` and `fillStep2Basics` VERBATIM from `e2e/funnel.spec.ts` into `funnel-helpers.ts`, exported; delete them from the spec and import instead (the spec's own assertions stay byte-identical).
(c) Extend the journey map:

```ts
export const JOURNEY = {
  member: 0,
  delegate: 1,
  duplicate: 2,
  resume: 3,
  referral: 4,
  cabinet: 5,
  panelDelegate: 6,
  viaLink: 7,
} as const;
```

(d) Hygiene item — in `getSeededReferral`, the delegates query gains a deterministic order: after `.eq("status", "approved")` add `.order("id")`.
(e) New helper — approval of the run's OWN delegate (the `approved_delegates_have_slug` CHECK requires a slug; use an obviously-synthetic unique one):

```ts
export async function approveOwnDelegate(phoneNational: string): Promise<void> {
  if (!phoneNational.startsWith("55")) {
    throw new Error(`refusing to approve non-e2e phone ${phoneNational}`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("approveOwnDelegate needs staging service credentials");
  const admin = createClient(url, key);
  const { data: rows, error: pErr } = await admin
    .from("profiles")
    .select("id")
    .in("phone", [`+995${phoneNational}`, `995${phoneNational}`]);
  if (pErr || !rows || rows.length !== 1) {
    throw new Error(`delegate profile lookup failed: ${pErr?.message ?? `rows=${rows?.length}`}`);
  }
  const { error } = await admin
    .from("delegates")
    .update({
      status: "approved",
      verified_at: new Date().toISOString(),
      slug: `e2e-delegate-${phoneNational}`,
    })
    .eq("id", rows[0]!.id);
  if (error) throw new Error(`approve failed: ${error.message}`);
}
```

(f) New helper — the login journey's auth user has NO profile row, so the existing profile-based cleanup never finds it (the one-orphan-per-run leak from Phase 2's review):

```ts
export async function cleanupLoginUser(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("login cleanup skipped: staging service credentials not in env");
    return;
  }
  const admin = createClient(url, key);
  const loginPhone = `995${LOGIN_PHONE}`; // auth stores phones without '+'
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || data.users.length === 0) return;
    const orphan = data.users.find((u) => u.phone === loginPhone);
    if (orphan) {
      await admin.auth.admin.deleteUser(orphan.id);
      return;
    }
    if (data.users.length < 1000) return;
  }
}
```

In `e2e/login.spec.ts` add:

```ts
import { test } from "@playwright/test";
import { cleanupLoginUser } from "./funnel-helpers";

test.afterAll(cleanupLoginUser);
```

(merge with the existing imports — `expect, test` are already imported; only add the helper import and the `afterAll` line).

- [ ] **Step 3: Create `e2e/cabinet.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import {
  cleanupJourneyUsers,
  fillStep2Basics,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  passStep1,
} from "./funnel-helpers";

test.describe.configure({ mode: "serial" });

test.beforeAll(cleanupJourneyUsers);
test.afterAll(cleanupJourneyUsers);

test("member cabinet: profile edit, delegate change, tier change, billing, one-way funnel", async ({
  page,
}) => {
  const phone = journeyPhone(JOURNEY.cabinet);

  // register a fresh member (tier 20, ცენტრალური მოძრაობა)
  await page.goto("/join/step-1?role=member");
  await passStep1(page, { phone, firstName: "ვატესტ", lastName: "კაბინეტს" });
  await expect(page).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(page, {
    personalId: journeyPersonalId(JOURNEY.cabinet),
    regionLabel: "თბილისი",
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("radio", { name: /20/ }).click();
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  // fresh completion still shows the one-time done screen, now with a cabinet button
  await expect(page).toHaveURL(/\/join\/done/);
  await page.getByRole("link", { name: "ჩემი კაბინეტი" }).click();
  await expect(page).toHaveURL(/\/me\/profile/);
  await expect(page.getByText("ვატესტ კაბინეტს")).toBeVisible();
  await expect(page.getByText("რეგისტრირებული").first()).toBeVisible();
  await expect(page.getByTestId("profile-pid")).toHaveValue("•••••••••••");

  // profile edit persists across reload
  await page.getByLabel("ქალაქი / მუნიციპალიტეტი").selectOption({ index: 2 });
  const cityValue = await page.getByLabel("ქალაქი / მუნიციპალიტეტი").inputValue();
  await page.getByLabel("სამუშაო ადგილი / სტატუსი").selectOption({ label: "პენსიონერი" });
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByTestId("profile-saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("ქალაქი / მუნიციპალიტეტი")).toHaveValue(cityValue);
  await expect(page.getByLabel("სამუშაო ადგილი / სტატუსი")).toHaveValue("პენსიონერი");

  // delegate change: central → first Tbilisi delegate (seeded, approved)
  await page.goto("/me/delegate");
  await expect(page.getByTestId("current-delegate")).toHaveText("ცენტრალური მოძრაობა");
  const picker = page.getByLabel("დელეგატი");
  await picker.selectOption({ index: 1 });
  const chosenLabel = (await picker.locator("option:checked").innerText()).trim();
  await page.getByRole("button", { name: "დელეგატის შეცვლა" }).click();
  await expect(page.getByTestId("change-delegate-message")).toHaveText("დელეგატი შეიცვალა ✓");
  await expect(page.getByTestId("current-delegate")).toHaveText(chosenLabel);

  // same-choice guard — no server call, polite Georgian refusal
  await picker.selectOption({ label: `${chosenLabel} (მიმდინარე)` });
  await page.getByRole("button", { name: "დელეგატის შეცვლა" }).click();
  await expect(page.getByTestId("change-delegate-message")).toHaveText("ეს დელეგატი უკვე არჩეულია");

  // billing: permanent code + placeholder-marked details + tier change 20 → 5
  await page.goto("/me/billing");
  await expect(page.getByTestId("reference-code")).toHaveText(/^GR-[A-HJKMNP-Z2-9]{6}$/);
  await expect(page.getByTestId("bank-placeholder")).toBeVisible();
  await expect(page.getByTestId("current-tier")).toContainText("20 ₾");
  await page.getByRole("button", { name: "შეცვლა" }).click();
  await page.getByRole("radio", { name: /5/ }).click();
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByText("საწევრო შეიცვალა ✓")).toBeVisible();
  await expect(page.getByTestId("current-tier")).toContainText("5 ₾");
  await expect(page.getByText("გადმორიცხე")).toContainText("5 ₾");
  await expect(page.getByTestId("billing-empty")).toBeVisible();

  // the funnel is one-way now; the header knows the session
  await page.goto("/join");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/join/done");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/delegate");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "კაბინეტი" })).toBeVisible();
});
```

- [ ] **Step 4: Create `e2e/delegate-panel.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import {
  approveOwnDelegate,
  cleanupJourneyUsers,
  fillStep2Basics,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  passStep1,
} from "./funnel-helpers";

test.describe.configure({ mode: "serial" });

test.beforeAll(cleanupJourneyUsers);
test.afterAll(cleanupJourneyUsers);

test("delegate lifecycle: pending panel → approval → live link → member via link → team", async ({
  browser,
}) => {
  const delegatePhone = journeyPhone(JOURNEY.panelDelegate);
  const delegateContext = await browser.newContext();
  const dPage = await delegateContext.newPage();

  // register the delegate end-to-end
  await dPage.goto("/join/step-1?role=delegate");
  await passStep1(dPage, { phone: delegatePhone, firstName: "ვატესტ", lastName: "პანელს" });
  await expect(dPage).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(dPage, {
    personalId: journeyPersonalId(JOURNEY.panelDelegate),
    regionLabel: "კახეთი",
  });
  await dPage.getByRole("checkbox").check();
  await dPage.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(dPage).toHaveURL(/\/join\/step-3/);
  await dPage.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();
  await expect(dPage).toHaveURL(/\/join\/pending/);

  // the pending screen's returning „გადადი პანელზე“ leads into the pending panel
  await dPage.getByRole("link", { name: "გადადი პანელზე" }).click();
  await expect(dPage).toHaveURL(/\/delegate$/);
  await expect(dPage.getByText("განხილვის პროცესში").first()).toBeVisible();
  await expect(dPage.getByText("რეფერალური ბმული ჯერ დეაქტივირებულია.")).toBeVisible();
  await expect(dPage.getByTestId("referral-url")).toHaveCount(0);

  // approve OUR OWN e2e delegate via service role (seed untouched; teardown deletes)
  await approveOwnDelegate(delegatePhone);
  await dPage.reload();
  await expect(dPage.getByText("დამტკიცებული").first()).toBeVisible();
  const url = (await dPage.getByTestId("referral-url").innerText()).trim();
  expect(url).toMatch(/\/join\?ref=/);
  await expect(dPage.getByRole("img", { name: "რეფერალური ბმულის QR კოდი" })).toBeVisible();

  // a member registers THROUGH the live link in a separate browser context
  const ref = new URL(url).searchParams.get("ref");
  expect(ref).toBeTruthy();
  const memberContext = await browser.newContext();
  const mPage = await memberContext.newPage();
  await mPage.goto(`/join?ref=${encodeURIComponent(ref!)}`);
  await expect(mPage).toHaveURL(/\/join\/step-1\?ref=/);
  await passStep1(mPage, {
    phone: journeyPhone(JOURNEY.viaLink),
    firstName: "ვატესტ",
    lastName: "ბმულით",
  });
  await expect(mPage).toHaveURL(/\/join\/step-2/);
  await expect(mPage.getByText("ვატესტ პანელს")).toBeVisible(); // read-only referral card
  await fillStep2Basics(mPage, {
    personalId: journeyPersonalId(JOURNEY.viaLink),
    regionLabel: "თბილისი",
  });
  await mPage.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(mPage).toHaveURL(/\/join\/step-3/);
  await mPage.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();
  await expect(mPage).toHaveURL(/\/join\/done/);
  await expect(mPage.getByTestId("chosen-delegate")).toHaveText("ვატესტ პანელს");
  await memberContext.close();

  // the delegate's team reflects the new member instantly
  await dPage.goto("/delegate/team");
  await expect(dPage.getByTestId("team-count")).toHaveText("1");
  await expect(dPage.getByText("ვატესტ ბმულით")).toBeVisible();
  await expect(dPage.getByText("რეგისტრირებული")).toBeVisible();
  await dPage.getByLabel("ძებნა სახელით ან გვარით").fill("არავინა");
  await expect(dPage.getByTestId("team-no-results")).toBeVisible();
  await delegateContext.close();
});
```

- [ ] **Step 5: Run the full e2e suite against staging (dev server)**

```bash
npx playwright test
```

Expected: ALL specs pass — the 16 existing (funnel 5 journeys, login, public, smoke) unchanged and green, plus the 2 new files. Existing funnel assertions need **no changes**: fresh completions still render done/pending (the step-3 marker is set), and nothing in the old suite revisits a completion screen afterwards. If any old spec fails, the routing change broke a contract — fix the app, not the spec, unless the spec asserted the explicitly-changed destination.

- [ ] **Step 6: One-time staging sweep — create `scripts/sweep-staging-e2e.mjs`**

```js
// One-time staging hygiene (Phase 3, spec §8): delete accumulated e2e users —
// 55-block phones / 9-prefixed personal IDs / login-journey auth orphans —
// keeping the canonical seed and the three owner smoke users. DRY RUN unless --apply.
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)");
}
const db = createClient(url, key);

const KEEP_PHONES = new Set([
  "+995551234567", "+995551234568", "+995551234569",
  "995551234567", "995551234568", "995551234569",
]);

const doomed = new Map(); // id → reason

const { data: phoneRows, error: e1 } = await db
  .from("profiles")
  .select("id, phone, personal_id")
  .or("phone.like.+99555%,phone.like.99555%");
if (e1) throw e1;
for (const p of phoneRows ?? []) {
  if (p.phone && KEEP_PHONES.has(p.phone)) continue;
  doomed.set(p.id, `phone ${p.phone}`);
}

const { data: pidRows, error: e2 } = await db
  .from("profiles")
  .select("id, phone, personal_id")
  .like("personal_id", "9%");
if (e2) throw e2;
for (const p of pidRows ?? []) {
  if (p.phone && KEEP_PHONES.has(p.phone)) continue;
  doomed.set(p.id, `personal_id ${p.personal_id}`);
}

for (let page = 1; page <= 50; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) {
    if (!u.phone || !u.phone.startsWith("99555")) continue;
    if (KEEP_PHONES.has(u.phone) || KEEP_PHONES.has(`+${u.phone}`)) continue;
    if (!doomed.has(u.id)) doomed.set(u.id, `auth user ${u.phone} (no matched profile filter)`);
  }
  if (data.users.length < 1000) break;
}

console.log(`${APPLY ? "DELETING" : "DRY RUN"}: ${doomed.size} users`);
for (const [id, reason] of doomed) console.log(`  ${id} — ${reason}`);
if (APPLY) {
  for (const [id] of doomed) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) console.error(`  FAILED ${id}: ${error.message}`);
  }
}

const { data: stats, error: e3 } = await db.from("public_stats").select("*").single();
if (e3) throw e3;
console.log(
  `seed check: approved_delegates=${stats.approved_delegates} active_members=${stats.active_members} (expect 12 / 1636)`,
);
```

Run it:

```bash
node --env-file=.env.local scripts/sweep-staging-e2e.mjs           # dry run — review the list
node --env-file=.env.local scripts/sweep-staging-e2e.mjs --apply   # delete
node --env-file=.env.local scripts/sweep-staging-e2e.mjs           # dry run again — expect 0
```

Expected: the final dry run reports 0 users and `seed check: approved_delegates=12 active_members=1636`. The three smoke users survive (they're inside the 55-block — that's exactly why the keep-list exists).

- [ ] **Step 7: Format + commit**

```bash
npm run format
git add e2e/ scripts/sweep-staging-e2e.mjs playwright.config.ts
git commit -m "test: cabinet + delegate-lifecycle e2e, login teardown fix, staging sweep"
```

---

### Task 13: OTP-component minors, docs, version — ship prep

**Files:**
- Modify: `components/OtpVerification.tsx` (three queued minors from Phase 2's final review)
- Modify: `ARCHITECTURE.md`, `CHANGELOG.md`, `package.json` (version)

- [ ] **Step 1: OtpVerification robustness minors (verify each against current code first — the `.catch` one was already fixed in Phase 2's fix wave)**

(a) Unmount guard on the dev-code fetch — inside `fetchDevOtp`, the `setDevOtp(data.otp)` call must not fire after unmount. Convert the component to track mount state:

```tsx
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
```

and in `fetchDevOtp` change `if (data.otp) setDevOtp(data.otp);` → `if (data.otp && mountedRef.current) setDevOtp(data.otp);` (add `useRef` to the react import).

(b) `resend()` sets busy during its network call:

```tsx
  async function resend() {
    if (cooldown > 0 || busy) return;
    setError(undefined);
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (err) {
      setError("კოდი უკვე გაიგზავნა — სცადე ერთ წუთში");
      return;
    }
    setCooldown(RESEND_COOLDOWN_S);
    void fetchDevOtp();
  }
```

(c) The eslint-disable gains the repo's `-- reason` suffix:

```tsx
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dev-code fetch is intentionally fire-and-forget on mount
```

Run: `npx vitest run components/ && npm run typecheck` — expected PASS (OtpInput/OtpVerification suites unchanged).

- [ ] **Step 2: ARCHITECTURE.md — append the Cabinets section** (after the "Registration funnel (Phase 2)" section):

```markdown
## Cabinets (Phase 3)

/me/* (member) and /delegate/* (delegate panel) are per-request server-rendered
behind layout gates (session + completed registration + role) — safe because the
service worker treats them NetworkOnly. DB access is a mixed model (ADR-013):
the five plain profile fields update through a column-scoped grant + own-row RLS
+ the protect-columns trigger; compound writes (member_change_delegate =
close-then-open membership history; member_change_tier) and delegate reads
(delegate_panel / delegate_team — the only client path to the caller's referral
code) are SECURITY DEFINER RPCs. funnel_state() also returns
status/registrationCompletedAt/createdAt. deriveDestination (lib/cabinet.ts)
sends completed users to their cabinet from login, /join and the funnel guards;
the funnel is one-way — done/pending render once via a sessionStorage marker set
by step 3. The public header swaps შესვლა→კაბინეტი client-side (the cached shell
stays session-agnostic). Dashboard rank reuses lib/ranking over public_delegates,
so it can never disagree with the leaderboard.
```

- [ ] **Step 3: CHANGELOG.md — prepend the 0.4.0 entry** (use the actual current date):

```markdown
## 0.4.0 — 2026-07-15 (Phase 3: cabinets)

- Member cabinet: profile editing (five scoped fields; phone + personal ID
  visibly locked), delegate change with full history and instant counters,
  payments page — permanent GR-code + transfer instructions + tier change +
  honest empty history.
- Delegate panel: live referral link + QR (uqr, ADR-011), live counts
  (active / total / drafts), leaderboard-consistent rank, searchable team
  table; pending and rejected states; sign-out.
- Referral links live end-to-end; login/funnel handoff — completed users land
  in the cabinet, the funnel is one-way; session-aware public header.
- DB: column-scoped profile UPDATE re-grant + four cabinet RPCs (ADR-013);
  funnel_start referral-input cap; funnel_state exposes status + timestamps.
- Hygiene: typed Database generic on all supabase factories; staging e2e-user
  sweep + login e2e teardown fix; REFERENCE_CODE_RE derived from the alphabet;
  deterministic seeded-referral pick; OtpVerification robustness minors;
  TransferInstructions shared.
```

- [ ] **Step 4: Version bump**

In `package.json`: `"version": "0.3.0"` → `"version": "0.4.0"`.

- [ ] **Step 5: Full gate + commit**

```bash
npm run format && npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build
```

Expected: every gate green (build includes the SW postbuild step).

```bash
git add components/OtpVerification.tsx ARCHITECTURE.md CHANGELOG.md package.json
git commit -m "chore: v0.4.0 — cabinets ship prep (OTP minors, docs, version)"
```

---

## After all tasks

1. **Whole-branch review** (superpowers:requesting-code-review): fresh reviewer over `main..HEAD` against the spec; triage findings — fix Critical/Important now, defer minors with reasons into `.superpowers/sdd/progress.md` (the SDD ledger tracks per-task state throughout).
2. **Push + PR**: `git push -u origin claude/phase-3-cabinets-a070f4`; single PR titled `Phase 3 — Cabinets (v0.4.0)`; body = plain-language summary (what a member can now do, what a delegate can now do, the routing handoff), the DB changes list, test counts, and the standard footer (`🤖 Generated with [Claude Code](https://claude.com/claude-code)`). **Never merge with failing CI; never push to main.**
3. **CI green** (typecheck / lint / format / unit / build / e2e vs staging). Remember: `npm run format` before every push — format drift fails CI.
4. **Preview QA on the Vercel preview URL** (against staging): register a fresh member (owner-instructions phone pattern `5XXXXXXXX`), walk profile edit → delegate change → billing (code + placeholder + tier change); register + service-approve an e2e delegate, open its panel, register a member through the live link, verify the team table. All evidence gathered via DOM checks (no screenshots — owner's machine constraint).
5. **Owner sign-off package in chat** (plain language + clickable URLs): the preview link, the demo member's and demo delegate's exact page URLs with what each shows, the counter nuance spelled out (team counts move instantly; the public rating counts only *active* paying members, so it moves when Phase 4 records payments), self-try instructions. **Merge only after the owner explicitly approves in chat.** Squash-merge as `Phase 3 — Cabinets (v0.4.0)`, tag `v0.4.0`.
6. After merge: update the auto-memory entry (phase complete, key facts learned) and prune stale worktrees when the owner asks.





