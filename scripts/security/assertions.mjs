/**
 * Task 6: the named assertions — everything the twelve-verdict grid cannot
 * carry.
 *
 * ## Why this file has to exist
 *
 * lib/security/verdict.ts judges a GRANT-layer question: was this actor's
 * statement permitted, or refused. That is the right question for a census —
 * it is the one an attacker with the anon key actually asks first — but it
 * has a blind spot that is precisely where this schema keeps most of its
 * defences. Read judge():
 *
 *   allow + no error                      -> clear, row count NOT consulted
 *   deny  + no error + 0 rows             -> needs-live-proof
 *   deny  + no error + rows               -> finding
 *
 * So "the statement ran and correctly returned nothing" is inexpressible: as
 * `allow` it clears whether or not the row filter worked, and as `deny` it
 * can never resolve. Nine of this schema's sixteen tables and eleven of its
 * twenty-four views sit in exactly that shape — the GRANT is permissive (see
 * the report on Supabase's default privileges) and a row-level predicate is
 * the only thing standing. Graded by the grid alone, a row policy that
 * silently stopped filtering would read as `clear` across the whole column.
 *
 * Every assertion below therefore states an expected ROW SET, per actor, and
 * checks it. They are recorded by name in docs/security/row-scope.json,
 * reported in docs/security/coverage.md, and NEVER folded into a verdict —
 * two different questions, two different records.
 *
 * ## Three families
 *
 *   ownership  — for every table whose policy scopes reads to the caller,
 *                read it UNFILTERED as each actor and check that every row
 *                that came back belongs to that actor. This is the check the
 *                brief singles out for admin_roles ("a broken policy letting
 *                one actor read another actor's admin row would be graded
 *                clear — you own detecting that"); it costs nothing to run it
 *                for the other five own-row tables too, so it does.
 *
 *   visibility — the self-gating views. Each admin_ view carries its own
 *                `has_any_admin_role(...)` predicate and each member_ view an
 *                `is_completed_member()` / `is_registered()` one; the
 *                assertion states, per view per actor, whether rows are
 *                supposed to come back at all. Read from the LIVE view
 *                definitions, not from the migration that first created them:
 *                member_event_going_counts was re-created in
 *                20260721120000_progressive_registration.sql:606 with
 *                is_registered() in place of is_completed_member(), and
 *                grading it against the older text would have manufactured a
 *                false finding against A3.
 *
 *   escalation — the writes that would end the audit if they worked: granting
 *                an admin role, recording a payment (which is what promotes a
 *                member to active_member), opening a membership. Every one is
 *                permitted at the grant layer on this instance and refused
 *                only by RLS having no INSERT policy, so "refused" is a live
 *                fact worth re-establishing on every run rather than a
 *                structural reading. All three aim at A3 (an audit-owned
 *                fixture) so a landed write is both obvious and disposable.
 *
 * ## The two service-role control checks at the end
 *
 * `audit_log_immutable` and `enforce_delegate_completed` are triggers no
 * client role can currently reach — RLS and the absence of an INSERT policy
 * stop the statement before either fires. That makes their per-actor verdicts
 * honest ("the layer in front is what is holding") but leaves the triggers
 * themselves untested, and a defence that never fires is indistinguishable
 * from one that is absent. Both are therefore exercised once, deliberately,
 * with the SERVICE role — which is not, and is never presented as, a probe
 * actor: it is the only caller that can get past the layer in front, and the
 * question being asked is "does this trigger work", not "who can reach it".
 * Both attempts are content-neutral or self-cleaning: the audit_log update
 * writes the value the row already holds, and the delegates insert is deleted
 * again if it ever succeeds (which would itself be the finding).
 */
import { db } from "./db.mjs";
import { actorClient, auditTeamMember } from "./actors.mjs";

const ACTORS_ALL = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"];

/** Actors with a completed registration (registration_completed_at set). */
const COMPLETED = ["A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"];

/** Actors with a profiles row at all (is_registered()). */
const REGISTERED = ["A3", ...COMPLETED];

/**
 * Which actors each self-gating view is supposed to return rows to, read off
 * the LIVE view definitions (pg_get_viewdef, 2026-07-25).
 */
const VIEW_VISIBILITY = {
  // has_admin_role('super_admin')
  admin_admins: ["A9"],
  admin_audit: ["A9"],
  admin_settings: ["A9"],
  // has_any_admin_role('super_admin', 'verifier')
  admin_delegate_queue: ["A9", "A10"],
  // has_any_admin_role('super_admin', 'finance')
  admin_payments: ["A9", "A11"],
  admin_finance_stats: ["A9", "A11"],
  // has_any_admin_role('super_admin', 'verifier', 'finance')
  admin_overview: ["A9", "A10", "A11"],
  admin_region_stats: ["A9", "A10", "A11"],
  admin_members: ["A9", "A10", "A11"],
  // has_any_admin_role('super_admin', 'editor')
  admin_news: ["A9", "A12"],
  admin_events: ["A9", "A12"],
  admin_polls: ["A9", "A12"],
  admin_poll_options: ["A9", "A12"],
  // is_completed_member()
  member_news: COMPLETED,
  member_polls: COMPLETED,
  member_poll_options: COMPLETED,
  poll_option_counts: COMPLETED,
  // is_registered() — NOT is_completed_member(); replaced in
  // 20260721120000_progressive_registration.sql:606
  member_event_going_counts: REGISTERED,
};

/** Tables whose policy scopes reads to the caller, and the column that says so. */
const OWNERSHIP = {
  admin_roles: { column: "user_id", select: "user_id,role" },
  profiles: { column: "id", select: "id,first_name,status" },
  memberships: { column: "member_id", select: "id,member_id,delegate_id,ended_at" },
  payments: { column: "member_id", select: "id,member_id,amount_gel,paid_at" },
  event_rsvps: { column: "member_id", select: "event_id,member_id,status" },
  poll_votes: { column: "member_id", select: "poll_id,option_id,member_id" },
};

const row = (assertion, actor, expected, observed, ok) => ({
  assertion,
  actor,
  expected,
  observed,
  ok,
});

async function ownershipAssertions(clients, actorIds) {
  const out = [];
  for (const [table, { column, select }] of Object.entries(OWNERSHIP)) {
    await Promise.all(
      ACTORS_ALL.map(async (actor) => {
        const own = actorIds[actor];
        const { data, error } = await clients[actor].from(table).select(select).limit(200);
        if (error) {
          out.push(
            row(
              `${table}.cross-actor`,
              actor,
              "no row belonging to another user",
              `refused ${error.code}`,
              true,
            ),
          );
          return;
        }
        const rows = data ?? [];
        const foreign = rows.filter((r) => r[column] !== own);
        out.push(
          row(
            `${table}.cross-actor`,
            actor,
            "no row belonging to another user",
            `${rows.length} row(s), ${foreign.length} belonging to someone else`,
            foreign.length === 0,
          ),
        );
      }),
    );
  }
  return out;
}

async function personalIdAssertions(clients) {
  return Promise.all(
    ACTORS_ALL.map(async (actor) => {
      const { data, error } = await clients[actor]
        .from("profiles")
        .select("id,personal_id,birth_date")
        .limit(5);
      if (error) {
        return row(
          "profiles.personal-id-lockdown",
          actor,
          "refused, or zero rows",
          `refused ${error.code}`,
          true,
        );
      }
      const n = data?.length ?? 0;
      return row(
        "profiles.personal-id-lockdown",
        actor,
        "refused, or zero rows",
        `${n} row(s) carrying personal_id/birth_date`,
        n === 0,
      );
    }),
  );
}

async function visibilityAssertions(clients) {
  const out = [];
  for (const [view, visibleTo] of Object.entries(VIEW_VISIBILITY)) {
    await Promise.all(
      ACTORS_ALL.map(async (actor) => {
        const shouldSee = visibleTo.includes(actor);
        const { data, error } = await clients[actor].from(view).select("*").limit(5);
        const expected = shouldSee ? ">= 1 row" : "0 rows (or refused)";
        if (error) {
          // A refusal is fine where nothing was supposed to be visible, and a
          // real over-restriction where it was.
          return void out.push(
            row(`${view}.visibility`, actor, expected, `refused ${error.code}`, !shouldSee),
          );
        }
        const n = data?.length ?? 0;
        out.push(
          row(`${view}.visibility`, actor, expected, `${n} row(s)`, shouldSee ? n > 0 : n === 0),
        );
      }),
    );
  }
  return out;
}

async function escalationAssertions(clients, actorIds) {
  const target = actorIds.A3;
  const today = new Date().toISOString().slice(0, 10);
  const attempts = {
    "escalation.admin_roles-insert": (client) =>
      client.from("admin_roles").insert({ user_id: target, role: "super_admin" }).select("user_id"),
    "escalation.payments-insert": (client) =>
      client
        .from("payments")
        .insert({
          member_id: target,
          amount_gel: 10,
          paid_at: today,
          tier_gel_at_payment: 10,
          source: "manual",
        })
        .select("id"),
    "escalation.memberships-insert": (client) =>
      client.from("memberships").insert({ member_id: target, delegate_id: null }).select("id"),
  };

  const out = [];
  for (const [name, attempt] of Object.entries(attempts)) {
    await Promise.all(
      ACTORS_ALL.map(async (actor) => {
        const { data, error } = await attempt(clients[actor]);
        const wrote = (data?.length ?? 0) > 0;
        out.push(
          row(
            name,
            actor,
            "refused; no row created",
            error ? `refused ${error.code}` : `${data?.length ?? 0} row(s) CREATED`,
            !!error && !wrote,
          ),
        );
      }),
    );
  }
  return out;
}

/**
 * The one client-reachable trigger, proven on the path that reaches it: the
 * audit's own team-member fixture updates its OWN employment to the value it
 * already holds, and updated_at must move. Uses the fixture rather than one
 * of the twelve because it is the only completed-member account the audit
 * owns outright — A9-A12 are the canonical staging admins and are not this
 * pass's to mutate.
 */
async function updatedAtAssertion() {
  const fixture = auditTeamMember();
  const client = actorClient(fixture.accessToken);
  const before = await db
    .from("profiles")
    .select("employment, updated_at")
    .eq("id", fixture.userId)
    .single();
  if (before.error) throw before.error;

  const { error } = await client
    .from("profiles")
    .update({ employment: before.data.employment })
    .eq("id", fixture.userId);
  if (error) {
    return [
      row(
        "trigger:profiles_updated_at.fires",
        "team-member fixture",
        "own-row update permitted, updated_at advances",
        `own-row update REFUSED ${error.code}`,
        false,
      ),
    ];
  }
  const after = await db.from("profiles").select("updated_at").eq("id", fixture.userId).single();
  if (after.error) throw after.error;
  const moved = new Date(after.data.updated_at) > new Date(before.data.updated_at);
  return [
    row(
      "trigger:profiles_updated_at.fires",
      "team-member fixture",
      "own-row update permitted, updated_at advances",
      moved ? "updated_at advanced" : "updated_at UNCHANGED",
      moved,
    ),
  ];
}

/**
 * protect_profile_columns guards status/personal_id/phone/id/created_at. The
 * assertion is that no client role can even NAME those columns in an UPDATE:
 * 20260715213000_cabinets.sql:10 grants UPDATE on exactly five columns and
 * none of them is protected, so the column-privilege layer refuses before the
 * trigger is reached. Run as the team-member fixture against its OWN row —
 * the only combination where RLS would let the write through, so a refusal
 * here isolates the column grant as the layer holding.
 */
async function protectedColumnAssertion() {
  const fixture = auditTeamMember();
  const client = actorClient(fixture.accessToken);
  const { data, error } = await client
    .from("profiles")
    .update({ status: "active_member" })
    .eq("id", fixture.userId)
    .select("id");
  const wrote = (data?.length ?? 0) > 0;
  return [
    row(
      "trigger:profiles_protect_columns.unreachable",
      "team-member fixture",
      "own-row status update refused (column privilege) — trigger never reached",
      error ? `refused ${error.code}: ${error.message}` : `${data?.length ?? 0} row(s) UPDATED`,
      !!error && !wrote,
    ),
  ];
}

/** Service-role control check: does audit_log_immutable actually raise? */
async function auditLogTriggerAssertion(fixtures) {
  const { error } = await db
    .from("audit_log")
    .update({ action: fixtures.auditAction })
    .eq("id", fixtures.auditId);
  const raised = error?.message === "audit_log is append-only";
  return [
    row(
      "trigger:audit_log_no_update.fires",
      "service role (control check, not a probe actor)",
      "raises 'audit_log is append-only'",
      error ? `${error.code}: ${error.message}` : "UPDATE SUCCEEDED",
      raised,
    ),
  ];
}

/** Service-role control check: does enforce_delegate_completed actually raise? */
async function delegateTriggerAssertion(actorIds) {
  // A3 is registered but has no registration_completed_at, so the trigger
  // must refuse. Self-cleaning: if it does NOT refuse, the row is removed
  // immediately and the assertion fails.
  const { data, error } = await db
    .from("delegates")
    .insert({
      id: actorIds.A3,
      referral_code: `SECAUDIT-TRIGGER-${Date.now()}`,
      tc_accepted_at: new Date().toISOString(),
    })
    .select("id");
  const raised = error?.message === "delegate_requires_completed_member";
  if (!error && (data?.length ?? 0) > 0) {
    await db.from("delegates").delete().eq("id", actorIds.A3);
  }
  return [
    row(
      "trigger:delegates_require_completed.fires",
      "service role (control check, not a probe actor)",
      "raises 'delegate_requires_completed_member'",
      error ? `${error.code}: ${error.message}` : "INSERT SUCCEEDED (row removed again)",
      raised,
    ),
  ];
}

export async function runRowScopeAssertions({ clients, actorIds, fixtures }) {
  const groups = await Promise.all([
    ownershipAssertions(clients, actorIds),
    personalIdAssertions(clients),
    visibilityAssertions(clients),
    escalationAssertions(clients, actorIds),
    updatedAtAssertion(),
    protectedColumnAssertion(),
    auditLogTriggerAssertion(fixtures),
    delegateTriggerAssertion(actorIds),
  ]);
  return groups.flat();
}
