# Phase 6 Release 1 — Progressive Registration ("the new front door") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the member/delegate funnel with one light registration (name, surname, personal ID, mobile + OTP → straight into the cabinet), add the registered-standing cabinet (events + RSVP, public news, profile, become-a-member hero), and move the old profile + tier steps into an in-cabinet membership wizard. Release 2 (delegacy request, public counters, admin segments) is a separate plan.

**Architecture:** Same fortress-database pattern as Phase 2 (ADR-009): every mutation is one SECURITY DEFINER RPC; thin zod-validated server actions; client pages fetch state on mount. `funnel_state()` becomes `cabinet_state()`; `profiles.status` enum value `draft` becomes `registered` (a *completed* light registration — the old "draft" concept disappears); membership-row creation moves from profile-save to wizard completion (backing is a member privilege, spec D1).

**Tech Stack:** Next.js 16 (App Router), TypeScript 6 strict, Tailwind 4, Supabase (`@supabase/ssr` + RPCs), zod, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-21-progressive-registration-design.md` — binding. Release 1 = spec §4 + §6 + §7; §5 is out of scope here.

## Global Constraints

- TypeScript `strict: true`; **no `any`, no `@ts-ignore`**.
- Domain logic = pure functions in `lib/` — no React/Next imports (`lib/supabase/` is the sanctioned data-access location).
- **All user-facing text Georgian.** Reuse design-system components (DESIGN.md); extend, never restyle ad hoc.
- Schema changes ONLY via `supabase/migrations/`. Staging Supabase project is the dev DB (ADR-005).
- **No new npm dependencies.**
- zod at every boundary; the DB re-validates inside RPCs. Server is the source of truth.
- Statuses/counters stay derived. Nothing here stores a computed value or writes `active_member` (ADR-015 engine only).
- TDD: failing test first, watch it fail, implement, watch it pass, commit. Frequent conventional commits.
- Cabinet/registration pages: client-side state fetch on mount for interactive flows; `(member)`/`(delegate)`/`(admin)` layouts keep server-side gates (never cached — sw NetworkOnly).
- e2e uses only per-run `55XXXXXXX` phones and `9…`-prefixed personal IDs; canonical staging seed (12 approved delegates, 4 canonical admins) must never be disturbed.
- Error tokens: RPCs `raise exception '<token>'`; `mapFunnelError` maps to Georgian. No new tokens are needed in R1 — reuse the existing map.

## File Structure (R1 delta)

```
supabase/migrations/20260721120000_progressive_registration.sql   CREATE  (enum rename, cleanup, RPC surface)
lib/funnel.ts                stays as module path; FunnelState→CabinetState, step machinery→membership phases
lib/funnel-schemas.ts        registerSchema + membershipProfileSchema replace contact/start/profileAction
lib/cabinet.ts               deriveDestination (standings), cabinetRole, cabinetNavItems('registered'), TEAM_STATUS_LABELS fix
lib/admin.ts                 MemberStatusRow + MEMBER_STATUS_LABELS_KA vocabulary update
lib/supabase/types.ts        profiles Row (drop signup_role, add pending_delegate_id); Functions block swap
lib/supabase/server.ts       getFunnelState → getCabinetState (rpc cabinet_state)
components/Pill.tsx          add 'registered' status skin
components/Stepper.tsx       generalized: steps prop (wizard reuses it with 2 labels)
app/(public)/page.tsx        hero CTAs → single "დარეგისტრირდი"
app/(public)/join/page.tsx   REWRITE: single-page registration (4 fields + OTP)
app/(public)/join/actions.ts REWRITE: registerAction only
app/(public)/join/JoinChoice.tsx, step-1/2/3, done, pending, useFunnelGuard.ts, fresh-completion.ts   DELETE
app/(public)/join/terms/     KEEP untouched (R2 relocates it)
app/(public)/login/page.tsx  CabinetState type + rpc name
app/(member)/layout.tsx      gate: any existing profile; standing-aware nav
app/(member)/me/page.tsx     REWRITE: registered overview (members/delegates redirect away)
app/(member)/me/membership/page.tsx + actions.ts + MembershipWizard.tsx   CREATE (wizard: profile → tier → done)
app/(member)/me/profile/page.tsx      registered variant (basic fields + upgrade prompt)
app/(member)/me/news/page.tsx         registered → public_news source
app/(member)/me/billing|polls|delegate/page.tsx   self-gate: !completed → redirect /me
app/(delegate)/layout.tsx    getCabinetState rename only (logic unchanged)
scripts/verify-schema.mjs    probe updates (new RPCs, gates, enum)
scripts/seed-staging.mjs     draft rows → registered rows (with personal IDs)
e2e/registration.spec.ts     CREATE (replaces funnel.spec.ts)
e2e/membership.spec.ts       CREATE (wizard journeys)
e2e/funnel-helpers.ts        passRegistration, seedPendingDelegate; journey table rework
e2e/admin-approval.spec.ts, delegate-panel.spec.ts   pending delegates seeded via service role
e2e/public.spec.ts, smoke.spec.ts, login.spec.ts     CTA/destination assertion updates
```

Execution order is Task 1 → 10. Tasks 1–3 are pure lib (no DB needed); Task 4 lands the DB; 5–7 are the UI; 8–10 close staging, e2e, and verification.

---

### Task 1: `lib/funnel.ts` — CabinetState, standings, membership phases

**Files:**
- Modify: `lib/funnel.ts`
- Test: `lib/funnel.test.ts` (rewrite the step-machinery blocks; keep code-format + error-map blocks)

**Interfaces:**
- Produces (consumed by every later task):
  - `type Standing = "registered" | "member"`
  - `type CabinetRole = "member" | "delegate"` (delegates-row presence; routing only)
  - `type MembershipPhase = "profile" | "tier" | "done"`
  - `interface CabinetState` — exact shape below, mirrors the `cabinet_state()` RPC jsonb (Task 4)
  - `deriveMembershipPhase(state: CabinetState): MembershipPhase`
  - Kept as-is: `TIERS`, `Tier`, `FUNNEL_CODE_ALPHABET`, `isReferenceCode`, `isReferralCodeCandidate`, `mapFunnelError`, `GENERIC_FUNNEL_ERROR`, `DUPLICATE_PERSONAL_ID_MESSAGE`, `FunnelReferral`, `FunnelChosenDelegate`
  - Changed: `MemberStatus` becomes `"registered" | "profile_completed" | "active_member"` (enum rename)
  - Deleted: `FunnelState`, `FunnelRole`, `FunnelStep`, `deriveFunnelStep`, `funnelRoute`, `canAccess`

- [ ] **Step 1: Write the failing test**

In `lib/funnel.test.ts`, delete the `deriveFunnelStep`, `funnelRoute`, and `canAccess` describe blocks and the old `state()` fixture; keep the `code formats` and `mapFunnelError` blocks untouched. Add:

```ts
import {
  deriveMembershipPhase,
  type CabinetState,
} from "./funnel";

function cab(overrides: Partial<CabinetState>): CabinetState {
  return {
    exists: true,
    standing: "registered",
    status: "registered",
    role: "member",
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalIdMasked: "010********",
    birthDate: null,
    regionId: null,
    cityId: null,
    employment: null,
    tier: null,
    referenceCode: null,
    completed: false,
    delegateStatus: null,
    referral: null,
    pendingDelegate: null,
    chosenDelegate: null,
    membershipExists: false,
    registrationCompletedAt: null,
    createdAt: "2026-07-21T10:00:00Z",
    admin: false,
    ...overrides,
  };
}

describe("deriveMembershipPhase", () => {
  it("fresh registered person → profile phase", () => {
    expect(deriveMembershipPhase(cab({}))).toBe("profile");
  });
  it("partially saved profile still → profile phase (any field missing)", () => {
    expect(deriveMembershipPhase(cab({ birthDate: "1990-05-20", regionId: 3 }))).toBe("profile");
  });
  it("all wizard fields saved → tier phase", () => {
    expect(
      deriveMembershipPhase(
        cab({ birthDate: "1990-05-20", regionId: 3, cityId: 7, employment: "სტუდენტი" }),
      ),
    ).toBe("tier");
  });
  it("completed member → done, regardless of field snapshot", () => {
    expect(deriveMembershipPhase(cab({ standing: "member", completed: true }))).toBe("done");
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run lib/funnel.test.ts`
Expected: FAIL — `deriveMembershipPhase` and `CabinetState` are not exported (and the old fixture's removed fields error).

- [ ] **Step 3: Implement**

In `lib/funnel.ts`:

1. Delete: `FunnelRole`, `FunnelStep`, `MemberStatus`, `FunnelState`, `deriveFunnelStep`, `funnelRoute`, `canAccess` (lines 7–8, 22–67 in the current file). Keep `FunnelReferral`, `FunnelChosenDelegate`.
2. Add in their place:

```ts
export type Standing = "registered" | "member";
export type CabinetRole = "member" | "delegate";
export type MembershipPhase = "profile" | "tier" | "done";
/** profiles.status after the enum rename (draft → registered). */
export type MemberStatus = "registered" | "profile_completed" | "active_member";

/** Mirrors the cabinet_state() RPC jsonb exactly (keys are camelCase in SQL). */
export interface CabinetState {
  exists: boolean;
  /** 'member' when registration_completed_at is set (or legacy active_member). */
  standing: Standing;
  /** Raw profiles.status — billing/profile render the active_member distinction from it. */
  status: MemberStatus;
  /** delegates-row presence — cabinet routing only, NOT an authorization signal. */
  role: CabinetRole;
  firstName: string;
  lastName: string;
  /** e.g. "010********" — first 3 digits + asterisks; own-ID display without raw exposure. */
  personalIdMasked: string;
  birthDate: string | null; // "YYYY-MM-DD"
  regionId: number | null;
  cityId: number | null;
  employment: string | null;
  tier: Tier | null;
  referenceCode: string | null;
  /** standing === "member" — kept as a flag because most call sites gate on it. */
  completed: boolean;
  delegateStatus: "pending" | "approved" | "rejected" | null;
  referral: FunnelReferral | null;
  /** Wizard step-A choice, held server-side until completion (spec §4.3). */
  pendingDelegate: FunnelChosenDelegate | null;
  chosenDelegate: FunnelChosenDelegate | null; // null = ცენტრალური მოძრაობა (or none yet)
  membershipExists: boolean;
  registrationCompletedAt: string | null;
  createdAt: string;
  admin: boolean;
  /** Present ONLY on register() responses: true = row inserted, false = pre-existing (no-op). */
  created?: boolean;
}

/** Which wizard screen a registered person sees; done ⇢ member (spec §4.3). */
export function deriveMembershipPhase(state: CabinetState): MembershipPhase {
  if (state.completed) return "done";
  const profileSaved =
    state.birthDate !== null &&
    state.regionId !== null &&
    state.cityId !== null &&
    state.employment !== null;
  return profileSaved ? "tier" : "profile";
}
```

3. Leave `ERROR_MESSAGES`, `mapFunnelError`, code-format helpers untouched.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/funnel.test.ts`
Expected: PASS (old blocks removed, new block green). `npx tsc --noEmit` will still fail across the repo (call sites) — that is expected until Tasks 3–7; do NOT chase those yet.

- [ ] **Step 5: Commit**

```bash
git add lib/funnel.ts lib/funnel.test.ts
git commit -m "feat(lib): CabinetState + membership-phase derivation replace funnel steps"
```

---

### Task 2: `lib/funnel-schemas.ts` — registration + membership schemas

**Files:**
- Modify: `lib/funnel-schemas.ts`
- Test: `lib/validation.test.ts` untouched; rewrite schema cases inside `lib/funnel-schemas.test.ts` (drop contact/start/profileAction cases, keep tier cases)

**Interfaces:**
- Produces:
  - `registerSchema` — `{ firstName, lastName, personalId, phone, refCode? }` (client form, pre-OTP)
  - `registerActionSchema` — same minus `phone` (server action; phone comes from the session)
  - `membershipProfileSchema` — `{ birthDate, regionId, cityId, employment, delegateId }`
  - Kept: `nameSchema`, `otpSchema`, `tierSchema`, `EMPLOYMENT_PRESETS`, `employmentSchema`, `regionIdSchema`, `cityIdSchema`, `delegateIdSchema`
  - Deleted: `contactSchema`, `startSchema`, `profileActionSchema`

- [ ] **Step 1: Write the failing test**

In `lib/funnel-schemas.test.ts`, remove cases for `contactSchema`/`startSchema`/`profileActionSchema` and add:

```ts
import { membershipProfileSchema, registerActionSchema, registerSchema } from "./funnel-schemas";

describe("registerSchema", () => {
  const base = {
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalId: "01001012345",
    phone: "555 12 34 56",
  };
  it("accepts the four fields and normalizes the phone", () => {
    const parsed = registerSchema.parse(base);
    expect(parsed.phone).toBe("+995555123456");
  });
  it("rejects a personal ID that is not 11 digits, in Georgian", () => {
    const r = registerSchema.safeParse({ ...base, personalId: "123" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("პირადი ნომერი უნდა იყოს 11 ციფრი.");
    }
  });
  it("accepts an optional referral code and rejects junk", () => {
    expect(registerSchema.safeParse({ ...base, refCode: "7K3M9Q" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, refCode: "bad code!" }).success).toBe(false);
  });
});

describe("registerActionSchema", () => {
  it("has no phone field (session provides it)", () => {
    expect(
      registerActionSchema.safeParse({
        firstName: "ნინო",
        lastName: "ბერიძე",
        personalId: "01001012345",
      }).success,
    ).toBe(true);
  });
});

describe("membershipProfileSchema", () => {
  const base = {
    birthDate: "1990-05-20",
    regionId: 3,
    cityId: 7,
    employment: "სტუდენტი",
    delegateId: null,
  };
  it("accepts a full profile", () => {
    expect(membershipProfileSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a future birth date in Georgian", () => {
    const r = membershipProfileSchema.safeParse({ ...base, birthDate: "2999-01-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("თარიღი უნდა იყოს წარსულში.");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/funnel-schemas.test.ts`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Implement**

In `lib/funnel-schemas.ts`: delete `contactSchema`, `startSchema`, `profileActionSchema` (and the discriminated-union comment block); keep everything else. The `profileBase` fields move into `membershipProfileSchema`. Add:

```ts
const personalIdSchema = z
  .string()
  .regex(/^\d{11}$/, { message: "პირადი ნომერი უნდა იყოს 11 ციფრი." });

export const registerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  personalId: personalIdSchema,
  phone: phoneSchema,
  refCode: refCodeSchema.nullish(),
});

/** Server-action variant: the phone is already proven by the OTP session. */
export const registerActionSchema = registerSchema.omit({ phone: true });

export const membershipProfileSchema = z.object({
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "მიუთითე დაბადების თარიღი." })
    .refine((v) => v >= "1900-01-01" && v < new Date().toISOString().slice(0, 10), {
      message: "თარიღი უნდა იყოს წარსულში.",
    }),
  regionId: regionIdSchema,
  cityId: cityIdSchema,
  employment: employmentSchema,
  delegateId: delegateIdSchema,
});
```

(`refCodeSchema` and `phoneSchema` already exist in this file — reuse, do not redefine.)

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/funnel-schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/funnel-schemas.ts lib/funnel-schemas.test.ts
git commit -m "feat(lib): register + membership schemas replace funnel step schemas"
```

---

### Task 3: `lib/cabinet.ts`, `lib/admin.ts`, Pill, Stepper — standings vocabulary

**Files:**
- Modify: `lib/cabinet.ts`, `lib/admin.ts`, `components/Pill.tsx`, `components/Stepper.tsx`
- Test: `lib/cabinet.test.ts`, `lib/admin.test.ts`, `components/design-system.test.tsx`

**Interfaces:**
- Produces:
  - `deriveDestination(state: CabinetState | null): string` — `/join` (no profile) · `/delegate` (delegates row) · `/me/profile` (member) · `/me` (registered)
  - `cabinetRole(state: CabinetState): "registered" | "member" | "delegate"`
  - `cabinetNavItems(role: "registered" | "member" | "delegate", isAdmin?: boolean)`
  - `TEAM_STATUS_LABELS.profile_completed === "წევრი"` (was „რეგისტრირებული" — that word now means the light tier)
  - `MemberStatusRow = "registered" | "profile_completed" | "active_member"`; `MEMBER_STATUS_LABELS_KA = { registered: "რეგისტრირებული", profile_completed: "წევრი", active_member: "აქტიური" }`
  - `Pill` accepts `status="registered"` (same muted skin as `draft`)
  - `Stepper({ steps, current }: { steps: readonly string[]; current: number })`

- [ ] **Step 1: Write the failing tests**

In `lib/cabinet.test.ts` replace the `deriveDestination` block (it builds old `FunnelState`s) and the nav-items expectations:

```ts
import { cabinetNavItems, cabinetRole, deriveDestination, TEAM_STATUS_LABELS } from "./cabinet";
import type { CabinetState } from "./funnel";

function cab(overrides: Partial<CabinetState>): CabinetState {
  return {
    exists: true, standing: "registered", status: "registered", role: "member",
    firstName: "ნინო", lastName: "ბერიძე", personalIdMasked: "010********",
    birthDate: null, regionId: null, cityId: null, employment: null,
    tier: null, referenceCode: null, completed: false, delegateStatus: null,
    referral: null, pendingDelegate: null, chosenDelegate: null,
    membershipExists: false, registrationCompletedAt: null,
    createdAt: "2026-07-21T10:00:00Z", admin: false,
    ...overrides,
  };
}

describe("deriveDestination", () => {
  it("no profile → /join", () => {
    expect(deriveDestination(null)).toBe("/join");
    expect(deriveDestination(cab({ exists: false }))).toBe("/join");
  });
  it("registered → /me overview", () => {
    expect(deriveDestination(cab({}))).toBe("/me");
  });
  it("member → /me/profile", () => {
    expect(deriveDestination(cab({ standing: "member", completed: true }))).toBe("/me/profile");
  });
  it("delegates row (any status) → /delegate", () => {
    expect(
      deriveDestination(
        cab({ standing: "member", completed: true, role: "delegate", delegateStatus: "pending" }),
      ),
    ).toBe("/delegate");
  });
});

describe("cabinetRole + nav", () => {
  it("maps standing/role to the nav variant", () => {
    expect(cabinetRole(cab({}))).toBe("registered");
    expect(cabinetRole(cab({ standing: "member", completed: true }))).toBe("member");
    expect(cabinetRole(cab({ standing: "member", completed: true, role: "delegate" }))).toBe("delegate");
  });
  it("registered nav: overview, events, news, profile — nothing member-only", () => {
    const hrefs = cabinetNavItems("registered").map((i) => i.href);
    expect(hrefs).toEqual(["/me", "/me/events", "/me/news", "/me/profile"]);
  });
  it("member/delegate navs unchanged; admin tab appends", () => {
    expect(cabinetNavItems("member").map((i) => i.href)).toEqual([
      "/me/profile", "/me/delegate", "/me/billing", "/me/news", "/me/events", "/me/polls",
    ]);
    expect(cabinetNavItems("registered", true).at(-1)?.href).toBe("/admin");
  });
});

it("team vocabulary: profile_completed is now „წევრი“", () => {
  expect(TEAM_STATUS_LABELS.profile_completed).toBe("წევრი");
  expect(TEAM_STATUS_LABELS.active_member).toBe("აქტიური");
});
```

In `lib/admin.test.ts`, update the status-vocabulary case:

```ts
expect(MEMBER_STATUS_LABELS_KA).toEqual({
  registered: "რეგისტრირებული",
  profile_completed: "წევრი",
  active_member: "აქტიური",
});
```

In `components/design-system.test.tsx`: update the Stepper case to render `<Stepper steps={["პროფილი", "საწევრო"]} current={1} />` and assert both labels render and step 1 has `aria-current="step"`; add a Pill case asserting `<Pill status="registered" />` renders „რეგისტრირებული".

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/cabinet.test.ts lib/admin.test.ts components/design-system.test.tsx`
Expected: FAIL (new signatures/keys missing).

- [ ] **Step 3: Implement**

`lib/cabinet.ts`:

```ts
export function deriveDestination(state: CabinetState | null): string {
  if (!state || !state.exists) return "/join";
  if (state.role === "delegate") return "/delegate";
  return state.standing === "member" ? "/me/profile" : "/me";
}

/** Nav variant: delegates-row wins; otherwise the standing decides. */
export function cabinetRole(state: CabinetState): "registered" | "member" | "delegate" {
  if (state.role === "delegate") return "delegate";
  return state.standing === "member" ? "member" : "registered";
}

export function cabinetNavItems(
  role: "registered" | "member" | "delegate",
  isAdmin = false,
): CabinetNavItem[] {
  const items: CabinetNavItem[] =
    role === "delegate"
      ? [ /* keep the existing delegate list verbatim */ ]
      : role === "member"
        ? [ /* keep the existing member list verbatim */ ]
        : [
            { href: "/me", label: "მთავარი" },
            { href: "/me/events", label: "ღონისძიებები" },
            { href: "/me/news", label: "სიახლეები" },
            { href: "/me/profile", label: "პროფილი" },
          ];
  if (isAdmin) items.push({ href: "/admin", label: "ადმინისტრირება" });
  return items;
}
```

(Import type changes from `FunnelState` to `CabinetState`; delete the `deriveFunnelStep`/`funnelRoute` import.) Change `TEAM_STATUS_LABELS.profile_completed` to `"წევრი"`.

`lib/admin.ts`: update the label map per the interface block above. `MemberStatusRow` itself is DEFINED in `lib/supabase/types.ts:17` (admin.ts only imports it) — change the union there (`"registered" | "profile_completed" | "active_member"`), and update the `Enums.member_status` union in the same file to match. `lib/admin-schemas.ts:133`: the members-page status-filter `z.enum(["draft", ...])` becomes `z.enum(["registered", "profile_completed", "active_member"])` — update its test cases in `lib/admin-schemas.test.ts` alongside.

`components/Pill.tsx`: extend the `Status` union with `"registered"` and add
`registered: { label: "რეგისტრირებული", className: "bg-surface text-muted-fg" },` (same muted skin as draft — a registered person is a neutral standing, not a warning).

`components/Stepper.tsx` (full new file):

```tsx
export function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="flex items-center gap-4">
      {steps.map((label, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                active ? "bg-brand text-white" : done ? "bg-ok text-white" : "bg-surface text-muted-fg"
              }`}
            >
              {step}
            </span>
            <span className={`text-sm ${active ? "font-semibold text-ink" : "text-muted-fg"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/cabinet.test.ts lib/admin.test.ts components/design-system.test.tsx`
Expected: PASS. (Repo-wide `tsc` still red until Tasks 5–7 — expected.)

- [ ] **Step 5: Commit**

```bash
git add lib/cabinet.ts lib/cabinet.test.ts lib/admin.ts lib/admin.test.ts components/Pill.tsx components/Stepper.tsx components/design-system.test.tsx
git commit -m "feat(lib): standings vocabulary — destinations, navs, pills, generalized stepper"
```

---

### Task 4: DB migration — enum rename, cleanup, new RPC surface

**Files:**
- Create: `supabase/migrations/20260721120000_progressive_registration.sql`
- Modify: `lib/supabase/types.ts`, `scripts/verify-schema.mjs`

**Interfaces:**
- Produces (RPCs, all `security definer`, EXECUTE to `authenticated` only):
  - `cabinet_state() returns jsonb` — the `CabinetState` shape from Task 1, camelCase keys
  - `register(p_first_name text, p_last_name text, p_personal_id text, p_ref_code text default null) returns jsonb`
  - `become_member_save_profile(p_birth_date date, p_region_id int, p_city_id int, p_employment text, p_delegate_id uuid default null) returns jsonb`
  - `become_member_complete(p_tier int) returns jsonb`
  - `is_registered() returns boolean`
- Error tokens raised (all already in `mapFunnelError`): `not_authenticated`, `invalid_name`, `invalid_personal_id`, `duplicate_personal_id`, `invalid_birth_date`, `invalid_employment`, `invalid_city`, `invalid_delegate`, `already_completed`, `profile_incomplete`, `invalid_tier`, `not_completed`.

- [ ] **Step 1: Write the failing probe first**

In `scripts/verify-schema.mjs`: find every probe that calls `funnel_start` / `funnel_save_profile` / `funnel_complete` / `funnel_state` and rewrite that probe section to the new flow (the probe file executes RPCs against staging as a throwaway user):
- `register` happy path creates a `registered` profile (assert `standing === "registered"`, `completed === false`);
- calling `register` again returns the same state (idempotent);
- `register` with a taken personal ID fails with `duplicate_personal_id`;
- `become_member_save_profile` + `become_member_complete(10)` flips `standing` to `"member"`, mints a `GR-` reference code, and creates exactly one open membership;
- `become_member_complete` again is a no-op returning the same reference code;
- `member_rsvp` succeeds for a *registered* (not completed) probe user against a published probe event (gate widened);
- `become_member_save_profile` rejects an unknown/unapproved delegate with `invalid_delegate`;
- `become_member_complete` before any profile save fails with `profile_incomplete`;
- referral precedence: a probe user registered with a seeded approved delegate's ref code, then `become_member_save_profile` passing a DIFFERENT approved delegate id → returned state's `pendingDelegate` is the REFERRAL delegate (stored referral wins, Phase-2 parity);
- lost-approval fallback: point a probe user's `pending_delegate_id` at a NON-approved delegates row (service-role write), then `become_member_complete(10)` → membership row lands on central (`delegate_id` null), no error (spec §8);
- registered probe user hits the member wall everywhere else: `member_cast_vote` raises `not_completed`; `member_polls` returns zero rows;
- direct PostgREST PATCH of `pending_delegate_id` as the probe user is rejected by the protect trigger;
- regression probes for the recreated functions: `member_change_delegate` + `member_change_tier` still work for a completed probe member (and return the new state shape), and `admin_record_payment` on a probe member still flips `active_member` (exercises `recompute_member_active` post-rename);
- old function names are gone: probe `funnel_state` and assert PostgREST returns 404/`PGRST202`.
Update the probe at `scripts/verify-schema.mjs:148` that writes `status: "draft"` to use `"registered"`.

- [ ] **Step 2: Run the probe to watch it fail**

Run: `node --env-file=.env.local scripts/verify-schema.mjs`
Expected: FAIL — `register` does not exist yet.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260721120000_progressive_registration.sql` — complete content:

```sql
-- Phase 6 R1: progressive registration.
-- Spec: docs/superpowers/specs/2026-07-21-progressive-registration-design.md §4, §6, §7.

-- 1) Staging cleanup (spec §7.1). Two classes of unfinishable rows go away:
--    a) delegate-path mid-registration abandoners: a delegates row with no
--       completion stamp. Under the new model delegacy sits ON TOP of
--       membership; a delegates-row + registered-standing hybrid would bounce
--       between /delegate and the delegate layout's redirect forever. They are
--       abandoned staging signups — remove them (profiles delete cascades the
--       delegates row; nothing references an unapproved delegate: only approved
--       delegates are choosable, and ADR-016 keeps incomplete ones unapprovable).
delete from profiles p
  where p.registration_completed_at is null
    and p.status <> 'active_member'
    and exists (select 1 from delegates d where d.id = p.id);
--    b) old-funnel step-1 abandoners: FUNNEL-created drafts never carry a
--       personal_id (funnel_save_profile set the ID and flipped status in one
--       statement). SEEDED draft rows (service-role, scripts/seed-staging.mjs)
--       DO carry an ID (+ region) — those deliberately survive and become
--       registered people in step 2; Task 8 reseeds staging properly anyway.
delete from profiles where status = 'draft' and personal_id is null;

-- 2) draft → registered. After (1) zero 'draft' rows remain, so this is a pure
--    label change; stored view/trigger expressions reference the enum internally
--    and are unaffected.
alter type member_status rename value 'draft' to 'registered';

-- 3) Wizard-choice column (server-managed; spec §4.3): step A's delegate pick,
--    validated again at completion.
alter table profiles add column pending_delegate_id uuid references delegates(id);

-- 4) Old mid-step-3 abandoners become mid-wizard registered people (spec §7.3):
--    carry the delegate choice over as the wizard prefill, close the premature
--    membership (backing is member-only, D1), reset the standing.
update profiles p set pending_delegate_id = m.delegate_id
  from memberships m
  where m.member_id = p.id and m.ended_at is null
    and p.status = 'profile_completed' and p.registration_completed_at is null;
update memberships m set ended_at = now()
  from profiles p
  where m.member_id = p.id and m.ended_at is null
    and p.status = 'profile_completed' and p.registration_completed_at is null;
update profiles set status = 'registered'
  where status = 'profile_completed' and registration_completed_at is null;

-- 5) No role at the door: signup_role is dead. (Legacy delegates keep their
--    delegates row; that IS the role.) No view references this column.
alter table profiles drop column signup_role;

-- 6) Server-managed column protection: minus signup_role, plus pending_delegate_id.
--    IMPORTANT: based on the LIVE hardened body (20260716140000 §1), which also
--    enforces value rules on the Phase-3 scoped-grant columns (they render on
--    PUBLIC pages) — that rider must survive this replacement.
create or replace function protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.status is distinct from old.status
      or new.personal_id is distinct from old.personal_id
      or new.phone is distinct from old.phone
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
      or new.signup_ref_code is distinct from old.signup_ref_code
      or new.membership_tier is distinct from old.membership_tier
      or new.reference_code is distinct from old.reference_code
      or new.registration_completed_at is distinct from old.registration_completed_at
      or new.pending_delegate_id is distinct from old.pending_delegate_id
    then
      raise exception 'server-managed profile columns cannot be changed by client roles';
    end if;
    -- Phase 3 hardening rider — keep: value rules on direct client PATCHes
    if new.first_name is distinct from old.first_name
       and length(btrim(coalesce(new.first_name, ''))) not between 1 and 60 then
      raise exception 'invalid_name';
    end if;
    if new.last_name is distinct from old.last_name
       and length(btrim(coalesce(new.last_name, ''))) not between 1 and 60 then
      raise exception 'invalid_name';
    end if;
    if new.employment is distinct from old.employment
       and length(btrim(coalesce(new.employment, ''))) not between 1 and 100 then
      raise exception 'invalid_employment';
    end if;
  end if;
  return new;
end $$;

-- 7) The funnel RPC surface is retired.
drop function funnel_start(text, text, text, text);
drop function funnel_save_profile(text, date, int, int, text, uuid, boolean);
drop function funnel_complete(int);
drop function funnel_state();

-- 7b) Late-bound dependents of the dropped/renamed surface (review finding —
--     plpgsql resolves names and enum literals at RUN time, so none of these
--     block the statements above; they would break at first call instead).
--     Recreate each one against the new surface, copying the LIVE body verbatim
--     from the named migration and applying exactly the listed change:
--
--     * member_change_delegate — copy 20260715213000_cabinets.sql §4; change the
--       final `return public.funnel_state();` → `return public.cabinet_state();`
--     * member_change_tier — copy 20260715213000_cabinets.sql §5; same
--       return-value change.
--     * delegate_panel — copy 20260716140000_cabinet_hardening.sql §2; change
--       the draftCount predicate `p.status = 'draft'` → `p.status = 'registered'`
--       (the jsonb key stays `draftCount` — churn control; the stat now honestly
--       means "registered via my code, not yet a member". The partial index
--       profiles_draft_by_ref_code survives the rename by OID and still serves
--       this predicate. The delegate-page LABEL change is Task 6.)
--     * recompute_member_active — copy the LIVE body from
--       20260718100000_admin_crm_hardening.sql (~lines 33-51; it superseded the
--       admin_crm.sql original with the tbilisi_today() fix — keep that); change
--       `if not found or v_status = 'draft' then return;` → `... = 'registered' ...`
--       (registered people have no tier/payments — the engine keeps skipping them).
--     * recompute_all_active — copy the LIVE body from
--       20260718100000_admin_crm_hardening.sql (~lines 53-70, tbilisi_today()
--       kept); change `where p2.status <> 'draft'` → `where p2.status <> 'registered'`.
--     * admin_export_members — copy the live definition; change the p_status
--       whitelist `('draft', 'profile_completed', 'active_member')` →
--       `('registered', 'profile_completed', 'active_member')`.
--
--     All are `create or replace` with unchanged signatures and grants.

-- 8) Registered gate (spec §4.2): profile existence IS the registered standing —
--    register() only ever creates complete rows.
create function is_registered() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;
grant execute on function is_registered() to authenticated;
revoke execute on function is_registered() from public, anon;

-- 9) cabinet_state(): the one state read for every cabinet/registration surface.
create function cabinet_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate public.delegates%rowtype;
  v_has_delegate boolean := false;
  v_standing text;
  v_referral jsonb;
  v_pending jsonb;
  v_chosen jsonb;
  v_membership_exists boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then return jsonb_build_object('exists', false); end if;

  select * into v_delegate from public.delegates where id = v_uid;
  v_has_delegate := found;
  v_standing := case
    when v_profile.registration_completed_at is not null
      or v_profile.status = 'active_member' then 'member'
    else 'registered'
  end;

  if not v_has_delegate and v_profile.signup_ref_code is not null then
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

  if v_profile.pending_delegate_id is not null then
    select jsonb_build_object('id', d.id, 'firstName', pr.first_name, 'lastName', pr.last_name)
      into v_pending
      from public.delegates d
      join public.profiles pr on pr.id = d.id
      where d.id = v_profile.pending_delegate_id;
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
    'standing', v_standing,
    'status', v_profile.status,
    'role', case when v_has_delegate then 'delegate' else 'member' end,
    'firstName', v_profile.first_name,
    'lastName', v_profile.last_name,
    'personalIdMasked', left(coalesce(v_profile.personal_id, ''), 3) || '********',
    'birthDate', v_profile.birth_date,
    'regionId', v_profile.region_id,
    'cityId', v_profile.city_id,
    'employment', v_profile.employment,
    'tier', v_profile.membership_tier,
    'referenceCode', v_profile.reference_code,
    'completed', v_standing = 'member',
    'delegateStatus', case when v_has_delegate then v_delegate.status::text end,
    'referral', v_referral,
    'pendingDelegate', v_pending,
    'chosenDelegate', v_chosen,
    'membershipExists', coalesce(v_membership_exists, false),
    'registrationCompletedAt', v_profile.registration_completed_at,
    'createdAt', v_profile.created_at,
    'admin', exists (select 1 from public.admin_roles ar where ar.user_id = v_uid)
  );
end $$;

-- 10) register(): the one-door light registration (spec §4.1). Atomic and
--     idempotent: an existing profile makes this a state read (duplicate phone =
--     the same auth user after OTP — never overwritten).
create function register(
  p_first_name text,
  p_last_name text,
  p_personal_id text,
  p_ref_code text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_ref text := nullif(btrim(coalesce(p_ref_code, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    -- duplicate phone after OTP: a state read, never an overwrite (spec §8)
    return public.cabinet_state() || jsonb_build_object('created', false);
  end if;
  if p_first_name is null or length(btrim(p_first_name)) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name)) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
    raise exception 'invalid_personal_id';
  end if;
  -- Phase 3 rider parity (20260715213000 §4.6): junk ref codes are silently dropped
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9-]{1,32}$' then
    v_ref := null;
  end if;
  if exists (select 1 from public.profiles pr where pr.personal_id = p_personal_id) then
    raise exception 'duplicate_personal_id';
  end if;

  select case
           when u.phone is null then null
           when left(u.phone, 1) = '+' then u.phone
           else '+' || u.phone
         end
    into v_phone
    from auth.users u where u.id = v_uid;

  insert into public.profiles (id, first_name, last_name, phone, personal_id, status, signup_ref_code)
  values (
    v_uid, btrim(p_first_name), btrim(p_last_name), v_phone, p_personal_id, 'registered', v_ref
  );

  return public.cabinet_state() || jsonb_build_object('created', true);
end $$;

-- 11) Wizard step A (spec §4.3): fields + delegate pick; standing stays registered.
--     Stored approved referral wins over the picker — same precedence as Phase 2.
create function become_member_save_profile(
  p_birth_date date,
  p_region_id int,
  p_city_id int,
  p_employment text,
  p_delegate_id uuid default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate uuid;
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

  update public.profiles set
    birth_date = p_birth_date,
    region_id = p_region_id,
    city_id = p_city_id,
    employment = btrim(p_employment),
    pending_delegate_id = v_delegate
  where id = v_uid;

  return public.cabinet_state();
end $$;

-- 12) Wizard step B (spec §4.3): tier → membership row + reference code + member
--     standing, in one transaction. Membership creation lives HERE (D1), not in
--     profile-save. Idempotent like the old funnel_complete.
create function become_member_complete(p_tier int) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate uuid;
  v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;
  if v_profile.registration_completed_at is not null then
    return public.cabinet_state();
  end if;
  if v_profile.birth_date is null or v_profile.region_id is null
     or v_profile.city_id is null or v_profile.employment is null then
    raise exception 'profile_incomplete';
  end if;
  if p_tier is null or p_tier not in (5, 10, 20) then raise exception 'invalid_tier'; end if;

  -- re-validate the held choice; a delegate who lost approval falls back to central
  select d.id into v_delegate
    from public.delegates d
    where d.id = v_profile.pending_delegate_id and d.status = 'approved';

  if not exists (
    select 1 from public.memberships m where m.member_id = v_uid and m.ended_at is null
  ) then
    begin
      insert into public.memberships (member_id, delegate_id) values (v_uid, v_delegate);
    exception when unique_violation then
      null; -- concurrent double-complete: the partial unique index already holds the row
    end;
  end if;

  loop
    v_code := 'GR-' || public.gen_funnel_code(6);
    begin
      update public.profiles set
        membership_tier = p_tier,
        reference_code = v_code,
        registration_completed_at = now(),
        status = case when status = 'registered' then 'profile_completed' else status end,
        pending_delegate_id = null
      where id = v_uid;
      exit;
    exception when unique_violation then
      -- reference_code collision — regenerate and retry
    end;
  end loop;

  return public.cabinet_state();
end $$;

-- 13) Gate widening (spec §4.2, D3): RSVP + going counts are registered-level.
--     Everything else keeps is_completed_member().
create or replace function member_rsvp(p_event_id uuid, p_going boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'not_completed'; end if;
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

create or replace view member_event_going_counts as
select e.id as event_id,
       count(r.member_id) filter (where r.status = 'going')::int as going
from events e
left join event_rsvps r on r.event_id = e.id
where e.status in ('published', 'cancelled') and is_registered()
group by e.id;

-- 14) Grants: the new RPC surface is authenticated-only, like everything before it.
grant execute on function cabinet_state() to authenticated;
revoke execute on function cabinet_state() from public, anon;
grant execute on function register(text, text, text, text) to authenticated;
revoke execute on function register(text, text, text, text) from public, anon;
grant execute on function become_member_save_profile(date, int, int, text, uuid) to authenticated;
revoke execute on function become_member_save_profile(date, int, int, text, uuid) from public, anon;
grant execute on function become_member_complete(int) to authenticated;
revoke execute on function become_member_complete(int) from public, anon;
```

Notes for the implementer (verified against the live schema files, do not re-derive):
- `tbilisi_today()` and `gen_funnel_code()` already exist (ADR-016 / Phase 2).
- VIEWS survive the enum rename by OID: `admin_overview` (`status <> 'draft'` → semantically `<> 'registered'` = exactly the members post-normalization), `admin_region_stats`, `transparency_stats.registered_members` (now counts members only — the public LABEL fix is Task 6; R2 rebuilds these for the real counters; do NOT touch the views here).
- plpgsql FUNCTION bodies do NOT survive: enum literals in function text re-parse at run time — that is why section 7b exists. After writing the migration, grep every live migration for `'draft'` and `funnel_state` and confirm section 7b covers each hit that is a function body (expected hits: the six functions listed, the dropped funnel RPCs, view definitions, and the partial index — nothing else).
- Dropping `signup_role` is safe: no view or function other than the dropped/recreated RPCs references it (checked: `admin_members` column list, `public_delegates`, community views).
- `styleguide` and admin CONTENT pages use `"draft"` for news/events/polls statuses — different enums, untouched.

- [ ] **Step 4: Update `lib/supabase/types.ts`**

In the `profiles` Row/Insert/Update types: remove `signup_role`, add `pending_delegate_id: string | null`. In `Functions`: delete the four `funnel_*` entries; add:

```ts
cabinet_state: { Args: Record<PropertyKey, never>; Returns: Json };
register: {
  Args: {
    p_first_name: string;
    p_last_name: string;
    p_personal_id: string;
    p_ref_code?: string | null;
  };
  Returns: Json;
};
become_member_save_profile: {
  Args: {
    p_birth_date: string;
    p_region_id: number;
    p_city_id: number;
    p_employment: string;
    p_delegate_id?: string | null;
  };
  Returns: Json;
};
become_member_complete: { Args: { p_tier: number }; Returns: Json };
is_registered: { Args: Record<PropertyKey, never>; Returns: boolean };
```

- [ ] **Step 5: Push and verify**

**Cutover warning (shared staging, ADR-005):** the moment this push lands, the deployed main-branch staging app loses `funnel_state`/`funnel_start` — signed-in cabinet visits and new registrations on THAT deployment error until R1 merges and deploys (public pages keep working; this branch's preview works). Push only when proceeding continuously into Tasks 5–9, do not run main-branch e2e during the window, and record the window in the PR/QA evidence so the owner isn't surprised by a broken staging main.

Run: `npx supabase db push` (staging project, per ADR-005 setup), then
`node --env-file=.env.local scripts/verify-schema.mjs`
Expected: probe PASS end-to-end, including the negative probes (old RPCs 404, duplicate ID rejected, registered RSVP allowed).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260721120000_progressive_registration.sql lib/supabase/types.ts scripts/verify-schema.mjs
git commit -m "feat(db): progressive-registration surface — registered standing, register/become_member RPCs, registered RSVP gate"
```

---

### Task 5: `/join` single-page registration + homepage CTA

**Files:**
- Rewrite: `app/(public)/join/page.tsx` (was the JoinChoice server wrapper), `app/(public)/join/actions.ts`
- Delete: `app/(public)/join/JoinChoice.tsx`, `app/(public)/join/step-1/page.tsx`
- Modify: `app/(public)/page.tsx` (hero CTAs), `app/(public)/login/page.tsx` (rpc + type rename)
- Modify: `lib/supabase/server.ts` (`getFunnelState` → `getCabinetState`, rpc `cabinet_state`) and mechanically update its import at every call site listed in File Structure (the pages themselves are reworked in Tasks 6–7; here only the identifier/rpc rename so the repo compiles)

**Interfaces:**
- Consumes: `registerSchema`/`registerActionSchema` (Task 2), `deriveDestination` (Task 3), `register` RPC (Task 4), existing `OtpVerification` component.
- Produces: `registerAction(input: unknown): Promise<ActionResult>` where `ActionResult = { ok: true; state: CabinetState } | { ok: false; error: string }` — consumed by Task 7's wizard actions pattern and e2e.

- [ ] **Step 1: Rewrite `app/(public)/join/actions.ts`**

```ts
"use server";

import { GENERIC_FUNNEL_ERROR, mapFunnelError, type CabinetState } from "@/lib/funnel";
import { registerActionSchema } from "@/lib/funnel-schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: true; state: CabinetState } | { ok: false; error: string };

export async function registerAction(input: unknown): Promise<ActionResult> {
  const parsed = registerActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("register", {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_personal_id: parsed.data.personalId,
    p_ref_code: parsed.data.refCode ?? null,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as unknown as CabinetState };
}
```

- [ ] **Step 2: Rewrite `app/(public)/join/page.tsx`** as the single registration page (client). Reuse the structure of the old `step-1/page.tsx` (form → `supabase.auth.signInWithOtp` → `OtpVerification` → action), with these exact differences:

- Four fields: სახელი, გვარი, **პირადი ნომერი** (inputMode numeric, maxLength 11, helper „11 ნიშნა“ — copy the field block from old `step-2/page.tsx:218-230`), ტელეფონის ნომერი.
- Validate with `registerSchema` (includes phone) before sending the OTP.
- No `role`, no Stepper. Eyebrow: `რეგისტრაცია`; heading: `შემოგვიერთდი ერთ წუთში`; sub: `მხოლოდ ძირითადი მონაცემები — დანარჩენს კაბინეტში ნახავ.`
- `?ref=` capture identical to old step-1 (`isReferralCodeCandidate`).
- On mount (JoinChoice's old job): `supabase.auth.getUser()`; if signed in, `supabase.rpc("cabinet_state")`; if `state.exists` → `router.replace(deriveDestination(state))`.
- `afterVerify`: call `registerAction({ firstName, lastName, personalId, refCode })`. On `ok`, branch on the deterministic `created` flag (Task 1 interface, set only by `register()`, Task 4):
  - `result.state.created === false` → the phone already had an account (RPC no-opped, nothing overwritten): show the „ეს ნომერი უკვე რეგისტრირებულია“ notice (`data-testid="join-notice"`), then after 1500ms — same timeout-with-cleanup pattern as old step-1 — `router.replace(deriveDestination(result.state))`.
  - `result.state.created === true` → fresh registration: `router.replace("/me")` directly — the cabinet greets them (no ceremony page, spec §4.1).
- The phase machine is explicit: `type JoinPhase = “form” | “otp” | “retry”`. `form` → validate all four fields with `registerSchema` → `signInWithOtp` → `otp`. OTP success → `registerAction`. On `!ok` with `DUPLICATE_PERSONAL_ID_MESSAGE` → `retry`: the same form renders with the error on the personalId field and the **phone field disabled** with helper text „ნომერი დადასტურებულია” (the session is bound to that phone — editing it there would do nothing), and submit now calls `registerAction` directly, **no new OTP**. Any other `!ok` error returns to `form` with the form-level error (a fresh OTP on the next submit is correct there).

- [ ] **Step 3: Homepage CTA (`app/(public)/page.tsx:46-53`)** — replace both ButtonLinks with:

```tsx
<ButtonLink href="/join" size="lg">
  დარეგისტრირდი
</ButtonLink>
```

(The delegate pitch is retired, spec D4. Leave the stats grid untouched — R2 adds the registered counter.)

- [ ] **Step 4: `lib/supabase/server.ts` + login page + mechanical renames**

- `getFunnelState` → `getCabinetState`, returning `CabinetState`, calling `rpc("cabinet_state")`; update the doc comment ("cabinet_state read…").
- `app/(public)/login/page.tsx:44-49`: `rpc("cabinet_state")`, `CabinetState` type import.
- Repo-wide: update every `getFunnelState` import/call (`app/(member)/layout.tsx`, `app/(delegate)/layout.tsx`, `app/(admin)/layout.tsx`, `app/(member)/me/*.tsx`, `app/(delegate)/delegate/*.tsx`) to `getCabinetState`. Where those files read `state.role` for nav they compile unchanged; `(member)/layout` gating is properly reworked in Task 6 — here it must only compile: change its gate line to `if (!state.exists) redirect("/join");` (temporary over-admission is fine; Task 6 finishes the job before anything ships).

- [ ] **Step 5: Delete dead files**

```bash
git rm app/(public)/join/JoinChoice.tsx "app/(public)/join/step-1/page.tsx"
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — remaining errors must ONLY be in files owned by Tasks 6–7 (step-2/3, done, pending, useFunnelGuard, me pages). List them; if anything else is red, fix here.
Run: `npx vitest run` — all lib/component suites PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(join): one-door light registration replaces choice screen + step-1; single homepage CTA"
```

---

### Task 6: Cabinet standings — layout, overview, per-page gates

**Files:**
- Modify: `app/(member)/layout.tsx`, `app/(member)/me/page.tsx`, `app/(member)/me/profile/page.tsx`, `app/(member)/me/news/page.tsx`, `app/(member)/me/billing/page.tsx`, `app/(member)/me/polls/page.tsx`, `app/(member)/me/delegate/page.tsx`, `app/(member)/me/events/page.tsx` (only if it renders member-gated affordances — verify)

**Interfaces:**
- Consumes: `getCabinetState`, `cabinetRole`, `cabinetNavItems`, `deriveMembershipPhase`.
- Produces: the URL contract e2e relies on — registered user: `/me` renders overview; `/me/billing`, `/me/polls`, `/me/delegate` redirect to `/me`; `/me/news` shows public items; `/me/events` works incl. RSVP.

- [ ] **Step 1: `app/(member)/layout.tsx`**

```tsx
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const state = await getCabinetState();
  if (!state.exists) redirect("/join");
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <CabinetNav items={cabinetNavItems(cabinetRole(state), state.admin)} />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: `/me` overview (`app/(member)/me/page.tsx`)** — full rewrite (server component):

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { deriveMembershipPhase } from "@/lib/funnel";
import { getCabinetState } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ჩემი კაბინეტი — ქართული რესპუბლიკა" };

const PERKS = [
  "ხმის მიცემა გამოკითხვებში",
  "საკუთარი დელეგატის არჩევა",
  "წევრებისთვის განკუთვნილი სიახლეები",
] as const;

export default async function CabinetOverviewPage() {
  const state = await getCabinetState();
  if (state.role === "delegate") redirect("/delegate");
  if (state.standing === "member") redirect("/me/profile");

  const phase = deriveMembershipPhase(state);
  return (
    <main>
      <div className="mb-8">
        <Eyebrow>პირადი კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">გამარჯობა, {state.firstName}!</h1>
        <p className="mt-2 text-sm text-muted-fg">
          რეგისტრაცია დასრულებულია — შენ უკვე მოძრაობის ნაწილი ხარ.
        </p>
      </div>
      <Card>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">შემდეგი ნაბიჯი</p>
        <h2 className="mt-1 text-xl font-bold text-ink">გახდი წევრი</h2>
        <p className="mt-1 text-sm text-muted-fg">
          წევრობა ხსნის მოძრაობის სრულ შესაძლებლობებს — ყოველთვიური საწევრო 5₾-დან.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm text-ink">
              <span aria-hidden>✅</span>
              <span>{perk}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5">
          <ButtonLink href="/me/membership" size="lg" data-testid="become-member-cta">
            {phase === "tier" ? "გააგრძელე წევრობის გაფორმება →" : "გახდი წევრი →"}
          </ButtonLink>
        </div>
      </Card>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="text-base font-bold text-ink">ღონისძიებები</h3>
          <p className="mt-1 text-sm text-muted-fg">ნახე მომავალი შეხვედრები და დაარეგისტრირე დასწრება.</p>
          <div className="mt-3"><ButtonLink href="/me/events" variant="ghost">ნახვა</ButtonLink></div>
        </Card>
        <Card>
          <h3 className="text-base font-bold text-ink">სიახლეები</h3>
          <p className="mt-1 text-sm text-muted-fg">მოძრაობის საჯარო განცხადებები და ამბები.</p>
          <div className="mt-3"><ButtonLink href="/me/news" variant="ghost">ნახვა</ButtonLink></div>
        </Card>
      </div>
    </main>
  );
}
```

(If `ButtonLink` lacks a `data-testid` passthrough, wrap it: `<div data-testid="become-member-cta">` — check the component before inventing props.)

- [ ] **Step 3: Member-only page gates** — at the top of `billing`, `polls`, and `delegate` (my-delegate) pages, right after the state fetch:

```tsx
if (!state.completed) redirect("/me"); // members only (spec §4.2)
```

(`me/delegate/page.tsx` already redirects delegates; add the completed gate above it. `me/polls/page.tsx` reads views that self-gate — the redirect is UX, DB stays the enforcement.)

- [ ] **Step 4: `/me/news` source switch** — the page currently queries `member_news`. Change to:

```tsx
const source = state.completed ? "member_news" : "public_news";
```

and query that view (both expose `id, slug, title, body, image_url, published_at`; `member_news` additionally has `visibility` — for the registered branch, render without the visibility pill). Article page `/me/news/[slug]`: same source switch; a registered user opening a member-only slug gets PostgREST zero rows → existing notFound() path handles it.

- [ ] **Step 5: `/me/profile` registered variant** — the page today renders member facts (tier, reference code, member-since) plus the edit form. Gate the member-only sections with `state.completed`; for registered standing render: name edit (existing scoped-grant form fields for first/last name only — region/city/employment inputs hidden), phone display (`formatPhoneKa`), and a compact upgrade prompt card linking `/me/membership`. Do not duplicate the overview's hero — one short Card with a ButtonLink.

- [ ] **Step 6: `/me/events`** — verify the page renders for `!completed` (it lives under the same layout; going counts + RSVP now work via the widened DB gates from Task 4). If any client component takes a `completed` prop to hide RSVP buttons, remove that gating so registered users see the buttons.

- [ ] **Step 6b: Member facts keep rendering from `state.status`** — billing (`app/(member)/me/billing/page.tsx:40`) keeps its activation notice via `state.status !== "active_member"`; profile (`app/(member)/me/profile/page.tsx:52-53`) keeps the active/member Pill, but its non-active label changes „რეგისტრირებული" → „წევრი" (that word now means the light tier). The registered profile variant shows the ID as `state.personalIdMasked` („პირადი ნომერი", display-only) — a deliberate refinement of spec §4.2: the own-ID display is masked so the raw ID never rides every cabinet state response (ADR-014 spirit; flag in the owner evidence).

- [ ] **Step 6c: Delegate-layout loop-break (defense in depth)** — `app/(delegate)/layout.tsx`: split the combined gate into `if (!state.exists || state.role !== "delegate") redirect(deriveDestination(state));` then `if (!state.completed) redirect("/me");`. A delegates-row holder who is somehow not completed must land in the cabinet, never bounce back toward `/delegate` (the migration removes the known hybrids; this makes the redirect loop unrepresentable regardless).

- [ ] **Step 6d: Vocabulary sweep on live pages** —
  - delegate panel stat label `app/(delegate)/delegate/page.tsx:90`: „მონახაზები (Draft)" → „რეგისტრირებული" (the recreated `delegate_panel.draftCount` now counts registered-via-my-code people — same key, honest new meaning);
  - transparency page `app/(public)/transparency/page.tsx:41`: label „რეგისტრირებული წევრი" → „წევრი" (the view still counts members; the real registered counter is R2);
  - admin transfer page `app/(admin)/admin/transfer/page.tsx:37`: `.neq("status", "draft")` → `.neq("status", "registered")`;
  - admin members filter `app/(admin)/admin/members/page.tsx:122`: `<option value="draft">მონახაზი</option>` → `<option value="registered">რეგისტრირებული</option>`, and source all three option labels from `MEMBER_STATUS_LABELS_KA` so the vocabulary can't drift again.

- [ ] **Step 7: Verify + commit**

Run: `npx tsc --noEmit` (only Task-7-owned files may remain red: step-2/3, done, pending, useFunnelGuard). `npx vitest run` PASS.

```bash
git add -A
git commit -m "feat(cabinet): registered standing — overview, nav, member-only gates, news/profile variants"
```

---

### Task 7: `/me/membership` wizard; delete the old funnel routes

**Files:**
- Create: `app/(member)/me/membership/page.tsx`, `app/(member)/me/membership/MembershipWizard.tsx`, `app/(member)/me/membership/actions.ts`
- Delete: `app/(public)/join/step-2/page.tsx`, `app/(public)/join/step-3/page.tsx`, `app/(public)/join/done/page.tsx`, `app/(public)/join/pending/page.tsx`, `app/(public)/join/useFunnelGuard.ts`, `app/(public)/join/fresh-completion.ts`

**Interfaces:**
- Consumes: `membershipProfileSchema`, `tierSchema`, `deriveMembershipPhase`, RPCs `become_member_save_profile` / `become_member_complete`, components `DelegateBinding`, `TierPicker`, `TransferInstructions`, `Stepper` (Task 3 signature), `Field`, `Card`, `Button`.
- Produces: `saveMembershipProfileAction(input: unknown): Promise<ActionResult>`, `completeMembershipAction(input: unknown): Promise<ActionResult>` (same `ActionResult` as Task 5 — import it from `../../../(public)/join/actions` is WRONG (route-group crossing); define the type once in `lib/funnel.ts` as `export type ActionResult = { ok: true; state: CabinetState } | { ok: false; error: string };` and have both action files import it — do this now and drop the local declaration in join/actions.ts).

- [ ] **Step 1: `actions.ts`**

```ts
"use server";

import { GENERIC_FUNNEL_ERROR, mapFunnelError, type ActionResult, type CabinetState } from "@/lib/funnel";
import { membershipProfileSchema, tierSchema } from "@/lib/funnel-schemas";
import { createServerSupabase } from "@/lib/supabase/server";

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
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as unknown as CabinetState };
}

export async function completeMembershipAction(input: unknown): Promise<ActionResult> {
  const parsed = tierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("become_member_complete", { p_tier: parsed.data.tier });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as unknown as CabinetState };
}
```

- [ ] **Step 2: `page.tsx`** (server): fetch state; `if (state.role === "delegate") redirect("/delegate"); if (state.completed) redirect("/me/profile");` then render `<MembershipWizard initialState={state} />` (serialize the `CabinetState` as a prop — it is plain JSON).

- [ ] **Step 3: `MembershipWizard.tsx`** (client). One component, three phases driven by local state initialized from `deriveMembershipPhase(initialState)`:

- **profile phase**: port the form from the old `step-2/page.tsx` VERBATIM minus the personalId field, minus the tcAccepted branch, minus `useFunnelGuard` (state arrives as a prop; after actions, use the returned state). Keep: `LabeledSelect` helper, region→city cascade, employment preset/„სხვა" logic, `DelegateBinding` with referral card (from `initialState.referral`) and prefill (`initialState.pendingDelegate?.id ?? initialState.chosenDelegate?.id ?? null`), one-time prefill of saved fields from `initialState` (birthDate/regionId/cityId/employment — same `initialized` pattern). Submit → `saveMembershipProfileAction` → on ok: `setState(result.state); setPhase("tier")`.
- **tier phase**: port from old `step-3/page.tsx`: `TierPicker`, submit → `completeMembershipAction({ tier })` → on ok: `setState(result.state); setPhase("done")`. Do **NOT** call `router.refresh()` here — the page's server gate redirects completed members to `/me/profile`, so a refresh would yank away the just-rendered done screen (the only place the GR- code + bank instructions appear). The nav flips to the member variant on the next server navigation (the done phase's own „ჩემი კაბინეტი" link).
- **done phase**: port the old `done/page.tsx` card body (TransferInstructions with `state.tier`/`state.referenceCode`, chosen-delegate line with `data-testid="chosen-delegate"`, the „აქტიური წევრის სტატუსი…" note), buttons: `<ButtonLink href="/me/profile">ჩემი კაბინეტი</ButtonLink>` only. No fresh-completion marker — the done phase renders in-place from the completion result, never on a revisit (revisits hit the page-level `state.completed` redirect).
- Header: `<Stepper steps={["პროფილი", "საწევრო"]} current={phase === "profile" ? 1 : 2} />` (hidden in done phase). Eyebrow „წევრობის გაფორმება".
- Back-navigation: in tier phase render a ghost Button „← პროფილის შესწორება" that sets phase back to profile (fields stay editable until completion — the RPC allows re-saving).

- [ ] **Step 4: Delete the old funnel**

```bash
git rm "app/(public)/join/step-2/page.tsx" "app/(public)/join/step-3/page.tsx" "app/(public)/join/done/page.tsx" "app/(public)/join/pending/page.tsx" app/(public)/join/useFunnelGuard.ts app/(public)/join/fresh-completion.ts
```

- [ ] **Step 5: Full green gate**

Run: `npx tsc --noEmit` — ZERO errors now. `npx vitest run` — PASS. `npm run lint` — clean. `npm run build` — succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cabinet): in-cabinet membership wizard (profile → tier → done); old funnel routes removed"
```

---

### Task 8: Staging seed — registered rows instead of drafts

**Files:**
- Modify: `scripts/seed-staging.mjs` (lines ~285-325 person-kind logic, line ~483 assertion filter)

- [ ] **Step 1:** Change the person-kind generator: `kind: "draft"` → `kind: "registered"`; seeded registered rows get `status: "registered"` WITH a `personal_id` (1-prefixed per seed convention) and NO birth_date/region/city/employment/tier/reference_code (they completed only the light form — also drop the `region_id` the old draft rows carried, `seed-staging.mjs:316`, for registered-kind rows). **Remove the `signup_role` key from the profiles insert (`seed-staging.mjs:326`) — Task 4 drops that column and the insert would 42703 otherwise** (delegate-ness is expressed solely by the delegates-row insert the seed already does). Update the `.neq("status", "draft")` assertion (line ~483) to `.neq("status", "registered")` (same intent, new name). Seeded `"completed"`-kind rows already set `registration_completed_at` (verified, line 324) — under the new semantics that stamp IS member standing; keep it.
- [ ] **Step 2:** Run: `npm run seed:staging`
Expected: seed completes; canonical admins untouched; summary line reports the registered count.
- [ ] **Step 3:** Commit: `git add scripts/seed-staging.mjs && git commit -m "chore(seed): registered-standing rows replace draft rows"`

---

### Task 9: e2e — registration + membership journeys; helper surgery

**Files:**
- Create: `e2e/registration.spec.ts`, `e2e/membership.spec.ts`
- Delete: `e2e/funnel.spec.ts`
- Modify: `e2e/funnel-helpers.ts`, `e2e/community-helpers.ts`, `e2e/admin-approval.spec.ts`, `e2e/delegate-panel.spec.ts`, `e2e/admin-payments.spec.ts`, `e2e/admin-rbac.spec.ts`, `e2e/community-events.spec.ts`, `e2e/community-news.spec.ts`, `e2e/community-polls.spec.ts`, `e2e/public.spec.ts`, `e2e/smoke.spec.ts`, `e2e/login.spec.ts`, `e2e/cabinet.spec.ts`

(That list is the FULL import blast radius of `passStep1`/`fillStep2Basics`/funnel routes — verified by grep. After this task, `grep -l "passStep1\|fillStep2Basics\|/join/step-" e2e/` must return nothing.)

**Interfaces:**
- Produces in `funnel-helpers.ts`:
  - `passRegistration(page, { phone, firstName, lastName, personalId }): Promise<void>` — fills the 4 fields on `/join`, completes dev-OTP (same `dev-otp`/`otp-0` mechanics as the old `passStep1`), waits for `/me`.
  - `fillMembershipProfile(page, { regionLabel }): Promise<void>` — old `fillStep2Basics` minus personalId.
  - `seedCompletedMember({ phone, firstName, lastName, personalId, tier? }): Promise<{ id: string }>` — service-role: `auth.admin.createUser({ phone, phone_confirm: true })`, insert a COMPLETE member profile (all wizard fields, `status: "profile_completed"`, `registration_completed_at`, tier (default 10), `GR-`+random reference code) **plus an open membership row (delegate_id null = central)** — the new invariant: members always hold a membership. Guard: throw unless the phone starts with `55`.
  - `seedPendingDelegate({ phone, firstName, lastName, personalId }): Promise<{ id: string }>` — `seedCompletedMember` first, then **close its open membership** (delegates hold none — Phase 3 invariant), then insert the `delegates` row (`status: "pending"`, random 6-char referral code from the funnel alphabet, `tc_accepted_at` now). Replaces UI-driven delegate creation until R2's request flow exists.
  - `loginAs(page, phone): Promise<void>` — drives `/login` with the dev-OTP oracle (same mechanics as `login.spec.ts`); pairs with the seed helpers whenever a spec needs the BROWSER signed in as a seeded user (community specs read auth cookies via `memberRpcClient`).
  - `JOURNEY` slots reworked — single digits are scarce (0–9, with 9 reserved for login.spec's fixed phone), so the table is explicit:
    ```ts
    export const JOURNEY = {
      regHappy: 0,     // registration.spec: happy path + duplicate-phone re-entry
      membFull: 1,     // membership.spec: full upgrade
      regDupId: 2,     // registration.spec: duplicate personal ID + retry
      membResume: 3,   // membership.spec: wizard resume
      regReferral: 4,  // registration.spec + membership.spec: referral capture → completion
      cabinet: 5,      // cabinet.spec (ported setup)
      membRsvp: 6,     // membership.spec: RSVP as registered
      spare: 7,        // 8 also free
    } as const;
    ```
    `cleanupJourneyUsers` keys off phones — mechanics unchanged. Admin/community specs keep their separate `phase4Phone` range (no collision with journey phones).
- Changes in `community-helpers.ts`:
  - `registerCompletedMember(page, k)` is REWRITTEN, same signature and same postcondition (browser signed in as a completed member): `seedCompletedMember` with `phase4Phone(k)`/`phase4PersonalId(k)` + `loginAs(page, phone)`. Its consumers (community-events/news/polls, admin-payments) keep working untouched wherever they only need "a signed-in completed member". Direct seeding is deliberate: the wizard UI journey is membership.spec's job; these suites test community/admin behavior and get faster and less flaky.

- [ ] **Step 1: `e2e/registration.spec.ts`** — journeys (serial, own phones):
  1. **happy path**: `/join` → `passRegistration` → lands on `/me`; overview shows „გამარჯობა"; nav shows exactly მთავარი/ღონისძიებები/სიახლეები/პროფილი (assert `/me/polls` link ABSENT); `/me/billing` direct visit redirects to `/me`.
  2. **duplicate phone**: `passRegistration` again with the SAME phone, different personal ID → notice „ეს ნომერი უკვე რეგისტრირებულია" → lands on `/me` (profile untouched: overview still greets the ORIGINAL first name).
  3. **duplicate personal ID**: new phone, personal ID from journey 1 → field error „ეს პირადი ნომერი უკვე რეგისტრირებულია."; correct the ID inline → succeeds without a second OTP.
  4. **referral capture**: `getSeededReferral()`; `/join?ref=CODE` → register → `/me/membership` shows the referral binding card with the delegate's name (capture-at-registration, spec D1).
- [ ] **Step 2: `e2e/membership.spec.ts`**:
  1. **full upgrade**: register → overview CTA → profile phase (fillMembershipProfile, delegate picker visible for no-referral user) → tier 10 → done phase shows `GR-` code (`chosen-delegate` testid renders „ცენტრალური მოძრაობა") → nav now has გამოკითხვები/გადახდები; `/me/profile` shows tier facts.
  2. **resume**: register → save profile phase only → go to `/me` (CTA reads „გააგრძელე…") → reopen `/me/membership` → lands on TIER phase directly (fields survived).
  3. **referral binding at completion**: the journey-4 user from registration.spec (or a fresh one with `?ref=`) completes the wizard → `/me/delegate` shows that delegate as current.
  4. **registered RSVP**: register (no upgrade) → seed a published event via existing community admin helpers → `/me/events` → RSVP „მოვალ" → count/state visible after reload.
- [ ] **Step 3: Helper surgery in dependent specs** —
  - `admin-approval.spec.ts` + `delegate-panel.spec.ts`: replace UI funnel-registration setup with `seedPendingDelegate(...)` (+ existing `approveOwnDelegate` where the journey needs an approved one).
  - `admin-payments.spec.ts`: its first test drives the old funnel end-to-end ("a fresh member registers…") — its real subject is payment recording against a fresh member, so seed via `seedCompletedMember` + `loginAs` and keep every payment assertion; drop the funnel-walk assertions (that journey lives in registration/membership specs now).
  - `admin-rbac.spec.ts`: imports `passStep1` for its actor setup — port to the seed helpers the same way.
  - `community-news.spec.ts` / `community-polls.spec.ts`: keep working through the rewritten `registerCompletedMember`; additionally `community-polls.spec.ts:95` asserts the old JoinChoice redirect — update to the new `/join` behavior (a signed-in completed member visiting `/join` is redirected to their cabinet by the on-mount state check).
  - `community-events.spec.ts` needs MORE than the helper swap (verified: it drives `passStep1`/`fillStep2Basics` directly): its own delegate setup (line ~70, `dPage`) becomes `seedPendingDelegate` + existing `approveOwnDelegate` + `loginAs(dPage, ...)`; its supporter setup (line ~95) becomes `seedCompletedMember` + `loginAs`. The test's subject (events, RSVP, delegate team attendance view incl. the supporter's name at line ~151) stays exactly as-is.
  - `login.spec.ts`: completed-member destinations unchanged (`/me/profile`); add one case — a registered-standing user (seed via `passRegistration` or service-role insert) logging in lands on `/me`.
  - `public.spec.ts`/`smoke.spec.ts`: homepage assertions — single „დარეგისტრირდი" CTA, no „გახდი დელეგატი"; `/join` shows the four-field form (assert the „პირადი ნომერი" input present).
  - `cabinet.spec.ts`: its setup registers via the old funnel — port to `seedCompletedMember` + `loginAs` (its subject is post-registration cabinet behavior; UI journeys stay the job of registration/membership specs).
- [ ] **Step 4: Run**: `npm run e2e`
Expected: all specs green against staging. Flake rule: Georgian-text locators scope to roles/testids (lesson: PR #8).
- [ ] **Step 5: Commit**: `git add e2e && git commit -m "test(e2e): registration + membership journeys replace funnel; seeded pending delegates for admin/delegate specs"`

---

### Task 10: Whole-branch verification + review gate

- [ ] **Step 1:** Full local gate, in order:
```bash
npm run typecheck && npm run lint && npm run test && npm run build && npm run e2e
```
Expected: every stage green. Any failure: fix, re-run the full chain.
- [ ] **Step 2:** `node --env-file=.env.local scripts/verify-schema.mjs` — green (final schema probe).
- [ ] **Step 3:** Grep the repo for leftovers: `funnel_state|funnel_start|funnel_save_profile|funnel_complete|FunnelState|deriveFunnelStep|useFunnelGuard|signup_role|JoinChoice` → only migrations, specs/plans (docs), and DECISIONS.md may match. `getByText("გახდი დელეგატი")` must not appear outside prototype/ and docs.
- [ ] **Step 4:** Per-task code review (house process): request independent review of the branch diff; fix findings; then whole-branch review.
- [ ] **Step 5:** Push branch, open PR titled `Phase 6 R1 — Progressive registration (v0.7.0)`; version bump + CHANGELOG happen at ship time per the release ritual. Preview deploy → run /qa → collect plain-language evidence (screens: /join form, OTP, /me overview, wizard phases, done card, registered nav vs member nav, homepage CTA) → owner sign-off gate. **Do not merge without CI green + owner approval.**

---

## Engineering Review Round (2026-07-21, /plan-eng-review + independent adversarial pass)

Findings verified against live migrations/code and folded into the tasks above:

1. **[P1, fixed]** Five late-bound DB dependents of `funnel_state()` / the `'draft'` literal (`member_change_delegate`, `member_change_tier`, `delegate_panel`, `recompute_member_active`, `recompute_all_active`) plus `admin_export_members`' whitelist would have broken payments recording, the delegate panel, and cabinet actions at first call → migration section 7b recreates all six; regression probes added.
2. **[P1, fixed]** The planned `protect_profile_columns()` replacement silently reverted the Phase-3 hardening rider (value rules on publicly-rendered columns) → step 6 now bases on the hardened body.
3. **[P1, fixed]** Admin-UI blast radius was missing (`transfer` page `.neq('draft')`, members filter option, `admin-schemas` z.enum, export whitelist) → Tasks 3/4/6d.
4. **[P1, fixed]** e2e blast radius understated by six files (`community-helpers` + community suites, `admin-payments`, `admin-rbac`) → Task 9 rewritten with `seedCompletedMember`/`loginAs` helpers and the full grep-verified file list + explicit journey-slot table.
5. **[P1, fixed]** `CabinetState` dropped `status`, breaking billing's activation notice and profile's active Pill → `status` kept in the RPC + type; profile's non-active label „რეგისტრირებული"→„წევრი".
6. **[P1, documented]** Shared-staging cutover window (main-branch staging app breaks between db push and R1 merge) → explicit cutover warning + sequencing rule in Task 4 Step 5.
7. **[P2, fixed]** Wizard done-phase self-destruct via `router.refresh()` (server gate would redirect away the only rendering of the GR- code) → refresh removed; nav flips on next navigation.
8. **[P2, fixed]** Migration would have minted delegates-row+registered hybrids from delegate-path abandoners → step 1a deletes them; delegate layout loop-break added (Task 6c).
9. **[P2, fixed]** Spec §4.2 ID display was unimplementable (no personal_id in client reach) → `personalIdMasked` in `cabinet_state()`; masked display recorded as deliberate refinement for owner sign-off.
10. **[P3, fixed]** `MemberStatusRow` lives in `lib/supabase/types.ts`, not `lib/admin.ts` → Task 3 corrected; `register()` re-validates ref codes in-DB (Phase-3 rider parity); retry-phase phone field disabled; migration step-1 rationale corrected for seeded drafts; transparency/delegate-panel labels swept (Task 6d).
11. **[resolved tension]** The adversarial pass claimed `app/(admin)/layout.tsx` is not a `getFunnelState` call site — direct grep shows it is (line 19); the plan's rename list stands.

## Plan Self-Review (performed at authoring time)

- **Spec coverage (R1):** §4.1 registration (Task 5), duplicate paths (Tasks 4+5+9), referral capture (4/5/9), §4.2 nav + gates + RSVP widening (3/4/6), news source (6), profile variant (6), §4.3 wizard incl. membership-at-completion + resume + referral precedence (4/7/9), §4.4 acceptance (no delegacy path — Task 9 seeds pending delegates for admin specs), §6 data model (4), §7 migration incl. mid-step-3 normalization (4), §9 testing (1-4 unit, 9 e2e), §10 ritual (10). Not in R1 by design: §5 (public counters, admin buckets, delegacy request) — Release 2 plan.
- **Known intentional deviations:** none from spec; `ActionResult` moves to `lib/funnel.ts` (shared type, both action files).
- **Type consistency:** `CabinetState` field list is identical in Task 1 (TS interface) and Task 4 (`cabinet_state()` jsonb keys); `created?: boolean` is optional and appears ONLY on `register()` responses (both RPC paths append it explicitly) — `cabinet_state()` itself never returns it, and no other consumer may read it.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | (scope owner-locked in brainstorm, 5 decisions) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | dropped by owner decision 2026-07-15 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 15 findings (6 P1, 3 P2, 6 P3) — all fixed in-plan or documented |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | UI reuses existing design system verbatim |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not a developer-facing product |

- **OUTSIDE VOICE:** independent Claude adversarial subagent (fresh context) — 15 findings, 14 verified real, 1 refuted by direct grep (admin layout IS a call site). All folded into the Engineering Review Round section above.
- **UNRESOLVED:** 0 — every finding fixed in-plan, documented as accepted (staging cutover window), or refuted with evidence.
- **VERDICT:** ENG CLEARED — ready to implement (owner go still required per house process).
