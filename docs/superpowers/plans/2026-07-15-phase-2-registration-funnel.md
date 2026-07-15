# Phase 2 — Registration Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/join` "opening soon" page with the real 3-step registration funnel (member + delegate variants): contact + staged OTP with resumable server-side drafts, legal profile with duplicate checks and delegate binding, membership tier + manual bank-transfer instructions with a unique per-member `GR-XXXXXX` reference code.

**Architecture:** "Fortress database" — every funnel mutation is one SECURITY DEFINER Postgres RPC (atomic, all rules in-DB, subject always `auth.uid()`); thin zod-validated server actions in front; funnel pages are client components that fetch state on mount (never server-redirect guards). Pure step-derivation/validation logic lives in `lib/`. The Phase 0 dev-OTP oracle closes in the same PR.

**Tech Stack:** Next.js 16 (App Router), TypeScript 6 strict, Tailwind 4, Supabase (`@supabase/ssr` + RPCs), zod, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-15-phase-2-registration-funnel-design.md` — binding. UX reference: `prototype/index.html` screens `join`, `join-step-1..3`, `join-pending` (approved deviations listed in the spec header).

## Global Constraints

- TypeScript `strict: true`; **no `any`, no `@ts-ignore`**.
- Domain logic = pure functions in `lib/` — no React/Next imports there (`lib/supabase/` is the sanctioned data-access location).
- **All user-facing text Georgian.** Reuse design-system components (DESIGN.md); extend, never restyle ad hoc. Button/ButtonLink size via the `size` prop only.
- Schema changes ONLY via `supabase/migrations/`. Local dev + previews + CI all use the STAGING Supabase project (`orcxtbedkexoclbfgvzd`).
- **No new npm dependencies** (zod is already a dependency).
- zod validation at every boundary: the same schemas drive client forms and server actions; the DB re-validates inside RPCs. Server is the source of truth.
- Funnel pages: client-side state fetch on mount; guards are client-side redirects (`useFunnelGuard`). No `cookies()`/`headers()` in any funnel page component. Public non-funnel pages keep their ISR (`revalidate = 60`) untouched.
- Statuses/counters stay derived. Nothing in this phase stores a computed value or sets `active_member`.
- TDD: write the failing test first, run it, watch it fail, then implement. Frequent commits (conventional style); each task ends committed.
- Working directory: repo root (worktree branch `claude/republic-registration-phase-2-4f2474`).
- Steps marked **[OWNER-ASSIST]** need the owner (DB password / dashboard). Pause and give exact plain-language instructions.
- The canonical staging seed (12 approved delegates, home counters) must never be disturbed; e2e uses only per-run `55XXXXXXX` phones and `9…` personal IDs.

---

### Task 1: Funnel domain logic (`lib/funnel.ts`)

**Files:**
- Create: `lib/funnel.ts`
- Test: `lib/funnel.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2, 4–9, 11):
  - `TIERS: readonly [5, 10, 20]`, `type Tier = 5 | 10 | 20`
  - `FUNNEL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"`
  - `type FunnelRole = "member" | "delegate"`, `type FunnelStep = "step-1" | "step-2" | "step-3" | "done" | "pending"`
  - `interface FunnelState` (exact shape below — mirrors the `funnel_state()` RPC jsonb)
  - `deriveFunnelStep(state: FunnelState | null): FunnelStep`
  - `funnelRoute(step: FunnelStep): string`
  - `canAccess(step: FunnelStep, state: FunnelState | null): boolean`
  - `isReferenceCode(value: string): boolean`, `isReferralCodeCandidate(value: string): boolean`
  - `mapFunnelError(message: string | null | undefined): string`, `GENERIC_FUNNEL_ERROR`

- [ ] **Step 1: Write the failing test — `lib/funnel.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  canAccess,
  deriveFunnelStep,
  funnelRoute,
  GENERIC_FUNNEL_ERROR,
  isReferenceCode,
  isReferralCodeCandidate,
  mapFunnelError,
  TIERS,
  type FunnelState,
} from "./funnel";

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
    delegateStatus: null,
    referral: null,
    chosenDelegate: null,
    membershipExists: false,
    ...overrides,
  };
}

describe("deriveFunnelStep", () => {
  it("no state or no profile → step-1", () => {
    expect(deriveFunnelStep(null)).toBe("step-1");
    expect(deriveFunnelStep(state({ exists: false }))).toBe("step-1");
  });
  it("profile without personal ID → step-2", () => {
    expect(deriveFunnelStep(state({}))).toBe("step-2");
  });
  it("personal ID saved but not completed → step-3", () => {
    expect(deriveFunnelStep(state({ personalIdSet: true }))).toBe("step-3");
  });
  it("completed member → done; completed delegate → pending", () => {
    expect(deriveFunnelStep(state({ personalIdSet: true, completed: true }))).toBe("done");
    expect(
      deriveFunnelStep(
        state({ role: "delegate", personalIdSet: true, completed: true, delegateStatus: "pending" }),
      ),
    ).toBe("pending");
  });
  it("legacy active_member without funnel data counts as completed (spec §3.8)", () => {
    // funnel_state() sets completed=true for status='active_member'; lib trusts the flag
    expect(deriveFunnelStep(state({ personalIdSet: true, completed: true, tier: null }))).toBe("done");
  });
});

describe("funnelRoute", () => {
  it("maps every step to its route", () => {
    expect(funnelRoute("step-1")).toBe("/join/step-1");
    expect(funnelRoute("step-2")).toBe("/join/step-2");
    expect(funnelRoute("step-3")).toBe("/join/step-3");
    expect(funnelRoute("done")).toBe("/join/done");
    expect(funnelRoute("pending")).toBe("/join/pending");
  });
});

describe("canAccess", () => {
  it("current step is always accessible", () => {
    expect(canAccess("step-1", null)).toBe(true);
    expect(canAccess("step-2", state({}))).toBe(true);
  });
  it("step-2 stays editable from step-3 (back navigation)", () => {
    expect(canAccess("step-2", state({ personalIdSet: true }))).toBe(true);
  });
  it("everything else redirects", () => {
    expect(canAccess("step-3", state({}))).toBe(false);
    expect(canAccess("done", state({ personalIdSet: true }))).toBe(false);
    expect(canAccess("step-2", state({ personalIdSet: true, completed: true }))).toBe(false);
  });
});

describe("code formats", () => {
  it("accepts valid reference codes", () => {
    expect(isReferenceCode("GR-7K3M9Q")).toBe(true);
    expect(isReferenceCode("GR-ABCDEF")).toBe(true);
  });
  it("rejects confusable characters I, L, O, 0, 1 and bad shapes", () => {
    for (const bad of ["GR-7K3M9L", "GR-7K3M9I", "GR-7K3M9O", "GR-7K3M90", "GR-7K3M91"]) {
      expect(isReferenceCode(bad)).toBe(false);
    }
    expect(isReferenceCode("GR-7K3M9")).toBe(false);
    expect(isReferenceCode("XX-7K3M9Q")).toBe(false);
    expect(isReferenceCode("gr-7k3m9q")).toBe(false);
  });
  it("referral candidates: new 6-char codes and seeded D-codes pass, junk fails", () => {
    expect(isReferralCodeCandidate("7K3M9Q")).toBe(true);
    expect(isReferralCodeCandidate("D00101")).toBe(true);
    expect(isReferralCodeCandidate("")).toBe(false);
    expect(isReferralCodeCandidate("has space")).toBe(false);
    expect(isReferralCodeCandidate("x".repeat(33))).toBe(false);
  });
});

describe("mapFunnelError", () => {
  it("maps RPC error tokens to Georgian messages", () => {
    expect(mapFunnelError("P0001: duplicate_personal_id")).toBe(
      "ეს პირადი ნომერი უკვე რეგისტრირებულია.",
    );
    expect(mapFunnelError("terms_required")).toBe("საჭიროა წესებზე თანხმობა.");
  });
  it("unknown/empty → generic Georgian error", () => {
    expect(mapFunnelError("something weird")).toBe(GENERIC_FUNNEL_ERROR);
    expect(mapFunnelError(undefined)).toBe(GENERIC_FUNNEL_ERROR);
  });
});

describe("TIERS", () => {
  it("is exactly 5/10/20", () => {
    expect([...TIERS]).toEqual([5, 10, 20]);
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- lib/funnel.test.ts`. Expected: FAIL — cannot resolve `./funnel`.
- [ ] **Step 3: Implement `lib/funnel.ts`**

```ts
export const TIERS = [5, 10, 20] as const;
export type Tier = (typeof TIERS)[number];

/** Crockford-style: no I, L, O, 0, 1 — 31 unambiguous characters. DB mirror: gen_funnel_code(). */
export const FUNNEL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type FunnelRole = "member" | "delegate";
export type FunnelStep = "step-1" | "step-2" | "step-3" | "done" | "pending";

export interface FunnelReferral {
  firstName: string;
  lastName: string;
  regionNameKa: string;
}

export interface FunnelChosenDelegate {
  id: string;
  firstName: string;
  lastName: string;
}

/** Mirrors the funnel_state() RPC jsonb exactly (keys are camelCase in SQL). */
export interface FunnelState {
  exists: boolean;
  role: FunnelRole;
  firstName: string;
  lastName: string;
  personalIdSet: boolean;
  birthDate: string | null; // "YYYY-MM-DD"
  regionId: number | null;
  cityId: number | null;
  employment: string | null;
  tier: Tier | null;
  referenceCode: string | null;
  completed: boolean;
  delegateStatus: "pending" | "approved" | "rejected" | null;
  referral: FunnelReferral | null;
  chosenDelegate: FunnelChosenDelegate | null; // null = ცენტრალური მოძრაობა (or none yet)
  membershipExists: boolean;
}

export function deriveFunnelStep(state: FunnelState | null): FunnelStep {
  if (!state || !state.exists) return "step-1";
  if (state.completed) return state.role === "delegate" ? "pending" : "done";
  if (!state.personalIdSet) return "step-2";
  return "step-3";
}

export function funnelRoute(step: FunnelStep): string {
  return `/join/${step}`;
}

/** Which funnel screen a state may open; anything else redirects to the derived step. */
export function canAccess(step: FunnelStep, state: FunnelState | null): boolean {
  const current = deriveFunnelStep(state);
  if (step === current) return true;
  // step 2 stays editable until completion (back navigation from step 3)
  return step === "step-2" && current === "step-3";
}

const REFERENCE_CODE_RE = /^GR-[A-HJKMNP-Z2-9]{6}$/;

export function isReferenceCode(value: string): boolean {
  return REFERENCE_CODE_RE.test(value);
}

/** Loose sanity check for ?ref= values — covers new 6-char codes and seeded D00101-style. */
export function isReferralCodeCandidate(value: string): boolean {
  return /^[A-Za-z0-9-]{1,32}$/.test(value);
}

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  duplicate_personal_id: "ეს პირადი ნომერი უკვე რეგისტრირებულია.",
  invalid_personal_id: "პირადი ნომერი უნდა იყოს 11 ციფრი.",
  invalid_birth_date: "მიუთითე დაბადების თარიღი.",
  invalid_employment: "მიუთითე საქმიანობა.",
  invalid_city: "აირჩიე ქალაქი არჩეული მხარიდან.",
  invalid_delegate: "არჩეული დელეგატი ვერ მოიძებნა — სცადე თავიდან.",
  terms_required: "საჭიროა წესებზე თანხმობა.",
  invalid_tier: "აირჩიე საწევრო პაკეტი.",
  profile_incomplete: "ჯერ შეავსე წინა ნაბიჯები.",
  already_completed: "რეგისტრაცია უკვე დასრულებულია.",
  not_authenticated: "სესია ამოიწურა — დაადასტურე ნომერი თავიდან.",
  invalid_role: "დაფიქსირდა შეცდომა — სცადე თავიდან.",
  invalid_name: "შეავსე სახელი და გვარი.",
};

export const GENERIC_FUNNEL_ERROR = "რაღაც შეცდომა მოხდა — სცადე თავიდან.";

export function mapFunnelError(message: string | null | undefined): string {
  if (!message) return GENERIC_FUNNEL_ERROR;
  for (const [token, ka] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(token)) return ka;
  }
  return GENERIC_FUNNEL_ERROR;
}
```

- [ ] **Step 4: Run to verify pass.** Run: `npm run test -- lib/funnel.test.ts`. Expected: all PASS.
- [ ] **Step 5: Commit**

```bash
git add lib/funnel.ts lib/funnel.test.ts
git commit -m "feat: funnel step derivation, code formats, error mapping (TDD)"
```

### Task 2: Zod boundary schemas + bank details (`lib/funnel-schemas.ts`, `lib/bank-details.ts`)

**Files:**
- Create: `lib/funnel-schemas.ts`, `lib/bank-details.ts`
- Test: `lib/funnel-schemas.test.ts`

**Interfaces:**
- Consumes: `TIERS`, `Tier` from `lib/funnel.ts` (Task 1); `normalizeGeorgianPhone` from `lib/validation.ts` (existing).
- Produces (consumed by Tasks 5–9):
  - `contactSchema` — `{ firstName, lastName, phone }`; `.parse` output has `phone` already normalized to E.164 (`+9955XXXXXXXX`)
  - `otpSchema` — `{ code: string }` (exactly 6 digits)
  - `startSchema` — `{ firstName, lastName, role: "member"|"delegate", refCode?: string | null }`
  - `profileActionSchema` — discriminated union on `role`:
    member `{ role:"member", personalId, birthDate, regionId, cityId, employment, delegateId: string|null }`,
    delegate `{ role:"delegate", personalId, birthDate, regionId, cityId, employment, tcAccepted: true }`
  - `tierSchema` — `{ tier: 5|10|20 }`
  - `BANK_DETAILS: { placeholder: boolean; recipientName: string; bankName: string; iban: string }`
  - `EMPLOYMENT_PRESETS: readonly string[]` (the prototype's five)

- [ ] **Step 1: Write the failing test — `lib/funnel-schemas.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  contactSchema,
  EMPLOYMENT_PRESETS,
  otpSchema,
  profileActionSchema,
  startSchema,
  tierSchema,
} from "./funnel-schemas";
import { BANK_DETAILS } from "./bank-details";

const validProfileBase = {
  personalId: "01001234567",
  birthDate: "1990-05-20",
  regionId: 1,
  cityId: 3,
  employment: "სტუდენტი",
};

describe("contactSchema", () => {
  it("accepts and normalizes a Georgian phone in any common format", () => {
    for (const input of ["599 12 34 56", "+995599123456", "995599123456"]) {
      const parsed = contactSchema.parse({ firstName: "ნინო", lastName: "ბერიძე", phone: input });
      expect(parsed.phone).toBe("+995599123456");
    }
  });
  it("trims names and rejects empty or over-long ones", () => {
    const ok = contactSchema.parse({ firstName: " ნინო ", lastName: "ბერიძე", phone: "599123456" });
    expect(ok.firstName).toBe("ნინო");
    expect(
      contactSchema.safeParse({ firstName: "", lastName: "ბ", phone: "599123456" }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ firstName: "ა".repeat(61), lastName: "ბ", phone: "599123456" })
        .success,
    ).toBe(false);
  });
  it("rejects non-Georgian-mobile phones", () => {
    expect(
      contactSchema.safeParse({ firstName: "ა", lastName: "ბ", phone: "499123456" }).success,
    ).toBe(false);
  });
});

describe("otpSchema", () => {
  it("requires exactly 6 digits", () => {
    expect(otpSchema.safeParse({ code: "123456" }).success).toBe(true);
    expect(otpSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(otpSchema.safeParse({ code: "12345a" }).success).toBe(false);
  });
});

describe("startSchema", () => {
  it("accepts both roles and an optional ref code", () => {
    expect(
      startSchema.safeParse({ firstName: "ა", lastName: "ბ", role: "member", refCode: "D00101" })
        .success,
    ).toBe(true);
    expect(
      startSchema.safeParse({ firstName: "ა", lastName: "ბ", role: "delegate" }).success,
    ).toBe(true);
    expect(
      startSchema.safeParse({ firstName: "ა", lastName: "ბ", role: "admin" }).success,
    ).toBe(false);
    expect(
      startSchema.safeParse({ firstName: "ა", lastName: "ბ", role: "member", refCode: "bad ref!" })
        .success,
    ).toBe(false);
  });
});

describe("profileActionSchema", () => {
  it("accepts a valid member payload (delegateId null = central)", () => {
    expect(
      profileActionSchema.safeParse({ role: "member", ...validProfileBase, delegateId: null })
        .success,
    ).toBe(true);
    expect(
      profileActionSchema.safeParse({
        role: "member",
        ...validProfileBase,
        delegateId: "2f6ae2f0-31a5-4f0f-9b60-2f4bb3170500",
      }).success,
    ).toBe(true);
  });
  it("delegate payload requires tcAccepted literally true", () => {
    expect(
      profileActionSchema.safeParse({ role: "delegate", ...validProfileBase, tcAccepted: true })
        .success,
    ).toBe(true);
    expect(
      profileActionSchema.safeParse({ role: "delegate", ...validProfileBase, tcAccepted: false })
        .success,
    ).toBe(false);
  });
  it("rejects bad personal IDs, future birth dates, empty employment", () => {
    expect(
      profileActionSchema.safeParse({
        role: "member",
        ...validProfileBase,
        personalId: "123",
        delegateId: null,
      }).success,
    ).toBe(false);
    expect(
      profileActionSchema.safeParse({
        role: "member",
        ...validProfileBase,
        birthDate: "2999-01-01",
        delegateId: null,
      }).success,
    ).toBe(false);
    expect(
      profileActionSchema.safeParse({
        role: "member",
        ...validProfileBase,
        employment: "  ",
        delegateId: null,
      }).success,
    ).toBe(false);
  });
});

describe("tierSchema", () => {
  it("accepts only 5, 10, 20", () => {
    expect(tierSchema.safeParse({ tier: 10 }).success).toBe(true);
    expect(tierSchema.safeParse({ tier: 15 }).success).toBe(false);
  });
});

describe("bank details + employment presets", () => {
  it("bank details module has the full display shape", () => {
    expect(typeof BANK_DETAILS.placeholder).toBe("boolean");
    expect(BANK_DETAILS.recipientName.length).toBeGreaterThan(0);
    expect(BANK_DETAILS.bankName.length).toBeGreaterThan(0);
    expect(BANK_DETAILS.iban.length).toBeGreaterThan(0);
  });
  it("employment presets are the prototype's five", () => {
    expect([...EMPLOYMENT_PRESETS]).toEqual([
      "დასაქმებული",
      "თვითდასაქმებული",
      "სტუდენტი",
      "პენსიონერი",
      "დროებით უმუშევარი",
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- lib/funnel-schemas.test.ts`. Expected: FAIL — cannot resolve `./funnel-schemas`.
- [ ] **Step 3: Implement `lib/funnel-schemas.ts`**

```ts
import { z } from "zod";
import { normalizeGeorgianPhone } from "./validation";

export const EMPLOYMENT_PRESETS = [
  "დასაქმებული",
  "თვითდასაქმებული",
  "სტუდენტი",
  "პენსიონერი",
  "დროებით უმუშევარი",
] as const;

const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "შეავსე ეს ველი" })
  .max(60, { message: "მაქსიმუმ 60 სიმბოლო" });

const phoneSchema = z
  .string()
  .refine((v) => normalizeGeorgianPhone(v) !== null, {
    message: "შეიყვანეთ ქართული მობილურის ნომერი (5XX XX XX XX)",
  })
  .transform((v) => {
    const normalized = normalizeGeorgianPhone(v);
    if (normalized === null) throw new Error("unreachable: refine guarantees a valid phone");
    return normalized;
  });

export const contactSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
});

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { message: "შეიყვანე 6-ნიშნა კოდი" }),
});

const refCodeSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,32}$/, { message: "არასწორი რეფერალური კოდი" });

export const startSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  role: z.enum(["member", "delegate"]),
  refCode: refCodeSchema.nullish(),
});

const profileBase = {
  personalId: z.string().regex(/^\d{11}$/, { message: "პირადი ნომერი უნდა იყოს 11 ციფრი." }),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "მიუთითე დაბადების თარიღი." })
    .refine(
      (v) => v >= "1900-01-01" && v < new Date().toISOString().slice(0, 10),
      { message: "თარიღი უნდა იყოს წარსულში." },
    ),
  regionId: z.number().int().positive({ message: "აირჩიე მხარე." }),
  cityId: z.number().int().positive({ message: "აირჩიე ქალაქი." }),
  employment: z
    .string()
    .trim()
    .min(1, { message: "მიუთითე საქმიანობა." })
    .max(100, { message: "მაქსიმუმ 100 სიმბოლო" }),
};

export const profileActionSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("member"),
    ...profileBase,
    delegateId: z.string().uuid({ message: "არასწორი დელეგატი" }).nullable(),
  }),
  z.object({
    role: z.literal("delegate"),
    ...profileBase,
    tcAccepted: z.literal(true, { message: "საჭიროა წესებზე თანხმობა." }),
  }),
]);

export const tierSchema = z.object({
  tier: z.union([z.literal(5), z.literal(10), z.literal(20)], {
    message: "აირჩიე საწევრო პაკეტი.",
  }),
});
```

> Note for the implementer: the repo's installed zod major decides the message-option
> spelling. If `{ message }` raises type errors on `z.literal`/`z.union` (zod v4 moved to
> `{ error }`), switch those two call sites to `{ error: "…" }` — keep the identical
> Georgian strings. Do not add a zod version pin.

- [ ] **Step 4: Implement `lib/bank-details.ts`**

```ts
/**
 * Recipient details for manual membership transfers, shown on the funnel
 * completion screens. PLACEHOLDER until the owner opens the account —
 * swapping in real details means editing ONLY this file and setting
 * `placeholder: false` (spec §2 decision #1; Phase 6 launch-checklist item).
 */
export const BANK_DETAILS = {
  placeholder: true,
  recipientName: "ააიპ „ქართული რესპუბლიკა“ (დროებითი)",
  bankName: "საბანკო რეკვიზიტები ზუსტდება",
  iban: "GE00 XXXX 0000 0000 0000 00",
} as const;
```

- [ ] **Step 5: Run to verify pass.** Run: `npm run test -- lib/funnel-schemas.test.ts`. Expected: all PASS. Also run `npm run typecheck`.
- [ ] **Step 6: Commit**

```bash
git add lib/funnel-schemas.ts lib/funnel-schemas.test.ts lib/bank-details.ts
git commit -m "feat: zod funnel boundary schemas + placeholder bank details (TDD)"
```

### Task 3: Migration — funnel columns, RPCs, hardening riders (+ apply to staging)

**Files:**
- Create: `supabase/migrations/20260715120000_registration_funnel.sql`
- Modify: `scripts/verify-schema.mjs` (append funnel probes), `scripts/seed-staging.mjs` (delegates' profile rows gain `signup_role`), `DECISIONS.md` (ADR-009, ADR-010)
- Test: `node --env-file=.env.local scripts/verify-schema.mjs` against staging

**Interfaces:**
- Consumes: existing tables/triggers from `20260712212409_initial_schema.sql` and `20260713175043_public_read_model.sql`.
- Produces (consumed by Tasks 6–11): RPCs `funnel_start(p_first_name text, p_last_name text, p_role text, p_ref_code text)`, `funnel_save_profile(p_personal_id text, p_birth_date date, p_region_id int, p_city_id int, p_employment text, p_delegate_id uuid, p_tc_accepted boolean)`, `funnel_complete(p_tier int)`, `funnel_state()` — all returning the jsonb shape of `FunnelState` (Task 1); new `profiles` columns `signup_role, signup_ref_code, membership_tier, reference_code, registration_completed_at`.
- Error contract: RPCs `raise exception` with exactly the tokens in Task 1's `ERROR_MESSAGES` (e.g. `duplicate_personal_id`).

- [ ] **Step 1: Write the failing probe first — append to `scripts/verify-schema.mjs`** (TDD at the schema level: the probes fail until the migration is applied). Append before the final cleanup section:

```js
// --- Phase 2: registration funnel probes ---
{
  // anon must not be able to call the funnel RPCs at all
  const { error: anonRpcErr } = await anon.rpc("funnel_state");
  if (!anonRpcErr) throw new Error("LEAK: anon can call funnel_state()");
  console.log("OK: anon funnel_state() rejected");

  // authenticated end-to-end: start → save profile → complete (twice, idempotent)
  const FUNNEL_PROBE_EMAIL = "funnel-probe@example.com";
  const leftover = await findUserByEmail(FUNNEL_PROBE_EMAIL);
  if (leftover) {
    const { error } = await db.auth.admin.deleteUser(leftover.id);
    if (error) throw new Error(`cleanup of leftover funnel probe failed: ${error.message}`);
  }
  const funnelProbePassword = randomBytes(24).toString("hex");
  const { data: fpUser, error: fpCreateErr } = await db.auth.admin.createUser({
    email: FUNNEL_PROBE_EMAIL,
    password: funnelProbePassword,
    email_confirm: true,
  });
  if (fpCreateErr) throw new Error(`funnel probe createUser failed: ${fpCreateErr.message}`);
  const fpId = fpUser.user.id;
  try {
    const authed = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { error: fpSignInErr } = await authed.auth.signInWithPassword({
      email: FUNNEL_PROBE_EMAIL,
      password: funnelProbePassword,
    });
    if (fpSignInErr) throw new Error(`funnel probe sign-in failed: ${fpSignInErr.message}`);

    const { data: s1, error: e1r } = await authed.rpc("funnel_start", {
      p_first_name: "პრობი",
      p_last_name: "ფანელი",
      p_role: "member",
      p_ref_code: null,
    });
    if (e1r) throw new Error(`funnel_start failed: ${e1r.message}`);
    if (s1.exists !== true || s1.role !== "member")
      throw new Error(`funnel_start returned unexpected state: ${JSON.stringify(s1)}`);

    // direct client write to a guarded funnel column must be denied (grant revoked)
    const { error: directErr } = await authed
      .from("profiles")
      .update({ first_name: "შეცვლილი" })
      .eq("id", fpId);
    if (!directErr)
      throw new Error("LEAK: authenticated can still UPDATE profiles directly (grant not revoked)");
    console.log("OK: direct authenticated profiles UPDATE denied");

    const { data: firstCity, error: cityErr } = await db
      .from("cities")
      .select("id, region_id")
      .limit(1)
      .single();
    if (cityErr) throw new Error(`city lookup failed: ${cityErr.message}`);

    const { error: e2r } = await authed.rpc("funnel_save_profile", {
      p_personal_id: "98765432109",
      p_birth_date: "1990-01-15",
      p_region_id: firstCity.region_id,
      p_city_id: firstCity.id,
      p_employment: "პრობის საქმიანობა",
      p_delegate_id: null,
      p_tc_accepted: false,
    });
    if (e2r) throw new Error(`funnel_save_profile failed: ${e2r.message}`);

    const { data: c1, error: e3r } = await authed.rpc("funnel_complete", { p_tier: 10 });
    if (e3r) throw new Error(`funnel_complete failed: ${e3r.message}`);
    if (!/^GR-[A-HJKMNP-Z2-9]{6}$/.test(c1.referenceCode ?? ""))
      throw new Error(`reference code malformed: ${c1.referenceCode}`);

    const { data: c2, error: e4r } = await authed.rpc("funnel_complete", { p_tier: 20 });
    if (e4r) throw new Error(`repeat funnel_complete errored: ${e4r.message}`);
    if (c2.referenceCode !== c1.referenceCode || c2.tier !== 10)
      throw new Error(
        `funnel_complete not idempotent: ${c1.referenceCode}/${c1.tier} → ${c2.referenceCode}/${c2.tier}`,
      );
    console.log(`OK: funnel RPCs end-to-end (code ${c1.referenceCode}, idempotent complete)`);
  } finally {
    const { error } = await db.auth.admin.deleteUser(fpId);
    if (error)
      console.error(`WARNING: funnel probe cleanup (deleteUser ${fpId}) failed: ${error.message}`);
  }
}
```

Note: `findUserByEmail`, `anon`, `db`, `randomBytes`, `createClient`, `url` already exist in the script — reuse them; place this block after the Phase 1 probes and before/around the existing cleanup so `findUserByEmail` is in scope.

- [ ] **Step 2: Run to verify failure.** Run: `node --env-file=.env.local scripts/verify-schema.mjs`. Expected: FAIL at the new block (`funnel_state` does not exist).
- [ ] **Step 3: Write the migration — `supabase/migrations/20260715120000_registration_funnel.sql`**

```sql
-- Phase 2: registration funnel. Spec: docs/superpowers/specs/2026-07-15-phase-2-registration-funnel-design.md
create extension if not exists pgcrypto with schema extensions;

-- 1) New profile columns ------------------------------------------------------
alter table profiles add column signup_role text not null default 'member'
  check (signup_role in ('member', 'delegate'));
alter table profiles add column signup_ref_code text;
alter table profiles add column membership_tier smallint
  check (membership_tier in (5, 10, 20));
alter table profiles add column reference_code text unique
  check (reference_code ~ '^GR-[A-HJKMNP-Z2-9]{6}$');
alter table profiles add column registration_completed_at timestamptz;

-- Backfill: profiles that already have a delegates row are delegates
update profiles p set signup_role = 'delegate'
  where exists (select 1 from delegates d where d.id = p.id);

-- 2) Protect the new server-managed columns -----------------------------------
create or replace function protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated')
    and (new.status is distinct from old.status
      or new.personal_id is distinct from old.personal_id
      or new.phone is distinct from old.phone
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
      or new.signup_role is distinct from old.signup_role
      or new.signup_ref_code is distinct from old.signup_ref_code
      or new.membership_tier is distinct from old.membership_tier
      or new.reference_code is distinct from old.reference_code
      or new.registration_completed_at is distinct from old.registration_completed_at)
  then
    raise exception 'server-managed profile columns cannot be changed by client roles';
  end if;
  return new;
end $$;

-- 3) No direct client writes to profiles at all in Phase 2 --------------------
-- All funnel writes go through the definer RPCs below. The "own profile
-- updatable" RLS policy stays for Phase 3's scoped cabinet editing; without
-- this grant it is unreachable. (Spec §4.1.)
revoke update on profiles from authenticated;

-- 4) Code generator ------------------------------------------------------------
-- 31-char Crockford-style alphabet (no I, L, O, 0, 1). Modulo bias over 31 of
-- 256 byte values is negligible for anti-typo membership codes.
create function gen_funnel_code(len int) returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(len);
  result text := '';
  i int;
begin
  for i in 0..len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return result;
end $$;
revoke execute on function gen_funnel_code(int) from public, anon, authenticated;

-- 5) funnel_state --------------------------------------------------------------
create function funnel_state() returns jsonb
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
    'delegateStatus', case when v_has_delegate then v_delegate.status::text end,
    'referral', v_referral,
    'chosenDelegate', v_chosen,
    'membershipExists', coalesce(v_membership_exists, false)
  );
end $$;

-- 6) funnel_start ---------------------------------------------------------------
create function funnel_start(
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
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_role is null or p_role not in ('member', 'delegate') then
    raise exception 'invalid_role';
  end if;
  if p_first_name is null or length(btrim(p_first_name)) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name)) not between 1 and 60 then
    raise exception 'invalid_name';
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
      case when p_role = 'member' then nullif(btrim(coalesce(p_ref_code, '')), '') end
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
        else coalesce(nullif(btrim(coalesce(p_ref_code, '')), ''), signup_ref_code)
      end
    where id = v_uid;
  end if;
  -- completed profiles: no-op; state below routes them onward

  return public.funnel_state();
end $$;

-- 7) funnel_save_profile ---------------------------------------------------------
create function funnel_save_profile(
  p_personal_id text,
  p_birth_date date,
  p_region_id int,
  p_city_id int,
  p_employment text,
  p_delegate_id uuid default null,
  p_tc_accepted boolean default false
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_role text;
  v_delegate uuid;
  v_open_delegate uuid;
  v_has_open boolean := false;
  i int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;
  if v_profile.registration_completed_at is not null
     or v_profile.status = 'active_member' then
    raise exception 'already_completed';
  end if;

  if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
    raise exception 'invalid_personal_id';
  end if;
  if p_birth_date is null or p_birth_date >= current_date
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
  if exists (
    select 1 from public.profiles pr
    where pr.personal_id = p_personal_id and pr.id <> v_uid
  ) then
    raise exception 'duplicate_personal_id';
  end if;

  v_role := case when exists (select 1 from public.delegates d where d.id = v_uid)
                 then 'delegate' else v_profile.signup_role end;

  if v_role = 'delegate' then
    if not coalesce(p_tc_accepted, false) then raise exception 'terms_required'; end if;
    -- create once; resubmits keep the original referral_code and tc_accepted_at
    for i in 1..5 loop
      begin
        insert into public.delegates (id, referral_code, tc_accepted_at)
        values (v_uid, public.gen_funnel_code(6), now())
        on conflict (id) do nothing;
        exit;
      exception when unique_violation then
        if i = 5 then raise; end if; -- referral_code collision: retry with a new code
      end;
    end loop;
  else
    -- member binding: stored approved referral wins over the picker (spec §3.3)
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

    select m.delegate_id, true into v_open_delegate, v_has_open
      from public.memberships m
      where m.member_id = v_uid and m.ended_at is null;
    if not coalesce(v_has_open, false) then
      insert into public.memberships (member_id, delegate_id) values (v_uid, v_delegate);
    elsif v_open_delegate is distinct from v_delegate then
      update public.memberships set ended_at = now()
        where member_id = v_uid and ended_at is null;
      insert into public.memberships (member_id, delegate_id) values (v_uid, v_delegate);
    end if;
  end if;

  update public.profiles set
    personal_id = p_personal_id,
    birth_date = p_birth_date,
    region_id = p_region_id,
    city_id = p_city_id,
    employment = btrim(p_employment),
    status = case when status = 'draft' then 'profile_completed' else status end
  where id = v_uid;

  return public.funnel_state();
end $$;

-- 8) funnel_complete --------------------------------------------------------------
create function funnel_complete(p_tier int) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_delegate boolean;
  v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;

  -- idempotent: repeat calls (any tier) return existing state untouched (spec §4.3)
  if v_profile.registration_completed_at is not null then
    return public.funnel_state();
  end if;
  if v_profile.status <> 'profile_completed' then raise exception 'profile_incomplete'; end if;
  if p_tier is null or p_tier not in (5, 10, 20) then raise exception 'invalid_tier'; end if;

  v_is_delegate := exists (select 1 from public.delegates d where d.id = v_uid);
  if not v_is_delegate and not exists (
    select 1 from public.memberships m where m.member_id = v_uid and m.ended_at is null
  ) then
    raise exception 'profile_incomplete';
  end if;

  loop
    v_code := 'GR-' || public.gen_funnel_code(6);
    begin
      update public.profiles set
        membership_tier = p_tier,
        reference_code = v_code,
        registration_completed_at = now()
      where id = v_uid;
      exit;
    exception when unique_violation then
      -- reference_code collision — regenerate and retry
    end;
  end loop;

  return public.funnel_state();
end $$;

-- 9) Grants -------------------------------------------------------------------------
grant execute on function funnel_state() to authenticated;
revoke execute on function funnel_state() from public, anon;
grant execute on function funnel_start(text, text, text, text) to authenticated;
revoke execute on function funnel_start(text, text, text, text) from public, anon;
grant execute on function funnel_save_profile(text, date, int, int, text, uuid, boolean) to authenticated;
revoke execute on function funnel_save_profile(text, date, int, int, text, uuid, boolean) from public, anon;
grant execute on function funnel_complete(int) to authenticated;
revoke execute on function funnel_complete(int) from public, anon;
```

- [ ] **Step 4: Update `scripts/seed-staging.mjs`** — the profile rows built for people who also get a `delegates` row must now include `signup_role: "delegate"` (member/supporter rows keep the column default). Locate the delegate-profile object (it contains `phone: phoneFor(p.i)` and a `status` field, around line 167) and add the field to the delegate branch only. **Do NOT run the seed** — staging keeps its canonical data; this only keeps future resets consistent with the migration's backfill. Verify with `node --check scripts/seed-staging.mjs`.

- [ ] **Step 5: [OWNER-ASSIST] Apply the migration to staging.** Ask the owner (plain language): *"I need to apply the new database migration to staging. Please add a line `SUPABASE_DB_PASSWORD=<your database password>` to the `.env.local` file in the main checkout (Supabase dashboard → Project Settings → Database → Database password if you need to reset it), then tell me — I'll run the push and you can remove the line afterwards."* Then run (password read from env; never echo it):

```bash
export SUPABASE_DB_PASSWORD="$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2-)"
npx supabase db push --db-url "postgresql://postgres.orcxtbedkexoclbfgvzd:${SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
```

If the pooler host is rejected, retry with the direct host `db.orcxtbedkexoclbfgvzd.supabase.co:5432` (user `postgres`). Expected output: the CLI lists `20260715120000_registration_funnel.sql` and applies it. If earlier migrations show as unapplied on a fresh link, apply ONLY the new file (`--include-all` is wrong here — investigate instead).

- [ ] **Step 6: Run the probes to verify pass.** Run: `node --env-file=.env.local scripts/verify-schema.mjs`. Expected: all existing probes + new `OK: anon funnel_state() rejected`, `OK: direct authenticated profiles UPDATE denied`, `OK: funnel RPCs end-to-end (code GR-…, idempotent complete)`.
- [ ] **Step 7: Append ADRs to `DECISIONS.md`**

```markdown
## ADR-009 (2026-07-15): Funnel mutations are SECURITY DEFINER Postgres RPCs

Every registration-funnel write (funnel_start / funnel_save_profile / funnel_complete) is
one definer function: atomic by construction, subject always auth.uid(), all validation
re-checked in-DB, exposed to `authenticated` only. Server actions stay thin (zod parse +
RPC call + Georgian error mapping). Rejected: service-role TS orchestration (multi-write
non-atomic without a pg driver dependency) and client-direct writes under RLS (violates
server-source-of-truth). Rider: the client `update` grant on `profiles` is revoked — no
legitimate direct client write path remains until Phase 3's scoped cabinet editing.
Note (deferred from Phase 0): the composite FK `profiles(city_id, region_id)` uses MATCH
SIMPLE, so a partial update (one column NULL) would bypass the city-in-region pairing;
acceptable because the funnel RPC always writes both together and validates the pair.

## ADR-010 (2026-07-15): Payment reference codes are platform-issued, not personal IDs

Members get a permanent random `GR-XXXXXX` code (31-char Crockford-style alphabet, no
I/L/O/0/1) generated in-DB at funnel completion; new delegates' referral codes use the
same generator (6 chars, no prefix; seeded `D#####` codes coexist). The owner explicitly
rejected personal-ID-as-reference after a data-protection briefing (IDs would leak into
bank statements and finance tooling). Bank recipient details ship as clearly-marked
placeholders in `lib/bank-details.ts` until the owner opens the account (launch-checklist
item; swapping = editing that one module).
```

- [ ] **Step 8: Typecheck + full unit suite still green.** Run: `npm run typecheck && npm run test`. Expected: PASS (no TS impact from SQL, but guards against accidental edits).
- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260715120000_registration_funnel.sql scripts/verify-schema.mjs scripts/seed-staging.mjs DECISIONS.md
git commit -m "feat: registration funnel schema — columns, definer RPCs, grants hardening (applied to staging)"
```

### Task 4: Design-system components — OtpInput, TierPicker, DelegateBinding, Stepper labels

**Files:**
- Create: `components/OtpInput.tsx`, `components/TierPicker.tsx`, `components/DelegateBinding.tsx`
- Modify: `components/Stepper.tsx` (labels only), `app/(public)/styleguide/page.tsx` (gallery entries), `DESIGN.md` (inventory lines)
- Test: `components/OtpInput.test.tsx`, `components/TierPicker.test.tsx`, `components/DelegateBinding.test.tsx`

**Interfaces:**
- Consumes: `TIERS`, `Tier` from `lib/funnel.ts`; `Pill`, `inputClasses` from existing components.
- Produces (consumed by Tasks 5, 7–9):
  - `OtpInput({ value: string; onChange: (v: string) => void; error?: string })` — 6 boxes, `data-testid="otp-0"…"otp-5"`
  - `TierPicker({ value: Tier; onChange: (t: Tier) => void })` — radiogroup „ყოველთვიური საწევრო"
  - `DelegateBinding({ referral, options, value, onChange })` with `DelegateOption { id: string; fullName: string; regionNameKa: string }`; `value: string | null` (null = ცენტრალური მოძრაობა); `referral: { fullName: string; regionNameKa: string } | null`

- [ ] **Step 1: Write the failing tests**

`components/OtpInput.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { OtpInput } from "./OtpInput";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <>
      <OtpInput value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe("OtpInput", () => {
  it("renders six numeric boxes", () => {
    render(<OtpInput value="" onChange={() => undefined} />);
    for (let i = 0; i < 6; i++) expect(screen.getByTestId(`otp-${i}`)).toBeInTheDocument();
  });
  it("collects typed digits into the value and moves focus forward", () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "1" } });
    fireEvent.change(screen.getByTestId("otp-1"), { target: { value: "2" } });
    expect(screen.getByTestId("value").textContent).toBe("12");
    expect(screen.getByTestId("otp-2")).toHaveFocus();
  });
  it("distributes a pasted code across the boxes", () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    expect(screen.getByTestId("value").textContent).toBe("123456");
  });
  it("ignores non-digits", () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "a" } });
    expect(screen.getByTestId("value").textContent).toBe("");
  });
  it("shows the error text", () => {
    render(<OtpInput value="" onChange={() => undefined} error="კოდი არასწორია" />);
    expect(screen.getByText("კოდი არასწორია")).toBeInTheDocument();
  });
});
```

`components/TierPicker.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TierPicker } from "./TierPicker";

describe("TierPicker", () => {
  it("renders the three tiers with the current one checked", () => {
    render(<TierPicker value={10} onChange={() => undefined} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByText("თვეში")).toHaveLength(3);
  });
  it("reports tier selection", () => {
    const onChange = vi.fn();
    render(<TierPicker value={10} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("radio")[2]!);
    expect(onChange).toHaveBeenCalledWith(20);
  });
});
```

`components/DelegateBinding.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DelegateBinding } from "./DelegateBinding";

const options = [
  { id: "11111111-1111-4111-8111-111111111111", fullName: "გიორგი მაისურაძე", regionNameKa: "თბილისი" },
];

describe("DelegateBinding", () => {
  it("referral mode: read-only card, no picker", () => {
    render(
      <DelegateBinding
        referral={{ fullName: "გიორგი მაისურაძე", regionNameKa: "თბილისი" }}
        options={[]}
        value={null}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByText("გიორგი მაისურაძე")).toBeInTheDocument();
    expect(screen.getByText(/რეფერალური ბმულით/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("picker mode: central movement first and default", () => {
    render(<DelegateBinding referral={null} options={options} value={null} onChange={() => undefined} />);
    const select = screen.getByRole("combobox");
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveTextContent("ცენტრალური მოძრაობა");
    expect(select).toHaveValue("central");
  });
  it("picker mode: selecting a delegate reports its id, reselecting central reports null", () => {
    const onChange = vi.fn();
    render(<DelegateBinding referral={null} options={options} value={null} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: options[0]!.id },
    });
    expect(onChange).toHaveBeenCalledWith(options[0]!.id);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "central" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test -- components/OtpInput.test.tsx components/TierPicker.test.tsx components/DelegateBinding.test.tsx`. Expected: FAIL — modules not found.
- [ ] **Step 3: Implement `components/OtpInput.tsx`**

```tsx
"use client";

import { useRef } from "react";

const LENGTH = 6;

export function OtpInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-center gap-2" role="group" aria-label="SMS კოდი">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={digit}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`ციფრი ${i + 1}`}
            data-testid={`otp-${i}`}
            className={`h-14 w-11 rounded-lg border text-center text-2xl font-extrabold outline-none focus:border-brand ${
              error ? "border-danger" : "border-line"
            }`}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              if (raw.length > 1) {
                // paste: fill from this box onward
                const merged = (value.slice(0, i) + raw).slice(0, LENGTH);
                onChange(merged);
                refs.current[Math.min(merged.length, LENGTH - 1)]?.focus();
                return;
              }
              const next = digits.slice();
              next[i] = raw;
              onChange(next.join("").slice(0, LENGTH));
              if (raw && i < LENGTH - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digit && i > 0) refs.current[i - 1]?.focus();
            }}
          />
        ))}
      </div>
      {error ? <p className="text-center text-xs text-danger">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 4: Implement `components/TierPicker.tsx`**

```tsx
"use client";

import { TIERS, type Tier } from "@/lib/funnel";

export function TierPicker({ value, onChange }: { value: Tier; onChange: (tier: Tier) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="ყოველთვიური საწევრო">
      {TIERS.map((tier) => {
        const selected = tier === value;
        return (
          <button
            key={tier}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(tier)}
            className={`rounded-xl border-2 p-4 text-center transition-colors ${
              selected ? "border-brand bg-brand/5" : "border-line bg-white hover:border-muted-fg"
            }`}
          >
            <span className="block text-3xl font-extrabold text-ink">
              {tier}
              <small className="text-base font-bold">₾</small>
            </span>
            <span className="mt-1 block text-xs font-semibold text-muted-fg">თვეში</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Implement `components/DelegateBinding.tsx`**

```tsx
"use client";

import { inputClasses } from "@/components/Field";
import { Pill } from "@/components/Pill";

export interface DelegateOption {
  id: string;
  fullName: string;
  regionNameKa: string;
}

export function DelegateBinding({
  referral,
  options,
  value,
  onChange,
}: {
  referral: { fullName: string; regionNameKa: string } | null;
  options: DelegateOption[];
  value: string | null; // delegate id; null = ცენტრალური მოძრაობა
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink">აირჩიე შენი დელეგატი</p>
      <p className="mb-3 mt-1 text-sm text-muted-fg">
        დელეგატი წარადგენს შენს ხმას შენს მხარეში. ნებისმიერ დროს შეგიძლია შეცვალო.
      </p>
      {referral ? (
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 font-bold text-brand">
              {referral.fullName.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">{referral.fullName}</p>
              <p className="text-sm text-muted-fg">{referral.regionNameKa}</p>
            </div>
            <Pill status="approved" />
          </div>
          <p className="mt-3 text-xs text-muted-fg">
            🔗 შენ შემოხვედი რეფერალური ბმულით — დელეგატი უკვე მინიჭებულია.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <select
            aria-label="დელეგატი"
            className={`${inputClasses} border-line bg-white`}
            value={value ?? "central"}
            onChange={(e) => onChange(e.target.value === "central" ? null : e.target.value)}
          >
            <option value="central">ცენტრალური მოძრაობა</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName} · {d.regionNameKa}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-fg">
            აჩვენება მხოლოდ არჩეული მხარის დამტკიცებული დელეგატები.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Update `components/Stepper.tsx` labels to the spec's funnel wording.** Change the first line only:

```ts
const labels = ["კონტაქტი", "იურ. პროფილი", "საწევრო"] as const;
```

Run `npm run test` — if any existing test asserted the old labels („პროფილი"/„წევრობა"), update that assertion to the new strings in the same commit.

- [ ] **Step 7: Run to verify pass.** Run: `npm run test`. Expected: new component tests + whole suite PASS.
- [ ] **Step 8: Styleguide + DESIGN.md.** In `app/(public)/styleguide/page.tsx`, add gallery sections rendering `<OtpInput value="123" onChange={() => {}} />`, `<TierPicker value={10} onChange={() => {}} />`, and both `DelegateBinding` modes with static sample props, following the page's existing section markup (client-interactive samples may need a tiny local client wrapper component if the page is a server component — follow whatever pattern the page already uses for `CountUp`). In `DESIGN.md`, append under the components list:

```markdown
Phase 2: OtpInput (6-box SMS code entry), TierPicker (5/10/20 ₾ radiogroup),
DelegateBinding (referral card / region-filtered picker with „ცენტრალური მოძრაობა"
default). Stepper labels are the funnel's: კონტაქტი / იურ. პროფილი / საწევრო.
```

- [ ] **Step 9: Verify + commit.** Run: `npm run typecheck && npm run test && npm run lint`. Expected: PASS.

```bash
git add components/ app/\(public\)/styleguide/page.tsx DESIGN.md
git commit -m "feat: OtpInput, TierPicker, DelegateBinding components + stepper labels (TDD)"
```

### Task 5: Shared OTP verification block + login page refactor

**Files:**
- Create: `components/OtpVerification.tsx`
- Modify: `app/(public)/login/page.tsx`

**Interfaces:**
- Consumes: `OtpInput` (Task 4), `otpSchema` (Task 2), `deriveFunnelStep`/`funnelRoute`/`FunnelState` (Task 1), `funnel_state` RPC (Task 3), existing `createClient`, `Button`, `Card`, `Field`, `normalizeGeorgianPhone`.
- Produces (consumed by Task 7): `OtpVerification({ phone, onVerified }: { phone: string; onVerified: () => void | Promise<void> })` — `phone` must be E.164 (`+995…`); handles verify + 60 s resend + dev-code display (`data-testid="dev-otp"`, code inside `<strong>`).

- [ ] **Step 1: Implement `components/OtpVerification.tsx`** (no isolated unit test — Supabase-coupled; covered by the funnel + login e2e in Task 11 and indirectly by OtpInput's tests):

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { OtpInput } from "@/components/OtpInput";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { otpSchema } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_S = 60;

export function OtpVerification({
  phone,
  onVerified,
}: {
  phone: string;
  onVerified: () => void | Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [devOtp, setDevOtp] = useState<string>();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const fetchDevOtp = useCallback(async () => {
    if (
      process.env.NEXT_PUBLIC_APP_ENV !== "development" &&
      process.env.NEXT_PUBLIC_APP_ENV !== "preview"
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/dev/otp?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = (await res.json()) as { otp?: string };
        if (data.otp) setDevOtp(data.otp);
      }
    } catch {
      // dev helper only — ignore
    }
  }, [phone]);

  useEffect(() => {
    void fetchDevOtp();
  }, [fetchDevOtp]);

  async function verify() {
    setError(undefined);
    const parsed = otpSchema.safeParse({ code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      phone,
      token: parsed.data.code,
      type: "sms",
    });
    if (err) {
      setBusy(false);
      setError("კოდი არასწორია");
      return;
    }
    await onVerified();
    setBusy(false);
  }

  async function resend() {
    if (cooldown > 0 || busy) return;
    setError(undefined);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    if (err) {
      setError("კოდი უკვე გაიგზავნა — სცადე ერთ წუთში");
      return;
    }
    setCooldown(RESEND_COOLDOWN_S);
    void fetchDevOtp();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-fg">
        გამოგზავნილია SMS კოდი ნომერზე <strong className="text-ink">{phone}</strong>. შეიყვანე
        6-ნიშნა კოდი.
      </p>
      <OtpInput value={code} onChange={setCode} error={error} />
      {devOtp ? (
        <p className="rounded-lg bg-surface p-3 text-sm text-muted-fg" data-testid="dev-otp">
          სატესტო კოდი: <strong>{devOtp}</strong>
        </p>
      ) : null}
      <Button onClick={verify} disabled={busy}>
        დადასტურება
      </Button>
      <button
        type="button"
        className="text-sm text-muted-fg underline-offset-2 enabled:hover:underline disabled:opacity-60"
        disabled={cooldown > 0}
        onClick={resend}
      >
        {cooldown > 0 ? `ხელახლა გაგზავნა (${cooldown}წმ)` : "ხელახლა გაგზავნა"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Refactor `app/(public)/login/page.tsx`** — replace the whole file:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { OtpVerification } from "@/components/OtpVerification";
import { deriveFunnelStep, funnelRoute, type FunnelState } from "@/lib/funnel";
import { createClient } from "@/lib/supabase/client";
import { normalizeGeorgianPhone } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setError(undefined);
    const normalized = normalizeGeorgianPhone(phoneInput);
    if (!normalized) {
      setError("შეიყვანეთ ქართული მობილურის ნომერი (5XX XX XX XX)");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (err) {
      setError("კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან");
      return;
    }
    setPhone(normalized);
    setPhase("otp");
  }

  async function routeByFunnelState() {
    // Post-verify landing (spec §3.8): no profile → /join; otherwise the derived step.
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("funnel_state");
    if (rpcError || data === null) {
      router.replace("/join");
      return;
    }
    const state = data as FunnelState;
    router.replace(state.exists ? funnelRoute(deriveFunnelStep(state)) : "/join");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <Card title="შესვლა">
        {phase === "phone" ? (
          <div className="flex flex-col gap-4">
            <Field
              label="ტელეფონის ნომერი"
              name="phone"
              placeholder="5XX XX XX XX"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              error={error}
            />
            <Button onClick={requestOtp} disabled={busy}>
              კოდის მიღება
            </Button>
          </div>
        ) : (
          <OtpVerification phone={phone} onVerified={routeByFunnelState} />
        )}
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Verify.** Run: `npm run typecheck && npm run test && npm run lint && npm run build`. Expected: PASS (build proves no server/client boundary mistakes). The old `login.spec.ts` e2e now fails — that is EXPECTED and is fixed in Task 11 (its assertion changes with this behavior change; do not run e2e in this task).
- [ ] **Step 4: Commit**

```bash
git add components/OtpVerification.tsx app/\(public\)/login/page.tsx
git commit -m "feat: shared OTP verification block; login routes by funnel state"
```

### Task 6: Server actions + client funnel-state hook

**Files:**
- Create: `app/(public)/join/actions.ts`, `app/(public)/join/useFunnelGuard.ts`
- Test: covered by Task 3's DB probes (RPC behavior) and Task 11 e2e (wiring); the zod layer is Task 2-tested. No new unit files.

**Interfaces:**
- Consumes: schemas (Task 2), `mapFunnelError`/`FunnelState`/`deriveFunnelStep`/`canAccess`/`funnelRoute` (Task 1), RPCs (Task 3), `createServerSupabase`, `createClient`.
- Produces (consumed by Tasks 7–9):
  - `type ActionResult = { ok: true; state: FunnelState } | { ok: false; error: string }`
  - `funnelStartAction(input: unknown): Promise<ActionResult>`
  - `funnelSaveProfileAction(input: unknown): Promise<ActionResult>` (duplicate personal ID comes back as `{ ok: false, error: "ეს პირადი ნომერი უკვე რეგისტრირებულია." }`)
  - `funnelCompleteAction(input: unknown): Promise<ActionResult>`
  - `useFunnelGuard(step: FunnelStep): { state: FunnelState | null; ready: boolean; refresh: () => Promise<void> }` — client hook; fetches on mount; redirects (router.replace) when the step is not accessible; `state === null` with `ready` means signed-out.

- [ ] **Step 1: Implement `app/(public)/join/actions.ts`**

```ts
"use server";

import { GENERIC_FUNNEL_ERROR, mapFunnelError, type FunnelState } from "@/lib/funnel";
import { profileActionSchema, startSchema, tierSchema } from "@/lib/funnel-schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: true; state: FunnelState } | { ok: false; error: string };

function zodFail(message: string | undefined): ActionResult {
  return { ok: false, error: message ?? GENERIC_FUNNEL_ERROR };
}

export async function funnelStartAction(input: unknown): Promise<ActionResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("funnel_start", {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_role: parsed.data.role,
    p_ref_code: parsed.data.refCode ?? null,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as FunnelState };
}

export async function funnelSaveProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileActionSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("funnel_save_profile", {
    p_personal_id: parsed.data.personalId,
    p_birth_date: parsed.data.birthDate,
    p_region_id: parsed.data.regionId,
    p_city_id: parsed.data.cityId,
    p_employment: parsed.data.employment,
    p_delegate_id: parsed.data.role === "member" ? parsed.data.delegateId : null,
    p_tc_accepted: parsed.data.role === "delegate",
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as FunnelState };
}

export async function funnelCompleteAction(input: unknown): Promise<ActionResult> {
  const parsed = tierSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("funnel_complete", { p_tier: parsed.data.tier });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as FunnelState };
}
```

- [ ] **Step 2: Implement `app/(public)/join/useFunnelGuard.ts`**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { canAccess, deriveFunnelStep, funnelRoute, type FunnelState, type FunnelStep } from "@/lib/funnel";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side funnel guard (spec §3.8): fetch state on mount, redirect when this
 * screen isn't accessible for the current state. Never a server redirect — cached
 * shells stay valid. state === null (with ready) means signed out.
 */
export function useFunnelGuard(step: FunnelStep): {
  state: FunnelState | null;
  ready: boolean;
  refresh: () => Promise<FunnelState | null>;
} {
  const router = useRouter();
  const [state, setState] = useState<FunnelState | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async (): Promise<FunnelState | null> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState(null);
      return null;
    }
    const { data, error } = await supabase.rpc("funnel_state");
    if (error || data === null) {
      setState(null);
      return null;
    }
    const next = data as FunnelState;
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refresh().then((fetched) => {
      if (cancelled) return;
      if (fetched === null) {
        // signed out: only step 1 (and the choice screen, which doesn't guard) works
        if (step !== "step-1") router.replace("/join/step-1");
      } else if (!canAccess(step, fetched)) {
        router.replace(funnelRoute(deriveFunnelStep(fetched)));
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, router, step]);

  return { state, ready, refresh };
}
```

- [ ] **Step 3: Verify.** Run: `npm run typecheck && npm run lint`. Expected: PASS. (Runtime behavior is exercised by Tasks 7–9 pages and Task 11 e2e.)
- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/join/actions.ts app/\(public\)/join/useFunnelGuard.ts
git commit -m "feat: funnel server actions (zod → RPC → Georgian errors) + client guard hook"
```

### Task 7: `/join` choice screen + step 1 (contact + OTP)

**Files:**
- Create: `app/(public)/join/JoinChoice.tsx`, `app/(public)/join/step-1/page.tsx`
- Modify: `app/(public)/join/page.tsx` (replace opening-soon in place)

**Interfaces:**
- Consumes: `contactSchema` (2), `funnelStartAction` (6), `useFunnelGuard` (6), `OtpVerification` (5), `Stepper`, `Card`, `Field`, `Button`, `ButtonLink` (existing), `deriveFunnelStep`/`funnelRoute`/`isReferralCodeCandidate` (1).
- Produces: routes `/join` (choice; forwards `?role=` / `?ref=`), `/join/step-1?role=…&ref=…`.

- [ ] **Step 1: Replace `app/(public)/join/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinChoice } from "./JoinChoice";

export const metadata: Metadata = {
  title: "გაწევრიანება — ქართული რესპუბლიკა",
  description: "გახდი ქართული რესპუბლიკის წევრი ან დელეგატი — რეგისტრაცია რამდენიმე წუთში.",
};

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinChoice />
    </Suspense>
  );
}
```

- [ ] **Step 2: Implement `app/(public)/join/JoinChoice.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { deriveFunnelStep, funnelRoute, isReferralCodeCandidate } from "@/lib/funnel";
import { createClient } from "@/lib/supabase/client";

export function JoinChoice() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const role = params.get("role");
    const ref = params.get("ref");
    // ?role=delegate and ?ref=<code> skip the choice screen (spec §3.1)
    if (role === "delegate") {
      router.replace("/join/step-1?role=delegate");
      return;
    }
    if (ref && isReferralCodeCandidate(ref)) {
      router.replace(`/join/step-1?ref=${encodeURIComponent(ref)}`);
      return;
    }
    // signed-in visitor with funnel state → forward to their current screen
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return;
      const { data, error } = await supabase.rpc("funnel_state");
      if (error || cancelled || data === null) return;
      const state = data as import("@/lib/funnel").FunnelState;
      if (state.exists) router.replace(funnelRoute(deriveFunnelStep(state)));
    });
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
      <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-brand">
        რეგისტრაცია
      </p>
      <h1 className="text-center font-serif text-3xl font-bold text-ink">
        როგორ გსურს შემოგვიერთდე?
      </h1>
      <p className="mx-auto mb-9 mt-3 max-w-prose text-center text-muted-fg">
        ორივე გზა იწყება ერთი და იმავე სწრაფი რეგისტრაციით. დელეგატობა მოითხოვს დამატებით
        ადმინისტრაციულ დადასტურებას.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex h-full flex-col items-center gap-3 text-center">
            <span className="text-4xl" aria-hidden>
              🙋
            </span>
            <h3 className="text-lg font-bold text-ink">წევრი / მხარდამჭერი</h3>
            <p className="flex-1 text-sm text-muted-fg">
              შეავსე პროფილი, აირჩიე დელეგატი და ჩართე ყოველთვიური საწევრო. მიიღე წვდომა პირად
              კაბინეტზე.
            </p>
            <ButtonLink href="/join/step-1?role=member" className="w-full">
              გახდი წევრი
            </ButtonLink>
          </div>
        </Card>
        <div className="rounded-xl border border-brand shadow-[0_0_0_3px_rgba(200,16,46,0.08)]">
          <Card>
            <div className="flex h-full flex-col items-center gap-3 text-center">
              <span className="text-4xl" aria-hidden>
                ⭐
              </span>
              <h3 className="text-lg font-bold text-ink">დელეგატი</h3>
              <p className="flex-1 text-sm text-muted-fg">
                ააგე საკუთარი გუნდი, მიიღე პერსონალური რეფერალური ლინკი და მართვის პანელი.
                საჯაროდ ჩნდები დადასტურების შემდეგ.
              </p>
              <ButtonLink href="/join/step-1?role=delegate" variant="dark" className="w-full">
                გახდი დელეგატი
              </ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
```

Implementation notes: check `components/ButtonLink.tsx` for the exact `variant` names (`dark` exists per DESIGN.md) and whether it accepts `className` — if it doesn't, wrap in a `div className="w-full"` instead of passing `className`. If the nested-Card red ring renders awkwardly, move the ring classes onto a plain `section` using `cardSkin` from `components/Card.tsx` — do not restyle Card itself.

- [ ] **Step 3: Implement `app/(public)/join/step-1/page.tsx`**

```tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { OtpVerification } from "@/components/OtpVerification";
import { Stepper } from "@/components/Stepper";
import {
  deriveFunnelStep,
  funnelRoute,
  GENERIC_FUNNEL_ERROR,
  isReferralCodeCandidate,
  type FunnelRole,
} from "@/lib/funnel";
import { contactSchema } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";
import { funnelStartAction } from "../actions";
import { useFunnelGuard } from "../useFunnelGuard";

function Step1() {
  const router = useRouter();
  const params = useSearchParams();
  const role: FunnelRole = params.get("role") === "delegate" ? "delegate" : "member";
  const refParam = params.get("ref");
  const refCode = refParam && isReferralCodeCandidate(refParam) ? refParam : null;

  // forwards signed-in users who are already past step 1
  useFunnelGuard("step-1");

  const [phase, setPhase] = useState<"contact" | "otp">("contact");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"firstName" | "lastName" | "phone", string>>>(
    {},
  );
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submitContact() {
    setFormError(undefined);
    const parsed = contactSchema.safeParse({ firstName, lastName, phone: phoneInput });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "firstName" || key === "lastName" || key === "phone") next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone });
    setBusy(false);
    if (error) {
      setFormError("კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან");
      return;
    }
    setPhone(parsed.data.phone);
    setPhase("otp");
  }

  async function afterVerify() {
    const result = await funnelStartAction({ firstName, lastName, role, refCode });
    if (!result.ok) {
      setFormError(result.error);
      setPhase("contact");
      return;
    }
    if (result.state.completed) {
      // duplicate registration — only revealed after proving phone ownership (spec §6)
      setNotice("ეს ნომერი უკვე რეგისტრირებულია");
      setTimeout(() => router.replace(funnelRoute(deriveFunnelStep(result.state))), 1500);
      return;
    }
    router.replace(funnelRoute(deriveFunnelStep(result.state)));
  }

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-8">
      <div className="mb-6 flex justify-center">
        <Stepper current={1} />
      </div>
      <Card>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          {role === "delegate" ? "დელეგატის რეგისტრაცია" : "წევრის რეგისტრაცია"}
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink">სწრაფი კონტაქტი</h2>
        <p className="mb-5 mt-1 text-sm text-muted-fg">
          დავიწყოთ ძირითადით. მონაცემები ავტომატურად ინახება ყოველ ნაბიჯზე.
        </p>
        {notice ? (
          <p className="mb-4 rounded-lg bg-info/10 p-3 text-sm text-info" data-testid="join-notice">
            {notice}
          </p>
        ) : null}
        {phase === "contact" ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="სახელი"
                name="firstName"
                placeholder="მაგ. ნინო"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                error={errors.firstName}
              />
              <Field
                label="გვარი"
                name="lastName"
                placeholder="მაგ. ბერიძე"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                error={errors.lastName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Field
                label="ტელეფონის ნომერი"
                name="phone"
                inputMode="tel"
                placeholder="+995 5XX XX XX XX"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                error={errors.phone}
              />
              <p className="text-xs text-muted-fg">
                ამ ნომერზე მოგივა ერთჯერადი SMS კოდი დასადასტურებლად.
              </p>
            </div>
            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            <Button onClick={submitContact} disabled={busy} size="lg">
              გაგრძელება →
            </Button>
            <p className="text-center text-xs text-muted-fg">
              💾 მონაცემები ინახება ავტომატურად (Draft)
            </p>
          </div>
        ) : (
          <OtpVerification phone={phone} onVerified={afterVerify} />
        )}
      </Card>
    </main>
  );
}

export default function Step1Page() {
  return (
    <Suspense fallback={null}>
      <Step1 />
    </Suspense>
  );
}
```

- [ ] **Step 4: Manual smoke on staging (local dev).** Run the dev server, open `http://localhost:3000/join`: choice renders; „გახდი წევრი" → step 1; enter a fresh made-up `5XXXXXXXX` phone (NOT `50…` — that block is the seed's) → dev code appears → verify → lands on `/join/step-2` (404 for now — Task 8 builds it; the URL is the assertion). Open `/join?role=delegate` → step 1 shows „დელეგატის რეგისტრაცია".
- [ ] **Step 5: Verify + commit.** Run: `npm run typecheck && npm run test && npm run lint && npm run build`. Expected: PASS.

```bash
git add app/\(public\)/join/
git commit -m "feat: /join choice screen + funnel step 1 (contact + OTP, drafts)"
```

### Task 8: Step 2 — legal profile page

**Files:**
- Create: `app/(public)/join/step-2/page.tsx`

**Interfaces:**
- Consumes: `useFunnelGuard` (6), `funnelSaveProfileAction` (6), `profileActionSchema`, `EMPLOYMENT_PRESETS` (2), `DelegateBinding`, `Stepper` (4), `Card`, `Field`, `Button`, `inputClasses` (existing), `createClient`, `FunnelState` (1). Reads `regions`, `cities`, `public_delegates` with the anon client (all have anon select grants).
- Produces: route `/join/step-2`.

- [ ] **Step 1: Implement `app/(public)/join/step-2/page.tsx`**

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DelegateBinding, type DelegateOption } from "@/components/DelegateBinding";
import { Field, inputClasses } from "@/components/Field";
import { Stepper } from "@/components/Stepper";
import { EMPLOYMENT_PRESETS, profileActionSchema } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";
import { funnelSaveProfileAction } from "../actions";
import { useFunnelGuard } from "../useFunnelGuard";

const DUPLICATE_PID_MESSAGE = "ეს პირადი ნომერი უკვე რეგისტრირებულია.";

type FieldKey =
  | "personalId"
  | "birthDate"
  | "regionId"
  | "cityId"
  | "employment"
  | "tcAccepted";

function LabeledSelect({
  label,
  id,
  value,
  onChange,
  error,
  children,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClasses} ${error ? "border-danger" : "border-line"} bg-white`}
      >
        {children}
      </select>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export default function Step2Page() {
  const router = useRouter();
  const { state, ready } = useFunnelGuard("step-2");

  const [regions, setRegions] = useState<{ id: number; name_ka: string }[]>([]);
  const [cities, setCities] = useState<{ id: number; name_ka: string }[]>([]);
  const [delegateOptions, setDelegateOptions] = useState<DelegateOption[]>([]);

  const [personalId, setPersonalId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [workPreset, setWorkPreset] = useState("");
  const [workFree, setWorkFree] = useState("");
  const [delegateId, setDelegateId] = useState<string | null>(null);
  const [tcAccepted, setTcAccepted] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const role = state?.role ?? "member";
  const referral = state?.referral ?? null;

  // prefill once from server state (resume / back-navigation)
  useEffect(() => {
    if (!ready || !state || initialized) return;
    setBirthDate(state.birthDate ?? "");
    setRegionId(state.regionId);
    setCityId(state.cityId);
    if (state.employment) {
      if ((EMPLOYMENT_PRESETS as readonly string[]).includes(state.employment)) {
        setWorkPreset(state.employment);
      } else {
        setWorkPreset("__other");
        setWorkFree(state.employment);
      }
    }
    if (state.chosenDelegate) setDelegateId(state.chosenDelegate.id);
    setInitialized(true);
  }, [ready, state, initialized]);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("regions")
      .select("id, name_ka")
      .order("id")
      .then(({ data }) => setRegions(data ?? []));
  }, []);

  useEffect(() => {
    if (regionId === null) {
      setCities([]);
      setDelegateOptions([]);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("cities")
      .select("id, name_ka")
      .eq("region_id", regionId)
      .order("name_ka")
      .then(({ data }) => setCities(data ?? []));
    if (role === "member" && !referral) {
      void supabase
        .from("public_delegates")
        .select("id, first_name, last_name, region_name_ka")
        .eq("region_id", regionId)
        .order("active_supporters", { ascending: false })
        .then(({ data }) =>
          setDelegateOptions(
            (data ?? []).map((d) => ({
              id: d.id as string,
              fullName: `${d.first_name} ${d.last_name}`,
              regionNameKa: (d.region_name_ka as string | null) ?? "",
            })),
          ),
        );
    }
  }, [regionId, role, referral]);

  function changeRegion(value: string) {
    const next = value ? Number(value) : null;
    setRegionId(next);
    setCityId(null);
    if (role === "member" && !referral) setDelegateId(null);
  }

  async function submit() {
    setFormError(undefined);
    const employment = workPreset === "__other" ? workFree : workPreset;
    const common = {
      personalId: personalId.replace(/\D/g, ""),
      birthDate,
      regionId: regionId ?? 0,
      cityId: cityId ?? 0,
      employment,
    };
    const input =
      role === "delegate"
        ? { role: "delegate" as const, ...common, tcAccepted: tcAccepted as true }
        : { role: "member" as const, ...common, delegateId };
    const parsed = profileActionSchema.safeParse(input);
    if (!parsed.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key !== "role") next[key as FieldKey] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await funnelSaveProfileAction(parsed.data);
    setBusy(false);
    if (!result.ok) {
      if (result.error === DUPLICATE_PID_MESSAGE) {
        setErrors({ personalId: result.error });
      } else {
        setFormError(result.error);
      }
      return;
    }
    router.push("/join/step-3");
  }

  if (!ready || !state) return null;

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-8">
      <div className="mb-6 flex justify-center">
        <Stepper current={2} />
      </div>
      <Card>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          {role === "delegate" ? "დელეგატის რეგისტრაცია" : "წევრის რეგისტრაცია"}
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink">იურიდიული პროფილი</h2>
        <p className="mb-5 mt-1 text-sm text-muted-fg">
          ეს მონაცემები საჭიროა წევრობის იურიდიული ვერიფიკაციისთვის. ინახება უსაფრთხოდ.
        </p>
        <div className="flex flex-col gap-4">
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
          <Field
            label="დაბადების თარიღი"
            name="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            error={errors.birthDate}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledSelect
              label="მხარე"
              id="jn-region"
              value={regionId === null ? "" : String(regionId)}
              onChange={changeRegion}
              error={errors.regionId}
            >
              <option value="" disabled>
                აირჩიე მხარე
              </option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name_ka}
                </option>
              ))}
            </LabeledSelect>
            <LabeledSelect
              label="ქალაქი / მუნიციპალიტეტი"
              id="jn-city"
              value={cityId === null ? "" : String(cityId)}
              onChange={(v) => setCityId(v ? Number(v) : null)}
              error={errors.cityId}
            >
              <option value="" disabled>
                {regionId === null ? "ჯერ აირჩიე მხარე" : "აირჩიე ქალაქი"}
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ka}
                </option>
              ))}
            </LabeledSelect>
          </div>
          <LabeledSelect
            label="სამუშაო ადგილი / სტატუსი"
            id="jn-work"
            value={workPreset}
            onChange={setWorkPreset}
            error={errors.employment}
          >
            <option value="" disabled>
              აირჩიე სტატუსი
            </option>
            {EMPLOYMENT_PRESETS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
            <option value="__other">სხვა (მიუთითე)</option>
          </LabeledSelect>
          {workPreset === "__other" ? (
            <Field
              label="მიუთითე შენი საქმიანობა"
              name="workFree"
              placeholder="მაგ. არქიტექტორი, ფერმერი, IT სპეციალისტი..."
              value={workFree}
              onChange={(e) => setWorkFree(e.target.value)}
              error={errors.employment}
            />
          ) : null}
          {role === "member" ? (
            <DelegateBinding
              referral={
                referral
                  ? {
                      fullName: `${referral.firstName} ${referral.lastName}`,
                      regionNameKa: referral.regionNameKa,
                    }
                  : null
              }
              options={delegateOptions}
              value={delegateId}
              onChange={setDelegateId}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={tcAccepted}
                  onChange={(e) => setTcAccepted(e.target.checked)}
                />
                <span>
                  ვეცნობი და ვეთანხმები დელეგატად ყოფნის{" "}
                  <a
                    href="/join/terms"
                    target="_blank"
                    className="font-semibold text-brand underline underline-offset-2"
                  >
                    წესებსა და პირობებს
                  </a>
                  . ვადასტურებ, რომ მოწოდებული მონაცემები ნამდვილია.
                </span>
              </label>
              {errors.tcAccepted ? <p className="text-xs text-danger">{errors.tcAccepted}</p> : null}
            </div>
          )}
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <Button onClick={submit} disabled={busy} size="lg">
            გაგრძელება →
          </Button>
          <p className="text-center text-xs text-muted-fg">💾 მონაცემები ინახება ავტომატურად</p>
        </div>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Manual smoke on staging (local dev).** Continue the Task 7 draft (log in with the same test phone via `/login` — it must land on `/join/step-2`): region select cascades cities; picking a region shows that region's approved delegates in the binding block with „ცენტრალური მოძრაობა" first; submit with an obviously bad personal ID shows the inline Georgian error; submit valid data lands on `/join/step-3` (404 until Task 9 — URL is the assertion). Then run a delegate variant from a second fresh phone: T&C unchecked → „საჭიროა წესებზე თანხმობა."
- [ ] **Step 3: Verify + commit.** Run: `npm run typecheck && npm run test && npm run lint && npm run build`. Expected: PASS.

```bash
git add app/\(public\)/join/step-2/
git commit -m "feat: funnel step 2 — legal profile, region cascade, delegate binding, T&C"
```

### Task 9: Step 3, completion screens, terms page, sitemap

**Files:**
- Create: `app/(public)/join/step-3/page.tsx`, `app/(public)/join/done/page.tsx`, `app/(public)/join/pending/page.tsx`, `app/(public)/join/terms/page.tsx`, `app/(public)/join/TransferInstructions.tsx`
- Modify: `app/sitemap.ts` (add `/join`, `/join/terms`)

**Interfaces:**
- Consumes: `useFunnelGuard`, `funnelCompleteAction` (6), `TierPicker` (4), `BANK_DETAILS` (2), `Tier`/`funnelRoute`/`deriveFunnelStep` (1), `Card`, `Button`, `ButtonLink`, `Pill`, `Stepper`.
- Produces: routes `/join/step-3`, `/join/done`, `/join/pending`, `/join/terms`; component `TransferInstructions({ tier: Tier | null; referenceCode: string | null })` with `data-testid="reference-code"` and `data-testid="bank-placeholder"`.

- [ ] **Step 1: Implement `app/(public)/join/TransferInstructions.tsx`**

```tsx
import { BANK_DETAILS } from "@/lib/bank-details";
import type { Tier } from "@/lib/funnel";

export function TransferInstructions({
  tier,
  referenceCode,
}: {
  tier: Tier | null;
  referenceCode: string | null;
}) {
  // legacy pre-Phase-2 accounts have no code (spec §3.8) — show nothing
  if (!referenceCode) return null;
  return (
    <div className="mt-6 flex flex-col gap-4 text-left">
      <div className="rounded-xl border border-line bg-surface p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-fg">შენი პირადი კოდი</p>
        <p
          className="mt-1 font-mono text-3xl font-extrabold tracking-widest text-brand"
          data-testid="reference-code"
        >
          {referenceCode}
        </p>
        <p className="mt-1 text-xs text-muted-fg">
          მიუთითე ეს კოდი ყველა გადარიცხვის დანიშნულებაში.
        </p>
      </div>
      <div className="rounded-xl border border-line p-4">
        {BANK_DETAILS.placeholder ? (
          <p
            className="mb-3 rounded-lg bg-warn/10 p-2 text-xs font-semibold text-warn"
            data-testid="bank-placeholder"
          >
            საბანკო რეკვიზიტები მალე დაემატება — ეს დროებითი მონაცემებია.
          </p>
        ) : null}
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-fg">მიმღები</dt>
            <dd className="text-right font-semibold text-ink">{BANK_DETAILS.recipientName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-fg">ბანკი</dt>
            <dd className="text-right font-semibold text-ink">{BANK_DETAILS.bankName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-fg">IBAN</dt>
            <dd className="text-right font-mono font-semibold text-ink">{BANK_DETAILS.iban}</dd>
          </div>
        </dl>
        {tier !== null ? (
          <p className="mt-3 text-sm text-ink">
            გადმორიცხე <strong>{tier} ₾</strong> ყოველთვიურად ამ ანგარიშზე და დანიშნულებაში მიუთითე
            შენი პირადი კოდი — ასე დავაკავშირებთ გადმორიცხვას შენს წევრობასთან.
          </p>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `app/(public)/join/step-3/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Stepper } from "@/components/Stepper";
import { TierPicker } from "@/components/TierPicker";
import { deriveFunnelStep, funnelRoute, type Tier } from "@/lib/funnel";
import { funnelCompleteAction } from "../actions";
import { useFunnelGuard } from "../useFunnelGuard";

export default function Step3Page() {
  const router = useRouter();
  const { state, ready } = useFunnelGuard("step-3");
  const [tier, setTier] = useState<Tier>(10);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function complete() {
    setError(undefined);
    setBusy(true);
    const result = await funnelCompleteAction({ tier });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace(funnelRoute(deriveFunnelStep(result.state)));
  }

  if (!ready || !state) return null;

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-8">
      <div className="mb-6 flex justify-center">
        <Stepper current={3} />
      </div>
      <Card>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          {state.role === "delegate" ? "დელეგატის რეგისტრაცია" : "წევრის რეგისტრაცია"}
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink">საწევრო შენატანი</h2>
        <p className="mb-5 mt-1 text-sm text-muted-fg">
          აირჩიე ყოველთვიური საწევრო. შენატანი ამყარებს მოძრაობის დამოუკიდებლობას.
        </p>
        <TierPicker value={tier} onChange={setTier} />
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex flex-col gap-3">
          <Button onClick={complete} disabled={busy} size="lg">
            რეგისტრაციის დასრულება
          </Button>
          <p className="text-center text-xs text-muted-fg">
            გადახდა ხდება საბანკო გადარიცხვით — ბარათის მონაცემები არ გჭირდება.
          </p>
        </div>
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Implement `app/(public)/join/done/page.tsx`**

```tsx
"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "../TransferInstructions";
import { useFunnelGuard } from "../useFunnelGuard";

export default function DonePage() {
  const { state, ready } = useFunnelGuard("done");
  if (!ready || !state) return null;

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
          <ButtonLink href="/">მთავარი გვერდი</ButtonLink>
          <ButtonLink href="/leaderboard" variant="ghost">
            დელეგატების რეიტინგი
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Implement `app/(public)/join/pending/page.tsx`**

```tsx
"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "../TransferInstructions";
import { useFunnelGuard } from "../useFunnelGuard";

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

export default function PendingPage() {
  const { state, ready } = useFunnelGuard("pending");
  if (!ready || !state) return null;

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
        <TransferInstructions tier={state.tier} referenceCode={state.referenceCode} />
        <div className="mt-6">
          <ButtonLink href="/" className="w-full">
            მთავარი გვერდი
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
```

(Same `ButtonLink` `className` caveat as Task 7 — if the prop doesn't exist, wrap in a full-width div.)

- [ ] **Step 5: Implement `app/(public)/join/terms/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Card } from "@/components/Card";

export const metadata: Metadata = {
  title: "დელეგატის წესები და პირობები — ქართული რესპუბლიკა",
  description: "დელეგატად ყოფნის წესები და პირობები.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 pb-16 pt-10">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand">
        დელეგატის წესები და პირობები
      </p>
      <h1 className="mb-4 font-serif text-3xl font-bold text-ink">წესები და პირობები</h1>
      <p className="mb-6 rounded-lg bg-warn/10 p-3 text-sm font-semibold text-warn">
        სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.
      </p>
      <Card>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-ink">
          <li>
            დელეგატი ადასტურებს, რომ რეგისტრაციისას მოწოდებული ყველა მონაცემი ნამდვილი და ზუსტია.
          </li>
          <li>
            დელეგატი მოქმედებს კანონმორჩილად და პლატფორმის ღირებულებების — გამჭვირვალობის,
            ანგარიშვალდებულებისა და პატივისცემის — შესაბამისად.
          </li>
          <li>
            დელეგატის საჯარო პროფილი და რეფერალური ბმული აქტიურდება მხოლოდ ადმინისტრაციული
            ვერიფიკაციის შემდეგ.
          </li>
          <li>
            წესების დარღვევის შემთხვევაში პლატფორმა იტოვებს უფლებას შეაჩეროს ან გააუქმოს
            დელეგატის სტატუსი.
          </li>
        </ol>
      </Card>
    </main>
  );
}
```

- [ ] **Step 6: Add `/join` and `/join/terms` to `app/sitemap.ts`.** Open the file; it exports a list of URL entries (`/`, `/delegates`, `/leaderboard`, delegate pages). Add two entries with the same object shape the static pages use, pointing at `/join` and `/join/terms`. Step/completion pages stay out (spec §8).
- [ ] **Step 7: Manual smoke on staging (local dev).** Complete the Task 8 member draft: step 3 shows tiers with 10 pre-selected → „რეგისტრაციის დასრულება" → `/join/done` shows a `GR-` code, the placeholder-marked bank block, the delegate line. Complete the delegate draft → `/join/pending` shows ⏳, pill „განხილვის პროცესში", the three explainer rows, the same instructions block. Reload both pages — they persist. Open `/join` while logged in as the completed member → forwarded to `/join/done`.
- [ ] **Step 8: Verify + commit.** Run: `npm run typecheck && npm run test && npm run lint && npm run build`. Expected: PASS.

```bash
git add app/\(public\)/join/ app/sitemap.ts
git commit -m "feat: funnel step 3, done/pending completion screens, terms page, sitemap"
```

### Task 10: Dev-OTP endpoint hardening (Phase 0 MUST-CLOSE gate)

**Files:**
- Modify: `app/api/dev/otp/route.ts` (replace whole file)

**Interfaces:**
- Consumes: `createAdminClient` (existing), `profiles.registration_completed_at`/`status` (Task 3).
- Produces: same GET contract, but 404 for completed/active accounts; stale inbox rows purged.

- [ ] **Step 1: Replace `app/api/dev/otp/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const env = process.env.NEXT_PUBLIC_APP_ENV;
  if (!(env === "development" || env === "preview")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const admin = createAdminClient();
  const stripped = phone.replace(/^\+/, "");
  const withPlus = `+${stripped}`;

  // opportunistic hygiene: drop codes older than an hour (Phase 0 minor)
  await admin
    .from("dev_otp_inbox")
    .delete()
    .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  // Phase 2 hardening (spec §4.4, decision #6): never serve codes for completed or
  // active accounts — this endpoint must not be an account-takeover oracle. Both
  // phone formats are matched so a format mismatch can never fail OPEN.
  const { data: profiles, error: profileErr } = await admin
    .from("profiles")
    .select("status, registration_completed_at")
    .in("phone", [withPlus, stripped])
    .limit(1);
  if (profileErr) {
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  const profile = profiles?.[0];
  if (
    profile &&
    (profile.registration_completed_at !== null || profile.status === "active_member")
  ) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // hook stores phone without '+'; retry briefly because the hook runs async of the request
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await admin
      .from("dev_otp_inbox")
      .select("otp, created_at")
      .in("phone", [withPlus, stripped])
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return NextResponse.json({ otp: data[0]!.otp });
    await new Promise((r) => setTimeout(r, 500));
  }
  return NextResponse.json({ error: "no otp" }, { status: 404 });
}
```

- [ ] **Step 2: Manual verification against staging (dev server running).**

```bash
# an ACTIVE seeded account must be refused instantly (404, "not found"):
node --env-file=.env.local -e "
import('@supabase/supabase-js').then(async ({ createClient }) => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db.from('profiles').select('phone').eq('status', 'active_member').not('phone', 'is', null).limit(1).single();
  console.log(data.phone);
})"
# take the printed phone (e.g. +995500000001) and:
curl -s "http://localhost:3000/api/dev/otp?phone=%2B995500000001"
# expected: {"error":"not found"}  (instant, no retry loop)
# a fresh unknown phone is still allowed (slow "no otp" after ~5s of retries):
curl -s "http://localhost:3000/api/dev/otp?phone=%2B995551110000"
# expected: {"error":"no otp"}
```

Also verify the member you completed in Task 9's smoke is now refused (its phone has `registration_completed_at`).

- [ ] **Step 3: Verify + commit.** Run: `npm run typecheck && npm run lint && npm run build`. Expected: PASS.

```bash
git add app/api/dev/otp/route.ts
git commit -m "fix: dev OTP endpoint refuses completed/active accounts, purges stale codes"
```

### Task 11: e2e suite + CI phone scheme

**Files:**
- Create: `e2e/funnel-helpers.ts`, `e2e/funnel.spec.ts`
- Modify: `e2e/login.spec.ts` (new landing assertion + 55-block phone), `.github/workflows/ci.yml` (phone derivation)

**Interfaces:**
- Consumes: every route and testid from Tasks 5–10; staging seed (read-only); `E2E_TEST_PHONE` env.
- Produces: green `npm run e2e` (7 specs total: 4 existing-but-one-updated + funnel journeys).

- [ ] **Step 1: Update `.github/workflows/ci.yml`** — replace the derive step's `run` line:

```yaml
      - name: Derive per-run e2e test phone
        if: hashFiles('playwright.config.ts') != ''
        run: |
          # 55-block: disjoint from the canonical seed's 50XXXXXXX phones (spec §7).
          # Digit 8 folds in the retry attempt; digit 9 (=9) is the login journey's slot;
          # funnel journeys replace that final digit (see e2e/funnel-helpers.ts).
          echo "E2E_TEST_PHONE=55$(printf '%05d' $(( ${{ github.run_number }} % 100000 )))$(( ${{ github.run_attempt }} % 10 ))9" >> "$GITHUB_ENV"
```

- [ ] **Step 2: Implement `e2e/funnel-helpers.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

// Per-run isolation (spec §7): E2E_TEST_PHONE is CI-derived in the 55XXXXXXX block
// (run number + attempt) and ends in 9 — the login journey's digit. Funnel journeys
// replace the final digit. Personal IDs use the reserved 9-prefix (seed uses 1-prefix).
const LOGIN_PHONE = process.env.E2E_TEST_PHONE ?? "550009999";
const BASE = LOGIN_PHONE.slice(0, 8);

export const JOURNEY = {
  member: 0,
  delegate: 1,
  duplicate: 2,
  resume: 3,
  referral: 4,
} as const;

export function journeyPhone(journey: number): string {
  return `${BASE}${journey}`; // 9 national digits, 55-prefixed
}

export function journeyPersonalId(journey: number): string {
  return `9${BASE.slice(1)}${journey}00`; // 11 digits, 9-prefixed
}

export async function cleanupJourneyUsers(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("e2e cleanup skipped: staging service credentials not in env");
    return;
  }
  const admin = createClient(url, key);
  const phones = Object.values(JOURNEY).flatMap((j) => [
    `+995${journeyPhone(j)}`,
    `995${journeyPhone(j)}`,
  ]);
  const { data: rows } = await admin.from("profiles").select("id").in("phone", phones);
  for (const row of rows ?? []) {
    await admin.auth.admin.deleteUser(row.id);
  }
}

export async function getSeededReferral(): Promise<{ code: string; fullName: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("referral journey needs staging service credentials");
  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("delegates")
    .select("referral_code, profiles(first_name, last_name)")
    .eq("status", "approved")
    .limit(1)
    .single();
  if (error || !data) throw new Error(`no approved seeded delegate found: ${error?.message}`);
  const p = data.profiles as unknown as { first_name: string; last_name: string };
  return { code: data.referral_code as string, fullName: `${p.first_name} ${p.last_name}` };
}
```

- [ ] **Step 3: Implement `e2e/funnel.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test";
import {
  cleanupJourneyUsers,
  getSeededReferral,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
} from "./funnel-helpers";

// Journeys share per-run users and the duplicate test depends on the member
// journey's personal ID already existing — run serially.
test.describe.configure({ mode: "serial" });

test.beforeAll(cleanupJourneyUsers);
test.afterAll(cleanupJourneyUsers);

async function passStep1(
  page: Page,
  opts: { phone: string; firstName: string; lastName: string },
): Promise<void> {
  await page.getByLabel("სახელი").fill(opts.firstName);
  await page.getByLabel("გვარი").fill(opts.lastName);
  await page.getByLabel("ტელეფონის ნომერი").fill(opts.phone);
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await page.getByTestId("otp-0").fill(otp); // OtpInput distributes pasted digits
  await page.getByRole("button", { name: "დადასტურება" }).click();
}

async function fillStep2Basics(
  page: Page,
  opts: { personalId: string; regionLabel: string },
): Promise<void> {
  await page.getByLabel("პირადი ნომერი").fill(opts.personalId);
  await page.getByLabel("დაბადების თარიღი").fill("1990-05-20");
  await page.getByLabel("მხარე").selectOption({ label: opts.regionLabel });
  await page.getByLabel("ქალაქი / მუნიციპალიტეტი").selectOption({ index: 1 });
  await page.getByLabel("სამუშაო ადგილი / სტატუსი").selectOption({ label: "სტუდენტი" });
}

test("member registers end-to-end and gets a reference code", async ({ page, request }) => {
  const phone = journeyPhone(JOURNEY.member);
  await page.goto("/join");
  await page.getByRole("link", { name: "გახდი წევრი" }).click();
  await expect(page).toHaveURL(/\/join\/step-1\?role=member/);
  await passStep1(page, { phone, firstName: "ვატესტ", lastName: "წევრობას" });

  await expect(page).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(page, {
    personalId: journeyPersonalId(JOURNEY.member),
    regionLabel: "თბილისი",
  });
  // binding block: central movement is the default; a Tbilisi delegate is offered
  await expect(page.getByLabel("დელეგატი")).toHaveValue("central");
  await page.getByRole("button", { name: "გაგრძელება →" }).click();

  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("radio", { name: /20/ }).click();
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  await expect(page).toHaveURL(/\/join\/done/);
  await expect(page.getByTestId("reference-code")).toHaveText(/^GR-[A-HJKMNP-Z2-9]{6}$/);
  await expect(page.getByTestId("bank-placeholder")).toBeVisible();
  await expect(page.getByText("20 ₾")).toBeVisible();
  await expect(page.getByTestId("chosen-delegate")).toHaveText("ცენტრალური მოძრაობა");

  // hardening (spec §4.4): a completed account's dev code is refused
  const res = await request.get(`/api/dev/otp?phone=${encodeURIComponent(`+995${phone}`)}`);
  expect(res.status()).toBe(404);
});

test("delegate must accept terms, ends pending, stays off public pages", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.delegate);
  const firstName = "ვატესტდელეგატ";
  const lastName = "მოლოდინში";
  await page.goto("/join?role=delegate");
  await expect(page).toHaveURL(/\/join\/step-1\?role=delegate/);
  await passStep1(page, { phone, firstName, lastName });

  await expect(page).toHaveURL(/\/join\/step-2/);
  await expect(page.getByText("დელეგატის რეგისტრაცია").first()).toBeVisible();
  await fillStep2Basics(page, {
    personalId: journeyPersonalId(JOURNEY.delegate),
    regionLabel: "იმერეთი",
  });
  // T&C is mandatory: submitting unchecked shows the Georgian error
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page.getByText("საჭიროა წესებზე თანხმობა.")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "გაგრძელება →" }).click();

  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  await expect(page).toHaveURL(/\/join\/pending/);
  await expect(page.getByText("შენი დელეგატის პროფილი განიხილება")).toBeVisible();
  await expect(page.getByText("განხილვის პროცესში")).toBeVisible();
  await expect(page.getByTestId("reference-code")).toHaveText(/^GR-/);

  // pending delegates appear on no public surface (spec §11)
  await page.goto("/delegates");
  await expect(page.getByText(`${firstName} ${lastName}`)).toHaveCount(0);
  await page.goto("/leaderboard");
  await expect(page.getByText(`${firstName} ${lastName}`)).toHaveCount(0);
});

test("duplicate personal ID is rejected with the Georgian message", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.duplicate);
  await page.goto("/join/step-1?role=member");
  await passStep1(page, { phone, firstName: "ვატესტ", lastName: "დუბლიკატს" });
  await expect(page).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(page, {
    personalId: journeyPersonalId(JOURNEY.member), // taken by the member journey
    regionLabel: "თბილისი",
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page.getByText("ეს პირადი ნომერი უკვე რეგისტრირებულია.")).toBeVisible();
  await expect(page).toHaveURL(/\/join\/step-2/); // still on step 2
});

test("mid-funnel draft resumes on a new device at the right step", async ({ browser }) => {
  const phone = journeyPhone(JOURNEY.resume);
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await pageA.goto("/join/step-1?role=member");
  await passStep1(pageA, { phone, firstName: "ვატესტ", lastName: "გაგრძელებას" });
  await expect(pageA).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(pageA, {
    personalId: journeyPersonalId(JOURNEY.resume),
    regionLabel: "კახეთი",
  });
  await pageA.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(pageA).toHaveURL(/\/join\/step-3/);
  await contextA.close(); // "left, device lost"

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto("/login");
  await pageB.getByLabel("ტელეფონის ნომერი").fill(phone);
  await pageB.getByRole("button", { name: "კოდის მიღება" }).click();
  const devOtp = pageB.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await pageB.getByTestId("otp-0").fill(otp);
  await pageB.getByRole("button", { name: "დადასტურება" }).click();
  await expect(pageB).toHaveURL(/\/join\/step-3/); // resumed exactly where they left off
  await contextB.close();
});

test("referral link pre-fills its delegate through the whole funnel", async ({ page }) => {
  const { code, fullName } = await getSeededReferral();
  const phone = journeyPhone(JOURNEY.referral);
  await page.goto(`/join?ref=${encodeURIComponent(code)}`);
  await expect(page).toHaveURL(new RegExp(`/join/step-1\\?ref=`));
  await passStep1(page, { phone, firstName: "ვატესტ", lastName: "რეფერალს" });

  await expect(page).toHaveURL(/\/join\/step-2/);
  // read-only referral card instead of the picker
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText(/რეფერალური ბმულით/)).toBeVisible();
  await expect(page.getByLabel("დელეგატი")).toHaveCount(0);
  await fillStep2Basics(page, {
    personalId: journeyPersonalId(JOURNEY.referral),
    regionLabel: "აჭარა", // any region — referral binding is region-independent
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();
  await expect(page).toHaveURL(/\/join\/done/);
  await expect(page.getByTestId("chosen-delegate")).toHaveText(fullName);
});
```

- [ ] **Step 4: Update `e2e/login.spec.ts`** — replace the whole file (new default phone block + new landing assertion, spec §7):

```ts
import { expect, test } from "@playwright/test";

// staging-only; hook delivers OTP to dev_otp_inbox. CI derives a per-run 55-block
// phone (run number + attempt, final digit 9 = login journey) so concurrent runs
// and the canonical 50-block seed can never collide.
const TEST_PHONE = process.env.E2E_TEST_PHONE ?? "550009999";

test("phone OTP login end-to-end (dev delivery)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ტელეფონის ნომერი").fill(TEST_PHONE);
  await page.getByRole("button", { name: "კოდის მიღება" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await page.getByTestId("otp-0").fill(otp);
  await page.getByRole("button", { name: "დადასტურება" }).click();
  // fresh phone with no profile row → funnel entry (spec §3.8)
  await expect(page).toHaveURL(/\/join$/);
  await expect(
    page.getByRole("heading", { name: "როგორ გსურს შემოგვიერთდე?" }),
  ).toBeVisible();
});
```

- [ ] **Step 5: Run the whole e2e suite locally against staging.** Run: `SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)" NEXT_PUBLIC_SUPABASE_URL="$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2-)" npm run e2e`. Expected: all specs PASS (existing `public.spec.ts` + `smoke.spec.ts` untouched and still green — proves the seed was not disturbed). If a funnel spec fails, debug with `npx playwright test e2e/funnel.spec.ts --headed` — fix source, not assertions, unless the assertion contradicts the spec.
- [ ] **Step 6: Commit**

```bash
git add e2e/ .github/workflows/ci.yml
git commit -m "test: funnel e2e journeys (member/delegate/dup/resume/referral) + 55-block phone scheme"
```

---

## After all tasks

1. Full local gate: `npm run typecheck && npm run test && npm run lint && npm run build && npm run e2e` — all green.
2. Whole-branch review + independent `/codex review` (subagent-driven-development's closing steps), fix waves as needed.
3. Push branch, open the PR (title "Phase 2 — Registration funnel (v0.3.0)"), CI green.
4. Preview QA against staging: register one test member AND one test delegate on the Vercel preview URL; capture the done/pending URLs and the `GR-` codes.
5. Owner sign-off package (plain language + clickable URLs, no screenshots): preview link, both registrations' evidence, pending-delegate-absent-from-public proof, dev-OTP hardening proof.
6. Merge ONLY after the owner's explicit sign-off in chat. Version v0.3.0.

**Known intentional red-CI window:** none — Task 5 breaks `login.spec.ts` locally but e2e only runs in CI on push/PR; do not push between Tasks 5 and 11.
