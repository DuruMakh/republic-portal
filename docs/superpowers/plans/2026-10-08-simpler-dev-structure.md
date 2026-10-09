# Simpler Development Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One website, CI on a throwaway local database, one-click test sign-in on previews, staging with
made-up people only, and the demo Vercel project retired.

**Architecture:** CI starts a local Supabase stack in the GitHub runner, seeds it with the existing canonical
seed, and points build + e2e at it. Previews move from the demo Vercel project to the real one and keep using
staging. A preview-only test sign-in reuses the e2e fixture sign-in, moved into a shared module, behind a
server-side gate that allows only known test databases.

**Tech Stack:** Next.js 16 App Router, Supabase (supabase-js, @supabase/ssr, Supabase CLI 2.109.1), Vitest,
Playwright, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-08-simpler-dev-structure-design.md`

## Global Constraints

- TypeScript strict. No `any`, no `@ts-ignore` (CLAUDE.md).
- Domain logic in `lib/` has no React/Next imports. UI in `components/`.
- All user-facing text is Georgian. Reuse design-system components (`Button`, `Card`); no ad hoc styling.
- zod validation at every boundary, including the test sign-in server action.
- TDD: every code task starts with a failing test that is run and seen to fail.
- Never touch the production Supabase project `uorvlshbrlbdnbauxsws` or GeoData. Never handle secret values
  (keys, tokens): the owner moves those, guided in chat.
- GitHub Actions are pinned to commit SHAs, as in `production-admin.yml`
  (`supabase/setup-cli@1dedf2c611547ede7232d26866dd3c56ab903bbb # v1.7.3`).
- Vercel hobby limit is 100 deployments a day and every push currently builds both projects: batch commits,
  push rarely.
- New ADRs take the next free number on `main` at merge time (recheck before each merge).
- Each part ships as its own PR with per-task reviews, a whole-branch review, owner sign-off in chat, then
  Claude merges. Never merge with failing CI.

## File Structure

| File | Responsibility |
|---|---|
| `lib/env.ts` (modify) | Adds `isTestDatabaseUrl()` and `testSignInEnabled()`; exports `STAGING_PROJECT_REF`, `LOCAL_SUPABASE_ORIGINS`. |
| `scripts/staging-guard.mjs` (modify) | Allow-list grows to the local CI stack; returns which target it allowed. |
| `scripts/seed-staging.mjs` (modify) | `--confirm-ref local` for the local stack. |
| `.github/workflows/ci.yml` (modify) | Local Supabase stack, seed, build + e2e on it; no staging secrets. |
| `lib/ci-workflow.test.ts` (modify) | Pins the new CI shape. |
| `lib/fixture-auth.ts` (create) | Shared fixture sign-in (seed accounts by phone, fresh Google-style visitor), persona phone lookup. No React/Next. |
| `e2e/otp-helpers.ts` (modify) | `fixtureSession` becomes a thin wrapper over `lib/fixture-auth.ts`. |
| `lib/test-personas.ts` (create) | The fixed persona list (ids, Georgian labels, landing paths). |
| `app/(public)/login/test-sign-in-actions.ts` (create) | Server action: gate, validate, sign in, set cookies, redirect. |
| `components/TestSignInPanel.tsx` (create) | The „სატესტო შესვლა“ panel. |
| `app/(public)/login/GoogleLogin.tsx`, `page.tsx` (modify) | Render the panel when enabled; new error message. |
| `e2e/test-sign-in.spec.ts` (create) | Clicks every persona on the CI stack. |
| `DECISIONS.md`, `README.md` (modify) | ADR and docs. |

---

## Part A: CI on a throwaway database (PR A)

### Task 1: Spike: does the local stack start and take every migration?

No Docker on the owner's computer, so the spike runs on GitHub. Output is an answer, not kept code.

**Files:**
- Create (throwaway, never merged): `.github/workflows/local-stack-spike.yml`

- [ ] **Step 1: Write the spike workflow** on branch `claude/local-stack-spike` (off `main`):

```yaml
name: Local stack spike
on: { push: { branches: [claude/local-stack-spike] } }
permissions: { contents: read }
jobs:
  spike:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5
        with: { persist-credentials: false }
      - uses: supabase/setup-cli@1dedf2c611547ede7232d26866dd3c56ab903bbb # v1.7.3
        with: { version: 2.109.1 }
      - run: supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta
        timeout-minutes: 10
      - run: supabase status -o env | sed -E 's/=.*/=<redacted>/'
      - uses: actions/setup-node@v5
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: |
          eval "$(supabase status -o env --override-name api.url=NEXT_PUBLIC_SUPABASE_URL --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=' | sed 's/^/export /')"
          NEXT_PUBLIC_APP_ENV=preview node scripts/seed-staging.mjs --confirm-ref local || echo "SEED FAILED (expected until Task 2)"
```

(`actions/setup-node@v5` matches `ci.yml` today, which is not SHA-pinned; the spike is throwaway, so it
keeps the same form.)

- [ ] **Step 2: Push once and read the run.** Record in the PR A description: start time, whether all 41
  migrations applied, the exact env variable names `supabase status -o env` prints, and any failing
  migration with its error.
- [ ] **Step 3: Decide.** If a migration fails locally, stop and report to the owner in chat. Migrations that
  production already ran are never edited, so a failure means a config fix (`supabase/config.toml`) or a
  different approach, which needs a decision. If all apply, continue.
- [ ] **Step 4: Delete the spike branch** (`git push origin --delete claude/local-stack-spike`) after
  recording the results.

### Task 2: Guards allow the local CI stack (and still refuse production)

**Files:**
- Modify: `lib/env.ts`, `scripts/staging-guard.mjs`, `scripts/seed-staging.mjs:45-52`
- Test: `lib/env.test.ts`, `lib/security/staging-guard.test.ts`

**Interfaces:**
- Produces: `STAGING_PROJECT_REF: "orcxtbedkexoclbfgvzd"`, `LOCAL_SUPABASE_ORIGINS: readonly string[]`,
  `isTestDatabaseUrl(url: string | undefined): boolean`, `testSignInEnabled(): boolean` (all in `lib/env.ts`);
  `assertStagingTarget(url): "staging" | "local"` (in `scripts/staging-guard.mjs`).

- [ ] **Step 1: Write the failing tests.** Append to `lib/env.test.ts`:

```ts
import { isTestDatabaseUrl, testSignInEnabled } from "./env";

describe("isTestDatabaseUrl", () => {
  it.each([
    ["https://orcxtbedkexoclbfgvzd.supabase.co", true],
    ["http://127.0.0.1:54321", true],
    ["http://localhost:54321", true],
    ["https://uorvlshbrlbdnbauxsws.supabase.co", false],
    ["http://orcxtbedkexoclbfgvzd.supabase.co", false],
    ["https://orcxtbedkexoclbfgvzd.supabase.co.evil.example", false],
    ["http://127.0.0.1:9999", false],
    ["not a url", false],
    ["", false],
    [undefined, false],
  ])("%s → %s", (url, expected) => {
    expect(isTestDatabaseUrl(url)).toBe(expected);
  });
});

describe("testSignInEnabled", () => {
  it("is on for a preview pointed at staging", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
    expect(testSignInEnabled()).toBe(true);
  });

  it("is off when the flag says production, even on a test database", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
    expect(testSignInEnabled()).toBe(false);
  });

  it("is off on the production database whatever the flag says", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://uorvlshbrlbdnbauxsws.supabase.co");
    expect(testSignInEnabled()).toBe(false);
  });

  it("is off when the database URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(testSignInEnabled()).toBe(false);
  });
});
```

Append to `lib/security/staging-guard.test.ts` (inside the existing `describe`):

```ts
  function guard(url: string) {
    return spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { assertStagingTarget } from "./scripts/staging-guard.mjs";
         console.log(assertStagingTarget(${JSON.stringify(url)}));`,
      ],
      { encoding: "utf8", timeout: 30_000, env: { PATH: process.env.PATH ?? "" } },
    );
  }

  it.each([
    ["http://127.0.0.1:54321", "local"],
    ["http://localhost:54321", "local"],
    ["https://orcxtbedkexoclbfgvzd.supabase.co", "staging"],
  ])("allows %s as %s", (url, kind) => {
    const result = guard(url);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(kind);
  });

  it.each([["http://127.0.0.1:9999"], ["https://localhost:54321"], [PRODUCTION_LOOKALIKE]])(
    "refuses %s",
    (url) => {
      const result = guard(url);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("only against the staging database");
    },
  );

  it("allows exactly the local origins that lib/env.ts names", () => {
    const guardSource = readFileSync("scripts/staging-guard.mjs", "utf8");
    const env = readFileSync("lib/env.ts", "utf8");
    const list = /LOCAL_SUPABASE_ORIGINS[^=]*= (\[[^\]]*\])/.exec(env)?.[1];
    expect(list).toBe('["http://127.0.0.1:54321", "http://localhost:54321"]');
    expect(guardSource).toContain(`LOCAL_SUPABASE_ORIGINS = ${list}`);
  });
```

- [ ] **Step 2: Run them and see them fail.**
  Run: `npx vitest run lib/env.test.ts lib/security/staging-guard.test.ts`
  Expected: FAIL (`isTestDatabaseUrl is not a function`; guard prints nothing for local URLs).

- [ ] **Step 3: Implement.** Replace `lib/env.ts` with:

```ts
/**
 * Production means BOTH: the env flag says so AND the database is not the
 * known staging project. Fail-safe: a mis-set NEXT_PUBLIC_APP_ENV=production
 * while still pointed at staging must NOT enable indexing or hide the preview
 * banner (the data would be fictional people). Both vars are NEXT_PUBLIC_*
 * and inlined at build time on server and client alike.
 */
export const STAGING_PROJECT_REF = "orcxtbedkexoclbfgvzd";
/** The throwaway Supabase stack CI starts with `supabase start` (spec 4.1). */
export const LOCAL_SUPABASE_ORIGINS: readonly string[] = ["http://127.0.0.1:54321", "http://localhost:54321"];

export function isProductionEnv(): boolean {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "production") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) return false;
  return !url.includes(STAGING_PROJECT_REF);
}

/** Allow-list of databases that hold only made-up people: staging and the local CI stack. */
export function isTestDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (LOCAL_SUPABASE_ORIGINS.includes(parsed.origin)) return true;
  return parsed.protocol === "https:" && parsed.hostname === `${STAGING_PROJECT_REF}.supabase.co`;
}

/** Preview test sign-in (spec 4.3): never on a production build, only on a test database. */
export function testSignInEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") return false;
  return isTestDatabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}
```

Note: prettier may wrap the `LOCAL_SUPABASE_ORIGINS` line. The guard test reads the array literal from
the source, so after `npm run format` check that the regex still matches, and adjust the test's expected
string to the formatted form if prettier split it.

Replace `scripts/staging-guard.mjs` with:

```js
/**
 * Destructive and probing scripts may only ever touch a test database: the STAGING project or the
 * throwaway local stack CI starts (security audit 2026-10-08, M6; spec 2026-10-08 simpler dev
 * structure 4.1). Allow-list, not deny-list: a missing, mistyped or production URL is refused,
 * whatever NEXT_PUBLIC_APP_ENV says. The refusal names no project ref, so there is nothing to copy
 * into a confirm flag. Keep both constants equal to lib/env.ts (a test checks it).
 */
export const STAGING_PROJECT_REF = "orcxtbedkexoclbfgvzd";
export const LOCAL_SUPABASE_ORIGINS = ["http://127.0.0.1:54321", "http://localhost:54321"];

/** @returns {"staging" | "local"} */
export function assertStagingTarget(url) {
  let parsed = null;
  try {
    parsed = new URL(url ?? "");
  } catch {
    parsed = null;
  }
  if (parsed && LOCAL_SUPABASE_ORIGINS.includes(parsed.origin)) return "local";
  if (parsed && parsed.hostname.split(".")[0] === STAGING_PROJECT_REF) return "staging";
  console.error("Refusing: this script runs only against the staging database.");
  process.exit(1);
}
```

In `scripts/seed-staging.mjs`, replace the `assertStagingTarget(url);` call and the `ref` line:

```js
const target = assertStagingTarget(url);
// ...existing production-flag refusal stays as it is...
const ref = target === "local" ? "local" : new URL(url).hostname.split(".")[0];
```

- [ ] **Step 4: Run the tests and see them pass.**
  Run: `npx vitest run lib/env.test.ts lib/security/staging-guard.test.ts`
  Expected: PASS, including the four pre-existing refusal cases.
- [ ] **Step 5: Run the full unit suite, typecheck, lint, format check.**
  Run: `npm run typecheck && npm run lint && npm run format:check && npm run test`
  Expected: all pass.
- [ ] **Step 6: Commit** (`git commit -F <msg file>`, see memory note on PowerShell): "CI stack: guards
  allow the local Supabase stack, still refuse production".

### Task 3: CI builds and tests against the throwaway stack

**Files:**
- Modify: `.github/workflows/ci.yml`, `lib/ci-workflow.test.ts`, `playwright.config.ts:10-11` (comment only)

**Interfaces:**
- Consumes: `--confirm-ref local` (Task 2); env names confirmed by Task 1.

- [ ] **Step 1: Write the failing test.** Append to `lib/ci-workflow.test.ts`:

```ts
describe("CI runs on a throwaway Supabase stack (spec 2026-10-08 4.1)", () => {
  const workflow = readRepoFile(".github/workflows/ci.yml");

  it("never reads the staging database secrets", () => {
    expect(workflow).not.toContain("STAGING_SUPABASE");
  });

  it("starts a pinned Supabase CLI and seeds the local stack", () => {
    expect(workflow).toMatch(/uses: supabase\/setup-cli@[0-9a-f]{40} # v/);
    expect(workflow).toContain("supabase start");
    expect(workflow).toContain("scripts/seed-staging.mjs --confirm-ref local");
  });

  it("caps the stack start at 10 minutes", () => {
    expect(workflow).toMatch(/run: supabase start[^\n]*\n\s+timeout-minutes: 10\n/);
  });
});
```

- [ ] **Step 2: Run it and see it fail.**
  Run: `npx vitest run lib/ci-workflow.test.ts`
  Expected: FAIL on all three new cases.

- [ ] **Step 3: Implement.** In `.github/workflows/ci.yml`, after the Playwright install step, insert
  (env names as confirmed in Task 1; this form assumes the CLI's `--override-name` output):

```yaml
      - uses: supabase/setup-cli@1dedf2c611547ede7232d26866dd3c56ab903bbb # v1.7.3
        with: { version: 2.109.1 }
      - run: supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta
        timeout-minutes: 10
      - name: Point build and e2e at the throwaway stack
        run: |
          supabase status -o env \
            --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
            --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY \
            --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY \
            | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=' \
            | sed 's/"//g' >> "$GITHUB_ENV"
      - run: node scripts/seed-staging.mjs --confirm-ref local
        env:
          NEXT_PUBLIC_APP_ENV: preview
```

  Remove the three `STAGING_SUPABASE_*` lines from both the `npm run build` and the `npm run e2e` steps
  (the values now come from `$GITHUB_ENV`). Replace the comment block above `npm run e2e` with:

```yaml
      # e2e asserts exact facts about the canonical seed (12 approved delegates, leaderboard
      # order). Every run seeds a fresh throwaway stack, so a mismatch is a real defect, not drift.
```

  In `playwright.config.ts`, change the `workers: 1` comment to
  `// one seeded database per run (per-run users + seed-count assertions) — spec files must never overlap`.

- [ ] **Step 4: Run the test and see it pass.**
  Run: `npx vitest run lib/ci-workflow.test.ts` → PASS.
- [ ] **Step 5: Commit**, then push the PR A branch once and open the PR (title "CI on a throwaway
  database").

### Task 4: First green CI run on the throwaway stack

Unknowns surface only on a real run (local stack differences from hosted staging). Use
superpowers:systematic-debugging for each failure.

- [ ] **Step 1: Read the CI run.** For each failing e2e or build step, find the root cause.
- [ ] **Step 2: Fix in the narrowest place.** Allowed: test helpers, seed script, `supabase/config.toml` auth
  or storage settings for local only. Not allowed: editing an existing migration, weakening an assertion
  to make it pass, skipping a spec. A fix that would need either goes to the owner in chat first.
- [ ] **Step 3: Push fixes batched** (one push per round of fixes, deploy budget).
- [ ] **Step 4: Prove independence.** When green, re-run the workflow once (`gh run rerun <id>`) with no
  code change. Expected: green again.
- [ ] **Step 5: Record** findings and the measured extra minutes in the PR description.

### Task 5: Ship PR A

- [ ] **Step 1:** Whole-branch review (superpowers:requesting-code-review).
- [ ] **Step 2:** Plain-language sign-off note for the owner: nothing visible changes on the site; checks no
  longer depend on staging; evidence = the two green runs. Ask for sign-off in chat.
- [ ] **Step 3:** After sign-off, recheck ADR numbers, merge, confirm `main` CI green and
  `Vercel – georgia-republic` status on the merge commit.
- [ ] **Step 4:** Leave the `STAGING_SUPABASE_*` repository secrets in place until Part D (cheap rollback).

---

## Part B: Preview test sign-in (PR B)

### Task 6: Shared fixture sign-in module

**Files:**
- Create: `lib/fixture-auth.ts`, `lib/fixture-auth.test.ts`
- Modify: `e2e/otp-helpers.ts:45-140`

**Interfaces:**
- Produces:
  - `interface FixtureAuthConfig { url: string; anonKey: string; serviceKey: string }`
  - `FIXTURE_EMAIL_DOMAIN = "@example.invalid"`, `OWNER_SMOKE_PHONES: ReadonlySet<string>`
  - `isFixturePhone(phoneNational: string): boolean` (`/^(55|50)\d{7}$/`, minus owner smoke phones)
  - `fixturePassword(phoneNational: string, serviceKey: string): string` (moved verbatim)
  - `fixtureSessionFor(config: FixtureAuthConfig, phoneNational: string): Promise<Session>`
  - `freshVisitorSession(config: FixtureAuthConfig): Promise<Session>`
  - `resolvePersonaPhone(config: FixtureAuthConfig, persona: "admin" | "delegate" | "member"): Promise<string>`

- [ ] **Step 1: Write the failing tests** in `lib/fixture-auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fixturePassword, isFixturePhone, OWNER_SMOKE_PHONES } from "./fixture-auth";

describe("isFixturePhone", () => {
  it.each(["509000001", "500000001", "550001239"])("accepts seed/e2e phone %s", (phone) => {
    expect(isFixturePhone(phone)).toBe(true);
  });

  it.each(["599123456", "5000000011", "50000001", "", ...OWNER_SMOKE_PHONES])(
    "refuses %s",
    (phone) => {
      expect(isFixturePhone(phone)).toBe(false);
    },
  );
});

describe("fixturePassword", () => {
  it("is stable per phone and key, and differs across phones", () => {
    expect(fixturePassword("509000001", "k")).toBe(fixturePassword("509000001", "k"));
    expect(fixturePassword("509000001", "k")).not.toBe(fixturePassword("509000002", "k"));
    expect(fixturePassword("509000001", "k")).toMatch(/^E2e-[0-9a-f]{32}!Aa1$/);
  });
});
```

- [ ] **Step 2: Run and see it fail.** `npx vitest run lib/fixture-auth.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/fixture-auth.ts`.** Move from `e2e/otp-helpers.ts`, unchanged in behaviour:
  `fixturePassword`, `fixtureUserIdByPhone`, the body of `fixtureSession` (renamed `fixtureSessionFor`,
  taking `config` instead of reading env, and calling `isFixturePhone` instead of the old regex + smoke
  set). Keep every error message text as it is so `e2e/otp-helpers.test.ts` keeps passing. Add:

```ts
import { createHmac, randomUUID } from "node:crypto";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export interface FixtureAuthConfig {
  url: string;
  anonKey: string;
  serviceKey: string;
}

export const FIXTURE_EMAIL_DOMAIN = "@example.invalid";
/** The owner's smoke accounts inside the 55 block (scripts/sweep-staging-e2e.mjs keeps them). */
export const OWNER_SMOKE_PHONES: ReadonlySet<string> = new Set(["551234567", "551234568", "551234569"]);
/** 55 = per-run e2e block; 50 = seed-only block (scripts/seed-staging.mjs phoneFor). */
const FIXTURE_PHONE = /^(55|50)\d{7}$/;

export function isFixturePhone(phoneNational: string): boolean {
  return FIXTURE_PHONE.test(phoneNational) && !OWNER_SMOKE_PHONES.has(phoneNational);
}

function serviceClient(config: FixtureAuthConfig): SupabaseClient {
  return createClient(config.url, config.serviceKey, { auth: { persistSession: false } });
}

function sessionlessClient(config: FixtureAuthConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

/**
 * A brand-new made-up visitor (spec 4.3): Google-provided the same way the e2e Google fixtures are,
 * because registration requires a Google provider assertion. Test databases only; the next reseed
 * removes these accounts.
 */
export async function freshVisitorSession(config: FixtureAuthConfig): Promise<Session> {
  const id = randomUUID();
  const email = `preview-visitor+${id}${FIXTURE_EMAIL_DOMAIN}`;
  const password = fixturePassword(`visitor:${id}`, config.serviceKey);
  const { error: createError } = await serviceClient(config).auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provider: "google", providers: ["google"], preview_visitor: true },
  });
  if (createError) throw new Error(`preview visitor could not be created: ${createError.message}`);
  const { data, error } = await sessionlessClient(config).auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error("preview visitor could not sign in");
  return data.session;
}

const ADMIN_PERSONA_PHONE = "509000001"; // canonical super_admin (scripts/seed-staging.mjs)
const DELEGATE_PERSONA_SLUG = "giorgi-maisuradze"; // first roster entry, always approved

function national(phone: string): string {
  return phone.replace(/^\+?995/, "");
}

export async function resolvePersonaPhone(
  config: FixtureAuthConfig,
  persona: "admin" | "delegate" | "member",
): Promise<string> {
  if (persona === "admin") return ADMIN_PERSONA_PHONE;
  const db = serviceClient(config);
  const { data: delegates, error: delegateError } = await db
    .from("delegates")
    .select("id, slug, status");
  if (delegateError || !delegates) throw new Error("persona lookup: delegates unavailable");
  if (persona === "delegate") {
    const delegate = delegates.find((d) => d.slug === DELEGATE_PERSONA_SLUG && d.status === "approved");
    if (!delegate) throw new Error("persona lookup: seed delegate missing");
    const { data, error } = await db.from("profiles").select("phone").eq("id", delegate.id).single();
    if (error || !data?.phone) throw new Error("persona lookup: seed delegate has no phone");
    return national(data.phone);
  }
  const delegateIds = new Set(delegates.map((d) => d.id));
  const { data: members, error } = await db
    .from("profiles")
    .select("id, phone")
    .eq("status", "active_member")
    .like("phone", "+995500%")
    .order("phone")
    .limit(50);
  if (error || !members) throw new Error("persona lookup: members unavailable");
  const member = members.find((m) => !delegateIds.has(m.id) && m.phone);
  if (!member?.phone) throw new Error("persona lookup: no active seed member");
  return national(member.phone);
}
```

  Then reduce `e2e/otp-helpers.ts` `fixtureSession` to:

```ts
export async function fixtureSession(phoneNational: string): Promise<Session> {
  assertE2eFixtureEnvironment();
  const { url, key: anonKey } = publicSupabaseConfig();
  const { key: serviceKey } = serviceConfig();
  return fixtureSessionFor({ url, anonKey, serviceKey }, phoneNational);
}
```

  and delete the moved helpers and constants from `e2e/otp-helpers.ts` (import what is still needed from
  `@/lib/fixture-auth`; check the e2e tsconfig path alias resolves under Playwright, else use a relative
  import `../lib/fixture-auth`).

- [ ] **Step 4: Run tests.** `npx vitest run lib/fixture-auth.test.ts e2e/otp-helpers.test.ts` → PASS.
- [ ] **Step 5: Full gates.** `npm run typecheck && npm run lint && npm run format:check && npm run test`.
- [ ] **Step 6: Commit** "Shared fixture sign-in module (e2e + preview test sign-in)".

### Task 7: Persona list and the test sign-in server action

**Files:**
- Create: `lib/test-personas.ts`, `app/(public)/login/test-sign-in-actions.ts`,
  `app/(public)/login/test-sign-in-actions.test.ts`

**Interfaces:**
- Consumes: `testSignInEnabled()` (Task 2), `fixtureSessionFor`, `freshVisitorSession`,
  `resolvePersonaPhone` (Task 6), `createServerSupabase()` (`lib/supabase/server.ts`).
- Produces: `TEST_PERSONA_IDS`, `type TestPersona`, `TEST_PERSONAS`; `testSignInAction(formData: FormData): Promise<void>`.

- [ ] **Step 1: Create `lib/test-personas.ts`** (pure data, tested through the action):

```ts
export const TEST_PERSONA_IDS = ["admin", "delegate", "member", "visitor"] as const;
export type TestPersona = (typeof TEST_PERSONA_IDS)[number];

export const TEST_PERSONAS: readonly { id: TestPersona; label: string; landing: string }[] = [
  { id: "admin", label: "ადმინი", landing: "/admin" },
  { id: "delegate", label: "დელეგატი", landing: "/me" },
  { id: "member", label: "წევრი", landing: "/me" },
  { id: "visitor", label: "ახალი მომხმარებელი", landing: "/join" },
];
```

- [ ] **Step 2: Write the failing tests** in `app/(public)/login/test-sign-in-actions.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirectMock(path) }));

const setSessionMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { setSession: setSessionMock } }),
}));

const fixtureSessionForMock = vi.fn();
const freshVisitorSessionMock = vi.fn();
const resolvePersonaPhoneMock = vi.fn();
vi.mock("@/lib/fixture-auth", () => ({
  fixtureSessionFor: (...args: unknown[]) => fixtureSessionForMock(...args),
  freshVisitorSession: (...args: unknown[]) => freshVisitorSessionMock(...args),
  resolvePersonaPhone: (...args: unknown[]) => resolvePersonaPhoneMock(...args),
}));

import { testSignInAction } from "./test-sign-in-actions";

const SESSION = { access_token: "a", refresh_token: "r" };

function form(persona: string): FormData {
  const data = new FormData();
  data.set("persona", persona);
  return data;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
  setSessionMock.mockResolvedValue({ error: null });
  fixtureSessionForMock.mockResolvedValue(SESSION);
  freshVisitorSessionMock.mockResolvedValue(SESSION);
  resolvePersonaPhoneMock.mockResolvedValue("509000001");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("testSignInAction", () => {
  it("signs the admin persona in and lands on /admin", async () => {
    await expect(testSignInAction(form("admin"))).rejects.toThrow("REDIRECT:/admin");
    expect(resolvePersonaPhoneMock).toHaveBeenCalledWith(expect.anything(), "admin");
    expect(fixtureSessionForMock).toHaveBeenCalledWith(
      { url: "https://orcxtbedkexoclbfgvzd.supabase.co", anonKey: "anon", serviceKey: "service" },
      "509000001",
    );
    expect(setSessionMock).toHaveBeenCalledWith(SESSION);
  });

  it("creates a fresh visitor and lands on /join", async () => {
    await expect(testSignInAction(form("visitor"))).rejects.toThrow("REDIRECT:/join");
    expect(freshVisitorSessionMock).toHaveBeenCalledOnce();
    expect(fixtureSessionForMock).not.toHaveBeenCalled();
  });

  it("refuses on the production database without touching any account", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://uorvlshbrlbdnbauxsws.supabase.co");
    await expect(testSignInAction(form("admin"))).rejects.toThrow("REDIRECT:/login");
    expect(resolvePersonaPhoneMock).not.toHaveBeenCalled();
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it("refuses a production build even on a test database", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    await expect(testSignInAction(form("admin"))).rejects.toThrow("REDIRECT:/login");
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown persona", async () => {
    await expect(testSignInAction(form("superuser"))).rejects.toThrow("REDIRECT:/login");
    expect(resolvePersonaPhoneMock).not.toHaveBeenCalled();
  });

  it("reports a failed sign-in instead of throwing", async () => {
    fixtureSessionForMock.mockRejectedValue(new Error("boom"));
    await expect(testSignInAction(form("member"))).rejects.toThrow(
      "REDIRECT:/login?error=test_sign_in",
    );
  });
});
```

- [ ] **Step 3: Run and see it fail.** `npx vitest run "app/(public)/login/test-sign-in-actions.test.ts"` → FAIL.

- [ ] **Step 4: Implement `app/(public)/login/test-sign-in-actions.ts`:**

```ts
"use server";

import { redirect } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { testSignInEnabled } from "@/lib/env";
import {
  fixtureSessionFor,
  freshVisitorSession,
  resolvePersonaPhone,
  type FixtureAuthConfig,
} from "@/lib/fixture-auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { TEST_PERSONA_IDS, TEST_PERSONAS, type TestPersona } from "@/lib/test-personas";

const personaSchema = z.enum(TEST_PERSONA_IDS);

function testDatabaseConfig(): FixtureAuthConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && anonKey && serviceKey ? { url, anonKey, serviceKey } : null;
}

async function sessionFor(config: FixtureAuthConfig, persona: TestPersona): Promise<Session> {
  if (persona === "visitor") return freshVisitorSession(config);
  return fixtureSessionFor(config, await resolvePersonaPhone(config, persona));
}

/** Preview-only one-click sign-in (spec 4.3). The gate here is the security; the hidden panel is UX. */
export async function testSignInAction(formData: FormData): Promise<void> {
  const config = testSignInEnabled() ? testDatabaseConfig() : null;
  const parsed = personaSchema.safeParse(formData.get("persona"));
  if (!config || !parsed.success) redirect("/login");

  let signedIn = false;
  try {
    const session = await sessionFor(config, parsed.data);
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    signedIn = !error;
  } catch {
    signedIn = false;
  }
  if (!signedIn) redirect("/login?error=test_sign_in");
  const landing = TEST_PERSONAS.find((p) => p.id === parsed.data)?.landing ?? "/me";
  redirect(landing);
}
```

  (`redirect` returns `never`, so TypeScript narrows `config` and `parsed` after the first guard; if the
  installed Next types do not narrow, split the guard into two `if` statements.)

- [ ] **Step 5: Run the tests and see them pass**, then the full gates.
- [ ] **Step 6: Commit** "Preview test sign-in: personas and gated server action".

### Task 8: The „სატესტო შესვლა“ panel on /login

**Files:**
- Create: `components/TestSignInPanel.tsx`
- Modify: `app/(public)/login/GoogleLogin.tsx`, `app/(public)/login/page.tsx`
- Test: `app/(public)/login/login.test.tsx`

**Interfaces:**
- Consumes: `TEST_PERSONAS` (Task 7), `testSignInAction` (Task 7), `testSignInEnabled()` (Task 2).
- Produces: `<TestSignInPanel />`; `GoogleLogin` gains optional prop `testSignIn?: boolean` (default `false`).

- [ ] **Step 1: Write the failing tests.** In `login.test.tsx`, add `vi.mock("./test-sign-in-actions", () =>
  ({ testSignInAction: vi.fn() }))` next to the other mocks, then:

```ts
describe("preview test sign-in panel", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("shows one button per persona on a preview pointed at staging", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "google");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
    render(await LoginPage({}));
    expect(screen.getByRole("heading", { name: "სატესტო შესვლა" })).toBeInTheDocument();
    for (const label of ["ადმინი", "დელეგატი", "წევრი", "ახალი მომხმარებელი"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("is absent on the production site", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "google");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://uorvlshbrlbdnbauxsws.supabase.co");
    render(await LoginPage({}));
    expect(screen.queryByRole("heading", { name: "სატესტო შესვლა" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and see it fail.** `npx vitest run "app/(public)/login/login.test.tsx"` → FAIL.

- [ ] **Step 3: Implement.** `components/TestSignInPanel.tsx`:

```tsx
import { testSignInAction } from "@/app/(public)/login/test-sign-in-actions";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TEST_PERSONAS } from "@/lib/test-personas";

/** Preview-only (spec 4.3). Rendered only when testSignInEnabled(); the action re-checks. */
export function TestSignInPanel() {
  return (
    <Card variant="callout" title="სატესტო შესვლა">
      <p className="mb-4 text-sm text-ink">
        მხოლოდ სატესტო ბმულზე: შედი ფიქტიური ანგარიშით, Google-ის გარეშე.
      </p>
      <form action={testSignInAction} className="flex flex-wrap gap-2">
        {TEST_PERSONAS.map((persona) => (
          <Button key={persona.id} type="submit" name="persona" value={persona.id} variant="ghost" size="sm">
            {persona.label}
          </Button>
        ))}
      </form>
    </Card>
  );
}
```

  `Card` renders its `title` as `h3`, which satisfies `getByRole("heading")`. In `GoogleLogin.tsx`, add the
  prop and render the panel after the Google button block; add the error text:

```tsx
const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  oauth_callback: "Google-ით შესვლა ვერ მოხერხდა — სცადეთ თავიდან.",
  account_lookup: "მონაცემების წამოღება ვერ მოხერხდა — სცადეთ თავიდან.",
  test_sign_in: "სატესტო შესვლა ვერ მოხერხდა — სცადეთ თავიდან.",
};

export function GoogleLogin({ error, testSignIn = false }: { error?: string; testSignIn?: boolean }) {
  // ...unchanged up to the Google button block...
        {testSignIn ? <TestSignInPanel /> : null}
```

  In `page.tsx`: `return <GoogleLogin error={...} testSignIn={testSignInEnabled()} />;` with
  `import { testSignInEnabled } from "@/lib/env";`.

  Run `npm run ka:scan` on the new Georgian strings (mixed-script gate) and keep the em dash style used by
  the neighbouring messages. Do not add Georgian quotation marks to any string (quote-transcription hazard).

- [ ] **Step 4: Run tests → PASS**, then full gates.
- [ ] **Step 5: Commit** "Preview test sign-in panel on /login".

### Task 9: e2e journey through every persona

**Files:**
- Create: `e2e/test-sign-in.spec.ts`

- [ ] **Step 1: Write the spec:**

```ts
import { expect, test } from "@playwright/test";

const LANDINGS = [
  ["ადმინი", /\/admin(\/|\?|$)/],
  ["დელეგატი", /\/(me|delegate)(\/|\?|$)/],
  ["წევრი", /\/me(\/|\?|$)/],
  ["ახალი მომხმარებელი", /\/join(\/|\?|$)/],
] as const;

for (const [label, landing] of LANDINGS) {
  test(`preview test sign-in: ${label}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page).toHaveURL(landing, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "სატესტო შესვლა" })).toHaveCount(0);
  });
}
```

  (The last assertion checks the panel is not on the landing page, i.e. the click really signed in and
  moved on.)

- [ ] **Step 2: Run it on the PR B CI run** (no local Docker). Expected: four passes. If the member persona
  lands somewhere unexpected, read `cabinet_state` routing before changing the regex.
- [ ] **Step 3: Commit** "e2e: preview test sign-in personas".

### Task 10: ADR, docs, and the production guard

**Files:**
- Modify: `DECISIONS.md` (append ADR), `README.md` (environments section)

- [ ] **Step 1:** Append ADR "Simpler development structure" covering: CI on a throwaway stack, previews on
  the real project, preview test sign-in and its database allow-list gate, staging made-up only, demo
  retirement, branching rejected and why. Number = next free on `main` at merge time.
- [ ] **Step 2:** README: replace the demo-site and staging-for-CI descriptions with the new picture.
- [ ] **Step 3:** Whole-branch review, then push PR B (one push).
- [ ] **Step 4: Owner sign-off on the PR B preview.** Until Part C, previews still come from the demo
  project, which is connected to staging with `NEXT_PUBLIC_APP_ENV=preview`, so the panel works there.
  Evidence for the owner: screenshots of the panel and of each landing page, plus the preview link.
- [ ] **Step 5:** After sign-off: merge, then check `https://respublika.ge/login` contains no
  „სატესტო შესვლა“ (`curl -s https://respublika.ge/login | grep -c "სატესტო შესვლა"` → `0`).

---

## Part C: Previews on the real project (dashboard work, no PR)

### Task 11: Preview settings on the real Vercel project

- [ ] **Step 1: Plain settings.** Add to `georgia-republic`, scope Preview only:
  `NEXT_PUBLIC_APP_ENV=preview`, `PHONE_VERIFICATION_PROVIDER=test`, `NEXT_PUBLIC_AUTH_MODE=google`,
  `NEXT_PUBLIC_SUPABASE_URL=https://orcxtbedkexoclbfgvzd.supabase.co` (not secret). Try
  `vercel env add <NAME> preview --scope durumakh-1974s-projects` with `VERCEL_PROJECT_ID` set to the real
  project. If the permission check blocks it, explain in chat and ask how to proceed.
- [ ] **Step 2: Secret settings (owner, guided in chat).** `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY` for staging, Preview scope only, on `georgia-republic`. Claude does not see or
  type these. Give the owner click-by-click directions (Supabase Duru → republic-portal-staging → API keys →
  copy; Vercel → georgia-republic → Settings → Environment Variables → Add, tick only Preview).
- [ ] **Step 3: Verify names and scopes only** (never values) via `vercel api /v9/projects/<id>` filtered to
  `key` + `target`. Expected: the six Preview entries above, Production entries unchanged.
- [ ] **Step 4: Remove the Ignored Build Step**:
  `vercel api -X PATCH /v9/projects/prj_pC1U9QvrAQgLpGs2V1nrlsm02ciV -F commandForIgnoringBuildStep=null`
  (confirm the field reads back `null`).
- [ ] **Step 5: Prove it** with the next real PR push (do not push a throwaway branch just for this):
  the `georgia-republic` preview builds, shows the preview banner, its `/login` shows the panel, and its
  pages read staging data (12 approved delegates on the leaderboard), read with `vercel curl` because
  Vercel Authentication protects previews. Then the owner opens the link once (signs in to Vercel once in
  their browser) and confirms in chat.

---

## Part D: Staging cleanup and demo retirement (each after the owner's yes)

### Task 12: Staging holds made-up people only

- [ ] **Step 1:** Ask the owner in chat: "May I remove your real account and your three smoke accounts from
  the test database and refresh it?" Wait for an explicit yes.
- [ ] **Step 2:** Reseed staging: `node --env-file=.env.local scripts/seed-staging.mjs --confirm-ref
  orcxtbedkexoclbfgvzd` (staging-only by guard). The seed keeps audit-log actors; if the owner's account
  is one, it survives the reseed. Then report that in chat and decide with the owner (no ad hoc SQL).
- [ ] **Step 3:** Sweep owner smoke phones: `node --env-file=.env.local scripts/sweep-staging-e2e.mjs --apply`
  only after checking in its source that it now removes the smoke phones; if it still keeps them by design,
  leave them and report.
- [ ] **Step 4:** Verify on a preview: test sign-in still works for all four personas.
- [ ] **Step 5:** Update Claude memory: retire `staging-owner-account.md`'s "never reseed" rule.

### Task 13: Retire the demo project

- [ ] **Step 1:** Ask the owner in chat, naming exactly what goes: Vercel project `republic-portal` and its
  domains (`republic-portal.vercel.app`, `republic-portal-x44e.vercel.app` if attached there), GitHub
  deployment environments `Preview – republic-portal`, `Production – republic-portal`,
  `Production – republic-portal-x44e`, `Preview`, `Production` (only those whose deployments came from the
  demo project, check first), the `STAGING_SUPABASE_*` repository secrets (CI no longer reads them), and the
  local `.vercel/project.json` link in the main checkout. Wait for an explicit yes.
- [ ] **Step 2:** Before deleting, confirm `republic-portal-x44e.vercel.app` is an alias of the REAL project
  (memory: it is an old name of `georgia-republic`) and is NOT deleted.
- [ ] **Step 3:** Delete the Vercel project (`vercel project rm republic-portal`); if the permission check
  blocks it, it is one click for the owner (Vercel → republic-portal → Settings → Delete Project).
- [ ] **Step 4:** Delete the listed GitHub environments and secrets with `gh api -X DELETE` /
  `gh secret delete`, then remove `.vercel/` from the main checkout.
- [ ] **Step 5:** Prove it: the next PR push creates exactly one Vercel deployment (GitHub statuses on the
  head commit show only `Vercel – georgia-republic`).
- [ ] **Step 6:** Update memory (`real-production-site.md`, `respublika-ge-domain.md`) and README.
