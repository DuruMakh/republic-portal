# Security test gaps (PR 3 of 3 of the test-suite audit)

Goal: the most security-sensitive code paths get tests that would go red if the
guard they protect were removed. Tests only, plus a minimal production fix in a
separate commit if (and only if) a new test exposes a real rule violation.

Owned files: new `app/(admin)/admin/**/actions.test.ts`, new
`app/(admin)/admin/members/export/route.test.ts`, `app/api/dev/otp/route.test.ts`,
`lib/security/schema-guards.test.ts`. Every new test is run green, then proven able to
fail by temporarily breaking the guard it names (production file restored byte-for-byte
afterwards; `git diff` clean).

## The authorization model these tests pin (CLAUDE.md, ADR-014)

- Admin mutations are SECURITY DEFINER RPCs. Each one checks the session first
  (`not_authenticated`), then the role (`missing_role`), BEFORE any write, and writes
  its `audit_log` row in the same transaction. That in-database check is the
  server-side authorization CLAUDE.md requires; app-side role reads (`getAdminRoles`)
  are UX, except where the action touches the service-role key.
- Server actions therefore must: validate with zod before creating any Supabase client;
  call the RPC through the caller's own session client (`createServerSupabase`), never
  the service-role client; pass the RPC's refusal back as the mapped Georgian error; and
  revalidate nothing when refused.
- The two service-role paths (delegate photo upload, news cover upload) must check the
  role app-side BEFORE `createAdminClient()` is ever called (CLAUDE.md forbidden
  pattern: service-role key reachable without a server-side role check).
- Some reads (finance lookup, bulk preview, admin candidate lookup) check the role
  app-side before querying.

## Target 1: admin server actions

Mock `@/lib/supabase/server` (`createServerSupabase`, `getAdminRoles`),
`@/lib/supabase/admin` (`createAdminClient`), `next/cache` (`revalidatePath`). The fake
session client records every `rpc()` and `from()` call. Errors the RPC raises are
simulated as `{ error: { message: "missing_role" } }`, exactly what PostgREST returns
for a `raise exception`. Expected Georgian messages come from `mapFunnelError` /
`GENERIC_FUNNEL_ERROR` (never retyped).

Most sensitive (full matrix):

| Action | Rules tested |
| --- | --- |
| `grantRoleAction` | invalid uuid / unknown role rejected before any client; unauthenticated → not_authenticated message, no revalidate; wrong role → missing_role message, no revalidate; valid → exactly `admin_grant_role {p_user_id, p_role}` via session client, revalidates `/admin/admins`; never touches service role |
| `revokeRoleAction` | same, plus `last_super_admin` refusal surfaced as its own message and nothing revalidated |
| `recordPaymentAction` | bad amount / future date / bad uuid rejected before any client; unauth / wrong role refused; valid → `admin_record_payment` with exact args (empty bank ref → null) |
| `voidPaymentAction` | short reason / non-integer id rejected before any client; unauth / wrong role refused; valid → `admin_void_payment` exact args |
| `revealPersonalIdAction` | non-uuid rejected before any client; unauth / wrong role → error, and NO personal ID in the result; super_admin → `admin_reveal_personal_id` and the ID returned |

Remaining actions (role refusal + validation, plus the call shape): `findAdminCandidateAction`,
`lookupMemberAction`, `previewBulkAction`, `confirmBulkAction` (app-side role gate where
present: no query made for a non-allowed role), `updateGraceDaysAction`,
`reassignMemberAction`, `approveDelegateAction`, `rejectDelegateAction`,
`revealApplicantIdAction`, `updateDelegateProfileAction` (service role never created for a
wrong role), news/events/polls actions incl. `setNewsCoverAction` (service role never
created for a wrong role).

Audit: the action cannot write `audit_log` itself (the RPC does, ADR-014). So the
action tests assert the exact RPC call, and `schema-guards.test.ts` gains a static guard
over the LAST migration definition of every admin RPC the app calls: session check, the
exact role set, the role check precedes the first write, an `audit_log` insert exists;
`admin_revoke_role` keeps the serialized last-super_admin guard before its delete;
`admin_export_members` keeps the super_admin-only ID gate. A coverage check makes the
table fail if an action starts calling an RPC the table does not list.

## Target 2: `members/export/route.ts`

- anonymous (no roles), verifier, editor → 403, no Supabase client created, no RPC.
- finance → 200 CSV, `p_include_ids: false`, no personal-ID header; a personal ID the RPC
  might still return never reaches the CSV.
- finance with `includeIds=1` → 403, no RPC (the ID column is super_admin-only).
- super_admin with `includeIds=1` → `p_include_ids: true`, ID header present (header text
  from `memberExportHeaders`).
- formula injection: a member named `=HYPERLINK(...)` comes out neutralized
  (`csvEscape`), phones like `+995...` untouched.
- RPC error → 500 with no detail leaked.

## Target 3: `app/api/dev/otp/route.ts`

- New: the FIRST guard. For `production` (incl. with the Supabase URL pointed at a
  production project), `staging`, `test`, unset, empty, and case variants
  (`Preview`, `DEVELOPMENT`) → 404 with the standard not-found body, and
  `createAdminClient` never called.
- Remove the two status-variant tests (completed, active_member) that walk the same
  "profile row exists" branch as the registered-account test; keep that one.

## Target 4: `lib/security/schema-guards.test.ts`

- F5 ("no view is writable by a client role") stops reading the frozen 24-view
  `live-objects.json` snapshot. Its view list becomes: every view the migrations
  create (and do not drop), unioned with the reviewed list in
  `scripts/production-security-view-access.json`.
- The replay becomes order-aware for view lifecycle: `create view` (or
  `create or replace` of a view that does not exist) resets the view to Supabase's
  default ALL for client roles; `drop view` removes it. So a view dropped and
  recreated after its revoke is caught (the old "a revoke exists somewhere" guard could
  not see order).
- Assert coverage includes `admin_support_messages`; delete the weaker duplicate
  describe block, the snapshot loading and the `LIVE_VIEWS.length === 24` pin.
- Prove the guard catches a late `grant insert on admin_support_messages to anon` and a
  drop/recreate after the revoke, by appending synthetic statements in memory (real
  migrations untouched). These stay as permanent "guard the guard" tests.

## Verify

New/changed tests green; full vitest run; tsc; eslint; prettier --check; next build;
ka:scan (mixed-script scan + ka-gate on changed files). Push branch; no PR.
