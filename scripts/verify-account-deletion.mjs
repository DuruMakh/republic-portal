// Live probe for account deletion (plan 2026-10-08-account-deletion, Task 2). STAGING ONLY.
// Run: node --env-file=.env.local scripts/verify-account-deletion.mjs
//
// Proves migration 20261009140000_account_deletion.sql against the real staging database:
// the member / delegate / staff paths through the client RPCs, the closed doors (anon, direct
// erase_account, non-super-admin), the audit-log lock, the audit scrub, the admin wrapper and
// the anonymous poll vote. Everything it creates is removed again, on failure too.
//
// Anything that would leave a row behind that cannot be removed (audit_log is append-only) is
// run inside a single `do` block that ends in a deliberate `raise exception`, so Postgres rolls
// the whole experiment back. SQL goes through `supabase db query --db-url` (the Management API
// route behind `--linked` refuses this account), the same route verify-security-fixes.mjs uses;
// the connection string is never printed.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes, randomInt } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!url || !key || !anonKey || !dbPassword) throw new Error("needs the staging .env.local");
const { protocol, hostname } = new URL(url);
if (protocol !== "https:" || hostname !== "orcxtbedkexoclbfgvzd.supabase.co") {
  throw new Error("refusing: this probe is staging-only (project host mismatch)");
}
const db = createClient(url, key, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const CONFIRM = "წაშლა";
const BUCKET = "delegate-photos";
// A valid 1x1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const created = []; // auth user ids
const objects = []; // storage paths
const voteIds = []; // poll_votes.id
let cities = null;

// ---------------------------------------------------------------------------------------------
// SQL through the CLI (multi-statement text is refused by the extended protocol, so every probe
// is ONE `do` block).
// ---------------------------------------------------------------------------------------------
const SUPABASE_CLI = createRequire(import.meta.url).resolve("supabase/dist/supabase.js");
const DB_URL =
  `postgresql://postgres.${hostname.split(".")[0]}:${encodeURIComponent(dbPassword)}` +
  "@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";
const scratch = mkdtempSync(join(tmpdir(), "verify-account-deletion-"));
const redact = (text) =>
  String(text ?? "")
    .split(DB_URL)
    .join("[db-url redacted]");

/** Runs SQL text; returns the error message the database raised, or null when it succeeded. */
function sqlError(text) {
  const file = join(scratch, `q-${randomBytes(6).toString("hex")}.sql`);
  writeFileSync(file, text);
  try {
    execFileSync(
      process.execPath,
      [SUPABASE_CLI, "db", "query", "-f", file, "--db-url", DB_URL, "--output-format", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 },
    );
    return null;
  } catch (err) {
    const out = redact(err.stdout || err.stderr || err.message);
    try {
      const parsed = JSON.parse(out.slice(out.indexOf("{")));
      return String(parsed?.error?.message ?? out).replace(/^failed to execute query: error: /, "");
    } catch {
      return out;
    }
  } finally {
    rmSync(file, { force: true });
  }
}

/** SQL literal for a UUID: asserted, never trusted. */
function uuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))) {
    throw new Error("refusing to build SQL from a value that is not a UUID");
  }
  return `'${value}'::uuid`;
}

function expectSql(text, token, what) {
  const message = sqlError(text);
  if (message === null || !message.includes(token)) {
    throw new Error(`${what}: expected '${token}', got ${message === null ? "success" : message}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Throwaway people
// ---------------------------------------------------------------------------------------------
async function person(label, { completed = true } = {}) {
  const email = `probe-delete-${label}-${randomBytes(4).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const id = data.user.id;
  created.push(id);
  if (!cities) {
    const { data: city, error: cErr } = await db
      .from("cities")
      .select("id, region_id")
      .order("id")
      .limit(1)
      .single();
    if (cErr) throw new Error(`cities: ${cErr.message}`);
    cities = city;
  }
  const { error: pErr } = await db.from("profiles").insert({
    id,
    first_name: "პრობი",
    last_name: label,
    // the e2e-safe block: scripts/sweep-staging-e2e.mjs recognises +99555 phones and 9-ids
    phone: `+99555${randomInt(1000000, 9999999)}`,
    ...(completed
      ? {
          personal_id: `9${randomInt(1000000000, 9999999999)}`,
          birth_date: "1990-01-01",
          region_id: cities.region_id,
          city_id: cities.id,
          employment: "პრობი",
          status: "profile_completed",
          registration_completed_at: new Date().toISOString(),
        }
      : {}),
  });
  if (pErr) throw new Error(`profile ${label}: ${pErr.message}`);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw new Error(`sign-in ${label}: ${sErr.message}`);
  return { id, client };
}

async function expectError(promise, token, what) {
  const { error } = await promise;
  if (!error || !error.message.includes(token)) {
    throw new Error(`${what}: expected '${token}', got ${error ? error.message : "success"}`);
  }
}

async function voteCount(pollId, optionId) {
  const { count, error } = await db
    .from("poll_votes")
    .select("id", { count: "exact", head: true })
    .eq("poll_id", pollId)
    .eq("option_id", optionId);
  if (error) throw new Error(`vote count: ${error.message}`);
  return count;
}

async function viewVotes(client, pollId, optionId) {
  const { data, error } = await client
    .from("poll_option_counts")
    .select("votes")
    .eq("poll_id", pollId)
    .eq("option_id", optionId)
    .single();
  if (error) throw new Error(`poll_option_counts: ${error.message}`);
  return data.votes;
}

let failed = false;
try {
  // 0. the migration is really on this database: the functions exist and are closed to anon
  await expectError(
    anon.rpc("delete_my_account", { p_confirm: CONFIRM }),
    "permission denied",
    "anon delete_my_account",
  );
  console.log("OK: delete_my_account exists and is closed to anon");

  // A. wrong word refused; right word erases the member and the sign-in account
  const a = await person("member");
  await expectError(
    a.client.rpc("delete_my_account", { p_confirm: "delete" }),
    "invalid_confirmation",
    "wrong word",
  );
  await expectError(
    a.client.rpc("erase_account", { p_user_id: a.id }),
    "permission denied",
    "direct erase_account",
  );
  await expectError(
    a.client.rpc("admin_delete_member", { p_user_id: a.id, p_reason: "probe reason" }),
    "missing_role",
    "member calling admin_delete_member",
  );
  console.log(
    "OK: wrong word refused; erase_account closed to clients; admin wrapper needs a role",
  );
  const { data: memberRes, error: delErr } = await a.client.rpc("delete_my_account", {
    p_confirm: CONFIRM,
  });
  if (delErr)
    throw new Error(`delete_my_account (owner may lack delete on auth.users?): ${delErr.message}`);
  if (!memberRes || memberRes.photoUrl !== null) {
    throw new Error(`member result should be { photoUrl: null }: ${JSON.stringify(memberRes)}`);
  }
  const { data: gone } = await db.from("profiles").select("id").eq("id", a.id).maybeSingle();
  if (gone) throw new Error("profile survived");
  const { data: authUser } = await db.auth.admin.getUserById(a.id);
  if (authUser?.user) throw new Error("auth user survived");
  console.log("OK: member erased with the sign-in account (result { photoUrl: null })");

  // B. delegate WITH a photo erased: team member lands on central with the note
  const d = await person("delegate");
  const m = await person("teammate");
  const photoPath = `probe-account-deletion/${d.id}.png`;
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(photoPath, PNG, { contentType: "image/png", upsert: true });
  if (upErr) throw new Error(`photo upload: ${upErr.message}`);
  objects.push(photoPath);
  const photoUrl = db.storage.from(BUCKET).getPublicUrl(photoPath).data.publicUrl;
  const { error: dInsErr } = await db.from("delegates").insert({
    id: d.id,
    status: "approved",
    slug: `probe-${d.id.slice(0, 8)}`,
    referral_code: `PRB${randomInt(100000, 999999)}`,
    tc_accepted_at: new Date().toISOString(),
    photo_url: photoUrl,
  });
  if (dInsErr) throw new Error(`delegate insert: ${dInsErr.message}`);
  const { error: mInsErr } = await db
    .from("memberships")
    .insert({ member_id: m.id, delegate_id: d.id });
  if (mInsErr) throw new Error(`membership insert: ${mInsErr.message}`);

  // B1. the audit scrub, on every key the migration lists, rolled back (nothing persists)
  const scrub = sqlError(`
do $probe$
declare
  d constant uuid := ${uuid(d.id)};
  other constant uuid := gen_random_uuid();
  v_res jsonb;
  v_row record;
begin
  insert into public.audit_log (actor_id, action, target_type, target_id, details) values
    (null, 'delegate.approve', 'delegate', d::text, '{"name":"N","slug":"n-n","keepMe":1}'),
    (null, 'delegate.reject', 'delegate', d::text, '{"name":"N","note":"private","keepMe":1}'),
    (null, 'member.reveal_personal_id', 'profile', d::text, '{"memberName":"N"}'),
    (null, 'delegate.update_name', 'delegate', d::text, '{"from":"A","to":"B"}'),
    (null, 'member.personal_id_conflict', 'profile', d::text, null),
    (null, 'member.delete', 'profile', d::text, '{"reason":"kept"}'),
    (null, 'payment.record', 'payment', '987654321',
       jsonb_build_object('memberId', d, 'memberName', 'N', 'amount', 10)),
    (null, 'member.reassign', 'profile', other::text,
       jsonb_build_object('fromDelegateId', d, 'fromName', 'N', 'toDelegateId', other, 'toName', 'T')),
    (null, 'member.reassign', 'profile', other::text,
       jsonb_build_object('fromDelegateId', other, 'fromName', 'F', 'toDelegateId', d, 'toName', 'N')),
    (null, 'news.publish', 'news', other::text, '{"title":"untouched","name":"keep"}');

  v_res := public.erase_account(d);
  if v_res->>'photoUrl' is null then raise exception 'PROBE-ASSERT photoUrl missing'; end if;

  if exists (select 1 from public.audit_log where target_id = d::text
              and (details ?| array['name','slug','memberName','note','from','to','firstName','lastName','personalId','phone','email'])) then
    raise exception 'PROBE-ASSERT personal keys survived on a target row';
  end if;
  if exists (select 1 from public.audit_log where target_id = d::text
              and details->>'erased' is distinct from 'true') then
    raise exception 'PROBE-ASSERT a row about the person is not marked erased';
  end if;
  select * into v_row from public.audit_log where action = 'delegate.approve' and target_id = d::text;
  if v_row.details->>'keepMe' is distinct from '1' then raise exception 'PROBE-ASSERT approve lost a kept key'; end if;
  select * into v_row from public.audit_log where action = 'delegate.reject' and target_id = d::text;
  if v_row.details->>'keepMe' is distinct from '1' then raise exception 'PROBE-ASSERT reject lost a kept key'; end if;
  select * into v_row from public.audit_log where action = 'member.personal_id_conflict' and target_id = d::text;
  if v_row.details is distinct from '{"erased": true}'::jsonb then
    raise exception 'PROBE-ASSERT null-details row became %', v_row.details;
  end if;
  select * into v_row from public.audit_log where action = 'member.delete' and target_id = d::text;
  if v_row.details->>'reason' is distinct from 'kept' then raise exception 'PROBE-ASSERT member.delete lost its reason'; end if;
  select * into v_row from public.audit_log where action = 'payment.record' and target_id = '987654321';
  if v_row.details ? 'memberName' or v_row.details->>'amount' is distinct from '10'
     or v_row.details->>'erased' is distinct from 'true' then
    raise exception 'PROBE-ASSERT payment row wrong: %', v_row.details;
  end if;
  select * into v_row from public.audit_log
   where action = 'member.reassign' and details->>'fromDelegateId' = d::text;
  if v_row.details ? 'fromName' or v_row.details->>'toName' is distinct from 'T'
     or v_row.details->>'erased' is distinct from 'true' then
    raise exception 'PROBE-ASSERT reassign-from row wrong: %', v_row.details;
  end if;
  select * into v_row from public.audit_log
   where action = 'member.reassign' and details->>'toDelegateId' = d::text;
  if v_row.details ? 'toName' or v_row.details->>'fromName' is distinct from 'F'
     or v_row.details->>'erased' is distinct from 'true' then
    raise exception 'PROBE-ASSERT reassign-to row wrong: %', v_row.details;
  end if;
  select * into v_row from public.audit_log where action = 'news.publish' and target_id = other::text;
  if v_row.details->>'name' is distinct from 'keep' or v_row.details ? 'erased' then
    raise exception 'PROBE-ASSERT an unrelated row was touched: %', v_row.details;
  end if;
  raise exception 'PROBE-SCRUB-OK';
end $probe$;`);
  if (!scrub || !scrub.includes("PROBE-SCRUB-OK")) {
    throw new Error(`audit scrub: ${scrub === null ? "no error raised (not rolled back)" : scrub}`);
  }
  console.log("OK: audit scrub strips every personal key, marks rows erased, keeps the rest");

  // B2. staff: a non-super-admin editor is refused by the wrapper
  const s = await person("staff");
  const { error: roleErr } = await db
    .from("admin_roles")
    .insert({ user_id: s.id, role: "editor", granted_by: null });
  if (roleErr) throw new Error(`editor role: ${roleErr.message}`);
  await expectError(
    s.client.rpc("admin_delete_member", { p_user_id: d.id, p_reason: "probe reason" }),
    "missing_role",
    "editor calling admin_delete_member",
  );

  // B3. the admin wrapper as a super admin, rolled back (its audit row has the admin as actor)
  const { error: superErr } = await db
    .from("admin_roles")
    .insert({ user_id: s.id, role: "super_admin", granted_by: null });
  if (superErr) throw new Error(`super_admin role: ${superErr.message}`);
  const wrapper = sqlError(`
do $probe$
declare
  s constant uuid := ${uuid(s.id)};
  d constant uuid := ${uuid(d.id)};
  ghost constant uuid := gen_random_uuid();
  v_msg text;
  v_res jsonb;
  v_row record;
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', s, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_msg := null;
  begin perform public.admin_delete_member(d, 'abc'); exception when others then v_msg := sqlerrm; end;
  if v_msg is distinct from 'invalid_reason' then raise exception 'PROBE-ASSERT short reason: %', coalesce(v_msg, 'accepted'); end if;

  v_msg := null;
  begin perform public.admin_delete_member(s, 'a long enough reason'); exception when others then v_msg := sqlerrm; end;
  if v_msg is distinct from 'cannot_delete_self' then raise exception 'PROBE-ASSERT self: %', coalesce(v_msg, 'accepted'); end if;

  v_msg := null;
  begin perform public.admin_delete_member(null, 'a long enough reason'); exception when others then v_msg := sqlerrm; end;
  if v_msg is distinct from 'invalid_target' then raise exception 'PROBE-ASSERT null target: %', coalesce(v_msg, 'accepted'); end if;

  v_msg := null;
  begin perform public.admin_delete_member(ghost, 'a long enough reason'); exception when others then v_msg := sqlerrm; end;
  if v_msg is distinct from 'invalid_target' then raise exception 'PROBE-ASSERT unknown target: %', coalesce(v_msg, 'accepted'); end if;

  v_res := public.admin_delete_member(d, 'probe: duplicate account');
  reset role;

  if v_res->>'photoUrl' is null then raise exception 'PROBE-ASSERT photoUrl missing'; end if;
  if exists (select 1 from public.audit_log where target_id = ghost::text) then
    raise exception 'PROBE-ASSERT a refused deletion left an audit row';
  end if;
  select * into v_row from public.audit_log where action = 'member.delete' and target_id = d::text;
  if not found then raise exception 'PROBE-ASSERT no member.delete audit row'; end if;
  if v_row.actor_id is distinct from s
     or v_row.details->>'reason' is distinct from 'probe: duplicate account'
     or v_row.details->>'erased' is distinct from 'true' then
    raise exception 'PROBE-ASSERT member.delete row wrong: % / %', v_row.actor_id, v_row.details;
  end if;
  if exists (select 1 from public.profiles where id = d) or exists (select 1 from auth.users where id = d) then
    raise exception 'PROBE-ASSERT the person survived';
  end if;
  raise exception 'PROBE-ADMIN-OK';
end $probe$;`);
  if (!wrapper || !wrapper.includes("PROBE-ADMIN-OK")) {
    throw new Error(
      `admin wrapper: ${wrapper === null ? "no error raised (not rolled back)" : wrapper}`,
    );
  }
  console.log(
    "OK: admin_delete_member: role, reason, self, target checks; audit row kept with reason",
  );

  // B4. now the delegate really erases themself through the client RPC
  const { data: delegateRes, error: dErr } = await d.client.rpc("delete_my_account", {
    p_confirm: CONFIRM,
  });
  if (dErr) throw new Error(`delegate (with photo) delete: ${dErr.message}`);
  if (!delegateRes || delegateRes.photoUrl !== photoUrl) {
    throw new Error(
      `photoUrl should be returned for the app to remove: ${JSON.stringify(delegateRes)}`,
    );
  }
  const { data: open, error: openErr } = await db
    .from("memberships")
    .select("delegate_id, note")
    .eq("member_id", m.id)
    .is("ended_at", null)
    .single();
  if (openErr) throw new Error(`team row: ${openErr.message}`);
  if (open.delegate_id !== null || open.note !== "delegate_left") {
    throw new Error(`team row wrong: ${JSON.stringify(open)}`);
  }
  const { data: history } = await db
    .from("memberships")
    .select("delegate_id, ended_at")
    .eq("member_id", m.id)
    .not("ended_at", "is", null);
  if (history?.length !== 1 || history[0].delegate_id !== null) {
    throw new Error(`history row should survive unlinked: ${JSON.stringify(history)}`);
  }
  const { data: teammate } = await db.from("profiles").select("id").eq("id", m.id).maybeSingle();
  if (!teammate) throw new Error("teammate profile was removed with the delegate");
  const { data: dGone } = await db.from("delegates").select("id").eq("id", d.id).maybeSingle();
  if (dGone) throw new Error("delegates row survived");
  console.log(
    "OK: delegate with a photo erased, photoUrl returned; team on central, note=delegate_left",
  );

  // C. staff refused
  await expectError(
    s.client.rpc("delete_my_account", { p_confirm: CONFIRM }),
    "staff_account",
    "staff self-delete",
  );
  console.log("OK: staff account refused");

  // D. clients still cannot touch the audit log. On staging anon/authenticated hold the Supabase
  // default table grants on audit_log (measured 2026-10-08), so the door is row level security
  // with no policy: every row is invisible and unwritable, and an insert is refused. Run as each
  // client role in one rolled-back do block, so a hole could not leave a row behind.
  const { data: seen, error: seenErr } = await s.client.from("audit_log").select("id").limit(1);
  if (seenErr || seen?.length) {
    throw new Error(`client can read audit_log: ${seenErr ? seenErr.message : "rows returned"}`);
  }
  for (const role of ["authenticated", "anon"]) {
    const closed = sqlError(`
do $probe$
declare
  v_id bigint := (select min(id) from public.audit_log);
  v_n bigint;
  v_msg text;
begin
  if v_id is null then raise exception 'PROBE-NO-AUDIT-ROWS'; end if;
  set local role ${role};
  select count(*) into v_n from public.audit_log;
  if v_n <> 0 then raise exception 'PROBE-ASSERT % can see % audit rows', '${role}', v_n; end if;
  update public.audit_log set details = details where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'PROBE-ASSERT % updated % audit rows', '${role}', v_n; end if;
  delete from public.audit_log where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'PROBE-ASSERT % deleted % audit rows', '${role}', v_n; end if;
  begin
    insert into public.audit_log (actor_id, action, target_type) values (null, 'probe', 'probe');
  exception when others then v_msg := sqlerrm;
  end;
  if v_msg is null then raise exception 'PROBE-ASSERT % inserted an audit row', '${role}'; end if;
  raise exception 'PROBE-CLIENT-CLOSED';
end $probe$;`);
    if (!closed || !closed.includes("PROBE-CLIENT-CLOSED")) {
      throw new Error(`audit_log open to ${role}: ${closed === null ? "no error raised" : closed}`);
    }
  }
  console.log(
    "OK: audit_log closed to clients (authenticated and anon see, change and add nothing)",
  );

  // E. the trigger lock: the erasing setting alone does not open the log, only the owner of
  // erase_account() holding it does. service_role can run UPDATE, so a refusal here is the
  // trigger's, not a missing grant. Each case is one rolled-back do block on a real row.
  const touch = (setting, role, change, ending) => `
do $probe$
declare v_id bigint := (select min(id) from public.audit_log);
begin
  if v_id is null then raise exception 'PROBE-NO-AUDIT-ROWS'; end if;
  ${setting ? "perform set_config('app.erasing', 'on', true);" : ""}
  ${role ? `set local role ${role};` : ""}
  ${change};
  raise exception '${ending}';
end $probe$;`;
  const one = "where id = v_id";
  expectSql(
    touch(
      true,
      "service_role",
      `update public.audit_log set details = details ${one}`,
      "PROBE-LOCK-OPEN",
    ),
    "audit_log is append-only",
    "service_role with app.erasing on",
  );
  expectSql(
    touch(false, null, `update public.audit_log set details = details ${one}`, "PROBE-LOCK-OPEN"),
    "audit_log is append-only",
    "owner without app.erasing",
  );
  expectSql(
    touch(
      true,
      null,
      `update public.audit_log set action = action || 'x' ${one}`,
      "PROBE-LOCK-OPEN",
    ),
    "audit_log is append-only",
    "owner with app.erasing changing action",
  );
  expectSql(
    touch(true, null, `delete from public.audit_log ${one}`, "PROBE-LOCK-OPEN"),
    "audit_log is append-only",
    "owner with app.erasing deleting",
  );
  expectSql(
    touch(
      true,
      null,
      `update public.audit_log set details = details ${one}`,
      "PROBE-OWNER-ALLOWED",
    ),
    "PROBE-OWNER-ALLOWED",
    "control: owner with app.erasing, details only",
  );
  console.log(
    "OK: audit trigger lock: service_role + setting refused; owner without setting, owner changing " +
      "action and owner deleting refused; owner + setting + details-only allowed (control)",
  );

  // F. a deleted member's vote keeps counting, anonymously (needs an open poll)
  const { data: polls, error: pollErr } = await db
    .from("polls")
    .select("id, ends_at")
    .eq("status", "open");
  if (pollErr) throw new Error(`polls: ${pollErr.message}`);
  const poll = (polls ?? []).find((p) => !p.ends_at || new Date(p.ends_at) > new Date());
  if (!poll) {
    console.log("vote check skipped: no open poll on staging");
  } else {
    const { data: option, error: optErr } = await db
      .from("poll_options")
      .select("id")
      .eq("poll_id", poll.id)
      .order("position")
      .limit(1)
      .single();
    if (optErr) throw new Error(`poll option: ${optErr.message}`);
    const voter = await person("voter");
    const reader = await person("reader");
    for (const who of [voter, reader]) {
      const { error } = await who.client.rpc("member_cast_vote", {
        p_poll_id: poll.id,
        p_option_id: option.id,
      });
      if (error) throw new Error(`member_cast_vote: ${error.message}`);
      const { data: row, error: rowErr } = await db
        .from("poll_votes")
        .select("id")
        .eq("poll_id", poll.id)
        .eq("member_id", who.id)
        .single();
      if (rowErr) throw new Error(`vote row: ${rowErr.message}`);
      voteIds.push(row.id);
    }
    await expectError(
      voter.client.rpc("member_cast_vote", { p_poll_id: poll.id, p_option_id: option.id }),
      "already_voted",
      "second vote",
    );
    const before = await voteCount(poll.id, option.id);
    const viewBefore = await viewVotes(reader.client, poll.id, option.id);
    if (viewBefore !== before) throw new Error(`view ${viewBefore} vs table ${before} before`);
    const { error: voterErr } = await voter.client.rpc("delete_my_account", { p_confirm: CONFIRM });
    if (voterErr) throw new Error(`voter delete: ${voterErr.message}`);
    const after = await voteCount(poll.id, option.id);
    const viewAfter = await viewVotes(reader.client, poll.id, option.id);
    const { data: orphan, error: orphanErr } = await db
      .from("poll_votes")
      .select("id, member_id")
      .eq("id", voteIds[voteIds.length - 2])
      .single();
    if (orphanErr) throw new Error(`orphan vote row: ${orphanErr.message}`);
    if (after !== before || viewAfter !== before || orphan.member_id !== null) {
      throw new Error(
        `vote not kept anonymously: table ${before}->${after}, view ${viewBefore}->${viewAfter}, ` +
          `member_id ${orphan.member_id}`,
      );
    }
    console.log(
      `OK: vote kept after its member was erased (table and results view ${before} -> ${after}, member_id null)`,
    );
  }
} catch (err) {
  failed = true;
  console.error(`FAIL: ${redact(err instanceof Error ? err.message : err)}`);
} finally {
  // Order matters: memberships.delegate_id has no cascade, so memberships go before the users.
  const step = async (what, run) => {
    try {
      const { error } = await run();
      if (error) console.error(`cleanup ${what}: ${error.message}`);
    } catch (err) {
      console.error(`cleanup ${what}: ${err instanceof Error ? err.message : err}`);
    }
  };
  if (voteIds.length)
    await step("poll_votes", () => db.from("poll_votes").delete().in("id", voteIds));
  if (objects.length) await step("photo", () => db.storage.from(BUCKET).remove(objects));
  if (created.length) {
    await step("memberships (member)", () =>
      db.from("memberships").delete().in("member_id", created),
    );
    await step("memberships (delegate)", () =>
      db.from("memberships").delete().in("delegate_id", created),
    );
    await step("admin_roles", () => db.from("admin_roles").delete().in("user_id", created));
    await step("delegates", () => db.from("delegates").delete().in("id", created));
    for (const id of created) {
      await step(`auth user ${id}`, async () => {
        const { error } = await db.auth.admin.deleteUser(id);
        // already erased by the probe itself
        return { error: error && !/not found/i.test(error.message) ? error : null };
      });
    }
  }
  rmSync(scratch, { recursive: true, force: true });

  // Residue check: nothing the probe made may remain.
  const left = [];
  if (created.length) {
    for (const [table, column] of [
      ["profiles", "id"],
      ["delegates", "id"],
      ["admin_roles", "user_id"],
      ["memberships", "member_id"],
      ["memberships", "delegate_id"],
    ]) {
      const { count, error } = await db
        .from(table)
        .select(column, { count: "exact", head: true })
        .in(column, created);
      if (error) left.push(`${table}: ${error.message}`);
      else if (count) left.push(`${table}.${column}: ${count}`);
    }
    for (const id of created) {
      const { data } = await db.auth.admin.getUserById(id);
      if (data?.user) left.push(`auth user ${id}`);
    }
  }
  if (voteIds.length) {
    const { count } = await db
      .from("poll_votes")
      .select("id", { count: "exact", head: true })
      .in("id", voteIds);
    if (count) left.push(`poll_votes: ${count}`);
  }
  if (left.length) {
    failed = true;
    console.error(`FAIL: cleanup left residue: ${left.join("; ")}`);
  } else {
    console.log(`OK: cleanup complete (${created.length} throwaway users, nothing left behind)`);
  }
}
if (failed) process.exitCode = 1;
