# Support Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/support` — a public Georgian contact page whose messages are stored durably and read by a super-admin — with no email and no deployment setup.

**Architecture:** Public form → server action → zod parse → `security definer` RPC insert. The table is unreachable from client roles in both directions: writes go through the RPC, reads through a self-gating `admin_support_messages` view. All new Georgian lives in one module (`lib/support-copy.ts`) so the integrity-gate surface is a single file. The anti-spam salt is derived by HMAC from the existing service key, so nothing new must be configured to deploy.

**Tech Stack:** Next.js 16 App Router (server actions), React 19, TypeScript strict, zod ^3.24, Supabase (staging is the only database — ADR-005), vitest + @testing-library/react, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-02-support-page-design.md`

## Global Constraints

- **TypeScript strict. No `any`, no `@ts-ignore`.** (CLAUDE.md)
- **All user-facing text is Georgian**, and every Georgian string in this feature must come from `lib/support-copy.ts` — no Georgian literals anywhere else in the feature. This is what keeps the gate surface to one file.
- **Never hand-type Georgian.** Strings marked `spliced` below are byte-identical to an existing repo string; copy the bytes from the cited file rather than retyping. Strings marked `new` are the owner-approved prose from spec §3 and are verified by the scan in Task 7.
- **Domain logic = pure functions in `lib/`**, no React/Next imports there. UI in `components/` or the route folder.
- **Reuse design-system components** (`Field`, `Button`, `Card`, `DataTable`) — never restyle ad hoc (DESIGN.md).
- **zod at every boundary**, and the server is the source of truth: the RPC restates every rule the form enforces.
- **Schema changes only via `supabase/migrations/`.** `lib/supabase/types.ts` is hand-maintained (ADR-005) and must be updated *in the same commit* as its migration.
- **Migration version must sort after `20260729120000`**, the latest applied. Confirm with `npx supabase migration list` before the owner pushes. Never amend an already-pushed migration.
- **Never push directly to main.** Work on `claude/support-page-contact`, which already carries the spec commit.
- **Every task ends green:** `npm test && npm run typecheck && npm run lint`.

## Copy block — the authoritative strings

Task 1 creates this file. Every later task imports from it. Provenance is spec §3.

| Constant | Value | Provenance |
|---|---|---|
| `SUPPORT_HEADING` | `დაგვიკავშირდი` | new |
| `SUPPORT_LEDE` | `მოგვწერე — ყველა შეტყობინებას ვკითხულობთ და გიპასუხებთ.` | new (em dash U+2014) |
| `SUPPORT_NAME_LABEL` | `სახელი` | spliced — `app/(public)/join/JoinForm.tsx` |
| `SUPPORT_EMAIL_LABEL` | `ელ-ფოსტა (არასავალდებულო)` | `(არასავალდებულო)` spliced — `app/(admin)/admin/content/events/EventForm.tsx:85` |
| `SUPPORT_PHONE_LABEL` | `ტელეფონი (არასავალდებულო)` | spliced — `app/(admin)/admin/verify/VerifyCard.tsx:125` + above |
| `SUPPORT_MESSAGE_LABEL` | `შეტყობინება` | new |
| `SUPPORT_SUBMIT_LABEL` | `გაგზავნა` | spliced — `app/(public)/join/JoinForm.tsx` |
| `SUPPORT_SUCCESS` | `შეტყობინება გაიგზავნა. მალე გიპასუხებთ.` | `მალე` spliced; rest new |
| `SUPPORT_FAILURE` | `შეტყობინების გაგზავნა ვერ მოხერხდა, სცადე თავიდან.` | pattern spliced — JoinForm's `კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან` |
| `SUPPORT_NEED_CONTACT` | `მიუთითე ელ-ფოსტა ან ტელეფონი.` | new |
| `SUPPORT_RATE_LIMITED` | `ბევრი შეტყობინება გაიგზავნა — სცადე ცოტა ხნის შემდეგ.` | new |
| `SUPPORT_FOOTER_LABEL` | `დაგვიკავშირდი` | new, same bytes as heading |
| `SUPPORT_EMAIL_INVALID` | `ელ-ფოსტის ფორმატი არასწორია.` | noun-swap of `ტელეფონის ფორმატი არასწორია.` (`app/(admin)/admin/admins/actions.ts:19`) |
| `SUPPORT_FILL_FIELD` | `შეავსე ეს ველი` | spliced — `lib/funnel-schemas.ts:15` |
| `SUPPORT_MAX_60` | `მაქსიმუმ 60 სიმბოლო` | spliced — `lib/funnel-schemas.ts:16` |
| `SUPPORT_MAX_120` | `მაქსიმუმ 120 სიმბოლო` | digit-swap of the shipped `მაქსიმუმ 100 სიმბოლო` |
| `SUPPORT_MAX_40` | `მაქსიმუმ 40 სიმბოლო` | digit-swap of the same |
| `SUPPORT_MIN_10` | `სულ მცირე 10 სიმბოლო` | new |
| `SUPPORT_MAX_2000` | `მაქსიმუმ 2000 სიმბოლო` | digit-swap of the same |
| `SUPPORT_ADMIN_TAB_LABEL` | `შეტყობინებები` | new |
| `SUPPORT_ADMIN_EMPTY` | `შეტყობინებები არ არის.` | new |

---

### Task 1: Copy module and validation schema

**Files:**
- Create: `lib/support-copy.ts`
- Create: `lib/support-schemas.ts`
- Create: `lib/support-schemas.test.ts`

**Interfaces:**
- Produces: every constant in the copy table above; `supportMessageSchema`; `type SupportMessageInput = { name: string; email?: string; phone?: string; message: string }`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test** — `lib/support-schemas.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { supportMessageSchema } from "./support-schemas";
import { SUPPORT_NEED_CONTACT } from "./support-copy";

// Georgian fixtures spliced, never retyped: NAME from lib/admin-schemas.test.ts:127,
// the "ა".repeat(n) boundary idiom from lib/cabinet-schemas.test.ts:28.
const NAME = "ნინო";
const MESSAGE = "ა".repeat(20);

describe("supportMessageSchema", () => {
  it("accepts a form with only an email", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "someone@example.com",
      phone: "",
      message: MESSAGE,
    });
    expect(r.success).toBe(true);
  });

  it("accepts a form with only a phone", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "",
      phone: "+995555123456",
      message: MESSAGE,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a form with neither, naming the contact rule", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "",
      phone: "",
      message: MESSAGE,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === SUPPORT_NEED_CONTACT)).toBe(true);
    }
  });

  it("rejects a malformed email even when a phone is present", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "not-an-address",
      phone: "+995555123456",
      message: MESSAGE,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const r = supportMessageSchema.safeParse({
      name: "",
      email: "someone@example.com",
      phone: "",
      message: MESSAGE,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a 9-character message and accepts a 10-character one", () => {
    const base = { name: NAME, email: "someone@example.com", phone: "" };
    expect(supportMessageSchema.safeParse({ ...base, message: "ა".repeat(9) }).success).toBe(false);
    expect(supportMessageSchema.safeParse({ ...base, message: "ა".repeat(10) }).success).toBe(true);
  });

  it("rejects a message over 2000 characters", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "someone@example.com",
      phone: "",
      message: "ა".repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  it("normalises blank optional fields to undefined", () => {
    const r = supportMessageSchema.safeParse({
      name: `  ${NAME}  `,
      email: "someone@example.com",
      phone: "   ",
      message: `  ${MESSAGE}  `,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBeUndefined();
      expect(r.data.name).toBe(NAME);
      expect(r.data.message).toBe(MESSAGE);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/support-schemas.test.ts`
Expected: FAIL — `Failed to resolve import "./support-schemas"`.

- [ ] **Step 3: Create the copy module** — `lib/support-copy.ts`

Splice each `spliced` value from the file cited in the copy table; type nothing by hand that already exists. Do not add a Georgian string to any other file in this feature.

```ts
/**
 * Every Georgian string on the support page, in one module.
 *
 * Concentrating them here is deliberate: DESIGN.md's integrity gate exists
 * because models silently normalize quotes and can fuse Latin homoglyphs into
 * Georgian words, and this page carries the first genuinely new Georgian prose
 * written in this repo rather than carried in from the prototype. One file
 * means one small surface for ka-gate and the mixed-script scan (Task 7).
 * Provenance per string is recorded in the plan's copy table and spec §3.
 */
export const SUPPORT_HEADING = "დაგვიკავშირდი";
export const SUPPORT_LEDE = "მოგვწერე — ყველა შეტყობინებას ვკითხულობთ და გიპასუხებთ.";
export const SUPPORT_NAME_LABEL = "სახელი";
export const SUPPORT_EMAIL_LABEL = "ელ-ფოსტა (არასავალდებულო)";
export const SUPPORT_PHONE_LABEL = "ტელეფონი (არასავალდებულო)";
export const SUPPORT_MESSAGE_LABEL = "შეტყობინება";
export const SUPPORT_SUBMIT_LABEL = "გაგზავნა";
export const SUPPORT_SUCCESS = "შეტყობინება გაიგზავნა. მალე გიპასუხებთ.";
export const SUPPORT_FAILURE = "შეტყობინების გაგზავნა ვერ მოხერხდა, სცადე თავიდან.";
export const SUPPORT_NEED_CONTACT = "მიუთითე ელ-ფოსტა ან ტელეფონი.";
export const SUPPORT_RATE_LIMITED = "ბევრი შეტყობინება გაიგზავნა — სცადე ცოტა ხნის შემდეგ.";
export const SUPPORT_FOOTER_LABEL = "დაგვიკავშირდი";

export const SUPPORT_EMAIL_INVALID = "ელ-ფოსტის ფორმატი არასწორია.";
export const SUPPORT_FILL_FIELD = "შეავსე ეს ველი";
export const SUPPORT_MAX_60 = "მაქსიმუმ 60 სიმბოლო";
export const SUPPORT_MAX_120 = "მაქსიმუმ 120 სიმბოლო";
export const SUPPORT_MAX_40 = "მაქსიმუმ 40 სიმბოლო";
export const SUPPORT_MIN_10 = "სულ მცირე 10 სიმბოლო";
export const SUPPORT_MAX_2000 = "მაქსიმუმ 2000 სიმბოლო";

export const SUPPORT_ADMIN_TAB_LABEL = "შეტყობინებები";
export const SUPPORT_ADMIN_EMPTY = "შეტყობინებები არ არის.";
```

- [ ] **Step 4: Implement the schema** — `lib/support-schemas.ts`

```ts
import { z } from "zod";
import {
  SUPPORT_EMAIL_INVALID,
  SUPPORT_FILL_FIELD,
  SUPPORT_MAX_40,
  SUPPORT_MAX_60,
  SUPPORT_MAX_120,
  SUPPORT_MAX_2000,
  SUPPORT_MIN_10,
  SUPPORT_NEED_CONTACT,
} from "./support-copy";

// Deliberately looser than a full RFC address grammar: the point is to stop
// nonsense reaching a mailbox that does not exist yet, not to adjudicate
// exotic-but-legal addresses and reject a real person.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const blankToUndefined = (v: string | undefined): string | undefined =>
  v === undefined || v.trim() === "" ? undefined : v.trim();

export const supportMessageSchema = z
  .object({
    name: z.string().trim().min(1, { message: SUPPORT_FILL_FIELD }).max(60, { message: SUPPORT_MAX_60 }),
    email: z.string().max(120, { message: SUPPORT_MAX_120 }).optional(),
    phone: z.string().max(40, { message: SUPPORT_MAX_40 }).optional(),
    message: z
      .string()
      .trim()
      .min(10, { message: SUPPORT_MIN_10 })
      .max(2000, { message: SUPPORT_MAX_2000 }),
  })
  .transform((v) => ({
    ...v,
    email: blankToUndefined(v.email),
    phone: blankToUndefined(v.phone),
  }))
  .refine((v) => v.email !== undefined || v.phone !== undefined, {
    message: SUPPORT_NEED_CONTACT,
    path: ["email"],
  })
  .refine((v) => v.email === undefined || EMAIL_RE.test(v.email), {
    message: SUPPORT_EMAIL_INVALID,
    path: ["email"],
  });

export type SupportMessageInput = z.infer<typeof supportMessageSchema>;
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/support-schemas.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Gates and commit**

```bash
npm test && npm run typecheck && npm run lint
node scripts/ka-gate.mjs --diff main lib/support-copy.ts lib/support-schemas.ts lib/support-schemas.test.ts
git add lib/support-copy.ts lib/support-schemas.ts lib/support-schemas.test.ts
git commit -m "feat(support): owner-approved copy block and form validation"
```

---

### Task 2: Migration and hand-maintained types

**Files:**
- Create: `supabase/migrations/20260802120000_support_messages.sql`
- Modify: `lib/supabase/types.ts` (add one view to `Views`, one function to `Functions`)

**Interfaces:**
- Produces: RPC `submit_support_message(p_name text, p_email text, p_phone text, p_message text, p_ip_hash text) returns bigint`; view `admin_support_messages` with `Row: { id: number; name: string; email: string | null; phone: string | null; message: string; created_at: string }`.
- Consumes: Task 1's rules, restated in SQL.

There is no local database (ADR-005), so this task has no red-green cycle — the owner applies it in Task 8. Verification here is `npm run typecheck` plus review against the shipped `admin_*` view patterns in `supabase/migrations/20260717150000_admin_crm.sql`.

- [ ] **Step 1: Confirm the version sorts last**

Run: `ls supabase/migrations/ | tail -3`
Expected: nothing sorts after `20260802120000`. The newest existing file is `20260729120000_referral_count_sums_both_codes.sql`.

- [ ] **Step 2: Write the migration** — `supabase/migrations/20260802120000_support_messages.sql`

```sql
-- Support page (spec 2026-08-02-support-page-design.md §4). A public contact
-- form: anybody may write to the movement, so the insert path is open to anon.
-- The table itself is unreachable from client roles in BOTH directions --
-- writes go through this definer RPC, reads through the self-gating view below.
create table support_messages (
  id bigserial primary key,
  name text not null,
  email text,
  phone text,
  message text not null,
  ip_hash text,
  created_at timestamptz not null default now()
);

alter table support_messages enable row level security;
revoke all on support_messages from anon, authenticated;
revoke all on sequence support_messages_id_seq from anon, authenticated;

-- Serves the rate-limit probe: newest rows for one hashed address.
create index support_messages_by_ip_recent on support_messages (ip_hash, created_at desc);

create function submit_support_message(
  p_name text,
  p_email text,
  p_phone text,
  p_message text,
  p_ip_hash text default null
) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id bigint;
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  -- The server is the source of truth: every rule the form enforces is
  -- restated here, so a caller bypassing the form gains nothing.
  if p_name is null
     or length(btrim(p_name)) not between 1 and 60
     or p_message is null
     or length(btrim(p_message)) not between 10 and 2000
     or (v_email is null and v_phone is null)
     or (v_email is not null
         and (length(v_email) > 120
              or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))
     or (v_phone is not null and length(v_phone) > 40) then
    raise exception 'invalid_support_message';
  end if;

  -- Public form: at most 3 messages per hashed address per 10 minutes.
  if p_ip_hash is not null and (
    select count(*) from public.support_messages
     where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'too_many_requests';
  end if;

  insert into public.support_messages (name, email, phone, message, ip_hash)
  values (btrim(p_name), v_email, v_phone, btrim(p_message), p_ip_hash)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function submit_support_message(text, text, text, text, text) to anon, authenticated;

-- Read path: same self-gating shape as the other admin_* views (spec §6).
-- ip_hash is deliberately absent -- it exists to throttle, not to be read.
create view admin_support_messages as
select id, name, email, phone, message, created_at
from support_messages
where has_any_admin_role('super_admin');

revoke all on admin_support_messages from anon, authenticated;
grant select on admin_support_messages to authenticated;
```

- [ ] **Step 3: Add the view to `lib/supabase/types.ts`**

Inside the `Views` block, next to the other `admin_*` entries:

```ts
      admin_support_messages: {
        Row: {
          id: number;
          name: string;
          email: string | null;
          phone: string | null;
          message: string;
          created_at: string;
        };
        Relationships: [];
      };
```

The `support_messages` table itself is deliberately **not** added: no typed-client code path touches it directly, and the file's own rule is to list only what app code touches.

- [ ] **Step 4: Add the function to `lib/supabase/types.ts`**

Inside the `Functions` block:

```ts
      submit_support_message: {
        Args: {
          p_name: string;
          p_email: string | null;
          p_phone: string | null;
          p_message: string;
          p_ip_hash?: string | null;
        };
        Returns: number;
      };
```

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck && npm run lint
git add supabase/migrations/20260802120000_support_messages.sql lib/supabase/types.ts
git commit -m "feat(support): support_messages table, submit RPC and admin view"
```

---

### Task 3: Derived-salt IP hashing

**Files:**
- Create: `lib/support-ip.ts`
- Create: `lib/support-ip.test.ts`

**Interfaces:**
- Produces: `hashIp(forwardedFor: string | null, secret: string | undefined): string | null`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test** — `lib/support-ip.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { hashIp } from "./support-ip";

const SECRET = "test-service-key";

describe("hashIp", () => {
  it("returns null when there is no forwarded address", () => {
    expect(hashIp(null, SECRET)).toBeNull();
    expect(hashIp("", SECRET)).toBeNull();
    expect(hashIp("   ", SECRET)).toBeNull();
  });

  it("returns null when the secret is absent, rather than hashing weakly", () => {
    expect(hashIp("203.0.113.7", undefined)).toBeNull();
  });

  it("uses only the first address in a proxy chain", () => {
    expect(hashIp("203.0.113.7, 198.51.100.4", SECRET)).toBe(hashIp("203.0.113.7", SECRET));
  });

  it("is stable for one address and differs across addresses", () => {
    expect(hashIp("203.0.113.7", SECRET)).toBe(hashIp("203.0.113.7", SECRET));
    expect(hashIp("203.0.113.7", SECRET)).not.toBe(hashIp("203.0.113.8", SECRET));
  });

  it("changes with the secret, so a key rotation resets the window", () => {
    expect(hashIp("203.0.113.7", SECRET)).not.toBe(hashIp("203.0.113.7", "other-key"));
  });

  it("never contains the raw address", () => {
    const hash = hashIp("203.0.113.7", SECRET);
    expect(hash).not.toBeNull();
    expect(hash).not.toContain("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/support-ip.test.ts`
Expected: FAIL — `Failed to resolve import "./support-ip"`.

- [ ] **Step 3: Implement** — `lib/support-ip.ts`

```ts
import { createHmac } from "node:crypto";

/**
 * Salted hash of a visitor's address, for the support form's rate limit.
 *
 * The salt is DERIVED from a secret the app already holds rather than read
 * from a new environment variable, so the page needs no deployment setup
 * (spec §5). HMAC output never reveals its key, so this neither weakens nor
 * exposes that credential. When the secret is absent the function returns
 * null -- rate limiting simply does not engage -- because storing a
 * weakly-salted address hash would be worse than storing nothing: the IPv4
 * space is small enough to brute-force.
 */
export function hashIp(forwardedFor: string | null, secret: string | undefined): string | null {
  if (!secret) return null;
  const first = forwardedFor?.split(",")[0]?.trim();
  if (!first) return null;
  return createHmac("sha256", secret).update(`support-ip:${first}`).digest("hex");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/support-ip.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
npm test && npm run typecheck && npm run lint
git add lib/support-ip.ts lib/support-ip.test.ts
git commit -m "feat(support): derived-salt address hashing for the rate limit"
```

---

### Task 4: Server action

**Files:**
- Create: `app/(public)/support/actions.ts`

**Interfaces:**
- Consumes: `supportMessageSchema` (Task 1), `hashIp` (Task 3), the RPC and its types (Task 2), `createServerSupabase` from `@/lib/supabase/server`.
- Produces: `type SupportActionResult = { ok: true } | { ok: false; error: string }`; `submitSupportMessageAction(input: unknown): Promise<SupportActionResult>`.

This mirrors `app/(public)/join/actions.ts` — parse, call the RPC, map the error to Georgian. It has no unit test of its own: it is a thin composition of three already-tested units plus a network call, and Task 7's e2e covers it end to end. Do not add a mocked-Supabase test that asserts the mock.

- [ ] **Step 1: Write the action** — `app/(public)/support/actions.ts`

```ts
"use server";

import { headers } from "next/headers";
import { SUPPORT_FAILURE, SUPPORT_RATE_LIMITED } from "@/lib/support-copy";
import { hashIp } from "@/lib/support-ip";
import { supportMessageSchema } from "@/lib/support-schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export type SupportActionResult = { ok: true } | { ok: false; error: string };

export async function submitSupportMessageAction(input: unknown): Promise<SupportActionResult> {
  const parsed = supportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? SUPPORT_FAILURE };
  }

  const requestHeaders = await headers();
  const ipHash = hashIp(
    requestHeaders.get("x-forwarded-for"),
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("submit_support_message", {
    p_name: parsed.data.name,
    p_email: parsed.data.email ?? null,
    p_phone: parsed.data.phone ?? null,
    p_message: parsed.data.message,
    p_ip_hash: ipHash,
  });

  if (error) {
    // The throttle is the one failure a visitor can act on, so it is the one
    // that gets its own line; everything else is an honest generic failure.
    if (error.message.includes("too_many_requests")) {
      return { ok: false, error: SUPPORT_RATE_LIMITED };
    }
    return { ok: false, error: SUPPORT_FAILURE };
  }
  return { ok: true };
}
```

- [ ] **Step 2: Verify and commit**

```bash
npm run typecheck && npm run lint
git add "app/(public)/support/actions.ts"
git commit -m "feat(support): server action storing a support message"
```

---

### Task 5: Public page, form and footer link

**Files:**
- Create: `app/(public)/support/page.tsx`
- Create: `app/(public)/support/SupportForm.tsx`
- Create: `app/(public)/support/SupportForm.test.tsx`
- Modify: `app/(public)/layout.tsx` (add to `footerLinks`)

**Interfaces:**
- Consumes: `submitSupportMessageAction` (Task 4), the copy module (Task 1), `Card`, `Field`, `Button`.
- Produces: the `/support` route and its footer entry.

- [ ] **Step 1: Write the failing test** — `app/(public)/support/SupportForm.test.tsx`

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SupportForm } from "./SupportForm";
import {
  SUPPORT_NEED_CONTACT,
  SUPPORT_RATE_LIMITED,
  SUPPORT_SUBMIT_LABEL,
  SUPPORT_SUCCESS,
} from "@/lib/support-copy";

const NAME = "ნინო";
const MESSAGE = "ა".repeat(20);

function fill(over: { name?: string; email?: string; phone?: string; message?: string } = {}) {
  fireEvent.change(screen.getByLabelText(/სახელი/), { target: { value: over.name ?? NAME } });
  fireEvent.change(screen.getByLabelText(/ელ-ფოსტა/), { target: { value: over.email ?? "" } });
  fireEvent.change(screen.getByLabelText(/ტელეფონი/), { target: { value: over.phone ?? "" } });
  fireEvent.change(screen.getByLabelText(/შეტყობინება/), {
    target: { value: over.message ?? MESSAGE },
  });
}

describe("SupportForm", () => {
  it("refuses to submit when neither email nor phone is given", async () => {
    const submit = vi.fn();
    render(<SupportForm submit={submit} />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }));
    expect(await screen.findByText(SUPPORT_NEED_CONTACT)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits with only a phone and shows the success line", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: true });
    render(<SupportForm submit={submit} />);
    fill({ phone: "+995555123456" });
    fireEvent.click(screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }));
    expect(await screen.findByText(SUPPORT_SUCCESS)).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("replaces the form with the success line so a message cannot be double-sent", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: true });
    render(<SupportForm submit={submit} />);
    fill({ email: "someone@example.com" });
    fireEvent.click(screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }));
    await screen.findByText(SUPPORT_SUCCESS);
    expect(screen.queryByRole("button", { name: SUPPORT_SUBMIT_LABEL })).not.toBeInTheDocument();
  });

  it("shows the server's error and keeps what was typed", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: false, error: SUPPORT_RATE_LIMITED });
    render(<SupportForm submit={submit} />);
    fill({ email: "someone@example.com" });
    fireEvent.click(screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }));
    expect(await screen.findByText(SUPPORT_RATE_LIMITED)).toBeInTheDocument();
    expect(screen.getByLabelText(/შეტყობინება/)).toHaveValue(MESSAGE);
  });

  it("disables the button while in flight", async () => {
    let release: (v: { ok: true }) => void = () => {};
    const submit = vi.fn().mockReturnValue(new Promise<{ ok: true }>((r) => (release = r)));
    render(<SupportForm submit={submit} />);
    fill({ email: "someone@example.com" });
    const button = screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    release({ ok: true });
    await screen.findByText(SUPPORT_SUCCESS);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run "app/(public)/support/SupportForm.test.tsx"`
Expected: FAIL — `Failed to resolve import "./SupportForm"`.

- [ ] **Step 3: Implement the form** — `app/(public)/support/SupportForm.tsx`

The `submit` prop is injected so the test drives the component without a server. `page.tsx` passes the real action.

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Field, inputClasses } from "@/components/Field";
import {
  SUPPORT_EMAIL_LABEL,
  SUPPORT_FAILURE,
  SUPPORT_MESSAGE_LABEL,
  SUPPORT_NAME_LABEL,
  SUPPORT_PHONE_LABEL,
  SUPPORT_SUBMIT_LABEL,
  SUPPORT_SUCCESS,
} from "@/lib/support-copy";
import { supportMessageSchema } from "@/lib/support-schemas";
import type { SupportActionResult } from "./actions";

export function SupportForm({
  submit,
}: {
  submit: (input: unknown) => Promise<SupportActionResult>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = { name, email, phone, message };
    // Client-side parse is UX only -- the action re-parses and the RPC
    // re-checks. It exists so a missing contact is named before a round trip.
    const parsed = supportMessageSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? SUPPORT_FAILURE);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await submit(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return <p className="font-serif text-[1.02rem] text-prose">{SUPPORT_SUCCESS}</p>;
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      <Field
        label={SUPPORT_NAME_LABEL}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
      />
      <Field
        label={SUPPORT_EMAIL_LABEL}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={120}
      />
      <Field
        label={SUPPORT_PHONE_LABEL}
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        maxLength={40}
      />
      <label className="flex flex-col gap-1.5">
        <span className="block text-[0.74rem] font-bold tracking-[.08em] text-muted-fg mb-1">
          {SUPPORT_MESSAGE_LABEL}
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          maxLength={2000}
          className={`${inputClasses} h-auto resize-y py-2`}
        />
      </label>
      {error ? <p className="text-[0.8rem] text-brand">{error}</p> : null}
      <div>
        <Button type="submit" disabled={busy}>
          {SUPPORT_SUBMIT_LABEL}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run "app/(public)/support/SupportForm.test.tsx"`
Expected: PASS, 5 tests.

- [ ] **Step 5: Implement the page** — `app/(public)/support/page.tsx`

```tsx
import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { SUPPORT_HEADING, SUPPORT_LEDE } from "@/lib/support-copy";
import { submitSupportMessageAction } from "./actions";
import { SupportForm } from "./SupportForm";

export const metadata: Metadata = { title: SUPPORT_HEADING };

export default function SupportPage() {
  return (
    <main className="mx-auto flex w-full max-w-[46rem] flex-col gap-6 px-4 py-10 md:px-8">
      <h1 className="font-serif text-[2.1rem] leading-tight text-ink">{SUPPORT_HEADING}</h1>
      <p className="font-serif text-[1.02rem] text-prose">{SUPPORT_LEDE}</p>
      <Card>
        <SupportForm submit={submitSupportMessageAction} />
      </Card>
    </main>
  );
}
```

- [ ] **Step 6: Add the footer link** — `app/(public)/layout.tsx`

Import the label and add the entry to `footerLinks` (leave `navItems` untouched — spec §8 keeps this out of the top nav):

```tsx
import { SUPPORT_FOOTER_LABEL } from "@/lib/support-copy";
```

```tsx
const footerLinks: { href: string; label: string }[] = [
  { href: "/join/terms", label: FOOTER_TERMS_LABEL },
  { href: "/news", label: NAV_NEWS_LABEL },
  { href: "/transparency", label: NAV_TRANSPARENCY_LABEL },
  { href: "/support", label: SUPPORT_FOOTER_LABEL },
];
```

- [ ] **Step 7: Gates and commit**

```bash
npm test && npm run typecheck && npm run lint
node scripts/ka-gate.mjs --diff main "app/(public)/support/page.tsx" "app/(public)/support/SupportForm.tsx" "app/(public)/support/SupportForm.test.tsx" "app/(public)/layout.tsx"
git add "app/(public)/support" "app/(public)/layout.tsx"
git commit -m "feat(support): public contact page and footer link"
```

---

### Task 6: Admin list

**Files:**
- Create: `app/(admin)/admin/support/page.tsx`
- Modify: `lib/admin.ts` (`TAB_MATRIX`)
- Modify: `lib/admin.test.ts` (extend the existing `adminTabs` assertions — that is where this function is already tested; `components/AdminNav.test.tsx` tests the rendered nav and is not the right home for a role-matrix assertion)

**Interfaces:**
- Consumes: `admin_support_messages` (Task 2), `SUPPORT_ADMIN_TAB_LABEL` / `SUPPORT_ADMIN_EMPTY` (Task 1), `getAdminRoles`, `hasAnyRole`, `DataTable`, `formatDateTimeKa`.
- Produces: the `/admin/support` route and its tab.

- [ ] **Step 1: Write the failing test** — extend `lib/admin.test.ts`

Read the file first and follow its existing `adminTabs` idiom. Add a case asserting that a `super_admin` sees the new tab and nobody else does:

```tsx
  it("shows the support tab to a super_admin only", () => {
    expect(adminTabs(["super_admin"]).some((t) => t.href === "/admin/support")).toBe(true);
    expect(adminTabs(["verifier"]).some((t) => t.href === "/admin/support")).toBe(false);
    expect(adminTabs(["editor"]).some((t) => t.href === "/admin/support")).toBe(false);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/admin.test.ts`
Expected: FAIL — the first expectation is `false`.

- [ ] **Step 3: Register the tab** — `lib/admin.ts`

Import the label and insert the entry after `/admin/audit`, keeping the existing order otherwise:

```ts
import { SUPPORT_ADMIN_TAB_LABEL } from "./support-copy";
```

```ts
  { href: "/admin/support", label: SUPPORT_ADMIN_TAB_LABEL, roles: ["super_admin"] },
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the page** — `app/(admin)/admin/support/page.tsx`

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { formatDateTimeKa, hasAnyRole } from "@/lib/admin";
import {
  SUPPORT_ADMIN_EMPTY,
  SUPPORT_ADMIN_TAB_LABEL,
  SUPPORT_EMAIL_LABEL,
  SUPPORT_MESSAGE_LABEL,
  SUPPORT_NAME_LABEL,
  SUPPORT_PHONE_LABEL,
} from "@/lib/support-copy";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export const metadata: Metadata = { title: SUPPORT_ADMIN_TAB_LABEL };

const PAGE_SIZE = 50;

export default async function AdminSupportPage() {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) redirect("/admin");

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("admin_support_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  const rows = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-ink">{SUPPORT_ADMIN_TAB_LABEL}</h1>
      <Card padded={rows.length === 0}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-fg">{SUPPORT_ADMIN_EMPTY}</p>
        ) : (
          <DataTable
            bodyTestId="support-messages"
            head={
              <>
                <th className={tableThClass}>{SUPPORT_NAME_LABEL}</th>
                <th className={tableThClass}>{SUPPORT_EMAIL_LABEL}</th>
                <th className={tableThClass}>{SUPPORT_PHONE_LABEL}</th>
                <th className={tableThClass}>{SUPPORT_MESSAGE_LABEL}</th>
              </>
            }
          >
            {rows.map((row) => (
              <tr key={row.id} className={tableRowClass}>
                <td className={tableCellClass}>
                  {row.name}
                  <span className="block text-[0.74rem] text-muted-fg">
                    {formatDateTimeKa(row.created_at)}
                  </span>
                </td>
                <td className={tableCellClass}>{row.email ?? "—"}</td>
                <td className={tableCellClass}>{row.phone ?? "—"}</td>
                <td className={`${tableCellClass} whitespace-pre-wrap`}>{row.message}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
```

Before running, confirm `formatDateTimeKa` and `hasAnyRole` are exported from `lib/admin.ts` with those names (both are used by `app/(admin)/admin/audit/page.tsx`); if a signature differs, follow the audit page rather than this snippet.

- [ ] **Step 6: Gates and commit**

```bash
npm test && npm run typecheck && npm run lint
node scripts/ka-gate.mjs --diff main "app/(admin)/admin/support/page.tsx" lib/admin.ts
git add "app/(admin)/admin/support/page.tsx" lib/admin.ts lib/admin.test.ts
git commit -m "feat(support): read-only admin list of support messages"
```

---

### Task 7: Mixed-script scan, e2e, and the whole-branch gates

**Files:**
- Create: `scripts/mixed-script-scan.mjs`
- Create: `e2e/support.spec.ts`
- Modify: `package.json` (add the scan to the `test:gates` path if one exists; otherwise leave scripts alone and call it directly)

**Interfaces:**
- Consumes: `lib/support-copy.ts` (Task 1).
- Produces: a reusable scan any future Georgian work can run.

Spec §9 requires a mixed-script scan because ka-gate explicitly does not catch a Latin letter fused inside a Georgian word. That gap is documented in DESIGN.md:179 but has never had a tool. This makes it one.

- [ ] **Step 1: Write the scan** — `scripts/mixed-script-scan.mjs`

Every pattern is built from `\uXXXX` escapes, never literal glyphs, so the file stays ASCII-clean and cannot itself be silently normalized — the same discipline `scripts/ka-gate.mjs` uses.

```js
// Usage: node scripts/mixed-script-scan.mjs <file> [...files]
//
// The backstop DESIGN.md:179 calls for and ka-gate deliberately omits: a lone
// Latin or Cyrillic letter fused inside a Georgian word (e.g. a Latin "o" in
// "მოგვწერე") passes every ka-gate check and would ship. This asserts that any
// string literal containing Georgian contains ONLY Georgian, digits, and the
// punctuation our copy uses.
import { readFileSync } from "node:fs";

const GEO = "\\u10A0-\\u10FF\\u1C90-\\u1CBF\\u2D00-\\u2D2F";
// space . , ( ) - : ! ? and the em dash, plus ASCII digits.
const PUNCT = "\\u0020\\u002E\\u002C\\u0028\\u0029\\u002D\\u003A\\u0021\\u003F\\u2014\\u0030-\\u0039";
const hasGeo = new RegExp("[" + GEO + "]", "u");
const pure = new RegExp("^[" + GEO + PUNCT + "]+$", "u");
const allowedChar = new RegExp("[" + GEO + PUNCT + "]", "u");

let failures = 0;
for (const file of process.argv.slice(2)) {
  const source = readFileSync(file, "utf8");
  // Double-quoted, single-quoted and backtick literals.
  const literals = source.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) ?? [];
  for (const raw of literals) {
    const value = raw.slice(1, -1);
    if (!hasGeo.test(value) || pure.test(value)) continue;
    const offenders = [...new Set([...value].filter((ch) => !allowedChar.test(ch)))];
    console.log(
      "MIXED-SCRIPT " + file + "  " + raw + "  offending: " +
        offenders
          .map((ch) => "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"))
          .join(" "),
    );
    failures++;
  }
}
console.log("mixed-script scan: " + (failures === 0 ? "clean" : failures + " impure literal(s)"));
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it against the copy module**

Run: `node scripts/mixed-script-scan.mjs lib/support-copy.ts`
Expected: `mixed-script scan: clean`, exit 0.

- [ ] **Step 3: Prove the scan actually catches corruption**

Temporarily replace one Georgian letter in a `lib/support-copy.ts` string with a Latin `o`, re-run the scan, and confirm it reports `MIXED-SCRIPT` with `offending: U+006F` and exits 1. **Then revert the edit** (`git checkout -- lib/support-copy.ts`) and re-run to confirm `clean`. A gate never demonstrated failing is not a gate.

- [ ] **Step 4: Write the e2e journey** — `e2e/support.spec.ts`

Follow `e2e/public.spec.ts` for imports and idiom. The seeded-staging caveat at the top of that file applies here too.

```ts
import { expect, test } from "@playwright/test";
import {
  SUPPORT_HEADING,
  SUPPORT_SUBMIT_LABEL,
  SUPPORT_SUCCESS,
} from "../lib/support-copy";

test.describe("support", () => {
  test("a visitor reaches the page from the footer and sends a message", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: SUPPORT_HEADING }).click();
    await expect(page.getByRole("heading", { name: SUPPORT_HEADING })).toBeVisible();

    await page.getByLabel(/სახელი/).fill("ნინო");
    await page.getByLabel(/ტელეფონი/).fill("+995555123456");
    await page.getByLabel(/შეტყობინება/).fill("ა".repeat(20));
    await page.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }).click();

    await expect(page.getByText(SUPPORT_SUCCESS)).toBeVisible();
  });

  test("the form refuses a message with no way to reply", async ({ page }) => {
    await page.goto("/support");
    await page.getByLabel(/სახელი/).fill("ნინო");
    await page.getByLabel(/შეტყობინება/).fill("ა".repeat(20));
    await page.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }).click();
    await expect(page.getByText(SUPPORT_SUCCESS)).toBeHidden();
  });
});
```

- [ ] **Step 5: Run the whole gate set**

```bash
npm test && npm run typecheck && npm run lint
node scripts/ka-gate.mjs --diff main lib/support-copy.ts lib/support-schemas.ts lib/support-ip.ts "app/(public)/support/page.tsx" "app/(public)/support/SupportForm.tsx" "app/(public)/layout.tsx" "app/(admin)/admin/support/page.tsx" lib/admin.ts e2e/support.spec.ts
node scripts/mixed-script-scan.mjs lib/support-copy.ts
```

Expected: all green, both gates clean. The e2e run needs the migration applied, so it happens in Task 8 — do not run `npm run e2e` before then.

- [ ] **Step 6: Commit**

```bash
git add scripts/mixed-script-scan.mjs e2e/support.spec.ts
git commit -m "test(support): mixed-script scan and the support-page journey"
```

---

### Task 8: Owner applies the migration, then live verification

**Files:** none — this task changes no code.

This is the one task that cannot be done from here: the owner applies the migration to staging, because staging is the only database and it holds real accounts (never reseed or wipe it).

- [ ] **Step 1: Owner applies the migration**

Give the owner this command, in its own block, and confirm the listing shows the new version as pending before it is applied:

```bash
npx supabase migration list
```

```bash
npx supabase db push
```

- [ ] **Step 2: Run the e2e suite against the preview**

Run: `npm run e2e -- support`
Expected: both journeys pass.

- [ ] **Step 3: Verify the admin side by hand on the preview**

As a `super_admin`, open `/admin/support` and confirm the message sent by the e2e run is listed with its name, phone and text. As a non-super-admin, confirm `/admin/support` redirects to `/admin` and that the tab is absent.

- [ ] **Step 4: Confirm the throttle**

Send four messages in under ten minutes from one browser and confirm the fourth shows `ბევრი შეტყობინება გაიგზავნა — სცადე ცოტა ხნის შემდეგ.`

- [ ] **Step 5: Record the decision** — append to `DECISIONS.md`

An ADR covering: the support page ships without email by owner decision (2026-08-02); the destination supplied was a test address and the real one will differ; the anti-spam salt is derived from the service key rather than configured, so the page needs no deployment setup; and `emailed_at` is deliberately absent until mail ships. No new dependency was added, so this ADR records a design decision rather than a dependency rationale.

```bash
git add DECISIONS.md
git commit -m "docs: ADR for the support page shipping without email"
```

---

## Self-Review

**Spec coverage:** §1 purpose → Task 5. §2 decisions → Tasks 1, 5. §3 copy block → Task 1 (all 22 constants). §4 data → Task 2. §5 server flow and derived salt → Tasks 3, 4. §6 admin reading → Task 6. §7 out-of-scope email → no task, correctly (nothing to build), recorded in Task 8 Step 5. §8 footer link → Task 5 Step 6. §9 integrity → Task 1 Step 6, Task 5 Step 7, Task 6 Step 6, Task 7. §10 testing → Tasks 1, 3, 5, 6, 7, 8. §11 not-doing → nothing built.

**Placeholder scan:** no TBD/TODO; every code step carries complete code; no "similar to Task N".

**Type consistency:** `SupportActionResult` is defined in Task 4 and consumed by Task 5's `SupportForm` prop. `hashIp(forwardedFor, secret)` matches between Tasks 3 and 4. The RPC's five arguments match between Task 2's SQL, Task 2's types entry and Task 4's call. The view's `Row` shape matches between Task 2 and Task 6's column reads. `supportMessageSchema` output (`email?: string`) matches Task 4's `?? null` coercion.

**Known deviation from the plan template:** Task 2 and Task 4 have no red-green cycle. Task 2 cannot have one (no local database, ADR-005); Task 4 would only assert a mock. Both are covered by Task 7's e2e and Task 8's live verification, which is the honest place for that coverage.
