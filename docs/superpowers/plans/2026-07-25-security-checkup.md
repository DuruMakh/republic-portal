# Security Check-up Implementation Plan (v0.10.0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Examine all 154 live authorization surfaces from all 12 actor positions, prove every candidate hole against a running system, close every confirmed one, and ship the result as v0.10.0.

**Architecture:** A purpose-built audit instrument precedes the audit itself. Pure decision logic (verdicts, expectation rules, manifest shape) lives in `lib/security/` where the existing vitest runner unit-tests it with no network. The live probing lives in `scripts/security/*.mjs`, invoked explicitly by npm scripts and **never wired into CI** — it needs service credentials, hits staging, and deliberately creates junk. Audit artifacts accumulate as committed markdown and JSON under `docs/security/`, so every pass leaves an auditable trail rather than living in a session transcript.

**Tech Stack:** Node ESM scripts (`.mjs`) matching `scripts/verify-schema.mjs` and `scripts/seed-staging.mjs`; TypeScript strict for `lib/security/`; vitest for unit tests; `@supabase/supabase-js` for direct PostgREST probing; Playwright only where an app-layer surface genuinely requires a browser. Zero new dependencies — nothing here needs a DECISIONS.md dependency entry.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-25-security-checkup-design.md`. Every decision D1–D8 in its §1 binds every task below.
- **Baseline:** `main` at v0.9.0 (`46e7a90`). Release target v0.10.0.
- **Nothing is a finding until reproduced against a running system.** Unreproduced candidates are discarded with their disproof recorded — never fixed.
- **Every fix is test-first:** a test that performs the attack and fails, then the repair, then it passes. A fix with no reproducing test is not a fix.
- **Database changes go in new migrations only.** Never edit an applied migration; add a follow-up.
- **TypeScript strict. No `any`, no `@ts-ignore`.** Applies to everything under `lib/security/`.
- **Admin mutations must continue to write to `audit_log`.** Any fix touching an admin path preserves this.
- **A Critical finding is fixed immediately, out of band** (D5), not queued behind the remaining passes.
- **Fixes that remove a capability a real person has today are surfaced to the owner before shipping** (D7), described as who loses what.
- **A hole that cannot be closed without a redesign is escalated to the owner** (D8), never silently deferred.
- **Live probing never enters CI.** No `security:*` npm script may be referenced from `.github/workflows/`.
- **Run `npm run format` before every commit** — `format:check` fails CI on unformatted files.
- **Georgian text is byte-spliced from source, never hand-typed.** Run `node scripts/ka-gate.mjs --diff main <files>` before any commit touching Georgian.
- **Pace against the SMS throttle:** more than ~2 full e2e passes per hour exhausts the canonical admin phone's send cap. Actor sessions are minted **once per run** and reused across all probes.
- **Staging env is loaded from `.env.local`**, which Playwright does not read — parse it into the shell environment first (see Task 1, Step 6).

## File Structure

| File | Responsibility |
|---|---|
| `lib/security/types.ts` | Shared types: `ActorId`, `SurfaceKind`, `Surface`, `Expectation`, `Verdict`, `ProbeOutcome`, `LedgerRow`. No logic. |
| `lib/security/verdict.ts` | Pure: `(expectation, outcome) → Verdict`. The single place a probe result becomes a judgement. |
| `lib/security/expectations.ts` | Pure: `defaultExpectation(surface, actor)` encoding the naming-convention rules, plus the explicit-override table and `isRuleDerived()`. |
| `lib/security/manifest.ts` | Pure: manifest parsing, counting, and `reconcile(manifest, introspected)` returning added/removed/unchanged. |
| `scripts/security/manifest.json` | The committed 154-row surface inventory. Data, not code. |
| `scripts/security/introspect.mjs` | Regenerates the manifest from the live database and fails loudly on drift. |
| `scripts/security/actors.mjs` | Provisions the 12 actor fixtures and mints one cached session each. |
| `scripts/security/arguments.mjs` | Per-function valid arguments and the per-probe disposable-target `setup()` that keeps mutating probes isolated. |
| `scripts/security/probe.mjs` | The matrix runner: every applicable (surface, actor) pair, recording rather than throwing. |
| `docs/security/threat-model.md` | Pass 1 artifact. |
| `docs/security/coverage.md` | Pass 2 artifact — the human-readable coverage table. |
| `docs/security/ledger.json` | Machine-readable probe results, regenerated per run. |
| `docs/security/findings.md` | Passes 3–4 artifact: confirmed findings and recorded disproofs. |
| `docs/security/residue.json` | Every row the probes minted or mutated, appended live by the runner. |
| `docs/security/residue.md` | What survived the reseed and why it could not be removed. |
| `docs/security/report.md` | The owner-facing plain-language report. |

**Census coverage adds up to all 154 surfaces, with no orphans:** Task 6 takes 58 (24 views, 16 tables, 10 policies, 8 triggers), Task 7 takes 58 (52 definer functions, 6 helpers), Task 8 takes 38 (35 actions, 1 endpoint, 2 buckets). Any future edit to the task boundaries must preserve this sum — spec §7 makes a verdict for every surface an exit criterion.

---

### Task 1: Actor fixtures and session minting

**Files:**

- Create: `scripts/security/actors.mjs`
- Test: manual verification via the script's own `--verify` mode (live credentials required; no unit test — this file is entirely network I/O)

**Interfaces:**

- Consumes: `.env.local` staging credentials; the canonical staging admin phones `+995509000001..4`.
- Produces, all exported from `scripts/security/actors.mjs`:
  - `ACTORS` — the actor definition table, keyed by `ActorId`.
  - `ACTOR_IDS` — `Object.keys(ACTORS)`, the canonical iteration order used by Task 4's matrix loop.
  - `provisionActors()` → `Promise<Record<ActorId, {phone: string|null, userId: string|null, accessToken: string|null}>>`. A1 is the all-null entry (anonymous).
  - `actorClient(accessToken)` → a `SupabaseClient` bound to that JWT; passing `null` returns the plain anon client, which is exactly what A1 requires.
  - `db` — the service-role client, for fixture provisioning and inbox reads only. **Never used as a probe actor**: it bypasses every check by design and would report everything as reachable.

`ActorId` is one of `A1`…`A12` exactly as defined in spec §2.1.

**Design notes for the implementer:**

Sessions are minted the way an attacker's own client would: `signInWithOtp` on the anon key, read the code from `dev_otp_inbox` with the service client, `verifyOtp`, keep the `access_token`. Probing then goes **straight to PostgREST with that token**, bypassing the app entirely — which is the correct threat perspective, because an attacker does not use our UI.

Mint **once per run** and cache. The OTP throttle is per-phone (~60s), so minting the twelve in parallel is safe; minting one phone twice in a minute is not.

`A1` (anonymous) needs no session — it is the bare anon key. `A2` (signed in, no profile row) is created through the admin API and deliberately given **no** `profiles` row.

- [ ] **Step 1: Create the actor definition table**

```javascript
// scripts/security/actors.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error("security probing needs NEXT_PUBLIC_SUPABASE_URL, ANON_KEY and SERVICE_ROLE_KEY");
}

export const db = createClient(url, serviceKey, { auth: { persistSession: false } });
export const anonClient = () => createClient(url, anonKey, { auth: { persistSession: false } });

/** Phones reserved for the audit. +995509001xxx sits outside the seed's +99550XXXXXXX roster. */
export const ACTORS = {
  A1: { label: "anonymous", phone: null, standing: null },
  A2: { label: "signed in, no profile", phone: "509001002", standing: null },
  A3: { label: "registered", phone: "509001003", standing: "registered" },
  A4: { label: "profile_completed", phone: "509001004", standing: "profile_completed" },
  A5: { label: "active_member", phone: "509001005", standing: "active_member" },
  A6: { label: "pending delegate", phone: "509001006", standing: "active_member", delegate: "pending" },
  A7: { label: "approved delegate", phone: "509001007", standing: "active_member", delegate: "approved" },
  A8: { label: "rejected delegate", phone: "509001008", standing: "active_member", delegate: "rejected" },
  A9: { label: "super_admin", phone: "509000001", standing: "active_member", role: "super_admin" },
  A10: { label: "verifier", phone: "509000002", standing: "active_member", role: "verifier" },
  A11: { label: "finance", phone: "509000003", standing: "active_member", role: "finance" },
  A12: { label: "editor", phone: "509000004", standing: "active_member", role: "editor" },
};

/** Canonical iteration order for the probe matrix. */
export const ACTOR_IDS = Object.keys(ACTORS);
```

**Before writing these phone numbers, verify they are free.** `+995509001xxx` was chosen to sit outside the seed's roster range, but confirm with a service-client query against `auth.users` and `profiles`; if any collide, shift the block and record the new range in the completion note. Colliding with a seeded member would corrupt the seed's exact-count self-checks at Task 13.

- [ ] **Step 2: Write the fixture provisioner**

A1 and A9–A12 already exist on staging (anon needs nothing; the four admins are canonical). A2–A8 must be created idempotently, and every audit-created user is tagged so the end-of-phase reseed can sweep it.

```javascript
const AUDIT_TAG = "security-audit-2026-07";

async function findUserByPhone(phone) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.phone === `995${phone}`);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
}

async function ensureUser(phone) {
  const existing = await findUserByPhone(phone);
  if (existing) return existing;
  const { data, error } = await db.auth.admin.createUser({
    phone: `995${phone}`,
    phone_confirm: true,
    user_metadata: { audit_tag: AUDIT_TAG },
  });
  if (error) throw error;
  return data.user;
}
```

- [ ] **Step 3: Write the session minter**

```javascript
import { readFreshInboxOtp } from "./otp.mjs";

async function mintSession(phone) {
  const client = anonClient();
  const sentAt = Date.now() - 2000;
  const { error: sendError } = await client.auth.signInWithOtp({ phone: `+995${phone}` });
  if (sendError) throw new Error(`OTP send failed for ${phone}: ${sendError.message}`);
  const token = await readFreshInboxOtp(phone, sentAt);
  const { data, error } = await client.auth.verifyOtp({
    phone: `+995${phone}`,
    token,
    type: "sms",
  });
  if (error) throw new Error(`OTP verify failed for ${phone}: ${error.message}`);
  if (!data.session) throw new Error(`no session returned for ${phone}`);
  return data.session.access_token;
}

export function actorClient(accessToken) {
  if (!accessToken) return anonClient();
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
```

- [ ] **Step 4: Port the inbox poller**

`readFreshInboxOtp` already exists at `e2e/otp-helpers.ts:38` but that file is TypeScript imported by Playwright. Copy the idiom into `scripts/security/otp.mjs` as ESM JavaScript rather than importing across the boundary — this is the fourth home for the loop, and consolidating all four is explicitly **out of scope** for this phase (it is a tidy-up already carried in the ledger, not a security matter).

```javascript
// scripts/security/otp.mjs
import { db } from "./actors.mjs";

export async function readFreshInboxOtp(phoneNational, sentAt) {
  const forms = [`+995${phoneNational}`, `995${phoneNational}`];
  for (let i = 0; i < 20; i++) {
    const { data } = await db
      .from("dev_otp_inbox")
      .select("otp, created_at")
      .in("phone", forms)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (row && new Date(row.created_at).getTime() >= sentAt) return row.otp;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no fresh OTP in dev_otp_inbox for ${phoneNational}`);
}
```

- [ ] **Step 5: Wire `provisionActors()` and a `--verify` mode**

`--verify` mints every session and prints one line per actor confirming the JWT resolves to the expected user id and the expected standing, then exits non-zero if any actor failed. This is the acceptance test for the task.

```javascript
export async function provisionActors() {
  const out = {};
  await Promise.all(
    Object.entries(ACTORS).map(async ([id, def]) => {
      if (!def.phone) {
        out[id] = { phone: null, userId: null, accessToken: null };
        return;
      }
      const user = await ensureUser(def.phone);
      out[id] = { phone: def.phone, userId: user.id, accessToken: await mintSession(def.phone) };
    }),
  );
  return out;
}

if (process.argv.includes("--verify")) {
  const actors = await provisionActors();
  let failed = 0;
  for (const [id, a] of Object.entries(actors)) {
    const { data } = await actorClient(a.accessToken).auth.getUser();
    const ok = a.accessToken ? data.user?.id === a.userId : true;
    if (!ok) failed++;
    console.log(`${ok ? "OK " : "FAIL"} ${id} ${ACTORS[id].label} ${a.userId ?? "(anon)"}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}
```

- [ ] **Step 6: Run it against staging**

```bash
node --env-file=.env.local scripts/security/actors.mjs --verify
```

Expected: twelve `OK` lines, exit 0. If a phone throttles, the error names the phone — wait 60s and rerun rather than adding retries.

- [ ] **Step 7: Add the npm script**

Add to `package.json` scripts, between `seed:staging` and the end of the block:

```json
"security:actors": "node --env-file=.env.local scripts/security/actors.mjs --verify"
```

- [ ] **Step 8: Commit**

```bash
npm run format
git add scripts/security/actors.mjs scripts/security/otp.mjs package.json
git commit -m "feat(security): 12-actor fixture provisioning and session minting"
```

---

### Task 2: Verdict logic and expectation rules

**Files:**

- Create: `lib/security/types.ts`, `lib/security/verdict.ts`, `lib/security/expectations.ts`
- Test: `lib/security/verdict.test.ts`, `lib/security/expectations.test.ts`

**Interfaces:**

- Consumes: nothing — pure, no imports outside the repo's own types.
- Produces: `judge(expectation: Expectation, outcome: ProbeOutcome, kind: SurfaceKind): Verdict`; `defaultExpectation(surface: Surface, actor: ActorId): Expectation`; `isRuleDerived(surface: Surface, actor: ActorId): boolean`. Task 4's judging step calls `judge` — it must pass the surface's `kind`, looked up from the manifest by `surfaceId`, because the same outcome means different things for a read and a call. Task 3's manifest builder calls `defaultExpectation`.

**Design notes for the implementer:**

This is the honesty core of the whole audit, and it is the only part with real unit tests, so get it exactly right.

Two Postgres error codes mean "correctly denied": `42501` (insufficient privilege) and `42883` (undefined function). PostgREST additionally returns `PGRST202` when a function is absent from the schema cache. **Anything else is not a denial** — it is an unexpected outcome and must resolve to `needs-live-proof`, never quietly to `clear`. A validation error, for instance, proves the caller got *past* the grant.

The subtle case: expectation `deny`, no error, zero rows. That is **not** proof of safety — the grant exists and the filter merely happened to match nothing for this actor's data. It resolves to `needs-live-proof`, which Pass 4 settles by giving the actor data that *should* match.

`isRuleDerived` matters because the census must not launder its own assumptions: any expectation produced by naming convention rather than stated explicitly is flagged, and Task 9's sweep treats that flag as a hunting ground.

- [ ] **Step 1: Write the types**

```typescript
// lib/security/types.ts
export type ActorId = `A${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`;

export type SurfaceKind =
  | "function"
  | "view"
  | "table"
  | "policy"
  | "trigger"
  | "action"
  | "endpoint"
  | "bucket";

export type Expectation = "allow" | "deny";
export type Verdict = "clear" | "finding" | "needs-live-proof";

export interface Surface {
  readonly id: string;
  readonly kind: SurfaceKind;
  readonly name: string;
  readonly layer: "db" | "app";
  readonly overrides?: Readonly<Partial<Record<ActorId, Expectation>>>;
}

export interface ProbeOutcome {
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly rowCount: number;
}

export interface LedgerRow {
  readonly surfaceId: string;
  readonly actor: ActorId;
  readonly expectation: Expectation;
  readonly ruleDerived: boolean;
  readonly outcome: ProbeOutcome;
  readonly verdict: Verdict;
}
```

- [ ] **Step 2: Write the failing verdict tests**

```typescript
// lib/security/verdict.test.ts
import { describe, expect, it } from "vitest";
import { judge } from "./verdict";
import type { ProbeOutcome } from "./types";

const outcome = (o: Partial<ProbeOutcome> = {}): ProbeOutcome => ({
  errorCode: null,
  errorMessage: null,
  rowCount: 0,
  ...o,
});

describe("judge — reads (view, table)", () => {
  it("clears a denial that returns 42501", () => {
    expect(judge("deny", outcome({ errorCode: "42501" }), "view")).toBe("clear");
  });

  it("clears a denial that returns 42883", () => {
    expect(judge("deny", outcome({ errorCode: "42883" }), "view")).toBe("clear");
  });

  it("clears a denial that returns PGRST202", () => {
    expect(judge("deny", outcome({ errorCode: "PGRST202" }), "view")).toBe("clear");
  });

  it("flags a leak when a denial returns rows", () => {
    expect(judge("deny", outcome({ rowCount: 3 }), "view")).toBe("finding");
  });

  it("does NOT clear a read denial that merely returned zero rows", () => {
    expect(judge("deny", outcome({ rowCount: 0 }), "view")).toBe("needs-live-proof");
  });

  it("does NOT treat a validation error as a denial", () => {
    expect(judge("deny", outcome({ errorCode: "22023", errorMessage: "invalid_tier" }), "view")).toBe(
      "needs-live-proof",
    );
  });

  it("clears an allow that succeeds", () => {
    expect(judge("allow", outcome({ rowCount: 5 }), "view")).toBe("clear");
  });

  it("flags an allow that is denied", () => {
    expect(judge("allow", outcome({ errorCode: "42501" }), "view")).toBe("finding");
  });

  it("defers an allow that errors unexpectedly", () => {
    expect(judge("allow", outcome({ errorCode: "22023" }), "view")).toBe("needs-live-proof");
  });

  it("does NOT call a missing-function error a finding — that is a probe defect", () => {
    expect(judge("allow", outcome({ errorCode: "PGRST202" }), "view")).toBe("needs-live-proof");
    expect(judge("allow", outcome({ errorCode: "42883" }), "view")).toBe("needs-live-proof");
  });
});

describe("judge — invocations (function, action, endpoint)", () => {
  // The critical case. Most definer functions return nothing: they DO something.
  // A successful unauthorized call and a correctly-blocked one both come back
  // with no error and no rows, so the read rule above would file the single most
  // dangerous class of hole as merely inconclusive. For an invocation, the
  // absence of an error IS the proof that the caller got through.
  it("flags a denied function that executed without error, even returning nothing", () => {
    expect(judge("deny", outcome({ rowCount: 0 }), "function")).toBe("finding");
  });

  it("flags a denied action that executed without error", () => {
    expect(judge("deny", outcome({ rowCount: 0 }), "action")).toBe("finding");
  });

  it("flags a denied endpoint that responded without error", () => {
    expect(judge("deny", outcome({ rowCount: 0 }), "endpoint")).toBe("finding");
  });

  it("still clears a function that was properly refused", () => {
    expect(judge("deny", outcome({ errorCode: "42501" }), "function")).toBe("clear");
  });

  it("still defers a function whose arguments were wrong", () => {
    expect(judge("deny", outcome({ errorCode: "PGRST202" }), "function")).toBe("clear");
    expect(judge("allow", outcome({ errorCode: "PGRST202" }), "function")).toBe("needs-live-proof");
  });

  it("clears an allowed function that executed", () => {
    expect(judge("allow", outcome({ rowCount: 0 }), "function")).toBe("clear");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npx vitest run lib/security/verdict.test.ts
```

Expected: FAIL — `Failed to resolve import "./verdict"`.

- [ ] **Step 4: Implement `judge`**

```typescript
// lib/security/verdict.ts
import type { Expectation, ProbeOutcome, SurfaceKind, Verdict } from "./types";

/**
 * Codes that mean "the caller was turned away". 42501 is a true authorization
 * denial; 42883/PGRST202 mean the function or its signature was not found,
 * which on the deny side is equally conclusive (nothing was reachable) but on
 * the allow side means OUR probe was malformed, not that the app is broken.
 */
const DENIED_BY_PRIVILEGE = "42501";
const NOT_FOUND_CODES = new Set(["42883", "PGRST202"]);

/**
 * Surfaces you CALL, as opposed to surfaces you READ. The distinction decides
 * what "no error, no rows" means, and it is the difference between finding a
 * privilege-escalation hole and filing it as inconclusive.
 */
const INVOCATION_KINDS = new Set<SurfaceKind>(["function", "action", "endpoint"]);

export function judge(
  expectation: Expectation,
  outcome: ProbeOutcome,
  kind: SurfaceKind,
): Verdict {
  const { errorCode, rowCount } = outcome;

  if (expectation === "deny") {
    if (errorCode !== null) {
      return errorCode === DENIED_BY_PRIVILEGE || NOT_FOUND_CODES.has(errorCode)
        ? "clear"
        : "needs-live-proof";
    }
    // No error means the grant exists and the caller got through.
    //
    // For an INVOCATION that is the whole story: most definer functions return
    // nothing — they record a payment, approve a delegate, close a poll. If the
    // call completed, the actor performed the act. Waiting for a returned row
    // before calling that a finding would bury the most dangerous class of hole
    // in the inconclusive pile.
    //
    // For a READ, zero rows is genuinely ambiguous: the filter may simply have
    // matched nothing for this actor's data. Pass 4 settles it by giving the
    // actor data that should match (Task 6, Step 2).
    if (INVOCATION_KINDS.has(kind)) return "finding";
    return rowCount > 0 ? "finding" : "needs-live-proof";
  }

  if (errorCode === null) return "clear";
  // Only a privilege denial is a real over-restriction finding. A missing
  // function or argument mismatch is a defect in the probe's argument table
  // (Task 7) and must never be reported to the owner as a security finding.
  return errorCode === DENIED_BY_PRIVILEGE ? "finding" : "needs-live-proof";
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run lib/security/verdict.test.ts
```

Expected: PASS, 16 tests across both describes.

- [ ] **Step 6: Write the failing expectation-rule tests**

```typescript
// lib/security/expectations.test.ts
import { describe, expect, it } from "vitest";
import { defaultExpectation, isRuleDerived } from "./expectations";
import type { Surface } from "./types";

const fn = (name: string, overrides?: Surface["overrides"]): Surface => ({
  id: `fn:${name}`,
  kind: "function",
  name,
  layer: "db",
  overrides,
});

describe("defaultExpectation", () => {
  it("denies admin_ functions to every non-admin actor", () => {
    for (const actor of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"] as const) {
      expect(defaultExpectation(fn("admin_record_payment"), actor)).toBe("deny");
    }
  });

  it("allows admin_ functions to super_admin", () => {
    expect(defaultExpectation(fn("admin_record_payment"), "A9")).toBe("allow");
  });

  it("denies a finance function to the editor role", () => {
    expect(defaultExpectation(fn("admin_record_payment"), "A12")).toBe("deny");
  });

  it("denies everything to the anonymous actor by default", () => {
    expect(defaultExpectation(fn("member_change_tier"), "A1")).toBe("deny");
  });

  it("honours an explicit override above the rule", () => {
    const surface = fn("member_change_tier", { A1: "allow" });
    expect(defaultExpectation(surface, "A1")).toBe("allow");
  });
});

describe("isRuleDerived", () => {
  it("is true when no override covers the actor", () => {
    expect(isRuleDerived(fn("member_change_tier"), "A3")).toBe(true);
  });

  it("is false when an override states the expectation explicitly", () => {
    expect(isRuleDerived(fn("member_change_tier", { A3: "deny" }), "A3")).toBe(false);
  });
});
```

- [ ] **Step 7: Run to verify failure**

```bash
npx vitest run lib/security/expectations.test.ts
```

Expected: FAIL — `Failed to resolve import "./expectations"`.

- [ ] **Step 8: Implement the expectation rules**

The role-to-prefix map below is derived from `supabase/migrations/20260717150000_admin_crm.sql`. Read that file and confirm each mapping before writing it down; if the migration disagrees with this table, **the migration wins and the plan is wrong** — record the correction in the task's completion note.

```typescript
// lib/security/expectations.ts
import type { ActorId, Expectation, Surface } from "./types";

const ADMIN_ACTORS: readonly ActorId[] = ["A9", "A10", "A11", "A12"];

/** Which admin roles may reach which admin_ function families. super_admin reaches all. */
const ROLE_FAMILIES: Readonly<Record<ActorId, readonly string[]>> = {
  A9: ["admin_"],
  A10: ["admin_approve_delegate", "admin_reject_delegate", "admin_reveal_"],
  A11: ["admin_record_payment", "admin_record_payments_bulk", "admin_reassign_member"],
  A12: [
    "admin_publish_news",
    "admin_delete_news",
    "admin_save_news",
    "admin_publish_event",
    "admin_cancel_event",
    "admin_delete_event",
    "admin_save_event",
    "admin_open_poll",
    "admin_close_poll",
    "admin_delete_poll",
    "admin_save_poll",
  ],
  A1: [],
  A2: [],
  A3: [],
  A4: [],
  A5: [],
  A6: [],
  A7: [],
  A8: [],
};

export function isRuleDerived(surface: Surface, actor: ActorId): boolean {
  return surface.overrides?.[actor] === undefined;
}

export function defaultExpectation(surface: Surface, actor: ActorId): Expectation {
  const override = surface.overrides?.[actor];
  if (override !== undefined) return override;

  if (surface.name.startsWith("admin_")) {
    if (!ADMIN_ACTORS.includes(actor)) return "deny";
    return ROLE_FAMILIES[actor].some((prefix) => surface.name.startsWith(prefix))
      ? "allow"
      : "deny";
  }

  if (surface.name.startsWith("public_")) return "allow";

  // Everything else is member/delegate machinery. The rule cannot know which
  // standings may reach it, so it fails CLOSED: every such pair is reported as
  // rule-derived, and Tasks 6 and 7 must replace it with a stated expectation
  // read from the migration. A "deny" here is a placeholder, not a judgement.
  return "deny";
}
```

- [ ] **Step 9: Run to verify pass**

```bash
npx vitest run lib/security/expectations.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 10: Verify the whole suite and types still pass**

```bash
npm run typecheck && npm test
```

Expected: typecheck clean; the full unit suite green with 23 new tests added to the existing count.

- [ ] **Step 11: Commit**

```bash
npm run format
git add lib/security/
git commit -m "feat(security): verdict logic and expectation rules with unit tests"
```

---

### Task 3: Surface manifest and live introspection

**Files:**

- Create: `lib/security/manifest.ts`, `lib/security/manifest.test.ts`, `scripts/security/introspect.mjs`, `scripts/security/manifest.json`
- Modify: `package.json` (add `security:introspect`)

**Interfaces:**

- Consumes: `Surface`, `SurfaceKind` from `lib/security/types.ts`.
- Produces: `reconcile(manifest: Surface[], live: {kind: SurfaceKind, name: string}[])` → `{added: string[], removed: string[], unchanged: number}`; `scripts/security/manifest.json` as the committed inventory consumed by Task 4.

**Design notes for the implementer:**

The manifest must be **generated from the live database, not typed from the spec**. The spec's counts (52 functions, 24 views, 16 tables, 10 policies, 8 triggers) were themselves derived by grepping migrations, and grep over migrations double-counts re-creations. Introspection is the authority. If introspection disagrees with the spec's numbers, **introspection wins** — update the spec's §2 table in the same commit and note it in the task's completion note.

The app-layer surfaces (35 actions, 1 endpoint, 2 buckets) cannot be introspected from the database; they are enumerated from source and hand-added to the manifest, and the reconciler ignores them.

- [ ] **Step 1: Write the failing reconciler test**

```typescript
// lib/security/manifest.test.ts
import { describe, expect, it } from "vitest";
import { reconcile } from "./manifest";
import type { Surface } from "./types";

const surface = (kind: Surface["kind"], name: string): Surface => ({
  id: `${kind}:${name}`,
  kind,
  name,
  layer: "db",
});

describe("reconcile", () => {
  it("reports a live object missing from the manifest as added", () => {
    const result = reconcile([], [{ kind: "function", name: "admin_new_thing" }]);
    expect(result.added).toEqual(["function:admin_new_thing"]);
    expect(result.removed).toEqual([]);
  });

  it("reports a manifest entry absent from the database as removed", () => {
    const result = reconcile([surface("view", "gone_view")], []);
    expect(result.removed).toEqual(["view:gone_view"]);
    expect(result.added).toEqual([]);
  });

  it("counts matches as unchanged", () => {
    const result = reconcile(
      [surface("function", "register")],
      [{ kind: "function", name: "register" }],
    );
    expect(result.unchanged).toBe(1);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("ignores app-layer manifest entries during reconciliation", () => {
    const action: Surface = {
      id: "action:submitJoin",
      kind: "action",
      name: "submitJoin",
      layer: "app",
    };
    const result = reconcile([action], []);
    expect(result.removed).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run lib/security/manifest.test.ts
```

Expected: FAIL — `Failed to resolve import "./manifest"`.

- [ ] **Step 3: Implement the reconciler**

```typescript
// lib/security/manifest.ts
import type { Surface, SurfaceKind } from "./types";

export interface LiveObject {
  readonly kind: SurfaceKind;
  readonly name: string;
}

export interface Reconciliation {
  readonly added: string[];
  readonly removed: string[];
  readonly unchanged: number;
}

export function reconcile(manifest: readonly Surface[], live: readonly LiveObject[]): Reconciliation {
  const dbEntries = manifest.filter((s) => s.layer === "db");
  const manifestIds = new Set(dbEntries.map((s) => s.id));
  const liveIds = new Set(live.map((o) => `${o.kind}:${o.name}`));

  return {
    added: [...liveIds].filter((id) => !manifestIds.has(id)).sort(),
    removed: [...manifestIds].filter((id) => !liveIds.has(id)).sort(),
    unchanged: [...manifestIds].filter((id) => liveIds.has(id)).length,
  };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npx vitest run lib/security/manifest.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Write the introspection script**

Query the catalog for the real inventory. `prosecdef` marks `security definer`.

```javascript
// scripts/security/introspect.mjs
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { db } from "./actors.mjs";

const SQL = `
select 'function' as kind, p.proname as name, p.prosecdef as definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
union all
select 'view', c.relname, null from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('v','m')
union all
select 'table', c.relname, null from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
union all
select 'policy', pol.polname, null from pg_policy pol
union all
select 'trigger', t.tgname, null from pg_trigger t where not t.tgisinternal
order by 1, 2;
`;
```

Supabase's JS client cannot run arbitrary SQL. **Do not** add a SQL-executing RPC to work around this — a general-purpose `exec_sql` function would be a far worse hole than anything this audit is likely to find. Use `psql` over the pooler instead, with the same connection idiom the migration pushes already use (`docs/superpowers/plans/2026-07-15-phase-3-cabinets.md:1308`). There is no `SUPABASE_DB_URL` variable in this repo — the URL is assembled from the password:

```bash
export SUPABASE_DB_PASSWORD="$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2-)"
psql "postgresql://postgres.orcxtbedkexoclbfgvzd:${SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
  -At -F'|' -f scripts/security/introspect.sql > scripts/security/live-objects.txt
```

Create `scripts/security/introspect.sql` containing the SQL above. The `.mjs` script then reads `live-objects.txt`, calls `reconcile`, and exits non-zero on any drift. **Never echo the password**, and never commit `live-objects.txt` if it turns out to contain anything beyond object names.

If `psql` is not on PATH, fall back to running the query once in the Supabase SQL editor and saving the pipe-delimited output to the same file by hand — the script only cares about the file.

- [ ] **Step 6: Generate the initial manifest and record the true counts**

```bash
node --env-file=.env.local scripts/security/introspect.mjs --write
```

This writes `scripts/security/manifest.json` with one entry per live database object, `layer: "db"`, and no overrides yet. Record the actual counts in the task completion note and compare against spec §2.

- [ ] **Step 7: Enumerate and append the app-layer surfaces**

```bash
grep -rn "^export async function" $(grep -rl '"use server"' app lib components) | sed 's/(.*//'
```

Append one manifest entry per exported action with `layer: "app"`, `kind: "action"`, plus one `endpoint` entry for `app/api/dev/otp/route.ts` and two `bucket` entries (`delegate-photos`, `news-images`). Confirm the action total against the spec's 35.

- [ ] **Step 8: Verify reconciliation is clean**

```bash
node --env-file=.env.local scripts/security/introspect.mjs
```

Expected: `added: 0, removed: 0` and a printed count per kind. Exit 0.

- [ ] **Step 9: Add the npm script and commit**

Add `"security:introspect": "node --env-file=.env.local scripts/security/introspect.mjs"` to `package.json`.

```bash
npm run format && npm run typecheck && npm test
git add lib/security/manifest.ts lib/security/manifest.test.ts scripts/security/ package.json
git commit -m "feat(security): surface manifest generated from live introspection"
```

---

### Task 4: The probe runner and ledger

**Files:**

- Create: `scripts/security/probe.mjs`
- Modify: `package.json` (add `security:census`)

**Interfaces:**

- Consumes: `provisionActors`, `actorClient` (Task 1); `judge`, `defaultExpectation`, `isRuleDerived` (Task 2); `scripts/security/manifest.json` (Task 3).
- Produces: `docs/security/ledger.json` — an array of `LedgerRow` — and a printed summary by verdict. Tasks 6–8 consume the ledger; Task 9's sweep reads the `ruleDerived` flag.

**Design notes for the implementer:**

The runner **records, never throws**. A probe that errors is data. The only fatal conditions are a missing manifest or a failed actor mint.

`lib/security/*.ts` is TypeScript and this runner is `.mjs`. Rather than adding a build step, re-express `judge` and `defaultExpectation` by importing them through Node's TypeScript stripping (Node 22.6+ with `--experimental-strip-types`) if the repo's Node supports it; otherwise duplicate nothing — instead have the runner emit raw outcomes to `ledger-raw.json` and add a tiny vitest-run TypeScript file that reads the raw ledger, applies `judge`, and writes `ledger.json`. **Prefer the second approach**: it keeps the judgement logic in exactly one tested place and needs no experimental flags. Check `node --version` before choosing, and record the choice in the completion note.

- [ ] **Step 1: Write the probe dispatcher**

Each `SurfaceKind` needs its own attempt strategy:

```javascript
async function probe(client, surface) {
  try {
    if (surface.kind === "view" || surface.kind === "table") {
      const { data, error } = await client.from(surface.name).select("*").limit(5);
      return { errorCode: error?.code ?? null, errorMessage: error?.message ?? null, rowCount: data?.length ?? 0 };
    }
    if (surface.kind === "function") {
      const { data, error } = await client.rpc(surface.name, {});
      return {
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        rowCount: Array.isArray(data) ? data.length : data == null ? 0 : 1,
      };
    }
    return { errorCode: "SKIP", errorMessage: `${surface.kind} probed in a later task`, rowCount: 0 };
  } catch (err) {
    return { errorCode: "THROWN", errorMessage: String(err), rowCount: 0 };
  }
}
```

Calling an RPC with `{}` will produce argument-mismatch errors (`PGRST202`) for functions that take parameters. That is **expected and important**: an argument mismatch is not an authorization denial, and `judge` correctly routes it to `needs-live-proof` rather than `clear`. Tasks 6–7 supply real arguments per function; this task only proves the runner works.

- [ ] **Step 2: Write the matrix loop**

Mint every session once, build one client per actor, then iterate. Minting inside the loop would hit the per-phone OTP throttle within seconds.

```javascript
import { readFileSync, writeFileSync } from "node:fs";
import { ACTOR_IDS, provisionActors, actorClient } from "./actors.mjs";

const manifest = JSON.parse(readFileSync("scripts/security/manifest.json", "utf8"));
const actors = await provisionActors();
const clients = Object.fromEntries(
  ACTOR_IDS.map((id) => [id, actorClient(actors[id].accessToken)]),
);

const rows = [];
for (const surface of manifest) {
  for (const actor of ACTOR_IDS) {
    const expectation = defaultExpectation(surface, actor);
    rows.push({
      surfaceId: surface.id,
      actor,
      expectation,
      ruleDerived: isRuleDerived(surface, actor),
      outcome: await probe(clients[actor], surface),
    });
  }
}
writeFileSync("docs/security/ledger-raw.json", JSON.stringify(rows, null, 2));
```

- [ ] **Step 3: Run it and confirm it completes without throwing**

```bash
mkdir -p docs/security
node --env-file=.env.local scripts/security/probe.mjs
```

Expected: completes, writes `docs/security/ledger-raw.json`, prints a per-verdict summary. **A large number of `needs-live-proof` rows at this stage is correct**, not a failure — arguments are not yet supplied.

- [ ] **Step 4: Sanity-check two known-good rows by hand**

The anon actor reading `public_delegates` must be `clear` against an `allow` expectation; the anon actor reading `dev_otp_inbox` must be `clear` against a `deny` expectation with code `42501`. Both are already proven by `scripts/verify-schema.mjs`, so a disagreement means the runner is wrong, not the database.

```bash
node -e "const l=require('./docs/security/ledger-raw.json');console.log(l.filter(r=>r.actor==='A1'&&/public_delegates|dev_otp_inbox/.test(r.surfaceId)))"
```

- [ ] **Step 5: Add the npm script and commit**

Add `"security:census": "node --env-file=.env.local scripts/security/probe.mjs"`. Add `docs/security/ledger-raw.json` and `docs/security/ledger.json` to `.gitignore` **only if** they exceed a few hundred KB; otherwise commit them as evidence.

```bash
npm run format
git add scripts/security/probe.mjs package.json docs/security/
git commit -m "feat(security): probe runner and ledger over the full actor matrix"
```

---

### Task 5: Pass 1 — the threat model

**Files:**

- Create: `docs/security/threat-model.md`

**Interfaces:**

- Consumes: spec §2.2 (the nine seed threats), spec §2.1 (the twelve actors).
- Produces: the ranking key used by Tasks 9–11 to order findings.

**This is an investigation task, not a code task.** Its deliverable is a document, and its acceptance criterion is the checklist in Step 4 — not a passing test.

- [ ] **Step 1: Expand each of the nine seed threats**

For every threat T1–T9 from spec §2.2, write: the actor position(s) that could mount it, the concrete asset at risk, the plausible route given what the codebase actually does, and what the damage means for the movement in plain Georgian-civic terms (a sentence the owner would recognise as a real consequence).

- [ ] **Step 2: Add threats the seed list missed**

Derive these from the manifest, not from imagination. Walk the 16 tables and ask, for each: who must never read this, and who must never write it? Any answer not already covered by T1–T9 becomes a new threat. Expect the audit-log, referral-binding, and RSVP tables to generate at least one each.

- [ ] **Step 3: Rank by damage, not by likelihood**

Produce an ordered list. This ordering is what Task 11's report uses, so it must be defensible to a non-technical reader.

- [ ] **Step 4: Verify the document against this checklist**

- Every threat names at least one actor position from spec §2.1 by its `A` number.
- Every threat names the tables or functions it targets, by their real names from the manifest.
- No threat is stated in terms of a technique ("SQL injection") without naming the asset it would reach.
- Every one of the 16 tables appears in at least one threat, or is explicitly listed as holding nothing worth attacking, with a reason.

- [ ] **Step 5: Commit**

```bash
npm run format
node scripts/ka-gate.mjs --diff main docs/security/threat-model.md
git add docs/security/threat-model.md
git commit -m "docs(security): Pass 1 threat model"
```

---

### Task 6: Pass 2a — census of read surfaces and the depth layer behind them

**Files:**

- Modify: `scripts/security/probe.mjs` (real read probes), `scripts/security/manifest.json` (explicit expectations)
- Create: `docs/security/coverage.md` (the table, started here)

**Interfaces:**

- Consumes: the ledger and manifest from Tasks 3–4.
- Produces: verdicts for **58** surfaces — 24 views, 16 tables, 10 row-level policies, 8 triggers — and the first section of `coverage.md`.

**Why the policies and triggers live here.** A row-level policy and a trigger are not doors you can knock on directly; they are the depth *behind* a table, and the only way to exercise them is through the table they guard. Auditing them in their own task would mean building the same fixtures twice. They are in scope and they matter — the trigger set includes the one preventing a person from editing their own status and the one making a delegate-without-a-membership impossible — so each gets its own row in the coverage table with its own verdict, reached through the table it protects.

- [ ] **Step 1: Replace rule-derived expectations with explicit ones for every view and table**

For each of the 40 **directly readable** surfaces (24 views + 16 tables — the policies and triggers are exercised in Steps 4 and 5, not queried directly), read the migration that creates it and state, per actor, whether access should be allowed or denied. Write these into the manifest's `overrides`. This is the slowest step in the task and the most valuable: it forces a stated intent for every surface, and `ruleDerived` drops to `false` for all 480 of these rows.

- [ ] **Step 2: Give each probe data that should match**

A `deny` expectation returning zero rows resolves to `needs-live-proof` by design (Task 2). Eliminate those by ensuring each actor has data that the view *would* return if the filter were broken — e.g. A7 (approved delegate) must have a team with at least one member before `delegate_team` proves anything.

- [ ] **Step 3: Re-run the census**

```bash
npm run security:census
```

Expected: zero `needs-live-proof` rows remaining among view and table surfaces. Any that remain are either a missing fixture (fix the fixture) or a genuinely ambiguous surface (escalate to Task 9).

- [ ] **Step 4: Exercise each of the 10 row-level policies through its table**

For each policy, read its `USING`/`WITH CHECK` clause in the migration, then construct the probe that would slip past it if the clause were wrong: the actor it is meant to exclude, attempting the operation it is meant to gate, against a row it is meant not to reach. A policy whose table is already sealed by revoked grants still gets its own probe — grants and policies are independent defences, and the audit's job is to know which one is actually holding.

- [ ] **Step 5: Exercise each of the 8 triggers by attempting the write it forbids**

For each trigger, attempt the mutation it exists to reject, as an actor who could plausibly attempt it. The protected-columns trigger and the delegate-requires-membership invariant are the two that matter most; both should reject, and a rejection is `clear`. A trigger that permits its forbidden write is a finding regardless of what the grants above it did — a defence that never fires is indistinguishable from one that is absent, and the grant in front of it may be relaxed by some future change.

- [ ] **Step 6: Write the coverage table section**

One row per surface: id, kind, the twelve verdicts, and a note column. Any `finding` row gets a one-line description of what leaked. All 58 surfaces appear.

- [ ] **Step 7: Commit**

```bash
npm run format
git add scripts/security/ docs/security/
git commit -m "audit(security): Pass 2a census — 58 read surfaces, policies and triggers"
```

---

### Task 7: Pass 2b — census of the database functions

**Files:**

- Modify: `scripts/security/probe.mjs`, `scripts/security/manifest.json`
- Create: `scripts/security/arguments.mjs`
- Modify: `docs/security/coverage.md`

**Interfaces:**

- Consumes: Task 6's manifest with explicit read expectations.
- Produces: verdicts for **58** functions — the 52 `security definer` gatekeepers plus the 6 plain helper functions — across 12 actors.

**Why the 6 helpers are in scope.** They are not doors, so they are easy to skip: they answer questions like "does this person hold this admin role?" But every gatekeeper that asks one inherits its answer. A helper that answers wrongly compromises every function built on top of it, and no amount of auditing the doors would reveal it. Each is probed directly where callable, and where it is not directly callable its behaviour is established through a gatekeeper that depends on it — recorded in the coverage table either way.

**Design notes:** This is the largest and most important task in the census. Each function needs **real arguments**, because an argument-mismatch error masquerades as inaccessibility. Build an argument table: function name → a valid argument object for a caller who *should* succeed. Then every actor calls it with those same valid arguments, so the only variable is who is calling.

**Isolation is mandatory, and it is not optional bookkeeping.** These probes call functions that really do things: approve a delegate, record a payment, close a poll, delete news. The actors who are *supposed* to succeed will succeed, which means every probe changes the state the next probe runs against. Without isolation the results are order-dependent and a re-run will not reproduce them — which would destroy the audit's central claim, since a finding that cannot be reproduced is not a finding (Global Constraints). See Step 2 for the required scheme.

- [ ] **Step 1: Build the argument table**

```javascript
// scripts/security/arguments.mjs — one entry per definer function.
export const ARGS = {
  member_change_tier: () => ({ p_tier: "10" }),
  member_change_delegate: (fx) => ({ p_delegate_id: fx.spareDelegateId }),
  admin_record_payment: (fx) => ({ p_membership_id: fx.disposableMembershipId, p_amount: 10 }),
  // ... one per function; a function with no arguments maps to () => ({})
};
```

Every one of the 58 needs an entry. A function with no valid-caller arguments discoverable from the migration is escalated to Task 9 rather than guessed at.

- [ ] **Step 2: Build the per-probe isolation scheme**

**One disposable target per (function, actor) pair — never a shared one.** For each mutating function, write a `setup()` that mints the row(s) that call will act on, tagged `security-audit-2026-07`, and returns their ids for the argument builder. The matrix loop calls `setup()` immediately before each probe, so all 12 actors attack an identical fresh target and the twelfth result is comparable to the first.

```javascript
// scripts/security/arguments.mjs — setup runs per (function, actor) pair.
export const FIXTURES = {
  admin_approve_delegate: {
    setup: async (db) => ({ p_delegate_id: await mintDisposableDelegate(db, "pending") }),
  },
  admin_close_poll: {
    setup: async (db) => ({ p_poll_id: await mintDisposablePoll(db, "open") }),
  },
  member_change_tier: {
    setup: async () => ({ p_tier: "10" }), // no target row; the caller IS the target
  },
};
```

Read-only functions need no `setup` and may share state freely — mark them explicitly so the runner skips the minting cost.

**Do not attempt transaction rollback.** These are `security definer` functions invoked over PostgREST; each call is its own transaction and the client cannot wrap them. Fresh-target-per-probe is the isolation mechanism available, and it is sufficient.

**Record what each probe touched.** The runner appends every minted id to `docs/security/residue.json`. Task 13 uses it to distinguish what the reseed removed from what the append-only audit log has made permanent.

- [ ] **Step 3: State explicit expectations for all 58 × 12**

As in Task 6 Step 1, read each function's migration body and state intent per actor. Pay particular attention to the four admin roles — the whole purpose of RBAC is that `A10` can approve a delegate and `A11` cannot, and this is where a mistake would be invisible in normal use.

- [ ] **Step 4: Re-run and drive `needs-live-proof` to zero**

```bash
npm run security:census
```

- [ ] **Step 5: Verify the audit-log invariant separately**

For every function that mutates admin-visible state, confirm an `audit_log` row was written by the call. A function that mutates without auditing is a finding regardless of its access control.

- [ ] **Step 6: Extend the coverage table and commit**

```bash
npm run format
git add scripts/security/ docs/security/
git commit -m "audit(security): Pass 2b census — 58 database functions across 12 actors"
```

---

### Task 8: Pass 2c — census of the app layer

**Files:**

- Create: `scripts/security/app-probe.mjs`
- Modify: `docs/security/coverage.md`

**Interfaces:**

- Consumes: the manifest's 38 `layer: "app"` entries (35 actions, 1 endpoint, 2 buckets).
- Produces: verdicts completing the coverage table to all 154 surfaces.

**Design notes:** Server actions are not reachable over plain HTTP the way an RPC is — Next.js requires the action id and the correct encoding. Two viable strategies: drive them through the browser with Playwright using each actor's session, or replay a captured action request with a swapped session cookie. **Use the replay strategy** for the authorization question, because the interesting attack is precisely a *different* actor's cookie against an action they should not reach — something the UI would never let you construct.

The storage buckets are probed directly: attempt read and write to each bucket as each actor. Both are public-read by design; the question is write.

- [ ] **Step 1: Capture one valid request per action**

Drive each action once through Playwright as an actor who legitimately may perform it, recording the request body and headers.

- [ ] **Step 2: Replay each captured request under all 12 sessions**

Swap only the session cookie. Record status and body per actor.

- [ ] **Step 3: Probe both buckets for write access as each actor**

```javascript
const { error } = await client.storage.from("news-images").upload(`audit-${Date.now()}.txt`, "x");
```

Expected: denied for every actor including the editor role, since uploads are RPC-mediated by design (`20260717150000_admin_crm.sql:1012`). Any success is a finding.

- [ ] **Step 4: Probe the dev OTP endpoint**

Confirm it still withholds codes for **any** existing profile row (the R1 hardening), including the newly-created audit actors. A code returned for an existing profile is a Critical finding under D5.

- [ ] **Step 5: Complete the coverage table to 154 rows and commit**

```bash
npm run format
git add scripts/security/ docs/security/
git commit -m "audit(security): Pass 2c census — 35 actions, 1 endpoint, 2 buckets"
```

---

### Task 9: Pass 3 — the adversarial sweep

**Files:**

- Create: `docs/security/candidates.md`

**Interfaces:**

- Consumes: the completed coverage table, the threat model, and every ledger row still flagged `ruleDerived: true`.
- Produces: a candidate list, each entry surviving a refutation attempt, handed to Task 10.

**This is an investigation task.** Its unit of work is a hunting pass, and each pass must be run by a **fresh reviewer with no memory of the census's assumptions** — that is the entire point. Use `superpowers:dispatching-parallel-agents` to run the six lenses concurrently.

- [ ] **Step 1: Run the six hunting lenses**

1. Privilege escalation across the standing ladder and the admin roles
2. Data leakage — personal IDs, phones, roster, team membership, vote records
3. Tampering with money, counts, and derived active-member state
4. Abuse of the sign-in and OTP flow
5. Chained attacks — two individually-harmless behaviours combined
6. The census auditing its own blind spots: every surface where `ruleDerived` stayed `true`, and every expectation the census *stated* but never justified

Each lens produces candidates in the form: actor, surface, claimed capability, why the census missed it.

- [ ] **Step 2: Refute every candidate**

Each candidate goes to a **separate** reviewer whose only instruction is to destroy it — to show the capability is not real, or is already denied, or is inert. Default to refuted when the evidence is ambiguous.

- [ ] **Step 3: Record survivors and refutations**

Both go in `candidates.md`. A refuted candidate keeps its refutation reasoning — Task 11 reports these too, and spec §3 Pass 4 makes disproofs a deliverable in their own right.

- [ ] **Step 4: Commit**

```bash
npm run format
git add docs/security/candidates.md
git commit -m "audit(security): Pass 3 adversarial sweep — candidates and refutations"
```

---

### Task 10: Pass 4 — live proof

**Files:**

- Create: `docs/security/findings.md`
- Modify: `docs/security/coverage.md` (resolve every remaining `needs-live-proof`)

**Interfaces:**

- Consumes: Task 9's surviving candidates; any coverage row still unresolved.
- Produces: the confirmed finding list with evidence, and the recorded disproofs — the input to Task 11's triage and Task 12's fixes.

- [ ] **Step 1: Attack each surviving candidate for real**

Against staging and the public URL, using the actor sessions from Task 1. Reproduction means: the actor performed the action, and the effect is observable.

- [ ] **Step 2: Record the outcome as binary**

Reproduced → confirmed finding, with the exact call, the response, and the observable effect attached. Not reproduced → discarded, with the attempt and its failure recorded.

- [ ] **Step 3: Resolve every remaining `needs-live-proof` coverage row**

Per spec §3 Pass 2, no surface may end the phase in this state. Each resolves to `clear` or `finding`.

- [ ] **Step 4: Assign severity per spec §4**

Critical (A1 reaches it), High (A3–A8 cross a boundary), Medium (unusual precondition or contained damage), Low (missing guard, no route to harm).

- [ ] **Step 5: STOP if anything is Critical**

Per D5, a Critical is fixed immediately and out of band — do not wait for Task 12. Tell the owner the same day, fix it test-first, and note it in `findings.md` as fixed-in-flight.

- [ ] **Step 6: Commit**

```bash
npm run format
git add docs/security/
git commit -m "audit(security): Pass 4 live proof — confirmed findings and disproofs"
```

---

### Task 11: Triage and the owner report — OWNER CHECKPOINT

**Files:**

- Create: `docs/security/report.md`

**Interfaces:**

- Consumes: `findings.md`, `coverage.md`, `threat-model.md`.
- Produces: the owner-facing report, and — after owner review — the concrete fix task list that Task 12 executes.

- [ ] **Step 1: Write the report in plain language**

Per spec §6: each finding reads as *an actor in position X can do Y, which means Z for the movement*, plus the evidence it is real. No code, no function names in the body — the owner reads no code. Technical detail goes in an appendix.

- [ ] **Step 2: Include the disproofs and the coverage claim**

The report states what was checked (154 surfaces, 12 actors), what was found, and what was investigated and proven safe. The last of these is a deliverable, not filler.

- [ ] **Step 3: Flag every capability-removing fix**

Per D7, list which fixes would take away something a real person can do today, and who loses what. The owner sees this **before** any of it ships.

- [ ] **Step 4: Flag any redesign-scale finding**

Per D8, anything that cannot be closed without a redesign is named here as an owner decision, not silently deferred.

- [ ] **Step 5: Amend this plan with one task per confirmed finding**

Each gets the Task 12 template below, instantiated with the real attack, the real fix, and the real files. **The plan document is edited and committed before the fix wave starts** — so the fix wave is executed from a written plan like every other phase, not improvised.

- [ ] **Step 6: STOP — deliver the report and wait**

Do not begin fixes. Do not propose an execution mode. Present the report and wait for the owner's explicit instruction on scope.

---

### Task 12: The fix wave — template, instantiated per finding in Task 11 Step 5

**This template is instantiated once per confirmed finding.** It is not executed as written.

**Files:** (per finding) the migration or source file containing the hole; the test file that will reproduce it.

**Interfaces:** Consumes the finding's evidence from `findings.md`. Produces a closed hole and a regression test.

- [ ] **Step 1: Write the failing attack test**

The test performs the attack exactly as Pass 4 reproduced it, as the offending actor, and asserts the attack **fails**. Database-layer holes get a probe test; app-layer holes get a Playwright spec in `e2e/`.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run <path>    # or: npx playwright test <path>
```

Expected: FAIL, because the hole is real. **A test that passes here means the finding was wrong** — stop, and move it to the disproof list.

- [ ] **Step 3: Write the minimal fix**

Database fixes go in a **new** migration (never edit an applied one). Application fixes go in the offending file. Admin paths keep writing to `audit_log`.

- [ ] **Step 4: Run the test and watch it pass**

- [ ] **Step 5: Run the full suite for collateral damage**

```bash
npm run typecheck && npm test
```

A security fix that narrows access will often break a test that relied on the loose behaviour. Each such break is examined individually: either the test encoded the bug (update it, note why) or the fix is too broad (narrow it).

- [ ] **Step 6: Independent review**

A reviewer who did not write the fix confirms it closes the hole without collateral damage.

- [ ] **Step 7: Commit**

```bash
npm run format
git add <files>
git commit -m "fix(security): <finding id> — <one-line description>"
```

---

### Task 13: Release v0.10.0

**Files:**

- Modify: `package.json` (version), `CHANGELOG.md`, `DECISIONS.md` (ADR for any architectural change a fix forced)

- [ ] **Step 1: Whole-wave review**

One review across every fix together, checking for interactions between fixes that individually passed.

- [ ] **Step 2: Push all migrations to staging and verify**

```bash
npx supabase db push --yes
node --env-file=.env.local scripts/verify-schema.mjs
```

Expected: schema probe green.

- [ ] **Step 3: Reseed staging and document the residue that cannot be removed**

```bash
npm run seed:staging
```

**Do not promise a clean sweep — it is not achievable, by design.** `audit_log` is append-only and its actor foreign key is plain, so **any account that successfully performed an audited admin action can never be deleted**. That is exactly the population this audit creates: every actor that reached an admin path, including any non-admin that reached one because of a hole we were hunting for. There is precedent — a cancelled probe event already accrues on every existing `verify-schema` run and resists deletion.

So the exit criterion is: **the seeded population returns to its documented counts, and everything left over is named.** Concretely:

1. Reseed, then confirm the roster counts: 1636 active / 134 completed / 132 registered, 12 approved delegates.
2. Read `docs/security/residue.json` (Task 7 Step 2) and delete every disposable row the seed did not already remove.
3. For each row that resists deletion, record it in `docs/security/residue.md` with the reason — audit-log reference, foreign key, or append-only constraint.
4. Confirm no `security-audit-2026-07` account holds an open membership or appears in any public count. **Permanent presence in the audit log is acceptable; presence in the movement's figures is not.**

If the residue turns out to distort a public figure, that is itself a finding — the seed's own self-checks should have caught it, and their not doing so is worth a line in the report.

- [ ] **Step 4: Re-run the full census as a regression check**

```bash
npm run security:census
```

Expected: zero `finding` rows across all 154 surfaces. This is the proof the phase worked.

- [ ] **Step 5: Full suite and CI**

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run e2e
```

Pace the e2e runs against the SMS throttle — no more than two full passes per hour.

- [ ] **Step 6: Release commit on the branch, then PR**

Bump to `0.10.0`, write the CHANGELOG entry in the plain-language register the owner reads, add an ADR to `DECISIONS.md` for any architectural change a fix forced. Then open the PR and let CI go green.

- [ ] **Step 7: Preview QA and owner sign-off**

Run `/qa` on the Vercel preview. Deliver the sign-off package: the report, the coverage claim, the list of capability changes, and the preview link. **Wait for the owner's explicit approval before merging** — never merge with failing CI, never push to main.

---

## Self-Review

**Spec coverage:** §1 D1–D8 → Global Constraints and Tasks 10/11/12. §2 inventory → Task 3. §2.1 actors → Task 1. §2.2 threats → Task 5. §3 four passes → Tasks 5, 6–8, 9, 10. §4 severity → Task 10 Step 4. §5 fix wave → Task 12. §6 deliverables → Tasks 6–8 (coverage), 10 (findings), 11 (report), 13 (release). §7 exit criteria → Task 13. §8 blast radius → Task 13 Step 3 and the throttle constraint. §9 out of scope → not implemented anywhere, correctly.

**Gap found and closed:** the spec's §5 requirement that admin mutations keep writing to `audit_log` had no verification step; added as Task 7 Step 5.

**Defects found in the first draft and fixed:**

1. **`judge` mislabelled probe defects as security findings.** The allow-branch treated `42883`/`PGRST202` (function or signature not found) the same as `42501` (privilege denied), so a wrong entry in Task 7's argument table would have been reported to the owner as an over-restriction finding. Split into `DENIED_BY_PRIVILEGE` and `NOT_FOUND_CODES`; only a privilege denial is a finding on the allow side. Regression test added.
2. **`defaultExpectation` ended in a dead ternary** (`? "deny" : "deny"`), which reads as a considered judgement but is a fail-closed placeholder. Replaced with a plain return and a comment saying so, since Tasks 6–7 must overwrite every one of those pairs with a stated expectation.
3. **`actorClient` had two different signatures** — `actorClient(actor)` in Task 1's interface block, `actorClient(accessToken)` in its code. Unified on the token form, and the interface block now documents every export including `ACTOR_IDS` and `db`.
4. **Task 4's matrix loop referenced `ACTOR_IDS` and `clients`, neither of which existed.** `ACTOR_IDS` is now exported from `actors.mjs`; the client map is built once before the loop, with a note on why minting inside the loop would hit the OTP throttle.
5. **Task 3 used a `SUPABASE_DB_URL` variable this repo does not have.** Replaced with the established pooler idiom, plus an explicit prohibition on adding an `exec_sql` RPC to work around it.

**Defects found in the owner-requested review of the committed plan, and fixed (2026-07-25):**

6. **The plan covered only 130 of the 154 surfaces it promised.** The three census tasks split views/tables, definer functions, and app doors — silently orphaning the 10 row-level policies, 8 triggers, and 6 helper functions, so the plan could not satisfy its own spec §7. The helpers were the dangerous omission: they are not doors, so they fit no task boundary, yet every gatekeeper that consults one inherits its answer. Policies and triggers folded into Task 6 (they are only reachable through the tables they guard); helpers folded into Task 7. A sum check is now recorded under File Structure so a future edit cannot re-orphan them.
7. **A successful break-in would have been filed as inconclusive.** `judge` decided leaks partly by whether rows came back, but most definer functions return nothing — they *act*. A successful unauthorized call and a correctly-blocked one both produced "no error, no rows", so the single most dangerous class of finding would have been demoted to `needs-live-proof` and buried among hundreds of similar rows. `judge` now takes the surface `kind`: for anything you *call*, the absence of an error is itself the proof the caller got through. Six regression tests added.
8. **Task 13 promised a clean-up that is impossible by design.** `audit_log` is append-only with a plain actor foreign key, so any account that reached an admin path can never be deleted — precisely the population this audit creates, and there is existing precedent in the `verify-schema` probe residue. The exit criterion is now "seeded counts restored, and every survivor named with its reason", with a new `residue.json`/`residue.md` trail.
9. **Mutating probes would have contaminated each other.** Calling 58 functions as 12 actors means the authorized ones really do approve delegates and close polls, so each probe ran against state the previous probe had changed — making results order-dependent and non-reproducible, which would void the audit's central claim. Task 7 Step 2 now mandates a fresh disposable target per (function, actor) pair, and records why transaction rollback is not available over PostgREST.

**Known soft spots, deliberately left to the implementer:** Task 4 Step 5's ledger-size judgement, Task 8's replay strategy, the `+995509001xxx` phone block's availability, and whether minting twelve sessions concurrently trips a project-wide SMS ceiling (only the per-phone cap is documented; fall back to sequential minting with backoff if it does). Each is marked with what to check and what to record, rather than guessed at here.
