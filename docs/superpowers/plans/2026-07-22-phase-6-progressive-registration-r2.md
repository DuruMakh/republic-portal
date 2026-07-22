# Phase 6 R2 — The Ladder and the Numbers (v0.8.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Release 2 of progressive registration: member-only delegacy requests feeding the existing verification queue, public counters for both tiers, admin conversion figures, the R1-review tidy-ups, and the queued Phase 5 hardening riders — as one release, tagged v0.8.0.

**Architecture:** One migration carries all schema work (new `request_delegacy()` definer RPC, a delegates-require-completed-member trigger, view rebuilds by column-append, hardening riders). App-side, routing/nav gate delegacy on **approved** status (pending/rejected requesters live in the member cabinet), and all UI reads flow through the existing `cabinet_state()` payload — no new client table grants, nothing stored that can be derived.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript 6 strict, Supabase (Postgres + phone OTP), zod, Vitest + Testing Library, Playwright, plain SQL migrations via supabase CLI.

**Spec:** docs/superpowers/specs/2026-07-22-progressive-registration-r2-design.md (parent: 2026-07-21-progressive-registration-design.md §5, ADR-018).

## Global Constraints

- TypeScript strict; no `any`, no `@ts-ignore` (CLAUDE.md).
- All user-facing text Georgian. Georgian quote marks are „…“ = U+201E open, U+201C close. NEVER let a closing quote silently become ASCII `"`. After every file edit containing Georgian, run the gate below. `\p{Greek}` across changed files must be 0.
- Georgian-text gate (run from repo root; replace FILE):
  ```powershell
  node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');const c=r=>(s.match(r)||[]).length;console.log('201E',c(/„/g),'201C',c(/“/g),'201D(0)',c(/”/g),'greek(0)',c(/[Ͱ-Ͽ]/g))" FILE
  ```
  Existing files mix „…“ with „…" (straight closer) — when EDITING an existing line, keep its bytes exactly; NEW text uses proper „…“ pairs.
- Validation with zod at every boundary; server is the source of truth; funnel/admin mutations are SECURITY DEFINER RPCs with the house grant pattern, verbatim shape:
  ```sql
  grant execute on function fn_name(argtypes) to authenticated;
  revoke execute on function fn_name(argtypes) from public, anon;
  ```
- Admin mutations write to audit_log **in the same transaction** (ADR-014). R2 adds no new audited admin mutations; `admin_approve_delegate` keeps its existing audit row.
- Never store derivable values. Counters are computed in views at read time.
- Schema changes ONLY via a file in `supabase/migrations/`. `lib/supabase/types.ts` is hand-maintained — every view/RPC change updates it in the same task that consumes it.
- `scripts/verify-schema.mjs` (probe) and `scripts/seed-staging.mjs` are updated alongside schema changes; probe runs against staging after every push.
- **OWNER-ASSIST steps:** `supabase db push` is blocked by the auto-mode permission classifier — the owner switches to manual mode and confirms (Phase 4 fact). Flag these steps loudly; do not silently skip.
- e2e needs `.env.local` loaded into the shell first (Playwright does not read it):
  ```powershell
  Get-Content .env.local | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { Set-Item -Path ("env:" + $Matches[1].Trim()) -Value $Matches[2].Trim() } }
  npx playwright test
  ```
  Playwright runs with `workers: 1` (shared staging state) — never parallelize.
- Gates before any push: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run format` (then `format:check` — the ONLY tolerated failure is the pre-existing `CLAUDE.md` CRLF artifact; nothing else).
- Commit per task, conventional style (`feat(...)`, `fix(...)`, `test(...)`, `docs(...)`), append `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Never push to main. Branch: `claude/progressive-registration-r2-b1608b` (already cut from main b024200).
- **Workspace:** the main checkout `C:\Users\Mylaptop\Desktop\Claude\Geo Republic Portal` (it is on the R2 branch; `.env.local` and node_modules live there). NOT the empty `.claude/worktrees/phase-4-admin-crm-1fd359` husk.
- **Staging cutover window:** Task 2's `db push` renames `delegate_panel`'s `draftCount` key while deployed main still reads `draftCount` — the LIVE production delegate panel's „რეგისტრირებული“ stat renders blank until R2 merges. Same accepted pre-launch pattern as R1 (whose window broke far more). Record window open/close in the ledger; tell the owner in the report.

---

### Task 1: e2e helper consolidation + test-infra hygiene

The recorded V18 basket. Pure test-infrastructure refactor — zero product code. The full suite green afterwards IS the test.

**Files:**
- Create: `e2e/otp-helpers.ts`
- Modify: `e2e/funnel-helpers.ts`, `e2e/admin-helpers.ts`, `e2e/membership.spec.ts:57-70`, `e2e/community-polls.spec.ts:141-152`, `playwright.config.ts`
- No spec-file import changes: both helper modules re-export the shared machinery under their existing names.

**Interfaces:**
- Consumes: current helpers (`e2e/funnel-helpers.ts`, `e2e/admin-helpers.ts` — see verbatim baseline in the R2 planning extraction; behavior must not change).
- Produces (new module `e2e/otp-helpers.ts`):
  - `export function serviceClient(): SupabaseClient` — the single service-role factory (env guard message: `"e2e needs staging service credentials"`).
  - `export async function readFreshInboxOtp(phoneNational: string, sentAt: number): Promise<string>` — the single dev_otp_inbox poll (20 × 500ms, `.in("phone", ["+995"+p, "995"+p])`, newest row, `created_at >= sentAt`); throws `` `no fresh OTP in dev_otp_inbox for ${phoneNational}` ``.
  - `export async function clickThroughOtpThrottle(page: Page, buttonName: string, success: Locator): Promise<number>` — the 3-attempt / 62s ride-out loop; returns the `sentAt` used by the successful attempt; throws `` `OTP send throttled for this phone after 3 attempts` ``.
  - `export async function loginAs(page: Page, phoneNational: string, landing?: RegExp): Promise<void>` — the ONE implementation; default landing `/\/(me|delegate|admin)(\/|\?|#|$)/`.

- [ ] **Step 1: Write `e2e/otp-helpers.ts`** — move (byte-preserving where possible) the shared machinery out of the two helper files:

```ts
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** THE service-role client for e2e seeding + dev-OTP inbox reads (staging only). */
export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("e2e needs staging service credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Click `buttonName` and wait for EITHER `success` or the send-failed notice.
 * Supabase throttles per-phone OTP sends (~60s): on a throttled send, ride the
 * window out and retry, up to 3 attempts. Returns the `sentAt` timestamp of the
 * successful attempt (2s slack for test-machine vs DB clock skew) so callers can
 * reject stale inbox rows. Single home for the idiom previously copied across
 * loginAs (×2) and submitJoinAndReadInboxOtp.
 */
export async function clickThroughOtpThrottle(
  page: Page,
  buttonName: string,
  success: Locator,
): Promise<number> {
  const sendError = page.getByText("კოდის გაგზავნა ვერ მოხერხდა");
  for (let attempt = 0; attempt < 3; attempt++) {
    const sentAt = Date.now() - 2000;
    await page.getByRole("button", { name: buttonName }).click();
    await expect(success.or(sendError)).toBeVisible({ timeout: 15_000 });
    if (await success.isVisible()) return sentAt;
    if (attempt < 2) await page.waitForTimeout(62_000);
  }
  throw new Error("OTP send throttled for this phone after 3 attempts");
}

/** THE dev_otp_inbox poll: newest row for the phone, no older than sentAt. */
export async function readFreshInboxOtp(phoneNational: string, sentAt: number): Promise<string> {
  const db = serviceClient();
  const forms = [`+995${phoneNational}`, `995${phoneNational}`];
  for (let i = 0; i < 20; i++) {
    const { data } = await db
      .from("dev_otp_inbox")
      .select("otp, created_at")
      .in("phone", forms)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (row && new Date(row.created_at as string).getTime() >= sentAt) {
      return row.otp as string;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no fresh OTP in dev_otp_inbox for ${phoneNational}`);
}

/**
 * THE /login flow. Works for every standing: the /api/dev/otp UI element is
 * withheld for ANY existing profile (account-takeover guard, R1 hardening), so
 * the code is always read from dev_otp_inbox via the service client. The default
 * landing regex admits the registered cabinet (/me), member/delegate cabinets and
 * /admin; admin-helpers narrows it for completed accounts.
 */
export async function loginAs(
  page: Page,
  phoneNational: string,
  landing: RegExp = /\/(me|delegate|admin)(\/|\?|#|$)/,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("ტელეფონის ნომერი").fill(phoneNational);
  const otpGroup = page.getByRole("group", { name: "SMS კოდი" });
  const sentAt = await clickThroughOtpThrottle(page, "კოდის მიღება", otpGroup);
  const otp = await readFreshInboxOtp(phoneNational, sentAt);
  await page.getByTestId("otp-0").fill(otp); // OtpInput distributes the pasted digits
  await page.getByRole("button", { name: "დადასტურება" }).click();
  await expect(page).toHaveURL(landing, { timeout: 15_000 });
}
```

- [ ] **Step 2: Rewire `e2e/funnel-helpers.ts`.** Delete its private `adminClient()`, its whole `loginAs` body, and the poll loop inside `submitJoinAndReadInboxOtp`; import and delegate instead. Keep every OTHER export byte-identical (seeders, journeys, cleanup). Required shape:

```ts
import { clickThroughOtpThrottle, loginAs, readFreshInboxOtp, serviceClient } from "./otp-helpers";

export { loginAs }; // spec imports stay untouched
```
  - every prior `adminClient()` call site inside this file → `serviceClient()`;
  - `submitJoinAndReadInboxOtp` becomes: `const otpField = page.getByTestId("otp-0"); const sentAt = await clickThroughOtpThrottle(page, "გაგრძელება →", otpField); return readFreshInboxOtp(phoneNational, sentAt);` (keep its doc comment, minus the copied-loop text);
  - `submitJoinAndAwaitOtp` keeps its own dev-otp-testid loop (different success element and no inbox read — it is NOT one of the three copies) but its retry loop is replaced with `await clickThroughOtpThrottle(page, "გაგრძელება →", page.getByTestId("dev-otp"));`
  - fix the stale doc comment above `loginAs`'s old location / on the re-export: replace the sentence `the /api/dev/otp UI element is withheld for COMPLETED accounts` with `the /api/dev/otp UI element is withheld for ANY existing profile (R1 hardening)`.

- [ ] **Step 3: Rewire `e2e/admin-helpers.ts`.** Delete its `serviceClient` body and its `loginAs` body; re-export with the narrowed landing:

```ts
import { loginAs as sharedLoginAs, serviceClient } from "./otp-helpers";
import type { Page } from "@playwright/test";

export { serviceClient };

/**
 * Admin/completed-account login: same shared flow, narrowed landing — completed
 * accounts land on /me/profile, /me/delegate, /admin* or /delegate, never bare
 * /me. The trailing boundary keeps public /delegates pages from matching.
 */
export async function loginAs(page: Page, phoneNational: string): Promise<void> {
  await sharedLoginAs(page, phoneNational, /\/(me\/profile|me\/delegate|admin|delegate)(\/|\?|#|$)/);
}
```
  All other admin-helpers exports stay byte-identical (they already call `serviceClient()` by that name).

- [ ] **Step 4: Retarget the toothless assertions in `e2e/membership.spec.ts`.** Lines 57-58 (done screen) and ~line 70 (member cabinet): `await expect(page.getByText("წევრი").first()).toBeVisible();` is a case-insensitive substring match that also matches „აქტიური წევრი“, „წევრებisთვის“ etc. Replace both with exact-text assertions (smoke.spec pattern):
  - done screen: `await expect(page.getByText("წევრი", { exact: true })).toBeVisible();`
  - member cabinet: `await expect(page.getByText("წევრი", { exact: true })).toBeVisible();`
  If exact-match hits two nodes (Pill + a table cell), scope like smoke.spec does: `page.locator("main").getByText("წევრი", { exact: true }).first()` is NOT acceptable — instead scope to the Pill's container (`page.getByTestId("membership-pill")` does not exist; use `page.locator("main")` + `{ exact: true }` and assert `toHaveCount(1)` first, adjusting the locator until it is unique). Keep the surrounding comments.

- [ ] **Step 5: `.order("id")` on the paged payment sum in `e2e/community-polls.spec.ts:141-152`** — add `.order("id")` between `.is("voided_at", null)` and `.range(...)` (deterministic paging; rider §8.8).

- [ ] **Step 6: Raise the per-test cap in `playwright.config.ts`**: `timeout: 150_000` → `timeout: 210_000`, and update its comment: `// 210s per test: a spec may ride out TWO Supabase per-phone OTP-throttle windows (2 × 62s) and still finish its remaining steps (the old 150s cap left a 186s worst case over budget — recorded R1 flake margin).`

- [ ] **Step 7: Gates.** Run `npm run typecheck && npm run lint && npm test` — all green (no unit tests touch e2e helpers; this catches TS/lint only). Expected: typecheck 0 errors, vitest 412 passed.

- [ ] **Step 8: Full e2e suite** (env-load snippet from Global Constraints, then `npx playwright test`). Expected: **all specs pass** (39+ tests, workers 1). This is the task's real gate — consolidation must be behavior-neutral.

- [ ] **Step 9: Commit**

```powershell
git add e2e/otp-helpers.ts e2e/funnel-helpers.ts e2e/admin-helpers.ts e2e/membership.spec.ts e2e/community-polls.spec.ts playwright.config.ts
git commit -m "test(e2e): consolidate OTP/login machinery into otp-helpers (V18); 210s cap; ordered paged sum"
```

---

### Task 2: The R2 migration + schema probe + staging push

Everything SQL, one file, spec §10 order. The probe additions are this task's test; they run against staging AFTER the push (SQL has no local red-green — the probe IS the assertion layer, house pattern since Phase 0).

**Files:**
- Create: `supabase/migrations/20260722120000_r2_ladder_and_numbers.sql`
- Modify: `scripts/verify-schema.mjs` (new R2 probe section + one `.order("id")`)

**Interfaces:**
- Consumes: current schema through `20260721120000_progressive_registration.sql`.
- Produces (later tasks rely on these exact names):
  - RPC `request_delegacy() returns jsonb` (grants: authenticated only). Error tokens: `not_authenticated`, `not_a_member`, `delegacy_exists`.
  - Trigger `delegates_require_completed` raising `delegate_requires_completed_member`.
  - `register()` raising `duplicate_personal_id` from the race path too.
  - `public_stats` row gains `registered_total: number` (3rd column).
  - `admin_overview` row gains `registered_total: number` (6th column).
  - `admin_members` row gains `standing: 'registered'|'member'|'active'`, `signup_delegate_first_name: string|null`, `signup_delegate_last_name: string|null` (appended columns 17-19).
  - `delegate_panel()` jsonb key `draftCount` → **`registeredCount`**.
  - `admin_save_news` raising `invalid_visibility` (was `invalid_status` for that case).

- [ ] **Step 1: Write the migration file** `supabase/migrations/20260722120000_r2_ladder_and_numbers.sql`, exactly:

```sql
-- Phase 6 R2: the ladder and the numbers.
-- Spec: docs/superpowers/specs/2026-07-22-progressive-registration-r2-design.md §3, §4, §5, §8, §10.

-- 1) Integrity (spec §3.2): a delegates row requires a COMPLETED member profile.
--    request_delegacy() satisfies this by construction; the trigger seals every
--    other path (service-role scripts, seed). Staging complies: all 15 seeded
--    delegates sit on active members. Not a definer function — it runs as the
--    inserting role, and only ever reads profiles (schema-qualified).
create function enforce_delegate_completed() returns trigger
language plpgsql as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.id and p.registration_completed_at is not null
  ) then
    raise exception 'delegate_requires_completed_member';
  end if;
  return new;
end $$;

create trigger delegates_require_completed
  before insert or update of id on delegates
  for each row execute function enforce_delegate_completed();

-- 2) The member-only delegacy request (spec §3.1). Inserts the same row the old
--    public funnel created — status defaults to 'pending', referral code minted
--    by the ADR-010 generator, T&C stamp now — but only ever on top of a
--    completed member. Any existing delegates row refuses: pending (already
--    asked), approved (already a delegate), rejected (final — re-approval is an
--    admin decision, spec R2-6/D7). The unique_violation handler covers the
--    double-click race: the second insert loses the pkey race and maps to the
--    same token the pre-check emits.
create function request_delegacy() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.profiles
    where id = v_uid and registration_completed_at is not null
  ) then
    raise exception 'not_a_member';
  end if;
  if exists (select 1 from public.delegates where id = v_uid) then
    raise exception 'delegacy_exists';
  end if;
  begin
    insert into public.delegates (id, referral_code, tc_accepted_at)
    values (v_uid, public.gen_funnel_code(6), now());
  exception when unique_violation then
    raise exception 'delegacy_exists';
  end;
  return public.cabinet_state();
end $$;
grant execute on function request_delegacy() to authenticated;
revoke execute on function request_delegacy() from public, anon;

-- 3) register(): the duplicate-personal-ID pre-check has a check-then-insert
--    race (two same-ID submissions in the same instant). Catch the constraint
--    instead of leaking a raw 23505: personal_id collision → the same
--    'duplicate_personal_id' token the pre-check raises (field-specific Georgian
--    error + in-place retry, spec §7b); pkey collision (the SAME user double
--    submitting) → the row now exists, behave as the existing no-op path.
create or replace function register(
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
  v_constraint text;
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

  begin
    insert into public.profiles (id, first_name, last_name, phone, personal_id, status, signup_ref_code)
    values (
      v_uid, btrim(p_first_name), btrim(p_last_name), v_phone, p_personal_id, 'registered', v_ref
    );
  exception when unique_violation then
    get stacked diagnostics v_constraint = CONSTRAINT_NAME;
    if v_constraint = 'profiles_personal_id_key' then
      raise exception 'duplicate_personal_id';
    elsif v_constraint = 'profiles_pkey' then
      return public.cabinet_state() || jsonb_build_object('created', false);
    else
      raise;
    end if;
  end;

  return public.cabinet_state() || jsonb_build_object('created', true);
end $$;

-- 4) Approval closes the new delegate's own supporter membership (spec §3.1
--    rider): delegates back no one (Phase 3 canon). The membership stays open
--    through the pending wait, so rejection leaves member life untouched. Body
--    otherwise identical to 20260718100000 (ADR-016 completeness guard kept as
--    depth under the new trigger). ACLs survive create-or-replace.
create or replace function admin_approve_delegate(p_delegate_id uuid, p_slug text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
  v_profile public.profiles%rowtype;
  v_slug text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  select * into v_delegate from public.delegates where id = p_delegate_id;
  if not found or v_delegate.status = 'approved' then raise exception 'invalid_target'; end if;
  select * into v_profile from public.profiles where id = p_delegate_id;
  -- the delegates row exists from funnel step 2 — approving an applicant who
  -- abandoned before step 3 would publish a public page + live referral link
  -- for a profile with no tier and no reference code
  if v_profile.registration_completed_at is null then raise exception 'invalid_target'; end if;

  -- slug is permanent once set (URL stability); re-approval keeps the original
  v_slug := coalesce(v_delegate.slug, nullif(btrim(coalesce(p_slug, '')), ''));
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 80 then
    raise exception 'invalid_slug';
  end if;

  -- a concurrent duplicate slug surfaces as 23505; the server action retries
  update public.delegates set
    status = 'approved',
    slug = v_slug,
    verified_at = now(),
    verified_by = v_uid
  where id = p_delegate_id;

  -- R2 rider: a delegate stops being anyone's supporter the moment they hold
  -- the role themselves
  update public.memberships set ended_at = now()
  where member_id = p_delegate_id and ended_at is null;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.approve', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'slug', v_slug,
            'priorStatus', v_delegate.status::text));
  return jsonb_build_object('slug', v_slug);
end $$;

-- 5) The stored wizard choice must never dangle or block deletion (spec §3.2):
--    R1 created the FK with default NO ACTION.
alter table profiles drop constraint profiles_pending_delegate_id_fkey;
alter table profiles add constraint profiles_pending_delegate_id_fkey
  foreign key (pending_delegate_id) references delegates(id) on delete set null;

-- 6) Public counters (spec §4, D5/R2-5): registered_total = ALL profiles,
--    cumulative — every member is also a registered person. Column APPENDED so
--    create-or-replace is legal; grants (anon, authenticated) survive.
create or replace view public_stats as
select
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int from profiles where status = 'active_member') as active_members,
  (select count(*)::int from profiles) as registered_total;

-- 7) Admin views (spec §5). Columns appended; self-gating WHERE unchanged.
--    total_completed / region predicates rewritten from the OID-renamed
--    status <> 'draft' to the explicit R1 meaning (same values, honest text).
create or replace view admin_overview as
select
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int
     from delegates d join profiles p on p.id = d.id
     where d.status = 'pending'
       and p.registration_completed_at is not null) as pending_delegates,
  (select count(*)::int from profiles where status = 'active_member') as active_members,
  (select count(*)::int from profiles
     where registration_completed_at is not null) as total_completed,
  (select coalesce(sum(membership_tier), 0)::int
     from profiles where status = 'active_member') as mrr_gel,
  (select count(*)::int from profiles) as registered_total
where has_any_admin_role('super_admin', 'verifier', 'finance');

create or replace view admin_region_stats as
select r.id as region_id, r.name_ka, count(p.id)::int as member_count
from regions r
join profiles p on p.region_id = r.id and p.registration_completed_at is not null
where has_any_admin_role('super_admin', 'verifier', 'finance')
group by r.id, r.name_ka;

-- standing buckets are DISJOINT and sum to the total (spec §5): the three
-- member_status values already partition profiles 1:1 — the view names them.
-- signup_delegate_* resolves the referral source for registered rows (who
-- brought them in) regardless of that delegate's current status.
create or replace view admin_members as
select
  p.id,
  p.first_name,
  p.last_name,
  p.phone,
  p.region_id,
  r.name_ka as region_name_ka,
  c.name_ka as city_name_ka,
  m.delegate_id,
  dp.first_name as delegate_first_name,
  dp.last_name as delegate_last_name,
  p.status,
  p.membership_tier,
  p.reference_code,
  p.created_at,
  p.registration_completed_at,
  (d.id is not null) as is_delegate,
  case
    when p.status = 'active_member' then 'active'
    when p.registration_completed_at is not null then 'member'
    else 'registered'
  end as standing,
  sdp.first_name as signup_delegate_first_name,
  sdp.last_name as signup_delegate_last_name
from profiles p
left join regions r on r.id = p.region_id
left join cities c on c.id = p.city_id
left join delegates d on d.id = p.id
left join memberships m on m.member_id = p.id and m.ended_at is null
left join profiles dp on dp.id = m.delegate_id
left join delegates sd on sd.referral_code = p.signup_ref_code
left join profiles sdp on sdp.id = sd.id
where has_any_admin_role('super_admin', 'verifier', 'finance');

-- admin_export_members: NO change — its p_status filter already speaks the
-- three-bucket vocabulary ('registered'|'profile_completed'|'active_member').

-- 8) delegate_panel: the jsonb key finally says what it counts (spec §7d). The
--    UI label already reads „რეგისტრირებული“ (R1); this closes the naming debt.
create or replace function delegate_panel() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_delegate from public.delegates where id = v_uid;
  if not found then raise exception 'not_a_delegate'; end if;

  return jsonb_build_object(
    'status', v_delegate.status::text,
    -- inactive until approval: null for pending/rejected so it can't be shared early
    'referralCode', case when v_delegate.status = 'approved'
                         then v_delegate.referral_code end,
    'activeCount', (select count(*)
                      from public.memberships m
                      join public.profiles p on p.id = m.member_id
                      where m.delegate_id = v_uid and m.ended_at is null
                        and p.status = 'active_member'),
    'totalCount', (select count(*)
                     from public.memberships m
                     where m.delegate_id = v_uid and m.ended_at is null),
    'registeredCount', (select count(*)
                          from public.profiles p
                          where p.signup_ref_code = v_delegate.referral_code
                            and p.status = 'registered')
  );
end $$;

-- 9) Phase 5 riders, SQL half (spec §8.1-5).

-- 9a) admin_save_event: conditional DML behind the existing cancelled pre-check
--     (the pre-check alone was check-then-act vs a concurrent cancel) + btrim
--     guard on the description. Body otherwise identical to 20260719150000.
create or replace function admin_save_event(
  p_id uuid, p_title text, p_description text, p_location text,
  p_starts_at timestamptz, p_ends_at timestamptz
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := coalesce(p_description, '');
  v_location text := btrim(coalesce(p_location, ''));
  v_row public.events%rowtype;
  v_action text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid_title'; end if;
  if char_length(v_description) > 20000
     or char_length(btrim(v_description)) < 1 then
    raise exception 'invalid_body';
  end if;
  if char_length(v_location) not between 1 and 200 then raise exception 'invalid_location'; end if;
  if p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'invalid_event_dates';
  end if;

  if p_id is null then
    insert into public.events (title, description, location, starts_at, ends_at, created_by)
    values (v_title, v_description, v_location, p_starts_at, p_ends_at, v_uid)
    returning * into v_row;
    v_action := 'event.save';
  else
    select * into v_row from public.events where id = p_id;
    if not found then raise exception 'invalid_target'; end if;
    -- cancelled events are frozen history (only draft/published are editable)
    if v_row.status = 'cancelled' then raise exception 'invalid_status'; end if;
    v_action := case when v_row.status = 'published' then 'event.update' else 'event.save' end;
    update public.events
    set title = v_title, description = v_description, location = v_location,
        starts_at = p_starts_at, ends_at = p_ends_at
    where id = p_id and status <> 'cancelled'
    returning * into v_row;
    -- conditional DML: a cancel that lands between the check and this UPDATE
    -- now yields zero rows instead of silently editing frozen history
    if not found then raise exception 'invalid_status'; end if;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, v_action, 'event', v_row.id::text,
          jsonb_build_object('title', v_title, 'startsAt', p_starts_at,
                             'status', v_row.status));
  return v_row.id;
end $$;

-- 9b) admin_save_news: honest visibility token + btrim guard on the body.
--     Body otherwise identical to 20260719150000.
create or replace function admin_save_news(p_id uuid, p_title text, p_body text, p_visibility text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := coalesce(p_body, '');
  v_row public.news%rowtype;
  v_action text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid_title'; end if;
  if char_length(v_body) > 20000 or char_length(btrim(v_body)) < 1 then
    raise exception 'invalid_body';
  end if;
  if p_visibility not in ('public', 'members') then raise exception 'invalid_visibility'; end if;

  if p_id is null then
    insert into public.news (title, body, visibility, created_by)
    values (v_title, v_body, p_visibility, v_uid)
    returning * into v_row;
    v_action := 'news.save';
  else
    select * into v_row from public.news where id = p_id;
    if not found then raise exception 'invalid_target'; end if;
    v_action := case when v_row.status = 'published' then 'news.update' else 'news.save' end;
    update public.news
    set title = v_title, body = v_body, visibility = p_visibility
    where id = p_id
    returning * into v_row;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, v_action, 'news', v_row.id::text,
          jsonb_build_object('title', v_title, 'visibility', p_visibility,
                             'status', v_row.status));
  return v_row.id;
end $$;

-- 9c) Whitespace-only bodies become unrepresentable at the table too (the RPCs
--     above are the front door; constraints are the backstop — seed writes
--     status directly, published_news_complete precedent). Existing staging
--     rows all carry real text; a violation here fails the push loudly, which
--     is the correct outcome.
alter table news drop constraint news_body_len;
alter table news add constraint news_body_len
  check (char_length(body) <= 20000 and char_length(btrim(body)) >= 1);
alter table events drop constraint events_description_len;
alter table events add constraint events_description_len
  check (char_length(description) <= 20000 and char_length(btrim(description)) >= 1);

-- 9d) Cover-image pin: the old LIKE accepted ANY host that carried the right
--     path. Pin to the supabase.co storage origin + the uploader's exact
--     filename shape (<news-uuid>-<epoch-ms>.<ext> from PHOTO_TYPES: jpg|png|webp).
--     Existing rows are untouched (validated on SET only).
create or replace function admin_set_news_image(p_id uuid, p_image_url text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.news%rowtype;
  v_url text := nullif(btrim(coalesce(p_image_url, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.news where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  -- pinned to THIS platform's storage origin and the upload action's filename
  -- shape — the RPC pairs with the upload action, so foreign hosts and
  -- hand-crafted paths have no business here
  if v_url is null or char_length(v_url) > 600
     or v_url !~ '^https://[a-z0-9]{20}\.supabase\.co/storage/v1/object/public/news-images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9]{10,16}\.(jpg|png|webp)$' then
    raise exception 'invalid_image';
  end if;

  update public.news set image_url = v_url where id = p_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'news.set_image', 'news', p_id::text,
          jsonb_build_object('title', v_row.title));
end $$;

-- 9e) member_rsvp: the same FOR SHARE lock member_cast_vote has, on the event
--     row — serializes RSVP against admin_cancel_event's status flip (the
--     recorded cancel/RSVP race; inert today, parity is the fix). Body
--     otherwise identical to 20260721120000.
create or replace function member_rsvp(p_event_id uuid, p_going boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'not_completed'; end if;
  if p_going is null then raise exception 'invalid_status'; end if;
  -- FOR SHARE serializes this RSVP against admin_cancel_event's row update
  -- (check-then-insert race) without RSVPs blocking each other
  select * into v_event from public.events where id = p_event_id for share;
  if not found or v_event.status = 'draft' then raise exception 'invalid_target'; end if;
  if v_event.status = 'cancelled' or v_event.starts_at <= now() then
    raise exception 'rsvp_closed';
  end if;

  insert into public.event_rsvps (event_id, member_id, status)
  values (p_event_id, v_uid, case when p_going then 'going' else 'cancelled' end)
  on conflict (event_id, member_id)
  do update set status = excluded.status;
end $$;
```

- [ ] **Step 2: Probe additions in `scripts/verify-schema.mjs`.** Append a new top-level section AFTER the Phase 6 R1 block (after its closing `}`, before `// --- Phase 4: admin CRM probes`), following the R1 block's exact idiom (email fixture users, `expectToken`, try/finally cleanup, `console.log("OK: ...")`). Also add `.order("id")` to the paged payment sum at ~line 1408 (between `.is("voided_at", null)` and `.range(...)`). New section:

```js
// --- Phase 6 R2: delegacy request, counters, buckets, hardening riders ---
{
  const MEMBER_EMAIL = "r2-delegacy-member-probe@example.com";
  const REG_EMAIL = "r2-registered-probe@example.com";
  for (const email of [MEMBER_EMAIL, REG_EMAIL]) {
    const leftover = await findUserByEmail(email);
    if (leftover) {
      const { error } = await db.auth.admin.deleteUser(leftover.id);
      if (error) throw new Error(`cleanup of leftover ${email} failed: ${error.message}`);
    }
  }
  let memberId;
  let regId;
  try {
    // fixtures: one COMPLETED member (with an open central membership), one registered-only
    const memberPassword = randomBytes(24).toString("hex");
    const { data: mUser, error: mErr } = await db.auth.admin.createUser({
      email: MEMBER_EMAIL, password: memberPassword, email_confirm: true,
    });
    if (mErr) throw new Error(`R2 member createUser failed: ${mErr.message}`);
    memberId = mUser.user.id;
    const { error: mpErr } = await db.from("profiles").insert({
      id: memberId, first_name: "პრობი", last_name: "დელეგატობა",
      personal_id: "98765432121", status: "profile_completed",
      membership_tier: 10, reference_code: "GR-PRB2R2",
      registration_completed_at: new Date().toISOString(),
    });
    if (mpErr) throw new Error(`R2 member profile insert failed: ${mpErr.message}`);
    const { error: mmErr } = await db
      .from("memberships").insert({ member_id: memberId, delegate_id: null });
    if (mmErr) throw new Error(`R2 member membership insert failed: ${mmErr.message}`);

    const regPassword = randomBytes(24).toString("hex");
    const { data: rUser, error: rErr } = await db.auth.admin.createUser({
      email: REG_EMAIL, password: regPassword, email_confirm: true,
    });
    if (rErr) throw new Error(`R2 registered createUser failed: ${rErr.message}`);
    regId = rUser.user.id;
    const { error: rpErr } = await db.from("profiles").insert({
      id: regId, first_name: "პრობი", last_name: "მსუბუქი", personal_id: "98765432122",
    });
    if (rpErr) throw new Error(`R2 registered profile insert failed: ${rpErr.message}`);

    // invariant trigger: a delegates row on an incomplete profile is unrepresentable
    const { error: trigErr } = await db.from("delegates").insert({
      id: regId, referral_code: `PROBE-${randomBytes(6).toString("hex")}`,
      tc_accepted_at: new Date().toISOString(),
    });
    if (!trigErr) throw new Error("LEAK: delegates row created on an incomplete profile");
    if (!trigErr.message.includes("delegate_requires_completed_member"))
      throw new Error(`trigger token wrong: ${trigErr.message}`);

    // registered caller: request refused with the member-wall token
    const reg = createClient(url, ANON_KEY);
    const { error: regSignErr } = await reg.auth.signInWithPassword({
      email: REG_EMAIL, password: regPassword,
    });
    if (regSignErr) throw new Error(`R2 registered sign-in failed: ${regSignErr.message}`);
    await expectToken(reg.rpc("request_delegacy"), "not_a_member", "registered request_delegacy");

    // member caller: request lands pending with a minted code + T&C stamp
    const member = createClient(url, ANON_KEY);
    const { error: mSignErr } = await member.auth.signInWithPassword({
      email: MEMBER_EMAIL, password: memberPassword,
    });
    if (mSignErr) throw new Error(`R2 member sign-in failed: ${mSignErr.message}`);
    const { data: reqState, error: reqErr } = await member.rpc("request_delegacy");
    if (reqErr) throw new Error(`request_delegacy failed: ${reqErr.message}`);
    if (reqState.delegateStatus !== "pending")
      throw new Error(`state after request: ${JSON.stringify(reqState.delegateStatus)}`);
    const { data: dRow, error: dRowErr } = await db
      .from("delegates").select("status, referral_code, tc_accepted_at").eq("id", memberId).single();
    if (dRowErr) throw new Error(dRowErr.message);
    if (dRow.status !== "pending" || !dRow.referral_code || !dRow.tc_accepted_at)
      throw new Error(`delegates row malformed: ${JSON.stringify(dRow)}`);

    // second request refused; rejected stays final (R2-6/D7)
    await expectToken(member.rpc("request_delegacy"), "delegacy_exists", "double request");
    const { error: rejErr } = await db
      .from("delegates").update({ status: "rejected" }).eq("id", memberId);
    if (rejErr) throw new Error(rejErr.message);
    await expectToken(member.rpc("request_delegacy"), "delegacy_exists", "re-request after reject");

    // approval closes the requester's own open membership (spec §3.1 rider)
    const superAdmin = await signInAsSeededAdmin("super_admin");
    const { error: backErr } = await db
      .from("delegates").update({ status: "pending" }).eq("id", memberId);
    if (backErr) throw new Error(backErr.message);
    const { error: apprErr } = await superAdmin.rpc("admin_approve_delegate", {
      p_delegate_id: memberId, p_slug: "r2-probe-delegacy",
    });
    if (apprErr) throw new Error(`approve failed: ${apprErr.message}`);
    const { data: openRows, error: openErr } = await db
      .from("memberships").select("id").eq("member_id", memberId).is("ended_at", null);
    if (openErr) throw new Error(openErr.message);
    if (openRows.length !== 0)
      throw new Error(`approval left ${openRows.length} open membership(s) on the new delegate`);

    // counters: registered_total is cumulative and matches ground truth
    const anonStats = createClient(url, ANON_KEY);
    const { data: stats, error: statsErr } = await anonStats
      .from("public_stats").select("*").single();
    if (statsErr) throw new Error(`public_stats: ${statsErr.message}`);
    const { count: profileCount, error: pcErr } = await db
      .from("profiles").select("*", { count: "exact", head: true });
    if (pcErr) throw new Error(pcErr.message);
    if (stats.registered_total !== profileCount)
      throw new Error(`registered_total ${stats.registered_total} != profiles ${profileCount}`);

    // admin buckets: disjoint and summing to the total; overview registered_total present
    const { data: bucketRows, error: bErr } = await superAdmin
      .from("admin_members").select("standing");
    if (bErr) throw new Error(`admin_members standing: ${bErr.message}`);
    const bucketTotal = bucketRows.length;
    const byBucket = { registered: 0, member: 0, active: 0 };
    for (const row of bucketRows) {
      if (!(row.standing in byBucket)) throw new Error(`unknown standing ${row.standing}`);
      byBucket[row.standing] += 1;
    }
    if (byBucket.registered + byBucket.member + byBucket.active !== bucketTotal)
      throw new Error("buckets do not sum to total");
    const { data: ov, error: ovErr } = await superAdmin
      .from("admin_overview").select("*").single();
    if (ovErr) throw new Error(`admin_overview: ${ovErr.message}`);
    if (typeof ov.registered_total !== "number" || ov.registered_total < ov.total_completed)
      throw new Error(`overview registered_total wrong: ${JSON.stringify(ov)}`);

    // delegate_panel speaks registeredCount now (rename shipped)
    const { data: panel, error: panelErr } = await member.rpc("delegate_panel");
    if (panelErr) throw new Error(`delegate_panel: ${panelErr.message}`);
    if (!("registeredCount" in panel) || "draftCount" in panel)
      throw new Error(`panel keys wrong: ${Object.keys(panel).join(",")}`);

    // dup-ID race premise: the personal_id unique constraint carries the exact
    // name register()'s handler matches on
    const { error: dupErr } = await db.from("profiles").insert({
      id: memberId, first_name: "x", last_name: "y", personal_id: "98765432121",
    });
    if (!dupErr) throw new Error("duplicate insert unexpectedly succeeded");
    if (!dupErr.message.includes("profiles_pkey") && !dupErr.message.includes("profiles_personal_id_key"))
      throw new Error(`constraint name premise broken: ${dupErr.message}`);

    // pending_delegate_id: deleting a delegate clears the stored choice
    const { error: pointErr } = await db
      .from("profiles").update({ pending_delegate_id: memberId }).eq("id", regId);
    if (pointErr) throw new Error(pointErr.message);
    const { error: delDelErr } = await db.from("delegates").delete().eq("id", memberId);
    if (delDelErr) throw new Error(`delegate delete blocked: ${delDelErr.message}`);
    const { data: cleared, error: clearedErr } = await db
      .from("profiles").select("pending_delegate_id").eq("id", regId).single();
    if (clearedErr) throw new Error(clearedErr.message);
    if (cleared.pending_delegate_id !== null)
      throw new Error("pending_delegate_id did not clear on delegate deletion");

    // rider tokens: save_news visibility + whitespace bodies + image pin
    const editor = await signInAsSeededAdmin("editor");
    await expectToken(
      editor.rpc("admin_save_news", { p_id: null, p_title: "პრობა", p_body: "ტექსტი", p_visibility: "everyone" }),
      "invalid_visibility", "admin_save_news bad visibility",
    );
    await expectToken(
      editor.rpc("admin_save_news", { p_id: null, p_title: "პრობა", p_body: "   \n  ", p_visibility: "public" }),
      "invalid_body", "admin_save_news whitespace body",
    );
    const { data: savedEventId, error: seErr } = await editor.rpc("admin_save_event", {
      p_id: null, p_title: "R2 პრობის ღონისძიება", p_description: "აღწერა",
      p_location: "თბილისი", p_starts_at: new Date(Date.now() + 86400000).toISOString(),
      p_ends_at: null,
    });
    if (seErr) throw new Error(`save_event: ${seErr.message}`);
    const { error: cancErr } = await editor.rpc("admin_cancel_event", { p_id: savedEventId });
    if (cancErr) throw new Error(`cancel_event: ${cancErr.message}`);
    await expectToken(
      editor.rpc("admin_save_event", {
        p_id: savedEventId, p_title: "შეცვლა", p_description: "აღწერა",
        p_location: "თბილისი", p_starts_at: new Date(Date.now() + 86400000).toISOString(),
        p_ends_at: null,
      }),
      "invalid_status", "editing a cancelled event",
    );
    const { data: probeNewsId, error: pnErr } = await editor.rpc("admin_save_news", {
      p_id: null, p_title: "R2 პინის პრობა", p_body: "ტექსტი", p_visibility: "public",
    });
    if (pnErr) throw new Error(pnErr.message);
    await expectToken(
      editor.rpc("admin_set_news_image", {
        p_id: probeNewsId,
        p_image_url: "https://evil.example/storage/v1/object/public/news-images/x.jpg",
      }),
      "invalid_image", "foreign-host image URL",
    );
    // cleanup the probe content rows
    for (const [rpc, id] of [["admin_delete_news", probeNewsId], ["admin_delete_event", savedEventId]]) {
      const { error } = await editor.rpc(rpc, { p_id: id });
      if (error) console.error(`WARNING: R2 probe content cleanup ${rpc} failed: ${error.message}`);
    }

    // export filter already speaks the bucket vocabulary (spec §10.6: no change — assert it)
    const { data: exportRows, error: exportErr } = await superAdmin.rpc("admin_export_members", {
      p_search: null, p_region_id: null, p_status: "registered", p_include_ids: false,
    });
    if (exportErr) throw new Error(`export standing filter: ${exportErr.message}`);
    for (const row of exportRows) {
      if (row.status !== "registered")
        throw new Error(`export p_status=registered leaked status ${row.status}`);
    }

    console.log(
      "OK: R2 — delegacy lifecycle (request/refuse/reject-final/approve closes membership), invariant trigger, registered_total, disjoint buckets, registeredCount, rider guards",
    );
  } finally {
    for (const [label, id] of [
      ["R2 member probe", memberId],
      ["R2 registered probe", regId],
    ]) {
      if (id) {
        const { error } = await db.auth.admin.deleteUser(id);
        if (error)
          console.error(`WARNING: ${label} cleanup (deleteUser ${id}) failed: ${error.message}`);
      }
    }
  }
}
```
  While writing: keep `expectToken`'s argument order exactly as the file's helper defines it, and match `signInAsSeededAdmin`'s argument shape to its existing Phase 4/5 call sites (read one before writing these).

- [ ] **Step 3: Pre-push checklist (SQL has no local runner).** Diff every `create or replace` body against its verbatim baseline file (named in each section comment) — only the annotated deltas may differ. Confirm every NEW function carries the grant/revoke pair. Run the Georgian-text gate on both changed files.

- [ ] **Step 4 (OWNER-ASSIST): push to staging.** `supabase db push` (project `orcxtbedkexoclbfgvzd`; needs manual-mode confirm). Expected output ends listing `20260722120000_r2_ladder_and_numbers.sql` applied. **The staging cutover window OPENS here** — record it in the ledger.

- [ ] **Step 5: run the probe.** Env-load, then `node --env-file=.env.local scripts/verify-schema.mjs`. Expected: every existing `OK:` line still prints, plus the new `OK: R2 — delegacy lifecycle …` line. Any failure = fix the migration IN PLACE (`db push` again is idempotent per file — if the file itself must change after a successful apply, write a NEW migration file instead; never edit an applied one).

- [ ] **Step 6: Commit**

```powershell
git add supabase/migrations/20260722120000_r2_ladder_and_numbers.sql scripts/verify-schema.mjs
git commit -m "feat(db): R2 migration - delegacy request + invariant, counters, buckets, approve closes membership, P5 rider guards"
```

---

### Task 3: lib contract — approved-gated routing, delegacy states, registeredCount, login error surface

**Files:**
- Modify: `lib/funnel.ts`, `lib/cabinet.ts`, `app/(delegate)/delegate/page.tsx:93`, `app/(public)/login/page.tsx`
- Test: `lib/cabinet.test.ts` (extend), `lib/funnel.test.ts` (extend), `app/(public)/login/login.test.tsx` (create)

**Interfaces:**
- Consumes: `CabinetStatePresent.delegateStatus: "pending"|"approved"|"rejected"|null` (already in the RPC + type).
- Produces:
  - `lib/cabinet.ts`: `export function isApprovedDelegate(state: CabinetStatePresent): boolean`
  - `lib/cabinet.ts`: `export type DelegacyPhase = "eligible" | "pending" | "rejected" | "approved"`; `export function deriveDelegacyPhase(state: CabinetStatePresent): DelegacyPhase | null` (null for non-members — registered cannot request).
  - `deriveDestination` / `cabinetRole` now send ONLY approved delegates to `/delegate` / delegate nav.
  - `DelegatePanelData.registeredCount: number` (field renamed).
  - `lib/funnel.ts` `ERROR_MESSAGES` += `delegacy_exists`, `invalid_visibility`.

- [ ] **Step 1: Failing tests first.** Extend `lib/cabinet.test.ts` (match existing fixture style — build a `CabinetStatePresent` fixture helper if one exists, else inline object literals with every required field):

```ts
const base = {
  exists: true as const, standing: "member" as const, status: "profile_completed" as const,
  role: "delegate" as const, firstName: "ა", lastName: "ბ", personalIdMasked: "010********",
  birthDate: "1990-01-01", regionId: 1, cityId: 1, employment: "x", tier: 10 as const,
  referenceCode: "GR-ABCDEF", completed: true, delegateStatus: "pending" as const,
  referral: null, pendingDelegate: null, chosenDelegate: null, membershipExists: true,
  registrationCompletedAt: "2026-07-01T00:00:00Z", createdAt: "2026-07-01T00:00:00Z",
  admin: false,
};

describe("approved-gated delegacy routing (R2)", () => {
  it("keeps a PENDING requester in the member cabinet", () => {
    expect(deriveDestination(base)).toBe("/me/profile");
    expect(cabinetRole(base)).toBe("member");
  });
  it("keeps a REJECTED requester in the member cabinet", () => {
    const s = { ...base, delegateStatus: "rejected" as const };
    expect(deriveDestination(s)).toBe("/me/profile");
    expect(cabinetRole(s)).toBe("member");
  });
  it("sends an APPROVED delegate to /delegate", () => {
    const s = { ...base, delegateStatus: "approved" as const };
    expect(deriveDestination(s)).toBe("/delegate");
    expect(cabinetRole(s)).toBe("delegate");
  });
});

describe("deriveDelegacyPhase", () => {
  it("eligible for a member with no delegates row", () => {
    const s = { ...base, role: "member" as const, delegateStatus: null };
    expect(deriveDelegacyPhase(s)).toBe("eligible");
  });
  it("mirrors delegateStatus for pending/rejected/approved", () => {
    expect(deriveDelegacyPhase(base)).toBe("pending");
    expect(deriveDelegacyPhase({ ...base, delegateStatus: "rejected" })).toBe("rejected");
    expect(deriveDelegacyPhase({ ...base, delegateStatus: "approved" })).toBe("approved");
  });
  it("null for a registered (non-member) standing", () => {
    const s = { ...base, standing: "registered" as const, status: "registered" as const,
      role: "member" as const, delegateStatus: null, completed: false };
    expect(deriveDelegacyPhase(s)).toBeNull();
  });
});
```
  Extend `lib/funnel.test.ts`: `mapFunnelError("delegacy_exists")` and `mapFunnelError("invalid_visibility")` return the new Georgian messages (assert non-generic: `expect(mapFunnelError("delegacy_exists")).not.toBe(GENERIC_FUNNEL_ERROR)`).

- [ ] **Step 2: Run to verify failure.** `npx vitest run lib/cabinet.test.ts lib/funnel.test.ts` — Expected: FAIL (`isApprovedDelegate`/`deriveDelegacyPhase` not exported; pending fixture currently routes to `/delegate`; tokens map to generic).

- [ ] **Step 3: Implement.**
  `lib/cabinet.ts` — replace the two functions and the panel type field:

```ts
/** Delegacy is a ROLE only once approved (R2): pending/rejected live in the member cabinet. */
export function isApprovedDelegate(state: CabinetStatePresent): boolean {
  return state.role === "delegate" && state.delegateStatus === "approved";
}

export function deriveDestination(state: CabinetState | null): string {
  if (!state || !state.exists) return "/join";
  if (isApprovedDelegate(state)) return "/delegate";
  return state.standing === "member" ? "/me/profile" : "/me";
}

export function cabinetRole(state: CabinetStatePresent): "registered" | "member" | "delegate" {
  if (isApprovedDelegate(state)) return "delegate";
  return state.standing === "member" ? "member" : "registered";
}

/** Card state for the member-cabinet delegacy journey (spec §3.1). */
export type DelegacyPhase = "eligible" | "pending" | "rejected" | "approved";

export function deriveDelegacyPhase(state: CabinetStatePresent): DelegacyPhase | null {
  if (state.standing !== "member") return null; // registered cannot request
  if (state.delegateStatus !== null) return state.delegateStatus;
  return "eligible";
}
```
  Update the two doc comments above `deriveDestination`/`cabinetRole` (they currently say "delegates-row wins"). In `DelegatePanelData`, rename `draftCount: number;` → `registeredCount: number;` and update the mirroring comment. In `app/(delegate)/delegate/page.tsx:93`: `<StatCard value={panel.draftCount} …>` → `<StatCard value={panel.registeredCount} label="რეგისტრირებული" />` (label unchanged).
  `lib/funnel.ts` — append to `ERROR_MESSAGES` (new group comment, after the Phase 5 block):

```ts
  // Phase 6 R2 tokens (spec §3.1, §8.3)
  delegacy_exists: "დელეგატობის მოთხოვნა უკვე დაფიქსირებულია.",
  invalid_visibility: "ხილვადობის პარამეტრი არასწორია — სცადე თავიდან.",
```

- [ ] **Step 4: Login error surface (spec §7c).** `app/(public)/login/page.tsx` — write the failing test FIRST: create `app/(public)/login/login.test.tsx` following `JoinForm.test.tsx`'s mocking pattern (mock `@/lib/supabase/client`'s `createClient` and `next/navigation`'s `useRouter`); case: `cabinet_state` rpc resolves `{ data: null, error: { message: "boom" } }` after OTP verify → the page shows `მონაცემების წამოღება ვერ მოხერხდა — სცადე თავიდან` and does NOT call `router.replace`. Run it: FAIL (today it replaces to `/join`). Then implement:

```tsx
  const [routeError, setRouteError] = useState<string>();

  async function routeByCabinetState() {
    // Post-verify landing (spec §3.8): the derived destination. A lapsed lookup
    // must NOT bounce an existing member to /join (R2 §7c) — surface it instead;
    // deriveDestination handles the legitimate no-profile case via exists:false.
    setRouteError(undefined);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("cabinet_state");
    if (rpcError || data === null) {
      setRouteError("მონაცემების წამოღება ვერ მოხერხდა — სცადე თავიდან.");
      return;
    }
    router.replace(deriveDestination(data as unknown as CabinetState));
  }
```
  and render under the OTP block:

```tsx
        ) : (
          <div className="flex flex-col gap-3">
            <OtpVerification phone={phone} onVerified={routeByCabinetState} />
            {routeError ? <p className="text-sm font-semibold text-danger">{routeError}</p> : null}
          </div>
        )}
```
  (`text-danger` is the design-system token used by form errors; verify against `components/Field.tsx` and reuse whatever class it uses if different.) Note `OtpVerification.verify()` already releases `busy` in `finally`, so the retry button live-again behavior is free.

- [ ] **Step 5: Run all unit tests.** `npm test` — Expected: PASS, count grows by the new cases. `npm run typecheck` — 0 errors (this proves the `draftCount` rename reached every consumer: the compiler finds any missed one).

- [ ] **Step 6: Georgian gate** on `lib/funnel.ts`, `lib/cabinet.ts`, `app/(public)/login/page.tsx`, `app/(delegate)/delegate/page.tsx`.

- [ ] **Step 7: Commit**

```powershell
git add lib/funnel.ts lib/cabinet.ts lib/cabinet.test.ts lib/funnel.test.ts "app/(delegate)/delegate/page.tsx" "app/(public)/login/page.tsx" "app/(public)/login/login.test.tsx"
git commit -m "feat(lib): approved-gated delegacy routing + phase derivation; registeredCount; login lookup error surface"
```

---

### Task 4: Delegacy request UI — /me/delegacy, cards, layout gates, terms move

**Files:**
- Create: `app/(member)/me/delegacy/page.tsx`, `app/(member)/me/delegacy/actions.ts`, `app/(member)/me/delegacy/DelegacyConfirm.tsx`, `app/(member)/me/delegacy/DelegacyConfirm.test.tsx`
- Modify: `app/(member)/me/profile/page.tsx` (completed branch: delegacy card + `cabinetRole`-based checks), `app/(member)/me/page.tsx:20`, `app/(delegate)/layout.tsx`, `app/(public)/join/terms/page.tsx` (becomes a redirect)

**Interfaces:**
- Consumes: `request_delegacy` RPC (Task 2), `deriveDelegacyPhase`/`isApprovedDelegate`/`DelegacyPhase` (Task 3), `mapFunnelError`, `ActionResult` pattern, `Card`/`ButtonLink`/`Button`/`Pill`/`Eyebrow` components.
- Produces: `requestDelegacyAction(): Promise<{ ok: true } | { ok: false; error: string }>` (no input — nothing to zod-parse; the RPC re-checks everything server-side).

- [ ] **Step 1: Failing component test.** `DelegacyConfirm.test.tsx` (pattern: `TierChange.test.tsx` — mock the action module):

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const requestDelegacyAction = vi.fn();
vi.mock("./actions", () => ({ requestDelegacyAction: (...a: unknown[]) => requestDelegacyAction(...a) }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DelegacyConfirm } from "./DelegacyConfirm";

describe("DelegacyConfirm", () => {
  it("submits and refreshes on success", async () => {
    requestDelegacyAction.mockResolvedValue({ ok: true });
    render(<DelegacyConfirm />);
    fireEvent.click(screen.getByRole("button", { name: "მოთხოვნის გაგზავნა" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
  it("shows the Georgian error and re-enables on failure", async () => {
    requestDelegacyAction.mockResolvedValue({ ok: false, error: "დელეგატობის მოთხოვნა უკვე დაფიქსირებულია." });
    render(<DelegacyConfirm />);
    const btn = screen.getByRole("button", { name: "მოთხოვნის გაგზავნა" });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(screen.getByText("დელეგატობის მოთხოვნა უკვე დაფიქსირებულია.")).toBeVisible(),
    );
    expect(btn).toBeEnabled();
  });
  it("never strands the button on a thrown action", async () => {
    requestDelegacyAction.mockRejectedValue(new Error("network"));
    render(<DelegacyConfirm />);
    const btn = screen.getByRole("button", { name: "მოთხოვნის გაგზავნა" });
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeEnabled());
    expect(screen.getByText("რაღაც შეცდომა მოხდა — სცადე თავიდან.")).toBeVisible();
  });
});
```
  Run: `npx vitest run "app/(member)/me/delegacy"` — FAIL (module missing).

- [ ] **Step 2: Implement the three files.**
  `actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type DelegacyActionResult = { ok: true } | { ok: false; error: string };

/** No input to parse — request_delegacy() re-checks standing + uniqueness in-DB (ADR-009). */
export async function requestDelegacyAction(): Promise<DelegacyActionResult> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("request_delegacy");
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  // the profile card + this page both flip to pending
  revalidatePath("/me", "layout");
  return { ok: true };
}
```
  `DelegacyConfirm.tsx` (busy/error handling mirrors `TierChange`/`RegisteredProfileForm` — try/catch/finally, never strand):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { requestDelegacyAction } from "./actions";

export function DelegacyConfirm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setError(undefined);
    setBusy(true);
    try {
      const result = await requestDelegacyAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(GENERIC_FUNNEL_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={confirm} disabled={busy} data-testid="delegacy-confirm">
        მოთხოვნის გაგზავნა
      </Button>
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
```
  (If `Button` doesn't forward `data-testid`, drop the attribute — the accessible name is the locator.)
  `page.tsx` — server component; terms content moved VERBATIM from `app/(public)/join/terms/page.tsx` (copy the `<ol>` block byte-for-byte — Georgian text, do not retype), then the phase branch:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { deriveDelegacyPhase } from "@/lib/cabinet";
import { getCabinetState } from "@/lib/supabase/server";
import { DelegacyConfirm } from "./DelegacyConfirm";

export const metadata: Metadata = { title: "გახდი დელეგატი — ქართული რესპუბლიკა" };

export default async function DelegacyPage() {
  const state = await getCabinetState();
  if (!state.exists) redirect("/join");
  const phase = deriveDelegacyPhase(state);
  if (phase === null) redirect("/me/membership"); // registered: membership comes first
  if (phase === "approved") redirect("/delegate");

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>პირადი კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">გახდი დელეგატი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          დელეგატი მოძრაობის რეგიონული ხმაა — ვერიფიცირებული, საჯარო და ანგარიშვალდებული.
        </p>
      </div>
      {phase === "pending" ? (
        <Card>
          <div className="flex items-center gap-3">
            <Pill status="pending" label="განიხილება" />
            <h2 className="text-lg font-bold text-ink">მოთხოვნა გაგზავნილია</h2>
          </div>
          <p className="mt-2 text-sm text-muted-fg">
            შენი მოთხოვნა ადმინისტრაციასთანაა — შედეგს აქვე ნახავ. ამასობაში წევრობის ყველა
            შესაძლებლობა უცვლელად მუშაობს.
          </p>
        </Card>
      ) : phase === "rejected" ? (
        <Card>
          <div className="flex items-center gap-3">
            <Pill status="rejected" label="არ დამტკიცდა" />
            <h2 className="text-lg font-bold text-ink">მოთხოვნა არ დამტკიცდა</h2>
          </div>
          <p className="mt-2 text-sm text-muted-fg">
            ხელახლა წარდგენა ადმინისტრაციის გადაწყვეტილებით არის შესაძლებელი. შენი წევრობა
            უცვლელი რჩება.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="rounded-lg bg-warn/10 p-3 text-sm font-semibold text-warn">
            სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.
          </p>
          <Card>
            {/* the <ol> terms block moved VERBATIM from app/(public)/join/terms/page.tsx */}
          </Card>
          <Card>
            <h2 className="text-lg font-bold text-ink">დაადასტურე თანხმობა</h2>
            <p className="mt-1 text-sm text-muted-fg">
              გაგზავნით ეთანხმები ზემოთ მოცემულ წესებს. ახალი მონაცემები არ გროვდება —
              ვერიფიკაციას შენი არსებული პროფილი გადის.
            </p>
            <div className="mt-4">
              <DelegacyConfirm />
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Run the component test.** `npx vitest run "app/(member)/me/delegacy"` — Expected: 3 PASS.

- [ ] **Step 4: The member-facing card + routing edits.**
  - `app/(member)/me/profile/page.tsx`, COMPLETED branch: wrap `<ProfileForm …/>` in a right-column `<div className="flex flex-col gap-6">` (the registered branch's exact pattern) and add the delegacy card as its sibling BELOW the form. Exact card:

```tsx
            {delegacyPhase === "eligible" ? (
              <Card>
                <p className="text-xs font-bold uppercase tracking-widest text-brand">
                  შემდეგი საფეხური
                </p>
                <h3 className="mt-1 text-lg font-bold text-ink">გახდი დელეგატი</h3>
                <p className="mt-1 text-sm text-muted-fg">
                  წარადგინე კანდიდატურა და გახდი მოძრაობის რეგიონული ხმა — საჯარო პროფილით და
                  საკუთარი გუნდით.
                </p>
                <div className="mt-4">
                  <ButtonLink href="/me/delegacy">გაიგე მეტი →</ButtonLink>
                </div>
              </Card>
            ) : delegacyPhase === "pending" ? (
              <Card>
                <div className="flex items-center gap-3">
                  <Pill status="pending" label="განიხილება" />
                  <h3 className="text-lg font-bold text-ink">დელეგატობის მოთხოვნა გაგზავნილია</h3>
                </div>
                <p className="mt-2 text-sm text-muted-fg">შედეგს აქვე ნახავ.</p>
              </Card>
            ) : delegacyPhase === "rejected" ? (
              <Card>
                <div className="flex items-center gap-3">
                  <Pill status="rejected" label="არ დამტკიცდა" />
                  <h3 className="text-lg font-bold text-ink">დელეგატობის მოთხოვნა</h3>
                </div>
                <p className="mt-2 text-sm text-muted-fg">
                  ხელახლა წარდგენა ადმინისტრაციის გადაწყვეტილებით არის შესაძლებელი.
                </p>
              </Card>
            ) : null}
```
    with `const delegacyPhase = deriveDelegacyPhase(state);` computed after the completed-branch narrow, and imports extended (`deriveDelegacyPhase`, `ButtonLink` already imported, `Card`/`Pill` present). ALSO swap the two `state.role === "member"` checks (lines ~140 and ~151) to `cabinetRole(state) === "member"` (import `cabinetRole`) — a pending requester still backs a delegate and must keep seeing the „დელეგატი“ fact row + change link.
  - `app/(member)/me/page.tsx:20`: `if (state.role === "delegate") redirect("/delegate");` → `if (state.exists && isApprovedDelegate(state)) redirect("/delegate");` — but the `!state.exists` guard on line 19 already narrowed, so simply: `if (isApprovedDelegate(state)) redirect("/delegate");` (import `isApprovedDelegate` from `@/lib/cabinet`, drop unused imports if any).
  - `app/(delegate)/layout.tsx`: replace the two-check block and its comment:

```tsx
/**
 * Delegate gate (R2): APPROVED delegates only. Pending/rejected requesters and
 * everyone else land on their derived destination — which, since R2, never
 * points a non-approved delegacy back here, so no redirect loop is possible;
 * the delegates-require-completed-member trigger removes the half-formed
 * hybrid the R1 guard defended against.
 */
export default async function DelegateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const state = await getCabinetState();
  if (!state.exists || !isApprovedDelegate(state)) {
    redirect(deriveDestination(state));
  }
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <CabinetNav items={cabinetNavItems("delegate", state.admin)} />
      {children}
    </div>
  );
}
```
    (imports: `isApprovedDelegate` added, `deriveDestination` kept.)
  - `app/(public)/join/terms/page.tsx`: whole file becomes

```tsx
import { redirect } from "next/navigation";

/** The delegate terms moved into the member cabinet with the R2 delegacy flow. */
export default function TermsPage() {
  redirect("/me/delegacy");
}
```

- [ ] **Step 5: Gates.** `npm run typecheck && npm run lint && npm test && npm run build` — all green. Georgian gate on every file touched in this task.

- [ ] **Step 6: Commit**

```powershell
git add "app/(member)/me/delegacy" "app/(member)/me/profile/page.tsx" "app/(member)/me/page.tsx" "app/(delegate)/layout.tsx" "app/(public)/join/terms/page.tsx"
git commit -m "feat(cabinet): delegacy request flow - /me/delegacy, profile card states, approved-only delegate gate, terms moved"
```

---

### Task 5: Public numbers + wording

**Files:**
- Modify: `lib/supabase/types.ts` (public_stats Row), `lib/supabase/public.ts` (PublicStats type if separate), `app/(public)/page.tsx` (3rd counter), `app/(public)/transparency/page.tsx` (registered figure), `app/(public)/layout.tsx:48` (header CTA), `app/(public)/delegates/[slug]/page.tsx:92-95` (supporter copy), `e2e/public.spec.ts:30-31` (stale comment only)

**Interfaces:**
- Consumes: `public_stats.registered_total` (Task 2), `fetchPublicStats()`, `formatCountKa`, `CountUp`, `StatCard`.
- Produces: homepage `data-testid="stat-registered-total"` (e2e hook for Task 9).

- [ ] **Step 1: types.** `lib/supabase/types.ts:231`: `Row: { approved_delegates: number; active_members: number };` → `Row: { approved_delegates: number; active_members: number; registered_total: number };`. If `PublicStats` in `lib/supabase/public.ts` is its own interface, add the field there too (check the file top; `single<PublicStats>()` at :47).

- [ ] **Step 2: Homepage third counter.** In `app/(public)/page.tsx`, the hero stats grid (`mt-10 grid max-w-lg grid-cols-2 gap-4`) becomes `mt-10 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3`, and a new FIRST tile (breadth leads the ladder; delegates stay last as today):

```tsx
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <div
                className="text-4xl font-extrabold tabular-nums"
                data-testid="stat-registered-total"
              >
                <CountUp value={stats.registered_total} />
              </div>
              <div className="mt-1.5 text-sm font-semibold text-white/60">რეგისტრირებული</div>
            </div>
```
  Order in JSX: registered → active („აქტიური წევრი“, existing tile) → delegates („დამტკიცებული დელეგატი“, existing tile). Move the existing delegate tile below the active tile to match.

- [ ] **Step 3: Transparency.** `app/(public)/transparency/page.tsx`: add `fetchPublicStats` to the imports and the `Promise.all`; grid `sm:grid-cols-3` → `sm:grid-cols-2 lg:grid-cols-4`; insert after the total-gel card:

```tsx
        <StatCard value={formatCountKa(publicStats.registered_total)} label="რეგისტრირებული" />
```
  (`const [stats, regionsRaw, publicStats] = await Promise.all([fetchTransparencyStats(), fetchTransparencyRegions(), fetchPublicStats()]);`). The existing „წევრი“ card (completed members) stays — the two numbers answer different questions.

- [ ] **Step 4: Wording.** `app/(public)/layout.tsx:48`: `გახდი წევრი` → `დარეგისტრირდი` (nothing else on the line changes). `app/(public)/delegates/[slug]/page.tsx:92-95`: replace the supporting sentence only (button label stays):

```tsx
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-fg">
              დარეგისტრირდი ერთ წუთში და წევრობის გაფორმებისას აირჩიე ის შენს დელეგატად —
              მხარდაჭერა წევრობით ხდება.
            </p>
```
  (The `/join` href stays bare deliberately: public pages cannot carry `?ref=` — referral codes are sealed from public views; the wizard's picker is the path. Note this in the JSX comment above the card if one exists; do not add one otherwise.) `e2e/public.spec.ts:30-31`: update the comment's `„გახდი წევრი"` mention to `„დარეგისტრირდი"` (comment only — no assertion exists yet; Task 9 adds it).

- [ ] **Step 5: Gates.** `npm run typecheck && npm run lint && npm test && npm run build`. Georgian gate on all five app files.

- [ ] **Step 6: Commit**

```powershell
git add lib/supabase/types.ts lib/supabase/public.ts "app/(public)/page.tsx" "app/(public)/transparency/page.tsx" "app/(public)/layout.tsx" "app/(public)/delegates/[slug]/page.tsx" e2e/public.spec.ts
git commit -m "feat(public): registered counter on home + transparency; header CTA -> daregistrirdi; honest supporter copy"
```

---

### Task 6: Admin numbers UI — registered total, conversion, referral source

**Files:**
- Modify: `lib/supabase/types.ts` (admin_overview + admin_members Rows), `lib/admin.ts` (+`conversionPct`), `app/(admin)/admin/page.tsx`, `app/(admin)/admin/members/page.tsx`
- Test: `lib/admin.test.ts` (extend)

**Interfaces:**
- Consumes: `admin_overview.registered_total`, `admin_members.standing/signup_delegate_first_name/signup_delegate_last_name` (Task 2).
- Produces: `export function conversionPct(completed: number, registered: number): string` in `lib/admin.ts` — `"—"` when registered is 0, else `` `${Math.round((completed / registered) * 100)}%` ``.

- [ ] **Step 1: Failing test.** `lib/admin.test.ts`:

```ts
describe("conversionPct", () => {
  it("rounds and formats", () => {
    expect(conversionPct(1770, 1902)).toBe("93%");
    expect(conversionPct(1, 3)).toBe("33%");
  });
  it("dashes on zero registered (no division)", () => {
    expect(conversionPct(0, 0)).toBe("—");
  });
});
```
  Run `npx vitest run lib/admin.test.ts` — FAIL (not exported).

- [ ] **Step 2: Implement `conversionPct`** in `lib/admin.ts` (next to `barPct`):

```ts
/** Members ÷ registered as a whole percentage (spec §5); em-dash on an empty registry. */
export function conversionPct(completed: number, registered: number): string {
  if (registered <= 0) return "—";
  return `${Math.round((completed / registered) * 100)}%`;
}
```

- [ ] **Step 3: types.** `admin_overview` Row += `registered_total: number;`. `admin_members` Row += (after `is_delegate: boolean;`):

```ts
          standing: "registered" | "member" | "active";
          signup_delegate_first_name: string | null;
          signup_delegate_last_name: string | null;
```

- [ ] **Step 4: Overview cards.** `app/(admin)/admin/page.tsx`: grid `grid-cols-2 gap-4 lg:grid-cols-4` → `grid-cols-2 gap-4 lg:grid-cols-3`, and the card list becomes SIX (import `conversionPct`): registered first, then the ladder:

```tsx
        <StatCard
          value={formatCountKa(overview.registered_total)}
          label="რეგისტრირებული"
          sub="ჯამური რეესტრი — წევრებიც შედიან"
        />
        <StatCard
          value={formatCountKa(overview.total_completed)}
          label="წევრი"
          sub="დასრულებული წევრობა"
        />
        <StatCard
          value={conversionPct(overview.total_completed, overview.registered_total)}
          label="კონვერსია"
          sub="რეგისტრაციიდან წევრობამდე"
        />
```
  followed by the four existing cards (props byte-identical, only reordered). Final layout: SEVEN cards, grid stays `grid-cols-2 gap-4 lg:grid-cols-4` (4+3 wrap), order: რეგისტრირებული, წევრი, კონვერსია, აქტიური წევრი, დამტკიცებული დელეგატი, ვერიფიკაციის მოლოდინში, სავარაუდო MRR. (Active ≠ member — both stay; the ladder reads left to right.)

- [ ] **Step 5: Members referral-source cell.** `app/(admin)/admin/members/page.tsx`, the დელეგატი cell: registered rows currently mislabel as „ცენტრალური მოძრაობა“. Replace the cell body:

```tsx
                  <td className={tableCellClass}>
                    {m.standing === "registered"
                      ? m.signup_delegate_first_name
                        ? `მოიწვია: ${m.signup_delegate_first_name} ${m.signup_delegate_last_name}`
                        : "—"
                      : m.delegate_id
                        ? `${m.delegate_first_name} ${m.delegate_last_name}`
                        : "ცენტრალური მოძრაობა"}
                  </td>
```

- [ ] **Step 6: Gates.** `npm test` (new cases green), `npm run typecheck && npm run lint && npm run build`. Georgian gate on the two admin pages + lib/admin.ts.

- [ ] **Step 7: Commit**

```powershell
git add lib/admin.ts lib/admin.test.ts lib/supabase/types.ts "app/(admin)/admin/page.tsx" "app/(admin)/admin/members/page.tsx"
git commit -m "feat(admin): registered total + conversion on overview; referral source for registered rows"
```

---

### Task 7: Content riders — slug cap + shared mint helper, PollForm keys, poll revalidate

**Files:**
- Modify: `lib/slug.ts`, `app/(admin)/admin/content/news/actions.ts`, `app/(admin)/admin/content/events/actions.ts`, `app/(admin)/admin/verify/actions.ts`, `app/(admin)/admin/content/polls/PollForm.tsx`, `app/(admin)/admin/content/polls/actions.ts`
- Create: `lib/publish-slug.ts`
- Test: `lib/slug.test.ts` (extend), `lib/publish-slug.test.ts` (create), `app/(admin)/admin/content/polls/PollForm.test.tsx` (extend)

**Interfaces:**
- Produces:
  - `lib/slug.ts`: `export const SLUG_MAX = 80;` — `slugFrom` truncates its base to `SLUG_MAX` (then re-trims trailing `-`); `makeSlugFrom` keeps EVERY candidate ≤ `SLUG_MAX` by shortening the base to fit the `-${n}` suffix.
  - `lib/publish-slug.ts`: `export async function resolvePublishSlug(opts: { title: string; fallback: string; existingSlug: string | null; fetchTaken: (base: string) => Promise<string[] | null> }): Promise<string | null>` — returns the slug to attempt (existing slug wins; else mint against the taken set), `null` when `fetchTaken` reports a query error.

- [ ] **Step 1: Failing slug tests.** Extend `lib/slug.test.ts`:

```ts
describe("SLUG_MAX truncation (R2 §8.6)", () => {
  const long = "ძალიან".repeat(30); // romanizes to ~180 latin chars
  it("caps the base at 80", () => {
    const s = slugFrom(long, "article");
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
  it("keeps deduped candidates within the cap", () => {
    const base = slugFrom(long, "article");
    const taken = new Set([base]);
    const next = makeSlugFrom(long, "article", taken);
    expect(next.length).toBeLessThanOrEqual(80);
    expect(next).not.toBe(base);
  });
});
```
  Run — FAIL (today the base exceeds 80).

- [ ] **Step 2: Implement in `lib/slug.ts`.**

```ts
/** DB CHECKs cap slugs at 80 (news/events; delegate slugs share the habit). */
export const SLUG_MAX = 80;

export function slugFrom(text: string, fallback: string): string {
  const base = transliterateGeorgian(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  return base === "" ? fallback : base;
}

export function makeSlugFrom(text: string, fallback: string, taken: ReadonlySet<string>): string {
  const base = slugFrom(text, fallback);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
```
  (Doc comments on both updated to mention the cap.) Run the slug tests — PASS; full `npm test` — the existing slug/delegate tests must stay green (the cap changes nothing under 80 chars).

- [ ] **Step 3: Shared mint helper (the recorded 3rd-copy dedup), test-first.** `lib/publish-slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolvePublishSlug } from "./publish-slug";

describe("resolvePublishSlug", () => {
  it("reuses an existing slug without fetching", async () => {
    const slug = await resolvePublishSlug({
      title: "ახალი ამბები", fallback: "article", existingSlug: "akhali-ambebi",
      fetchTaken: async () => { throw new Error("must not fetch"); },
    });
    expect(slug).toBe("akhali-ambebi");
  });
  it("mints against the taken set", async () => {
    const slug = await resolvePublishSlug({
      title: "ახალი ამბები", fallback: "article", existingSlug: null,
      fetchTaken: async () => ["akhali-ambebi"],
    });
    expect(slug).toBe("akhali-ambebi-2");
  });
  it("null on a taken-set query failure", async () => {
    const slug = await resolvePublishSlug({
      title: "x", fallback: "article", existingSlug: null, fetchTaken: async () => null,
    });
    expect(slug).toBeNull();
  });
});
```
  Implement `lib/publish-slug.ts`:

```ts
import { makeSlugFrom, slugFrom } from "./slug";

/**
 * One home for the publish-time slug decision (news/events/delegates each kept a
 * copy of this block — R2 §8.7): an already-minted slug is permanent; otherwise
 * mint against the caller-fetched taken set. `fetchTaken(base)` receives the
 * base so callers can scope their LIKE query; null = the query errored.
 */
export async function resolvePublishSlug(opts: {
  title: string;
  fallback: string;
  existingSlug: string | null;
  fetchTaken: (base: string) => Promise<string[] | null>;
}): Promise<string | null> {
  if (opts.existingSlug) return opts.existingSlug;
  const base = slugFrom(opts.title, opts.fallback);
  const taken = await opts.fetchTaken(base);
  if (taken === null) return null;
  return makeSlugFrom(opts.title, opts.fallback, new Set(taken));
}
```
  Refactor the three call sites to use it, keeping each action's retry-on-23505 loop and RPC call in place. `publishNewsAction`'s loop body becomes:

```ts
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = await resolvePublishSlug({
      title: article.title,
      fallback: "article",
      existingSlug: article.slug,
      fetchTaken: async (base) => {
        const { data: taken, error: takenError } = await supabase
          .from("admin_news")
          .select("slug")
          .like("slug", `${base}%`);
        if (takenError) return null;
        return (taken ?? []).map((t) => t.slug).filter((s): s is string => !!s);
      },
    });
    if (slug === null) return { ok: false, error: GENERIC_FUNNEL_ERROR };
    const { data, error } = await supabase.rpc("admin_publish_news", {
      p_id: parsed.data.id,
      p_slug: slug,
    });
    if (!error) {
      revalidateNews((data as { slug: string }).slug);
      return { ok: true };
    }
    if (error.code !== "23505") return { ok: false, error: mapFunnelError(error.message) };
  }
  return { ok: false, error: mapFunnelError("invalid_slug") };
```
  `publishEventAction`: identical shape (`fallback: "event"`, table `admin_events`, RPC `admin_publish_event`, its own revalidate call). `approveDelegateAction`: `existingSlug: null` is wrong — it approves a QUEUE row which may carry a slug on re-approval; pass the queue row's `slug ?? null` if the action already selects it, else keep its current pre-fetch of the taken set but route the mint through `resolvePublishSlug({ title: fullName, fallback: "delegati", existingSlug: <queue slug or null>, fetchTaken: async () => <the already-fetched list> })`. Read the action before editing; behavior must not change (same slugs minted).

- [ ] **Step 4: PollForm stable keys, test-first.** Extend `PollForm.test.tsx`: type into option 1, remove option 1 (the ✕ button with `aria-label="წაშალე პასუხი"`), and assert option 2's typed value did not jump rows — concretely: render with `poll={null}` (2 empty options), type "პირველი" into `პასუხი 1`, "მეორე" into `პასუხი 2`, add a third, type "მესამე"; remove the SECOND; assert inputs now read `["პირველი", "მესამე"]` in order. With `key={i}` this test can pass too (values are controlled) — the REAL defect is focus/IME misattachment, hard to assert in jsdom; so ALSO assert the implementation detail honestly: after the refactor each option row input carries `data-key` and removal preserves the survivors' `data-key` values. Then refactor `PollForm.tsx`:
  - state: `const [options, setOptions] = useState<{ key: number; value: string }[]>(() => initial.map((value, k) => ({ key: k, value })));` plus `const nextKey = useRef(initial.length);`
  - add: `setOptions((prev) => [...prev, { key: nextKey.current++, value: "" }])`
  - remove: `setOptions((prev) => prev.filter((o) => o.key !== option.key))`
  - render: `options.map((option, i) => (<div key={option.key} data-key={option.key} …` — the label text still uses `i + 1`; `setOption` updates by key; the submit path maps `options.map((o) => o.value)` (RPC payload unchanged).

- [ ] **Step 5: Poll list revalidation.** `app/(admin)/admin/content/polls/actions.ts` — in `makeStatusAction`'s success branch, before `return { ok: true };`: `revalidatePath("/admin/content/polls");` (add the `next/cache` import). Parity with `deleteNewsAction`/`deleteEventAction`.

- [ ] **Step 6: Gates.** `npm test` (all new + existing green — the three publish actions have existing tests? verify; if none, tsc+lint is the gate and Task 9's suite covers publish e2e), `npm run typecheck && npm run lint && npm run build`. Georgian gate on PollForm + the three action files.

- [ ] **Step 7: Commit**

```powershell
git add lib/slug.ts lib/slug.test.ts lib/publish-slug.ts lib/publish-slug.test.ts "app/(admin)/admin/content/news/actions.ts" "app/(admin)/admin/content/events/actions.ts" "app/(admin)/admin/verify/actions.ts" "app/(admin)/admin/content/polls/PollForm.tsx" "app/(admin)/admin/content/polls/PollForm.test.tsx" "app/(admin)/admin/content/polls/actions.ts"
git commit -m "fix(content): 80-char slug cap + shared mint helper; PollForm stable keys; poll list revalidation"
```

---

### Task 8: Seed — referral codes on registered rows + paginated self-checks; reseed

**Files:**
- Modify: `scripts/seed-staging.mjs`

**Interfaces:**
- Consumes: the roster's per-delegate referral codes (already inserted into `delegates`); `delegateIdBySlug` map precedent.
- Produces: staging where ~half the registered-standing rows carry `signup_ref_code`, so referral prefill AND `registeredCount` are demonstrable in preview QA (recorded R1 gap).

- [ ] **Step 1: Capture codes.** Where the seed builds `delegateIdBySlug`, also build `referralCodeBySlug` (slug → referral_code) from the same roster/insert data.

- [ ] **Step 2: Write codes on a slice.** In the profiles-insert mapper (`scripts/seed-staging.mjs:352-373`), extend the registered branch:

```js
    ...(p.kind === "registered"
      ? p.i % 2 === 0 && p.supporterOf
        ? { signup_ref_code: referralCodeBySlug.get(p.supporterOf) }
        : {}
      : { …existing member fields… }),
```
  EXACT edit: keep the existing member-fields object literal untouched; only the registered arm changes from `{}` to the conditional above. Update the block comment at :392-403 (it documents "this seed does not write signup_ref_code" — now half do; keep the D1 rationale sentences).

- [ ] **Step 3: Paginate the self-check reads.** Replace the unpaginated `.select("id").eq("status","registered")` (silently truncates at PostgREST's 1000-row cap) with the audit-actor pagination idiom from :243-253 (`.range(off, off + 999)` loop, accumulate ids). Chunk the `.in("member_id", registeredIds)` count into slices of 200, summing `count` per chunk (URL-length safety; the whole-wave review flagged both).

- [ ] **Step 4: New self-check line.** After the D1 checks: count profiles with `signup_ref_code not null` and `status = 'registered'` (paged head-count query), `console.log` it, and `throw` if it is 0 — the QA-demonstrability guarantee this task exists for.

- [ ] **Step 5: Lint the script.** `node --check scripts/seed-staging.mjs` && `npx eslint scripts/seed-staging.mjs` && `npx prettier --check scripts/seed-staging.mjs`.

- [ ] **Step 6: RESEED staging.** `npm run seed:staging` (uses `--env-file=.env.local`). Expected tail: the roster counts (≈1902 users: active 1636 incl. 15 delegates / completed 134 / registered 132), `D1 check: 0/... (OK)`, `D1 sanity: ... (OK)`, and the NEW `signup_ref_code` count line (>0). Then re-run the probe: `node --env-file=.env.local scripts/verify-schema.mjs` — ALL green (the R2 section included).

- [ ] **Step 7: Commit**

```powershell
git add scripts/seed-staging.mjs
git commit -m "chore(seed): referral codes on half the registered roster; paginated self-checks; ref-code presence check"
```

---

### Task 9: e2e — delegacy journey, counters, buckets, CTA; rework the pending-panel legs

**Files:**
- Create: `e2e/delegacy.spec.ts`
- Modify: `e2e/delegate-panel.spec.ts` (pending leg moves to the member cabinet), `e2e/smoke.spec.ts` (header CTA + third counter), `e2e/public.spec.ts` (registered stat), `e2e/admin-rbac.spec.ts` OR the overview assertion's current home (conversion card visible to staff)

**Interfaces:**
- Consumes: helpers from Task 1 (`loginAs` both variants, `seedCompletedMember`, `serviceClient`, `phase4Phone/PersonalId`, `cleanupPhase4Users`, `getAuditRows`), testids `stat-registered-total` (Task 5), `delegacy-confirm` (Task 4), the verify queue's `verify-card-<id>` testids.
- Produces: the R2 acceptance evidence (spec §12).

- [ ] **Step 1: `e2e/delegacy.spec.ts`.** Serial spec, its own `k` slots (5 and 6 — verify no other spec uses them via grep `phase4Phone(5)|phase4Phone(6)` first; pick free ones if taken):

```ts
import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getAuditRows,
  loginAs as adminLoginAs,
  phase4PersonalId,
  phase4Phone,
  profileIdByPhone,
  serviceClient,
  signOutViaNav,
} from "./admin-helpers";
import { loginAs, seedCompletedMember } from "./funnel-helpers";

const REQUESTER = 5; // approved end-to-end
const REJECTEE = 6; // rejected, stays final

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupPhase4Users([REQUESTER, REJECTEE]);
  await seedCompletedMember({
    phone: phase4Phone(REQUESTER), firstName: "დელეგატობის", lastName: "მსურველი",
    personalId: phase4PersonalId(REQUESTER),
  });
  await seedCompletedMember({
    phone: phase4Phone(REJECTEE), firstName: "უარყოფილი", lastName: "კანდიდატი",
    personalId: phase4PersonalId(REJECTEE),
  });
});
test.afterAll(async () => {
  await cleanupPhase4Users([REQUESTER, REJECTEE]);
});

test("member requests delegacy -> pending card, member life intact", async ({ page }) => {
  await loginAs(page, phase4Phone(REQUESTER));
  // the profile card advertises the ladder
  await page.goto("/me/profile");
  await page.getByRole("link", { name: "გაიგე მეტი →" }).click();
  await expect(page).toHaveURL(/\/me\/delegacy/);
  await page.getByRole("button", { name: "მოთხოვნის გაგზავნა" }).click();
  await expect(page.getByText("მოთხოვნა გაგზავნილია")).toBeVisible();
  // member life untouched: member nav still carries polls + billing
  const nav = page.getByRole("navigation", { name: "კაბინეტის ნავიგაცია" });
  await expect(nav.getByRole("link", { name: "გამოკითხვები" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "გადახდები" })).toBeVisible();
  await signOutViaNav(page);
});

test("verifier approves -> delegate cabinet + public page live + membership closed", async ({ page }) => {
  const db = serviceClient();
  const requesterId = await profileIdByPhone(db, phase4Phone(REQUESTER));
  await adminLoginAs(page, ADMIN_PHONES.verifier);
  await page.goto("/admin/verify");
  const card = page.getByTestId(`verify-card-${requesterId}`);
  await expect(card).toBeVisible();
  // drive the approve control inside the card (mirror admin-approval.spec's locator)
  await card.getByRole("button", { name: "დამტკიცება" }).click();
  await expect(card).toHaveCount(0, { timeout: 15_000 });
  expect(await getAuditRows("delegate.approve", requesterId)).toBeGreaterThan(0);
  await signOutViaNav(page);

  // approval closed the requester's own membership (spec §3.1 rider)
  const { data: open } = await db
    .from("memberships").select("id").eq("member_id", requesterId).is("ended_at", null);
  expect(open ?? []).toHaveLength(0);

  // the new delegate lands in the delegate cabinet; public page live
  await loginAs(page, phase4Phone(REQUESTER));
  await expect(page).toHaveURL(/\/delegate(\/|\?|#|$)/);
  const { data: dRow } = await db.from("delegates").select("slug").eq("id", requesterId).single();
  const res = await page.goto(`/delegates/${dRow!.slug as string}`);
  expect(res!.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "დელეგატობის მსურველი" })).toBeVisible();
  await signOutViaNav(page);
});

test("rejection is a calm final state", async ({ page }) => {
  const db = serviceClient();
  const rejecteeId = await profileIdByPhone(db, phase4Phone(REJECTEE));
  await loginAs(page, phase4Phone(REJECTEE));
  await page.goto("/me/delegacy");
  await page.getByRole("button", { name: "მოთხოვნის გაგზავნა" }).click();
  await expect(page.getByText("მოთხოვნა გაგზავნილია")).toBeVisible();
  await signOutViaNav(page);

  await adminLoginAs(page, ADMIN_PHONES.verifier);
  await page.goto("/admin/verify");
  const card = page.getByTestId(`verify-card-${rejecteeId}`);
  await card.getByRole("button", { name: "უარყოფა" }).click();
  // rejection needs the note flow — mirror admin-approval.spec's reject steps exactly
  await expect(card).toHaveCount(0, { timeout: 15_000 });
  await signOutViaNav(page);

  await loginAs(page, phase4Phone(REJECTEE));
  await expect(page).toHaveURL(/\/me\/profile/); // NOT /delegate
  await page.goto("/me/delegacy");
  await expect(page.getByText("მოთხოვნა არ დამტკიცდა")).toBeVisible();
  await expect(page.getByRole("button", { name: "მოთხოვნის გაგზავნა" })).toHaveCount(0);
  await signOutViaNav(page);
});
```
  BEFORE running: read `e2e/admin-approval.spec.ts`'s approve/reject interactions and copy their EXACT locators (button names, note dialog) — the sketches above must be adjusted to the real controls. Cleanup: `cleanupPhase4Users` detaches memberships then deletes users; the delegates rows cascade with profiles.

- [ ] **Step 2: Rework `e2e/delegate-panel.spec.ts`'s pending leg.** The lifecycle test currently logs the seeded PENDING delegate in and expects the pending PANEL on `/delegate`. Under R2 routing they land on `/me/profile` with the pending card. Update: after `seedPendingDelegate` + `loginAs`, assert `page` URL is `/me/profile`, the pending card text „დელეგატობის მოთხოვნა გაგზავნილია“ is visible; then `approveOwnDelegate(...)`, reload/login, and continue the existing approved-panel + team assertions unchanged. Also update the admin-variant landing note if the spec asserts a specific URL.

- [ ] **Step 3: Counters.** `e2e/smoke.spec.ts` first test: add

```ts
  await expect(page.getByRole("banner").getByRole("link", { name: "დარეგისტრირდი" })).toBeVisible();
  await expect(page.getByTestId("stat-registered-total")).toBeVisible();
```
  `e2e/public.spec.ts`: in the stats test (it already reads the two stat testids directly — extend it): read `stat-registered-total`'s number and assert it equals the service-client `profiles` head-count, with the ISR settle loop (`expect(...).toPass()` idiom from community-polls.spec) around the goto+read. Registered ≥ active must also hold (`registered_total >= active`).

- [ ] **Step 4: Admin overview conversion.** In `e2e/admin-rbac.spec.ts`, locate the super-admin overview leg (it logs in as `ADMIN_PHONES.super` and lands on `/admin`); add visibility assertions for the „რეგისტრირებული“ and „კონვერსია“ StatCards there. If that spec has no overview-card assertions at all, add them right after its super-admin login step.

- [ ] **Step 5: Full suite.** Env-load + `npx playwright test`. Expected: ALL specs green, including the new `delegacy.spec.ts` (3 tests) and every reworked leg, under `workers: 1`. Investigate ANY red before proceeding — never merge around a red spec.

- [ ] **Step 6: Commit**

```powershell
git add e2e/delegacy.spec.ts e2e/delegate-panel.spec.ts e2e/smoke.spec.ts e2e/public.spec.ts e2e/admin-rbac.spec.ts
git commit -m "test(e2e): delegacy request/approve/reject journeys; registered counter; header CTA; reworked pending-panel legs"
```

---

### Task 10: Docs, ADR-019, full gate, push, PR

**Files:**
- Modify: `DECISIONS.md` (append ADR-019), `ARCHITECTURE.md` (§"Registration funnel (Phase 2)" refresh)

- [ ] **Step 1: ADR-019.** Append to `DECISIONS.md` (append-only — never edit earlier entries):

```markdown
## ADR-019 (2026-07-22): R2 — delegacy on approval, cumulative counters, rider absorption

Release 2 of progressive registration (spec 2026-07-22, v0.8.0). Decisions:

- **Delegacy is a role only once approved.** Routing/nav gate on approved status;
  pending/rejected requesters live in the member cabinet. A DB trigger makes a
  delegates row without a completed member profile unrepresentable, retiring the
  R1 latent redirect loop structurally. request_delegacy() is the only creation
  path (definer, member-gated, rejected-is-final per D7).
- **Approval closes the new delegate's own membership.** Delegates back no one
  (Phase 3 canon); the membership survives the pending wait so rejection leaves
  member life untouched. Rider inside admin_approve_delegate, same audit row.
- **The public "registered" number is cumulative** (count of all profiles) —
  breadth that never shrinks on upgrade; the disjoint split (registered / member /
  active — exactly the member_status enum) is admin-only, summing to the total.
- **Phase 5 hardening queue absorbed** (R2 was "the next hardening migration"):
  conditional-DML cancel guard, btrim body CHECKs + RPC guards, invalid_visibility
  token, supabase.co+filename-shape image pin (events have no image RPC — the
  recorded "both RPCs" premise was wrong), member_rsvp FOR SHARE, 80-char slug cap
  in lib/slug (the "SQL" premise was wrong — minting is app-side), one shared
  resolvePublishSlug helper, PollForm stable keys, poll-list revalidation,
  .order("id") on the two verification-side paged sums.
- **delegate_panel's draftCount → registeredCount** (churn-control keep from R1,
  now closed); pending_delegate_id FK → on delete set null; register() maps the
  duplicate-ID race to the same field-specific token as the pre-check
  (constraint-name dispatch); /login surfaces lookup failures instead of bouncing
  members to /join; header CTA is „დარეგისტრირდი“ („გახდი წევრი“ now means only
  the in-cabinet membership journey).
```

- [ ] **Step 2: ARCHITECTURE.md refresh.** Replace the stale "## Registration funnel (Phase 2)" section (it still describes the retired 3-step funnel + funnel_* RPCs) with the current shape: one-door /join → `register()`; cabinet_state() + standing-aware cabinet; become-a-member wizard (`become_member_save_profile`/`become_member_complete`); delegacy request (`request_delegacy()`, approved-gated routing); reference ADR-018/ADR-019. Keep it about the current section's length (~15 lines); factual register, no marketing.

- [ ] **Step 3: Ledger + full local gate.** Update `.superpowers/sdd/progress.md` (all tasks recorded). Run the complete gate: `npm run typecheck && npm run lint && npm test && npm run build && npm run format:check` (CLAUDE.md CRLF is the only tolerated format failure) + the Georgian gate over every changed file + `git diff main --name-only` sanity (only intended files). Full e2e suite one final time.

- [ ] **Step 4: Push + PR.** `git push -u origin claude/progressive-registration-r2-b1608b`; open the PR with `gh pr create` — title `Phase 6 R2: the ladder and the numbers (v0.8.0)`, body: plain-language summary per spec section, the staging-cutover note, test evidence (unit count, probe line, e2e count), PR-body footer per house rules. CI must go green (quality + CodeRabbit + Vercel preview).

- [ ] **Step 5: STOP.** Whole-branch review, preview QA (/qa), the owner sign-off package (plain language + screenshots + preview URL), version bump v0.8.0 + CHANGELOG at merge — all follow the house ritual OUTSIDE this plan, each behind the owner checkpoint.

- [ ] **Step 6: Commit (docs)**

```powershell
git add DECISIONS.md ARCHITECTURE.md
git commit -m "docs: ADR-019 (R2 decisions); ARCHITECTURE registration section refreshed to progressive model"
```

---

## Execution notes

- **Task order is dependency order:** 1 (pure test infra) → 2 (schema; opens cutover window) → 3 (lib contract; heals the panel key) → 4 (delegacy UI) → 5, 6, 7 (independent of each other; any order) → 8 (seed; wants final schema) → 9 (needs everything + Task 1's helpers) → 10.
- **Reviewers per task** get: the task text, the spec section it implements, and the diff. The verbatim pre-change baselines for every SQL body live in the R1/Phase-4/Phase-5 migration files listed in each `create or replace` comment — diff against them; only the annotated deltas may differ.
- **If staging drifts mid-branch** (someone QAs on preview), the seed is idempotent — reseed (Task 8's command) and re-run the probe before e2e.
