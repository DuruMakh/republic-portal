# Security audit — coverage table

**Pass 2a (Task 6): read surfaces and the depth layer behind them.**
57 surfaces × 12 actor positions = **684 graded cells**, every one of them
against a stated expectation read from the migration that creates the surface
and confirmed against the live catalog. No cell in this section is
rule-derived.

Ledger: `docs/security/ledger.json` · raw outcomes: `ledger-raw.json` ·
row-scope assertions: `row-scope.json` · expectations and their derivation:
the `overrides` and `note` fields of `scripts/security/manifest.json` ·
threats: `threat-model.md`.

Later passes append their own sections: Pass 2b (functions, Task 7), Pass 2c
(server actions, the dev-OTP endpoint, storage buckets — Task 8).

---

## 1. How to read this

**The glyphs.** `C` = clear · `F` = finding · `?` = needs-live-proof.
Every cell in this section is `C`; nothing in Pass 2a's scope resolved to a
finding or stayed inconclusive.

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

That gap is closed by **named row-scope assertions** (§3): 544 of them, each
stating an expected row set per actor and checking it live. A surface is only
as clear as both records together. Where a note below says "zero rows every
time", that is an assertion result, not an inference.

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

---

## 2. The table

| Surface | Kind | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 | A10 | A11 | A12 | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `admin_admins` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_admin_role`. The admin roster (R3's coercion-target list) is visible only to A9 — 4 rows; A10/A11/A12 get zero. |
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
| `admin_region_stats` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_any_admin_role`. Rows only for A9/A10/A11 (5 each); A2–A8/A12 permitted-and-empty. |
| `admin_settings` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 at `has_admin_role`. Settings visible only to A9. |
| `member_event_going_counts` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. Gate is `is_registered()`, NOT `is_completed_member()` (re-created 20260721120000:606) — so A3 legitimately sees counts and only A2 (no profile row) gets zero. |
| `member_news` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501 on the view. `is_completed_member()` gates the rows: A2 (no profile) and A3 (registered only) get zero; A4–A12 get 5. |
| `member_poll_options` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. `is_completed_member()` gate holds: zero for A2/A3, 5 rows for A4–A12. |
| `member_polls` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. `is_completed_member()` gate holds: zero for A2/A3, 3 rows for A4–A12. |
| `poll_option_counts` | view | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. Counts require a completed member AND (poll closed OR caller already voted): zero for A2/A3; A5/A7, who voted for this pass, see the open poll's counts too. |
| `public_delegates` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated by design. All twelve read the approved-delegate directory (5 rows each) — the intended public surface; `delegates` itself stays sealed. |
| `public_events` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated. Published/cancelled events only; 5 rows to all twelve. |
| `public_news` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated. Filtered to published+public news; 4 rows to all twelve. |
| `public_stats` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated by design. Aggregate counts only; 1 row to all twelve. |
| `transparency_regions` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated by design. Per-region aggregates; 5 rows to all twelve. |
| `transparency_stats` | view | C | C | C | C | C | C | C | C | C | C | C | C | Granted to anon+authenticated by design (transparency figures). 1 aggregate row to all twelve. |
| `admin_roles` | table | C | C | C | C | C | C | C | C | C | C | C | C | Every authenticated caller may run the select; the row policy scopes it. A9–A12 see exactly their own role row, A2–A8 and A1 see nothing — proven by name, not inferred (`admin_roles.cross-actor`). |
| `app_settings` | table | C | C | C | C | C | C | C | C | C | C | C | C | Statement permitted (default-privilege SELECT survives on this instance); RLS has no policy, so all twelve get zero rows. The grant layer abstains, RLS holds. |
| `audit_log` | table | C | C | C | C | C | C | C | C | C | C | C | C | Statement permitted; RLS has no policy, so all twelve — including A9 — get zero rows through the table. A9's route is the `admin_audit` view. |
| `cities` | table | C | C | C | C | C | C | C | C | C | C | C | C | Deliberately world-readable reference data. 5 rows to all twelve — intended, not a leak. |
| `delegates` | table | C | C | C | C | C | C | C | C | C | C | C | C | SELECT revoked from anon+authenticated (public reads go through `public_delegates`). 42501 for all twelve — `referral_code` and the verification trail never reach a client. |
| `dev_otp_inbox` | table | C | C | C | C | C | C | C | C | C | C | C | C | Statement permitted; RLS has no policy, so all twelve get zero rows. Live sign-in codes stay unreadable to every client role. |
| `event_rsvps` | table | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. A2–A12 may read exactly three columns, scoped by RLS to their own RSVPs — A5/A7 (who RSVP'd for this pass) see 1 each, everyone else zero. |
| `events` | table | C | C | C | C | C | C | C | C | C | C | C | C | `revoke all` with no re-grant. 42501 for all twelve. |
| `memberships` | table | C | C | C | C | C | C | C | C | C | C | C | C | Table-wide SELECT to authenticated; RLS returns own rows only. A4–A12 see 1 membership each; A1–A3 none. |
| `news` | table | C | C | C | C | C | C | C | C | C | C | C | C | `revoke all` with no re-grant. 42501 for all twelve; reads go through the public/member/admin views. |
| `payments` | table | C | C | C | C | C | C | C | C | C | C | C | C | Probed with the 10 granted columns. Own rows only: A5–A8 see 1 payment each, A9–A12 and A3/A4 see none, A1 none. |
| `poll_options` | table | C | C | C | C | C | C | C | C | C | C | C | C | `revoke all` with no re-grant. 42501 for all twelve. |
| `poll_votes` | table | C | C | C | C | C | C | C | C | C | C | C | C | A1 refused 42501. A2–A12 may read three columns, scoped to their own vote. A5/A7 see their own ballot only — ballot secrecy holds against a populated table (152 votes). |
| `polls` | table | C | C | C | C | C | C | C | C | C | C | C | C | `revoke all` with no re-grant. 42501 for all twelve. |
| `profiles` | table | C | C | C | C | C | C | C | C | C | C | C | C | Probed with the 14 granted columns, not `*`. Every actor may run it; RLS returns exactly their own row (A1/A2 zero). personal_id/birth_date refused 42501 for A2–A12 — see the personal-id-lockdown assertion. |
| `regions` | table | C | C | C | C | C | C | C | C | C | C | C | C | Deliberately world-readable reference data (`using (true)`). 5 rows to all twelve — intended, not a leak. |
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
| `profiles_updated_at` | trigger | C | C | C | C | C | C | C | C | C | C | C | C | The one client-reachable trigger. Cross-actor UPDATE permitted for all twelve and affects zero rows; on the owner path it fires and advances `updated_at` (team-member fixture assertion). |

**Totals for this section: 684 clear, 0 findings, 0 needs-live-proof, 0
rule-derived.** (The 38 findings and 1,020 inconclusive cells still in
`ledger.json` all belong to `function`, `action`, `endpoint` and `bucket`
surfaces — Tasks 7 and 8.)

---

## 3. Row-scope assertions

544 assertions, all holding. Full results in `docs/security/row-scope.json`;
they re-run with every `npm run security:census`.

### 3.1 Ownership — can any actor read a row that is not their own?

Each own-row table read **unfiltered** by each of the twelve, checking every
returned row's owner column. 72 assertions.

| Table         | Result                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| `admin_roles` | A9–A12 each see exactly their own role row; A2–A8 see none; A1 sees none. **Zero foreign rows, all twelve.**       |
| `profiles`    | A3–A12 each see exactly their own profile; A1/A2 see none. **Zero foreign rows.**                                 |
| `memberships` | A4–A12 each see their own membership; A1–A3 none. **Zero foreign rows.**                                          |
| `payments`    | A5–A8 each see their own payment; everyone else none. **Zero foreign rows.**                                      |
| `event_rsvps` | A5/A7 each see their own RSVP; A1 refused; the rest none. **Zero foreign rows** against 141 existing RSVPs.        |
| `poll_votes`  | A5/A7 each see their own ballot; A1 refused; the rest none. **Zero foreign rows** against 152 existing votes.      |

The `admin_roles` line is the check the brief singles out: because every
authenticated caller may run that select, a broken policy would have been
graded `clear` by the grid. It is not broken, and this is how that is known.

### 3.2 The personal-ID lockdown

`select id, personal_id, birth_date from profiles`, all twelve.
A2–A12: **refused `42501`** — those two columns are outside the
`authenticated` grant. A1: statement permitted (anon's default-privilege
SELECT still covers all 17 columns) but **zero rows**. No actor obtained a
personal ID or birth date. (Threat R1/R12.)

### 3.3 Self-gating view visibility

Each of the 18 self-gating views read by each of the twelve, asserting whether
rows should come back at all — 216 assertions, derived from the **live** view
definitions (`pg_get_viewdef`, 2026-07-25), not the migrations that first
created them.

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

### 3.4 Escalation writes

The three writes that would end the audit, attempted by all twelve against an
audit-owned target. 36 assertions.

| Attempt                                            | Result                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `insert into admin_roles {role: 'super_admin'}`     | **`42501` for all twelve** — no RLS INSERT policy exists. (R9, R3)     |
| `insert into payments` (self-activation to member)  | **`42501` for all twelve.** (R14, R15)                                |
| `insert into memberships`                           | **`42501` for all twelve.** (R7, R15)                                 |

Each is permitted at the grant layer on this instance; RLS is what refuses.
That is the §5 observation of the threat model, now re-established live rather
than read.

### 3.5 Do the defences actually fire?

A trigger that never runs is indistinguishable from one that is absent. Four
control checks, each isolating the trigger from the layer in front of it.

| Trigger                       | How it was reached                                                         | Result                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `audit_log_immutable`         | Service role UPDATE, payload = the row's existing value                      | **Raises `audit_log is append-only`.** (R8)                                             |
| `enforce_delegate_completed`  | Service role INSERT for a non-completed target; self-cleaning if it succeeded | **Raises `delegate_requires_completed_member`.** (R18)                                  |
| `set_updated_at` (`profiles`) | The audit's team-member fixture updating its own `employment`                 | **Fires — `updated_at` advanced.**                                                      |
| `protect_profile_columns`     | See §4 — a one-off `SET LOCAL ROLE anon` inside a rolled-back transaction    | **Raises `server-managed profile columns cannot be changed by client roles`.** (R1, R6) |

The service role is used here deliberately and only here. It is never a probe
actor: the question these four ask is "does this defence work", not "who can
reach it", and the answer to the second question is already in the table above.

---

## 4. Observations that are not findings

Nothing in Pass 2a's 684 cells is a breach. Four things are worth the owner's
attention anyway, and none of them is new to the audit — three sharpen
`threat-model.md` §5, one is about the instrument.

**4.1 `protect_profile_columns` currently never runs.** It is the rule making
`status`, `personal_id`, `phone`, `id` and `created_at` server-managed. For
`authenticated` the column grant refuses first (`status` is not among the five
UPDATE-granted columns), and for `anon` the row policy matches nothing — so
across all twelve actors the trigger is never reached. It does work when
reached, proven with this exact statement (run once, by hand, rolled back —
it needs a direct database connection, which the census runner deliberately
does not have):

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

**4.2 `anon` still holds SELECT and UPDATE on `profiles.personal_id` and
`birth_date`.** The Phase-3 personal-ID lockdown
(`20260717150000_admin_crm.sql:929`) revokes and re-grants for
`authenticated` only; `anon` keeps Supabase's default privileges on all 17
columns. Inert today — the row policy returns anon nothing, verified in §3.2
— but the column-level defence the migration was written to create does not
exist for the anonymous role at all. Hardening item, not a breach.

**4.3 Three tables the migrations describe as having "no client grants" do
have them.** `admin_roles`, `audit_log` and `dev_otp_inbox` carry the comment
"no client grants (server-side only)"; live, `anon` and `authenticated` hold
the full default privilege set on each. All three return zero rows to all
twelve actors (§3.1, and the table above), so the stated intent is achieved —
by RLS, not by the grant the comment describes. Same shape for `app_settings`.

**4.4 The expectations in this section are not protected from
`security:introspect --write`.** That command regenerates
`scripts/security/manifest.json` from the live catalog and writes only `id`,
`kind`, `name`, `layer` — it would silently discard all 684 `overrides` and
their derivations. `npm run security:introspect` (no flag) only reconciles and
is safe. Flagged for Pass 3.

---

## 5. Escalated to Pass 3

- **TRUNCATE granted to `anon`** (threat-model §5.4 candidate 2) — still not
  reproduced. PostgREST has no verb that maps to `TRUNCATE`, so there is no
  route from the anon key, but that is a structural reading and this pass did
  not turn it into a live result. It stays open, deliberately unclosed.
- **The four trigger functions EXECUTE-granted to `PUBLIC`** (§5.4 candidate
  3) — this pass establishes that all four *work*; whether a client can
  *invoke* them directly is a `function`-kind question and belongs to Task 7.
  Task 4's result (PGRST202 for all 48 cells) is an API-gateway behaviour, not
  a database control, and should not be filed as a defence.
- **Making the grant layer match the stated intent** (4.2, 4.3) — a fix-wave
  item for Task 12, not an edit this pass may make.

---

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
