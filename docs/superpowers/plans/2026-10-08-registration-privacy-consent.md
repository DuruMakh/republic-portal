# Registration Privacy Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every new registration requires one ticked box (18+ and personal-data processing),
links a new `/privacy` policy page, and stores the date and policy version the person agreed to,
enforced by the server.

**Architecture:** One pure constant module (`lib/privacy.ts`) holds the policy version, path and
error message. The database stamps `profiles.privacy_accepted_at` / `privacy_version` inside
`register()`, which both sign-up routes (`register_google()` and the legacy `register` call) end
in. The release is **two PRs and two migrations** (expand, then tighten) because merging to `main`
deploys the real site before its database can be migrated (see "Release order" below). A shared
`PrivacyConsentField` component puts the same box on both join forms.

**Tech Stack:** Next.js App Router, TypeScript strict, zod v3, Supabase (Postgres plpgsql
migrations), Vitest + Testing Library, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-08-registration-privacy-consent-design.md`

## Global Constraints

- Policy version literal: `2026-10-v1`. It lives in `lib/privacy.ts` and in the migration SQL.
  A static test keeps them equal.
- Policy path: `/privacy`.
- Consent sentence (exact): `ვადასტურებ, რომ 18 წლის ან უფროსი ვარ და ვეთანხმები ჩემი პერსონალური მონაცემების დამუშავებას კონფიდენციალურობის პოლიტიკის შესაბამისად.`
  The words `კონფიდენციალურობის პოლიტიკის` are the link.
- Consent error (exact): `გასაგრძელებლად მონიშნე თანხმობა.`
- Step-1 notice (exact): `Google-ით გაგრძელებით ეთანხმები ჩვენს კონფიდენციალურობის პოლიტიკას.`
  The words `კონფიდენციალურობის პოლიტიკას` are the link.
- Footer label (exact): `კონფიდენციალურობა`.
- Database token: `privacy_consent_required`.
- All Georgian copy is spliced from the spec, never retyped. None of it contains typographic
  quotes. Run `node scripts/ka-gate.mjs --diff main <files>` on every changed file with Georgian
  text, plus `npm run ka:scan`.
- Links to `/privacy` open in a new tab: `target="_blank" rel="noopener noreferrer"`. Inline link
  classes: `font-semibold text-brand hover:underline` (same as the existing `/join/terms` link in
  `app/(member)/me/delegacy/page.tsx`).
- TypeScript strict; no `any`, no `@ts-ignore`. No new dependencies.
- Never edit data by hand. Never push to `main`. Commit messages are written to a file and
  committed with `git commit -F` (PowerShell mangles multi-line `-m`), ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- CI gates: `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm test`,
  `npm run build`, plus e2e. Run all five locally before each PR.
- Worktree note: this worktree has no `node_modules` or `.env.local`. Run `npm ci` once, and copy
  `.env.local` from the main checkout before any e2e run (never commit it).

## Release order (why two PRs)

The real site (georgia-republic) and the demo site both deploy on every merge to `main`, and the
production migration workflow (`.github/workflows/production-db.yml`) can only run from `main`
after that merge. If one PR shipped code that sends the new argument together with a migration
that adds it, the real site would run the new code against the old database until the workflow
ran, and registration would fail. So:

1. **PR A (Task 1):** migration `20261008140000_registration_privacy_consent.sql` adds the two
   columns and a `register()` / `register_google()` that **accept** an optional
   `p_privacy_version`. A missing version is still allowed, so the code already live keeps
   working. Merge, then run the production-db workflow (owner approves the dry run, then apply).
2. **PR B (Tasks 2–5):** the forms, server actions, `/privacy` page, and migration
   `20261008150000_require_privacy_consent.sql`, which makes a missing version refuse. On merge,
   the new code is served first; it works against PR A's function. Then the production-db
   workflow applies the tightening.

This is the same pattern as PR #28 → PR #27 (member counts). The spec's §8 is updated in Task 1
to say so.

---

## PR A — expand

### Task 1: Consent columns and a version-checking `register()`

**Files:**
- Create: `lib/privacy.ts`
- Create: `lib/privacy.test.ts`
- Create: `supabase/migrations/20261008140000_registration_privacy_consent.sql`
- Modify: `lib/supabase/types.ts` (profiles Row; `register` and `register_google` Args)
- Modify: `lib/security/verdict.ts` (POST_GATE_TOKENS)
- Modify: `lib/security/verdict.tokens-drift.test.ts` (token counts)
- Modify: `scripts/production-db-schema-check.sql` (four-argument signatures)
- Modify: `.github/workflows/production-db.yml` (two `EXPECTED_MIGRATION_FILE_COUNT: 35` → `36`)
- Modify: `lib/production-db-security-gate.test.ts:151` (`toHaveLength(35)` → `36`)
- Modify: `lib/production-db-workflow.test.ts:112,115` (`35` → `36`, title and string)
- Modify: `docs/superpowers/specs/2026-10-08-registration-privacy-consent-design.md` §8

**Interfaces:**
- Produces: `lib/privacy.ts` exports `PRIVACY_POLICY_VERSION: "2026-10-v1"`,
  `PRIVACY_POLICY_PATH: "/privacy"`, `PRIVACY_CONSENT_REQUIRED_MESSAGE: string`.
- Produces: SQL `public.register(p_first_name text, p_last_name text, p_ref_code text default null, p_privacy_version text default null) returns jsonb`
  and `public.register_google(...same four...)`. Token `privacy_consent_required`.
- Produces: `profiles.privacy_accepted_at timestamptz null`, `profiles.privacy_version text null`.

- [ ] **Step 1: Write the failing static test**

Create `lib/privacy.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIVACY_POLICY_PATH, PRIVACY_POLICY_VERSION } from "./privacy";

/**
 * Static model of the applied migrations, same discipline as
 * lib/security/verdict.tokens-drift.test.ts: read the real SQL, never a copy of it.
 * Last definition wins, exactly as Postgres applies them in filename order.
 */
const MIGRATIONS_DIR = resolve("supabase/migrations");

function latestDefinition(fn: string): string {
  let found: string | undefined;
  const header = new RegExp(`create (?:or replace )?function\\s+(?:public\\.)?${fn}\\s*\\(`, "g");
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const match of sql.matchAll(header)) {
      const open = sql.indexOf("$$", match.index);
      const close = sql.indexOf("$$", open + 2);
      if (open < 0 || close < 0) continue;
      found = sql.slice(match.index, close);
    }
  }
  if (found === undefined) throw new Error(`no definition of ${fn} in the migrations`);
  return found;
}

describe("privacy policy constants", () => {
  it("names the published policy page and a dated version", () => {
    expect(PRIVACY_POLICY_PATH).toBe("/privacy");
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
  });
});

describe("register() records privacy consent", () => {
  it("takes the policy version as an optional fourth argument", () => {
    expect(latestDefinition("register")).toMatch(/p_privacy_version text default null\s*\)/);
  });

  it("refuses any version other than the current one, with the classified token", () => {
    const body = latestDefinition("register");
    expect(body).toContain(`'${PRIVACY_POLICY_VERSION}'`);
    expect(body).toContain("raise exception 'privacy_consent_required'");
  });

  it("stamps the consent date and version on the new profile", () => {
    expect(latestDefinition("register")).toMatch(
      /insert into public\.profiles \([^)]*privacy_accepted_at, privacy_version\)/,
    );
  });

  it("is reached from register_google() with the version passed through", () => {
    const body = latestDefinition("register_google");
    expect(body).toMatch(/p_privacy_version text default null\s*\)/);
    expect(body).toContain(
      "public.register(p_first_name, p_last_name, p_ref_code, p_privacy_version)",
    );
  });

  it("keeps both consent columns server-managed", () => {
    const body = latestDefinition("protect_profile_columns");
    expect(body).toContain("new.privacy_accepted_at is distinct from old.privacy_accepted_at");
    expect(body).toContain("new.privacy_version is distinct from old.privacy_version");
  });

  it("is checked by the production schema check under its four-argument signatures", () => {
    const check = readFileSync(resolve("scripts/production-db-schema-check.sql"), "utf8");
    expect(check).toContain("public.register_google(text,text,text,text)");
    expect(check).toContain("public.register(text,text,text,text)");
    expect(check).not.toContain("public.register_google(text,text,text)'");
    expect(check).not.toContain("public.register(text,text,text)'");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/privacy.test.ts`
Expected: FAIL. `./privacy` cannot be resolved.

- [ ] **Step 3: Create `lib/privacy.ts`**

```ts
/**
 * Registration privacy consent (spec docs/superpowers/specs/2026-10-08-registration-privacy-consent-design.md).
 * Pure constants: no React, no Next. The version literal is duplicated in the
 * register() migration; lib/privacy.test.ts keeps the two equal.
 */
export const PRIVACY_POLICY_VERSION = "2026-10-v1";

export const PRIVACY_POLICY_PATH = "/privacy";

export const PRIVACY_CONSENT_REQUIRED_MESSAGE = "გასაგრძელებლად მონიშნე თანხმობა.";
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run lib/privacy.test.ts`
Expected: the constants test passes; every `register()` test fails (no fourth argument yet).

- [ ] **Step 5: Write the migration**

Create `supabase/migrations/20261008140000_registration_privacy_consent.sql`. The bodies of
`protect_profile_columns()`, `register()` and `register_google()` are restated **verbatim** from
their live definitions (`20260728142000_member_referral_codes.sql` for the first two,
`20260811182202_google_verify_phone.sql` for `register_google`). Splice the existing text from
those files; only the marked lines are new.

```sql
-- Registration privacy consent, step 1 of 2 (spec 2026-10-08 §6, ADR-041).
--
-- Additive and backward compatible. register() and register_google() gain an optional
-- p_privacy_version. When it is sent it must be the current policy version, and the new
-- profile is stamped with the date and version. When it is missing the call still works,
-- so the code already live on the real site keeps registering people until step 2
-- (20261008150000_require_privacy_consent.sql) ships with the code that sends it and makes
-- a missing version refuse. The version literal must equal PRIVACY_POLICY_VERSION in
-- lib/privacy.ts (lib/privacy.test.ts checks it).

-- Nullable: existing profiles predate the policy (the two founders' accounts, owner
-- decision 2026-10-08) and are never edited by hand.
alter table public.profiles
  add column privacy_accepted_at timestamptz,
  add column privacy_version text;

-- protect_profile_columns(): restates the LIVE body
-- (20260728142000_member_referral_codes.sql) verbatim, plus the two consent columns in
-- the guarded list, the house pattern for every server-managed profiles column.
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
      or new.referral_code is distinct from old.referral_code
      or new.privacy_accepted_at is distinct from old.privacy_accepted_at  -- NEW
      or new.privacy_version is distinct from old.privacy_version          -- NEW
    then
      raise exception 'server-managed profile columns cannot be changed by client roles';
    end if;
    -- (the three value-rule blocks that follow in the live body: splice verbatim)
  end if;
  return new;
end $$;

-- A new argument changes the signature, so drop and recreate (precedent:
-- 20260728100000_personal_id_at_membership.sql). One overload each, never two.
drop function public.register_google(text, text, text);
drop function public.register(text, text, text);

create function register(
  p_first_name text,
  p_last_name text,
  p_ref_code text default null,
  p_privacy_version text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  -- (declarations: splice verbatim)
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    -- duplicate phone after OTP: a state read, never an overwrite (spec §8)
    return public.cabinet_state() || jsonb_build_object('created', false);
  end if;
  -- NEW: privacy consent (spec 2026-10-08 §6). Step 1 of 2: a version that is sent
  -- must be the current one; a missing version is still accepted until step 2.
  if p_privacy_version is not null and p_privacy_version <> '2026-10-v1' then
    raise exception 'privacy_consent_required';
  end if;
  -- (invalid_name check, ref-code normalisation, v_phone lookup, phone_required guard:
  --  splice verbatim)

  for i in 1..20 loop
    begin
      insert into public.profiles (id, first_name, last_name, phone, status, signup_ref_code, referral_code, privacy_accepted_at, privacy_version)
      values (
        v_uid, btrim(p_first_name, E' \t\r\n'), btrim(p_last_name, E' \t\r\n'),
        v_phone, 'registered', v_ref, public.mint_member_referral_code(),
        case when p_privacy_version is null then null else now() end,  -- NEW
        p_privacy_version                                              -- NEW
      );
      exit;
    -- (exception handler and loop end: splice verbatim)
  end loop;

  return public.cabinet_state() || jsonb_build_object('created', true);
end $$;
grant execute on function register(text, text, text, text) to authenticated;
revoke execute on function register(text, text, text, text) from public, anon;

create function public.register_google(
  p_first_name text,
  p_last_name text,
  p_ref_code text default null,
  p_privacy_version text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
-- (declarations and body: splice verbatim from 20260811182202_google_verify_phone.sql,
--  changing only the final line to:)
  return public.register(p_first_name, p_last_name, p_ref_code, p_privacy_version);
end $$;
revoke execute on function public.register_google(text, text, text, text) from public, anon;
grant execute on function public.register_google(text, text, text, text) to authenticated, service_role;
```

The `-- (… splice verbatim)` lines are instructions for this step, not SQL. The finished file
contains the full bodies. After writing it, diff each function against its source
(`git diff --no-index` on extracted bodies, or read side by side) and confirm only the `-- NEW`
lines differ.

- [ ] **Step 6: Update the production schema check**

In `scripts/production-db-schema-check.sql`, replace every `public.register_google(text,text,text)`
with `public.register_google(text,text,text,text)` (four occurrences) and every
`public.register(text,text,text)` with `public.register(text,text,text,text)` (two occurrences).

- [ ] **Step 7: Run the static test**

Run: `npx vitest run lib/privacy.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 8: Classify the new token and move the tripwires**

In `lib/security/verdict.ts`, append to `POST_GATE_TOKENS` after `"too_many_requests",`:

```ts
  // Registration privacy consent (20261008140000_registration_privacy_consent.sql):
  // register() refuses a policy version other than the current one (and, from
  // 20261008150000, a missing one). Payload validation behind register()'s
  // not_authenticated gate, the same standing as invalid_name next to it.
  "privacy_consent_required",
```

In `lib/security/verdict.tokens-drift.test.ts`, extend the comment above the counts with
`51 -> 52 and 39 -> 40 when registration privacy consent added privacy_consent_required
(register(), classified POST_GATE_TOKENS above).` and change
`expect(live.size).toBe(51);` → `52` and `expect(POST_GATE_TOKENS.size).toBe(39);` → `40`.
The function count stays 66 (`register` and `register_google` already exist).

Run: `npx vitest run lib/security`
Expected: PASS.

- [ ] **Step 9: Update the generated types**

In `lib/supabase/types.ts`, add to `profiles.Row` after `registration_completed_at`:

```ts
          privacy_accepted_at: string | null;
          privacy_version: string | null;
```

and to both `register.Args` and `register_google.Args` after `p_ref_code?: string | null;`:

```ts
          p_privacy_version?: string | null;
```

- [ ] **Step 10: Move the migration baseline 35 → 36**

`.github/workflows/production-db.yml` (both `EXPECTED_MIGRATION_FILE_COUNT: 35` lines),
`lib/production-db-security-gate.test.ts:151` (`toHaveLength(36)`),
`lib/production-db-workflow.test.ts:112` (title says `36-file`) and `:115`
(`"EXPECTED_MIGRATION_FILE_COUNT: 36"`).

Run: `npx vitest run lib/production-db-security-gate.test.ts lib/production-db-workflow.test.ts`
Expected: PASS.

- [ ] **Step 11: Update the spec's release section**

Replace the body of §8 "Release" in the spec with a short statement of the two-PR order from
"Release order" above. Keep the remaining bullets (staging first, no new environment variables,
ADR-041). Change the baseline line to "35 → 36 (PR A) → 37 (PR B)". Mention
`scripts/production-db-schema-check.sql` and `lib/supabase/types.ts`.

- [ ] **Step 12: Full gates**

Run: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build`
(in PowerShell use `;` and check each), then
`node scripts/ka-gate.mjs --diff main lib/privacy.ts lib/privacy.test.ts docs/superpowers/specs/2026-10-08-registration-privacy-consent-design.md`.
Expected: all green.

- [ ] **Step 13: Apply to staging and verify**

Apply the migration to the staging database with the established staging push (the same command
used for `20261007120000`; staging only, never production). Then confirm, read-only:

```sql
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
   and column_name in ('privacy_accepted_at', 'privacy_version');
select to_regprocedure('public.register(text,text,text,text)') is not null as reg4,
       to_regprocedure('public.register_google(text,text,text,text)') is not null as google4,
       to_regprocedure('public.register(text,text,text)') is null as reg3_gone;
```

Expected: two rows; `reg4 = google4 = reg3_gone = true`. Then run the existing registration
e2e (`e2e/registration.spec.ts`) against staging. It must pass unchanged: today's code sends no
version, and that is still accepted.

- [ ] **Step 14: Commit**

```bash
git add lib/privacy.ts lib/privacy.test.ts supabase/migrations/20261008140000_registration_privacy_consent.sql lib/supabase/types.ts lib/security/verdict.ts lib/security/verdict.tokens-drift.test.ts scripts/production-db-schema-check.sql .github/workflows/production-db.yml lib/production-db-security-gate.test.ts lib/production-db-workflow.test.ts docs/superpowers/specs/2026-10-08-registration-privacy-consent-design.md
git commit -F <message-file>
```

Message: `feat(db): consent columns and a version-checking register(), ahead of the code that sends it`,
a body explaining the expand step and the baseline 35 → 36, and the Co-Authored-By line.

### Release A

- [ ] Whole-branch review (spec + plan + Task 1).
- [ ] Push, open PR A (title as the commit), bind it with the ccd_pr tools, CI green.
- [ ] Tell the owner in plain language: this merge changes nothing anyone sees; after it, the
      production-db workflow must run (dry run → owner approves → apply), as for PR #28.
- [ ] After merge and apply: check georgia-republic's `/join` still loads and the production
      check step passed. Then start PR B on a fresh branch from the updated `main`.

---

## PR B — the feature

### Task 2: The consent box component

**Files:**
- Modify: `components/Field.tsx` (`CheckboxField` label accepts `ReactNode`)
- Create: `components/PrivacyConsentField.tsx`
- Create: `components/PrivacyConsentField.test.tsx`

**Interfaces:**
- Consumes: `PRIVACY_POLICY_PATH` from `lib/privacy.ts`.
- Produces: `PrivacyConsentField(props: { checked: boolean; onChange: (checked: boolean) => void; error?: string })`.
  It renders a checkbox named `privacyConsent` whose accessible name is the full consent sentence,
  plus an alert paragraph when `error` is set.

- [ ] **Step 1: Write the failing test**

Create `components/PrivacyConsentField.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrivacyConsentField } from "./PrivacyConsentField";

const SENTENCE =
  "ვადასტურებ, რომ 18 წლის ან უფროსი ვარ და ვეთანხმები ჩემი პერსონალური მონაცემების დამუშავებას კონფიდენციალურობის პოლიტიკის შესაბამისად.";

describe("PrivacyConsentField", () => {
  it("is one checkbox whose name is the whole consent sentence", () => {
    render(<PrivacyConsentField checked={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: SENTENCE })).not.toBeChecked();
  });

  it("links the policy in a new tab so typed input is kept", () => {
    render(<PrivacyConsentField checked={false} onChange={() => {}} />);
    const link = screen.getByRole("link", { name: "კონფიდენციალურობის პოლიტიკის" });
    expect(link).toHaveAttribute("href", "/privacy");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("reports the new checked state", () => {
    const onChange = vi.fn();
    render(<PrivacyConsentField checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: SENTENCE }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows an error as an alert and marks the box invalid", () => {
    render(
      <PrivacyConsentField
        checked={false}
        onChange={() => {}}
        error="გასაგრძელებლად მონიშნე თანხმობა."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("გასაგრძელებლად მონიშნე თანხმობა.");
    expect(screen.getByRole("checkbox", { name: SENTENCE })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("has no alert without an error", () => {
    render(<PrivacyConsentField checked onChange={() => {}} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/PrivacyConsentField.test.tsx`
Expected: FAIL. `./PrivacyConsentField` cannot be resolved.

- [ ] **Step 3: Widen `CheckboxField`'s label**

In `components/Field.tsx`, change the import to
`import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";`
and the `CheckboxField` props type from `{ label: string }` to `{ label: ReactNode }`. Styling is
unchanged. Existing string callers (membership wizard, styleguide) keep working.

- [ ] **Step 4: Create the component**

`components/PrivacyConsentField.tsx`:

```tsx
import Link from "next/link";
import { CheckboxField } from "@/components/Field";
import { PRIVACY_POLICY_PATH } from "@/lib/privacy";

/**
 * The registration consent box (spec 2026-10-08 §4): age 18+ and personal-data
 * processing in one required sentence. One home for both join forms. The policy
 * opens in a new tab so nothing typed into the form is lost.
 */
export function PrivacyConsentField({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <CheckboxField
        name="privacyConsent"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-invalid={error ? true : undefined}
        label={
          <>
            ვადასტურებ, რომ 18 წლის ან უფროსი ვარ და ვეთანხმები ჩემი პერსონალური მონაცემების
            დამუშავებას{" "}
            <Link
              href={PRIVACY_POLICY_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand hover:underline"
            >
              კონფიდენციალურობის პოლიტიკის
            </Link>{" "}
            შესაბამისად.
          </>
        }
      />
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

JSX collapses the line break inside the first text run into one space, so the accessible name is
exactly `SENTENCE`. If Prettier reflows it, re-run the test. It is the guard.

- [ ] **Step 5: Run the test**

Run: `npx vitest run components/PrivacyConsentField.test.tsx components/design-system.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/Field.tsx components/PrivacyConsentField.tsx components/PrivacyConsentField.test.tsx
git commit -F <message-file>
```

Message: `feat(join): the privacy consent box, one component for both join forms`.

### Task 3: Registration requires consent (schemas, server actions, both forms)

These change together. The shared zod schemas gain `privacyConsent`, so every caller (both forms,
both registration actions, the SMS action and its resend) must send it in the same commit.

**Files:**
- Modify: `lib/funnel-schemas.ts`, `lib/funnel-schemas.test.ts`
- Modify: `lib/funnel.ts` (ERROR_MESSAGES)
- Modify: `lib/phone-verification/contracts.ts`, `lib/phone-verification/contracts.test.ts`
- Modify: `app/(public)/join/phone-actions.ts`, `app/(public)/join/phone-actions.test.ts`
- Modify: `app/(public)/join/google-actions.ts`, `app/(public)/join/google-actions.test.ts`
- Modify: `app/(public)/join/actions.ts`
- Create: `app/(public)/join/actions.test.ts`
- Modify: `components/PhoneVerification.tsx`, `components/PhoneVerification.test.tsx`
- Modify: `app/(public)/join/GoogleJoinForm.tsx`, `app/(public)/join/LegacyJoinForm.tsx`
- Modify: `app/(public)/join/JoinForm.test.tsx`

**Interfaces:**
- Consumes: `PrivacyConsentField` (Task 2); `PRIVACY_POLICY_VERSION`, `PRIVACY_POLICY_PATH`,
  `PRIVACY_CONSENT_REQUIRED_MESSAGE` (Task 1).
- Produces: `registerSchema` / `registerActionSchema` with `privacyConsent: true` required;
  `sendPhoneVerificationAction(input: { phone: string; privacyConsent: true })`;
  `PhoneVerificationFailureCode` gains `"privacy_consent_required"`; both registration actions
  send `p_privacy_version`.

- [ ] **Step 1: Schema tests first**

In `lib/funnel-schemas.test.ts`: add `privacyConsent: true` to the `registerSchema` `base`, and
to the `registerActionSchema` input. Add:

```ts
  it("requires the privacy consent tick, in Georgian, on the privacyConsent path", () => {
    const { privacyConsent: _omit, ...unticked } = base;
    for (const input of [unticked, { ...base, privacyConsent: false }]) {
      const result = registerSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) continue;
      const issue = result.error.issues.find((i) => i.path[0] === "privacyConsent");
      expect(issue?.message).toBe("გასაგრძელებლად მონიშნე თანხმობა.");
    }
  });
```

(inside `describe("registerSchema")`), and inside `describe("registerActionSchema")`:

```ts
  it("requires the privacy consent tick too", () => {
    expect(
      registerActionSchema.safeParse({ firstName: "ნინო", lastName: "ბერიძე" }).success,
    ).toBe(false);
  });
```

If ESLint flags `_omit` as unused, use the repo's existing pattern for omitting a key (search
`no-unused-vars` in `eslint.config.*`), or build `unticked` explicitly as
`{ firstName: base.firstName, lastName: base.lastName, phone: base.phone }`.

Run: `npx vitest run lib/funnel-schemas.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 2: Add the field to the schema**

In `lib/funnel-schemas.ts`, import `PRIVACY_CONSENT_REQUIRED_MESSAGE` from `./privacy` and add to
`registerSchema` after `refCode`:

```ts
  // Registration privacy consent (spec 2026-10-08 §4). zod v3's `{ message }` shorthand
  // does not reach z.literal's issues (see tierSchema below), so an explicit errorMap.
  privacyConsent: z.literal(true, {
    errorMap: () => ({ message: PRIVACY_CONSENT_REQUIRED_MESSAGE }),
  }),
```

`registerActionSchema` inherits it through `.omit({ phone: true })`.
Run: `npx vitest run lib/funnel-schemas.test.ts`. Expected: PASS.

- [ ] **Step 3: SMS action tests**

In `app/(public)/join/phone-actions.test.ts`, change every
`sendPhoneVerificationAction({ phone: <x> })` call to
`sendPhoneVerificationAction({ phone: <x>, privacyConsent: true })` (mechanical; there are eight
call sites, lines 88–299). Then add:

```ts
  it("refuses an unconsented send before any privileged work or SMS", async () => {
    authenticate();
    for (const input of [{ phone: "555123456" }, { phone: "555123456", privacyConsent: false }]) {
      await expect(sendPhoneVerificationAction(input)).resolves.toEqual({
        ok: false,
        code: "privacy_consent_required",
        message: PHONE_VERIFICATION_MESSAGES.privacy_consent_required,
      });
    }
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
```

In `lib/phone-verification/contracts.test.ts`, add
`privacy_consent_required: "გასაგრძელებლად მონიშნე თანხმობა.",` to the pinned messages object.

Run: `npx vitest run "app/(public)/join/phone-actions.test.ts" lib/phone-verification/contracts.test.ts`
Expected: FAIL (code and message do not exist).

- [ ] **Step 4: Implement the SMS gate**

`lib/phone-verification/contracts.ts`: add `| "privacy_consent_required"` to
`PhoneVerificationFailureCode`, import `PRIVACY_CONSENT_REQUIRED_MESSAGE` from `../privacy`, and
add `privacy_consent_required: PRIVACY_CONSENT_REQUIRED_MESSAGE,` to `PHONE_VERIFICATION_MESSAGES`.

`app/(public)/join/phone-actions.ts`: next to `sendSchema` add

```ts
// Sending the number to the SMS provider is processing, so consent comes first
// (spec 2026-10-08 §4). Checked after the identity gates, before any privileged work.
const consentSchema = z.object({ privacyConsent: z.literal(true) });
```

and in `sendPhoneVerificationAction`, directly after the `google_required` return:

```ts
  if (!consentSchema.safeParse(input).success) return failure("privacy_consent_required");
```

`components/PhoneVerification.tsx` `resend()`: change the call to

```ts
      // The code screen is only reachable after the join form's consent tick.
      const result = await sendPhoneVerificationAction({ phone, privacyConsent: true });
```

and in `components/PhoneVerification.test.tsx:120` expect
`{ phone: PHONE, privacyConsent: true }`.

Run: `npx vitest run "app/(public)/join/phone-actions.test.ts" lib/phone-verification components/PhoneVerification.test.tsx`
Expected: PASS.

- [ ] **Step 5: Registration action tests**

`app/(public)/join/google-actions.test.ts`: `VALID_INPUT` gains `privacyConsent: true`; the
`register_google` call expectation gains `p_privacy_version: "2026-10-v1"`. Add a row to the
`it.each` table:

```ts
    {
      token: "privacy_consent_required",
      error: { code: "P0001", message: "privacy_consent_required", details: null, hint: null },
      stableCode: "invalid_input",
      expected: "გასაგრძელებლად მონიშნე თანხმობა.",
    },
```

and a test:

```ts
  it("refuses an unconsented registration before opening Supabase", async () => {
    const { privacyConsent: _omit, ...unticked } = VALID_INPUT;
    await expect(registerGoogleAction(unticked)).resolves.toEqual({
      ok: false,
      code: "invalid_input",
      error: "გასაგრძელებლად მონიშნე თანხმობა.",
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });
```

Create `app/(public)/join/actions.test.ts` for the legacy action:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerSupabase: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));

import { registerAction } from "./actions";

beforeEach(() => {
  mocks.createServerSupabase.mockReset();
  mocks.rpc.mockReset();
  mocks.createServerSupabase.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { exists: true }, error: null });
});

describe("registerAction (legacy phone mode)", () => {
  it("sends the current policy version with a consented registration", async () => {
    await registerAction({ firstName: "ნინო", lastName: "ბერიძე", privacyConsent: true });
    expect(mocks.rpc).toHaveBeenCalledWith("register", {
      p_first_name: "ნინო",
      p_last_name: "ბერიძე",
      p_ref_code: null,
      p_privacy_version: "2026-10-v1",
    });
  });

  it("refuses an unconsented registration before opening Supabase", async () => {
    await expect(registerAction({ firstName: "ნინო", lastName: "ბერიძე" })).resolves.toEqual({
      ok: false,
      error: "გასაგრძელებლად მონიშნე თანხმობა.",
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("maps the database refusal to the consent message", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "privacy_consent_required" } });
    await expect(
      registerAction({ firstName: "ნინო", lastName: "ბერიძე", privacyConsent: true }),
    ).resolves.toEqual({ ok: false, error: "გასაგრძელებლად მონიშნე თანხმობა." });
  });
});
```

Run: `npx vitest run "app/(public)/join/google-actions.test.ts" "app/(public)/join/actions.test.ts"`
Expected: FAIL (no version sent, token unmapped).

- [ ] **Step 6: Implement the actions**

`app/(public)/join/google-actions.ts`: import
`{ PRIVACY_CONSENT_REQUIRED_MESSAGE, PRIVACY_POLICY_VERSION } from "@/lib/privacy"`; add
`p_privacy_version: PRIVACY_POLICY_VERSION,` to the `register_google` args; add to the `switch`:

```ts
      case "privacy_consent_required":
        return { ok: false, code: "invalid_input", error: PRIVACY_CONSENT_REQUIRED_MESSAGE };
```

`app/(public)/join/actions.ts`: import `PRIVACY_POLICY_VERSION` and add
`p_privacy_version: PRIVACY_POLICY_VERSION,` to the `register` args.

`lib/funnel.ts`: import `PRIVACY_CONSENT_REQUIRED_MESSAGE` from `./privacy` and add, next to
`invalid_name` in `ERROR_MESSAGES`:

```ts
  privacy_consent_required: PRIVACY_CONSENT_REQUIRED_MESSAGE,
```

(No other key is a substring of it, so `mapFunnelError`'s insertion-order matching is safe.)

Run the Step 5 command. Expected: PASS.

- [ ] **Step 7: Form tests**

In `app/(public)/join/JoinForm.test.tsx`:

1. Add near the constants:
   ```ts
   const CONSENT = /^ვადასტურებ, რომ 18 წლის ან უფროსი ვარ/;
   const CONSENT_ERROR = "გასაგრძელებლად მონიშნე თანხმობა.";
   ```
2. In `sendGoogleCode()`, before clicking `კოდის მიღება`, add
   `fireEvent.click(screen.getByRole("checkbox", { name: CONSENT }));`.
3. Every `expect(mocks.sendPhone).toHaveBeenCalledWith({ phone: X })` becomes
   `{ phone: X, privacyConsent: true }`. Every `expect(mocks.registerGoogle).toHaveBeenCalledWith({ … })`
   gains `privacyConsent: true`. Any other test that clicks `კოდის მიღება` or `დარეგისტრირება`
   directly (lines ~72–135 of the Google describe) must tick the box first, the same way.
4. Add to `describe("GoogleJoinForm")`:

```tsx
  it("tells the person at the Google step that continuing means agreeing to the policy", async () => {
    await renderJoin();
    await screen.findByRole("button", { name: "Google-ით გაგრძელება" });
    expect(
      screen.getByText((_, el) =>
        el?.tagName === "P" &&
        el.textContent === "Google-ით გაგრძელებით ეთანხმები ჩვენს კონფიდენციალურობის პოლიტიკას.",
      ),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "კონფიდენციალურობის პოლიტიკას" });
    expect(link).toHaveAttribute("href", "/privacy");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("sends no SMS and registers nothing until the consent box is ticked", async () => {
    await reachGoogleForm();
    fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: "ნინო" } });
    fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "ბერიძე" } });
    fireEvent.change(screen.getByLabelText("ტელეფონის ნომერი"), {
      target: { value: "555123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "კოდის მიღება" }));

    expect(await screen.findByText(CONSENT_ERROR)).toBeInTheDocument();
    expect(mocks.sendPhone).not.toHaveBeenCalled();
    expect(mocks.registerGoogle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: CONSENT }));
    expect(screen.queryByText(CONSENT_ERROR)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "კოდის მიღება" }));
    await waitFor(() =>
      expect(mocks.sendPhone).toHaveBeenCalledWith({ phone: PHONE, privacyConsent: true }),
    );
  });
```

5. Add a legacy-mode test to `describe("JoinForm rollout selector")` (or a new
   `describe("LegacyJoinForm")`):

```tsx
  it("legacy mode also holds the code until the consent box is ticked", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "phone");
    await renderJoin();
    fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: "ნინო" } });
    fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "ბერიძე" } });
    fireEvent.change(screen.getByLabelText("ტელეფონის ნომერი"), {
      target: { value: "555123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    expect(await screen.findByText(CONSENT_ERROR)).toBeInTheDocument();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: CONSENT }));
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    await waitFor(() => expect(mocks.signInWithOtp).toHaveBeenCalledWith({ phone: PHONE }));
  });
```

Run: `npx vitest run "app/(public)/join/JoinForm.test.tsx"`
Expected: FAIL (no checkbox, no notice).

- [ ] **Step 8: Implement `GoogleJoinForm`**

In `app/(public)/join/GoogleJoinForm.tsx`:

- Imports: `Link from "next/link"`, `{ PrivacyConsentField } from "@/components/PrivacyConsentField"`,
  `{ PRIVACY_POLICY_PATH } from "@/lib/privacy"`.
- `const FIELD_KEYS = ["firstName", "lastName", "phone", "privacyConsent"] as const;`
- State: `const [privacyConsent, setPrivacyConsent] = useState(false);`
- `submitForm()`: parse with `privacyConsent`; pass `privacyConsent: parsed.data.privacyConsent`
  to `registerGoogleAction({...})` and to
  `sendPhoneVerificationAction({ phone: parsed.data.phone, privacyConsent: parsed.data.privacyConsent })`.
  In the send-failure branch, before the final `else`, add
  `else if (result.code === "privacy_consent_required") { setErrors({ privacyConsent: result.message }); }`.
- `registerVerifiedPhone()`: `registerGoogleAction({ firstName, lastName, refCode, privacyConsent })`.
- `submitRetry()`: `registerActionSchema.safeParse({ firstName, lastName, refCode, privacyConsent })`.
- Google phase, directly under `<GoogleAuthButton … />`:

```tsx
          <p className="text-xs text-muted-fg">
            Google-ით გაგრძელებით ეთანხმები ჩვენს{" "}
            <Link
              href={PRIVACY_POLICY_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand hover:underline"
            >
              კონფიდენციალურობის პოლიტიკას
            </Link>
            .
          </p>
```

- Form/retry phase, directly above the `{formError ? … }` block:

```tsx
          <PrivacyConsentField
            checked={privacyConsent}
            onChange={(checked) => {
              setPrivacyConsent(checked);
              if (checked) setErrors((prev) => ({ ...prev, privacyConsent: undefined }));
            }}
            error={errors.privacyConsent}
          />
```

- [ ] **Step 9: Implement `LegacyJoinForm`**

The same changes in `app/(public)/join/LegacyJoinForm.tsx`: `FIELD_KEYS` gains
`"privacyConsent"`; `privacyConsent` state; `registerSchema.safeParse({ …, privacyConsent })`
in `submitForm()` (this blocks `signInWithOtp` client-side; the server-side guarantee is
`register()`'s refusal); `registerActionSchema.safeParse({ …, privacyConsent })` in
`submitRetry()`; `registerAction({ firstName, lastName, refCode, privacyConsent })` in
`afterVerify()`; and the same `<PrivacyConsentField … />` above `{formError ? … }`.
No step-1 notice here: the legacy form has no Google step.

- [ ] **Step 10: Run the join tests and the whole suite**

Run: `npx vitest run "app/(public)/join" components lib`
Expected: PASS. Then `npm run typecheck`. Every `registerGoogleAction` / `registerAction` /
`sendPhoneVerificationAction` caller now compiles with the consent field.

- [ ] **Step 11: Commit**

```bash
git add lib/funnel-schemas.ts lib/funnel-schemas.test.ts lib/funnel.ts lib/phone-verification/contracts.ts lib/phone-verification/contracts.test.ts "app/(public)/join" components/PhoneVerification.tsx components/PhoneVerification.test.tsx
git commit -F <message-file>
```

Message: `feat(join): registration requires the privacy consent tick, on both forms and on the server`.

### Task 4: The `/privacy` page, footer link, sitemap, mobile header

**Files:**
- Create: `app/(public)/privacy/page.tsx`, `app/(public)/privacy/page.test.tsx`
- Modify: `app/(public)/layout.tsx` (footer link), `app/(public)/layout.test.tsx`
- Modify: `app/sitemap.ts`; Create: `app/sitemap.test.ts`
- Modify: `lib/mobile-nav.ts`, `lib/mobile-nav.test.ts`, `components/MobileJoinCta.test.tsx`

**Interfaces:**
- Consumes: `PRIVACY_POLICY_PATH` (Task 1).
- Produces: public route `/privacy`.

- [ ] **Step 1: Page test**

`app/(public)/privacy/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata } from "./page";

const SECTIONS = [
  "ვინ ვართ",
  "რა მონაცემებს ვაგროვებთ",
  "რისთვის ვიყენებთ",
  "ვინ ხედავს შენს მონაცემებს",
  "ვის ვუზიარებთ",
  "რამდენ ხანს ვინახავთ",
  "შენი უფლებები",
  "ასაკი",
  "ქუქი-ფაილები",
  "ცვლილებები",
];

describe("/privacy", () => {
  it("is titled as the privacy policy", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "კონფიდენციალურობის პოლიტიკა" }),
    ).toBeInTheDocument();
    expect(metadata.title).toBe("კონფიდენციალურობის პოლიტიკა — ქართული რესპუბლიკა");
  });

  it("has the ten sections, in order", () => {
    render(<PrivacyPage />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      SECTIONS,
    );
  });

  it("is marked as a working version pending legal review", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByText("სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას."),
    ).toBeInTheDocument();
  });

  it("names the movement and no service provider", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("მოძრაობა ქართული რესპუბლიკა");
    for (const company of ["Supabase", "Vercel", "Verify.ge"]) expect(text).not.toContain(company);
  });

  it("states the 18+ rule and the transfer to the EU", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("მხოლოდ 18 წლის ან უფროს პირს");
    expect(text).toContain("ევროკავშირში");
  });
});
```

Run: `npx vitest run "app/(public)/privacy"`. Expected: FAIL (no page).

- [ ] **Step 2: Create the page**

`app/(public)/privacy/page.tsx`. Same shell as `app/(public)/join/terms/page.tsx`. Every Georgian
string below is spliced from spec §5 (sections 1–10 after the owner removed the political-views
section). Splice, do not retype.

```tsx
import type { Metadata } from "next";
import { Eyebrow } from "@/components/Eyebrow";

export const metadata: Metadata = {
  title: "კონფიდენციალურობის პოლიტიკა — ქართული რესპუბლიკა",
  description: "რა მონაცემებს ვაგროვებთ, რისთვის ვიყენებთ და ვინ ხედავს მათ.",
};

type Section = { heading: string; body: string } | { heading: string; items: string[] };

/**
 * Spec docs/superpowers/specs/2026-10-08-registration-privacy-consent-design.md §5.
 * Linked from the registration consent box (lib/privacy.ts PRIVACY_POLICY_PATH), so
 * changing the substance here means bumping PRIVACY_POLICY_VERSION and the migration.
 */
const SECTIONS: Section[] = [
  { heading: "ვინ ვართ", body: "<spec §5 item 1>" },
  { heading: "რა მონაცემებს ვაგროვებთ", items: ["<spec §5 item 2, bullet 1>", "<bullet 2>", "<bullet 3>", "<bullet 4>"] },
  { heading: "რისთვის ვიყენებთ", body: "<spec §5 item 3>" },
  { heading: "ვინ ხედავს შენს მონაცემებს", items: ["<spec §5 item 4, five bullets>"] },
  { heading: "ვის ვუზიარებთ", body: "<spec §5 item 5>" },
  { heading: "რამდენ ხანს ვინახავთ", body: "<spec §5 item 6>" },
  { heading: "შენი უფლებები", body: "<spec §5 item 7>" },
  { heading: "ასაკი", body: "<spec §5 item 8>" },
  { heading: "ქუქი-ფაილები", body: "<spec §5 item 9>" },
  { heading: "ცვლილებები", body: "<spec §5 item 10>" },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 pb-16 pt-10">
      <div className="mb-2">
        <Eyebrow>პერსონალური მონაცემები</Eyebrow>
      </div>
      <h1 className="mb-4 font-serif text-3xl font-bold text-ink">კონფიდენციალურობის პოლიტიკა</h1>
      <p className="mb-6 border border-warn-deep bg-warn/10 p-3 text-sm font-semibold text-warn-deep">
        სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.
      </p>
      <p className="mb-6 text-sm text-prose">{"<spec §5 Intro>"}</p>
      <div className="flex flex-col gap-6 border-y-2 border-ink py-8">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-2 font-serif text-lg font-bold text-ink">{section.heading}</h2>
            {"items" in section ? (
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-prose">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-prose">{section.body}</p>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
```

The `<spec §5 …>` markers are splice instructions for this step. Replace each with the exact
backticked string from the spec using a small ASCII-only Node script that reads the spec file
(per the Georgian-quote rule). The finished file has no markers left; check with
`grep -n "<spec" "app/(public)/privacy/page.tsx"` (expect no output). The banner string is spliced
from `app/(public)/join/terms/page.tsx`. Classes are the same as that page's, plus `text-prose`
and `list-disc`, which the membership wizard already uses.

Run: `npx vitest run "app/(public)/privacy"`. Expected: PASS.

- [ ] **Step 3: Footer, sitemap, mobile header: tests**

`app/(public)/layout.test.tsx`, a new `describe` block:

```tsx
describe("public layout — privacy policy link", () => {
  it("links the privacy policy from the footer, right after the rules", () => {
    renderLayout();
    const links = within(screen.getByRole("contentinfo")).getAllByRole("link");
    const labels = links.map((l) => l.textContent);
    expect(labels.indexOf("კონფიდენციალურობა")).toBe(labels.indexOf("წესები") + 1);
    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", { name: "კონფიდენციალურობა" }),
    ).toHaveAttribute("href", "/privacy");
  });
});
```

`app/sitemap.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site", () => ({ siteUrl: () => "https://example.test" }));
vi.mock("@/lib/supabase/public", () => ({ fetchPublicDelegates: async () => [] }));

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists the privacy policy like the delegate rules", async () => {
    const entries = await sitemap();
    expect(entries).toContainEqual({
      url: "https://example.test/privacy",
      changeFrequency: "monthly",
      priority: 0.3,
    });
  });
});
```

`lib/mobile-nav.test.ts`: add `"/privacy"` to the back-header loop (line ~49) and add
`expect(showsJoinCta("/privacy")).toBe(false);` to the no-CTA test. Add to the
`mobileBackTarget` describe:

```ts
  it("maps the privacy policy back to registration", () => {
    expect(mobileBackTarget("/privacy")).toEqual({ href: "/join", label: "კონფიდენციალურობა" });
  });
```

`components/MobileJoinCta.test.tsx:49`: add `"/privacy"` to the hidden-paths loop.

Run: `npx vitest run "app/(public)/layout.test.tsx" app/sitemap.test.ts lib/mobile-nav.test.ts components/MobileJoinCta.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement**

`app/(public)/layout.tsx`: add `const FOOTER_PRIVACY_LABEL = "კონფიდენციალურობა";` next to
`FOOTER_TERMS_LABEL`, import `PRIVACY_POLICY_PATH`, and insert
`{ href: PRIVACY_POLICY_PATH, label: FOOTER_PRIVACY_LABEL },` right after the `/join/terms` entry
in `footerLinks`.

`app/sitemap.ts`: after the `/join/terms` entry add
`{ url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.3 },`.

`lib/mobile-nav.ts`: `const PRIVACY_LABEL = "კონფიდენციალურობა";`, add
`"/privacy": { href: "/join", label: PRIVACY_LABEL },` to `STATIC_BACK`, and add `"/privacy"` to
`NO_CTA_ROUTES`.

Run the Step 3 command. Expected: PASS. Also run `npx vitest run app/route-groups.test.tsx`
(still PASS: `/privacy` lives in the existing `(public)` group).

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/privacy" "app/(public)/layout.tsx" "app/(public)/layout.test.tsx" app/sitemap.ts app/sitemap.test.ts lib/mobile-nav.ts lib/mobile-nav.test.ts components/MobileJoinCta.test.tsx
git commit -F <message-file>
```

Message: `feat(public): the privacy policy page, linked from the footer and the sitemap`.

### Task 5: Make consent mandatory in the database, e2e, ADR

**Files:**
- Create: `supabase/migrations/20261008150000_require_privacy_consent.sql`
- Modify: `lib/privacy.test.ts`
- Modify: migration baseline 36 → 37 (same four places as Task 1 Step 10)
- Modify: `e2e/funnel-helpers.ts` (`passRegistration` ticks the box)
- Modify: `e2e/registration.spec.ts`
- Modify: `DECISIONS.md` (ADR-041)

**Interfaces:**
- Consumes: Task 1's `register()`; Task 3's forms (the e2e drives them).
- Produces: `register()` refuses a missing or wrong version; every new profile has both fields.

- [ ] **Step 1: Failing static test**

Add to `describe("register() records privacy consent")` in `lib/privacy.test.ts`:

```ts
  it("refuses a missing version too, so no registration skips consent", () => {
    const body = latestDefinition("register");
    expect(body).toContain(`if p_privacy_version is distinct from '${PRIVACY_POLICY_VERSION}' then`);
    expect(body).not.toContain("case when p_privacy_version is null");
  });
```

Run: `npx vitest run lib/privacy.test.ts`. Expected: FAIL.

- [ ] **Step 2: The tightening migration**

`supabase/migrations/20261008150000_require_privacy_consent.sql`: header comment (step 2 of 2;
ships with the code that always sends the version; grants restated per house shape), then
`create or replace function register(...)` with the same four-argument signature, restating
Task 1's body verbatim except:

```sql
  -- Privacy consent (spec 2026-10-08 §6), step 2 of 2: every registration carries
  -- the current policy version; a missing or stale one is refused.
  if p_privacy_version is distinct from '2026-10-v1' then
    raise exception 'privacy_consent_required';
  end if;
```

and the insert's two consent values become `now(), p_privacy_version`. End with:

```sql
grant execute on function register(text, text, text, text) to authenticated;
revoke execute on function register(text, text, text, text) from public, anon;
```

`register_google()` is unchanged: it already passes the version through.

Move the baseline 36 → 37 in the four places. Run:
`npx vitest run lib/privacy.test.ts lib/security lib/production-db-security-gate.test.ts lib/production-db-workflow.test.ts`
Expected: PASS (the token count is unchanged; the token already exists).

- [ ] **Step 3: e2e**

`e2e/funnel-helpers.ts` `passRegistration()`: before clicking `კოდის მიღება`, add

```ts
  await page.getByRole("checkbox", { name: /^ვადასტურებ, რომ 18 წლის ან უფროსი ვარ/ }).check();
```

`e2e/registration.spec.ts`: import `createGoogleBackedTestUser` too, and `serviceClient` from
`./otp-helpers`. Add **before** the happy-path test (serial mode, so it runs first and frees the
slot):

```ts
test("sends no code until the privacy consent box is ticked", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.regHappy);
  await createGoogleBackedTestUser(page, phone);
  await page.goto("/join");
  await expect(
    page.getByRole("link", { name: "კონფიდენციალურობის პოლიტიკის" }),
  ).toHaveAttribute("href", "/privacy");
  await page.getByLabel("სახელი").fill("ნინო");
  await page.getByLabel("გვარი").fill("ტესტი");
  await page.getByLabel("ტელეფონის ნომერი").fill(phone);
  await page.getByRole("button", { name: "კოდის მიღება" }).click();
  await expect(page.getByText("გასაგრძელებლად მონიშნე თანხმობა.")).toBeVisible();
  await expect(page.getByTestId("otp-0")).toHaveCount(0);
  // free the slot for the happy path below
  await cleanupGoogleBackedTestUsers([phone]);
});
```

In the happy-path test, directly after `passRegistration(...)`:

```ts
  // consent is recorded with the policy version (spec 2026-10-08 §6)
  const { data: consent, error: consentError } = await serviceClient()
    .from("profiles")
    .select("privacy_version, privacy_accepted_at")
    .eq("phone", `+995${phone}`)
    .single();
  expect(consentError).toBeNull();
  expect(consent?.privacy_version).toBe("2026-10-v1");
  expect(consent?.privacy_accepted_at).not.toBeNull();
```

Then add a smoke assertion that the page renders, to `e2e/public.spec.ts` or a new test in
`registration.spec.ts`:

```ts
test("the privacy policy is public and linked from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "კონფიდენციალურობა" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "კონფიდენციალურობის პოლიტიკა" }),
  ).toBeVisible();
});
```

- [ ] **Step 4: Apply to staging and run e2e**

Apply `20261008150000` to staging (the same staging push as Task 1). Note: from this moment the
demo site's current `main` code (which sends no version) cannot register on staging until PR B
merges. Accepted; the demo has no real registrations. Then run the full e2e suite against the
local build with the copied `.env.local` (see the worktree e2e memory: absolute Playwright CLI
path; do not trust a wrapper's exit code, read the summary line).
Expected: all pass, including the three new/changed registration tests.

- [ ] **Step 5: ADR-041**

Append to `DECISIONS.md`:

```markdown
## ADR-041 (2026-10-08): Registration asks for privacy consent; the date and policy version are stored

- **What.** One required box on registration (18+ and personal-data processing, one sentence),
  linking a new `/privacy` page; a notice under the Google button. Spec:
  `docs/superpowers/specs/2026-10-08-registration-privacy-consent-design.md`.
- **Why.** Georgian Law No. 3144 (2023) treats political opinions as special-category data,
  needing written consent (an electronic tick counts), separate from other terms. Registering with
  the movement reveals support for it. The Art. 6(k) exception for political associations does not
  apply: the movement is not registered.
- **Enforcement.** `register()` (reached by both sign-up routes) refuses a missing or stale
  `p_privacy_version` with `privacy_consent_required` and stamps `profiles.privacy_accepted_at` /
  `privacy_version`; both columns are server-managed. The SMS send action refuses without the
  tick, so no number goes to the provider unconsented. The version lives in `lib/privacy.ts` and the
  migration; `lib/privacy.test.ts` keeps them equal.
- **Two-step release.** `20261008140000` (accepts an optional version) shipped and was applied
  before the code; `20261008150000` (refuses a missing one) ships with it. Merging to `main`
  deploys before the production migration can run, so the database had to accept both shapes first.
- **Owner decisions.** Controller named only as the movement; recipients by category, no company
  names; minimum age 18; no political-views explainer section; the two founders' accounts keep
  empty consent fields (no hand edits).
- **Deferred (owner: later).** A channel for data requests and self-service deletion/withdrawal
  (the law's 10-working-day rights); general rules of use; re-consent on a new policy version;
  consent date in the admin panel; legal review of the copy before launch.
```

- [ ] **Step 6: Gates and commit**

Run the five CI gates, `node scripts/ka-gate.mjs --diff main` over every changed file with
Georgian text, and `npm run ka:scan`. Expected: green.

```bash
git add supabase/migrations/20261008150000_require_privacy_consent.sql lib/privacy.test.ts .github/workflows/production-db.yml lib/production-db-security-gate.test.ts lib/production-db-workflow.test.ts e2e/funnel-helpers.ts e2e/registration.spec.ts DECISIONS.md
git commit -F <message-file>
```

Message: `feat(db): registration refuses without privacy consent (step 2 of 2), e2e, ADR-041`.

### Release B

- [ ] Whole-branch review of PR B.
- [ ] Push, open PR B, bind with ccd_pr, CI green (it includes e2e against staging, which now has
      both migrations).
- [ ] `/qa` on the Vercel preview.
- [ ] Owner evidence, plain language: preview URL; screenshots of `/privacy` (desktop + mobile),
      the Google step with its notice, step 2 with the unticked error, step 2 ticked, and the
      footer link.
- [ ] Owner sign-off. Merge. Then the production-db workflow (dry run → owner approves → apply).
      Until it is applied, the real site runs the new code against step-1's function, which
      accepts and stamps the version. Nothing breaks in between.
- [ ] After apply: check georgia-republic's `/privacy`, the footer link, and that `/join` shows
      the box. Report what the merge shipped (both sites), the two migrations, and no new
      environment variables.
