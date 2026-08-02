import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Task 12 (the security check-up's fix wave): standing guards for four schema
 * invariants the audit had to establish BY HAND against the live database.
 *
 * Like verdict.tokens-drift.test.ts, these tests are not pure — they read the
 * real migrations. A guard that compared two hand-written lists would only
 * prove the lists agree with each other. What must not drift here is the
 * schema itself, so the schema is what gets read.
 *
 * They are a STATIC model of the applied migrations, not a live check. The
 * live half lives in scripts/verify-security-fixes.mjs, which performs the
 * actual attacks against staging. Both exist deliberately: this one runs in
 * CI on every commit and catches a re-grant the moment it is written; the
 * live one proves the database really is in the state the migrations claim.
 */
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "supabase",
  "migrations",
);

/**
 * The live catalog as introspected in Task 3 (scripts/security/introspect.mjs).
 * The supabase CLI's JSON output is `{ boundary, rows, warning }`, never a
 * bare array — the rows are UNTRUSTED database content and are used here only
 * as object names, never as instructions.
 */
const LIVE_OBJECTS = (
  JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "scripts",
        "security",
        "live-objects.json",
      ),
      "utf8",
    ),
  ) as { rows: ReadonlyArray<{ kind: string; name: string }> }
).rows;

const LIVE_VIEWS = LIVE_OBJECTS.filter((o) => o.kind === "view").map((o) => o.name);

type Priv = "select" | "insert" | "update" | "delete" | "truncate" | "references" | "trigger";
const ALL_PRIVS: readonly Priv[] = [
  "select",
  "insert",
  "update",
  "delete",
  "truncate",
  "references",
  "trigger",
];
const WRITE_PRIVS: readonly Priv[] = ["insert", "update", "delete", "truncate"];
/** The two roles a PostgREST request can ever run as. */
const CLIENT_ROLES = ["anon", "authenticated"] as const;
type ClientRole = (typeof CLIENT_ROLES)[number];

/**
 * Every migration, in the order Postgres applied them (filenames are
 * timestamp-prefixed, so lexical order IS application order).
 */
function migrationsInOrder(): { file: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, sql: readFileSync(join(MIGRATIONS_DIR, file), "utf8") }));
}

/**
 * Statement splitter that survives function bodies. `$$ ... $$` blocks are
 * blanked before splitting on `;`, because a plpgsql body is full of
 * semicolons that are not statement terminators. Line comments go too, so a
 * commented-out grant can never satisfy a guard.
 */
function statements(sql: string): string[] {
  const withoutBodies = sql.replace(/\$\$[\s\S]*?\$\$/g, " BODY ");
  const withoutComments = withoutBodies.replace(/--[^\n]*/g, " ");
  return withoutComments
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
}

interface PrivChange {
  readonly kind: "grant" | "revoke";
  /** Table/view names the statement names. Empty for function/schema grants. */
  readonly objects: string[];
  readonly privileges: Priv[];
  readonly roles: string[];
  /** `grant select (a, b) on t` — scoped to columns, never a table-wide right. */
  readonly columnScoped: boolean;
}

function parsePrivChange(stmt: string): PrivChange | null {
  const m = /^(grant|revoke)\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+(?:to|from)\s+([\s\S]+)$/i.exec(stmt);
  if (!m) return null;
  const [, verb, privPart, objectPart, rolePart] = m as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];
  // execute/usage grants (functions, schemas, sequences) are a different
  // privilege space entirely — out of scope for these relation guards.
  if (/^\s*(execute|usage|create|connect|temporary)\b/i.test(privPart)) return null;
  if (/^\s*(function|schema|sequence|all functions|all sequences)\b/i.test(objectPart)) return null;

  const columnScoped = privPart.includes("(");
  const privileges: Priv[] = /^\s*all\b/i.test(privPart)
    ? [...ALL_PRIVS]
    : ALL_PRIVS.filter((p) => new RegExp(`\\b${p}\\b`, "i").test(privPart));

  const objects = objectPart
    .replace(/\btable\b/gi, "")
    .split(",")
    .map((o) => o.trim().replace(/^public\./i, ""))
    .filter((o) => o.length > 0 && /^[a-z_][a-z0-9_]*$/i.test(o));

  const roles = rolePart
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter((r) => r.length > 0);

  return {
    kind: verb.toLowerCase() as "grant" | "revoke",
    objects,
    privileges,
    roles,
    columnScoped,
  };
}

/**
 * Replays every grant/revoke in migration order and returns the table-wide
 * privileges each client role ends up holding on `object`.
 *
 * Starting state is ALL for anon and authenticated: this is a Supabase
 * project, whose default privileges grant the client roles everything on
 * anything created in `public` (confirmed live in Pass 2/Pass 4 — see
 * .superpowers/sdd/progress.md CF1, and the standing comment at
 * 20260719150000_community.sql:248). Assuming an empty starting state would
 * make every guard here pass vacuously.
 *
 * Column-scoped grants are recorded separately: `grant select (a, b) on t`
 * confers no table-wide privilege, and treating it as one would hide exactly
 * the CF4 shape this file exists to pin.
 */
function effectivePrivileges(object: string): Record<ClientRole, Set<Priv>> {
  const held: Record<ClientRole, Set<Priv>> = {
    anon: new Set(ALL_PRIVS),
    authenticated: new Set(ALL_PRIVS),
  };
  const columns: Record<ClientRole, Set<Priv>> = { anon: new Set(), authenticated: new Set() };

  for (const { sql } of migrationsInOrder()) {
    for (const stmt of statements(sql)) {
      const change = parsePrivChange(stmt);
      if (!change) continue;
      if (!change.objects.includes(object)) continue;
      for (const role of CLIENT_ROLES) {
        // `public` is every role, so a grant to public reaches anon too. A
        // REVOKE from public does NOT remove a role's own explicit grant,
        // which is exactly the trap RF6 recorded — so revokes only count
        // when the role is named.
        const grantHits = change.roles.includes(role) || change.roles.includes("public");
        const revokeHits = change.roles.includes(role);
        if (change.kind === "grant" && grantHits) {
          for (const p of change.privileges) {
            (change.columnScoped ? columns[role] : held[role]).add(p);
          }
        } else if (change.kind === "revoke" && revokeHits) {
          for (const p of change.privileges) {
            held[role].delete(p);
            if (!change.columnScoped) columns[role].delete(p);
          }
        }
      }
    }
  }
  return held;
}

/** Column-scoped privileges only (the second half of effectivePrivileges). */
function effectiveColumnPrivileges(object: string): Record<ClientRole, Set<Priv>> {
  const columns: Record<ClientRole, Set<Priv>> = { anon: new Set(), authenticated: new Set() };
  for (const { sql } of migrationsInOrder()) {
    for (const stmt of statements(sql)) {
      const change = parsePrivChange(stmt);
      if (!change || !change.objects.includes(object)) continue;
      for (const role of CLIENT_ROLES) {
        if (change.kind === "grant" && change.columnScoped && change.roles.includes(role)) {
          for (const p of change.privileges) columns[role].add(p);
        } else if (change.kind === "revoke" && change.roles.includes(role)) {
          for (const p of change.privileges) columns[role].delete(p);
        }
      }
    }
  }
  return columns;
}

/** The last definition of a function wins — `create or replace` supersedes. */
function lastFunctionBody(name: string): string {
  let body = "";
  for (const { sql } of migrationsInOrder()) {
    const re = new RegExp(
      `create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${name}\\s*\\(([\\s\\S]*?)\\$\\$([\\s\\S]*?)\\$\\$`,
      "gi",
    );
    for (const m of sql.matchAll(re)) body = m[2] ?? body;
  }
  return body;
}

describe("F5 / LB-5 — no view in schema public is writable by a client role", () => {
  // The eleven views the Phase-5 community migration never reached. Refused
  // live today only by PostgreSQL's auto-updatability SHAPE rule (55000 =
  // "the security check passed and the planner refused"), never by a security
  // check: drop the cosmetic display join in admin_settings or admin_admins —
  // a routine refactor — and anonymous writes land in app_settings /
  // admin_roles past RLS, because the views are owner-executed with no
  // security_invoker and no WITH CHECK OPTION.
  it.each(LIVE_VIEWS)(
    "%s grants no INSERT/UPDATE/DELETE/TRUNCATE to anon or authenticated",
    (view) => {
      const held = effectivePrivileges(view);
      for (const role of CLIENT_ROLES) {
        const writable = WRITE_PRIVS.filter((p) => held[role].has(p));
        expect(writable, `${role} may still ${writable.join("/")} through view ${view}`).toEqual(
          [],
        );
      }
    },
  );

  it("covers every view the live catalog knows about", () => {
    // Guards the guard: if introspection ever returns nothing, it.each above
    // would silently run zero cases and this file would prove nothing.
    expect(LIVE_VIEWS.length).toBe(24);
  });
});

describe("CF4 / LB-6 — anon holds nothing on profiles", () => {
  // The crown-jewel read. The Phase-3 lockdown named `authenticated` only, so
  // anon kept column SELECT on all seventeen columns including personal_id,
  // birth_date and phone — one RLS predicate deep, where authenticated gets
  // two layers. ADR-021 adopted this revoke INSTEAD of column encryption.
  it("has no table-wide privilege for anon", () => {
    const held = effectivePrivileges("profiles");
    expect([...held.anon].sort()).toEqual([]);
  });

  it("has no column-scoped privilege for anon either", () => {
    const columns = effectiveColumnPrivileges("profiles");
    expect([...columns.anon].sort()).toEqual([]);
  });

  it("keeps authenticated's scoped grants intact (the fix must not be over-broad)", () => {
    const columns = effectiveColumnPrivileges("profiles");
    expect([...columns.authenticated].sort()).toEqual(["select", "update"]);
  });
});

describe("F14 / LB-7 — the two delegate-binding guards are mirrors", () => {
  // 20260722140000 fix #3 narrowed member_change_delegate to status='approved'
  // (only an APPROVED delegate holds no membership) and did not narrow the
  // mirror in admin_reassign_member — so a pending/rejected requester keeps
  // unilateral control of their own binding while the verifier loses theirs,
  // permanently and un-audited. 6 of 19 live delegate rows are already there.
  const delegatesGuard = /from\s+public\.delegates\s+d?\s*where\s+d?\.?id\s*=\s*[^\n]*/i;

  it("member_change_delegate refuses only APPROVED delegates", () => {
    const body = lastFunctionBody("member_change_delegate");
    const guard = delegatesGuard.exec(body)?.[0] ?? "";
    expect(guard).toMatch(/status\s*=\s*'approved'/i);
  });

  it("admin_reassign_member refuses only APPROVED delegates", () => {
    const body = lastFunctionBody("admin_reassign_member");
    const guard = delegatesGuard.exec(body)?.[0] ?? "";
    expect(guard).toMatch(/status\s*=\s*'approved'/i);
  });
});

describe("L3-2 — payments carries append-only protection", () => {
  // payments drives active_member status and every money figure, yet rested
  // on ONE layer (the absence of an RLS write policy) where audit_log has
  // two, and a direct write emitted no audit row. The trigger is the second
  // layer, in the shape audit_log_immutable established.
  const allSql = migrationsInOrder()
    .map((m) => m.sql)
    .join("\n");

  it("has a before-update-or-delete trigger", () => {
    expect(allSql).toMatch(
      /create\s+trigger\s+\w+\s+before\s+update\s+or\s+delete\s+on\s+payments/i,
    );
  });

  it("grants no write privilege to a client role", () => {
    const held = effectivePrivileges("payments");
    for (const role of CLIENT_ROLES) {
      expect(WRITE_PRIVS.filter((p) => held[role].has(p))).toEqual([]);
    }
  });

  it("still lets members read their own billing columns", () => {
    const columns = effectiveColumnPrivileges("payments");
    expect([...columns.authenticated]).toEqual(["select"]);
  });

  it("grants anon nothing at all — not even the table-wide SELECT it was born with", () => {
    // The CF4 shape, on the money table. anon held table-wide SELECT by
    // Supabase default privileges, defended by the single policy "own payments
    // readable" (auth.uid() = member_id) — inert only because anon's uid is
    // null. One predicate deep, which CF4 ruled unacceptable for profiles.
    // Nothing anonymous reads payments: the public money figure comes from
    // transparency_stats, an owner-executed view.
    const held = effectivePrivileges("payments");
    expect([...held.anon].sort()).toEqual([]);
    const columns = effectiveColumnPrivileges("payments");
    expect([...columns.anon].sort()).toEqual([]);
  });

  // The trigger must not stand in front of the ON DELETE CASCADE that
  // threat-model.md:197 records as deliberate (ADR-015). A cascade is performed
  // with the privileges of the REFERENCING table's owner, never the session
  // role, so a role-name exemption cannot reach it.
  const appendOnly = lastFunctionBody("payments_append_only");

  it("lets a DELETE through when the parent profile is already gone (i.e. inside a cascade)", () => {
    expect(appendOnly).toMatch(
      /not\s+exists\s*\(\s*select\s+1\s+from\s+public\.profiles\s+where\s+id\s*=\s*old\.member_id\s*\)/i,
    );
  });

  it("never lets the owner test alone be an escape — it must be followed by the orphan test", () => {
    // The owner test is NOT a blanket owner exemption, and this is the guard
    // that keeps it from decaying into one: an exemption for whoever owns the
    // table would exempt every SECURITY DEFINER function in the schema,
    // present and future. Reaching `return old` must pass the orphan test
    // too, in that order — the owner test is what makes the orphan answer
    // truthful (RLS does not apply to the owner), so it has to come first.
    expect(appendOnly).toMatch(
      /pg_get_userbyid[\s\S]{0,400}?not\s+exists\s*\(\s*select\s+1\s+from\s+public\.profiles\s+where\s+id\s*=\s*old\.member_id\s*\)[\s\S]{0,200}?return\s+old/i,
    );
  });

  it("has exactly ONE way out of the DELETE branch, so the owner test cannot become one", () => {
    // The ordering guard above proves owner-test → orphan-test → `return old`
    // occur in that sequence. That is NOT the same as proving the blanket owner
    // exemption is absent: insert a second `return old` immediately after the
    // owner test and the ordered trio is still there behind it, so the guard
    // named for falsifying that exemption would still pass while the exemption
    // was live. The escape must be UNIQUE, not merely last.
    const deleteBranch =
      /if\s+tg_op\s*=\s*'DELETE'\s+then([\s\S]*?)raise\s+exception\s+'payments are append-only'/i.exec(
        appendOnly,
      )?.[1] ?? "";
    expect(deleteBranch.trim(), "no DELETE branch found in payments_append_only").not.toBe("");
    const escapes = [...deleteBranch.matchAll(/\breturn\s+old\b/gi)];
    expect(escapes, `the DELETE branch has ${escapes.length} escapes, not 1`).toHaveLength(1);
  });

  it("exempts exactly one role by name, and that role is service_role", () => {
    // supabase_auth_admin was exempted on a false rationale (referential
    // actions run as the referencing table's owner, never the session role)
    // and holds no DELETE on payments at all. service_role stays because
    // seed-staging.mjs wipes payments directly, parents alive (ADR-016).
    //
    // Every role literal in each `current_user` test is read out, not just the
    // first. The previous form matched one literal after `=`/`in`, so against
    // `current_user in ('service_role', 'supabase_auth_admin')` it captured
    // `service_role` alone and PASSED — blind to the exact dead branch it
    // exists to retire. Proven RED against that pre-fix body before being
    // trusted (Task 13 A1). Bounding each capture at `then` also covers
    // `= any(array[...])` and any other shape a rewrite might reach for; a
    // `current_user` test with no literal at all (the owner comparison)
    // contributes nothing, and a shape this cannot read contributes nothing
    // either, which fails the guard closed.
    const named = [...appendOnly.matchAll(/current_user\s*(?:=|<>|!=|in)\s*([\s\S]*?)\bthen\b/gi)]
      .map((m) => m[1] ?? "")
      .flatMap((test) => [...test.matchAll(/'([a-z_]+)'/g)].map((lit) => lit[1]));
    expect(named).toEqual(["service_role"]);
  });
});

/**
 * Added 2026-08-02 after code review. The F5 guard above iterates LIVE_VIEWS —
 * a frozen introspection snapshot — so a view created by a NEW migration is
 * invisible to it and inherits whatever default privileges grant. That is not
 * hypothetical: the support page's admin view shipped without its `revoke all`
 * and the whole suite stayed green, because the snapshot predates it.
 *
 * This guard reads the migrations instead, so it covers every view the repo
 * will ever add. It encodes the rule the migrations already state in prose
 * (20260719150000_community.sql: "views are born with ALL granted to client
 * roles ... revoke everything before granting exactly SELECT").
 */
describe("every view created by a migration revokes client-role privileges", () => {
  const created: { view: string; file: string }[] = [];
  const revoked = new Set<string>();
  for (const { file, sql: raw } of migrationsInOrder()) {
    // Strip `--` comments first. These migrations discuss revoking at length in
    // prose ("the 13 already-revoked views"), and a pattern that spans newlines
    // will happily start inside a comment and swallow the statement after it.
    const sql = raw.replace(/--[^\n]*/g, " ");
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+([a-z_][a-z0-9_]*)/gi)) {
      created.push({ view: m[1]!, file });
    }
    // Two spellings are in use and both satisfy the invariant:
    //   revoke all on a, b from anon, authenticated;                (community.sql)
    //   revoke insert, update, delete, truncate on a, b from ...;   (20260726120000)
    // The second is what the F5 fix wave used, so matching only `all` would
    // report eleven long-fixed views as violations.
    for (const m of sql.matchAll(/revoke\s+([\s\S]*?)\s+on\s+([\s\S]*?)\s+from\s+([^;]+);/gi)) {
      const privileges = (m[1] ?? "").toLowerCase();
      const roles = (m[3] ?? "").toLowerCase();
      const removesWrites = privileges.includes("all") || privileges.includes("insert");
      if (!removesWrites) continue;
      if (!roles.includes("anon") && !roles.includes("public")) continue;
      for (const name of (m[2] ?? "").split(",")) {
        const cleaned = name.replace(/\bsequence\b|\btable\b|\bfunction\b/gi, "").trim();
        if (cleaned) revoked.add(cleaned);
      }
    }
  }

  it("finds the views this guard was written against", () => {
    // Tripwire: a parse that silently matched nothing would pass every case.
    expect(created.length).toBeGreaterThan(20);
  });

  it.each(created)("$view (added in $file) is revoked from client roles", ({ view }) => {
    expect(revoked.has(view)).toBe(true);
  });
});
