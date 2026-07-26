# Security audit — coverage table

**The whole matrix: 152 surfaces × 12 actor positions =
1,824 graded cells — 1,690 clear, 0 findings,
134 needs-live-proof.** Three passes, each appended below:
Pass 2a (read surfaces and the depth layer, Task 6), Pass 2b (the 54 database
functions, Task 7), Pass 2c (server actions, the dev-OTP endpoint, storage
buckets — Task 8). Every cell now carries a real verdict; none is unprobed.

> **This document is GENERATED — `node scripts/security/coverage.mjs`
> (`npm run security:coverage`).** Editing it by hand is pointless; the next run
> overwrites it. Every count, glyph, allow-set and assertion tally is derived
> from `docs/security/ledger.json`, `row-scope.json`, `row-scope-app.json` and
> `residue.json` at generation time; the prose is template text in the
> generator, because it is argument rather than measurement. An earlier revision
> of this document was written by a script that lived in a scratchpad and was
> never committed — it quoted 574 clear / 74 unresolved, survived a `judge()`
> change that moved both, and so contradicted the ledger it described. **Re-run
> the generator after anything that could move a number** rather than adjusting
> the ones you can see.

Ledger: `docs/security/ledger.json` · raw outcomes: `ledger-raw.json` ·
assertions: `row-scope.json` (Passes 2a/2b) and `row-scope-app.json` (Pass 2c) ·
expectations and their derivation: the `overrides` and `note` fields of
`scripts/security/manifest.json` · threats: `threat-model.md`.

---

# Pass 2a (Task 6) — read surfaces and the depth layer

57 surfaces × 12 actor positions = **684 graded cells**, every one of
them against a stated expectation read from the migration that creates the
surface and confirmed against the live catalog. No cell in this section is
rule-derived.

## 1. How to read this

**The glyphs.** `C` = clear · `F` = finding · `?` = needs-live-proof.

**What `clear` claims, and what it does not.** A verdict here answers one
question: _was this actor's statement permitted, or refused?_ `allow` means
the actor may run the statement; `deny` means it must be refused outright
(`42501`, or a refusal token). That is the right question for a census —
it is the first one an attacker with the anon key asks — but it is a claim
about the **grant layer**, not about what came back.

The second question — _and did the row rule then return only what it should?_
— cannot be expressed as a verdict at all. `judge()`
(`lib/security/verdict.ts`) does not consult the row count on the allow side,
and on the deny side a zero-row read resolves to `needs-live-proof` by design,
because an empty result proves nothing on its own. So a row policy that
silently stopped filtering would still be graded `clear`.

That gap is closed by **named row-scope assertions** (§3): 658 of them, each
stating an expected row set per actor and checking it live, all holding. **A surface is only as clear as both records
together**, so "no breach" is a claim about the grid _and_ the assertions, never
the grid alone. Where a note below says "zero rows every time", that is an
assertion result, not an inference.

**Why a permitted statement is not automatically a hole.** Nine of the sixteen
tables and eleven of the twenty-four views are readable at the grant layer by
`anon` and `authenticated` — Supabase's default privileges, already recorded
in `threat-model.md` §5 and re-confirmed live for this pass. On those
surfaces the row-level rule is the whole defence, so `allow` + zero rows is
the correct and expected result: one layer abstains, the next holds. It is
recorded honestly rather than dressed up as a refusal.

**Policies and triggers have no doors of their own.** A row-level policy is a
predicate Postgres splices into a statement; a trigger is code that runs
inside a write. Both are reached only through the table they guard, so each
was probed with a real statement against a real row — for the policies, the
row the clause exists to withhold; for the triggers, the write they exist to
reject. Where the layer in _front_ of a trigger refused first, the note says
so by name: knowing which defence is actually holding is the point.

## 2. The table

| Surface | Kind | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 | A10 | A11 | A12 | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `admin_admins` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_admin_role`. The admin roster (R3's coercion-target list) is visible only to A9; A10/A11/A12 get zero. |
| `admin_audit` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_admin_role`. Audit trail visible only to A9; all other admins get zero rows. |
| `admin_delegate_queue` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_any_admin_role`. Rows only for A9/A10 (verifier family); finance and editor get zero. |
| `admin_events` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 on the view. Rows only for A9/A12. |
| `admin_finance_stats` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_any_admin_role`. Rows only for A9/A11. |
| `admin_members` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_any_admin_role`. The full member roster is visible only to A9/A10/A11; A12 (editor) gets zero rows. |
| `admin_news` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 on the view itself (`revoke all` then grant to authenticated). Rows only for A9/A12. |
| `admin_overview` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 — not by the view grant but by `revoke execute … has_any_admin_role from anon`. A2–A12 may run it; rows only for A9/A10/A11. |
| `admin_payments` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_any_admin_role`. Rows only for A9/A11; verifier (A10) and editor (A12) get zero. |
| `admin_poll_options` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 on the view. Rows only for A9/A12. |
| `admin_polls` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 on the view. Rows only for A9/A12. |
| `admin_region_stats` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_any_admin_role`. Rows only for A9/A10/A11; A2–A8/A12 permitted-and-empty. |
| `admin_settings` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_admin_role`. Settings visible only to A9. |
| `member_event_going_counts` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. Gate is `is_registered()`, NOT `is_completed_member()` (re-created 20260721120000:606) — so A3 legitimately sees counts and only A2 (no profile row) gets zero. |
| `member_news` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 on the view. `is_completed_member()` gates the rows: A2 (no profile) and A3 (registered only) get zero. |
| `member_poll_options` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. `is_completed_member()` gate holds: zero for A2/A3. |
| `member_polls` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. `is_completed_member()` gate holds: zero for A2/A3. |
| `poll_option_counts` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. Counts require a completed member AND (poll closed OR caller already voted): zero for A2/A3. |
| `public_delegates` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated by design. All twelve read the approved-delegate directory — the intended public surface; `delegates` itself stays sealed. |
| `public_events` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated. Published/cancelled events only. |
| `public_news` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated. Filtered to published+public news; rows to all twelve. |
| `public_stats` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated by design. Aggregate counts only; 1 row to all twelve. |
| `transparency_regions` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated by design. Per-region aggregates; rows to all twelve. |
| `transparency_stats` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated by design (transparency figures). 1 aggregate row to all twelve. |
| `admin_roles` | table | C | C | C | C | C | C | C | C | C | C | C | C | Every authenticated caller may run the select; the row policy scopes it. A9–A12 see exactly their own role row, A2–A8 and A1 see nothing — proven by name, not inferred (`admin_roles.cross-actor`). |
| `app_settings` | table | C | C | C | C | C | C | C | C | C | C | C | C | Statement permitted (default-privilege SELECT survives on this instance); RLS has no policy, so all twelve get zero rows. The grant layer abstains, RLS holds. |
| `audit_log` | table | C | C | C | C | C | C | C | C | C | C | C | C | Statement permitted; RLS has no policy, so all twelve — including A9 — get zero rows through the table. A9's route is the `admin_audit` view. |
| `cities` | table | C | C | C | C | C | C | C | C | C | C | C | C | Deliberately world-readable reference data — intended, not a leak. |
| `delegates` | table | C | C | C | C | C | C | C | C | C | C | C | C | SELECT revoked from anon+authenticated (public reads go through `public_delegates`). 42501 for all twelve — `referral_code` and the verification trail never reach a client. |
| `dev_otp_inbox` | table | C | C | C | C | C | C | C | C | C | C | C | C | Statement permitted; RLS has no policy, so all twelve get zero rows. Live sign-in codes stay unreadable to every client role. |
| `event_rsvps` | table | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. A2–A12 may read exactly three columns, scoped by RLS to their own RSVPs. |
| `events` | table | C | C | C | C | C | C | C | C | C | C | C | C | `revoke all` with no re-grant. 42501 for all twelve. |
| `memberships` | table | C | C | C | C | C | C | C | C | C | C | C | C | Table-wide SELECT to authenticated; RLS returns own rows only. A4–A12 see 1 membership each; A1–A3 none. |
| `news` | table | C | C | C | C | C | C | C | C | C | C | C | C | `revoke all` with no re-grant. 42501 for all twelve; reads go through the public/member/admin views. |
| `payments` | table | C | C | C | C | C | C | C | C | C | C | C | C | Probed with the 10 granted columns. Own rows only: A5–A8 see their own payment, everyone else none. |
| `poll_options` | table | C | C | C | C | C | C | C | C | C | C | C | C | `revoke all` with no re-grant. 42501 for all twelve. |
| `poll_votes` | table | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. A2–A12 may read three columns, scoped to their own vote — ballot secrecy against a populated table. |
| `polls` | table | C | C | C | C | C | C | C | C | C | C | C | C | `revoke all` with no re-grant. 42501 for all twelve. |
| `profiles` | table | C | C | C | C | C | C | C | C | C | C | C | C | Probed with the 14 granted columns, not `*`. Every actor may run it; RLS returns exactly their own row (A1/A2 zero). personal_id/birth_date refused 42501 for A2–A12 — see the personal-id-lockdown assertion. |
| `regions` | table | C | C | C | C | C | C | C | C | C | C | C | C | Deliberately world-readable reference data (`using (true)`) — intended, not a leak. |
| `cities readable by all` | policy | C | C | C | C | C | C | C | C | C | C | C | C | Probed positively: 37 cities to all twelve. |
| `own admin roles readable` | policy | C | C | C | C | C | C | C | C | C | C | C | C | Each actor asked for A9's admin row by id (A9 asked for A10's). Statement permitted for all twelve, zero rows every time — no actor can read another's admin role. |
| `own memberships readable` | policy | C | C | C | C | C | C | C | C | C | C | C | C | Each actor asked for A5's membership by id (A5 for A4's). Permitted, zero rows every time. |
| `own payments readable` | policy | C | C | C | C | C | C | C | C | C | C | C | C | Each actor asked for A5's payments by id (A5 for A6's) — both are real, paid rows. Permitted, zero rows every time. |
| `own profile readable` | policy | C | C | C | C | C | C | C | C | C | C | C | C | Each actor asked for A5's profile by id (A5 for A4's). Permitted, zero rows every time. |
| `own profile updatable` | policy | C | C | C | C | C | C | C | C | C | C | C | C | The only write policy in the schema. Each actor tried to UPDATE another actor's profile (content-neutral payload, `returning id`). Permitted for all twelve, **zero rows affected** every time. |
| `own rsvps readable` | policy | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. A2–A12 asked for A5's RSVP by id (A5 for A7's) against a populated table: permitted, zero rows every time. |
| `own votes readable` | policy | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. A2–A12 asked for A5's vote by id (A5 for A7's): permitted, zero rows every time — the ballot-secrecy probe. |
| `regions readable by all` | policy | C | C | C | C | C | C | C | C | C | C | C | C | Probed positively (the policy works when rows DO come back): 11 regions to all twelve. |
| `audit_log_no_update` | trigger | C | C | C | C | C | C | C | C | C | C | C | C | UPDATE audit_log is permitted at the grant layer for all twelve and affects zero rows (RLS has no policy), so the append-only trigger never fires for a client. Proven separately to fire when reached: service-role UPDATE raises `audit_log is append-only`. |
| `delegates_require_completed` | trigger | C | C | C | C | C | C | C | C | C | C | C | C | INSERT into delegates refused 42501 for all twelve (delegates has no RLS INSERT policy), with a completed-member target so the trigger itself would have passed. Proven separately to fire: service-role insert for a non-completed target raises `delegate_requires_completed_member`. |
| `event_rsvps_updated_at` | trigger | C | C | C | C | C | C | C | C | C | C | C | C | UPDATE refused 42501 for all twelve — event_rsvps carries SELECT-only column grants. Housekeeping trigger, unreachable from any client role. |
| `events_updated_at` | trigger | C | C | C | C | C | C | C | C | C | C | C | C | UPDATE refused 42501 for all twelve (`revoke all`, no re-grant). Housekeeping trigger, unreachable from any client role. |
| `news_updated_at` | trigger | C | C | C | C | C | C | C | C | C | C | C | C | UPDATE refused 42501 for all twelve. Housekeeping trigger, unreachable from any client role. |
| `polls_updated_at` | trigger | C | C | C | C | C | C | C | C | C | C | C | C | UPDATE refused 42501 for all twelve. Housekeeping trigger, unreachable from any client role. |
| `profiles_protect_columns` | trigger | C | C | C | C | C | C | C | C | C | C | C | C | Setting `status` is refused 42501 for A2–A12 at the COLUMN-privilege layer (only 5 cabinet columns are UPDATE-granted), so the trigger is never reached; A1's statement is permitted but RLS matches no row. Proven separately to fire when reached — see §4. |
| `profiles_updated_at` | trigger | C | C | C | C | C | C | C | C | C | C | C | C | The one client-reachable trigger. Cross-actor UPDATE permitted for all twelve and affects zero rows; on the owner path it fires and advances `updated_at`. |

**Totals for this section: 684 clear, 0 findings,
0 needs-live-proof, 0 rule-derived.**

## 3. Row-scope assertions

658 assertions, **all holding**. Full results in
`docs/security/row-scope.json`; they re-run with every
`npm run security:census`.

Every assertion that accepts an error as a pass is pinned to SQLSTATE `42501`.
Grading on "any error" would let a renamed column or a throttled connection
pass silently as a defence — the same shape, and the same direction, as the
`select *` probe defect this pass had to fix.

### 3.1 Ownership — can any actor read a row that is not their own?

Each own-row table read **unfiltered** by each of the twelve, checking every
returned row's owner column. 72 assertions, all holding: `admin_roles`,
`profiles`, `memberships`, `payments`, `event_rsvps` and `poll_votes` each
return the caller's own rows and **zero foreign rows**, for all twelve.

The `admin_roles` line is the check the brief singles out: because every
authenticated caller may run that select, a broken policy would have been
graded `clear` by the grid. It is not broken, and this is how that is known.

### 3.1a The three tables held by RLS alone — do they return nothing?

`audit_log`, `dev_otp_inbox` and `app_settings` are the same blind spot as
`admin_roles`, without an owner column to check: each has RLS enabled, **zero
policies**, and full default privileges for both client roles, so the whole
security content is "no client sees any row" — and that is precisely what the
grid does not consult. Add one permissive policy to `dev_otp_inbox` and the
census re-runs entirely green while live sign-in codes leave the database.
36 assertions, each read unfiltered by each of the twelve: **0 rows for all
twelve** on all three, A9 included. (R8, R2, R10.)

`delegates` is deliberately absent: its SELECT grant *is* revoked, so the grid
already carries a real `42501` for all twelve and there is no blind spot.

### 3.2 The personal-ID lockdown

`select id, personal_id, birth_date from profiles`, all twelve
(12 assertions).
A2–A12: **refused `42501`** — those two columns are outside the
`authenticated` grant. A1: statement permitted (anon holds table-level SELECT
on all 17 columns) but **zero rows**. No actor obtained a personal ID or birth
date. (Threat R1/R12.)

### 3.3 Self-gating view visibility

Each of the 18 self-gating views read by each of the twelve, asserting whether
rows should come back at all — 216 assertions, derived from the **live** view
definitions (`pg_get_viewdef`), not the migrations that first created them.

- The four admin role families hold exactly: super_admin-only
  (`admin_admins`, `admin_audit`, `admin_settings`), +verifier
  (`admin_delegate_queue`), +finance (`admin_payments`,
  `admin_finance_stats`), +verifier+finance (`admin_overview`,
  `admin_region_stats`, `admin_members`), +editor (`admin_news`,
  `admin_events`, `admin_polls`, `admin_poll_options`). No admin saw a view
  outside their family. (Threat R11.)
- The member gate holds: `member_news`, `member_polls`,
  `member_poll_options`, `poll_option_counts` return nothing to A2 (no
  profile) or A3 (registered, not completed).
- `member_event_going_counts` is gated on **`is_registered()`**, not
  `is_completed_member()` — the view was re-created in
  `20260721120000_progressive_registration.sql:606`. A3 seeing rows there is
  correct. Grading it against the older community-migration text would have
  produced a false finding; this is why the assertions read live definitions.

### 3.3a The six world-readable views — what actually comes back?

`public_news`, `public_events`, `public_delegates`, `public_stats`,
`transparency_stats` and `transparency_regions` are granted to `anon` by
design and return rows to all twelve, so their **column list** and their
**WHERE clause** are the entire defence — and a verdict expresses neither.
`public_delegates` is the sharpest case: it exists so that `delegates`
(referral codes, the whole verification trail) can stay revoked from every
client role, and only the columns it happens to select keep that promise.

**Columns (72 assertions).** No row returned by any of the six, to any of the
twelve, carries `personal_id`, `birth_date`, `phone`, `referral_code`,
`tc_accepted_at`, `verified_at`, `verified_by`, `review_note`,
`pending_delegate_id` or `signup_ref_code`. Clean everywhere.

**Filters (6 assertions).** Each view's row count as `anon` against a
service-role `COUNT` of the rows that should pass — counts only, no row
content read on either side:

| view | result |
| --- | --- |
| `public_news` | 100 shown, 100 should be, 290 withheld of 390 |
| `public_events` | 214 shown, 214 should be, 176 withheld of 390 |
| `public_delegates` | 13 shown, 13 should be, 6 withheld of 19 |
| `public_stats` | active=1640, approved_delegates=13, registered_total=1927 |
| `transparency_stats` | registered_members=1794, approved_delegates=13 |
| `transparency_regions` | 11 row(s); 133 profile(s) at status 'registered' available as a negative case |

The ground truth for the three aggregate views is read from the **live** view
definitions, not the migrations, and they differ: the community migration
counts `status <> 'draft'`, but `draft` is no longer a `member_status` label
at all (live enum: `registered`, `profile_completed`, `active_member`) and the
R2 migration re-created all three. This is the second time in this pass that
grading against migration text would have manufactured a false finding.

### 3.4 Escalation writes

The three writes that would end the audit, attempted by all twelve against an
audit-owned target. 36 assertions.

| Attempt | Result |
| --- | --- |
| `insert into admin_roles {role: 'super_admin'}` | **`42501` for all twelve** — no RLS INSERT policy exists. (R9, R3) |
| `insert into payments` (self-activation to member) | **`42501` for all twelve.** (R14, R15) |
| `insert into memberships` | **`42501` for all twelve.** (R7, R15) |

Each is permitted at the grant layer on this instance; RLS is what refuses.
That is the §5 observation of the threat model, now re-established live rather
than read.

### 3.5 Do the defences actually fire?

A trigger that never runs is indistinguishable from one that is absent.
4 control checks, each isolating the trigger from the layer in front of it.

| Trigger | How it was reached | Result |
| --- | --- | --- |
| `audit_log_immutable` | Service role UPDATE, payload = the row's existing value | **Raises `audit_log is append-only`.** (R8) |
| `enforce_delegate_completed` | Service role INSERT for a non-completed target; self-cleaning if it succeeded | **Raises `delegate_requires_completed_member`.** (R18) |
| `set_updated_at` (`profiles`) | The audit's team-member fixture updating its own `employment` | **Fires — `updated_at` advanced.** |
| `protect_profile_columns` | See §4 — a one-off `SET LOCAL ROLE anon` inside a rolled-back transaction | **Raises `server-managed profile columns cannot be changed by client roles`.** (R1, R6) |

The service role is used here deliberately and only here. It is never a probe
actor: the question these four ask is "does this defence work", not "who can
reach it", and the answer to the second question is already in the table above.

### 3.6 The `public_events` filter — now a result

**Resolved.** An earlier revision recorded this assertion as *unproven*: the view
showed 6 events and 6 was exactly the number that should pass
`status in ('published', 'cancelled')`, because every event in the database was
published or cancelled. With no negative case in the data, a count match is also
precisely what a *missing* filter would produce, so the assertion distinguished
nothing.

The census itself supplied the negative case. Pass 2b and Pass 2c mint **draft**
events as probe targets, so the table now contains rows the filter must exclude,
and the live result is `214 shown, 214 should be, 176 withheld of 390`. Every filter
assertion in §3.3a now has a negative case and none is recorded as unproven.

## 4. Observations that are not findings

**Nothing in Pass 2a's 684 cells is a breach — and that sentence carries a
qualifier that must travel with it.** These cells measure whether each
actor's statement was permitted or refused. What came back is a separate
record: the 658 assertions in §3. "No breach" is the conjunction of the two,
not a property of the grid alone.

Four things are worth the owner's attention anyway. All four sharpen
`threat-model.md` §5.

**4.1 `protect_profile_columns` currently never runs.** It is the rule making
**ten** columns server-managed — `status`, `personal_id`, `phone`, `id`,
`created_at`, `signup_ref_code`, `membership_tier`, `reference_code`,
`registration_completed_at` and `pending_delegate_id` (read from the live
`prosrc`; the migration text names five, the body has grown since).
For `authenticated` the column grant refuses first — none of the ten is among
the five UPDATE-granted cabinet columns — and for `anon` the row policy
matches nothing, so across all twelve actors the trigger is never reached. It
does work when reached, proven with this exact statement (run once, by hand,
rolled back — it needs a direct database connection, which the census runner
deliberately does not have):

```sql
do $$ declare v_uid uuid; v_msg text; v_state text; v_rows int;
begin
  select id into v_uid from public.profiles where phone = '+995509001009';
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'anon')::text, true);
  set local role anon;
  begin
    update public.profiles set status = 'active_member' where id = v_uid;
    get diagnostics v_rows = ROW_COUNT; v_state := 'NONE';
    v_msg := 'NO ERROR, rows=' || v_rows;
  exception when others then
    get stacked diagnostics v_msg = MESSAGE_TEXT, v_state = RETURNED_SQLSTATE;
  end;
  reset role;
  raise exception 'PROBE RESULT sqlstate=% message=%', v_state, v_msg;
end $$;
```

Result: `P0001 server-managed profile columns cannot be changed by client
roles`. The closing `raise` aborts the transaction, so nothing was committed.
This closes the `protect_profile_columns` half of threat-model §5.4 candidate
3 — the trigger is functional, not merely present.

**4.2 The personal-ID lockdown was never applied to `anon` at all — and
`birth_date` has one layer where `personal_id` has two.** The Phase-3 lockdown
(`20260717150000_admin_crm.sql:929`) revokes and re-grants for `authenticated`
only. `anon` therefore still holds **table-level `SELECT`, `INSERT`,
`UPDATE`, `DELETE` and `TRUNCATE` on `profiles` — all seventeen columns**, not
two. Consequences, stated exactly:

- Reads are inert: the `own profile readable` policy needs `auth.uid() = id`,
  and `auth.uid()` is null for an anonymous caller. Verified for all twelve in
  §3.2 — nothing came back.
- Writes are where the asymmetry bites. Against an anonymous write,
  **`personal_id` has two layers** — the RLS predicate, and then
  `protect_profile_columns`, which lists it. **`birth_date` has one**: it is
  not in the trigger's ten-column list, so the row policy is the only thing
  standing. Nothing left the database and nothing was changed; reaching a
  non-null `auth.uid()` as `anon` needs the JWT signing secret, which is
  outside this model (threat-model §6).

This stays an observation rather than a finding for that reason — but it is
**a defect in a hardening migration, not an accepted platform default**: the
revoke named one role where the intent plainly covered both. Fix-wave item
(Task 12), and the fix should re-check the trigger's column list against the
columns the grant leaves reachable.

**4.3 Four tables the migrations describe as having "no client grants" do
have them.** `admin_roles`, `audit_log` and `dev_otp_inbox` carry the comment
"no client grants (server-side only)"; live, `anon` and `authenticated` hold
the full default privilege set on each, and `app_settings` has the same shape.
All four return zero rows to all twelve actors (§3.1, §3.1a), so the stated
intent is achieved — by RLS, not by the grant the comment describes.

**4.3a Nine of the thirteen admin views still carry `anon` SELECT.**
`admin_overview`, `admin_region_stats`, `admin_members`,
`admin_delegate_queue`, `admin_payments`, `admin_finance_stats`,
`admin_admins`, `admin_audit` and `admin_settings` — every admin view created
before the community migration — are readable by `anon` at the grant layer.
The only thing refusing A1 is `revoke execute on function has_admin_role /
has_any_admin_role from public, anon`: the view runs the gate function as the
caller, so anon dies on the function, not on the view. Verified for all nine
(§3.3, and the per-row notes in §2 — the live error is `42501 permission
denied for function has_any_admin_role`, never "for view").

This is the same incomplete-revoke shape as 4.2, and the **four admin views
that *were* revoked** — `admin_news`, `admin_events`, `admin_polls`,
`admin_poll_options`, all created in the community migration with
`revoke all … from anon, authenticated` — are the evidence that the revoke was
meant to apply to all thirteen. A future admin view that does not call a gate
function, or a re-grant of EXECUTE to `anon`, would open the nine at once.
Fix-wave item.

**4.4 The curated expectations are now protected from
`security:introspect --write`** (was an open Pass 3 item). That command
regenerates `scripts/security/manifest.json` from the live catalog and would
have silently discarded every `overrides` block and its derivation. It now
refuses when the existing manifest carries curated census data and makes the
operator say so explicitly (`scripts/security/introspect.mjs`). The manifest
today carries **152 surfaces with curated expectations,
1824 per-actor cells** — the whole census.

## 5. Escalated to Pass 3

- **TRUNCATE granted to `anon`** (threat-model §5.4 candidate 2) — still not
  reproduced. PostgREST has no verb that maps to `TRUNCATE`, so there is no
  route from the anon key, but that is a structural reading and this pass did
  not turn it into a live result. It stays open, deliberately unclosed.
- **The four trigger functions EXECUTE-granted to `PUBLIC`** (§5.4 candidate
  3) — **SETTLED BY PASS 2b, see §10: the candidate finding is disproved.**
  The backstop is not the gateway; PostgreSQL's own call handler refuses a
  `returns trigger` function in any non-trigger context, for any role, grant or
  no grant. The remediation is nevertheless a three-role revoke — see §10.
- **Making the grant layer match the stated intent** (4.2, 4.3, 4.3a) — a
  fix-wave item for Task 12, not an edit any census pass may make. Three
  separate incomplete revokes with the same shape: `profiles` (named
  `authenticated`, not `anon`), the four "server-side only" tables (no revoke
  at all), and the nine pre-community admin views (revoked only in the four
  created later).

## 6. Fixtures created by this pass

Both through the app's own RPCs, on accounts already tagged
`security-audit-2026-07`, swept by the end-of-phase reseed with the accounts
that own them:

- **A5 and A7 each RSVP'd `going`** to the next published event, via
  `member_rsvp()`. Without this, "A3 sees none of A5's RSVPs" was not evidence.
- **A5 and A7 each cast one vote** in an open poll, via `member_cast_vote()`.
  Same reason, for ballot secrecy.

Nothing else was written. Every other depth probe either was refused or used
a payload equal to the target row's existing value, so no content changed
anywhere in the database as a result of this pass.

---

# Pass 2b (Task 7) — the 54 database functions

**54 surfaces × 12 actor positions = 648 graded cells.** 48 `security definer`
gatekeepers plus the 6 security-invoker functions, every expectation read from
the **live** catalog — `pg_get_function_identity_arguments` for the signature,
`prosrc` for the gate, `proacl` for the grant — never from the first migration
that mentions a function. No cell in this section is rule-derived
(0 of 648); all 648 carry a stated `overrides` entry and a `note` in
`scripts/security/manifest.json`.

**Result: 586 clear, 0 findings, 62 needs-live-proof.** Repeated full runs produce
**identical verdicts in every cell** — the point of the isolation scheme in §7,
since a finding that cannot be reproduced is not a finding.

The 38 "findings" an earlier ledger carried on this kind were every one of
them a fail-closed placeholder: `defaultExpectation()` returns `deny` for any
function it cannot classify by name, so `cabinet_state`, `is_registered`,
`is_completed_member`, `delegate_panel`, `delegate_team` and
`delegate_team_rsvps` succeeding for the actors they are *supposed* to serve
was recorded as a breach. None survived contact with a stated expectation.

## 7. What made this pass different: arguments and isolation

**Arguments.** Task 4 called every function with `{}`, and 504 of these 648
cells came back `PGRST202`. That is not a security result — `judge()`
deliberately refuses to let a not-found code clear a deny expectation, because
a malformed probe would otherwise launder itself into a false all-clear on
exactly the surfaces the audit exists to check. The fix is
`scripts/security/arguments.mjs`: one valid argument object per function, built
for a caller who *should* succeed, then used unchanged by all twelve actors, so
the only variable across a row of the grid is who is calling. All 504 resolved;
no cell now rests on an argument mismatch.

**Isolation.** These functions really do things — approve a delegate, record a
payment, close a poll, delete news — and the actors who are supposed to succeed
do succeed, so every probe changes the state the next one runs against.
Transaction rollback is not available (each RPC is its own transaction over
PostgREST and the client cannot wrap it), so freshness is the mechanism:

- **Twelve disposable victim members, one bound to each actor slot.** A9's
  probes only ever touch victim 9, A10's only victim 10. The twelve actors are
  probed in parallel and never contend for a row.
- **`setup()` re-mints the exact row the call will act on, immediately before
  each individual (function, actor) probe** — a pending delegate, a draft poll,
  an unvoided payment. All twelve therefore attack an identical *fresh* target
  and the twelfth result is comparable to the first.
- **`teardown()` runs immediately after**, and only ever removes rows this task
  minted seconds earlier. It never touches `audit_log`, which is append-only.
- Where the **caller is the target** and no fresh caller can be minted, the
  probe is made *content-neutral* instead: `member_change_tier` passes the tier
  the caller already holds; `member_change_delegate` passes the delegate they
  already have, which takes the body's own documented "same target: no-op, no
  history row minted" branch.

### 7.1 What the probes nevertheless changed — stated plainly

"Content-neutral" is a claim about *content*, not about *rows being untouched*,
and the difference matters enough to write down:

- **A9–A12's `profiles` rows were written by this census.**
  `member_change_tier` runs `update profiles set membership_tier = p_tier`
  unconditionally — the value is unchanged, but the UPDATE still executes and
  `set_updated_at` still fires, so all four canonical staging admins carry an
  `updated_at` inside the run window. Verified live. This is disclosed because
  the same accounts were the reason for abstaining from `request_delegacy`
  (§13c): a stricter standard was applied there than here, and a reader is
  entitled to see both.
- **The seeded roster was not touched.** Verified live: of the 1,904 `profiles`
  rows that are neither audit-tagged nor one of the four canonical admins,
  **zero** have an `updated_at` after the census began. `admin_update_setting`
  runs `recompute_all_active()` across the whole table, which is exactly why
  the probe writes `active_grace_days` back to the value it already holds — the
  recompute then finds nothing to change.
- **Three probes genuinely mutate their own caller and are read-then-restore:**
  `register` × A2 (creates A2's profile → removed), `become_member_save_profile`
  × A3 (sets five funnel columns → restored), `request_delegacy` × A4, A5
  (creates a `delegates` row → removed). Verified live after the run: all twelve
  actors are in their pre-run standing and all twelve victims are at baseline.

### 7.2 Three cells that cleared without exercising the function's work

A `clear` here answers "was this actor permitted", never "did the function then
do its job". Three probes are deliberately arranged to return early, and saying
so is part of reporting them honestly:

- **`register` × A3–A12** returns `cabinet_state()||{created:false}` the moment
  it sees an existing `profiles` row. The gate was passed; no registration
  happened.
- **`member_change_delegate` × the allow set** takes the same-target no-op
  branch. The gate was passed; no membership row was minted or closed.
- **`become_member_complete` × A4–A12** hits
  `if registration_completed_at is not null then return cabinet_state()` — an
  early return for an already-completed caller. The gate was passed; **the tier
  write, the membership insert and the `gen_funnel_code` reference-code loop
  never ran.** That last point qualifies §11's claim about `gen_funnel_code`:
  this census does not exercise it through `become_member_complete` for any
  actor, only through `request_delegacy` × A4, A5, whose `delegates` insert
  does call it for a real referral code.

## 8. The table

`C` = clear · `F` = finding · `?` = needs-live-proof. **Bold** = the
expectation for that cell is `allow` (186 of 648); plain = `deny`
(462).

| function | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 | A10 | A11 | A12 | expectation |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| `active_coverage` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |
| `active_grace_days` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |
| `active_sweep` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |
| `admin_approve_delegate` | C | C | C | C | C | C | C | C | **C** | **C** | C | C | allow A9,A10 |
| `admin_cancel_event` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_close_poll` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_delete_event` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_delete_news` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_delete_poll` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_export_members` | C | C | C | C | C | C | C | C | **C** | C | **C** | C | allow A9,A11 |
| `admin_grant_role` | C | C | C | C | C | C | C | C | **C** | C | C | C | allow A9 |
| `admin_open_poll` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_publish_event` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_publish_news` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_reassign_member` | C | C | C | C | C | C | C | C | **C** | **C** | C | C | allow A9,A10 |
| `admin_record_payment` | C | C | C | C | C | C | C | C | **C** | C | **C** | C | allow A9,A11 |
| `admin_record_payments_bulk` | C | C | C | C | C | C | C | C | **C** | C | **C** | C | allow A9,A11 |
| `admin_reject_delegate` | C | C | C | C | C | C | C | C | **C** | **C** | C | C | allow A9,A10 |
| `admin_reveal_applicant_personal_id` | C | C | C | C | C | C | C | C | **C** | **C** | C | C | allow A9,A10 |
| `admin_reveal_personal_id` | C | C | C | C | C | C | C | C | **C** | C | C | C | allow A9 |
| `admin_revoke_role` | C | C | C | C | C | C | C | C | **C** | C | C | C | allow A9 |
| `admin_save_event` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_save_news` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_save_poll` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_set_news_image` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_unpublish_news` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `admin_update_delegate_profile` | C | C | C | C | C | C | C | C | **C** | **C** | C | C | allow A9,A10 |
| `admin_update_setting` | C | C | C | C | C | C | C | C | **C** | C | C | C | allow A9 |
| `admin_void_payment` | C | C | C | C | C | C | C | C | **C** | C | **C** | C | allow A9,A11 |
| `audit_log_immutable` | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | deny ×12 |
| `become_member_complete` | C | **?** | **?** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `become_member_save_profile` | C | **?** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `cabinet_state` | C | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `delegate_panel` | C | C | C | C | C | **C** | **C** | **C** | C | C | C | C | allow A6,A7,A8 |
| `delegate_team` | C | C | C | C | C | C | **C** | C | C | C | C | C | allow A7 |
| `delegate_team_rsvps` | C | C | C | C | C | C | **C** | C | C | C | C | C | allow A7 |
| `enforce_delegate_completed` | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | deny ×12 |
| `gen_funnel_code` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |
| `has_admin_role` | C | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `has_any_admin_role` | C | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `is_completed_member` | C | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `is_registered` | C | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `member_cast_vote` | C | ? | ? | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A4,A5,A6,A7,A8,A9,A10,A11,A12 |
| `member_change_delegate` | C | ? | ? | **C** | **C** | **C** | C | **C** | **C** | **C** | **C** | **C** | allow A4,A5,A6,A8,A9,A10,A11,A12 |
| `member_change_tier` | C | ? | ? | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A4,A5,A6,A7,A8,A9,A10,A11,A12 |
| `member_rsvp` | C | ? | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A3,A4,A5,A6,A7,A8,A9,A10,A11,A12 |
| `protect_profile_columns` | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | deny ×12 |
| `recompute_all_active` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |
| `recompute_member_active` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |
| `register` | C | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `request_delegacy` | C | C | C | **C** | **C** | **C** | **C** | **C** | **?** | **?** | **?** | **?** | allow A4,A5,A6,A7,A8,A9,A10,A11,A12 |
| `send_sms_hook` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |
| `set_updated_at` | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | deny ×12 |
| `tbilisi_today` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |

### 8.1 What the grid shows about RBAC

The whole purpose of four separate admin roles is that A10 can approve a
delegate and A11 cannot. Every separation below was probed with the same fresh,
valid target the role-holder succeeded against, so a hole would have shown as a
completed call. Role-family sizes are counted from the manifest's allow-sets,
which were each re-derived from the live `prosrc` gate.

| the boundary | probed as | result |
| --- | --- | --- |
| verifier cannot read a member's personal ID | A10 → `admin_reveal_personal_id` | `missing_role` |
| verifier cannot record or void a payment | A10 → the 4 finance functions | `missing_role` |
| finance cannot approve or reject a delegate | A11 → the 5 verifier functions | `missing_role` |
| finance cannot touch news, events or polls | A11 → the 13 editor functions | `missing_role` |
| editor cannot record a payment or export members | A12 → the 4 finance functions | `missing_role` |
| editor cannot grant itself a role | A12 → `admin_grant_role` | `missing_role` |
| no admin below super_admin may grant/revoke roles or change settings | A10, A11, A12 → the 4 super_admin-only functions | `missing_role` |
| a pending or rejected delegate gets no team PII | A6, A8 → `delegate_team`, `delegate_team_rsvps` | `not_approved` |
| an approved delegate holds no membership | A7 → `member_change_delegate` | `not_a_member` |
| anonymous reaches nothing it does not hold | A1 → all 54 functions | `42501` on 50; the other 4 are the trigger functions PostgREST will not route (§10) |

`admin_reveal_personal_id` deserves a line of its own: it is `super_admin`-ONLY
(a single `has_admin_role` check, no `has_any_admin_role` fallback), and it does
**not** share verifier's grant on `admin_reveal_applicant_personal_id` despite
the shared `admin_reveal_` prefix. A10 is refused by it and admitted by the
other. Both were probed; both behaved.

## 9. The audit-log invariant

A function that mutates admin-visible state without leaving an `audit_log` row
is a finding regardless of its access control — the platform's whole
accountability story is that every admin act is attributable afterwards.

Graded against what the census **actually did**, not by re-invoking anything:
the `audit_log` high-water mark is read before the matrix, and every `admin_*`
cell that came back with no error must have a matching row in the slice after
it, carrying that function's own action string **and naming the calling actor
as `actor_id`**.

**48 assertions, all holding** — the 26 audit-writing admin functions, once per
actor that completed the call. Recorded in `docs/security/row-scope.json` as
`function:<name>.writes-audit-log`, each carrying the `audit_log` id it matched.

**One collision had to be closed before that meant anything.**
`admin_record_payments_bulk` writes a `payment.record` row *per batch row* as
well as its own `payment.bulk_record` summary — the same action string
`admin_record_payment` writes. Matching on `(action, actor_id)` alone, an
`admin_record_payment` that had stopped writing its audit row entirely would
still have "passed" on a row the bulk function wrote: the one shape of failure
this family exists to catch, invisible to it. Both sides are now discriminated
on `details.batchId` (present on every bulk row, never on the single-payment
path), and a further 1 assertion,
`audit-log-invariant.no-shared-action-without-discriminator`, fails the run if
any future function starts writing an action string another function owns
without a discriminator on both sides.

## 10. The four `returns trigger` functions — settled

Task 4 (§5.4 candidate 3) and Pass 2a both left this open: nothing revokes
EXECUTE on `audit_log_immutable`, `enforce_delegate_completed`, `protect_profile_columns`, `set_updated_at`, and the only thing observed
standing in the way was PostgREST filtering trigger-returning functions out of
its schema cache — *an API-gateway behaviour, not a database control*. Pass 2a
proved the four **fire correctly when reached**; what was unsettled was whether
a client can reach them at all.

**It is not a gateway behaviour. The candidate finding is disproved.**

1. **No PostgREST route reaches them.** Both routes the gateway offers were
   probed: `POST /rpc/<name>` for all four functions from all twelve actors,
   and `GET /rpc/<name>` anonymously. Every one answers `404 PGRST202`.
   Recorded as `function:<name>.no-rpc-route` — 52 rows
   (13 per function: 12 actors + the GET route).
2. **No route reaches them, full stop — because PostgreSQL itself refuses.**
   Run directly against the database on a pooler connection as the `postgres`
   superuser, with no gateway involved and every privilege in hand:

   ```
   select public.set_updated_at();
   ERROR:  trigger functions can only be called as triggers
   ```

   Identical for `audit_log_immutable`. That is the PL/pgSQL call handler
   refusing a `returns trigger` function in **any** non-trigger context, for
   **any** role, grant or no grant.

**Verdict: not exploitable, and not dependent on the gateway.**

**The grant is nevertheless broader than Pass 2a recorded, and the remediation
has to change with it.** The live `proacl` on all four is
`=X/postgres | postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres`.
The leading `=X/postgres` is the PUBLIC default, but `anon` and `authenticated`
each hold an **explicit, separately-granted** EXECUTE on top of it — almost
certainly from a blanket `grant execute on all functions in schema public`. So
`revoke execute ... from public` alone, the obvious fix, would leave both client
roles still holding it. The correct remediation for Task 12 is
`revoke execute on function <name>() from public, anon, authenticated;` for each
of the four. Hygiene, not a hole — it removes a misleading `proacl` entry and
would matter if a migration ever changed one of these to return something other
than `trigger` — but a half-fix would look like a fix.

These four surfaces' 48 ledger cells nevertheless remain `?`: see §13a.

## 11. The helpers — answers, not just reachability

**Two different sets go by the name "helper" and this section is about the
second one.** The catalog's six *security-invoker* functions are
`audit_log_immutable`, `enforce_delegate_completed`, `protect_profile_columns`,
`set_updated_at`, `gen_funnel_code` and `tbilisi_today` — that is the "48
definer + 6 plain" split in the heading above. The six functions that *answer
questions other functions depend on* are a different set, four of them
`security definer`: `has_admin_role`, `has_any_admin_role`,
`is_completed_member`, `is_registered`, plus `gen_funnel_code` and
`tbilisi_today`. Only `gen_funnel_code` and `tbilisi_today` are in both.

These are not doors, which is exactly why they are easy to skip. But
`has_admin_role` is consulted by 26 of the 48 gatekeepers, and if it ever
answered `true` for the wrong caller every one of them would open at once —
and each door would simply report "allowed", exactly as its `allow` expectation
predicts. Probing the doors could never reveal it.

So the four callable ones are graded against **ground truth read service-side**,
per actor — 84 assertions in total, all holding:

| assertion | rows | result |
| --- | --- | --- |
| `has_admin_role.answers-truthfully` | 48 (12 actors × 4 roles) | every answer matches `admin_roles`; A1 refused `42501` |
| `has_any_admin_role.answers-truthfully` | 12 | matches "holds any of the four roles" |
| `is_registered.answers-truthfully` | 12 | matches "a `profiles` row exists for `auth.uid()`" |
| `is_completed_member.answers-truthfully` | 12 | matches `registration_completed_at is not null` |

No helper over-reports. A10 (verifier) gets `false` for `super_admin`; A5
(plain member) gets `false` for all four; A9 gets `true` only for `super_admin`.

The other two are not callable by any client — `gen_funnel_code` and
`tbilisi_today` carry no `anon`/`authenticated` grant (**`tbilisi_today` was
confirmed rather than assumed: real `42501` for all twelve, including all four
admins**) — so their behaviour is established through the gatekeepers that
depend on them.

## 12. `admin_export_members` — the two argument variants

The roster export is the most sensitive call in the schema, and its
`p_include_ids` flag is not an ordinary parameter: it is a **second, narrower
gate inside the same body**, super_admin-only (spec decision #6), raising the
**same `missing_role` token** as the primary gate — but *after* finance has
already been admitted.

That makes it un-gradable as a single cell. A11's surface expectation is
correctly `allow`; `missing_role` is a REFUSAL token; so `judge()` would assert
an over-restriction **finding against correct, spec'd behaviour**, on the
roster-plus-personal-IDs probe of all things. Both variants are therefore
probed, in the two places that can each express what they mean:

- **`p_include_ids: false`** is the census cell — A9 and A11 permitted, the
  other ten refused.
- **`p_include_ids: true`** is graded by name for all twelve (12 assertions), as
  `function:admin_export_members.include-ids-super-admin-only`: **A9 permitted;
  A1 refused `42501`; A2–A8 and A10–A12 refused `missing_role`** — including
  A11, the finance role that is admitted at the primary gate. Personal IDs are
  super_admin-only in practice, not just on paper.

Both probes pass `p_search: "SECAUDIT"`, which narrows the result set to this
task's own synthetic victims: the same code path, without pulling the live
roster's phones and names into the runner's memory.

## 13. The 62 cells that stay `needs-live-proof`

None is an argument defect — every one was invoked with valid arguments against
a fresh target. They fall into three groups.

**(a) 48 cells — the four trigger functions × 12 actors.** `PGRST202`.
`judge()` routes any not-found code to `needs-live-proof` on both sides, on the
stated grounds that a not-found "can only mean OUR call was malformed". For a
zero-argument function called with no arguments that premise does not hold, but
`judge()` receives only `(expectation, outcome, kind)` and cannot tell the two
apart. Settled by named assertion instead (§10).

**(b) 10 cells — a deliberately unclassified refusal token.**

- `become_member_complete` × A2, A3 (`profile_incomplete`)
- `become_member_save_profile` × A2 (`profile_incomplete`)
- `member_cast_vote` × A2, A3 (`not_completed`)
- `member_change_delegate` × A2, A3 (`not_completed`)
- `member_change_tier` × A2, A3 (`not_completed`)
- `member_rsvp` × A2 (`not_completed`)

`not_completed` and `profile_incomplete` are genuine **caller-standing**
refusals in these functions — the actor did not get in — but `verdict.ts` leaves
both unclassified because the identical text means a *target*-state validation
in `admin_record_payment` and `admin_grant_role`. The refusal is real; the
classifier declines to grade it on a message-only match.

**(c) 4 cells — the audit's single abstention.** `request_delegacy` × A9–A12.
It writes on the **caller**, and A9–A12 are the canonical staging admins this
audit must not mutate. Reversible in principle; a teardown that fails over the
network leaves a super_admin sitting in the delegate queue. Recorded with the
documented `SKIP-MUTATING` sentinel rather than guessed. See §7.1 for the one
place a *lesser* mutation of those same accounts was accepted, so the two
standards can be compared.

## 14. Escalated to Pass 3

1. **`judge()` cannot classify a token per function.** `not_completed` and
   `profile_incomplete` are caller-standing gates in the four member RPCs and
   target-state validations in `admin_record_payment`/`admin_grant_role`; a
   message-only match cannot tell them apart, which is why group (b) above
   cannot resolve. Passing the surface name into `judge()` would settle all
   10 here — and the 10 that Pass 2c inherits for the same reason.

   *An earlier revision of this section also proposed reclassifying
   `already_completed` from `POST_GATE_TOKENS` to `REFUSAL_TOKENS`. **That
   proposal is withdrawn — acting on it would be a regression.** `allow` +
   a refusal token is a **finding**, and `become_member_save_profile` carries
   `allow` for A2–A12 while returning `already_completed` for A4–A12, so the
   change would manufacture nine false findings — the exact outcome §13 exists
   to avoid.*
2. **`PGRST202` on a zero-argument function is not an argument mismatch.** A
   surface PostgREST structurally will not route is a different fact from a
   probe that got the signature wrong, and only the surface's `note` currently
   tells them apart.
3. **`request_delegacy` × A9–A12** — the one uninvoked group. Resolvable in a
   throwaway environment where mutating a seeded admin costs nothing.
4. **`revoke execute ... from public, anon, authenticated`** on the four trigger
   functions (§10) — hygiene, not a hole, and note the three-role revoke: a
   PUBLIC-only revoke would not remove the explicit grants.

## 15. Fixtures and residue

`docs/security/residue.json` records every id minted, **by run and appended
across runs**. Task 13 uses it to separate what the reseed removed from what the
append-only `audit_log` made permanent.

Latest database-census run: 395 rows — 96 `poll_options`, 50 `delegates`, 50 `events`, 50 `polls`, 50 `news`, 26 `memberships`, 24 `admin_roles`, 16 `payments`, 14 `profiles`, 10 `event_rsvps`, 9 `poll_votes`. 31 of those were
minted by the RPC **itself** rather than staged by `setup()`:
`admin_save_news`/`_event`/`_poll` called with `p_id: null` create their own row,
`member_rsvp` creates an `event_rsvps` row and `member_cast_vote` a
`poll_votes` row.

- **12 disposable victim members** (`auth.users` + `profiles`, phones
  `+9955090020001..0012`, tagged `security-audit-2026-07`) — created once,
  reused and reset across runs so repeated audits do not accumulate identities.
- **`admin_roles` residue is zero by construction.** A granted role is a real
  admin account on staging, so `admin_grant_role`'s teardown revokes it the
  instant the probe returns, whatever the verdict was.
- **`audit_log` rows written by successful probes are NOT residue and are not
  listed for removal.** They are permanent by design — that is the invariant
  §9 exists to check.
- **What no id list can cover** is enumerated in the file's own `sweepByTag`
  array.

---

# Pass 2c (Task 8) — server actions, the dev-OTP endpoint, storage buckets

**41 surfaces × 12 actor positions = 492 graded cells** — 38 Server
Actions, 1 HTTP endpoint, 2 Storage buckets. Every expectation is stated in
`scripts/security/manifest.json`; 0 of 492 cells are rule-derived.

**Result: 420 clear, 0 findings, 72 needs-live-proof.** Two independent full
runs produced **identical verdicts in every cell**.

## 16. Reaching a Server Action at all

An action is not addressable the way an RPC is. Three things are needed and none
can be guessed:

1. **The action id**, read at runtime from
   `.next/server/server-reference-manifest.json`, which `next build` writes. Its
   `node` map holds exactly 38 entries — independently the same 38 the audit
   manifest enumerates — each with its `exportedName` and the page entries that
   register it.
2. **The page URL.** Next refuses an action id posted to a page whose entry does
   not register it, so the page cannot be guessed either; the manifest supplies
   it.
3. **The encoding**, captured from a real browser request rather than assumed:
   `next-action: <id>`, `content-type: text/plain;charset=UTF-8`,
   `accept: text/x-component`, and a body that is a plain JSON array of the
   action's positional arguments.

**The credential is the part that makes this a different pass.** Actions build
their Supabase client from **cookies** (`lib/supabase/server.ts`), so the bearer
token every other probe in this audit uses is anonymous to them.
`scripts/security/app-session.mjs` instantiates the app's own `@supabase/ssr`
`createServerClient` against an in-memory jar, calls `setSession()` with each
actor's cached access token, and hands back whatever cookies that library
writes — correct by construction rather than by reverse-engineering a private,
twice-changed format. No OTP is sent: a full run reuses the disk-cached
sessions.

The replay then swaps exactly one field: the cookie header. **That is the attack
the UI can never construct**, and it is the point of the pass.

### 16.1 The self-checks, because a broken probe looks exactly like a defence

| check | rows | result |
| --- | --- | --- |
| `app-session.cookie-resolves-to-this-actor` | 12 | 12 holding |
| `action:*.probe-is-valid` | 38 | 38 holding |
| `action:*.denied-actor-changes-nothing` | 102 | 102 holding |
| `action:*.generic-refusal-is-real` | 58 | 58 holding |

- **Identity.** A cookie jar that silently failed to authenticate would produce
  a clean sweep of refusals indistinguishable from a perfect defence. Two
  independent halves guard it and the runner *aborts* rather than grading if
  either fails: the session must decode to the actor's own user id, and `/me`
  must route the jar to that actor's declared destination. `/me` is a router —
  `deriveDestination(cabinet_state())` reads the caller's own standing out of the
  database — so the destination is a per-actor fingerprint the *running app*
  produces from the cookie. Live: A1→`/login`, A2→`/join`, A3→200 in place,
  A7→`/delegate`, the rest→`/me/profile`, matching every actor's declared
  standing.
- **Probe validity.** Every action must show at least one *allowed* actor whose
  result is not the app's generic error; otherwise its arguments or its encoding
  are wrong and its deny cells prove nothing. This caught a wrong multipart
  encoding on the two upload actions, which had produced a refusal that looked
  like a defence.
- **State.** A verdict says whether the caller was refused; it cannot say
  whether the target *changed*. For the nine most sensitive mutating actions the
  target row is fingerprinted immediately before and after every denied
  attempt. Nothing moved: no role granted, no payment recorded, no delegate
  approved, no article published, no membership reassigned, no setting changed.

## 17. The table

`C` = clear · `F` = finding · `?` = needs-live-proof. **Bold** = the
expectation for that cell is `allow` (151 of 492).

| action | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 | A10 | A11 | A12 | expectation |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| `approveDelegateAction` | ? | ? | ? | ? | ? | ? | ? | ? | **C** | **C** | ? | ? | allow A9,A10 |
| `cancelEventAction` | ? | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `changeDelegateAction` | ? | ? | ? | **C** | **C** | **C** | C | **C** | **C** | **C** | **C** | **C** | allow A4,A5,A6,A8,A9,A10,A11,A12 |
| `changeTierAction` | ? | ? | ? | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A4,A5,A6,A7,A8,A9,A10,A11,A12 |
| `closePollAction` | ? | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `completeMembershipAction` | ? | **?** | **?** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `confirmBulkAction` | ? | C | C | C | C | C | C | C | **C** | C | **C** | C | allow A9,A11 |
| `deleteEventAction` | ? | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `deleteNewsAction` | ? | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `deletePollAction` | ? | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `findAdminCandidateAction` | C | C | C | C | C | C | C | C | **C** | C | C | C | allow A9 |
| `grantRoleAction` | ? | C | C | C | C | C | C | C | **C** | C | C | C | allow A9 |
| `lookupMemberAction` | C | C | C | C | C | C | C | C | **C** | C | **C** | C | allow A9,A11 |
| `openPollAction` | ? | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `previewBulkAction` | C | C | C | C | C | C | C | C | **C** | C | **C** | C | allow A9,A11 |
| `publishEventAction` | ? | ? | ? | ? | ? | ? | ? | ? | **C** | ? | ? | **C** | allow A9,A12 |
| `publishNewsAction` | ? | ? | ? | ? | ? | ? | ? | ? | **C** | ? | ? | **C** | allow A9,A12 |
| `reassignMemberAction` | ? | C | C | C | C | C | C | C | **C** | **C** | C | C | allow A9,A10 |
| `recordPaymentAction` | ? | C | C | C | C | C | C | C | **C** | C | **C** | C | allow A9,A11 |
| `registerAction` | ? | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `rejectDelegateAction` | ? | C | C | C | C | C | C | C | **C** | **C** | C | C | allow A9,A10 |
| `requestDelegacyAction` | ? | C | C | **C** | **C** | **C** | **C** | **C** | **?** | **?** | **?** | **?** | allow A4,A5,A6,A7,A8,A9,A10,A11,A12 |
| `revealApplicantIdAction` | ? | C | C | C | C | C | C | C | **C** | **C** | C | C | allow A9,A10 |
| `revealPersonalIdAction` | ? | C | C | C | C | C | C | C | **C** | C | C | C | allow A9 |
| `revokeRoleAction` | ? | C | C | C | C | C | C | C | **C** | C | C | C | allow A9 |
| `rsvpAction` | ? | ? | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A3,A4,A5,A6,A7,A8,A9,A10,A11,A12 |
| `saveEventAction` | ? | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `saveMembershipProfileAction` | ? | **?** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `saveNewsAction` | ? | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `savePollAction` | ? | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `setNewsCoverAction` | C | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `unpublishNewsAction` | ? | C | C | C | C | C | C | C | **C** | C | C | **C** | allow A9,A12 |
| `updateDelegateProfileAction` | C | C | C | C | C | C | C | C | **C** | **C** | C | C | allow A9,A10 |
| `updateGraceDaysAction` | ? | C | C | C | C | C | C | C | **C** | C | C | C | allow A9 |
| `updateProfileAction` | C | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `updateRegisteredNameAction` | C | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A2–A12 |
| `voidPaymentAction` | ? | C | C | C | C | C | C | C | **C** | C | **C** | C | allow A9,A11 |
| `voteAction` | ? | ? | ? | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | **C** | allow A4,A5,A6,A7,A8,A9,A10,A11,A12 |

| surface | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 | A10 | A11 | A12 | expectation |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| `delegate-photos` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |
| `news-images` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |
| `GET /api/dev/otp` | C | C | C | C | C | C | C | C | C | C | C | C | deny ×12 |

### 17.1 RBAC separation, live through the app layer

Every separation Pass 2b proved at the RPC also holds through the action that
wraps it, probed with a different actor's cookie:

| the boundary | probed as | result |
| --- | --- | --- |
| editor cannot record a payment or export | A12 → the 5 finance actions | `missing_role` |
| finance cannot touch news, events or polls | A11 → the 13 editor actions | `missing_role` |
| verifier cannot read a member's personal ID | A10 → `revealPersonalIdAction` | `missing_role` |
| finance/editor cannot approve a delegate | A11, A12 → `approveDelegateAction` | refused; target unchanged |
| no admin below super_admin grants roles | A10, A11, A12 → `grantRoleAction` | `missing_role` |
| a plain member reaches no admin action | A5 → all 27 admin actions | `missing_role` |

**The two service-role paths behave.** `setNewsCoverAction` and
`updateDelegateProfileAction` are the only actions that touch
`createAdminClient()`, and both refuse with `missing_role` **from the app's own
precheck** — before the service-role client is ever constructed — for all ten
denied actors each. Those rows carry `refusedBy: "app-precheck …"` so an
app-layer refusal is never conflated in evidence with a database one, even
though the two grade alike. Both were probed with a real 1×1 PNG so the true
path (client-declared MIME → `PHOTO_TYPES` → service-role upload) was
exercised.

## 18. The endpoint — `GET /api/dev/otp`

**Census verdict: 12 clear.** The R1 hardening holds. The probe aims at a
phone that has *both* a `profiles` row and a fresh `dev_otp_inbox` row, so a 404
proves the code was **withheld** rather than absent, and the no-profile control
(a code *is* served) proves the endpoint was working. All twelve actors, A9 and
A1 alike, got `404 {"error":"not found"}`.

**Three findings the grid structurally cannot carry.** The endpoint has no
authentication at all — by design, in `development`/`preview` only — so "every
actor reaches it" is not itself the finding. Each is recorded by name in
`docs/security/row-scope-app.json`:

**18.1 Account-existence oracle, response body (D5 / R2).**
`has-account: 404 {"error":"not found"} | no-account: 404 {"error":"no otp"}`.
Any unauthenticated caller can ask "does this number have an account?" and read
the answer off the body. On a civic platform whose membership is the sensitive
fact, that is a membership-disclosure oracle over the whole mobile range.

**18.2 Account-existence oracle, timing — and it survives fixing 18.1.**
Measured, median of three round-trips per branch:
`has-account median 309ms (245/330/309), no-account median 6634ms (6634/6729/6552), gap 6325ms`.
The profile-exists branch returns immediately; the no-profile branch first polls
`dev_otp_inbox` ten times at 500 ms before answering. **Unifying the two
response bodies would close 18.1 and leave this one entirely intact** — only
fixing the control flow closes both.

**18.3 Unauthenticated service-role DELETE (R2).** `route.ts:17-20` runs
`delete().lt("created_at", now − 1h)` on `dev_otp_inbox` with the **service-role
key**, before any check — before the phone is validated, before the profile
lookup. Proven by construction rather than by damaging real data: an hour-old
row was staged for a phone nothing else uses, one **anonymous** GET was made,
and `the stale row was DELETED by an unauthenticated GET`. The anonymous caller holds no delete
grant on that table (§3.1a: it cannot even read a row), so only the endpoint can
have removed it. Any unauthenticated caller can drive an unbounded number of
service-role DELETEs.

## 19. The two buckets — write is sealed

**Census verdict: 24 clear (12 × 2).** Both buckets are `public => true` by
design and both migrations state the same intent: public read, writes only
through the service-role upload action. Neither creates a single
`storage.objects` policy, and that is exactly what the live behaviour shows —
every actor's upload was refused with the pinned refusal, not merely "an error":

```
403 new row violates row-level security policy
```

**Including A12, the editor**, whose legitimate route is `setNewsCoverAction`
uploading with the *service role* after re-checking its own role.

Two things make this a result rather than an absence:

- **The public-read control.** A service-role object was uploaded to each bucket
  and fetched anonymously over its public URL — 200, bytes match. Each bucket
  exists, is public and is serving, so every write refusal is a statement about
  the policy, not about an unreachable bucket. Control objects removed
  immediately.
- **Sibling verbs.** `storage.objects` is one table with one policy set, so
  `list` and `delete` were probed too, for all twelve on both buckets: zero
  object names returned to any actor, zero objects removed. Probing only the
  verb you expect to be blocked is how a hole in a sibling verb survives an
  audit. 74 bucket assertions, 74 holding.

No client write ever landed, so there is no attacker-shaped residue in either
bucket.

## 20. The 72 cells that stay `needs-live-proof` — three groups, none a defect

**(a) 58 cells — the app collapses a real refusal into
`GENERIC_FUNNEL_ERROR`.** Two structural causes:

- **31 cells: A1 (anonymous) × the actions that go straight to an RPC.**
  Postgres refuses an anonymous caller `42501 permission denied for function …`
  and `mapFunnelError()` has no entry matching that text, so the action returns
  the generic Georgian string. The strongest refusal the platform can produce,
  rendered unclassifiable. The actions where A1 *does* resolve are exactly the
  ones with an app-side check that runs first — the two cabinet actions
  (`not_authenticated`) and the five `hasAnyRole` prechecks (`missing_role`).
- **27 cells: `approveDelegateAction`, `publishEventAction`, `publishNewsAction` × their denied
  actors.** These read a self-gating admin view *before* the RPC and bail on its
  error; a denied actor gets zero rows, `.single()` raises `PGRST116`, and that
  unknown message maps to the generic string too.

`judge()` cannot grade `APP-GENERIC`, and that is deliberate: **a probe with
wrong arguments returns the identical string**, so letting it clear a deny
expectation is precisely the false all-clear this audit exists to prevent. What
*can* be checked is recorded by name — `generic-refusal-is-real`,
58/58 holding: for every one of these cells the action returned
`ok:false`, **and** the identical argument builder against an identically minted
target was accepted for an allowed actor of the same action. The only field that
differs between those two requests is the session cookie, so the refusal is
about *who called*. Together with the state assertions these 58 are settled in
evidence, while the ledger keeps recording honestly what `judge()` alone can
see.

**(b) 10 cells — a deliberately unclassified token.**

- `changeDelegateAction` × A2, A3 (`not_completed`)
- `changeTierAction` × A2, A3 (`not_completed`)
- `completeMembershipAction` × A2, A3 (`profile_incomplete`)
- `rsvpAction` × A2 (`not_completed`)
- `saveMembershipProfileAction` × A2 (`profile_incomplete`)
- `voteAction` × A2, A3 (`not_completed`)

Identical population and identical cause to Pass 2b's group (b): `verdict.ts`
leaves `not_completed` and `profile_incomplete` unclassified because the same
text means a caller-standing gate in the member RPCs and a target-state
validation in the admin ones.

**(c) 4 cells — `requestDelegacyAction` × A9–A12.** The same abstention Pass 2b
made, for the same reason: the action writes on the **caller**, and A9–A12 are
the canonical staging admins this audit must not mutate.

## 21. Escalated to Pass 3 / Task 12

1. **The dev-OTP endpoint's two oracles and its unauthenticated service-role
   DELETE** (§18). All three need app-code changes, which no census pass may
   make. Note the independence: unifying the response bodies leaves the timing
   gap answering the same question.
2. **`mapFunnelError` has no entry for a raw `42501`**, so an anonymous
   caller's refusal — the most conclusive refusal there is — reaches the ledger
   as an unclassifiable generic string and 31 cells cannot resolve on it. An
   instrument limitation with a one-line cause, not a hole.
3. **Three actions read a self-gating view before their RPC and bail on
   PostgREST's error**, collapsing a real refusal into the generic message. The
   RPC's own `missing_role` would be both more accurate for the user and
   gradeable; the sibling actions that ignore the pre-read error already behave
   that way.
4. **Upload type comes from the client-declared MIME** (`PHOTO_TYPES[photo.type]`,
   echoed back as `contentType`), never sniffed from bytes, and there is no
   per-actor quota behind the 5 MB per-file cap. Because the echoed
   Content-Type stays `image/*` a browser will not execute the bytes: this is
   **hosting abuse of a public URL by an already-trusted editor or verifier, not
   stored XSS**. Recorded at that weight deliberately.

## 22. Fixtures and residue

Pass 2c reuses Pass 2b's fixture machinery in full — the twelve disposable
victims, the per-(surface, actor) fresh targets, the teardown discipline. Its
own additions:

- **9 storage object(s)** across its runs, every one uploaded by the *action
  itself* under the service role after its own role check succeeded, and every
  one removed service-side the moment the probe returned. Recorded in
  `residue.json` under the `app-probe.mjs (Pass 2c)` runs.
- **`dev_otp_inbox` fixture rows** for two synthetic phones, written and removed
  inside the endpoint probe's own `finally`. The synthetic code is `424242` and
  the phones are outside every real block, so no real sign-in could collide.
- **No OTP was sent by a probe.** All twelve sessions come from the disk cache.

**1152 of 1155 named assertions across all three passes hold.** The 3 that do not are the 3 endpoint findings in §18 — they are written as assertions precisely so that a failure is the finding, rather than something a reader has to notice in prose.

