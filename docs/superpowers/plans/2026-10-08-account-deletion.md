# Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in person deletes their own account and every piece of personal data with it; a super_admin can do the same on someone's request.

**Architecture:** One internal SECURITY DEFINER function, `erase_account(uuid)`, does the whole erasure in one transaction (team hand-over, audit scrub, `delete from auth.users`, which cascades the rest). Two thin client-callable wrappers check the caller: `delete_my_account(confirm word)` and `admin_delete_member(user, reason)`. The app adds a danger section on the profile page, an admin row action, a public `/account-deleted` page, a "your delegate left" note, and one sentence in the privacy policy. Ships in two merges: migration-only first, then code.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (Postgres, auth, storage), zod 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-account-deletion-design.md`

## Global Constraints

- CLAUDE.md applies: TypeScript strict, no `any`, no `@ts-ignore`; zod at every action boundary; domain logic in `lib/` with no React/Next imports; Georgian UI text; reuse design-system components (DESIGN.md), no ad hoc restyling.
- Schema changes only in `supabase/migrations/`. The migration is additive for the code on `main`: votes stay one-per-member, the audit log still refuses every client write, nothing on `main` calls the new functions.
- Admin mutations audit in the same transaction (ADR-014); `lib/security/schema-guards.test.ts` pins it.
- Service-role client only after the server has established who the caller is (here: Storage removal of a path the database returned).
- Every new Georgian string lives in `lib/account-deletion-copy.ts`, copied byte-for-byte from this plan; run `node scripts/ka-gate.mjs --diff origin/main <files>` and `npm run ka:scan` on every task that adds Georgian.
- Register: informal singular ("შენ"), like the rest of the public and cabinet voice (ADR-025).
- Confirmation word: `წაშლა` (exactly; trimmed input). Defined once in `lib/account-deletion.ts` and once in the migration; a test keeps them equal.
- Migration files: `supabase/migrations/20261009140000_account_deletion.sql` (after the security release's `20261008160000`–`160300`) and `supabase/migrations/20261009150000_account_deletion_hardening.sql` (the whole-branch review's fixes; it restates `erase_account`). Both ship in Release A.
- Staging is shared with the security session until its release merges: coordinate before pushing to staging (Task 2).
- Merge = release to both sites. Release A (Tasks 1–3) merges and is applied to production before Release B (Tasks 4–12) merges.

## File map

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/20261009140000_account_deletion.sql` | schema changes + the three functions | 1 |
| `supabase/migrations/20261009150000_account_deletion_hardening.sql` | review fixes: `erase_account` restated (row locks, running-poll votes deleted, auth log scrub, `staff_history` detail), service_role and sequence revokes, SMS reservations kept without the account | final review |
| `lib/account-deletion.ts` | confirmation word, zod schemas, photo-path helper | 1, 4 |
| `lib/account-deletion-migration.test.ts` | static pins on the migration | 1 |
| `lib/security/schema-guards.test.ts` | ADR-014 table gets `admin_delete_member` | 1 |
| `lib/admin.ts` | audit label for `member.delete` | 1 |
| `lib/supabase/types.ts` | `poll_votes`, `memberships`, two RPCs | 1 |
| `.github/workflows/production-db.yml` | migration baseline count | 1 |
| `scripts/verify-account-deletion.mjs` | staging-pinned live probe | 2 |
| `lib/account-deletion-copy.ts` | every new Georgian string | 4 |
| `lib/funnel.ts` | five new error tokens | 4 |
| `app/(member)/me/profile/delete-account-actions.ts` | member self-deletion action | 5 |
| `components/DeleteAccountSection.tsx` | the danger section (client) | 6 |
| `app/(member)/me/profile/page.tsx` | renders the section in both variants | 6 |
| `app/(public)/account-deleted/page.tsx` | goodbye page | 7 |
| `app/(member)/me/delegate/page.tsx` | "your delegate left" note | 8 |
| `app/(admin)/admin/members/delete-member-actions.ts` + `DeleteMemberButton.tsx` | admin delete on request | 9 |
| `app/(public)/privacy/page.tsx` | rights + retention sentences | 10 |
| `e2e/account-deletion.spec.ts` | one journey | 11 |
| `DECISIONS.md` | ADR-047 | 12 |

---

## Release A — database (migration-only PR, branch `claude/account-deletion-db`)

### Task 1: The migration, its static pins, types and baseline count

**Files:**
- Create: `supabase/migrations/20261009140000_account_deletion.sql`
- Create: `lib/account-deletion.ts`
- Create: `lib/account-deletion-migration.test.ts`
- Modify: `lib/security/schema-guards.test.ts` (the `ADMIN_RPCS` table, around line 697)
- Modify: `lib/admin.ts` (`AUDIT_ACTION_LABELS_KA`, around line 82)
- Modify: `lib/supabase/types.ts` (`memberships` ~line 79, `poll_votes` ~line 280, `Functions` ~line 572)
- Modify: `.github/workflows/production-db.yml` (both `EXPECTED_MIGRATION_FILE_COUNT` lines)

**Interfaces:**
- Produces: `ACCOUNT_DELETION_CONFIRM_WORD: "წაშლა"` from `lib/account-deletion.ts`; RPCs `delete_my_account(p_confirm text) → jsonb {photoUrl: string|null}` and `admin_delete_member(p_user_id uuid, p_reason text) → jsonb {photoUrl: string|null}`; error tokens `staff_account`, `staff_history`, `invalid_confirmation`, `invalid_reason`, `cannot_delete_self`, plus existing `not_authenticated`, `missing_role`, `invalid_target`; audit action `member.delete`; `memberships.note = 'delegate_left'`.

- [ ] **Step 1: Write the failing static tests**

`lib/account-deletion.ts` (only the constant in this task; Task 4 adds the rest):

```ts
/**
 * Account deletion (spec docs/superpowers/specs/2026-10-08-account-deletion-design.md).
 * Pure: no React, no Next. The confirmation word is duplicated in the migration's
 * delete_my_account(); lib/account-deletion-migration.test.ts keeps the two equal.
 */
export const ACCOUNT_DELETION_CONFIRM_WORD = "წაშლა";
```

`lib/account-deletion-migration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCOUNT_DELETION_CONFIRM_WORD } from "./account-deletion";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261009140000_account_deletion.sql"),
  "utf8",
);
const fn = (name: string): string => {
  const start = sql.indexOf(`create function public.${name}(`);
  expect(start, `${name} is defined`).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("end $$;", start));
};

describe("account deletion migration", () => {
  it("checks the same confirmation word as the app", () => {
    expect(fn("delete_my_account")).toContain(
      `if p_confirm is distinct from '${ACCOUNT_DELETION_CONFIRM_WORD}' then`,
    );
  });

  it("keeps erase_account away from every client role", () => {
    expect(sql).toContain(
      "revoke execute on function public.erase_account(uuid) from public, anon, authenticated;",
    );
    expect(sql).not.toMatch(/grant execute on function public\.erase_account/);
  });

  it("grants the two wrappers to signed-in users only", () => {
    for (const sig of ["delete_my_account(text)", "admin_delete_member(uuid, text)"]) {
      expect(sql).toContain(`grant execute on function public.${sig} to authenticated;`);
      expect(sql).toContain(`revoke execute on function public.${sig} from public, anon;`);
    }
  });

  it("refuses staff before touching anything", () => {
    const body = fn("erase_account");
    const staff = body.indexOf("raise exception 'staff_account'");
    const firstWrite = body.search(/\b(update|insert into|delete from)\s/);
    expect(staff).toBeGreaterThan(-1);
    expect(firstWrite).toBeGreaterThan(staff);
    expect(body).toContain("when foreign_key_violation then");
    expect(body).toContain("raise exception 'staff_history'");
  });

  it("keeps votes anonymously and one vote per member", () => {
    expect(sql).toContain("alter table public.poll_votes alter column member_id drop not null;");
    expect(sql).toMatch(/references public\.profiles\(id\) on delete set null;/);
    expect(sql).toContain(
      "add constraint poll_votes_one_per_member unique (poll_id, member_id);",
    );
  });

  it("opens the audit log only for the erasure scrub, never for a client", () => {
    const trigger = sql.slice(sql.indexOf("create or replace function public.audit_log_immutable()"));
    expect(trigger).toContain("current_setting('app.erasing', true) = 'on'");
    for (const col of ["actor_id", "target_id"]) {
      expect(trigger).toContain(`new.${col} is not distinct from old.${col}`);
    }
    expect(trigger).toContain("raise exception 'audit_log is append-only';");
    expect(fn("erase_account")).toContain("perform set_config('app.erasing', 'on', true);");
    expect(fn("erase_account")).toContain("perform set_config('app.erasing', 'off', true);");
  });
});
```

In `lib/security/schema-guards.test.ts`, add to `ADMIN_RPCS` (keep the table's order by area: after `admin_reassign_member`):

```ts
    admin_delete_member: { roles: S, audit: "member.delete" },
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/account-deletion-migration.test.ts lib/security/schema-guards.test.ts lib/admin.test.ts`
Expected: FAIL — `ENOENT ... 20261009140000_account_deletion.sql`, and the schema guard reports `admin_delete_member` has no definition.

- [ ] **Step 3: Write the migration**

> **Superseded (final review, 2026-10-08).** The SQL block below is the plan-time draft and is
> kept for history only. The source of truth is the two migration files:
> `supabase/migrations/20261009140000_account_deletion.sql` (as applied, with the `slug`,
> reject-note, erased-marker and owner-lock fixes of review round 1) and
> `supabase/migrations/20261009150000_account_deletion_hardening.sql`, which restates
> `erase_account` (row locks, running-poll votes deleted, Supabase auth log scrub, the blocking key
> in the `staff_history` detail) and adds the service_role, sequence and SMS-reservation changes.
> Never copy from this block.

`supabase/migrations/20261009140000_account_deletion.sql`:

```sql
-- Account deletion (spec docs/superpowers/specs/2026-10-08-account-deletion-design.md,
-- ADR-047). Additive for the code on main: one vote per member still holds (now a unique
-- constraint instead of the primary key), the audit log still refuses every client write,
-- and nothing on main calls the new functions.

-- 1. A deleted member's poll votes keep counting, with no person attached (spec §4.1).
alter table public.poll_votes drop constraint poll_votes_pkey;
alter table public.poll_votes add column id bigserial;
alter table public.poll_votes add constraint poll_votes_pkey primary key (id);
alter table public.poll_votes alter column member_id drop not null;
alter table public.poll_votes drop constraint poll_votes_member_id_fkey;
alter table public.poll_votes add constraint poll_votes_member_id_fkey
  foreign key (member_id) references public.profiles(id) on delete set null;
-- THE one-vote-per-member rule (community spec §4) now lives here; nulls never collide.
alter table public.poll_votes
  add constraint poll_votes_one_per_member unique (poll_id, member_id);

-- 2. Members moved to the central movement because their delegate left (spec §3.2).
alter table public.memberships add column note text
  constraint memberships_note_known check (note in ('delegate_left'));

-- 3. Append-only, except the erasure scrub (spec §4.3). Clients hold no privilege on
--    audit_log at all, so this branch is reachable only from erase_account().
create or replace function public.audit_log_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and current_setting('app.erasing', true) = 'on'
     and new.id = old.id
     and new.actor_id is not distinct from old.actor_id
     and new.action = old.action
     and new.target_type = old.target_type
     and new.target_id is not distinct from old.target_id
     and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'audit_log is append-only';
end $$;

-- 4. The erasure itself (spec §2, §4.4). One transaction; deleting the auth user cascades
--    to profiles and from there to memberships, delegates, payments, RSVPs, admin roles and
--    phone proofs; votes are set null.
create function public.erase_account(p_user_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_photo_url text;
  v_team uuid[];
  v_personal_keys constant text[] :=
    array['name', 'memberName', 'firstName', 'lastName', 'personalId', 'phone', 'email'];
begin
  if p_user_id is null
     or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'invalid_target';
  end if;
  if exists (select 1 from public.admin_roles where user_id = p_user_id) then
    raise exception 'staff_account';
  end if;

  select photo_url into v_photo_url from public.delegates where id = p_user_id;

  -- the delegate's team moves to the central movement, marked for the cabinet note
  select coalesce(array_agg(member_id), '{}') into v_team
    from public.memberships where delegate_id = p_user_id and ended_at is null;
  update public.memberships set ended_at = now()
   where delegate_id = p_user_id and ended_at is null;
  insert into public.memberships (member_id, delegate_id, note)
    select unnest(v_team), null, 'delegate_left';
  -- history rows that still name the delegate lose the link (the FK would block the delete)
  update public.memberships set delegate_id = null where delegate_id = p_user_id;

  -- audit rows about the person keep the action, lose the personal details
  perform set_config('app.erasing', 'on', true);
  update public.audit_log
     set details = (details - v_personal_keys) || jsonb_build_object('erased', true)
   where target_id = p_user_id::text
     and details ?| v_personal_keys;
  -- delegate.update_name (20261008160200) names the delegate under from/to
  update public.audit_log
     set details = (details - array['from', 'to']) || jsonb_build_object('erased', true)
   where target_id = p_user_id::text
     and action = 'delegate.update_name';
  perform set_config('app.erasing', 'off', true);

  delete from auth.users where id = p_user_id;
  return jsonb_build_object('photoUrl', v_photo_url);
exception
  when foreign_key_violation then
    -- recorded payments, approvals, settings or audit rows as staff: keep the trail intact
    raise exception 'staff_history';
end $$;
revoke execute on function public.erase_account(uuid) from public, anon, authenticated;

create function public.delete_my_account(p_confirm text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_confirm is distinct from 'წაშლა' then raise exception 'invalid_confirmation'; end if;
  return public.erase_account(v_uid);
end $$;
grant execute on function public.delete_my_account(text) to authenticated;
revoke execute on function public.delete_my_account(text) from public, anon;

create function public.admin_delete_member(p_user_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''), E' \t\r\n');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  if length(v_reason) not between 5 and 300 then raise exception 'invalid_reason'; end if;
  if p_user_id is null then raise exception 'invalid_target'; end if;
  if p_user_id = v_uid then raise exception 'cannot_delete_self'; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.delete', 'profile', p_user_id::text,
          jsonb_build_object('reason', v_reason));
  return public.erase_account(p_user_id);
end $$;
grant execute on function public.admin_delete_member(uuid, text) to authenticated;
revoke execute on function public.admin_delete_member(uuid, text) from public, anon;
```

Before committing, re-grep the audit inserts for any other key that carries a person's name (`grep -n "insert into public.audit_log" -A4 supabase/migrations/*.sql`). Known today: `name`, `memberName`, and `from`/`to` on `delegate.update_name` (handled by its own update above); `member.reassign` may also name delegates (check its `jsonb_build_object` in `20260726121500_reassign_guard_approved_only.sql:84`). Add any such key to `v_personal_keys`, and if a key names a person other than the row's target (e.g. a delegate's name inside a member's reassign row), add a second `update` for rows where that key's companion id equals `p_user_id`. Record what you found in the migration comment.

- [ ] **Step 4: Labels, types, baseline count**

`lib/admin.ts`, in `AUDIT_ACTION_LABELS_KA` next to the other `member.*` labels:

```ts
  "member.delete": "წევრის წაშლა მოთხოვნით",
```

`lib/supabase/types.ts`:

```ts
      memberships: {
        Row: {
          id: number;
          member_id: string;
          delegate_id: string | null;
          started_at: string;
          ended_at: string | null;
          note: "delegate_left" | null;
        };
```

```ts
      poll_votes: {
        Row: {
          id: number;
          poll_id: string;
          option_id: string;
          member_id: string | null;
          created_at: string;
        };
```

In `Functions`, next to `member_cast_vote`:

```ts
      delete_my_account: { Args: { p_confirm: string }; Returns: Json };
      admin_delete_member: { Args: { p_user_id: string; p_reason: string }; Returns: Json };
```

`.github/workflows/production-db.yml`: set both `EXPECTED_MIGRATION_FILE_COUNT` lines to the number of files in `supabase/migrations` (42 now that the security release is on main; recount at merge time either way).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/account-deletion-migration.test.ts lib/security lib/admin.test.ts lib/production-db-workflow.test.ts && npm run typecheck`
Expected: PASS. If `tsc` reports a consumer of `poll_votes.member_id` as `string`, it is a read of the caller's own vote: narrow with `?? ""` only where the value is compared to `auth.uid()`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261009140000_account_deletion.sql lib/account-deletion.ts lib/account-deletion-migration.test.ts lib/security/schema-guards.test.ts lib/admin.ts lib/supabase/types.ts .github/workflows/production-db.yml
git commit -m "feat(db): account deletion - erase_account, two wrappers, anonymous votes, audit scrub"
```

### Task 2: Live probe on staging

**Files:**
- Create: `scripts/verify-account-deletion.mjs`

**Interfaces:**
- Consumes: the RPCs and tokens from Task 1.

- [ ] **Step 1: Coordinate staging.** Ask the security session (`Portal security audit (fork)`) whether its release has merged; until it has, it owns staging pushes. Push only with its agreement, from a checkout linked to staging (`supabase/.temp/project-ref` = `orcxtbedkexoclbfgvzd`), env loaded from the staging `.env.local`:

```bash
node --env-file=.env.local -e "process.exit(require('child_process').spawnSync('npx',['supabase','db','push','--linked','--include-all'],{stdio:'inherit',shell:true}).status)"
```

Expected: only `20261009140000_account_deletion.sql` (plus any migration the security session told you to expect) is applied.

- [ ] **Step 2: Write the probe** (refuses anything but staging, cleans up after itself)

```js
// Live probe for account deletion (plan 2026-10-08-account-deletion, Task 2). STAGING ONLY.
// Run: node --env-file=.env.local scripts/verify-account-deletion.mjs
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomInt } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || !anonKey) throw new Error("needs the staging .env.local");
const { protocol, hostname } = new URL(url);
if (protocol !== "https:" || hostname !== "orcxtbedkexoclbfgvzd.supabase.co") {
  throw new Error("refusing: this probe is staging-only (project host mismatch)");
}
const db = createClient(url, key, { auth: { persistSession: false } });
const created = [];

async function person(label, { completed = true } = {}) {
  const email = `probe-delete-${label}-${randomBytes(4).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const id = data.user.id;
  created.push(id);
  const { data: region } = await db.from("regions").select("id").order("id").limit(1).single();
  const { data: city } = await db
    .from("cities").select("id").eq("region_id", region.id).order("id").limit(1).single();
  const { error: pErr } = await db.from("profiles").insert({
    id,
    first_name: "პრობი",
    last_name: label,
    phone: `+99555${randomInt(1000000, 9999999)}`,
    ...(completed
      ? {
          personal_id: `9${randomInt(1000000000, 9999999999)}`,
          birth_date: "1990-01-01",
          region_id: region.id,
          city_id: city.id,
          employment: "პრობი",
          status: "profile_completed",
          registration_completed_at: new Date().toISOString(),
        }
      : {}),
  });
  if (pErr) throw new Error(`profile ${label}: ${pErr.message}`);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw new Error(`sign-in ${label}: ${sErr.message}`);
  return { id, client };
}

async function expectError(promise, token, what) {
  const { error } = await promise;
  if (!error || !error.message.includes(token)) {
    throw new Error(`${what}: expected '${token}', got ${error ? error.message : "success"}`);
  }
}

try {
  // A. wrong word refused; right word erases the member and the sign-in account
  const a = await person("member");
  await expectError(a.client.rpc("delete_my_account", { p_confirm: "delete" }), "invalid_confirmation", "wrong word");
  const { error: delErr } = await a.client.rpc("delete_my_account", { p_confirm: "წაშლა" });
  if (delErr) throw new Error(`delete_my_account (owner may lack delete on auth.users?): ${delErr.message}`);
  const { data: gone } = await db.from("profiles").select("id").eq("id", a.id).maybeSingle();
  if (gone) throw new Error("profile survived");
  const { data: authUser } = await db.auth.admin.getUserById(a.id);
  if (authUser?.user) throw new Error("auth user survived");
  console.log("OK: member erased with the sign-in account; wrong word refused");

  // B. delegate erased: team member lands on central with the note
  const d = await person("delegate");
  const m = await person("teammate");
  await db.from("delegates").insert({ id: d.id, status: "approved", slug: `probe-${d.id.slice(0, 8)}`, referral_code: `PRB${randomInt(100000, 999999)}`, tc_accepted_at: new Date().toISOString() });
  await db.from("memberships").insert({ member_id: m.id, delegate_id: d.id });
  const { error: dErr } = await d.client.rpc("delete_my_account", { p_confirm: "წაშლა" });
  if (dErr) throw new Error(`delegate delete: ${dErr.message}`);
  const { data: open } = await db
    .from("memberships").select("delegate_id, note").eq("member_id", m.id).is("ended_at", null).single();
  if (open.delegate_id !== null || open.note !== "delegate_left") throw new Error(`team row wrong: ${JSON.stringify(open)}`);
  console.log("OK: delegate erased; team moved to central with note=delegate_left");

  // C. staff refused
  const s = await person("staff");
  await db.from("admin_roles").insert({ user_id: s.id, role: "editor", granted_by: null });
  await expectError(s.client.rpc("delete_my_account", { p_confirm: "წაშლა" }), "staff_account", "staff self-delete");
  console.log("OK: staff account refused");

  // D. clients still cannot write the audit log
  await expectError(s.client.from("audit_log").update({ details: {} }).eq("id", -1).select(), "permission denied", "client audit update");
  console.log("OK: audit_log still closed to clients");
} finally {
  for (const id of created) await db.auth.admin.deleteUser(id).catch(() => {});
  await db.from("admin_roles").delete().in("user_id", created);
}
```

The vote check (spec §6) needs an open poll; add it here if a staging poll is available (`select id from polls where status = 'open' limit 1`): cast a vote as a throwaway member through `member_cast_vote`, count the option's votes, delete the member, count again, expect the same number and a row with `member_id is null`. If no open poll exists, record "vote check skipped: no open poll on staging" in the PR.

- [ ] **Step 3: Run it**

Run: `node --env-file=.env.local scripts/verify-account-deletion.mjs`
Expected: four `OK:` lines. If case A fails with `permission denied for table users`, the hosted `postgres` role cannot delete auth users: apply the spec §4.4 fallback — `erase_account` ends with `delete from public.profiles where id = p_user_id` instead of `auth.users`, returns `{ photoUrl, userId }`, and Task 5/9's actions call `createAdminClient().auth.admin.deleteUser(userId)` right after the RPC (a failure there is logged and the person re-tries; their profile is already gone). Record the outcome in ADR-047.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-account-deletion.mjs
git commit -m "test(db): staging probe for account deletion"
```

### Task 3: Release A

- [ ] **Step 1:** `npm run typecheck && npm run lint && npm run format:check && npm run test && npm run ka:scan`; all green.
- [ ] **Step 2:** Open the PR "Account deletion, step 1: database only (nothing visible)"; CI green; owner OK in chat (nothing visible changes); merge with `gh pr merge --merge --match-head-commit <sha>`; recheck the last ADR number on `main` first.
- [ ] **Step 3:** Production: `production-db.yml` dry-run from `main`; confirm the only pending files are `20261009140000_account_deletion.sql` and `20261009150000_account_deletion_hardening.sql`; apply with the dry-run's run id; the workflow's schema checks pass. The grants are not checked by hand in the dry-run evidence: `scripts/production-db-schema-check.sql` (run by the apply job) fails the apply if anon can execute any of the three functions, if authenticated can execute `erase_account` or cannot execute the two wrappers, if service_role can execute `erase_account`, or if `postgres` may not delete from `auth.users`.

---

## Release B — application (branch `claude/account-deletion`, after Release A is on production)

### Task 4: Copy, schemas, error messages

**Files:**
- Create: `lib/account-deletion-copy.ts`
- Modify: `lib/account-deletion.ts`
- Modify: `lib/funnel.ts` (`ERROR_MESSAGES`, ~line 122)
- Test: `lib/account-deletion.test.ts`

**Interfaces:**
- Produces: `deleteAccountSchema` (`{ confirm: string }`), `adminDeleteMemberSchema` (`{ userId: uuid, reason: 5..300, typedName: string }`), `delegatePhotoPath(url: string | null): string | null`, and the copy constants named below.

- [ ] **Step 1: Write the failing tests**

`lib/account-deletion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_CONFIRM_WORD,
  adminDeleteMemberSchema,
  delegatePhotoPath,
  deleteAccountSchema,
} from "./account-deletion";
import { mapFunnelError } from "./funnel";

describe("deleteAccountSchema", () => {
  it("accepts the word with surrounding spaces and nothing else", () => {
    expect(deleteAccountSchema.safeParse({ confirm: ` ${ACCOUNT_DELETION_CONFIRM_WORD} ` }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirm: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({}).success).toBe(false);
  });
});

describe("adminDeleteMemberSchema", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  it("needs a uuid, a 5-300 character reason and the typed name", () => {
    expect(adminDeleteMemberSchema.safeParse({ userId, reason: "წევრის თხოვნა", typedName: "ა ბ" }).success).toBe(true);
    expect(adminDeleteMemberSchema.safeParse({ userId, reason: "ok", typedName: "ა ბ" }).success).toBe(false);
    expect(adminDeleteMemberSchema.safeParse({ userId: "x", reason: "წევრის თხოვნა", typedName: "ა ბ" }).success).toBe(false);
  });
});

describe("delegatePhotoPath", () => {
  it("returns the object path inside the delegate-photos bucket, else null", () => {
    expect(
      delegatePhotoPath("https://x.supabase.co/storage/v1/object/public/delegate-photos/abc-1.jpg"),
    ).toBe("abc-1.jpg");
    expect(delegatePhotoPath("https://elsewhere.example/a.jpg")).toBeNull();
    expect(delegatePhotoPath(null)).toBeNull();
  });
});

describe("error messages", () => {
  it.each(["staff_account", "staff_history", "invalid_confirmation", "invalid_reason", "cannot_delete_self"])(
    "maps %s to its own Georgian message",
    (token) => {
      expect(mapFunnelError(token)).not.toBe(mapFunnelError("something_unknown"));
    },
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/account-deletion.test.ts`
Expected: FAIL — `deleteAccountSchema` is not exported.

- [ ] **Step 3: Implement**

Append to `lib/account-deletion.ts`:

```ts
import { z } from "zod";
import { ACCOUNT_DELETE_CONFIRM_MISMATCH } from "./account-deletion-copy";

export const deleteAccountSchema = z.object({
  confirm: z
    .string()
    .trim()
    .refine((v) => v === ACCOUNT_DELETION_CONFIRM_WORD, { message: ACCOUNT_DELETE_CONFIRM_MISMATCH }),
});

export const adminDeleteMemberSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().min(5).max(300),
  typedName: z.string().trim().min(1).max(130),
});

const PHOTO_MARKER = "/delegate-photos/";

/** Object path of a delegate photo in its bucket, from the public URL the row stores. */
export function delegatePhotoPath(url: string | null): string | null {
  if (!url) return null;
  const idx = url.indexOf(PHOTO_MARKER);
  return idx >= 0 ? url.slice(idx + PHOTO_MARKER.length) : null;
}
```

(Move the `import` lines to the top of the file.)

`lib/account-deletion-copy.ts` (every string byte-for-byte):

```ts
/**
 * Every Georgian string of account deletion, in one module (the support-copy pattern):
 * one small surface for ka-gate and the mixed-script scan. Informal singular (ADR-025).
 */
export const ACCOUNT_DELETE_HEADING = "ანგარიშის წაშლა";
export const ACCOUNT_DELETE_LEDE =
  "წაშლისას სამუდამოდ იშლება შენი სახელი, ტელეფონი, პირადი ნომერი, წევრობის ისტორია და Google-ით შესვლის ანგარიში. გამოკითხვებში მიცემული ხმები ითვლება, მაგრამ შენს სახელთან აღარ იქნება დაკავშირებული. წაშლის გაუქმება შეუძლებელია.";
export const ACCOUNT_DELETE_DELEGATE_NOTE =
  "შენი საჯარო გვერდი წაიშლება, ხოლო შენი გუნდის წევრები გადავლენ ცენტრალურ მოძრაობაში და შეძლებენ ახალი დელეგატის არჩევას.";
export const ACCOUNT_DELETE_STAFF_NOTE =
  "ადმინისტრატორის როლის მქონე ანგარიშის წაშლა შეუძლებელია. ჯერ სუპერ-ადმინმა უნდა მოგიხსნას როლი.";
export const ACCOUNT_DELETE_CONFIRM_LABEL = "დასადასტურებლად ჩაწერე სიტყვა: წაშლა";
export const ACCOUNT_DELETE_CONFIRM_MISMATCH = "დასადასტურებლად ზუსტად ჩაწერე სიტყვა: წაშლა";
export const ACCOUNT_DELETE_BUTTON = "ანგარიშის წაშლა";
export const ACCOUNT_DELETE_BUSY = "იშლება…";
export const ACCOUNT_DELETED_TITLE = "ანგარიში წაიშალა";
export const ACCOUNT_DELETED_BODY =
  "შენი ანგარიში და პერსონალური მონაცემები წაიშალა. თუ ოდესმე დაბრუნება მოგინდება, შეგიძლია თავიდან დარეგისტრირდე.";
export const ACCOUNT_DELETED_HOME = "მთავარ გვერდზე";
export const DELEGATE_LEFT_NOTE = "შენმა დელეგატმა პლატფორმა დატოვა. აირჩიე ახალი დელეგატი.";
export const ADMIN_DELETE_BUTTON = "წაშლა";
export const ADMIN_DELETE_REASON_LABEL = "მიზეზი (მაგ., წევრის მოთხოვნა)";
export const ADMIN_DELETE_NAME_LABEL = "დასადასტურებლად ჩაწერე სახელი და გვარი";
export const ADMIN_DELETE_CONFIRM = "საბოლოოდ წაშლა";
export const ADMIN_DELETE_CANCEL = "გაუქმება";
export const ADMIN_DELETE_NAME_MISMATCH = "სახელი და გვარი არ ემთხვევა.";
export const ADMIN_DELETE_DONE = "ანგარიში წაიშალა.";
```

`lib/funnel.ts`, inside `ERROR_MESSAGES` (before the closing brace; none of these tokens is a substring of an existing one, and no existing token is a substring of these):

```ts
  staff_account:
    "ადმინისტრატორის როლის მქონე ანგარიშის წაშლა შეუძლებელია — ჯერ როლი უნდა მოიხსნას.",
  staff_history:
    "ეს ანგარიში ადმინისტრატორის ჩანაწერებთანაა დაკავშირებული და ავტომატურად ვერ წაიშლება — მოგვწერე საკონტაქტო გვერდიდან.",
  invalid_confirmation: "დასადასტურებლად ზუსტად ჩაწერე სიტყვა: წაშლა",
  invalid_reason: "მიუთითე მიზეზი, 5-დან 300 სიმბოლომდე.",
  cannot_delete_self: "საკუთარი ანგარიშის წაშლა ამ გვერდიდან შეუძლებელია.",
```

- [ ] **Step 4: Run to verify it passes**, then `node scripts/ka-gate.mjs --diff origin/main lib/account-deletion-copy.ts lib/funnel.ts lib/account-deletion.ts && npm run ka:scan`.
- [ ] **Step 5: Commit** — `git commit -m "feat(lib): account deletion copy, schemas and error messages"`

### Task 5: Member self-deletion action

**Files:**
- Create: `app/(member)/me/profile/delete-account-actions.ts`
- Test: `app/(member)/me/profile/delete-account-actions.test.ts`

**Interfaces:**
- Consumes: `deleteAccountSchema`, `delegatePhotoPath` (Task 4); RPC `delete_my_account` (Task 1).
- Produces: `deleteMyAccountAction(input: unknown): Promise<{ ok: false; error: string }>` — on success it never returns (redirects to `/account-deleted`).

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { mapFunnelError } from "@/lib/funnel";
import { adminTestHarness, fakeAdminClient, ok, raised } from "../../../(admin)/admin/_test-utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  createAdminClient: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { deleteMyAccountAction } = await import("./delete-account-actions");
const session = adminTestHarness(mocks);

describe("deleteMyAccountAction", () => {
  it("refuses a wrong word before any database call", async () => {
    const s = session();
    const result = await deleteMyAccountAction({ confirm: "delete" });
    expect(result.ok).toBe(false);
    expect(s.calls).toHaveLength(0);
  });

  it("deletes through the caller's own session, removes the photo, signs out, redirects", async () => {
    const storage = fakeAdminClient();
    mocks.createAdminClient.mockReturnValue(storage.client);
    const s = session({
      rpc: (name) =>
        name === "delete_my_account"
          ? ok({ photoUrl: "https://x.supabase.co/storage/v1/object/public/delegate-photos/p-1.jpg" })
          : undefined,
    });
    await expect(deleteMyAccountAction({ confirm: "წაშლა" })).rejects.toThrow("REDIRECT /account-deleted");
    expect(s.calls.find((c) => c.kind === "rpc")).toMatchObject({ name: "delete_my_account", args: { p_confirm: "წაშლა" } });
    expect(storage.storageCalls).toContainEqual({ bucket: "delegate-photos", method: "remove", args: [["p-1.jpg"]] });
    expect(s.signOut).toHaveBeenCalled();
  });

  it("shows the mapped Georgian message when the database refuses", async () => {
    session({ rpc: () => raised("staff_account") });
    expect(await deleteMyAccountAction({ confirm: "წაშლა" })).toEqual({ ok: false, error: mapFunnelError("staff_account") });
  });
});
```

If `fakeSession` has no `signOut` double, add one to `app/(admin)/admin/_test-utils/fake-supabase.ts`: `auth: { getUser: …existing…, signOut: vi.fn(async () => ({ error: null })) }` and expose it as `s.signOut`. Keep every existing test passing.

- [ ] **Step 2: Run to verify it fails** — `npx vitest run "app/(member)/me/profile/delete-account-actions.test.ts"`; expected: module not found.

- [ ] **Step 3: Implement**

```ts
"use server";

import { redirect } from "next/navigation";
import { delegatePhotoPath, deleteAccountSchema } from "@/lib/account-deletion";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type DeleteAccountResult = { ok: false; error: string };

/**
 * Spec 2026-10-08 §3.1/§5. The RPC runs on the caller's own session: auth.uid() is the
 * only identity it erases. The service-role client touches Storage alone, for the path the
 * database returned (never client input).
 */
export async function deleteMyAccountAction(input: unknown): Promise<DeleteAccountResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("delete_my_account", { p_confirm: parsed.data.confirm });
  if (error) return { ok: false, error: mapFunnelError(error.message) };

  const path = delegatePhotoPath((data as { photoUrl?: string | null } | null)?.photoUrl ?? null);
  if (path) {
    const { error: removeError } = await createAdminClient().storage.from("delegate-photos").remove([path]);
    if (removeError) console.error("account deletion: photo removal failed", removeError.message);
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect("/account-deleted");
}
```

- [ ] **Step 4: Run to verify it passes.**
- [ ] **Step 5: Commit** — `git commit -m "feat(member): delete my account action"`

### Task 6: The danger section on the profile page

**Files:**
- Create: `components/DeleteAccountSection.tsx`
- Test: `components/DeleteAccountSection.test.tsx`
- Modify: `app/(member)/me/profile/page.tsx` (both the registered branch and the member branch, after the profile form card)

**Interfaces:**
- Consumes: `deleteMyAccountAction` (Task 5), copy (Task 4).
- Produces: `<DeleteAccountSection isStaff={boolean} isDelegate={boolean} action={(input: unknown) => Promise<{ ok: false; error: string }>} />`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_DELETE_BUTTON,
  ACCOUNT_DELETE_CONFIRM_LABEL,
  ACCOUNT_DELETE_DELEGATE_NOTE,
  ACCOUNT_DELETE_STAFF_NOTE,
} from "@/lib/account-deletion-copy";
import { DeleteAccountSection } from "./DeleteAccountSection";

const action = vi.fn(async () => ({ ok: false as const, error: "შეცდომა" }));

describe("DeleteAccountSection", () => {
  it("keeps the button disabled until the word is typed exactly", () => {
    render(<DeleteAccountSection isStaff={false} isDelegate={false} action={action} />);
    const button = screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(ACCOUNT_DELETE_CONFIRM_LABEL), { target: { value: "წაშლა" } });
    expect(button).toBeEnabled();
  });

  it("sends the word and shows a refusal as an alert", async () => {
    render(<DeleteAccountSection isStaff={false} isDelegate={false} action={action} />);
    fireEvent.change(screen.getByLabelText(ACCOUNT_DELETE_CONFIRM_LABEL), { target: { value: "წაშლა" } });
    fireEvent.click(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("შეცდომა"));
    expect(action).toHaveBeenCalledWith({ confirm: "წაშლა" });
  });

  it("tells a delegate their page goes and their team moves", () => {
    render(<DeleteAccountSection isStaff={false} isDelegate action={action} />);
    expect(screen.getByText(ACCOUNT_DELETE_DELEGATE_NOTE)).toBeInTheDocument();
  });

  it("offers staff no field and no button, only the explanation", () => {
    render(<DeleteAccountSection isStaff isDelegate={false} action={action} />);
    expect(screen.getByText(ACCOUNT_DELETE_STAFF_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { ACCOUNT_DELETION_CONFIRM_WORD } from "@/lib/account-deletion";
import {
  ACCOUNT_DELETE_BUSY,
  ACCOUNT_DELETE_BUTTON,
  ACCOUNT_DELETE_CONFIRM_LABEL,
  ACCOUNT_DELETE_DELEGATE_NOTE,
  ACCOUNT_DELETE_HEADING,
  ACCOUNT_DELETE_LEDE,
  ACCOUNT_DELETE_STAFF_NOTE,
} from "@/lib/account-deletion-copy";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";

/** Spec 2026-10-08 §3.1/§3.3: the profile page's danger section. */
export function DeleteAccountSection({
  isStaff,
  isDelegate,
  action,
}: {
  isStaff: boolean;
  isDelegate: boolean;
  action: (input: unknown) => Promise<{ ok: false; error: string }>;
}) {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = word.trim() === ACCOUNT_DELETION_CONFIRM_WORD;

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      const result = await action({ confirm: word });
      // success never comes back here: the action redirects to /account-deleted
      if (result && !result.ok) setError(result.error);
    } catch (e) {
      // the redirect surfaces as a thrown NEXT_REDIRECT; anything else is a real failure
      if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
      setError(GENERIC_FUNNEL_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={ACCOUNT_DELETE_HEADING}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-prose">{ACCOUNT_DELETE_LEDE}</p>
        {isDelegate ? <p className="text-sm text-prose">{ACCOUNT_DELETE_DELEGATE_NOTE}</p> : null}
        {isStaff ? (
          <p className="text-sm font-semibold text-ink">{ACCOUNT_DELETE_STAFF_NOTE}</p>
        ) : (
          <>
            <Field
              label={ACCOUNT_DELETE_CONFIRM_LABEL}
              name="deleteConfirm"
              value={word}
              autoComplete="off"
              onChange={(e) => setWord(e.target.value)}
            />
            <div>
              <Button variant="danger" onClick={onDelete} disabled={!matches || busy}>
                {busy ? ACCOUNT_DELETE_BUSY : ACCOUNT_DELETE_BUTTON}
              </Button>
            </div>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-danger">
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
```

`app/(member)/me/profile/page.tsx`: import `DeleteAccountSection`, `deleteMyAccountAction` and `getAdminRoles` (from `@/lib/supabase/server`). Add `getAdminRoles()` to the existing `Promise.all`. Render, at the end of both branches' `<main>` (after the last card, inside a `<div className="mt-10">`):

```tsx
<DeleteAccountSection
  isStaff={adminRoles.length > 0}
  isDelegate={state.delegateStatus === "approved"}
  action={deleteMyAccountAction}
/>
```

Update `app/(member)/me/profile/page.test.tsx` (if present) mocks for `getAdminRoles`.

- [ ] **Step 4: Run** `npx vitest run components/DeleteAccountSection.test.tsx "app/(member)/me/profile"` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(member): delete-account section on the profile page"`

### Task 7: `/account-deleted`

**Files:**
- Create: `app/(public)/account-deleted/page.tsx`
- Test: `app/(public)/account-deleted/page.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ACCOUNT_DELETED_HOME, ACCOUNT_DELETED_TITLE } from "@/lib/account-deletion-copy";
import Page, { metadata } from "./page";

describe("/account-deleted", () => {
  it("confirms the deletion, links home, and stays out of search", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: ACCOUNT_DELETED_TITLE })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ACCOUNT_DELETED_HOME })).toHaveAttribute("href", "/");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import {
  ACCOUNT_DELETED_BODY,
  ACCOUNT_DELETED_HOME,
  ACCOUNT_DELETED_TITLE,
} from "@/lib/account-deletion-copy";

export const metadata: Metadata = {
  title: `${ACCOUNT_DELETED_TITLE} — ქართული რესპუბლიკა`,
  robots: { index: false, follow: false },
};

export default function AccountDeletedPage() {
  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-10">
      <h1 className="mb-4 font-serif text-3xl font-bold text-ink">{ACCOUNT_DELETED_TITLE}</h1>
      <p className="mb-6 text-sm text-prose">{ACCOUNT_DELETED_BODY}</p>
      <Link href="/" className="font-semibold text-brand hover:underline">
        {ACCOUNT_DELETED_HOME}
      </Link>
    </main>
  );
}
```

The site name `ქართული რესპუბლიკა` in the title: splice it from an existing page's metadata (e.g. `app/(public)/privacy/page.tsx`), do not retype it.

- [ ] **Step 4: Run, expect PASS.** Confirm `app/sitemap.ts` does not list it (it lists explicit paths only).
- [ ] **Step 5: Commit** — `git commit -m "feat(public): account-deleted page"`

### Task 8: "Your delegate left" note on `/me/delegate`

**Files:**
- Modify: `app/(member)/me/delegate/page.tsx`
- Test: `app/(member)/me/delegate/page.test.tsx` (create if absent, mirroring other server-page tests)

- [ ] **Step 1: Failing test** — render the page with a mocked open membership `{ note: "delegate_left" }` and expect `DELEGATE_LEFT_NOTE` in a `role="status"` paragraph; with `note: null`, expect it absent.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — in the page, after `getCabinetState()`, read the caller's open membership through their own session (RLS "own memberships readable"):

```ts
const { data: openMembership } = await supabase
  .from("memberships")
  .select("note")
  .is("ended_at", null)
  .maybeSingle();
const delegateLeft = openMembership?.note === "delegate_left";
```

Render above the grid:

```tsx
{delegateLeft ? (
  <p role="status" className="mb-6 border border-ink bg-paper-bright p-3 text-sm font-semibold text-ink">
    {DELEGATE_LEFT_NOTE}
  </p>
) : null}
```

(Choosing a delegate through `member_change_delegate` opens a new row without the note, so the note disappears by itself. Re-picking the central movement does NOT clear it: the open row already points at central, so no new row is opened. Only choosing a delegate clears the note, so its text must ask the member to choose a delegate and must not suggest that confirming central dismisses it.)

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(member): note when a member's delegate has left"`

### Task 9: Admin delete on request

**Files:**
- Create: `app/(admin)/admin/members/delete-member-actions.ts`, `app/(admin)/admin/members/DeleteMemberButton.tsx`
- Test: `app/(admin)/admin/members/delete-member-actions.test.ts`, `app/(admin)/admin/members/DeleteMemberButton.test.tsx`
- Modify: `app/(admin)/admin/members/page.tsx` (one column, super_admin only, beside the reveal column)

**Interfaces:**
- Produces: `deleteMemberAction(userId: unknown, reason: unknown, typedName: unknown, expectedName: unknown): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Failing tests** (pattern of `admins/actions.test.ts`):
  - zod garbage → `{ ok: false }` with zero database calls;
  - typed name ≠ expected name (trimmed, exact) → `ADMIN_DELETE_NAME_MISMATCH`, zero calls;
  - happy path → one `rpc("admin_delete_member", { p_user_id, p_reason })` on the caller's session (never the service role), Storage `remove` for the returned photo path, `revalidatePath("/admin/members")`, `{ ok: true }`;
  - `raised("staff_history")` → `{ ok: false, error: mapFunnelError("staff_history") }`, no revalidate.
  - Button: hidden form until "წაშლა" is clicked; confirm disabled until reason has 5+ characters and the typed name matches; success shows `ADMIN_DELETE_DONE`; error shows in `role="alert"`; every await in try/catch/finally (the admin buttons' known freeze, audit ADMIN-7).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { adminDeleteMemberSchema, delegatePhotoPath } from "@/lib/account-deletion";
import { ADMIN_DELETE_NAME_MISMATCH } from "@/lib/account-deletion-copy";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type DeleteMemberResult = { ok: true } | { ok: false; error: string };

export async function deleteMemberAction(
  userId: unknown,
  reason: unknown,
  typedName: unknown,
  expectedName: unknown,
): Promise<DeleteMemberResult> {
  const parsed = adminDeleteMemberSchema.safeParse({ userId, reason, typedName });
  if (!parsed.success || typeof expectedName !== "string") {
    return { ok: false, error: parsed.success ? GENERIC_FUNNEL_ERROR : (parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR) };
  }
  if (parsed.data.typedName !== expectedName.trim()) {
    return { ok: false, error: ADMIN_DELETE_NAME_MISMATCH };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_delete_member", {
    p_user_id: parsed.data.userId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  const path = delegatePhotoPath((data as { photoUrl?: string | null } | null)?.photoUrl ?? null);
  if (path) {
    const { error: removeError } = await createAdminClient().storage.from("delegate-photos").remove([path]);
    if (removeError) console.error("member deletion: photo removal failed", removeError.message);
  }
  revalidatePath("/admin/members");
  return { ok: true };
}
```

The typed-name check is a UX guard against deleting the wrong row; authorization stays in `admin_delete_member` (ADR-014).

The admin copy (Task 4, `ADMIN_DELETE_REASON_LABEL` or a hint under the reason field) must tell staff not to write the person's name in the reason: the `member.delete` audit row keeps the reason after the erasure (ADR-047), so a name written there would survive it. Pin it in `DeleteMemberButton.test.tsx`.

`DeleteMemberButton.tsx`: a client component with props `{ memberId: string; memberName: string; action: typeof deleteMemberAction }`. A `Button variant="danger" size="sm"` labelled `ADMIN_DELETE_BUTTON` opens an inline panel with `TextareaField` (`ADMIN_DELETE_REASON_LABEL`), `Field` (`ADMIN_DELETE_NAME_LABEL`), a `danger` button `ADMIN_DELETE_CONFIRM` and a `ghost` button `ADMIN_DELETE_CANCEL`. Use `adminControlClasses` for the inputs as the other admin forms do.

`members/page.tsx`: `const canDelete = hasAnyRole(roles, ["super_admin"]);` header `<th className={tableThClass}>წაშლა</th>` when `canDelete`, cell `<DeleteMemberButton memberId={m.id} memberName={`${m.first_name} ${m.last_name}`} action={deleteMemberAction} />`.

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): delete a member's account on request"`

### Task 10: Privacy policy sentences

**Files:**
- Modify: `app/(public)/privacy/page.tsx` (sections "რამდენ ხანს ვინახავთ" and "შენი უფლებები")
- Test: `app/(public)/privacy/page.test.tsx`

- [ ] **Step 1: Failing test**

```ts
  it("says people can delete their account themselves, and what that does", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("ანგარიშის წაშლა შეგიძლია თავადაც, პროფილის გვერდიდან");
    expect(text).toContain("მონაცემებს ვინახავთ, სანამ ანგარიშს არ წაშლი.");
  });
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — retention body becomes:
  `"მონაცემებს ვინახავთ, სანამ ანგარიშს არ წაშლი. წაშლისას შენი პერსონალური მონაცემები იშლება, ხოლო გამოკითხვებში მიცემული ხმები რჩება ისე, რომ შენი ამოცნობა შეუძლებელი იყოს."`
  The rights body gets, before `მოთხოვნა გამოგვიგზავნე…`:
  `"ანგარიშის წაშლა შეგიძლია თავადაც, პროფილის გვერდიდან — მონაცემები მაშინვე იშლება. "`
  Version stays `2026-10-v1` (spec §5).

  > **Correction (final review, 2026-10-08), before implementing:** the Georgian above overclaims.
  > The policy must not say that backups or service logs are erased: they are not, they expire on
  > their own retention (spec §2, §7). It must also not say that every vote stays: a vote in a
  > poll that is still running is removed, only votes in finished polls stay without the person.
  > Rework both sentences (and the test's expected strings) to say so, with the owner reviewing
  > the Georgian, before Step 1.
- [ ] **Step 4: Run, expect PASS**; ka-gate on the file.
- [ ] **Step 5: Commit** — `git commit -m "docs(privacy): self-service deletion in the policy"`

### Task 11: e2e journey

**Files:**
- Create: `e2e/account-deletion.spec.ts`
- Modify: `e2e/funnel-helpers.ts` (`JOURNEY`: add `accountDelete: 9` and include it in `cleanupJourneyUsers`)

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from "@playwright/test";
import {
  JOURNEY,
  cleanupGoogleBackedTestUsers,
  createGoogleBackedTestUser,
  journeyPersonalId,
  journeyPhone,
  seedCompletedMember,
} from "./funnel-helpers";
import { loginAs, serviceClient } from "./otp-helpers";

const PHONE = journeyPhone(JOURNEY.accountDelete);

test.afterAll(async () => {
  await cleanupGoogleBackedTestUsers([PHONE]);
});

test("a member deletes their account and their data is gone", async ({ page }) => {
  const user = await createGoogleBackedTestUser(PHONE);
  await seedCompletedMember({
    phone: PHONE,
    firstName: "წაშლა",
    lastName: "ტესტი",
    personalId: journeyPersonalId(JOURNEY.accountDelete),
    userId: user.id,
  });
  await loginAs(page, PHONE);
  await page.goto("/me/profile");
  await page.getByLabel("დასადასტურებლად ჩაწერე სიტყვა: წაშლა").fill("წაშლა");
  await page.getByRole("button", { name: "ანგარიშის წაშლა" }).click();
  await expect(page).toHaveURL(/\/account-deleted$/);
  await expect(page.getByRole("heading", { level: 1, name: "ანგარიში წაიშალა" })).toBeVisible();

  await page.goto("/me");
  await expect(page).toHaveURL(/\/login/);
  const { data } = await serviceClient().from("profiles").select("id").eq("id", user.id).maybeSingle();
  expect(data).toBeNull();
});
```

Check `createGoogleBackedTestUser`'s and `loginAs`'s real signatures in `e2e/funnel-helpers.ts:61` and `e2e/otp-helpers.ts:167` before running; adapt the two calls, not the helpers. Uses one password sign-in, no SMS (ADR-043).

- [ ] **Step 2: Run** with the worktree recipe (memory "worktree e2e invocation": absolute Playwright CLI path, staging env loaded): `npx playwright test e2e/account-deletion.spec.ts`. Expected: PASS.
- [ ] **Step 3: Commit** — `git commit -m "test(e2e): member deletes their account"`

### Task 12: Decision record, gates, release

- [ ] **Step 1:** `DECISIONS.md` ADR-047 (recheck the last number on `main`): what is erased/kept (spec §2), the audit-scrub exception and why it cannot be reached by a client, staff refusal, the `postgres`-owned `delete from auth.users` result from Task 2 (or the fallback taken), anonymous votes, out-of-scope items.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm run format:check && npm run test && npm run ka:scan`; all green.
- [ ] **Step 3:** PR "Members can delete their account (and their data)"; CI green; preview QA with screenshots: profile danger section (member, delegate, staff), the deletion journey on the preview with a staging test account, `/account-deleted`, the admin row action, the updated policy. Owner sign-off in chat; merge; verify on georgia-republic (policy text live, `/account-deleted` 200, profile section visible when signed in is checked by the owner's own account only if they ask).
