# Google Sign-in and Verify.ge Phone Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ordinary phone-OTP login with Google-only Supabase login, then use Verify.ge once during registration to attach a verified Georgian mobile number to the same Supabase user.

**Architecture:** Supabase Auth remains the session and authorization authority. A server-only provider adapter sends and verifies registration OTPs through Verify.ge; a sealed Postgres challenge ledger binds each request to the current Google-backed Supabase user, and the existing `register()` flow copies the admin-confirmed phone into `profiles`. Automated tests use a deterministic non-production provider, while the Vercel Preview gate proves the real Google and Verify.ge integrations before production.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, Supabase Auth/Postgres/RLS, `@supabase/ssr`, zod 3, Vitest, Playwright, Verify.ge `@smart-pay-chain/otp@2.1.7`, Vercel, GitHub Actions.

## Global Constraints

- All user-facing text is Georgian and must pass `npm.cmd run ka:scan`.
- Normal login is Google only; no email-link, password, or SMS login UI ships.
- Verify.ge proves phone ownership only; it never creates a Supabase session.
- OTP length is exactly 6 digits and lifetime is exactly 300 seconds.
- Resend cooldown is 60 seconds; maximum is 5 sends per user and per phone per hour, and 5 failed verification attempts per challenge.
- Verify.ge webhooks, WhatsApp, account merging, phone change, recovery, and sensitive-action OTP are out of scope.
- `VERIFY_GE_API_KEY` is server-only and never uses `NEXT_PUBLIC_`.
- The test provider must refuse to start when `NEXT_PUBLIC_APP_ENV=production`.
- No real Google credentials or paid SMS are used in ordinary unit or CI runs.
- Every schema change is a forward migration created with the exact command named in its task, for example `npm.cmd exec -- supabase migration new google_verify_phone`; never invent or amend an applied migration filename.
- Every implementation task follows RED → GREEN → focused checks → commit.
- Never push directly to `main`; delivery is branch → draft PR → required CI/review → Vercel Preview → owner approval → merge → guarded production migration/app configuration.
- Production rollout stops if any real phone-auth user exists; no account is auto-merged, reassigned, or deleted.

## File map

**New focused units**

- `lib/phone-verification/contracts.ts` — provider-neutral types, constants, deterministic idempotency key, action result codes.
- `lib/phone-verification/provider.ts` — server-only factory selecting Verify.ge or the non-production deterministic provider.
- `lib/phone-verification/verify-ge.ts` — the only file that imports the Verify.ge SDK.
- `lib/phone-verification/test-provider.ts` — fixed-code provider, hard-disabled in production.
- `lib/phone-verification/store.ts` — challenge-ledger reads/writes through the already-authenticated service client.
- `app/(public)/join/phone-actions.ts` — authenticated send/verify server actions.
- `app/(public)/join/google-actions.ts` — Google-only registration action calling the additive database wrapper.
- `lib/auth.ts` — pure redirect validation and post-auth destination rules.
- `app/auth/callback/route.ts` — PKCE exchange and safe routing.
- `components/GoogleAuthButton.tsx` — shared Google entry button for `/login` and `/join`.
- `components/PhoneVerification.tsx` — provider-neutral six-digit registration proof UI.
- `lib/phone-verification/*.test.ts`, `app/auth/callback/route.test.ts`, and component/action tests — focused TDD coverage.

**Modified existing units**

- `app/(public)/login/page.tsx` — temporary rollout wrapper selecting legacy phone or Google login.
- `app/(public)/login/LegacyPhoneLogin.tsx` — current phone login preserved only for safe rollout and later removed.
- `app/(public)/join/JoinForm.tsx` — temporary rollout wrapper selecting legacy or Google registration.
- `app/(public)/join/LegacyJoinForm.tsx` — current phone registration preserved only for safe rollout and later removed.
- `app/(public)/join/GoogleJoinForm.tsx` and tests — Google gate, Verify.ge proof, resumable registration.
- `app/(public)/join/actions.ts` — retains the existing legacy registration action until hardening.
- `lib/funnel.ts` and tests — Georgian `google_required` message.
- `lib/supabase/types.ts` — challenge table and internal RPC types.
- `e2e/otp-helpers.ts`, `e2e/funnel-helpers.ts`, login/registration/membership journeys — programmatic staging sessions and deterministic phone proof.
- `.env.example`, `DECISIONS.md`, `.github/workflows/ci.yml` — exact dependency/config decision and test-provider environment.
- `.github/workflows/production-db.yml`, `lib/production-db-security-gate.test.ts`, `scripts/production-db-schema-check.sql` — migration count and production security contract.
- `supabase/config.toml` — documents local/staging fixture auth versus hosted Google-only production; no production secret is committed.

---

### Task 1: Provider-neutral contracts, pinned SDK, and configuration decision

**Files:**
- Create: `lib/phone-verification/contracts.ts`
- Create: `lib/phone-verification/contracts.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/specs/2026-08-11-google-verify-ge-phone-design.md`

**Interfaces:**
- Consumes: `normalizeGeorgianPhone(value: string): string | null` from `lib/validation.ts`.
- Produces: `PHONE_VERIFICATION_TTL_SECONDS`, `PHONE_VERIFICATION_CODE_LENGTH`, `PHONE_VERIFICATION_RESEND_SECONDS`, `PhoneVerificationProvider`, `PhoneVerificationFailureCode`, `buildPhoneVerificationIdempotencyKey()`.

- [ ] **Step 1: Write the failing contract tests**

Create `lib/phone-verification/contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildPhoneVerificationIdempotencyKey,
  PHONE_VERIFICATION_CODE_LENGTH,
  PHONE_VERIFICATION_RESEND_SECONDS,
  PHONE_VERIFICATION_TTL_SECONDS,
} from "./contracts";

describe("phone verification contract", () => {
  it("pins the approved OTP limits", () => {
    expect(PHONE_VERIFICATION_CODE_LENGTH).toBe(6);
    expect(PHONE_VERIFICATION_TTL_SECONDS).toBe(300);
    expect(PHONE_VERIFICATION_RESEND_SECONDS).toBe(60);
  });

  it("creates a stable opaque idempotency key inside one resend window", () => {
    const input = {
      userId: "11111111-1111-4111-8111-111111111111",
      phone: "+995555123456",
      purpose: "registration" as const,
      nowMs: Date.UTC(2026, 7, 11, 12, 0, 30),
    };
    const first = buildPhoneVerificationIdempotencyKey(input);
    const second = buildPhoneVerificationIdempotencyKey({ ...input, nowMs: input.nowMs + 20_000 });

    expect(second).toBe(first);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain(input.phone);
    expect(first).not.toContain(input.userId);
  });

  it("changes the key after the 60-second resend window", () => {
    const base = {
      userId: "11111111-1111-4111-8111-111111111111",
      phone: "+995555123456",
      purpose: "registration" as const,
    };
    expect(buildPhoneVerificationIdempotencyKey({ ...base, nowMs: 0 })).not.toBe(
      buildPhoneVerificationIdempotencyKey({ ...base, nowMs: 60_000 }),
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- lib/phone-verification/contracts.test.ts
```

Expected: FAIL because `lib/phone-verification/contracts.ts` does not exist.

- [ ] **Step 3: Add the exact provider-neutral contract**

Create `lib/phone-verification/contracts.ts`:

```ts
import { createHash } from "node:crypto";

export const PHONE_VERIFICATION_TTL_SECONDS = 300;
export const PHONE_VERIFICATION_CODE_LENGTH = 6;
export const PHONE_VERIFICATION_RESEND_SECONDS = 60;
export const PHONE_VERIFICATION_MAX_SENDS_PER_HOUR = 5;
export const PHONE_VERIFICATION_MAX_ATTEMPTS = 5;

export type PhoneVerificationPurpose = "registration";
export type PhoneVerificationFailureCode =
  | "not_authenticated"
  | "google_required"
  | "invalid_phone"
  | "too_many_requests"
  | "invalid_code"
  | "expired_code"
  | "phone_in_use"
  | "service_unavailable";

export interface SendPhoneVerificationInput {
  phone: string;
  purpose: PhoneVerificationPurpose;
  idempotencyKey: string;
}

export interface SentPhoneVerification {
  provider: "verify_ge" | "test";
  requestId: string;
}

export interface VerifyPhoneCodeInput {
  requestId: string;
  code: string;
}

export interface PhoneVerificationProvider {
  send(input: SendPhoneVerificationInput): Promise<SentPhoneVerification>;
  verify(input: VerifyPhoneCodeInput): Promise<{ verified: boolean }>;
}

export function buildPhoneVerificationIdempotencyKey(input: {
  userId: string;
  phone: string;
  purpose: PhoneVerificationPurpose;
  nowMs: number;
}): string {
  const window = Math.floor(input.nowMs / (PHONE_VERIFICATION_RESEND_SECONDS * 1000));
  return createHash("sha256")
    .update(`${input.userId}:${input.phone}:${input.purpose}:${window}`)
    .digest("hex");
}
```

- [ ] **Step 4: Install and pin the official SDK**

Run:

```powershell
npm.cmd install --save-exact @smart-pay-chain/otp@2.1.7
```

Expected: `package.json` contains exactly `"@smart-pay-chain/otp": "2.1.7"` and `package-lock.json` records the resolved package.

- [ ] **Step 5: Record configuration and the dependency decision**

Append to `.env.example`:

```dotenv
PHONE_VERIFICATION_PROVIDER=test
VERIFY_GE_API_KEY=
NEXT_PUBLIC_AUTH_MODE=phone
```

Append ADR-031 to `DECISIONS.md`: Google/Supabase is the identity authority; Verify.ge is registration phone proof only; SDK `2.1.7` is pinned and isolated behind `PhoneVerificationProvider`; `test` provider is refused in production; no webhook; no provider key in Git.

Amend the design's Google guard wording from a literal `auth.identities` dependency to the equivalent server-owned `raw_app_meta_data.providers` Google assertion. State why: Supabase owns `app_metadata`, clients cannot edit it, and the shape permits deterministic staging fixtures without weakening production authorization. Do not use `user_metadata`.

- [ ] **Step 6: Run focused and supply-chain checks**

Run:

```powershell
npm.cmd test -- lib/phone-verification/contracts.test.ts
npm.cmd run typecheck
npm.cmd audit --omit=dev
```

Expected: contract tests PASS, typecheck exits 0, and audit reports no production vulnerability introduced by the SDK. If audit reports a vulnerability in the new dependency tree, stop and replace the SDK task with the two documented REST calls before continuing.

- [ ] **Step 7: Commit Task 1**

```powershell
git add package.json package-lock.json .env.example DECISIONS.md docs/superpowers/specs/2026-08-11-google-verify-ge-phone-design.md lib/phone-verification/contracts.ts lib/phone-verification/contracts.test.ts
git commit -m "chore: define phone verification provider contract"
```

---

### Task 2: Verify.ge adapter and production-locked test provider

**Files:**
- Create: `lib/phone-verification/verify-ge.ts`
- Create: `lib/phone-verification/verify-ge.test.ts`
- Create: `lib/phone-verification/test-provider.ts`
- Create: `lib/phone-verification/test-provider.test.ts`
- Create: `lib/phone-verification/provider.ts`
- Create: `lib/phone-verification/provider.test.ts`

**Interfaces:**
- Consumes: `PhoneVerificationProvider` and constants from Task 1; Verify.ge `OtpClient`, `OtpChannel`, `InvalidOtpError`, `OtpExpiredError`, `RateLimitError`.
- Produces: `createVerifyGeProvider(apiKey)`, `createTestPhoneVerificationProvider()`, `createPhoneVerificationProvider()`.

- [ ] **Step 1: Write RED adapter tests**

The tests inject a minimal fake SDK client and assert exact calls:

```ts
const sdk = {
  sendOtp: vi.fn().mockResolvedValue({ requestId: "req-123" }),
  verifyOtp: vi.fn().mockResolvedValue({ success: true }),
};
const provider = createVerifyGeProvider("server-secret", sdk);

await expect(
  provider.send({
    phone: "+995555123456",
    purpose: "registration",
    idempotencyKey: "a".repeat(64),
  }),
).resolves.toEqual({ provider: "verify_ge", requestId: "req-123" });
expect(sdk.sendOtp).toHaveBeenCalledWith({
  phoneNumber: "+995555123456",
  channel: OtpChannel.SMS,
  ttl: 300,
  length: 6,
  idempotencyKey: "a".repeat(64),
});

await expect(provider.verify({ requestId: "req-123", code: "123456" })).resolves.toEqual({
  verified: true,
});
```

Add cases for malformed send response, SDK timeout/rejection, invalid OTP, expired OTP, rate limit, and error-message redaction. The secret string must never appear in a thrown error.

Add provider-factory cases:

```ts
expect(() =>
  createPhoneVerificationProvider({
    PHONE_VERIFICATION_PROVIDER: "test",
    NEXT_PUBLIC_APP_ENV: "production",
  }),
).toThrow("test phone verification provider is forbidden in production");
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- lib/phone-verification/verify-ge.test.ts lib/phone-verification/test-provider.test.ts lib/phone-verification/provider.test.ts
```

Expected: FAIL because all three implementations are absent.

- [ ] **Step 3: Implement the Verify.ge adapter**

`lib/phone-verification/verify-ge.ts` must import `server-only`, create `OtpClient({ apiKey, autoConfig: true })`, and call only `sendOtp` and `verifyOtp`. Export a test seam accepting this narrow shape:

```ts
type VerifyGeSdk = Pick<OtpClient, "sendOtp" | "verifyOtp">;

export function createVerifyGeProvider(apiKey: string, sdk?: VerifyGeSdk): PhoneVerificationProvider {
  if (!apiKey) throw new Error("VERIFY_GE_API_KEY is missing");
  const client = sdk ?? new OtpClient({ apiKey, autoConfig: true });
  return {
    async send(input) {
      const result = await client.sendOtp({
        phoneNumber: input.phone,
        channel: OtpChannel.SMS,
        ttl: PHONE_VERIFICATION_TTL_SECONDS,
        length: PHONE_VERIFICATION_CODE_LENGTH,
        idempotencyKey: input.idempotencyKey,
      });
      if (!result.requestId) throw new PhoneVerificationProviderError("service_unavailable");
      return { provider: "verify_ge", requestId: result.requestId };
    },
    async verify(input) {
      const result = await client.verifyOtp({ requestId: input.requestId, code: input.code });
      return { verified: result.success === true };
    },
  };
}
```

Map SDK exceptions to internal error codes without including the provider message or API key in output/logs. `InvalidOtpError` → `invalid_code`; `OtpExpiredError` → `expired_code`; `RateLimitError` → `too_many_requests`; everything else → `service_unavailable`.

- [ ] **Step 4: Implement the deterministic test provider and factory**

`test-provider.ts` returns request IDs derived from the idempotency key and accepts only code `123456`. `provider.ts` chooses exactly `verify_ge` or `test`, rejects unknown/missing values, and rejects `test` when `NEXT_PUBLIC_APP_ENV === "production"`.

```ts
export function createTestPhoneVerificationProvider(): PhoneVerificationProvider {
  return {
    async send(input) {
      return { provider: "test", requestId: `test:${input.idempotencyKey}` };
    },
    async verify(input) {
      return { verified: input.requestId.startsWith("test:") && input.code === "123456" };
    },
  };
}
```

- [ ] **Step 5: Run focused tests and static checks**

```powershell
npm.cmd test -- lib/phone-verification/verify-ge.test.ts lib/phone-verification/test-provider.test.ts lib/phone-verification/provider.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: all focused tests PASS; typecheck and lint exit 0.

- [ ] **Step 6: Commit Task 2**

```powershell
git add lib/phone-verification
git commit -m "feat: add Verify.ge phone verification adapter"
```

---

### Task 3: Sealed challenge ledger and Google-backed registration guard

**Files:**
- Create via CLI: `supabase/migrations/*_google_verify_phone.sql`
- Create: `lib/phone-verification/migration-contract.test.ts`
- Modify: `lib/supabase/types.ts`
- Modify: `lib/funnel.ts`
- Modify: `lib/funnel.test.ts`
- Modify: `lib/production-db-security-gate.test.ts`
- Modify: `.github/workflows/production-db.yml`
- Modify: `scripts/production-db-schema-check.sql`

**Interfaces:**
- Consumes: existing `register(text,text,text)` and `auth.uid()` model.
- Produces: `public.phone_verification_challenges`, atomic RPCs `record_phone_verification_failure(uuid,uuid)` and `consume_phone_verification_challenge(uuid,uuid)`, plus additive `public.register_google(text,text,text)`; the existing `register(text,text,text)` remains callable until the hardening migration.

- [ ] **Step 1: Write the RED migration contract test before generating SQL**

`migration-contract.test.ts` must locate exactly one file ending `_google_verify_phone.sql` and assert:

```ts
expect(sql).toContain("create table public.phone_verification_challenges");
expect(sql).toContain("alter table public.phone_verification_challenges enable row level security");
expect(sql).toContain("revoke all on public.phone_verification_challenges from public, anon, authenticated");
expect(sql).toContain("grant select, insert, update, delete on public.phone_verification_challenges to service_role");
expect(sql).toContain("raw_app_meta_data -> 'providers' ? 'google'");
expect(sql).toContain("phone_confirmed_at");
expect(sql).toContain("create or replace function public.register_google");
expect(sql).toContain("security definer");
expect(sql).toContain("set search_path = ''");
expect(sql).toContain("phone_verification_challenges");
expect(sql).toContain("record_phone_verification_failure");
expect(sql).toContain("consume_phone_verification_challenge");
```

Also assert the table check constraints, two rate-limit indexes, unique `(provider, provider_request_id)`, RLS with no anon/authenticated policy, and explicit function EXECUTE revokes.

- [ ] **Step 2: Run the contract test and verify RED**

```powershell
npm.cmd test -- lib/phone-verification/migration-contract.test.ts
```

Expected: FAIL with zero matching migrations.

- [ ] **Step 3: Generate the migration with the CLI**

```powershell
npm.cmd exec -- supabase migration new google_verify_phone
```

Expected: Supabase CLI creates exactly one timestamped `_google_verify_phone.sql` after `20260811101122_normalize_production_view_grants.sql`. If the CLI cannot create the file, stop; do not invent a filename manually.

- [ ] **Step 4: Implement the challenge ledger SQL**

The generated migration creates:

```sql
create table public.phone_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null check (phone ~ '^\+9955[0-9]{8}$'),
  purpose text not null check (purpose = 'registration'),
  provider text not null check (provider in ('verify_ge', 'test')),
  provider_request_id text not null,
  verify_attempts smallint not null default 0 check (verify_attempts between 0 and 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_request_id),
  check (expires_at > created_at)
);

create index phone_verification_by_user_created
  on public.phone_verification_challenges (user_id, created_at desc);
create index phone_verification_by_phone_created
  on public.phone_verification_challenges (phone, created_at desc);

alter table public.phone_verification_challenges enable row level security;
revoke all on public.phone_verification_challenges from public, anon, authenticated;
grant select, insert, update, delete on public.phone_verification_challenges to service_role;
```

Add two `security invoker`, service-role-only SQL functions. `record_phone_verification_failure` increments only an owned, unconsumed, unexpired challenge and caps at 5. `consume_phone_verification_challenge` sets `consumed_at = now()` only when the same conditions hold. Revoke EXECUTE from `public, anon, authenticated`; grant EXECUTE to `service_role`.

- [ ] **Step 5: Add a Google-only registration wrapper without breaking the current path**

Create `public.register_google(p_first_name text, p_last_name text, p_ref_code text default null)` as a narrowly scoped `security definer` PL/pgSQL function with `set search_path = ''` and every referenced object schema-qualified. It must:

1. require `auth.uid()`;
2. load the current user's normalized `auth.users.phone`, `phone_confirmed_at`, and server-owned `raw_app_meta_data.providers`;
3. raise `google_required` unless the provider array contains `google`;
4. raise `phone_required` unless the current Auth user has a confirmed phone;
5. raise `phone_required` unless the ledger contains a `registration` challenge for the same user and normalized phone that was consumed no later than its OTP expiry and within the last 24 hours, proving the Verify.ge/test-provider step actually succeeded while still allowing profile-creation retry without another SMS;
6. return the result of the existing `public.register(p_first_name, p_last_name, p_ref_code)` function.

Revoke EXECUTE on `register_google` from `public` and `anon`, then grant it to `authenticated`. The fixed empty search path, schema-qualified references, and server-owned Google/phone checks are mandatory because the wrapper must still be able to call `public.register` after Task 9 revokes direct authenticated access to that legacy function. Do not alter the body or grants of the existing `register` in this additive migration. This is what keeps the current phone flow usable while production is prepared and gives the new Google flow its stronger guard.

- [ ] **Step 6: Update generated-style types and Georgian error mapping**

Add the table Row/Insert/Update types and all three RPC argument/return types to `lib/supabase/types.ts`. Add:

```ts
google_required: "რეგისტრაციისთვის გამოიყენე Google-ით შესვლა.",
```

to `ERROR_MESSAGES` in `lib/funnel.ts`, then add focused tests distinguishing it from `phone_required` and `not_authenticated`.

- [ ] **Step 7: Update the production migration contract from 32 to 33**

Change both `EXPECTED_MIGRATION_FILE_COUNT` values in `.github/workflows/production-db.yml` from `32` to `33`, and change `expect(migrations).toHaveLength(32)` to `33` in `lib/production-db-security-gate.test.ts`.

Extend `scripts/production-db-schema-check.sql` to assert the challenge table exists, RLS is enabled, anon/authenticated have no table privileges, service_role has SELECT/INSERT/UPDATE/DELETE, both internal functions are executable only by service_role, and `register_google` is executable only by authenticated/service roles while the legacy `register` grant remains unchanged in this additive release.

- [ ] **Step 8: Run migration, security-contract, and error tests**

```powershell
npm.cmd test -- lib/phone-verification/migration-contract.test.ts lib/production-db-security-gate.test.ts lib/funnel.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: all focused tests PASS; typecheck and lint exit 0.

- [ ] **Step 9: Commit Task 3**

```powershell
git add supabase/migrations lib/phone-verification/migration-contract.test.ts lib/supabase/types.ts lib/funnel.ts lib/funnel.test.ts lib/production-db-security-gate.test.ts .github/workflows/production-db.yml scripts/production-db-schema-check.sql
git commit -m "feat: add sealed phone verification challenges"
```

---

### Task 4: Challenge store and authenticated send/verify actions

> **Concurrency amendment (2026-08-11):** The implementation details below that
> describe app-side send counting, post-provider failure counting, direct
> challenge insertion, or `record_phone_verification_failure` are superseded by
> service-role-only atomic RPCs. A sealed send reservation is recorded under
> deterministic user-then-phone transaction locks before provider send;
> provider success atomically creates/reuses and supersedes to one canonical
> challenge; each verification attempt is reserved before provider verification.
> Failed provider/configuration calls remain counted conservatively.

**Files:**
- Create: `lib/phone-verification/store.ts`
- Create: `lib/phone-verification/store.test.ts`
- Create: `app/(public)/join/phone-actions.ts`
- Create: `app/(public)/join/phone-actions.test.ts`
- Modify: `lib/phone-verification/contracts.ts`
- Modify: `lib/phone-verification/contracts.test.ts`

**Interfaces:**
- Consumes: Task 2 provider factory; Task 3 table/RPC types; `createServerSupabase()` and `createAdminClient()`.
- Produces: `sendPhoneVerificationAction(input: unknown): Promise<SendPhoneVerificationActionResult>` and `verifyPhoneVerificationAction(input: unknown): Promise<VerifyPhoneVerificationActionResult>`.

- [ ] **Step 1: Add RED action-result and copy tests**

Extend `contracts.ts` with discriminated action results:

```ts
export type PhoneVerificationFailure = {
  ok: false;
  code: PhoneVerificationFailureCode;
  message: string;
};

export type SendPhoneVerificationActionResult =
  | { ok: true; challengeId: string; phone: string; expiresAt: string }
  | PhoneVerificationFailure;

export type VerifyPhoneVerificationActionResult =
  | { ok: true; phone: string }
  | PhoneVerificationFailure;
```

Add tests asserting exact Georgian messages for every failure code. Use these approved strings:

```ts
export const PHONE_VERIFICATION_MESSAGES = {
  not_authenticated: "სესია ამოიწურა — შედი Google-ით თავიდან.",
  google_required: "რეგისტრაციისთვის გამოიყენე Google-ით შესვლა.",
  invalid_phone: "შეიყვანე ქართული მობილურის ნომერი (5XX XX XX XX).",
  too_many_requests: "ძალიან ბევრი კოდი მოითხოვე — სცადე ცოტა ხანში.",
  invalid_code: "კოდი არასწორია.",
  expired_code: "კოდის მოქმედების დრო ამოიწურა — მოითხოვე ახალი.",
  phone_in_use: "ეს ნომერი უკვე გამოყენებულია სხვა ანგარიშზე.",
  service_unavailable: "კოდის სერვისი დროებით მიუწვდომელია — სცადე თავიდან.",
} satisfies Record<PhoneVerificationFailureCode, string>;
```

- [ ] **Step 2: Write RED store tests**

Use a narrow fake Supabase admin client and prove these operations:

- recent counts include rows matching either the same user or phone inside one hour;
- cleanup targets only rows older than 24 hours for the same user or phone;
- resend marks previous active challenges consumed;
- inserting returns the opaque local UUID and never exposes `provider_request_id`;
- an idempotent provider response with the same `(provider, provider_request_id)` reuses the same owned active challenge instead of violating the unique constraint or sending a second logical challenge;
- the same provider request ID attached to another user or phone is rejected as an internal service error;
- owned lookup requires `id` and `user_id`, distinguishes an unconsumed/unexpired challenge from a validly consumed challenge, and never returns another user's row;
- failure and consume operations call the Task 3 RPCs with both challenge and user IDs.

- [ ] **Step 3: Write RED server-action tests**

Mock `createServerSupabase`, `createAdminClient`, provider factory, and store. Cover, in this order:

1. no session → `not_authenticated`; neither admin client nor provider is created;
2. session without `app_metadata.providers` containing `google` → `google_required`; neither privileged dependency is created;
3. malformed phone → `invalid_phone` before privileged work;
4. 60-second or hourly limit → `too_many_requests`; provider is not called;
5. successful send → normalized phone, hashed idempotency key, 300-second expiry, opaque challenge result;
6. malformed, foreign, expired-unconsumed, or consumed-more-than-24-hours-ago challenge → recovery message without provider call;
7. wrong code → atomic failure count and `invalid_code`;
8. sixth attempt → `too_many_requests`;
9. correct code → one-time consume, then admin `updateUserById(user.id, { phone, phone_confirm: true })`;
10. provider verified and consumed but Auth update transiently failed → retry skips the provider, resumes the same Auth update, and sends no second SMS;
11. Supabase Auth duplicate-phone code → `phone_in_use`, with no profile overwrite;
12. provider/config/network failure → redacted `service_unavailable`.

Representative privilege-order assertion:

```ts
getUserMock.mockResolvedValue({ data: { user: null }, error: null });
await expect(sendPhoneVerificationAction({ phone: "555123456" })).resolves.toEqual({
  ok: false,
  code: "not_authenticated",
  message: PHONE_VERIFICATION_MESSAGES.not_authenticated,
});
expect(createAdminClientMock).not.toHaveBeenCalled();
expect(createProviderMock).not.toHaveBeenCalled();
```

- [ ] **Step 4: Run all Task 4 tests and verify RED**

```powershell
npm.cmd test -- lib/phone-verification/contracts.test.ts lib/phone-verification/store.test.ts "app/(public)/join/phone-actions.test.ts"
```

Expected: FAIL because store and actions are absent and messages are not implemented.

- [ ] **Step 5: Implement the focused store**

`store.ts` receives the already-created admin client; it never creates credentials itself. Export only:

```ts
export interface ChallengeRow {
  id: string;
  user_id: string;
  phone: string;
  purpose: "registration";
  provider: "verify_ge" | "test";
  provider_request_id: string;
  verify_attempts: number;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export async function countRecentChallenges(
  admin: ReturnType<typeof createAdminClient>,
  input: { userId: string; phone: string; sinceIso: string },
): Promise<{ userCount: number; phoneCount: number }>;

export async function storeOrReuseChallenge(
  admin: ReturnType<typeof createAdminClient>,
  input: Omit<ChallengeRow, "id" | "verify_attempts" | "consumed_at" | "created_at">,
): Promise<{ id: string; reused: boolean }>;

export async function readOwnedChallenge(
  admin: ReturnType<typeof createAdminClient>,
  input: { challengeId: string; userId: string; nowIso: string },
): Promise<ChallengeRow | null>;
```

Add exact cleanup, invalidate, record-failure, and consume functions used by the actions. Every query must throw an internal error on a Supabase error instead of treating backend failure as “not found.”

- [ ] **Step 6: Implement send and verify actions**

Both actions begin with:

```ts
const supabase = await createServerSupabase();
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) return failure("not_authenticated");
const providers = Array.isArray(user.app_metadata.providers) ? user.app_metadata.providers : [];
if (!providers.includes("google")) return failure("google_required");
```

Only after these checks may the code create `createAdminClient()` or `createPhoneVerificationProvider()`. Validate inputs with zod:

```ts
const sendSchema = z.object({ phone: z.string() });
const verifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});
```

`sendPhoneVerificationAction` normalizes the phone, checks the 60-second and hourly limits, builds the Task 1 idempotency key, and calls the provider. It then reuses an existing active row only when the provider/request ID, user, phone, and purpose all match; otherwise it invalidates the user's prior active registration challenge and stores the new row. If a concurrent insert wins the unique constraint, reload and apply the same ownership checks. Return only the local UUID/phone/expiry.

`verifyPhoneVerificationAction` reads an owned row. For an unconsumed challenge it requires the configured provider to match, refuses attempt 5+, verifies the code, atomically records failure or consumes the proof, then attaches the phone. For a challenge already consumed validly by the same user, it skips the provider and resumes only the Auth phone update; this is the recovery path for a transient failure after successful verification. Treat Supabase Auth error codes `phone_exists` and `user_already_exists` as `phone_in_use`; all other Auth errors are `service_unavailable`.

Do not `console.log` provider errors, request IDs, phone numbers, codes, or the API key.

- [ ] **Step 7: Run focused tests and static gates**

```powershell
npm.cmd test -- lib/phone-verification/contracts.test.ts lib/phone-verification/store.test.ts "app/(public)/join/phone-actions.test.ts"
npm.cmd run typecheck
npm.cmd run lint
```

Expected: focused tests PASS; typecheck and lint exit 0.

- [ ] **Step 8: Commit Task 4**

```powershell
git add lib/phone-verification "app/(public)/join/phone-actions.ts" "app/(public)/join/phone-actions.test.ts"
git commit -m "feat: verify registration phones server-side"
```

---

### Task 5: Google OAuth callback and rollout-safe login screen

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/auth.test.ts`
- Create: `app/auth/callback/route.ts`
- Create: `app/auth/callback/route.test.ts`
- Create: `components/GoogleAuthButton.tsx`
- Create: `components/GoogleAuthButton.test.tsx`
- Create: `app/(public)/login/LegacyPhoneLogin.tsx`
- Create: `app/(public)/login/GoogleLogin.tsx`
- Modify: `app/(public)/login/page.tsx`
- Rewrite: `app/(public)/login/login.test.tsx`

**Interfaces:**
- Consumes: `createClient()`, `createServerSupabase()`, `deriveDestination()`, `CabinetState`.
- Produces: `safeAuthNext()`, `/auth/callback`, reusable `GoogleAuthButton`, and a temporary server-side rollout selector that defaults to the working phone screen until explicitly set to `google`.

- [ ] **Step 1: Write RED pure redirect tests**

Create `lib/auth.test.ts`:

```ts
expect(safeAuthNext("/join?ref=D00101")).toBe("/join?ref=D00101");
expect(safeAuthNext("/me")).toBe("/me");
expect(safeAuthNext("https://evil.example")).toBe("/");
expect(safeAuthNext("//evil.example")).toBe("/");
expect(safeAuthNext(null)).toBe("/");
```

The implementation accepts only one leading slash, rejects control characters/backslashes, and returns `/` otherwise.

- [ ] **Step 2: Write RED callback route tests**

Mock `createServerSupabase()` and assert:

- missing code → `/login?error=oauth_callback`;
- exchange error → `/login?error=oauth_callback`;
- successful exchange + existing profile → `deriveDestination(state)`;
- successful exchange + `{ exists: false }` → the validated `next` value when it starts with `/join`, otherwise `/join`;
- cabinet RPC error → `/login?error=account_lookup`;
- an external `next` can never become a redirect target.

- [ ] **Step 3: Write RED Google button and login-page tests**

The shared button test asserts the exact call:

```ts
expect(signInWithOAuthMock).toHaveBeenCalledWith({
  provider: "google",
  options: { redirectTo: "https://portal.test/auth/callback?next=%2Fjoin%3Fref%3DD00101" },
});
```

The login tests assert both safe rollout modes:

- `NEXT_PUBLIC_AUTH_MODE=phone` or missing → the unchanged legacy phone screen renders;
- `NEXT_PUBLIC_AUTH_MODE=google` → one `Google-ით შესვლა` button, no phone field, no OTP input, Georgian OAuth failure text, and no direct `cabinet_state` lookup before the callback.

- [ ] **Step 4: Run Task 5 tests and verify RED**

```powershell
npm.cmd test -- lib/auth.test.ts app/auth/callback/route.test.ts components/GoogleAuthButton.test.tsx "app/(public)/login/login.test.tsx"
```

Expected: FAIL because helper, route, button, and new page behavior are absent.

- [ ] **Step 5: Implement the PKCE callback**

`app/auth/callback/route.ts`:

```ts
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeAuthNext(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/login?error=oauth_callback", url.origin));

  const supabase = await createServerSupabase();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return NextResponse.redirect(new URL("/login?error=oauth_callback", url.origin));

  const { data, error } = await supabase.rpc("cabinet_state");
  if (error || data === null) {
    return NextResponse.redirect(new URL("/login?error=account_lookup", url.origin));
  }
  const state = data as unknown as CabinetState;
  const destination = state.exists ? deriveDestination(state) : next.startsWith("/join") ? next : "/join";
  return NextResponse.redirect(new URL(destination, url.origin));
}
```

- [ ] **Step 6: Implement the shared button and rollout-safe login page**

`GoogleAuthButton` accepts `{ nextPath, label }`, derives `window.location.origin` only inside the click handler, disables while pending, and surfaces one Georgian failure line. It calls no Google API directly; Supabase owns OAuth state/PKCE.

Move the current phone/OTP `/login` body without behavioral changes into `LegacyPhoneLogin.tsx`. Put the shared Google button and safe error-token message in `GoogleLogin.tsx`. Keep `page.tsx` as a small server wrapper: render `GoogleLogin` only when `process.env.NEXT_PUBLIC_AUTH_MODE === "google"`; otherwise render `LegacyPhoneLogin`. Keep the existing design-system `Button`, card spacing, metadata, and all Georgian text.

This temporary switch is not a user-facing setting. It lets the same merged build remain on the proven phone flow while production database and provider settings are prepared, then activate Google through a controlled Vercel redeploy.

- [ ] **Step 7: Run Task 5 tests and static checks**

```powershell
npm.cmd test -- lib/auth.test.ts app/auth/callback/route.test.ts components/GoogleAuthButton.test.tsx "app/(public)/login/login.test.tsx"
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run ka:scan
```

Expected: all focused tests PASS and all three gates exit 0.

- [ ] **Step 8: Commit Task 5**

```powershell
git add lib/auth.ts lib/auth.test.ts app/auth components/GoogleAuthButton.tsx components/GoogleAuthButton.test.tsx "app/(public)/login"
git commit -m "feat: add rollout-safe Google login"
```

---

### Task 6: Resumable Google-first registration UI

**Files:**
- Create: `components/PhoneVerification.tsx`
- Create: `components/PhoneVerification.test.tsx`
- Create: `app/(public)/join/LegacyJoinForm.tsx`
- Create: `app/(public)/join/GoogleJoinForm.tsx`
- Create: `app/(public)/join/google-actions.ts`
- Create: `app/(public)/join/google-actions.test.ts`
- Modify: `app/(public)/join/JoinForm.tsx`
- Rewrite: `app/(public)/join/JoinForm.test.tsx`
- Preserve unchanged: `app/(public)/join/actions.ts`
- Preserve until hardening: `components/OtpVerification.tsx`
- Preserve until hardening: `components/OtpVerification.test.tsx`

**Interfaces:**
- Consumes: `GoogleAuthButton`, Task 4 send/verify actions, `register_google`, `createClient().auth.refreshSession()`.
- Produces: logged-out Google gate, signed-in registration form, provider-neutral code step, no-second-SMS retry, and a temporary rollout wrapper preserving the existing phone flow.

- [ ] **Step 1: Write RED PhoneVerification component tests**

Cover:

- six-digit validation before the verify action;
- correct `{ challengeId, code }` submission;
- invalid/expired/service messages returned by the action;
- resend disabled for 60 seconds;
- resend calls `sendPhoneVerificationAction({ phone })` and replaces challenge/expiry;
- success invokes `onVerified(phone)` once;
- a rejected callback never leaves the button permanently disabled.

The component receives only:

```ts
interface PhoneVerificationProps {
  phone: string;
  challengeId: string;
  expiresAt: string;
  onChallengeChanged(challenge: { challengeId: string; expiresAt: string }): void;
  onVerified(phone: string): void | Promise<void>;
}
```

- [ ] **Step 2: Write the Google registration action and rollout-wrapper tests to RED**

`google-actions.test.ts` must prove the new server action validates the existing name/referral schema, calls only `supabase.rpc("register_google", ...)`, maps `google_required`, `phone_required`, duplicate phone, and generic failures to Georgian messages, and never creates an admin client.

The `JoinForm` wrapper tests must prove:

- missing or `phone` auth mode renders the unchanged `LegacyJoinForm`;
- `google` auth mode renders `GoogleJoinForm`;
- no browser-controlled query or local-storage value can change the selected mode.

- [ ] **Step 3: Rewrite GoogleJoinForm tests to RED against the new phases**

Use explicit phases `loading | google | form | otp | retry`. Required cases:

1. no Supabase user → only `Google-ით გაგრძელება`, preserving valid `?ref=` in `nextPath`;
2. signed-in user with existing cabinet → existing derived redirect;
3. signed-in Google user with no profile/phone → name/phone form;
4. signed-in Google user with a pre-existing confirmed phone but no consumed registration challenge → prefilled phone followed by the same Verify.ge proof; no direct-registration bypass;
5. send success → provider-neutral OTP screen;
6. Verify success → `refreshSession()` then `registerGoogleAction()`;
7. register rejection after phone proof → retry phase, phone disabled, no second send;
8. lost Google session → back to Google phase, not phone OTP;
9. duplicate phone → actionable Georgian error, no overwrite/redirect;
10. disclosure says Verify.ge receives the number only for the one-time registration code.

Update the existing “same account” expectation: identity is Google user ID, not re-entered phone.

- [ ] **Step 4: Run component, action, and form tests to verify RED**

```powershell
npm.cmd test -- components/PhoneVerification.test.tsx "app/(public)/join/google-actions.test.ts" "app/(public)/join/JoinForm.test.tsx"
```

Expected: FAIL because the new component, Google action, wrapper selection, and Google flow are absent.

- [ ] **Step 5: Implement PhoneVerification**

Reuse `OtpInput` and design-system `Button`; do not call Supabase Auth. All network work goes through Task 4 actions. Keep the exact 60-second cooldown, reset it only after a successful resend, and display the normalized phone.

- [ ] **Step 6: Add the Google-only registration action**

Create `registerGoogleAction(input: unknown)` in `google-actions.ts`. Reuse the existing zod registration schema and error mapping, but call `supabase.rpc("register_google", ...)`. Do not modify `actions.ts`; it remains the legacy phone-mode action until production hardening.

- [ ] **Step 7: Build GoogleJoinForm around the Google session**

On mount:

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) setPhase("google");
else {
  const { data, error } = await supabase.rpc("cabinet_state");
  if (error || data === null) setFormError(GENERIC_FUNNEL_ERROR);
  else if ((data as unknown as CabinetState).exists) router.replace(deriveDestination(data as unknown as CabinetState));
  else {
    if (user.phone && user.phone_confirmed_at) setPhoneInput(user.phone);
    setPhase("form");
  }
}
```

Form submit validates the existing name/ref/phone schema and calls `sendPhoneVerificationAction`; a pre-existing Auth phone never skips this proof. After Verify success, call `refreshSession()` and then `registerGoogleAction`. If profile creation fails after a successful proof, keep the verified in-memory state so retry calls only `registerGoogleAction` and does not send a second SMS. Preserve the current referral query handling.

- [ ] **Step 8: Preserve the legacy form behind the server-controlled rollout switch**

Move the current `JoinForm` implementation without behavioral changes into `LegacyJoinForm.tsx`. Put the new flow in `GoogleJoinForm.tsx`. Make `JoinForm.tsx` a small server wrapper that renders Google only when `process.env.NEXT_PUBLIC_AUTH_MODE === "google"`; otherwise it renders the legacy form.

Do not delete `OtpVerification` in this feature branch. Prove its remaining product call sites are confined to `LegacyPhoneLogin` and `LegacyJoinForm`:

Run:

```powershell
rg -n "OtpVerification" app components lib e2e
```

Expected: the component, its test, `LegacyPhoneLogin`, and `LegacyJoinForm` are the only results. Any other product call site must be migrated or explicitly explained before continuing. Deletion happens only in Task 9 after production Google activation is proven.

- [ ] **Step 9: Run focused UI and Georgian gates**

```powershell
npm.cmd test -- components/PhoneVerification.test.tsx "app/(public)/join/google-actions.test.ts" "app/(public)/join/JoinForm.test.tsx" "app/(public)/join/phone-actions.test.ts"
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run ka:scan
```

Expected: focused tests PASS; typecheck/lint/Georgian scan exit 0.

- [ ] **Step 10: Commit Task 6**

```powershell
git add components "app/(public)/join"
git commit -m "feat: verify phone after Google sign-in"
```

---

### Task 7: Preserve automated cabinet coverage with synthetic Google-backed fixtures

**Files:**
- Modify: `e2e/otp-helpers.ts`
- Create: `e2e/otp-helpers.test.ts`
- Modify: `e2e/funnel-helpers.ts`
- Modify: `e2e/funnel-helpers.test.ts`
- Rewrite: `e2e/login.spec.ts`
- Modify: `e2e/registration.spec.ts`
- Modify: `e2e/membership.spec.ts`
- Modify as required by helper signature: remaining `e2e/*.spec.ts` login call sites
- Modify: `.github/workflows/ci.yml`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: hosted staging Supabase credentials, legacy staging OTP fixture, deterministic phone provider, `@supabase/ssr` cookie format.
- Produces: `installSupabaseSession(page, session)`, programmatic `loginAs()`, `createGoogleBackedTestUser()`, and paid-SMS-free CI journeys.

- [ ] **Step 1: Write RED session-cookie helper tests**

Add `e2e/otp-helpers.test.ts` with a fake Playwright context and assert that `installSupabaseSession()`:

- asks `createServerClient` to serialize the real Supabase session cookie format;
- writes every produced cookie to `http://localhost:3000` with path `/`;
- never writes access/refresh tokens to logs or URLs;
- throws when the Supabase URL or anon key is missing.

- [ ] **Step 2: Write RED synthetic Google fixture tests**

Extend `funnel-helpers.test.ts` to prove `createGoogleBackedTestUser(phoneSlot)`:

```ts
expect(admin.auth.admin.createUser).toHaveBeenCalledWith({
  email: `e2e+${phoneSlot}@example.invalid`,
  password: expect.stringMatching(/^E2e-[A-Za-z0-9-]+!Aa1$/),
  email_confirm: true,
  app_metadata: { provider: "google", providers: ["google"], e2e: true },
});
```

The helper then signs in with that generated email/password using the anon client, installs the session cookies, and never exposes the password outside the helper. Cleanup deletes the auth user and dependent rows.

- [ ] **Step 3: Run helper tests and verify RED**

```powershell
npm.cmd test -- e2e/otp-helpers.test.ts e2e/funnel-helpers.test.ts
```

Expected: FAIL because the new helpers are absent.

- [ ] **Step 4: Implement programmatic session installation**

Use `createServerClient` with an in-memory cookie adapter, call `auth.setSession({ access_token, refresh_token })`, then pass the captured cookie names/values to `page.context().addCookies()` for the app base URL. Do not hand-construct Supabase cookie names.

Refactor `loginAs()` so seeded phone users still obtain a staging-only session through Supabase Auth and `dev_otp_inbox`, but no longer use the removed phone fields on `/login`: call `signInWithOtp` and `verifyOtp` through an anon Node client, install the returned session cookies, navigate to the target, and assert the landing URL.

- [ ] **Step 5: Make registration journeys Google-backed and deterministic**

Before `passRegistration()` visits `/join`, create the synthetic Google-backed Auth user, sign it in programmatically, and then drive the visible name/phone/code form. With `PHONE_VERIFICATION_PROVIDER=test`, enter exactly `123456`; no real SMS is sent. Preserve unique per-run phone slots and existing cleanup guards.

The fixture is allowed only when `NEXT_PUBLIC_APP_ENV` is `development` or `preview`; throw before creating a user when it is `production`.

- [ ] **Step 6: Rewrite the login journey around the new product behavior**

`e2e/login.spec.ts` must prove:

1. logged-out `/login` shows only `Google-ით შესვლა` and no phone/OTP controls;
2. a programmatically authenticated registered fixture reaches `/me` and retains its cabinet data;
3. the callback/open-redirect cases remain unit-tested, not driven through Google's website.

Keep all other cabinet/admin/community journeys using the programmatic `loginAs()` helper so their authorization coverage remains unchanged.

- [ ] **Step 7: Configure CI for the deterministic provider and Google UI mode**

Add to both `npm run build` and `npm run e2e` environments in `.github/workflows/ci.yml`:

```yaml
PHONE_VERIFICATION_PROVIDER: test
NEXT_PUBLIC_AUTH_MODE: google
```

Do not add `VERIFY_GE_API_KEY` or Google OAuth secrets to CI. Lower Playwright's global timeout only if the old 62-second UI throttle waits are fully gone and the full hosted run proves the new bound; otherwise leave the current 210-second cap unchanged.

- [ ] **Step 8: Run helper, focused browser, then full browser tests**

```powershell
npm.cmd test -- e2e/otp-helpers.test.ts e2e/funnel-helpers.test.ts
npm.cmd run build
npm.cmd run e2e -- e2e/login.spec.ts e2e/registration.spec.ts e2e/membership.spec.ts
npm.cmd run e2e
```

Environment for local commands: testing Supabase credentials, `NEXT_PUBLIC_APP_ENV=preview`, `NEXT_PUBLIC_AUTH_MODE=google`, and `PHONE_VERIFICATION_PROVIDER=test` in ignored `.env.local`. Expected: helper tests and every Playwright journey PASS without a real Google redirect or paid SMS.

- [ ] **Step 9: Commit Task 7**

```powershell
git add e2e .github/workflows/ci.yml playwright.config.ts
git commit -m "test: preserve auth journeys with Google fixtures"
```

---

### Task 8: Full local gates, staging migration, real preview configuration, and owner QA

**Files:**
- Modify only if verification exposes drift: task-owned files from Tasks 1–7
- No committed secret files

**Interfaces:**
- Consumes: complete feature branch, testing Supabase project `orcxtbedkexoclbfgvzd`, testing Vercel project/domain `https://republic-portal.vercel.app`, Verify.ge Starter key.
- Produces: green full suite, applied staging migration, configured testing Google OAuth, live Vercel Preview, owner sign-off evidence.

- [ ] **Step 1: Run every local release gate with fresh output**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run ka:scan
npm.cmd run test
npm.cmd run build
```

Build environment: `NEXT_PUBLIC_AUTH_MODE=google`, `PHONE_VERIFICATION_PROVIDER=test`, testing Supabase URL/anon key/service role, and `NEXT_PUBLIC_APP_ENV=preview`. Expected: every command exits 0. Fix only task-related failures with a new RED test and commit each fix separately.

- [ ] **Step 2: Link this checkout to testing only and prove the target**

```powershell
npm.cmd exec -- supabase link --project-ref orcxtbedkexoclbfgvzd
npm.cmd exec -- supabase migration list --linked
```

Expected: linked ref is exactly `orcxtbedkexoclbfgvzd`; production ref `uorvlshbrlbdnbauxsws` must not appear as the linked target. If it does, stop immediately and relink testing before any push.

- [ ] **Step 3: Review and apply exactly the pending staging migration**

```powershell
npm.cmd exec -- supabase db push --linked --dry-run
```

Expected: only the CLI-generated `_google_verify_phone.sql` migration is pending. Review the SQL output, then run:

```powershell
npm.cmd exec -- supabase db push --linked
npm.cmd exec -- supabase migration list --linked
npm.cmd exec -- supabase db lint --linked --schema public --level warning --fail-on error
npm.cmd exec -- supabase db advisors --linked --type security --level error --fail-on none --output-format json
```

Expected: local and remote migration rows align, lint exits 0, and advisors contain no unreviewed finding caused by this migration.

- [ ] **Step 4: Configure Google OAuth in the testing environment**

In Google Auth Platform create the testing Web OAuth client with:

- Authorized JavaScript origin: `https://republic-portal.vercel.app`
- Authorized redirect URI: `https://orcxtbedkexoclbfgvzd.supabase.co/auth/v1/callback`
- Scopes only: `openid`, email, profile

In testing Supabase Auth → Google, set that client ID/secret and enable Google. Set Site URL to `https://republic-portal.vercel.app`; add the exact Vercel Preview callback URL ending `/auth/callback` to the redirect allow list. Keep staging phone auth enabled only for the legacy automated fixture path.

- [ ] **Step 5: Configure the Vercel Preview environment without exposing secrets**

Set through Vercel encrypted environment variables:

```text
NEXT_PUBLIC_AUTH_MODE=google
PHONE_VERIFICATION_PROVIDER=verify_ge
NEXT_PUBLIC_APP_ENV=preview
```

Add `VERIFY_GE_API_KEY` through Vercel's encrypted secret input using the already-authorized owner value. The literal value must never appear in a shell transcript, Git diff, PR body, screenshot, or plan. Keep the existing testing Supabase URL/anon/service-role variables.

- [ ] **Step 6: Push the branch and open a draft PR**

```powershell
git status --short
git push -u origin codex/google-verify-auth
gh pr create --draft --base main --head codex/google-verify-auth --title "Add Google sign-in with Verify.ge phone proof" --body-file .github/pr-body-google-verify.md
```

Create the temporary PR body file with `apply_patch`, containing: owner decisions, test evidence, staging migration evidence, no-webhook/no-account-merge scope, exact manual QA steps, and the production two-stage rollout below. Delete that temporary file before commit if `.github/pr-body-google-verify.md` is not intended as repository documentation.

- [ ] **Step 7: Wait for required CI/review and fix only evidenced failures**

Required green states: CI `quality`, CodeRabbit, Vercel Preview, and `/codex review` with all actionable conversations resolved. Never bypass or merge a failing check.

- [ ] **Step 8: Run the real preview smoke test**

On the Vercel Preview URL:

1. sign in with Google and return to `/join`;
2. enter an owner-controlled Georgian mobile number;
3. receive one real Verify.ge Starter SMS;
4. reject one wrong code, then accept the correct code;
5. confirm exactly one Auth user and one profile;
6. logout, sign in with Google again, and return to the same cabinet without SMS;
7. confirm referral `?ref=` survives OAuth;
8. inspect browser network/assets and Vercel logs for absence of the Verify.ge key and OTP.

Record plain-language evidence and screenshots, then give the owner the exact Preview URL. Stop until the owner explicitly approves that Preview.

- [ ] **Step 9: Commit any owner-approved preview fixes and return to Step 7**

Each fix requires its own RED test, focused GREEN command, commit, push, fresh CI, and a replacement Preview approval. Do not amend reviewed commits.

---

### Task 9: Safe production activation, hardening follow-up, and live proof

**Files:**
- Create via CLI in hardening follow-up: `supabase/migrations/*_disable_legacy_phone_registration.sql`
- Modify in hardening follow-up: `.github/workflows/production-db.yml`
- Modify in hardening follow-up: `lib/production-db-security-gate.test.ts`
- Delete in hardening follow-up: `app/(public)/login/LegacyPhoneLogin.tsx`, `app/(public)/join/LegacyJoinForm.tsx`, and their legacy-only tests after `rg` proves no remaining product call sites
- Delete in hardening follow-up: `components/OtpVerification.tsx` and `components/OtpVerification.test.tsx`
- Simplify in hardening follow-up: `app/(public)/login/page.tsx` and `app/(public)/join/JoinForm.tsx` to unconditional Google behavior
- Modify in hardening follow-up: `supabase/config.toml`, auth documentation, affected e2e helpers only after hosted phone auth is disabled

**Interfaces:**
- Consumes: owner-approved preview, green PR, additive migration count 33, guarded production workflow, production Supabase `uorvlshbrlbdnbauxsws`, production Vercel domain `https://georgia-republic.vercel.app`.
- Produces: Google/Verify.ge production activation with rollback, then removal/revocation of the legacy phone-registration surface.

- [ ] **Step 1: Prepare production for a safe additive merge**

Before merge, keep production Vercel on:

```text
NEXT_PUBLIC_AUTH_MODE=phone
```

Do not add the Verify.ge key to any public variable. Configure the production Google OAuth client in advance with origin `https://georgia-republic.vercel.app` and callback `https://uorvlshbrlbdnbauxsws.supabase.co/auth/v1/callback`, but do not disable the working phone path yet.

Run a read-only production identity inventory before activation: count Auth users by provider, count profiles, and identify any real user whose only provider is phone. Record counts only, not personal data. If any real phone-only user exists, stop the rollout and write an account-migration design for owner approval; do not merge identities, reassign profiles, or disable their login automatically.

- [ ] **Step 2: Mark the approved PR ready and merge only when all gates are green**

Confirm branch HEAD, review resolution, CI SHA, and owner Preview approval. Mark ready, merge through GitHub, and delete the remote feature branch. Verify `main` contains every Task 1–8 commit.

The production deployment created by this merge must remain in `phone` mode, so the additive application code does not call the not-yet-applied challenge table.

- [ ] **Step 3: Run the guarded production database dry-run**

Dispatch `.github/workflows/production-db.yml` from `main` with:

```text
operation=dry-run
confirm_project_ref=uorvlshbrlbdnbauxsws
```

Expected artifact: exactly one pending `_google_verify_phone.sql` migration, metadata SHA equal to current `main`, migration file count 33, schema/security probes green. Present the run ID and dry-run artifact summary to the owner; do not apply without explicit approval.

- [ ] **Step 4: Apply only the owner-approved dry-run**

After owner approval, dispatch `operation=apply` with the same project ref and the approved dry-run run ID. Expected: workflow validates identical SHA/evidence, applies the one migration, schema/RLS probes pass, lint passes, and advisor set has no unreviewed addition.

- [ ] **Step 5: Activate Google/Verify.ge production and redeploy**

Set encrypted Production variables:

```text
NEXT_PUBLIC_AUTH_MODE=google
PHONE_VERIFICATION_PROVIDER=verify_ge
NEXT_PUBLIC_APP_ENV=production
```

Add `VERIFY_GE_API_KEY` through Vercel's encrypted Production secret input using the already-authorized owner value. Enable Google in production Supabase, set Site URL and exact redirect allow list, then trigger a production redeploy of the merged SHA. Keep phone Auth temporarily enabled until the Google smoke succeeds; the public UI is already Google-only.

- [ ] **Step 6: Verify the live production story**

Require Vercel `READY` for the merge SHA, HTTP 200 on public routes, no runtime errors, then perform one owner-controlled Google → Verify.ge → registration smoke. Logout/login must return to the same cabinet without SMS. Confirm no staging data and no testing Supabase ref appear in the production browser/network.

If any step fails, immediately restore `NEXT_PUBLIC_AUTH_MODE=phone`, redeploy the last known-good configuration, and leave the additive database objects in place; they are inert and need no destructive rollback.

- [ ] **Step 7: Create the hardening migration RED test**

On a fresh `codex/google-verify-hardening` branch from the verified production `main`, add a failing contract test requiring:

```sql
revoke execute on function public.register(text, text, text) from authenticated;
grant execute on function public.register_google(text, text, text) to authenticated;
```

The test also raises the expected migration count from 33 to 34 and requires production phone signup to be documented as disabled.

- [ ] **Step 8: Generate and implement the hardening migration**

```powershell
npm.cmd exec -- supabase migration new disable_legacy_phone_registration
```

Put only the reviewed EXECUTE revoke/grant in the generated migration. Update both production workflow counts and the production security-gate count to 34. Do not modify either applied migration.

- [ ] **Step 9: Remove the temporary legacy product switch**

After `rg` proves Google components are the only `/login` and `/join` product path, delete the legacy phone-login wrappers/components/tests and make Google the unconditional UI. Keep only the minimum staging fixture code needed by authorization E2E tests. In production Supabase, disable phone signups/sign-in and the send-SMS hook; do not run `supabase config push` against production.

- [ ] **Step 10: Deliver the hardening PR through the full process**

Run full unit/type/lint/format/Georgian/build/E2E gates; push `codex/google-verify-hardening`; open draft PR; obtain CI, CodeRabbit, `/codex review`, Vercel Preview, and owner sign-off; merge; run production DB dry-run count 34; obtain owner approval; apply; verify live Google login and registration again.

- [ ] **Step 11: Final evidence and cleanup**

Report:

- feature and hardening PR URLs and merge SHAs;
- staging and production migration lists;
- production dry-run/apply run IDs;
- Vercel `READY` deployment ID matching the final merge SHA;
- Google login, one-time Verify.ge phone proof, logout/relogin-without-SMS evidence;
- phone Auth disabled in production;
- no webhook configured;
- no secret in Git history or client assets;
- both remote feature branches deleted and local checkouts left clean.
