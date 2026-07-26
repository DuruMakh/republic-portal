/**
 * Live regression harness for the security check-up's fix wave (Task 12).
 *
 * Every fix in this wave is a DATABASE fix, and a database fix is only proven
 * against the database. `lib/security/schema-guards.test.ts` models the same
 * five invariants statically from the migration files and runs in CI; this
 * script performs the actual attack against staging and reads the answer off
 * the wire. Both exist deliberately — the static model can be right about a
 * migration that was never applied.
 *
 * Why it is not part of scripts/verify-schema.mjs: that script asserts SEEDED
 * DATA counts ("exactly 4 public published news rows") and is red on any
 * staging database the audit has probed, so it aborts long before any block
 * appended to it could run. These probes depend on no seed state at all.
 *
 *   node --env-file=.env.local scripts/verify-security-fixes.mjs
 *   (also wired as: npm run security:verify-fixes)
 *
 * Each check prints RED (the finding reproduces — the fix is not in this
 * database) or OK, and the script exits non-zero if any check is RED. Run it
 * BEFORE pushing the migrations to see every finding reproduce, and after to
 * see them all close.
 *
 * Live SQL goes through the supabase CLI (`db query`), the same route Task 3
 * established: psql is not on this machine, and adding a SQL-executing RPC to
 * the database to work around that would itself be the largest hole in the
 * schema. The password is percent-encoded and the assembled URL is never
 * printed. Catalog/metadata queries only, per the standing instruction in
 * .superpowers/sdd/progress.md — no probe here selects real row content.
 */
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!url || !anonKey || !serviceKey || !dbPassword) {
  throw new Error(
    "needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
      "SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_PASSWORD (run with --env-file=.env.local)",
  );
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const PROJECT_REF = new URL(url).hostname.split(".")[0];
const DB_URL =
  `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(dbPassword)}` +
  "@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";

const scratch = mkdtempSync(join(tmpdir(), "verify-security-"));

/**
 * The CLI's own entry script, run through this process's node binary.
 *
 * NOT `npx supabase`: on Windows that resolves to a `.cmd` shim, which Node
 * refuses to spawn without `shell: true` — and a shell invocation would put the
 * connection string (password and all) on a command line. Worse, the EINVAL
 * that comes back carries `spawnargs` and prints the assembled URL in the
 * stack trace. Hence also `redact()` below: NOTHING this script surfaces may
 * contain the connection string, whatever went wrong.
 */
const SUPABASE_CLI = createRequire(import.meta.url).resolve("supabase/dist/supabase.js");

const redact = (text) =>
  String(text ?? "")
    .split(DB_URL)
    .join("[db-url redacted]");

function runSql(text) {
  const file = join(scratch, `q-${randomBytes(6).toString("hex")}.sql`);
  writeFileSync(file, text);
  try {
    return execFileSync(
      process.execPath,
      [SUPABASE_CLI, "db", "query", "-f", file, "--db-url", DB_URL, "--output-format", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 },
    );
  } catch (err) {
    // Re-thrown redacted and WITHOUT the original error object, which carries
    // `spawnargs` — i.e. the connection string — into any stack trace.
    const redacted = new Error(
      `supabase db query failed: ${redact(err.stderr || err.stdout || err.message)}`,
    );
    redacted.stdout = redact(err.stdout);
    redacted.stderr = redact(err.stderr);
    throw redacted;
  } finally {
    rmSync(file, { force: true });
  }
}

/** Runs one SQL statement through the CLI and returns its rows. */
function sql(text) {
  const out = runSql(text);
  // The CLI prints "Connecting to remote database..." before the JSON.
  const parsed = JSON.parse(out.slice(out.indexOf("{")));
  return parsed.rows ?? [];
}

/**
 * Runs a DO block whose LAST act is `raise exception 'AUDIT-RESULT >> ...'` and
 * returns everything after the marker. Pass 4's method, and the reason these
 * probes leave no residue: the raise carries the measurements out in the error
 * message AND aborts the statement, so Postgres rolls the experiment back
 * rather than a teardown that could itself fail.
 */
function sqlProbe(text) {
  try {
    runSql(text);
  } catch (err) {
    const output = `${err.stdout ?? ""}${err.stderr ?? ""}${err.message ?? ""}`;
    const marker = output.indexOf("AUDIT-RESULT >> ");
    if (marker < 0) throw new Error(`probe did not report a result:\n${output.slice(0, 2000)}`);
    // The CLI wraps the failure in JSON, so the message is followed by the
    // closing quote/braces — cut at the first one rather than reporting them.
    return output
      .slice(marker + "AUDIT-RESULT >> ".length)
      .split("\n")[0]
      .split('"')[0]
      .trim();
  }
  throw new Error("probe completed WITHOUT raising — it did not roll itself back");
}

let red = 0;
let ok = 0;
function check(label, passed, detail) {
  if (passed) {
    ok++;
    console.log(`  OK   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    red++;
    console.log(`  RED  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// F5 / LB-5 — anonymous write grants on the views
// ---------------------------------------------------------------------------
// The whole finding is the ERROR CODE. Live, an anonymous INSERT into
// admin_roles answers 42501 (a security check refused you) while the same
// insert through admin_admins answers 55000 ("not automatically updatable") —
// the security check PASSED and the planner refused on the view's shape. Drop
// the cosmetic display join, as any refactor might, and the write lands in
// admin_roles past RLS. So the probe asserts two things: that no client role
// HOLDS the privilege (the catalog fact, across all 24 views), and that a real
// anonymous write over HTTP is now refused by privilege rather than by shape.
console.log("\nF5 / LB-5 — write grants on views in schema public");
{
  const held = sql(`
    select c.relname as view_name, r.rolname as role,
           array_remove(array[
             case when has_table_privilege(r.rolname, c.oid, 'INSERT')   then 'insert'   end,
             case when has_table_privilege(r.rolname, c.oid, 'UPDATE')   then 'update'   end,
             case when has_table_privilege(r.rolname, c.oid, 'DELETE')   then 'delete'   end,
             case when has_table_privilege(r.rolname, c.oid, 'TRUNCATE') then 'truncate' end
           ], null) as writes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join (select rolname from pg_roles where rolname in ('anon','authenticated')) r
     where n.nspname = 'public' and c.relkind in ('v','m')
     order by 1, 2;
  `);
  const writable = held.filter((row) => (row.writes ?? []).length > 0);
  check(
    "no view grants insert/update/delete/truncate to anon or authenticated",
    writable.length === 0,
    writable.length === 0
      ? `${held.length} (view, role) pairs, all read-only`
      : `${writable.length} pairs still writable, e.g. ${writable
          .slice(0, 3)
          .map((r) => `${r.role}->${r.view_name} (${r.writes.join("/")})`)
          .join(", ")}`,
  );

  // End-to-end over HTTP, as an anonymous caller, through PostgREST — recorded
  // as evidence, asserted only on "the write does not happen".
  //
  // It cannot assert 42501, and the reason is the finding restated: PostgreSQL's
  // REWRITER raises 55000 for a non-auto-updatable view before the EXECUTOR ever
  // consults the ACL, so on a join view the shape rule MASKS whatever the
  // privilege layer would have said. That is exactly why the privilege had to be
  // taken away rather than relied upon — while it was held, the only thing
  // standing between an anonymous caller and the base table was the view's shape,
  // and the catalog check above is the only place the difference is visible.
  const { data: wrote, error } = await anon
    .from("public_delegates")
    .insert({ slug: `audit-f5-${randomBytes(4).toString("hex")}` })
    .select();
  check(
    "an anonymous INSERT through a public view does not write",
    Boolean(error) && !wrote?.length,
    `PostgREST answered ${error?.code ?? "no error — THE WRITE SUCCEEDED"}: ${
      error?.message ?? ""
    }`,
  );
}

// ---------------------------------------------------------------------------
// CF4 / LB-6 — anon's column grants on profiles
// ---------------------------------------------------------------------------
console.log("\nCF4 / LB-6 — anon's grants on profiles");
{
  const cols = sql(`
    select grantee, privilege_type, count(*)::int as columns
      from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'profiles'
       and grantee in ('anon','authenticated')
     group by 1, 2
     order by 1, 2;
  `);
  const anonGrants = cols.filter((r) => r.grantee === "anon");
  check(
    "anon holds NO column privilege on profiles",
    anonGrants.length === 0,
    anonGrants.length === 0
      ? "0 grants"
      : anonGrants.map((r) => `${r.privilege_type} x${r.columns}`).join(", "),
  );
  const authSelect = cols.find(
    (r) => r.grantee === "authenticated" && r.privilege_type === "SELECT",
  );
  const authUpdate = cols.find(
    (r) => r.grantee === "authenticated" && r.privilege_type === "UPDATE",
  );
  check(
    "authenticated keeps exactly its 14 readable + 5 writable columns (the fix is not over-broad)",
    authSelect?.columns === 14 && authUpdate?.columns === 5,
    `select ${authSelect?.columns ?? 0} columns, update ${authUpdate?.columns ?? 0} columns`,
  );

  // The attack: an anonymous read of the crown jewels. Before the fix the grant
  // permits the statement and RLS returns an empty set (200 []) — one predicate
  // deep. After it, the request never reaches RLS at all.
  const { error } = await anon.from("profiles").select("personal_id, birth_date, phone").limit(1);
  check(
    "anonymous SELECT of personal_id/birth_date/phone is refused at the GRANT (42501)",
    error?.code === "42501",
    error
      ? `${error.code}: ${error.message}`
      : "no error — the statement ran and only the RLS predicate withheld the rows",
  );
}

// ---------------------------------------------------------------------------
// F3 — register() has no null-phone guard
// ---------------------------------------------------------------------------
// Email sign-up is enabled and auto-confirmed on this project, so a session
// with NO phone is free to obtain. register() reads auth.users.phone and
// inserts the profile regardless, and profiles.phone is nullable-unique — so
// the platform's core Sybil assumption (one SMS-verified phone, one person) is
// not enforced at the membership boundary. The probe manufactures exactly that
// session and tries to become a member with it.
console.log("\nF3 — register() from a phone-less session");
{
  const email = `f3-null-phone-probe-${randomBytes(6).toString("hex")}@example.com`;
  const password = randomBytes(24).toString("hex");
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(`F3 probe createUser failed: ${createErr.message}`);
  const probeId = created.user.id;
  try {
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error(`F3 probe sign-in failed: ${signInErr.message}`);
    const { data: user } = await client.auth.getUser();
    if (user?.user?.phone) throw new Error("F3 probe user unexpectedly HAS a phone");

    const { data: state, error } = await client.rpc("register", {
      p_first_name: "პრობი",
      p_last_name: "უტელეფონო",
      // A personal ID from the audit's own synthetic 999… band, so a probe can
      // never squat an ID that could belong to a real citizen (F13/LB-1).
      p_personal_id: `999${randomBytes(4).readUInt32BE(0).toString().padStart(8, "0").slice(0, 8)}`,
    });
    const { data: row } = await db.from("profiles").select("id").eq("id", probeId).maybeSingle();
    check(
      "register() refuses a session with no verified phone (token 'phone_required')",
      Boolean(error?.message?.includes("phone_required")),
      error
        ? `raised ${error.message}`
        : `NO ERROR — a phone-less account became '${state?.status}' with created=${state?.created}`,
    );
    check(
      "…and writes no profiles row",
      !row,
      row ? "a profiles row exists for the phone-less account" : "no row",
    );
  } finally {
    const { error } = await db.auth.admin.deleteUser(probeId);
    if (error) console.error(`WARNING: F3 probe cleanup failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// F14 / LB-7 — request_delegacy() voids admin reassignment
// ---------------------------------------------------------------------------
// admin_reassign_member refuses ANY member holding a delegates row of ANY
// status, while its mirror in member_change_delegate was deliberately narrowed
// to status='approved' by 20260722140000. So a pending/rejected requester keeps
// unilateral control of their own binding while the verifier permanently loses
// theirs — un-audited, and irreversible because nothing ever deletes from
// delegates. Measured as a catalog fact (the two guards must agree) plus the
// live count of members already in that state.
console.log("\nF14 / LB-7 — the two delegate-binding guards");
{
  // Read off the LIVE body, and match the guard EXACTLY: an earlier attempt
  // searched the whole tail of prosrc for "status = 'approved'" and passed on
  // admin_reassign_member because a LATER, unrelated statement (resolving the
  // TARGET delegate) contains that phrase. The finding would have been graded
  // fixed while it was open.
  const guards = sql(`
    select p.proname,
           p.prosrc ~ 'exists\\s*\\(\\s*select\\s+1\\s+from\\s+public\\.delegates\\s+d\\s+where\\s+d\\.id\\s*=\\s*[a-z_]+\\s+and\\s+d\\.status\\s*=\\s*''approved''' as narrowed
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('admin_reassign_member', 'member_change_delegate')
     order by 1;
  `);
  const reassign = guards.find((g) => g.proname === "admin_reassign_member");
  const change = guards.find((g) => g.proname === "member_change_delegate");
  check(
    "member_change_delegate's guard is scoped to approved delegates",
    change?.narrowed === true,
    change?.narrowed ? "scoped" : "unscoped",
  );
  check(
    "admin_reassign_member's mirror guard is scoped to approved delegates too",
    reassign?.narrowed === true,
    reassign?.narrowed
      ? "scoped"
      : "refuses ANY delegates row of ANY status — the asymmetry IS the finding",
  );
  const stranded = sql(`
    select count(*)::int as n
      from public.delegates d
      join public.profiles pr on pr.id = d.id
     where d.status <> 'approved' and pr.registration_completed_at is not null;
  `);
  console.log(
    `       (${stranded[0]?.n ?? "?"} completed members currently hold a non-approved delegates row)`,
  );

  // The behavioural half, through the REAL gate: a super_admin's identity is
  // reproduced the way PostgREST reproduces it (request.jwt.claims + `set local
  // role authenticated`), so the role check, RLS and every trigger apply
  // exactly as on a live request. The whole thing is one aborted transaction.
  const reassignProbe = sqlProbe(`
    do $probe$
    declare
      v_admin uuid;
      v_member uuid;
      v_target uuid;
      v_status text;
      v_result text := 'ALLOWED';
    begin
      select ar.user_id into v_admin from public.admin_roles ar where ar.role = 'super_admin' limit 1;
      -- a member who requested delegacy and was never approved, still holding
      -- an open membership: the exact state F14 describes
      select d.id, d.status into v_member, v_status
        from public.delegates d
        join public.profiles pr on pr.id = d.id
        join public.memberships m on m.member_id = d.id and m.ended_at is null
       where d.status <> 'approved' and pr.registration_completed_at is not null
       limit 1;
      select d.id into v_target from public.delegates d
       where d.status = 'approved' and d.id <> coalesce(v_member, d.id)
         and d.id is distinct from (select m.delegate_id from public.memberships m
                                     where m.member_id = v_member and m.ended_at is null)
       limit 1;
      if v_admin is null or v_member is null or v_target is null then
        raise exception 'AUDIT-RESULT >> SKIPPED (no admin/member/target fixture available)';
      end if;

      perform set_config('request.jwt.claims',
                         json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      begin
        perform public.admin_reassign_member(v_member, v_target);
      exception when others then v_result := 'refused: ' || sqlerrm;
      end;
      execute 'reset role';

      raise exception 'AUDIT-RESULT >> reassigning a %-status requester: %', v_status, v_result;
    end $probe$;
  `);
  console.log(`       probe: ${reassignProbe}`);
  check(
    "a verifier CAN reassign a member whose delegacy request was never approved",
    /ALLOWED/.test(reassignProbe),
    reassignProbe.includes("invalid_target")
      ? "refused invalid_target — the member's own binding is permanently outside admin control"
      : "",
  );
}

// ---------------------------------------------------------------------------
// L3-2 — payments has no append-only protection
// ---------------------------------------------------------------------------
// payments drives active_member status and every money figure, yet rests on a
// single layer (the absence of an RLS write policy) where audit_log has two,
// and a direct write emits no audit_log row. The probe writes a real payment
// with the service role, then tries to rewrite and to delete it — the two
// things ADR-015 says are unrepresentable (corrections are voids) — and
// finally checks that the LEGITIMATE void path still works.
console.log("\nL3-2 — payments append-only protection");
{
  const trigger = sql(`
    select t.tgname, pg_get_triggerdef(t.oid) as def
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'payments' and not t.tgisinternal
     order by 1;
  `);
  check(
    // pg_get_triggerdef normalises the event list, and it does NOT preserve the
    // order written in the migration — "BEFORE UPDATE OR DELETE" comes back as
    // "BEFORE DELETE OR UPDATE". Match either.
    "payments carries a before-update-or-delete trigger, as audit_log does",
    trigger.some((t) => /before (update or delete|delete or update)/i.test(t.def)),
    trigger.length === 0 ? "no trigger at all" : trigger.map((t) => t.tgname).join(", "),
  );

  const grants = sql(`
    select r.rolname as role,
           array_remove(array[
             case when has_table_privilege(r.rolname, 'public.payments', 'INSERT')   then 'insert'   end,
             case when has_table_privilege(r.rolname, 'public.payments', 'UPDATE')   then 'update'   end,
             case when has_table_privilege(r.rolname, 'public.payments', 'DELETE')   then 'delete'   end,
             case when has_table_privilege(r.rolname, 'public.payments', 'TRUNCATE') then 'truncate' end
           ], null) as writes
      from (select rolname from pg_roles where rolname in ('anon','authenticated')) r
     order by 1;
  `);
  const stillWritable = grants.filter((g) => (g.writes ?? []).length > 0);
  check(
    "no client role holds a write grant on payments",
    stillWritable.length === 0,
    stillWritable.length === 0
      ? "anon and authenticated hold none"
      : stillWritable.map((g) => `${g.role}: ${g.writes.join("/")}`).join("; "),
  );

  // The behavioural half, run entirely inside one aborted transaction so the
  // experiment leaves nothing behind: the DO block raises at the end, which
  // carries the measurements out in the message AND rolls the whole thing back.
  const probe = sqlProbe(`
    do $probe$
    declare
      v_member uuid;
      v_id bigint;
      v_update text := 'ALLOWED (no protection)';
      v_delete text := 'ALLOWED (no protection)';
      v_void   text := 'REFUSED';
    begin
      select id into v_member from public.profiles
       where registration_completed_at is not null and membership_tier is not null limit 1;
      insert into public.payments (member_id, amount_gel, paid_at, bank_reference, tier_gel_at_payment)
      values (v_member, 10, current_date, 'AUDIT-L32-' || gen_random_uuid()::text, 10)
      returning id into v_id;

      begin
        update public.payments set amount_gel = 999999 where id = v_id;
      exception when others then v_update := 'refused: ' || sqlerrm;
      end;
      begin
        delete from public.payments where id = v_id;
      exception when others then v_delete := 'refused: ' || sqlerrm;
      end;
      begin
        update public.payments set voided_at = now(), void_reason = 'audit probe' where id = v_id;
        v_void := 'ALLOWED';
      exception when others then v_void := 'refused: ' || sqlerrm;
      end;

      raise exception 'AUDIT-RESULT >> update=% | delete=% | void=%', v_update, v_delete, v_void;
    end $probe$;
  `);
  console.log(`       probe: ${probe}`);
  check(
    "a direct UPDATE that is not a void is refused",
    /update=refused/.test(probe),
    probe.includes("update=ALLOWED") ? "an arbitrary rewrite of a recorded payment succeeded" : "",
  );
  check(
    "a direct DELETE is refused (ADR-015: corrections are voids, never deletions)",
    /delete=refused/.test(probe),
    probe.includes("delete=ALLOWED") ? "a recorded payment was deleted outright" : "",
  );
  check(
    "the legitimate void path still works (the fix must not break admin_void_payment)",
    /void=ALLOWED/.test(probe),
    probe.includes("void=refused") ? "the void transition was refused — the fix is too broad" : "",
  );
}

rmSync(scratch, { recursive: true, force: true });
console.log(`\n${ok} check(s) OK, ${red} RED.`);
if (red > 0) process.exit(1);
