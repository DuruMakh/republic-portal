# Foreign Phone Numbers at Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** People abroad register with a foreign mobile number; Georgian numbers keep using Verify.ge, foreign ones get an SMS code from Twilio Verify.

**Architecture:** One pure parser in `lib/` classifies a typed number as Georgian, allowed foreign, or refused. The send action picks the provider from that class; the verify action picks it from the provider stored on the challenge. One migration widens the phone/provider checks and adds a site-wide daily brake on foreign sends.

**Tech Stack:** Next.js server actions, Supabase (Postgres migrations), Vitest, Playwright, libphonenumber-js (new, `mobile` metadata), Twilio Verify v2 REST over `fetch`.

**Spec:** `docs/superpowers/specs/2026-10-23-foreign-number-registration-design.md`

## Global Constraints

- Georgian numbers (`+9955XXXXXXXX`) go to Verify.ge exactly as today and never to Twilio.
- Foreign allow-list (owner-approved 2026-10-25), ISO codes: EU `AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE`, EEA `IS LI NO`, plus `GB CH US CA IL TR UA`. Russia is not on it.
- Site-wide brake: at most **100** foreign sends per 24 hours (owner-approved 2026-10-25). Georgian sends don't count.
- Twilio: SMS only, no SDK. Env vars `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_VERIFY_SERVICE_SID`. Without all three, foreign numbers get `country_not_supported`.
- Never log phone numbers or codes (ADR-031/033).
- TypeScript strict, no `any`, zod at boundaries, Georgian copy and its English translation together.
- New dependency recorded in DECISIONS.md (next free ADR number: **ADR-055**; recheck main and open PRs before merging).

## Review Focus

- A number typed without `+` that isn't Georgian (`31654798014`, `0049…`): expect `invalid`, not a guess at a country. Pinned in Task 1.
- `+1` numbers from Caribbean islands (e.g. Jamaica `+1 876 …`): expect `country_not_supported` although US/CA are allowed. Pinned in Task 1.
- A Georgian landline (`+995 32 …`): expect `invalid`, as today. Pinned in Task 1.
- A challenge created by Twilio, then checked after production lost the Twilio env vars: expect `service_unavailable`, never "verified". Pinned in Task 3.
- The 101st foreign send in a day while Georgian sends keep working: expect `too_many_requests` for the foreign one only. Pinned in Task 2.

---

### Task 1: Number rules, display and admin lookup

**Files:**
- Create: `lib/phone-number.ts`, `lib/phone-number.test.ts`
- Modify: `lib/funnel-schemas.ts:19-28`, `lib/cabinet.ts:150-157`, `lib/cabinet.test.ts:142-151`, `app/[locale]/(admin)/admin/admins/actions.ts:15-25`, `app/[locale]/(unity)/join/GoogleJoinForm.tsx:103`, `lib/i18n/messages/accounts.ts:207-208`, `package.json`, `DECISIONS.md` (Sign-in and registration)

**Interfaces:**
- Produces:
  - `export type PhoneRegion = "georgia" | "foreign"`
  - `export type ParsedRegistrationPhone = { ok: true; phone: string; country: string; region: PhoneRegion } | { ok: false; reason: "invalid" | "country_not_supported" }` (`phone` is E.164, `country` is ISO alpha-2)
  - `export const FOREIGN_SMS_COUNTRIES: ReadonlySet<string>` (the allow-list above)
  - `export function parseRegistrationPhone(value: string): ParsedRegistrationPhone`
  - `formatPhoneKa` keeps its signature; foreign numbers come back in international format.

- [ ] **Step 1: Write the failing tests** in `lib/phone-number.test.ts`

```ts
it("keeps every Georgian form working", () => {
  for (const v of ["555 12 34 56", "995555123456", "+995 555 12 34 56"])
    expect(parseRegistrationPhone(v)).toEqual({ ok: true, phone: "+995555123456", country: "GE", region: "georgia" });
});
// example numbers come from libphonenumber-js's own metadata, so they are valid mobiles by definition
const example = (c: CountryCode) => getExampleNumber(c, examples)!.number; // from "libphonenumber-js/mobile" + "libphonenumber-js/mobile/examples"
it("accepts an allowed foreign mobile with its country code", () => {
  expect(parseRegistrationPhone("+31 6 54798014")).toEqual({ ok: true, phone: "+31654798014", country: "NL", region: "foreign" });
  expect(parseRegistrationPhone(example("US"))).toMatchObject({ ok: true, country: "US", region: "foreign" });
});
it("refuses countries off the list", () => {
  expect(parseRegistrationPhone(example("RU"))).toEqual({ ok: false, reason: "country_not_supported" });
  expect(parseRegistrationPhone(example("JM"))).toEqual({ ok: false, reason: "country_not_supported" }); // +1, not US/CA
});
it("refuses junk, landlines and numbers without a country code", () => {
  for (const v of ["", "abc", "+995 32 212 34 56", "31654798014", "+31 20 123 4567"])
    expect(parseRegistrationPhone(v)).toEqual({ ok: false, reason: "invalid" });
});
```

In `lib/cabinet.test.ts` add: `expect(formatPhoneKa("+31654798014")).toBe("+31 6 54798014")` and keep the existing Georgian cases.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run lib/phone-number.test.ts lib/cabinet.test.ts`
Expected: FAIL (module `./phone-number` not found; NL format mismatch).

- [ ] **Step 3: Implement**
  - `npm install --save-exact libphonenumber-js@<latest 1.x>`; import from `libphonenumber-js/mobile` so `isValid()` means "valid mobile".
  - `parseRegistrationPhone`: try `normalizeGeorgianPhone` first → Georgian result. Otherwise require the trimmed input to start with `+`; parse; `!isValid()` → `invalid`; country `GE` → `invalid` (the Georgian rule already said no); country not in `FOREIGN_SMS_COUNTRIES` → `country_not_supported`; else foreign result with `number` (E.164).
  - `formatPhoneKa`: Georgian branch unchanged; else if the parse succeeds return `formatInternational()`, else the raw value.
  - `funnel-schemas.ts` `phoneSchema`: refine and transform through `parseRegistrationPhone` (keep the `.transform` returning the E.164 string). Message: `"შეიყვანეთ მობილურის ნომერი (5XX XX XX XX, ან საზღვარგარეთის ნომერი ქვეყნის კოდით)"`, English in `accounts.ts`: `"Enter a mobile number (5XX XX XX XX, or a number from abroad with its country code)"`. Remove the old Georgian-only key pair if nothing else uses it.
  - `GoogleJoinForm.tsx:103`: prefill with `parseRegistrationPhone(user.phone)` (use `.phone` when `ok`). Supabase stores the confirmed phone without `+`, so pass `+${digits}` when it lacks one.
  - `lib/validation.ts` `normalizeGeorgianPhone` stays: the unused legacy phone sign-in keeps it and stays Georgian-only.
  - Admin `actions.ts`: replace the Georgian regex and `normalizePhone` with `parseRegistrationPhone`; keep the error text and the `.in("phone", [canonical, canonical.slice(1)])` lookup.
  - DECISIONS.md: change the ADR-031/033 line to say Verify.ge proves Georgian numbers and Twilio foreign ones `(changed 2026-10-25)`; add **ADR-055** (≤6 lines): foreign numbers get SMS codes from Twilio Verify, limited to `FOREIGN_SMS_COUNTRIES` in `lib/phone-number.ts` and 100 foreign sends a day; libphonenumber-js (mobile metadata) because `+1` and `+44` mix allowed and refused territories, so the country must come from the numbering plan.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run lib/phone-number.test.ts lib/cabinet.test.ts lib/funnel-schemas.test.ts lib/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -F <msg file>` ("Parse foreign mobile numbers for registration").

---

### Task 2: Database — wider checks and the daily foreign brake

**Files:**
- Create: `supabase/migrations/20261025120000_foreign_phone_numbers.sql`, `lib/security/foreign-phone-migration.test.ts`

**Interfaces:**
- Consumes: the latest `reserve_phone_verification_send` and `complete_phone_verification_send` bodies in `supabase/migrations/20261008160000_phone_verification_hardening.sql` (copy them; change only what is listed).
- Produces: provider value `'twilio'` accepted by both tables and by `complete_phone_verification_send`; `reserve_phone_verification_send` returns `{status:"limited"}` once 100 foreign sends happened in 24 hours.

- [ ] **Step 1: Write the failing test** in `lib/security/foreign-phone-migration.test.ts` (same style as `lib/security/sms-limits.test.ts`, using `latestDefinition` / `orderedMigrationSql`):

```ts
it("accepts any E.164 number in both verification tables", () => {
  const sql = orderedMigrationSql();
  expect(sql).toContain("drop constraint phone_verification_challenges_phone_check");
  expect(sql).toContain("drop constraint phone_verification_send_reservations_phone_check");
  expect(sql.split("check (phone ~ '^\\+[1-9][0-9]{7,14}$')").length - 1).toBe(2);
});
it("knows the twilio provider", () => {
  expect(orderedMigrationSql()).toContain("check (provider in ('verify_ge', 'twilio', 'test'))");
  expect(latestDefinition("complete_phone_verification_send")).toContain("p_provider not in ('verify_ge', 'twilio', 'test')");
});
it("brakes foreign sends at 100 a day, serialized, without touching Georgian ones", () => {
  const body = latestDefinition("reserve_phone_verification_send");
  expect(body).toMatch(/if p_phone not like '\+995%' then/);
  expect(body).toContain("pg_catalog.pg_advisory_xact_lock(8613, 0)");
  expect(body).toContain("v_foreign_day >= 100");
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run lib/security/foreign-phone-migration.test.ts`
Expected: FAIL (strings not found).

- [ ] **Step 3: Write the migration**
  - Drop and re-add the two phone checks with `check (phone ~ '^\+[1-9][0-9]{7,14}$')`, same constraint names.
  - Drop `phone_verification_challenges_provider_check`, re-add as `check (provider in ('verify_ge', 'twilio', 'test'))`.
  - `create or replace` `complete_phone_verification_send` with `'twilio'` added to its provider guard; nothing else changes.
  - `create or replace` `reserve_phone_verification_send`: after the existing site-hour check, for `p_phone not like '+995%'` take `pg_advisory_xact_lock(8613, 0)`, count reservations with `phone not like '+995%'` in the last 24 hours into `v_foreign_day`, return `limited` when `>= 100`. Every other rule stays byte-for-byte (`lib/security/sms-limits.test.ts` must stay green).
  - Re-state the `revoke`/`grant execute` lines for both functions as the earlier migration does.

- [ ] **Step 4: Run tests and apply locally**

Run: `npx vitest run lib/security` then `npm run db:reset`
Expected: tests PASS; the reset applies every migration without error. Then in `psql` (local DB) confirm `insert … phone '+31654798014', provider 'twilio'` into `phone_verification_challenges` succeeds and `'+3165'` fails the check (inside a transaction you roll back).

- [ ] **Step 5: Commit** ("Allow foreign numbers and brake foreign SMS at 100 a day").

---

### Task 3: Twilio provider and routing in the actions

**Files:**
- Create: `lib/phone-verification/errors.ts`, `lib/phone-verification/twilio.ts`, `lib/phone-verification/twilio.test.ts`
- Modify: `lib/phone-verification/contracts.ts`, `lib/phone-verification/provider.ts`, `lib/phone-verification/provider.test.ts`, `lib/phone-verification/verify-ge.ts`, `lib/phone-verification/store.ts:14`, `app/[locale]/(unity)/join/phone-actions.ts`, `app/[locale]/(unity)/join/phone-actions.test.ts`, `lib/i18n/messages/accounts.ts`, `.env.example`

**Interfaces:**
- Consumes: `parseRegistrationPhone`, `PhoneRegion` (Task 1); provider `'twilio'` in the database (Task 2).
- Produces:
  - `errors.ts`: `PhoneVerificationProviderError` moved here from `verify-ge.ts` (update every import).
  - `contracts.ts`: `export type PhoneVerificationProviderName = "verify_ge" | "twilio" | "test"`; `SentPhoneVerification.provider: PhoneVerificationProviderName`; new failure code `"country_not_supported"`.
  - `twilio.ts`: `createTwilioProvider(config: { apiKeySid: string; apiKeySecret: string; serviceSid: string }, fetcher: typeof fetch = fetch): PhoneVerificationProvider`
  - `provider.ts`: `providerNameFor(region: PhoneRegion, env?: PhoneVerificationEnvironment): PhoneVerificationProviderName | null` and `createProviderByName(name: PhoneVerificationProviderName, env?: PhoneVerificationEnvironment): PhoneVerificationProvider | null`. `PhoneVerificationEnvironment` gains the three `TWILIO_*` keys. The old `createPhoneVerificationProvider` goes once nothing uses it.

- [ ] **Step 1: Write the failing tests**

`twilio.test.ts` (fetch mocked like `verify-ge.test.ts`):
- send posts form `To=+31654798014&Channel=sms` to `https://verify.twilio.com/v2/Services/VA1/Verifications` with `Authorization: Basic base64("SK1:secret")`; a 201 body `{ sid: "VE1", status: "pending" }` returns `{ provider: "twilio", requestId: "VE1" }`.
- send error codes: `60200`/`21211`/`21614` → `invalid_phone`; `60605`/`60410` → `country_not_supported`; `60203` or HTTP 429 → `too_many_requests`; anything else or non-JSON → `service_unavailable`.
- verify posts `VerificationSid=VE1&Code=123456` to `…/Services/VA1/VerificationCheck`; `{ status: "approved" }` → `{ verified: true }`; `{ status: "pending" }` → `{ verified: false }`; HTTP 404 / code `20404` → `expired_code`; `60202` → `too_many_requests`.
- a failure log line never contains the phone number or the code (spy on `console.error`).

`provider.test.ts`:
- env `test` (non-production): `providerNameFor("georgia")` and `providerNameFor("foreign")` are `"test"`.
- env `verify_ge` with all `TWILIO_*`: georgia → `"verify_ge"`, foreign → `"twilio"`; with one `TWILIO_*` empty: foreign → `null`.
- `createProviderByName("twilio")` is `null` without Twilio config; `createProviderByName("test")` throws under `NEXT_PUBLIC_APP_ENV=production` as today; `createProviderByName("verify_ge")` is `null` when env is `test`.

`phone-actions.test.ts`:
- `+7 912 …` → `country_not_supported`, no reservation, no provider call.
- `+31…` with Twilio unconfigured → `country_not_supported`.
- `+31…` with Twilio configured → reserves, sends via Twilio, stores provider `twilio`.
- `+995…` with Twilio configured → still Verify.ge (Twilio fetch never called).
- verify of a `twilio` challenge after Twilio config is removed → `service_unavailable`.
- reservation `limited` → `too_many_requests` (existing case, now also for a foreign number).

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run lib/phone-verification "app/[locale]/(unity)/join/phone-actions.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - Twilio client: `application/x-www-form-urlencoded` bodies, Basic auth from key SID + secret, error code from the JSON `code` field, `console.error` JSON lines with `event` (`twilio_send_failed` / `twilio_verification_failed`), `code` and `status` only.
  - `providerNameFor`: env `test` → `"test"`; env `verify_ge` → georgia `"verify_ge"`, foreign `"twilio"` when all three Twilio values are non-empty, else `null`; any other env throws as today.
  - `createProviderByName`: allowed names are `{test}` under env `test` and `{verify_ge, twilio-if-configured}` under env `verify_ge`; anything else `null`.
  - Send action: `parseRegistrationPhone` replaces `normalizeGeorgianPhone`; `reason` maps to `invalid_phone` / `country_not_supported`; `providerNameFor(region)` `null` → `country_not_supported`; then reserve, `createProviderByName(name)` and send as today.
  - Verify action: replace the `PHONE_VERIFICATION_PROVIDER !== challenge.provider` check with `createProviderByName(challenge.provider)`; `null` → `service_unavailable`.
  - `store.ts` `ChallengeRow.provider`: `PhoneVerificationProviderName`.
  - Messages: `invalid_phone` → `"შეიყვანე სწორი მობილურის ნომერი. საზღვარგარეთის ნომერი შეიყვანე ქვეყნის კოდით, მაგ. +49 …"` / `"Enter a valid mobile number. For a number from abroad, include the country code, e.g. +49 …"`; `country_not_supported` → `"ამ ქვეყნის ნომერზე კოდს ჯერ ვერ ვაგზავნით."` / `"We can't send codes to numbers from this country yet."`.
  - `.env.example`: add the three `TWILIO_*` keys, empty, with a two-line comment (foreign numbers only; unset = foreign numbers refused).

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run lib/phone-verification "app/[locale]/(unity)/join"` then `npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit** ("Send codes to foreign numbers through Twilio Verify").

---

### Task 4: Join form copy, full checks and the real-world run

**Files:**
- Modify: `app/[locale]/(unity)/join/GoogleJoinForm.tsx:220, 420-424`, `app/[locale]/(unity)/join/JoinForm.test.tsx`, `lib/i18n/messages/accounts.ts:238-239`

**Interfaces:**
- Consumes: failure code `country_not_supported` (Task 3).

- [ ] **Step 1: Write the failing test** in `JoinForm.test.tsx`: the hint under the phone field reads `"SMS სერვისი ნომერს მიიღებს მხოლოდ რეგისტრაციის ერთჯერადი კოდის გასაგზავნად და დასადასტურებლად. საზღვარგარეთის ნომერი შეიყვანე ქვეყნის კოდით, მაგ. +49 …"` and no longer names Verify.ge; a send result with code `country_not_supported` shows its message on the phone field (not as the form-level error).

- [ ] **Step 2: Run it and see it fail** — `npx vitest run "app/[locale]/(unity)/join/JoinForm.test.tsx"`.

- [ ] **Step 3: Implement** — swap the hint text (English: `"The SMS service will receive your number only to send and verify the one-time registration code. Enter a number from abroad with its country code, e.g. +49 …"`), and treat `country_not_supported` like `invalid_phone` at line 220. Placeholder stays `+995 5XX XX XX XX`.

- [ ] **Step 4: Run all five gates and e2e**

Run: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build`, `npm run ka:scan`; then `npm run db:reset`, `npm run db:seed`, `npm run e2e:local` (worktree: use the absolute CLI path per the worktree e2e note).
Expected: all green.

- [ ] **Step 5: Local browser journey and screenshots** (test provider, code `123456`): register with `+31 6 54798014` → succeeds; `+7 912 345 67 89` → "ამ ქვეყნის ნომერზე…"; `555 12 34 56` → succeeds as before. Desktop and mobile, Georgian and English (English only if `SHOW_ENGLISH=true` locally).

- [ ] **Step 6: Real-provider run** — local app with `PHONE_VERIFICATION_PROVIDER=verify_ge` and the Twilio keys from `.env.local`: one registration with a foreign number the owner can reach (agree the number in chat first) and one with a Georgian number; both codes arrive and complete registration. Delete those two test accounts afterwards through the normal account deletion.

- [ ] **Step 7: Commit, review, PR** — one whole-branch review, then one PR (migration + code). After owner sign-off: merge, apply the migration with `production-db.yml` (dry-run, then apply), add the three `TWILIO_*` vars to Vercel production from `.env.local`, redeploy, owner switches on the allow-list countries in Twilio geo-permissions, then one live foreign registration on respublika.ge.
