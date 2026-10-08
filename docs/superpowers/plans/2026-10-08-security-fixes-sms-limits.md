# SMS abuse limits (R5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nobody can keep a chosen person from proving their phone, and spamming a number costs one
fresh Google account per extra SMS. Fixes audit finding M1.

**Architecture:** One migration, in a migration-only PR, restates two functions:
- `reserve_phone_verification_send`: new per-account, per-number and site-wide limits, with a
  "first code today" exception;
- `complete_phone_verification_send`: a send supersedes only the sender's own codes.

No application code changes: a refusal is still `{"status":"limited"}`, so the existing
`too_many_requests` message applies. Behaviour is proven by static tests plus a rolled-back SQL
scenario run against staging.

**Tech Stack:** plpgsql, vitest static migration tests, Supabase CLI against staging.

**Spec:** `docs/superpowers/specs/2026-10-08-security-audit-fixes-design.md` (sections 1, 6, 7 D4, 8)

**Prerequisite:** R2 (`docs/superpowers/plans/2026-10-08-security-fixes-registration.md`) is applied
everywhere. This plan restates `complete_phone_verification_send` from R2's version, the one with
`superseded_at`. The numbers below are the owner's D4 answer. If the owner changes them, change only
the constants in Task 1 and the matching test expectations.

## Global Constraints

- Restate live bodies verbatim except for the stated changes. Locks are always taken user lock (8611)
  then phone lock (8612), as today.
- Sends must behave identically for member and non-member numbers. No limit may depend on whether a
  profile owns the phone.
- Gates before push: typecheck, lint, format:check, ka:scan, test, build. CI also runs e2e on staging,
  which allows about 100 SMS an hour, so keep any new e2e SMS use at zero.
- Migration-only PR, then staging apply after merge, then the production-db dry-run, then the owner's
  yes, then apply. Check georgia-republic after the merge.

| Constant (D4) | Value |
|---|---|
| per account: gap / hour / day | 60 s / 5 / 10 |
| per account: different numbers per day | 3 |
| per number: gap across all accounts | 60 s |
| per number: per day across all accounts | 10, except an account's first send to that number today |
| site-wide per hour | 1,000 (raised from 300 so a real sign-up surge is never turned away) |

---

### Task 1: The limits

**Files:**
- Create: `supabase/migrations/20261011100000_phone_verification_send_limits.sql` (timestamp later
  than every migration on main at implementation time)
- Modify: `.github/workflows/production-db.yml` (both counts)
- Test: `lib/security/sms-limits.test.ts`

**Interfaces:**
- Consumes: `latestDefinition` from `lib/security/migration-model.ts` (R2, Task 5).
- Produces: the same signatures as today:
  - `reserve_phone_verification_send(uuid, text, text) returns jsonb`;
  - `complete_phone_verification_send(uuid, uuid, text, text, timestamptz) returns jsonb`.

- [ ] **Step 1: Write the failing static tests**

```ts
// lib/security/sms-limits.test.ts
import { describe, expect, it } from "vitest";
import { latestDefinition, orderedMigrationSql } from "./migration-model";

describe("SMS send limits (security audit M1)", () => {
  const reserve = () => latestDefinition("reserve_phone_verification_send");

  it("keeps the 60-second gap per account and per number", () => {
    expect(reserve()).toMatch(
      /created_at >= v_now - interval '60 seconds'\s+and \(user_id = p_user_id or phone = p_phone\)/,
    );
  });

  it("caps each account per hour, per day and in different numbers", () => {
    const body = reserve();
    expect(body).toContain("v_user_hour >= 5");
    expect(body).toContain("v_user_day >= 10");
    expect(body).toMatch(/v_user_phone_day = 0\s+and v_user_numbers_day >= 3/);
  });

  it("caps a number per day across accounts, but never an account's first code today", () => {
    expect(reserve()).toMatch(/v_phone_day >= 10\s+and v_user_phone_day > 0/);
    // the old shared hourly per-number cap (the lockout lever) is gone
    expect(reserve()).not.toContain("v_phone_count >= 5");
  });

  it("caps the whole site per hour", () => {
    expect(reserve()).toContain("v_site_hour >= 1000");
    expect(orderedMigrationSql()).toMatch(
      /create index phone_verification_send_by_created\s+on public\.phone_verification_send_reservations \(created_at\)/,
    );
  });

  it("never looks at who owns a number", () => {
    expect(reserve()).not.toContain("public.profiles");
  });

  it("lets a send cancel only the sender's own codes", () => {
    const complete = latestDefinition("complete_phone_verification_send");
    expect(complete).toMatch(/and id <> v_challenge_id\s+and user_id = p_user_id;/);
    expect(complete).not.toContain("or phone = v_phone");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

Run: `npx vitest run lib/security/sms-limits.test.ts`

- [ ] **Step 3: Write the migration**

```sql
-- Security audit 2026-10-08, M1. Before: per-number limits were shared across accounts and a send
-- cancelled every live code for that number, so anyone could keep a chosen person from ever
-- proving their phone and send them about 120 SMS a day at our cost. Now (owner decision D4):
--   per account: 1 per 60 s, 5 per hour, 10 per day, at most 3 different numbers per day;
--   per number:  1 per 60 s across accounts, 10 per day across accounts — except that an account
--                that has not asked for this number today always gets its first code (no lockout);
--   site-wide:   1,000 per hour (a backstop for the SMS bill, high enough for a sign-up surge).
-- No rule looks at whether a profile owns the number (no membership signal).

create index phone_verification_send_by_created
  on public.phone_verification_send_reservations (created_at);

create or replace function public.reserve_phone_verification_send(
  p_user_id uuid,
  p_phone text,
  p_idempotency_key text
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_reservation_id uuid;
  v_user_hour bigint;
  v_user_day bigint;
  v_user_numbers_day bigint;
  v_user_phone_day bigint;
  v_phone_day bigint;
  v_site_hour bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(8611, pg_catalog.hashtext(p_user_id::text));
  perform pg_catalog.pg_advisory_xact_lock(8612, pg_catalog.hashtext(p_phone));

  delete from public.phone_verification_send_reservations
   where created_at < v_now - interval '24 hours'
     and (user_id = p_user_id or phone = p_phone);
  delete from public.phone_verification_challenges
   where created_at < v_now - interval '24 hours'
     and (user_id = p_user_id or phone = p_phone);

  if exists (
    select 1
      from public.phone_verification_send_reservations
     where user_id = p_user_id
       and phone = p_phone
       and purpose = 'registration'
       and idempotency_key = p_idempotency_key
  ) or exists (
    select 1
      from public.phone_verification_send_reservations
     where created_at >= v_now - interval '60 seconds'
       and (user_id = p_user_id or phone = p_phone)
  ) then
    return pg_catalog.jsonb_build_object('status', 'limited');
  end if;

  select pg_catalog.count(*) into v_site_hour
    from public.phone_verification_send_reservations
   where created_at >= v_now - interval '1 hour';
  if v_site_hour >= 1000 then
    return pg_catalog.jsonb_build_object('status', 'limited');
  end if;

  select pg_catalog.count(*) filter (where created_at >= v_now - interval '1 hour'),
         pg_catalog.count(*),
         pg_catalog.count(distinct phone),
         pg_catalog.count(*) filter (where phone = p_phone)
    into v_user_hour, v_user_day, v_user_numbers_day, v_user_phone_day
    from public.phone_verification_send_reservations
   where user_id = p_user_id
     and created_at >= v_now - interval '24 hours';
  if v_user_hour >= 5 or v_user_day >= 10 then
    return pg_catalog.jsonb_build_object('status', 'limited');
  end if;
  if v_user_phone_day = 0
     and v_user_numbers_day >= 3 then
    return pg_catalog.jsonb_build_object('status', 'limited');
  end if;

  select pg_catalog.count(*) into v_phone_day
    from public.phone_verification_send_reservations
   where phone = p_phone
     and created_at >= v_now - interval '24 hours';
  if v_phone_day >= 10
     and v_user_phone_day > 0 then
    return pg_catalog.jsonb_build_object('status', 'limited');
  end if;

  insert into public.phone_verification_send_reservations (
    user_id, phone, purpose, idempotency_key, created_at
  ) values (
    p_user_id, p_phone, 'registration', p_idempotency_key, v_now
  ) returning id into v_reservation_id;

  return pg_catalog.jsonb_build_object(
    'status', 'reserved',
    'reservation_id', v_reservation_id
  );
end $$;

revoke execute on function public.reserve_phone_verification_send(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_phone_verification_send(uuid, text, text) to service_role;
```

Then restate `complete_phone_verification_send` from R2's migration
(`20261009100000_phone_proof_superseded_and_register_revoke.sql`) verbatim. Change only its final
UPDATE, to:

```sql
  -- Security audit M1: a send cancels only the sender's own live codes. Another account
  -- asking for the same number no longer cancels the owner's code.
  update public.phone_verification_challenges
     set superseded_at = v_now
   where purpose = 'registration'
     and consumed_at is null
     and superseded_at is null
     and expires_at > v_now
     and id <> v_challenge_id
     and user_id = p_user_id;
```

Restate its `revoke ... from public, anon, authenticated; grant ... to service_role;` pair too.

Raise both `EXPECTED_MIGRATION_FILE_COUNT` values to the committed count.

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run lib/security lib/production-db-workflow.test.ts`. R2's
`registration-hardening.test.ts` must still pass: it checks `superseded_at`, which this restatement
keeps.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261011100000_phone_verification_send_limits.sql lib/security/sms-limits.test.ts .github/workflows/production-db.yml
git commit -m "Per-account, per-number and site-wide SMS limits without lockout (audit M1)"
```

### Task 2: Rolled-back behaviour scenario for staging

**Files:**
- Create: `scripts/security/sms-limits-scenario.sql`

- [ ] **Step 1: Write the scenario**

Everything runs in one transaction and ends in `rollback`, so nothing persists. The two throwaway
auth users and all reservations disappear.

Each check is built so that exactly one rule decides it. Every account stays under its own hourly
and daily caps, and all seeded sends are backdated past the 60-second gap.

```sql
-- Staging only. Proves the M1 rules; leaves no trace (rollback).
begin;
-- a001 = the number's real owner; a002..a005 = four attacker accounts
insert into auth.users (id, aud, role, email)
select ('00000000-0000-4000-8000-00000000a00' || g)::uuid, 'authenticated', 'authenticated',
       'r5-' || g || '@example.invalid'
  from pg_catalog.generate_series(1, 5) as g;

-- the attackers have sent the owner's number 10 codes today, 3+3+3+1 (each well under 10/day)
insert into public.phone_verification_send_reservations (user_id, phone, idempotency_key, created_at)
select ('00000000-0000-4000-8000-00000000a00' || (2 + (g - 1) / 3))::uuid, '+995550009999',
       pg_catalog.encode(pg_catalog.sha256(('r5-p' || g)::bytea), 'hex'),
       pg_catalog.now() - ((g + 1) || ' hours')::interval
  from pg_catalog.generate_series(1, 10) as g;

-- 1) per-number cap: a002 (3 sends to it today, so not its first) is refused
select 'number_cap_refuses_repeat_sender' as check,
       public.reserve_phone_verification_send('00000000-0000-4000-8000-00000000a002', '+995550009999',
         pg_catalog.encode(pg_catalog.sha256('r5-c1'::bytea), 'hex')) ->> 'status' = 'limited' as ok;

-- 2) no lockout: the owner's first code today still goes out although the number is at its cap
select 'owner_first_code_goes_out' as check,
       public.reserve_phone_verification_send('00000000-0000-4000-8000-00000000a001', '+995550009999',
         pg_catalog.encode(pg_catalog.sha256('r5-c2'::bytea), 'hex')) ->> 'status' = 'reserved' as ok;

-- 3) different-numbers cap: a003 already has 3 numbers today (+995550009999 plus two more), so a
--    4th new number is refused. It has only 5 sends today and none in the last 30 minutes, so no
--    other rule applies.
insert into public.phone_verification_send_reservations (user_id, phone, idempotency_key, created_at)
select '00000000-0000-4000-8000-00000000a003', '+99555000100' || g,
       pg_catalog.encode(pg_catalog.sha256(('r5-n' || g)::bytea), 'hex'),
       pg_catalog.now() - interval '40 minutes'
  from pg_catalog.generate_series(1, 2) as g;
select 'fourth_new_number_refused' as check,
       public.reserve_phone_verification_send('00000000-0000-4000-8000-00000000a003', '+995550001009',
         pg_catalog.encode(pg_catalog.sha256('r5-c3'::bytea), 'hex')) ->> 'status' = 'limited' as ok;

-- 4) control: the same account may still ask again for a number it already used today
select 'known_number_still_allowed' as check,
       public.reserve_phone_verification_send('00000000-0000-4000-8000-00000000a003', '+995550001001',
         pg_catalog.encode(pg_catalog.sha256('r5-c4'::bytea), 'hex')) ->> 'status' = 'reserved' as ok;
rollback;
```
- [ ] **Step 2: Commit**

```bash
git add scripts/security/sms-limits-scenario.sql
git commit -m "Rolled-back staging scenario for the SMS limits"
```

### Task 3: Release

- [ ] **Step 1:**
  - Write the ADR (rules, numbers, the first-code exception and why: lockout is worse than bounded
    spam).
  - Run the gates, push, open the PR, bind it.
  - Plain-language sign-off: "Nobody can block a person from joining by flooding their number any
    more. Each account can ask for a few codes a day, and the whole site has a ceiling so a flood
    can't run up our SMS bill." Wait for the yes.
- [ ] **Step 2:** Merge after `quality`. Apply to staging with the established staging push, then run
  the scenario against staging only, e.g.
  `supabase db query --linked --file scripts/security/sms-limits-scenario.sql` while linked to
  `orcxtbedkexoclbfgvzd`. Expected: every `ok` is `true`. Run the staging registration e2e journey;
  it must pass.
- [ ] **Step 3:** Production dry-run, owner yes, apply, check georgia-republic `/join`.
