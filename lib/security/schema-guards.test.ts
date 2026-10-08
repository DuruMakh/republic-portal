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
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");

/**
 * The reviewed production view-access list (the production DB security gate's
 * input, scripts/verify-production-security-advisors.mjs). F5 covers its views
 * as well as every view the migrations create, so a view known to production
 * but missing from the migrations still gets checked — and fails closed.
 */
const REVIEWED_VIEW_ACCESS = JSON.parse(
  readFileSync(join(REPO_ROOT, "scripts", "production-security-view-access.json"), "utf8"),
) as { public_read: string[]; signed_in_read: string[] };
const REVIEWED_VIEWS = [
  ...REVIEWED_VIEW_ACCESS.public_read,
  ...REVIEWED_VIEW_ACCESS.signed_in_read,
];

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
interface Migration {
  readonly file: string;
  readonly sql: string;
}

function migrationsInOrder(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, sql: readFileSync(join(MIGRATIONS_DIR, file), "utf8") }));
}

/**
 * Removes `--` line comments and (nestable) `/* *\/` block comments, leaving
 * quoted text alone: '...' strings ('' escapes; E'...' backslash escapes) and
 * "..." identifiers. Run BEFORE any guard reads SQL, so a commented-out grant,
 * role check or audit insert can never satisfy a guard, and prose in a comment
 * ("we update public.news later") can never trip one.
 */
function stripSqlComments(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i]!;
    const next = sql[i + 1];
    if (c === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      out += " ";
      continue;
    }
    if (c === "/" && next === "*") {
      let depth = 0;
      do {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          i += 2;
        } else i++;
      } while (depth > 0 && i < sql.length);
      out += " ";
      continue;
    }
    if (c === "'" || c === '"') {
      const backslashEscapes =
        c === "'" && /[eE]/.test(sql[i - 1] ?? "") && !/\w/.test(sql[i - 2] ?? "");
      let j = i + 1;
      while (j < sql.length) {
        if (backslashEscapes && sql[j] === "\\") j += 2;
        else if (sql[j] === c && sql[j + 1] === c) j += 2;
        else if (sql[j] === c) break;
        else j++;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** `$$ ... $$` and tagged `$fn$ ... $fn$` dollar-quoted bodies, tag in group 1, body in group 2. */
const DOLLAR_BODY = /\$([A-Za-z_][A-Za-z0-9_]*)?\$([\s\S]*?)\$\1\$/g;

/**
 * Statement splitter that survives function bodies. Dollar-quoted blocks
 * (plain `$$` or tagged `$fn$`) are blanked before splitting on `;`, because a
 * plpgsql body is full of semicolons that are not statement terminators.
 * Comments go first (stripSqlComments), so a commented-out grant can never
 * satisfy a guard.
 */
function statements(sql: string): string[] {
  return stripSqlComments(sql)
    .replace(DOLLAR_BODY, " BODY ")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
}

interface PrivChange {
  readonly kind: "grant" | "revoke";
  /** Table/view names the statement names, lowercased. Empty for function/schema grants. */
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

  // Unquoted identifiers fold to lower case in PostgreSQL: `ON Admin_X` IS admin_x.
  const objects = objectPart
    .replace(/\btable\b/gi, "")
    .split(",")
    .map((o) =>
      o
        .trim()
        .replace(/^public\./i, "")
        .toLowerCase(),
    )
    .filter((o) => o.length > 0 && /^[a-z_][a-z0-9_]*$/.test(o));

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

const IDENT = "(?:public\\.)?([a-z_][a-z0-9_]*)";

/**
 * A relation lifecycle event, if `stmt` is one. Privileges belong to the
 * OBJECT, so they are only as old as the object itself:
 * - `create view v` makes a new object, born with Supabase's default ALL;
 * - `create or replace view v` on an EXISTING view keeps its privileges
 *   (PostgreSQL replaces the query, not the ACL) — on a missing one it is a
 *   plain create;
 * - `drop view v` (any list, `if exists`, `cascade`) destroys the object and
 *   its privileges with it;
 * - `alter view|table a rename to b` moves the object — and its privileges —
 *   to the new name; the old name no longer exists.
 * A revoke that ran before a drop/recreate therefore protects nothing.
 */
type ViewEvent =
  | { kind: "create"; view: string; orReplace: boolean }
  | { kind: "drop"; views: string[] }
  | { kind: "rename"; from: string; to: string };

function parseViewEvent(stmt: string): ViewEvent | null {
  const create = new RegExp(`^create\\s+(or\\s+replace\\s+)?view\\s+${IDENT}\\b`, "i").exec(stmt);
  if (create) {
    return { kind: "create", view: create[2]!.toLowerCase(), orReplace: Boolean(create[1]) };
  }
  const drop = /^drop\s+view\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?$/i.exec(
    stmt,
  );
  if (drop) {
    const views = drop[1]!
      .split(",")
      .map((v) =>
        v
          .trim()
          .replace(/^public\./i, "")
          .toLowerCase(),
      )
      .filter((v) => /^[a-z_][a-z0-9_]*$/.test(v));
    return { kind: "drop", views };
  }
  const rename = new RegExp(
    `^alter\\s+(?:view|table)\\s+(?:if\\s+exists\\s+)?${IDENT}\\s+rename\\s+to\\s+${IDENT}$`,
    "i",
  ).exec(stmt);
  if (rename) {
    return { kind: "rename", from: rename[1]!.toLowerCase(), to: rename[2]!.toLowerCase() };
  }
  return null;
}

/** Every view that exists after replaying `migrations` (created, not dropped, under its final name). */
function viewsCreatedBy(migrations: readonly Migration[]): string[] {
  const live = new Set<string>();
  for (const { sql } of migrations) {
    for (const stmt of statements(sql)) {
      const event = parseViewEvent(stmt);
      if (event?.kind === "create") live.add(event.view);
      else if (event?.kind === "drop") for (const v of event.views) live.delete(v);
      else if (event?.kind === "rename" && live.delete(event.from)) live.add(event.to);
    }
  }
  return [...live].sort();
}

interface ObjectAcl {
  held: Record<ClientRole, Set<Priv>>;
  columns: Record<ClientRole, Set<Priv>>;
  exists: boolean;
}

/**
 * Starting state is ALL for anon and authenticated: this is a Supabase
 * project, whose default privileges grant the client roles everything on
 * anything created in `public` (confirmed live in Pass 2/Pass 4 — see
 * .superpowers/sdd/progress.md CF1, and the standing comment at
 * 20260719150000_community.sql:248). Assuming an empty starting state would
 * make every guard here pass vacuously.
 */
const bornAcl = (exists: boolean): ObjectAcl => ({
  held: { anon: new Set(ALL_PRIVS), authenticated: new Set(ALL_PRIVS) },
  columns: { anon: new Set(), authenticated: new Set() },
  exists,
});

/**
 * Replays every grant/revoke and every view lifecycle event (parseViewEvent)
 * in migration order and returns the table-wide privileges each client role
 * ends up holding on `object`. A view is reset to the born state every time it
 * is (re)created, and carries its privileges across a rename.
 *
 * Column-scoped grants are recorded separately: `grant select (a, b) on t`
 * confers no table-wide privilege, and treating it as one would hide exactly
 * the CF4 shape this file exists to pin.
 *
 * `migrations` defaults to the real ones; the guard-the-guard tests pass
 * in-memory variants so no real migration is ever edited to prove a point.
 */
function effectivePrivileges(
  object: string,
  migrations: readonly Migration[] = migrationsInOrder(),
): Record<ClientRole, Set<Priv>> {
  const acls = new Map<string, ObjectAcl>();
  const acl = (name: string): ObjectAcl => {
    let a = acls.get(name);
    if (!a) acls.set(name, (a = bornAcl(false)));
    return a;
  };

  for (const { sql } of migrations) {
    for (const stmt of statements(sql)) {
      const event = parseViewEvent(stmt);
      if (event?.kind === "create") {
        if (!event.orReplace || !acl(event.view).exists) acls.set(event.view, bornAcl(true));
        acl(event.view).exists = true;
        continue;
      }
      if (event?.kind === "drop") {
        for (const v of event.views) acls.set(v, bornAcl(false));
        continue;
      }
      if (event?.kind === "rename") {
        acls.set(event.to, { ...acl(event.from), exists: true });
        acls.set(event.from, bornAcl(false));
        continue;
      }
      const change = parsePrivChange(stmt);
      if (!change) continue;
      for (const name of change.objects) {
        const { held, columns } = acl(name);
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
  }
  return acl(object.toLowerCase()).held;
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

/**
 * The last definition of a function wins — `create or replace` supersedes.
 * Comments are stripped first and tagged dollar quotes (`$fn$ ... $fn$`) are
 * read as well as `$$`, so a later redefinition can neither hide behind an
 * unusual quote tag nor keep a commented-out check "present".
 */
function lastFunctionBody(
  name: string,
  migrations: readonly Migration[] = migrationsInOrder(),
): string {
  let body = "";
  for (const { sql } of migrations) {
    const re = new RegExp(
      `create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${name}\\s*\\(([\\s\\S]*?)\\$([A-Za-z_][A-Za-z0-9_]*)?\\$([\\s\\S]*?)\\$\\2\\$`,
      "gi",
    );
    for (const m of stripSqlComments(sql).matchAll(re)) body = m[3] ?? body;
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
  //
  // The view list is DERIVED, not frozen: every view the migrations leave in
  // place, plus the reviewed production list. (It used to be a 24-view
  // introspection snapshot, which a view added later — admin_support_messages —
  // was invisible to; a weaker follow-up guard then only checked that SOME
  // revoke named each new view, blind to statement order.)
  const MIGRATION_VIEWS = viewsCreatedBy(migrationsInOrder());
  const F5_VIEWS = [...new Set([...MIGRATION_VIEWS, ...REVIEWED_VIEWS])].sort();

  function writableBy(held: Record<ClientRole, Set<Priv>>): string[] {
    return CLIENT_ROLES.flatMap((role) =>
      WRITE_PRIVS.filter((p) => held[role].has(p)).map((p) => `${role}:${p}`),
    );
  }

  it.each(F5_VIEWS)(
    "%s grants no INSERT/UPDATE/DELETE/TRUNCATE to anon or authenticated",
    (view) => {
      const writable = writableBy(effectivePrivileges(view));
      expect(writable, `client roles may still write through view ${view}`).toEqual([]);
    },
  );

  it("covers every view the migrations create, including the support inbox", () => {
    // Guards the guard: a parse that silently matched nothing would run zero
    // cases above and prove nothing.
    expect(MIGRATION_VIEWS.length).toBeGreaterThan(20);
    expect(F5_VIEWS).toContain("admin_support_messages");
  });

  it("every view on the reviewed production list exists in the migrations", () => {
    // A reviewed name the migrations never create would still be checked above
    // (and fail closed, starting from default ALL) — this names the real cause.
    expect(REVIEWED_VIEWS.filter((v) => !MIGRATION_VIEWS.includes(v))).toEqual([]);
  });

  describe("guarding the guard — in-memory migrations, real ones untouched", () => {
    const REAL = migrationsInOrder();
    const plus = (sql: string): Migration[] => [
      ...REAL,
      { file: "99999999999999_scratch.sql", sql },
    ];

    it("catches a late `grant insert ... to anon` on a view", () => {
      expect(writableBy(effectivePrivileges("admin_support_messages", REAL))).toEqual([]);
      const late = plus("grant insert on admin_support_messages to anon;");
      expect(writableBy(effectivePrivileges("admin_support_messages", late))).toEqual([
        "anon:insert",
      ]);
    });

    it("would have caught the support view shipping without its revoke (the 2026-08-02 miss)", () => {
      // Both later normalizations must go too: 20260811101122 re-revokes every
      // reviewed view, which is the defence-in-depth this test is not about.
      const withoutRevokes = REAL.map((m) => ({
        ...m,
        sql: m.sql.replace(/revoke\s+all\s+on\s+admin_support_messages\s+from[^;]*;/gi, ""),
      })).map((m) =>
        m.file.includes("normalize_production_view_grants")
          ? { ...m, sql: m.sql.replace(/revoke\s+all\s+on[^;]*;/gi, "") }
          : m,
      );
      expect(withoutRevokes.map((m) => m.sql)).not.toEqual(REAL.map((m) => m.sql));
      expect(writableBy(effectivePrivileges("admin_support_messages", withoutRevokes))).toEqual(
        expect.arrayContaining(["anon:insert", "authenticated:insert"]),
      );
    });

    it("catches a view dropped and recreated after its revoke (statement order matters)", () => {
      const reborn = plus(
        "drop view admin_support_messages;\n" +
          "create view admin_support_messages as select id from support_messages;\n" +
          "grant select on admin_support_messages to authenticated;",
      );
      expect(writableBy(effectivePrivileges("admin_support_messages", reborn))).toEqual(
        expect.arrayContaining(["anon:insert", "authenticated:update", "anon:delete"]),
      );
    });

    it("does not count a revoke written before the view exists", () => {
      const early: Migration[] = [
        {
          file: "1_scratch.sql",
          sql:
            "revoke all on scratch_view from anon, authenticated;\n" +
            "create view scratch_view as select 1 as x;",
        },
      ];
      expect(writableBy(effectivePrivileges("scratch_view", early))).toContain("anon:insert");
    });

    it("keeps privileges across `create or replace` of an existing view (no false alarm)", () => {
      const replaced = plus(
        "create or replace view admin_support_messages as select id from support_messages;",
      );
      expect(writableBy(effectivePrivileges("admin_support_messages", replaced))).toEqual([]);
    });

    it("derives a view created only by a later migration", () => {
      expect(viewsCreatedBy(plus("create view scratch_view as select 1;"))).toContain(
        "scratch_view",
      );
    });

    it("follows a renamed view: covered under its new name, privileges carried over", () => {
      const renamed = plus(
        "alter view admin_support_messages rename to admin_inbox;\n" +
          "grant update on admin_inbox to authenticated;",
      );
      expect(viewsCreatedBy(renamed)).toContain("admin_inbox");
      expect(viewsCreatedBy(renamed)).not.toContain("admin_support_messages");
      expect(writableBy(effectivePrivileges("admin_inbox", renamed))).toEqual([
        "authenticated:update",
      ]);
      const quiet = plus("alter view admin_support_messages rename to admin_inbox;");
      expect(writableBy(effectivePrivileges("admin_inbox", quiet))).toEqual([]);
    });

    it("folds identifier case: `GRANT INSERT ON Admin_Support_Messages TO anon` is caught", () => {
      const shouted = plus("GRANT INSERT ON public.Admin_Support_Messages TO anon;");
      expect(writableBy(effectivePrivileges("admin_support_messages", shouted))).toEqual([
        "anon:insert",
      ]);
    });

    it("ignores a commented-out grant, and text inside a tagged $fn$ body", () => {
      const inert = plus(
        "-- grant insert on admin_support_messages to anon;\n" +
          "/* grant update on admin_support_messages to anon; */\n" +
          "create function scratch_fn() returns void language sql as $fn$\n" +
          "  select 1; grant delete on admin_support_messages to anon;\n$fn$;",
      );
      expect(writableBy(effectivePrivileges("admin_support_messages", inert))).toEqual([]);
      // ...while a real grant right after a comment line is still a grant
      const afterNote = plus("-- harmless note\ngrant insert on admin_support_messages to anon;");
      expect(writableBy(effectivePrivileges("admin_support_messages", afterNote))).toEqual([
        "anon:insert",
      ]);
    });
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
 * ADR-014: every admin mutation is a SECURITY DEFINER RPC that checks the
 * session, then the role, BEFORE it changes anything, and writes its audit_log
 * row in the same transaction — "an unaudited admin action is unrepresentable".
 * The server actions under app/(admin) rely on exactly that: they pass the
 * caller's session straight to these RPCs (pinned in their actions.test.ts
 * files), so the in-DB check IS the authorization. This pins it on the LAST
 * definition of each function the app calls.
 */
describe("ADR-014 — every admin RPC the app calls re-checks the role first and audits", () => {
  const SE = ["super_admin", "editor"];
  const SV = ["super_admin", "verifier"];
  const SF = ["super_admin", "finance"];
  const S = ["super_admin"];
  const ADMIN_RPCS: Record<string, { roles: string[]; audit: string }> = {
    admin_grant_role: { roles: S, audit: "admin.grant_role" },
    admin_revoke_role: { roles: S, audit: "admin.revoke_role" },
    admin_update_setting: { roles: S, audit: "settings.update" },
    admin_reveal_personal_id: { roles: S, audit: "member.reveal_personal_id" },
    admin_record_payment: { roles: SF, audit: "payment.record" },
    admin_record_payments_bulk: { roles: SF, audit: "payment.bulk_record" },
    admin_void_payment: { roles: SF, audit: "payment.void" },
    admin_export_members: { roles: SF, audit: "member.export" },
    admin_reveal_applicant_personal_id: { roles: SV, audit: "delegate.reveal_personal_id" },
    admin_approve_delegate: { roles: SV, audit: "delegate.approve" },
    admin_reject_delegate: { roles: SV, audit: "delegate.reject" },
    admin_update_delegate_profile: { roles: SV, audit: "delegate.update_profile" },
    admin_update_delegate_name: { roles: SV, audit: "delegate.update_name" },
    admin_reassign_member: { roles: SV, audit: "member.reassign" },
    admin_delete_member: { roles: S, audit: "member.delete" },
    admin_save_news: { roles: SE, audit: "news.save" },
    admin_publish_news: { roles: SE, audit: "news.publish" },
    admin_unpublish_news: { roles: SE, audit: "news.unpublish" },
    admin_delete_news: { roles: SE, audit: "news.delete" },
    admin_set_news_image: { roles: SE, audit: "news.set_image" },
    admin_save_event: { roles: SE, audit: "event.save" },
    admin_publish_event: { roles: SE, audit: "event.publish" },
    admin_cancel_event: { roles: SE, audit: "event.cancel" },
    admin_delete_event: { roles: SE, audit: "event.delete" },
    admin_save_poll: { roles: SE, audit: "poll.save" },
    admin_open_poll: { roles: SE, audit: "poll.open" },
    admin_close_poll: { roles: SE, audit: "poll.close" },
    admin_delete_poll: { roles: SE, audit: "poll.delete" },
  };

  const SESSION_CHECK = /if\s+v_uid\s+is\s+null\s+then\s+raise\s+exception\s+'not_authenticated'/i;
  const ROLE_CHECK =
    /if\s+not\s+public\.has_(?:any_)?admin_role\s*\(([^)]*)\)\s+then\s+raise\s+exception\s+'missing_role'/i;
  const FIRST_WRITE =
    /\binsert\s+into\s+public\.|\bupdate\s+public\.|\bdelete\s+from\s+public\.|\bperform\s+public\.recompute/i;
  const UPDATE_HINT =
    "If this RPC's shape changed on purpose, update ADMIN_RPCS / these checks in " +
    "lib/security/schema-guards.test.ts; otherwise the database lost an authorization guard.";

  /** Every ADR-014 rule `body` breaks; [] = compliant. Bodies come comment-stripped. */
  function adr014Violations(
    name: string,
    body: string,
    { roles, audit }: { roles: string[]; audit: string },
  ): string[] {
    if (body === "") return [`${name} is not defined by any migration`];
    const problems: string[] = [];
    if (!/v_uid\s+uuid\s*:=\s*auth\.uid\(\)/i.test(body)) problems.push("v_uid is not auth.uid()");
    const session = SESSION_CHECK.exec(body);
    const role = ROLE_CHECK.exec(body);
    const write = FIRST_WRITE.exec(body);
    if (!session) problems.push("no not_authenticated check");
    if (!role) problems.push("no missing_role check");
    if (!write) problems.push("writes nothing — not even its audit row");
    if (role) {
      const checked = [...role[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
      if (checked.join() !== [...roles].sort().join()) {
        problems.push(`checks roles [${checked.join(", ")}], expected [${roles.join(", ")}]`);
      }
    }
    if (session && role && session.index > role.index) problems.push("role checked before session");
    if (role && write && write.index < role.index)
      problems.push("changes data before the role check");
    if (!/insert\s+into\s+public\.audit_log\b/i.test(body)) problems.push("no audit_log insert");
    if (!body.includes(`'${audit}'`)) problems.push(`no '${audit}' audit action`);
    return problems;
  }

  it.each(Object.entries(ADMIN_RPCS))(
    "%s: session check, then the role check, before any write; audited",
    (name, spec) => {
      expect(adr014Violations(name, lastFunctionBody(name), spec), UPDATE_HINT).toEqual([]);
    },
  );

  it("admin_revoke_role keeps the serialized last-super_admin guard ahead of the delete", () => {
    const body = lastFunctionBody("admin_revoke_role");
    expect(body, UPDATE_HINT).toMatch(
      /pg_advisory_xact_lock\([\s\S]*?count\(\*\)[\s\S]*?role\s*=\s*'super_admin'[\s\S]*?=\s*1\s+then\s+raise\s+exception\s+'last_super_admin'[\s\S]*?delete\s+from\s+public\.admin_roles/i,
    );
  });

  it("admin_export_members returns personal IDs only after a super_admin-only check", () => {
    const body = lastFunctionBody("admin_export_members");
    const gate =
      /if\s+coalesce\(p_include_ids,\s*false\)\s+and\s+not\s+public\.has_admin_role\('super_admin'\)\s+then\s+raise\s+exception\s+'missing_role'/i.exec(
        body,
      );
    expect(gate, `the super_admin-only ID gate is gone. ${UPDATE_HINT}`).not.toBeNull();
    expect(gate!.index, UPDATE_HINT).toBeLessThan(body.indexOf("'personalId'"));
  });

  it("covers every admin RPC the app (or lib/) calls", () => {
    // Guards the table: code that starts calling a new admin_* function must
    // bring that function under the checks above.
    const defined = new Set(
      migrationsInOrder().flatMap(({ sql }) =>
        [
          ...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(admin_[a-z_]+)/gi),
        ].map((m) => m[1]!.toLowerCase()),
      ),
    );
    const called = new Set<string>();
    for (const dir of ["app", "lib"]) {
      const root = join(REPO_ROOT, dir);
      for (const rel of readdirSync(root, { recursive: true }) as string[]) {
        if (!/\.(ts|tsx)$/.test(rel) || /\.test\.(ts|tsx)$/.test(rel)) continue;
        const src = readFileSync(join(root, rel), "utf8");
        for (const m of src.matchAll(/["'`](admin_[a-z_]+)["'`]/g)) {
          if (defined.has(m[1]!)) called.add(m[1]!);
        }
      }
    }
    expect(called.size).toBeGreaterThan(20);
    expect(
      [...called].filter((n) => !(n in ADMIN_RPCS)).sort(),
      "add these to ADMIN_RPCS with their roles and audit action",
    ).toEqual([]);
  });

  describe("guarding the guard — in-memory bodies, real migrations untouched", () => {
    const REVOKE = ADMIN_RPCS.admin_revoke_role!;
    const real = lastFunctionBody("admin_revoke_role");
    const roleLine =
      /if\s+not\s+public\.has_admin_role\('super_admin'\)[^\n]*/i.exec(real)?.[0] ?? "";
    const sessionLine = /if\s+v_uid\s+is\s+null[^\n]*/i.exec(real)?.[0] ?? "";
    /** lastFunctionBody over the real migrations plus one scratch redefinition. */
    const redefined = (sql: string) =>
      lastFunctionBody("admin_revoke_role", [
        ...migrationsInOrder(),
        { file: "99999999999999_scratch.sql", sql },
      ]);
    const wrap = (body: string, tag = "") =>
      `create or replace function admin_revoke_role(p_user_id uuid, p_role text) returns void\n` +
      `language plpgsql volatile security definer set search_path = '' as $${tag}$${body}$${tag}$;`;

    it("starts from a compliant real body", () => {
      expect(roleLine).not.toBe("");
      expect(sessionLine).not.toBe("");
      expect(adr014Violations("admin_revoke_role", real, REVOKE)).toEqual([]);
    });

    it.each([
      {
        label: "a `--` commented-out role check",
        edit: (b: string) => b.replace(roleLine, `-- ${roleLine}`),
      },
      {
        label: "a /* */ commented-out role check",
        edit: (b: string) => b.replace(roleLine, `/* ${roleLine} */`),
      },
      {
        label: "a `--` commented-out session check",
        edit: (b: string) => b.replace(sessionLine, `-- ${sessionLine}`),
      },
    ])("fails a redefinition with $label", ({ edit }) => {
      const body = redefined(wrap(edit(real)));
      expect(adr014Violations("admin_revoke_role", body, REVOKE)).not.toEqual([]);
    });

    it("reads a later redefinition quoted with a tagged $fn$ dollar quote", () => {
      const body = redefined(wrap(real.replace(roleLine, ""), "fn"));
      expect(body).not.toContain("has_admin_role('super_admin')");
      expect(adr014Violations("admin_revoke_role", body, REVOKE)).toContain(
        "no missing_role check",
      );
    });

    it("is not tripped by a comment that mentions a write before the role check", () => {
      const body = redefined(
        wrap(real.replace(sessionLine, `-- we update public.admin_roles later\n  ${sessionLine}`)),
      );
      expect(adr014Violations("admin_revoke_role", body, REVOKE)).toEqual([]);
    });
  });
});
