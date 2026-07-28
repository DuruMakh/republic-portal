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
 * Every family below that accepts an error as a pass is pinned to SQLSTATE
 * 42501 (see DENIED_BY_PRIVILEGE). Grading on "any error" would let a renamed
 * column, a typo'd filter or a throttled connection pass silently as a
 * defence — the same shape, and the same direction, as the `select *` probe
 * defect this pass had to fix.
 *
 * ## Six families
 *
 *   ownership  — for every table whose policy scopes reads to the caller,
 *                read it UNFILTERED as each actor and check that every row
 *                that came back belongs to that actor. This is the check the
 *                brief singles out for admin_roles ("a broken policy letting
 *                one actor read another actor's admin row would be graded
 *                clear — you own detecting that"); it costs nothing to run it
 *                for the other five own-row tables too, so it does.
 *
 *   sealed     — the same blind spot on the three tables that have no owner
 *                column because no client is meant to see ANY row: audit_log,
 *                dev_otp_inbox, app_settings. RLS on, zero policies, full
 *                default privileges. See SEALED_BY_RLS.
 *
 *   personalId — the two profiles columns outside the authenticated grant.
 *
 *   public     — the six world-readable views, where the COLUMN LIST and the
 *                WHERE clause are the entire defence and a verdict expresses
 *                neither. Two checks: no private column ever appears, and each
 *                filter withholds what it should (counts only, both sides).
 *                A filter with nothing to withhold in today's data is recorded
 *                `unproven` rather than passing — see publicFilterAssertions.
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
 * ## The control checks at the end
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
 *
 * Two more use the audit's own team-member fixture rather than the service
 * role, because the path being tested is a CLIENT path: set_updated_at fires
 * on the one own-row update a client may make, and protect_profile_columns is
 * shown to be unreachable even from the row's own owner (the column grant
 * refuses first). `protect_profile_columns` is nonetheless functional — proven
 * once by hand with a rolled-back SET LOCAL ROLE anon, quoted in
 * docs/security/coverage.md §4.1; it needs a direct database connection, which
 * this runner deliberately does not have.
 */
import { db, url, anonKey } from "./db.mjs";
import { actorClient, auditTeamMember } from "./actors.mjs";
import { AUDIT_ACTIONS } from "./arguments.mjs";

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

/**
 * Tables whose entire security content is "returns nothing to any client".
 *
 * All four have RLS enabled, ZERO policies, and full default privileges for
 * both `anon` and `authenticated` — so the statement runs, the row rule
 * matches nothing, and the census grades `allow` + `clear` without ever
 * consulting the row count. That is the same blind spot the admin_roles
 * assertion exists to close, and it applies here with more force: on
 * admin_roles a broken policy leaks one role row, on dev_otp_inbox it leaks
 * live sign-in codes in clear text. Adding a single permissive policy to any
 * of these would leave the 684-cell census entirely green.
 */
const SEALED_BY_RLS = {
  audit_log: "id,created_at,action",
  dev_otp_inbox: "id,created_at",
  app_settings: "key,updated_at",
  // delegates is deliberately absent: its SELECT grant IS revoked, so the
  // grid already carries a real 42501 refusal for all twelve and there is no
  // blind spot to close.
};

/**
 * The one error code that means "a real privilege check turned this caller
 * away" — the same constant lib/security/verdict.ts grades on.
 *
 * Every assertion below that accepts an error as a pass pins it to this code.
 * Grading on `!!error` would let a renamed column, a typo'd table or a
 * malformed filter pass silently as a defence — structurally the same defect
 * as the `select *` probe this pass had to fix, and in the same direction:
 * quiet, and reassuring.
 */
const DENIED_BY_PRIVILEGE = "42501";

const row = (assertion, actor, expected, observed, ok, extra = {}) => ({
  assertion,
  actor,
  expected,
  observed,
  ok,
  ...extra,
});

/** True only for a genuine privilege refusal — never for any other error. */
const isRefusal = (error) => error?.code === DENIED_BY_PRIVILEGE;

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
              `no row belonging to another user (a refusal must be ${DENIED_BY_PRIVILEGE})`,
              `refused ${error.code}: ${error.message}`,
              isRefusal(error),
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
            `no row belonging to another user (a refusal must be ${DENIED_BY_PRIVILEGE})`,
            `${rows.length} row(s), ${foreign.length} belonging to someone else`,
            foreign.length === 0,
          ),
        );
      }),
    );
  }
  return out;
}

/**
 * The three RLS-only tables: every actor must come away with nothing. Unlike
 * the ownership family there is no owner column to check — no client is
 * supposed to see ANY row — so the assertion is simply zero.
 */
async function sealedAssertions(clients) {
  const out = [];
  for (const [table, select] of Object.entries(SEALED_BY_RLS)) {
    await Promise.all(
      ACTORS_ALL.map(async (actor) => {
        const { data, error } = await clients[actor].from(table).select(select).limit(200);
        if (error) {
          out.push(
            row(
              `${table}.sealed`,
              actor,
              `zero rows (a refusal must be ${DENIED_BY_PRIVILEGE})`,
              `refused ${error.code}: ${error.message}`,
              isRefusal(error),
            ),
          );
          return;
        }
        const n = data?.length ?? 0;
        out.push(
          row(
            `${table}.sealed`,
            actor,
            `zero rows (a refusal must be ${DENIED_BY_PRIVILEGE})`,
            `${n} row(s)`,
            n === 0,
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
          `refused ${DENIED_BY_PRIVILEGE}, or zero rows`,
          `refused ${error.code}: ${error.message}`,
          isRefusal(error),
        );
      }
      const n = data?.length ?? 0;
      return row(
        "profiles.personal-id-lockdown",
        actor,
        `refused ${DENIED_BY_PRIVILEGE}, or zero rows`,
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
            `refused ${DENIED_BY_PRIVILEGE}; no row created`,
            error
              ? `refused ${error.code}: ${error.message}`
              : `${data?.length ?? 0} row(s) CREATED`,
            isRefusal(error) && !wrote,
          ),
        );
      }),
    );
  }
  return out;
}

/**
 * Columns that must never appear in a world-readable view. Six views are
 * granted to `anon` by design and return rows to all twelve actors, so their
 * COLUMN LIST and their WHERE clause are the entire defence — and neither is
 * something a verdict can express. `public_delegates` is the sharpest case:
 * it exists precisely so that `delegates` (which carries referral_code and the
 * whole verification trail) can stay revoked from every client role, and the
 * only thing keeping that promise is which columns the view happens to select.
 */
const NEVER_PUBLIC = [
  "personal_id",
  "birth_date",
  "phone",
  "referral_code",
  "tc_accepted_at",
  "verified_at",
  "verified_by",
  "review_note",
  "pending_delegate_id",
  "signup_ref_code",
];

const PUBLIC_VIEWS = [
  "public_news",
  "public_events",
  "public_delegates",
  "public_stats",
  "transparency_stats",
  "transparency_regions",
];

/** No world-readable view may hand any actor one of the NEVER_PUBLIC columns. */
async function publicColumnAssertions(clients) {
  const out = [];
  for (const view of PUBLIC_VIEWS) {
    await Promise.all(
      ACTORS_ALL.map(async (actor) => {
        const { data, error } = await clients[actor].from(view).select("*").limit(5);
        if (error) {
          out.push(
            row(
              `${view}.no-private-columns`,
              actor,
              `none of: ${NEVER_PUBLIC.join(", ")}`,
              `UNEXPECTEDLY refused ${error.code}: ${error.message}`,
              false,
            ),
          );
          return;
        }
        const keys = new Set((data ?? []).flatMap((r) => Object.keys(r)));
        const leaked = NEVER_PUBLIC.filter((c) => keys.has(c));
        out.push(
          row(
            `${view}.no-private-columns`,
            actor,
            `none of: ${NEVER_PUBLIC.join(", ")}`,
            leaked.length
              ? `LEAKED ${leaked.join(", ")}`
              : `${keys.size} public column(s), none private`,
            leaked.length === 0,
          ),
        );
      }),
    );
  }
  return out;
}

/**
 * Do the world-readable views' WHERE clauses actually filter?
 *
 * Each view's row count as `anon` is compared against a service-role COUNT of
 * the rows that are supposed to pass. Counts only — no row content is read on
 * either side.
 *
 * A count match alone is weak evidence when everything in the table passes the
 * filter: if every event is published, "the view returns all of them" is what
 * a MISSING filter would also produce. Those cases are recorded with
 * `unproven: true` rather than counted as holding, because the data has no
 * negative case to catch a regression — a fixture gap for a later pass, not a
 * result.
 */
async function publicFilterAssertions(clients) {
  const anon = clients.A1;
  const out = [];

  const viewCount = async (view) => {
    const { count, error } = await anon.from(view).select("*", { count: "exact", head: true });
    if (error) throw new Error(`public filter assertion could not count ${view}: ${error.message}`);
    return count ?? 0;
  };
  const tableCount = async (table, apply = (q) => q) => {
    const { count, error } = await apply(
      db.from(table).select("*", { count: "exact", head: true }),
    );
    if (error)
      throw new Error(`public filter assertion could not count ${table}: ${error.message}`);
    return count ?? 0;
  };

  const filtered = [
    {
      view: "public_news",
      filter: "status = 'published' and visibility = 'public'",
      table: "news",
      apply: (q) => q.eq("status", "published").eq("visibility", "public"),
    },
    {
      view: "public_events",
      filter: "status in ('published', 'cancelled')",
      table: "events",
      apply: (q) => q.in("status", ["published", "cancelled"]),
    },
    {
      view: "public_delegates",
      filter: "status = 'approved'",
      table: "delegates",
      apply: (q) => q.eq("status", "approved"),
    },
  ];

  for (const { view, filter, table, apply } of filtered) {
    const shown = await viewCount(view);
    const shouldShow = await tableCount(table, apply);
    const total = await tableCount(table);
    const withheld = total - shouldShow;
    const matches = shown === shouldShow;
    out.push(
      row(
        `${view}.filter`,
        "anon (A1)",
        `exactly the ${table} rows matching ${filter}`,
        `${shown} shown, ${shouldShow} should be, ${withheld} withheld of ${total}`,
        matches,
        withheld === 0
          ? {
              unproven: true,
              why: `every ${table} row passes this filter today, so a count match is also what a MISSING filter would produce — no negative case in the data`,
            }
          : {},
      ),
    );
  }

  // The two aggregate views have no rows to filter — their figures ARE the
  // claim, so each figure is compared to ground truth.
  //
  // The ground-truth predicates below are read from the LIVE view definitions
  // (pg_get_viewdef), not from the migrations, and they differ: the community
  // migration counts `status <> 'draft'`, but `draft` is no longer a
  // member_status label at all (live enum: registered, profile_completed,
  // active_member) and the R2 migration re-created all three views. Today
  // public_stats.registered_total counts EVERY profile while
  // transparency_stats.registered_members counts `status <> 'registered'`.
  // Grading either against the migration text would have produced a false
  // finding — the same trap member_event_going_counts set earlier in this pass.
  const activeMembers = await tableCount("profiles", (q) => q.eq("status", "active_member"));
  const allProfiles = await tableCount("profiles");
  const pastRegistered = await tableCount("profiles", (q) => q.neq("status", "registered"));
  const stillRegistered = allProfiles - pastRegistered;
  const approvedDelegates = await tableCount("delegates", (q) => q.eq("status", "approved"));

  const { data: statsRows, error: statsError } = await anon.from("public_stats").select("*");
  if (statsError) throw new Error(`could not read public_stats: ${statsError.message}`);
  const stats = statsRows?.[0] ?? {};
  const statsOk =
    stats.active_members === activeMembers &&
    stats.approved_delegates === approvedDelegates &&
    stats.registered_total === allProfiles;
  out.push(
    row(
      "public_stats.figures",
      "anon (A1)",
      `active=${activeMembers}, approved_delegates=${approvedDelegates}, registered_total=${allProfiles}`,
      `active=${stats.active_members}, approved_delegates=${stats.approved_delegates}, registered_total=${stats.registered_total}`,
      statsOk,
    ),
  );

  const { data: transRows, error: transError } = await anon.from("transparency_stats").select("*");
  if (transError) throw new Error(`could not read transparency_stats: ${transError.message}`);
  const trans = transRows?.[0] ?? {};
  const transOk =
    trans.registered_members === pastRegistered && trans.approved_delegates === approvedDelegates;
  out.push(
    row(
      "transparency_stats.figures",
      "anon (A1)",
      `registered_members=${pastRegistered} (status <> 'registered'), approved_delegates=${approvedDelegates}`,
      `registered_members=${trans.registered_members}, approved_delegates=${trans.approved_delegates}`,
      transOk,
      stillRegistered === 0
        ? {
            unproven: true,
            why: "no profile is still at status 'registered', so the exclusion this figure applies has no negative case to catch a regression",
          }
        : {},
    ),
  );

  // transparency_regions: one row per region, and `members` must exclude
  // profiles still at status 'registered'. That population is the negative case.
  const regionCount = await tableCount("regions");
  const regionRows = await viewCount("transparency_regions");
  out.push(
    row(
      "transparency_regions.filter",
      "anon (A1)",
      `${regionCount} region row(s), 'registered' excluding profiles at status 'registered'`,
      `${regionRows} row(s); ${stillRegistered} profile(s) at status 'registered' available as a negative case`,
      regionRows === regionCount,
      stillRegistered === 0
        ? {
            unproven: true,
            why: "no profile is still at status 'registered', so the exclusion has no negative case to catch a regression",
          }
        : {},
    ),
  );

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

/**
 * Groups run SEQUENTIALLY, not under one Promise.all.
 *
 * They were parallel until the public-view families were added, at which point
 * the suite fired ~500 requests at once and PostgREST started returning
 * errors with an EMPTY message — a transport failure, not a verdict. That is
 * the worst possible failure mode for this file: every family here treats an
 * error as evidence, so a throttled connection would have been indistinguish-
 * able from a defence refusing. (The `isRefusal` pin added alongside this
 * turns such a failure into a loud assertion FAILURE rather than a silent
 * pass, but not generating it in the first place is better still.) The
 * twelve-actor fan-out inside each family stays parallel; the census is not a
 * hot path and correctness beats the few seconds.
 */
// ===========================================================================
// Task 7 families — the four questions a per-actor verdict structurally
// cannot carry for the 54 database functions.
// ===========================================================================

/** The highest audit_log id right now. Read BEFORE the matrix runs. */
export async function auditLogHighWaterMark() {
  const { data, error } = await db
    .from("audit_log")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`audit_log high-water mark read failed: ${error.message}`);
  return data?.id ?? 0;
}

/**
 * THE AUDIT-LOG INVARIANT. A function that mutates admin-visible state without
 * leaving an audit_log row is a finding regardless of its access control —
 * the platform's whole accountability story (spec §3.7) is that every admin
 * act is attributable afterwards.
 *
 * Checked against what the census ACTUALLY did rather than by re-invoking
 * anything: every admin_* cell that came back with no error is a completed
 * admin act, so the matching row must exist, carry the action string that
 * function writes, and name the calling actor as actor_id. Reading the whole
 * post-baseline slice once (one query) also means a function that wrote SOME
 * OTHER action, or wrote it under the wrong actor_id, fails here rather than
 * passing on a count.
 */
/**
 * Actions a function writes BESIDES the one AUDIT_ACTIONS names for it — read
 * off the live bodies, not guessed.
 *
 * There is exactly one: `admin_record_payments_bulk` writes a
 * `payment.record` row PER BATCH ROW as well as its own `payment.bulk_record`
 * summary. That collides with `admin_record_payment`'s only action, and the
 * collision is not cosmetic: matching on `(action, actor_id)` alone, an
 * `admin_record_payment` that had stopped writing its audit row entirely would
 * still have "passed" on a row the BULK function wrote — the one shape of
 * failure this whole family exists to catch, invisible to it.
 */
const ALSO_WRITES = { admin_record_payments_bulk: ["payment.record"] };

/**
 * How to tell two functions' rows apart when they share an action string.
 * Both bulk actions stamp `details.batchId`; the single-payment path never
 * does (verified against both live bodies).
 */
const DISCRIMINATOR = {
  admin_record_payment: (r) => r.details?.batchId === undefined,
  admin_record_payments_bulk: (r) => r.details?.batchId !== undefined,
};

async function auditLogInvariantAssertions(baselineId, ledgerRows, surfaceById, actorIds) {
  const { data, error } = await db
    .from("audit_log")
    .select("id, actor_id, action, details")
    .gt("id", baselineId)
    .order("id");
  if (error) throw new Error(`audit_log slice read failed: ${error.message}`);
  const written = data ?? [];

  const out = [];

  // Guard the guard: any action string one function writes as a side effect of
  // another's name MUST carry a discriminator, or this family silently grades
  // one function on another's evidence. Checked here rather than asserted in a
  // comment, so a future function that starts writing a shared action fails
  // loudly instead of quietly weakening the invariant.
  for (const [owner, action] of Object.entries(AUDIT_ACTIONS)) {
    const alsoWrittenBy = Object.entries(ALSO_WRITES)
      .filter(([other, actions]) => other !== owner && actions.includes(action))
      .map(([other]) => other);
    if (alsoWrittenBy.length === 0) continue;
    const guarded = Boolean(DISCRIMINATOR[owner]) && alsoWrittenBy.every((o) => DISCRIMINATOR[o]);
    out.push(
      row(
        "audit-log-invariant.no-shared-action-without-discriminator",
        owner,
        `'${action}' is also written by ${alsoWrittenBy.join(", ")}; both sides need a discriminator`,
        guarded
          ? "discriminated on details.batchId"
          : "NO DISCRIMINATOR — rows are interchangeable",
        guarded,
      ),
    );
  }

  for (const cell of ledgerRows) {
    const surface = surfaceById.get(cell.surfaceId);
    if (!surface || surface.kind !== "function") continue;
    const action = AUDIT_ACTIONS[surface.name];
    if (!action) continue; // not an audit-writing function; nothing to assert
    if (cell.outcome.errorCode !== null) continue; // the call never completed

    const uid = actorIds[cell.actor];
    const discriminate = DISCRIMINATOR[surface.name] ?? (() => true);
    const hit = written.find((r) => r.action === action && r.actor_id === uid && discriminate(r));
    out.push(
      row(
        `${surface.id}.writes-audit-log`,
        cell.actor,
        `a completed call leaves audit_log(action='${action}', actor_id=caller)` +
          (DISCRIMINATOR[surface.name]
            ? ", not another function's row carrying the same action"
            : ""),
        hit ? `audit_log #${hit.id}` : "NO MATCHING audit_log ROW",
        Boolean(hit),
      ),
    );
  }

  // A vacuous pass is not a pass: if no admin call succeeded this run there is
  // nothing to have audited, and that must be visible rather than silent.
  if (out.length === 0) {
    out.push(
      row(
        "audit-log-invariant",
        "all",
        "at least one completed admin call to check",
        "no admin_* cell completed this run",
        true,
        {
          unproven: true,
          why: "no admin function completed for any actor, so the invariant was never exercised",
        },
      ),
    );
  }
  return out;
}

/**
 * THE FOUR `returns trigger` FUNCTIONS. Task 4 left these as a candidate
 * finding: nothing revokes EXECUTE on any of them. The live proacl on all four
 * is `=X/postgres | postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres`
 * -- the leading `=X/postgres` is the PUBLIC default, and `anon` and
 * `authenticated` each hold an EXPLICIT grant on top of it, so the eventual
 * hygiene fix has to name all three (`revoke ... from public, anon,
 * authenticated`); a PUBLIC-only revoke would change nothing for a client.
 * On paper, then, `anon` holds real, unrevoked,
 * database-level permission to call them, and only PostgREST's schema-cache
 * filtering — "a gateway behaviour, not a database control" — was standing in
 * the way.
 *
 * This family settles the client half: every route PostgREST exposes, from
 * every actor. The database half cannot be asked from a PostgREST client at
 * all and was settled separately, by running `select public.set_updated_at()`
 * on a direct connection as the `postgres` superuser — it fails with `trigger
 * functions can only be called as triggers`, which is the PL/pgSQL call
 * handler refusing a trigger-returning function in any non-trigger context,
 * for any role, grant or no grant. Recorded in .superpowers/sdd/task-7-report.md
 * with the command and its output.
 */
const TRIGGER_FUNCTIONS = [
  "audit_log_immutable",
  "enforce_delegate_completed",
  "protect_profile_columns",
  "set_updated_at",
];

async function triggerFunctionAssertions(clients) {
  const out = [];
  for (const fn of TRIGGER_FUNCTIONS) {
    await Promise.all(
      ACTORS_ALL.map(async (actor) => {
        const { error } = await clients[actor].rpc(fn, {});
        out.push(
          row(
            `function:${fn}.no-rpc-route`,
            actor,
            "POST /rpc — not routable (PGRST202); a trigger function is not an RPC surface",
            error ? `${error.code}` : "CALL SUCCEEDED",
            error?.code === "PGRST202",
          ),
        );
      }),
    );
    // The other route PostgREST offers. Probed anonymously — the weakest
    // caller is the one that matters for "can anything reach this".
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "GET",
      headers: { apikey: anonKey },
    });
    const body = await res.text();
    out.push(
      row(
        `function:${fn}.no-rpc-route`,
        "A1 (GET route)",
        "GET /rpc — not routable either (404 PGRST202)",
        `${res.status} ${body.slice(0, 40)}`,
        res.status === 404 && body.includes("PGRST202"),
      ),
    );
  }
  return out;
}

/**
 * THE SIX HELPERS' ANSWERS, not just their reachability. `has_admin_role` is
 * consulted by 26 of the 48 gatekeepers; if it ever answered `true` for the
 * wrong caller, every one of them would open at once and no amount of probing
 * the DOORS would show it — each door would simply report "allowed", exactly
 * as an allow expectation predicts. So the helper is graded against ground
 * truth read service-side from admin_roles, per actor, per role.
 */
async function helperTruthAssertions(clients, actorIds) {
  const { data, error } = await db.from("admin_roles").select("user_id, role");
  if (error) throw new Error(`admin_roles ground-truth read failed: ${error.message}`);
  const held = new Map();
  for (const r of data ?? []) {
    if (!held.has(r.user_id)) held.set(r.user_id, new Set());
    held.get(r.user_id).add(r.role);
  }

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, registration_completed_at");
  if (profileError) throw new Error(`profiles ground-truth read failed: ${profileError.message}`);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const ROLES = ["super_admin", "verifier", "finance", "editor"];
  const out = [];
  await Promise.all(
    ACTORS_ALL.map(async (actor) => {
      const uid = actorIds[actor];
      const mine = held.get(uid) ?? new Set();

      for (const role of ROLES) {
        const { data: answer, error: callError } = await clients[actor].rpc("has_admin_role", {
          p_role: role,
        });
        const truth = Boolean(uid) && mine.has(role);
        // A1 holds no EXECUTE grant at all, so a refusal is the right answer
        // for it and is graded as such rather than as a wrong boolean.
        const ok = callError ? actor === "A1" && callError.code === "42501" : answer === truth;
        out.push(
          row(
            "function:has_admin_role.answers-truthfully",
            `${actor}/${role}`,
            actor === "A1" ? "refused 42501 (no grant to anon)" : `${truth}`,
            callError ? `refused ${callError.code}` : `${answer}`,
            ok,
          ),
        );
      }

      const { data: anyAnswer, error: anyError } = await clients[actor].rpc("has_any_admin_role", {
        p_roles: ROLES,
      });
      const anyTruth = mine.size > 0;
      out.push(
        row(
          "function:has_any_admin_role.answers-truthfully",
          actor,
          actor === "A1" ? "refused 42501 (no grant to anon)" : `${anyTruth}`,
          anyError ? `refused ${anyError.code}` : `${anyAnswer}`,
          anyError ? actor === "A1" && anyError.code === "42501" : anyAnswer === anyTruth,
        ),
      );

      const profile = profileById.get(uid);
      for (const [fn, truth] of [
        ["is_registered", Boolean(profile)],
        ["is_completed_member", Boolean(profile?.registration_completed_at)],
      ]) {
        const { data: answer, error: callError } = await clients[actor].rpc(fn, {});
        out.push(
          row(
            `function:${fn}.answers-truthfully`,
            actor,
            actor === "A1" ? "refused 42501 (no grant to anon)" : `${truth}`,
            callError ? `refused ${callError.code}` : `${answer}`,
            callError ? actor === "A1" && callError.code === "42501" : answer === truth,
          ),
        );
      }
    }),
  );
  return out;
}

/**
 * `admin_export_members(p_include_ids => true)` — the roster-plus-personal-IDs
 * export, the single most sensitive call in this schema.
 *
 * It cannot be the census cell for that surface. The body admits finance at
 * its primary gate and then raises the SAME `missing_role` token at a second,
 * narrower super_admin-only check (spec decision #6). `missing_role` is a
 * REFUSAL token, so judging A11 (whose surface expectation is correctly
 * `allow`) against that outcome makes judge() assert a finding on behaviour
 * that is exactly right. The census cell therefore probes the `false` variant
 * and the `true` variant is graded here, by name, for all twelve — which is
 * also the only place the distinction is visible as a distinction.
 */
async function exportIncludeIdsAssertions(clients) {
  const args = {
    p_search: "SECAUDIT",
    p_region_id: null,
    p_status: null,
    p_include_ids: true,
  };
  const out = [];
  await Promise.all(
    ACTORS_ALL.map(async (actor) => {
      const { error } = await clients[actor].rpc("admin_export_members", args);
      if (actor === "A9") {
        out.push(
          row(
            "function:admin_export_members.include-ids-super-admin-only",
            actor,
            "super_admin: permitted",
            error ? `refused ${error.code}: ${error.message}` : "permitted",
            !error,
          ),
        );
        return;
      }
      const refused =
        error?.code === "42501" || (error?.code === "P0001" && error.message === "missing_role");
      out.push(
        row(
          "function:admin_export_members.include-ids-super-admin-only",
          actor,
          actor === "A1" ? "refused 42501 (no grant to anon)" : "refused missing_role",
          error ? `${error.code}: ${error.message}` : "PERMITTED — personal IDs exported",
          refused,
        ),
      );
    }),
  );
  return out;
}

export async function runRowScopeAssertions({
  clients,
  actorIds,
  fixtures,
  auditBaselineId,
  ledgerRows,
  surfaceById,
}) {
  const families = [
    () => ownershipAssertions(clients, actorIds),
    () => sealedAssertions(clients),
    () => personalIdAssertions(clients),
    () => visibilityAssertions(clients),
    () => publicColumnAssertions(clients),
    () => publicFilterAssertions(clients),
    () => escalationAssertions(clients, actorIds),
    () => updatedAtAssertion(),
    () => protectedColumnAssertion(),
    () => auditLogTriggerAssertion(fixtures),
    () => delegateTriggerAssertion(actorIds),
    // Task 7
    () => auditLogInvariantAssertions(auditBaselineId, ledgerRows, surfaceById, actorIds),
    () => triggerFunctionAssertions(clients),
    () => helperTruthAssertions(clients, actorIds),
    () => exportIncludeIdsAssertions(clients),
  ];
  const out = [];
  for (const family of families) out.push(...(await family()));
  return out;
}
