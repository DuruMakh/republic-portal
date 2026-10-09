// Live probe for account deletion (plan 2026-10-08-account-deletion, Task 2). STAGING ONLY.
// Run: node --env-file=.env.local scripts/verify-account-deletion.mjs
//
// Proves migrations 20261009140000_account_deletion.sql,
// 20261009150000_account_deletion_hardening.sql, 20261009160000_account_deletion_followups.sql and
// 20261009170000_account_deletion_races.sql against the real staging database: the member /
// delegate / staff paths through the client RPCs, the closed doors (anon, direct erase_account
// for a client and for service_role, non-super-admin), the audit-log lock, the audit scrub, the admin wrapper, former staff refused
// with the blocking key named, votes (deleted in a running poll, kept anonymously in a closed or
// past-deadline one), SMS send reservations (older than 24 hours deleted, newer ones kept without
// the account, their verification challenge gone), the hourly purge job and its command, the
// erasure guards of seven admin RPCs and the team capture in the live function bodies, and
// Supabase auth's own log scrubbed. Everything it creates is removed again, on failure too.
//
// Pass sentinels are assembled by the database at run time ('PROBE-' || 'NAME'), so an error
// that echoes the SQL text back can never contain one and pass a check by accident.
//
// Anything that would leave a row behind that cannot be removed (audit_log is append-only) is
// run inside a single `do` block that ends in a deliberate `raise exception`, so Postgres rolls
// the whole experiment back. SQL goes through `supabase db query --db-url` (the Management API
// route behind `--linked` refuses this account), the same route verify-security-fixes.mjs uses;
// the connection string is never printed.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
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
const pollIds = []; // throwaway polls (their options and votes cascade)
const reservationIds = []; // phone_verification_send_reservations.id
const challengeIds = []; // phone_verification_challenges.id
let cities = null;

const PURGE_JOB = "purge-anonymous-sms-reservations";
const PURGE_COMMAND =
  "delete from public.phone_verification_send_reservations " +
  "where user_id is null and created_at < now() - interval '24 hours'";
const DAY_MS = 24 * 60 * 60 * 1000;
const hex64 = () => randomBytes(32).toString("hex");

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

/** SQL for a pass sentinel, joined by the database: `PROBE-<name>` never appears in the text. */
const pass = (name) => `'PROBE-' || '${name}'`;

/** Runs one read-only statement and returns its rows (the CLI's JSON output). */
function sqlRows(text) {
  const file = join(scratch, `q-${randomBytes(6).toString("hex")}.sql`);
  writeFileSync(file, text);
  try {
    const out = execFileSync(
      process.execPath,
      [SUPABASE_CLI, "db", "query", "-f", file, "--db-url", DB_URL, "--output-format", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 },
    );
    return JSON.parse(out.slice(out.indexOf("{"))).rows ?? [];
  } catch (err) {
    throw new Error(`query failed: ${redact(err.stdout || err.stderr || err.message)}`);
  } finally {
    rmSync(file, { force: true });
  }
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

  // 0b. the hardening migration is on this database too (catalog, read-only)
  const [catalog] = sqlRows(`
select
  has_function_privilege('service_role', 'public.erase_account(uuid)', 'EXECUTE') as service_role_erase,
  has_sequence_privilege('anon', 'public.poll_votes_id_seq', 'USAGE, SELECT, UPDATE') as anon_seq,
  has_sequence_privilege('authenticated', 'public.poll_votes_id_seq', 'USAGE, SELECT, UPDATE') as authenticated_seq,
  (select attnotnull from pg_catalog.pg_attribute
    where attrelid = 'public.phone_verification_send_reservations'::regclass
      and attname = 'user_id') as reservation_user_not_null,
  (select confdeltype from pg_catalog.pg_constraint
    where conname = 'phone_verification_send_reservations_user_id_fkey') as reservation_fk_on_delete`);
  if (
    catalog?.service_role_erase !== false ||
    catalog.anon_seq !== false ||
    catalog.authenticated_seq !== false ||
    catalog.reservation_user_not_null !== false ||
    catalog.reservation_fk_on_delete !== "n"
  ) {
    throw new Error(`hardening not in place: ${JSON.stringify(catalog)}`);
  }
  await expectError(
    db.rpc("erase_account", { p_user_id: randomUUID() }),
    "permission denied",
    "service_role calling erase_account",
  );
  console.log(
    "OK: hardening applied: erase_account closed to service_role (catalog and API), vote id " +
      "sequence closed to anon/authenticated, SMS reservations' user_id nullable and set null",
  );

  // 0c. the follow-ups and races migrations are on this database too (catalog, read-only): the
  // live bodies carry every erasure guard (a FOUND check right after the UPDATE in four admin
  // RPCs, a FOR SHARE profile read plus not-found refusal in three), erase_account's membership
  // lock, team capture and reservation delete; the seven admin RPCs keep their grants; the purge
  // job is scheduled once, hourly, with its command.
  const FOUND_GUARDED = [
    "public.admin_approve_delegate(uuid,text)",
    "public.admin_reject_delegate(uuid,text)",
    "public.admin_update_delegate_name(uuid,text,text)",
    "public.admin_update_delegate_profile(uuid,text,text)",
  ];
  const SHARE_GUARDED = [
    "public.admin_reveal_personal_id(uuid)",
    "public.admin_reveal_applicant_personal_id(uuid)",
    "public.admin_void_payment(bigint,text)",
  ];
  const sqlList = (sigs) => sigs.map((s) => `'${s}'`).join(", ");
  const [followups] = sqlRows(`
with guarded as (
  select f, regexp_replace(p.prosrc, '\\s+', ' ', 'g') as src
    from unnest(array[${sqlList([...FOUND_GUARDED, ...SHARE_GUARDED])}]) as f
    join pg_catalog.pg_proc p on p.oid = f::regprocedure
)
select
  (select array_agg(f order by f) from guarded
    where f in (${sqlList(FOUND_GUARDED)})
      and src ~ 'update public\\.[a-z_]+ set [^;]*; if not found then raise exception ''invalid_target''; end if;')
    as found_guarded,
  (select array_agg(f order by f) from guarded
    where f in (${sqlList(SHARE_GUARDED)})
      and src ~ 'from public\\.profiles where id = [a-z_.]+ for share; if not found then raise exception ''invalid_target''; end if;')
    as share_guarded,
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE')
                   and not has_function_privilege('anon', f, 'EXECUTE'))
     from guarded) as admin_grants_kept,
  (select regexp_replace(prosrc, '\\s+', ' ', 'g') from pg_catalog.pg_proc
    where oid = 'public.erase_account(uuid)'::regprocedure) as erase_src`);
  const eraseSrc = String(followups?.erase_src ?? "");
  const eraseNeeds = [
    "from public.memberships where member_id = p_user_id and ended_at is null for update;",
    "where delegate_id = p_user_id and ended_at is null returning member_id ) " +
      "select coalesce(array_agg(member_id), '{}') into v_team from ended;",
    "delete from public.phone_verification_send_reservations where user_id = p_user_id " +
      "and created_at < now() - interval '24 hours';",
  ].filter((needle) => !eraseSrc.includes(needle));
  const missing = (got, want) => want.filter((sig) => !(got ?? []).includes(sig));
  const foundMissing = missing(followups?.found_guarded, FOUND_GUARDED);
  const shareMissing = missing(followups?.share_guarded, SHARE_GUARDED);
  if (
    foundMissing.length ||
    shareMissing.length ||
    followups.admin_grants_kept !== true ||
    eraseNeeds.length
  ) {
    throw new Error(
      `erasure guards not in place: no FOUND check ${JSON.stringify(foundMissing)}, no FOR ` +
        `SHARE read ${JSON.stringify(shareMissing)}, admin grants kept ` +
        `${followups?.admin_grants_kept}, erase_account lacks ${JSON.stringify(eraseNeeds)}`,
    );
  }
  const jobs = sqlRows(`select jobname, schedule, command, active, username from cron.job
                         where jobname = '${PURGE_JOB}'`);
  if (
    jobs.length !== 1 ||
    jobs[0].schedule !== "17 * * * *" ||
    jobs[0].command !== PURGE_COMMAND ||
    jobs[0].active !== true
  ) {
    throw new Error(`purge job wrong: ${JSON.stringify(jobs)}`);
  }
  console.log(
    "OK: erasure guards live: FOUND check after the UPDATE in approve/reject/update_name/" +
      "update_profile, FOR SHARE profile read in reveal/reveal_applicant/void_payment (all seven " +
      "grants unchanged); erase_account locks the membership row, captures the team via " +
      `returning, deletes reservations older than 24 hours; cron job ${PURGE_JOB} scheduled ` +
      `once, hourly at minute 17, active, runs as ${jobs[0].username}`,
  );

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

  // A1. former staff: an audit row with the person as actor blocks the erasure, which is refused
  // as staff_history naming the foreign key, and nothing is half-erased. Rolled back, so the
  // append-only audit row never persists.
  const formerStaff = sqlError(`
do $probe$
declare
  x constant uuid := ${uuid(a.id)};
  v_msg text;
  v_detail text;
begin
  insert into public.audit_log (actor_id, action, target_type) values (x, 'probe.actor', 'probe');
  begin
    perform public.erase_account(x);
  exception when others then
    get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
  end;
  if v_msg is distinct from 'staff_history' then
    raise exception 'PROBE-ASSERT former staff: %', coalesce(v_msg, 'erased');
  end if;
  if v_detail is null or v_detail not like '%audit_log_actor_id_fkey%' then
    raise exception 'PROBE-ASSERT staff_history detail: %', coalesce(v_detail, 'none');
  end if;
  if not exists (select 1 from public.profiles where id = x)
     or not exists (select 1 from auth.users where id = x) then
    raise exception 'PROBE-ASSERT a refused erasure removed the person';
  end if;
  raise exception '%: %', ${pass("HISTORY-OK")}, v_detail;
end $probe$;`);
  if (!formerStaff || !formerStaff.includes("PROBE-HISTORY-OK")) {
    throw new Error(
      `former staff: ${formerStaff === null ? "no error raised (not rolled back)" : formerStaff}`,
    );
  }
  console.log(
    `OK: former staff refused as staff_history, detail "${formerStaff.split("PROBE-HISTORY-OK: ")[1]}"`,
  );

  // A2. SMS send reservations of the person (a recent one, a recent one linked to a verification
  // challenge, one sent two days ago), and Supabase auth's own log about them
  const smsPhone = `+99555${randomInt(1000000, 9999999)}`;
  const { data: challenge, error: chErr } = await db
    .from("phone_verification_challenges")
    .insert({
      user_id: a.id,
      phone: smsPhone,
      purpose: "registration",
      provider: "test",
      provider_request_id: `probe-account-deletion-${randomBytes(8).toString("hex")}`,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (chErr) throw new Error(`challenge insert: ${chErr.message}`);
  challengeIds.push(challenge.id);
  const { data: reservations, error: rErr } = await db
    .from("phone_verification_send_reservations")
    // every row names every column: a bulk insert sends null for a column a row leaves out
    .insert(
      [
        [null, new Date()],
        [challenge.id, new Date()],
        [null, new Date(Date.now() - 2 * DAY_MS)],
      ].map(([challengeId, at]) => ({
        user_id: a.id,
        phone: smsPhone,
        idempotency_key: hex64(),
        challenge_id: challengeId,
        created_at: at.toISOString(),
      })),
    )
    .select("id, challenge_id, created_at");
  if (rErr) throw new Error(`reservation insert: ${rErr.message}`);
  reservationIds.push(...reservations.map((r) => r.id));
  const linked = reservations.find((r) => r.challenge_id === challenge.id);
  const old = reservations.find((r) => Date.parse(r.created_at) < Date.now() - DAY_MS);
  const recent = reservations.find((r) => r !== linked && r !== old);
  if (!linked || !old || !recent) {
    throw new Error(`reservation fixtures wrong: ${JSON.stringify(reservations)}`);
  }
  const authLog = () =>
    sqlRows(`select count(*)::int as n from auth.audit_log_entries
              where payload ->> 'actor_id' = ${uuid(a.id)}::text`)[0]?.n;
  const authLogBefore = authLog();

  const { data: memberRes, error: delErr } = await a.client.rpc("delete_my_account", {
    p_confirm: CONFIRM,
  });
  if (delErr)
    throw new Error(`delete_my_account (owner may lack delete on auth.users?): ${delErr.message}`);
  if (!memberRes || memberRes.photoUrl !== null) {
    throw new Error(`member result should be { photoUrl: null }: ${JSON.stringify(memberRes)}`);
  }
  const { data: gone, error: goneErr } = await db
    .from("profiles")
    .select("id")
    .eq("id", a.id)
    .maybeSingle();
  if (goneErr) throw new Error(`profile read: ${goneErr.message}`);
  if (gone) throw new Error("profile survived");
  const { data: authUser } = await db.auth.admin.getUserById(a.id);
  if (authUser?.user) throw new Error("auth user survived");
  console.log("OK: member erased with the sign-in account (result { photoUrl: null })");

  const { data: after, error: afterErr } = await db
    .from("phone_verification_send_reservations")
    .select("id, user_id, challenge_id")
    .in("id", [recent.id, linked.id, old.id]);
  if (afterErr) throw new Error(`reservation read: ${afterErr.message}`);
  const byId = new Map(after.map((r) => [r.id, r]));
  if (byId.has(old.id)) {
    throw new Error(
      `reservation older than 24 hours survived: ${JSON.stringify(byId.get(old.id))}`,
    );
  }
  for (const r of [recent, linked]) {
    const kept = byId.get(r.id);
    if (!kept || kept.user_id !== null || kept.challenge_id !== null) {
      throw new Error(
        `recent reservation should survive without the account: ${JSON.stringify(kept)}`,
      );
    }
  }
  const { data: challengeLeft, error: chReadErr } = await db
    .from("phone_verification_challenges")
    .select("id")
    .eq("id", challenge.id)
    .maybeSingle();
  if (chReadErr) throw new Error(`challenge read: ${chReadErr.message}`);
  if (challengeLeft) throw new Error("verification challenge survived the erasure");
  console.log(
    "OK: SMS send reservations: the one older than 24 hours deleted; the two recent ones kept " +
      "with user_id null (send limits keep counting); the verification challenge deleted and " +
      "the linked reservation's challenge_id null",
  );

  const authLogAfter = authLog();
  if (authLogAfter !== 0) throw new Error(`auth log rows of the member left: ${authLogAfter}`);
  console.log(
    `OK: auth log rows with the member as actor: ${authLogBefore} before, ${authLogAfter} after` +
      (authLogBefore === 0
        ? " (this auth server wrote none; the rolled-back check below proves the delete)"
        : ""),
  );

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
  raise exception '%', ${pass("SCRUB-OK")};
end $probe$;`);
  if (!scrub || !scrub.includes("PROBE-SCRUB-OK")) {
    throw new Error(`audit scrub: ${scrub === null ? "no error raised (not rolled back)" : scrub}`);
  }
  console.log("OK: audit scrub strips every personal key, marks rows erased, keeps the rest");

  // B1b. Supabase auth's own log: rows with the person as actor go, other actors' rows stay.
  // Two made-up entries, rolled back, so the check holds even when the auth server writes none.
  const authScrub = sqlError(`
do $probe$
declare
  d constant uuid := ${uuid(d.id)};
  other constant uuid := gen_random_uuid();
  v_can boolean := has_table_privilege(
    (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
      where oid = 'public.erase_account(uuid)'::pg_catalog.regprocedure),
    'auth.audit_log_entries', 'DELETE');
begin
  insert into auth.audit_log_entries (id, payload, created_at, ip_address) values
    (gen_random_uuid(), json_build_object('actor_id', d::text, 'action', 'login'), now(), ''),
    (gen_random_uuid(), json_build_object('actor_id', other::text, 'action', 'login'), now(), '');
  perform public.erase_account(d);
  if v_can and exists (select 1 from auth.audit_log_entries where payload ->> 'actor_id' = d::text) then
    raise exception 'PROBE-ASSERT auth log rows of the person survived';
  end if;
  if not v_can and not exists (select 1 from auth.audit_log_entries where payload ->> 'actor_id' = d::text) then
    raise exception 'PROBE-ASSERT auth log rows vanished without the privilege';
  end if;
  if not exists (select 1 from auth.audit_log_entries where payload ->> 'actor_id' = other::text) then
    raise exception 'PROBE-ASSERT another actor''s auth log row was deleted';
  end if;
  if exists (select 1 from public.profiles where id = d) then
    raise exception 'PROBE-ASSERT the erasure did not finish';
  end if;
  raise exception '%', ${pass("AUTHLOG-")} || case when v_can then 'SCRUBBED' else 'NO-PRIVILEGE' end;
end $probe$;`);
  if (authScrub?.includes("PROBE-AUTHLOG-SCRUBBED")) {
    console.log(
      "OK: auth log scrub had privilege: yes (the person's rows deleted, another actor's kept)",
    );
  } else if (authScrub?.includes("PROBE-AUTHLOG-NO-PRIVILEGE")) {
    console.log(
      "OK: auth log scrub had privilege: NO (erasure still finished; the rows wait for the " +
        "auth log's own retention)",
    );
  } else {
    throw new Error(
      `auth log scrub: ${authScrub === null ? "no error raised (not rolled back)" : authScrub}`,
    );
  }

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
  raise exception '%', ${pass("ADMIN-OK")};
end $probe$;`);
  if (!wrapper || !wrapper.includes("PROBE-ADMIN-OK")) {
    throw new Error(
      `admin wrapper: ${wrapper === null ? "no error raised (not rolled back)" : wrapper}`,
    );
  }
  console.log(
    "OK: admin_delete_member: role, reason, self, target checks; audit row kept with reason",
  );

  // B3b. the guarded admin RPCs still work for a living person (their FOR SHARE read and FOUND
  // check run as the definer) and refuse a missing one; rolled back, so their audit rows never
  // persist. The race itself needs two sessions; the catalog check (0c) and the unit pins cover it.
  const guarded = sqlError(`
do $probe$
declare
  s constant uuid := ${uuid(s.id)};
  d constant uuid := ${uuid(d.id)};
  v_pid text := (select personal_id from public.profiles where id = d);
  v_got text;
  v_msg text;
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', s, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_got := public.admin_reveal_personal_id(d);
  if v_got is distinct from v_pid then raise exception 'PROBE-ASSERT reveal returned the wrong id'; end if;
  v_got := public.admin_reveal_applicant_personal_id(d);
  if v_got is distinct from v_pid then raise exception 'PROBE-ASSERT applicant reveal returned the wrong id'; end if;
  perform public.admin_update_delegate_profile(d, 'probe bio', null);
  begin perform public.admin_reveal_personal_id(gen_random_uuid()); exception when others then v_msg := sqlerrm; end;
  if v_msg is distinct from 'invalid_target' then raise exception 'PROBE-ASSERT reveal of nobody: %', coalesce(v_msg, 'accepted'); end if;
  reset role;
  if (select bio from public.delegates where id = d) is distinct from 'probe bio' then
    raise exception 'PROBE-ASSERT the profile edit did not land';
  end if;
  if (select count(*) from public.audit_log where target_id = d::text
       and action in ('member.reveal_personal_id', 'delegate.reveal_personal_id', 'delegate.update_profile')) <> 3 then
    raise exception 'PROBE-ASSERT the three audit rows were not written';
  end if;
  raise exception '%', ${pass("GUARDED-OK")};
end $probe$;`);
  if (!guarded || !guarded.includes("PROBE-GUARDED-OK")) {
    throw new Error(
      `guarded admin RPCs: ${guarded === null ? "no error raised (not rolled back)" : guarded}`,
    );
  }
  console.log(
    "OK: reveal, applicant reveal and profile edit still work for a living person (audited, " +
      "rolled back); reveal of a missing person refused as invalid_target",
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
  raise exception '%', ${pass("CLIENT-CLOSED")};
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
  raise exception '%', ${pass(ending)};
end $probe$;`;
  const one = "where id = v_id";
  expectSql(
    touch(
      true,
      "service_role",
      `update public.audit_log set details = details ${one}`,
      "LOCK-OPEN",
    ),
    "audit_log is append-only",
    "service_role with app.erasing on",
  );
  expectSql(
    touch(false, null, `update public.audit_log set details = details ${one}`, "LOCK-OPEN"),
    "audit_log is append-only",
    "owner without app.erasing",
  );
  expectSql(
    touch(true, null, `update public.audit_log set action = action || 'x' ${one}`, "LOCK-OPEN"),
    "audit_log is append-only",
    "owner with app.erasing changing action",
  );
  expectSql(
    touch(true, null, `delete from public.audit_log ${one}`, "LOCK-OPEN"),
    "audit_log is append-only",
    "owner with app.erasing deleting",
  );
  expectSql(
    touch(true, null, `update public.audit_log set details = details ${one}`, "OWNER-ALLOWED"),
    "PROBE-OWNER-ALLOWED",
    "control: owner with app.erasing, details only",
  );
  console.log(
    "OK: audit trigger lock: service_role + setting refused; owner without setting, owner changing " +
      "action and owner deleting refused; owner + setting + details-only allowed (control)",
  );

  // F. votes. Three throwaway polls (direct inserts, no audit row): one still running, one that
  // closes after the votes, one whose deadline passes after the votes. The erasure deletes the
  // running poll's vote (a re-registered person must not vote twice) and keeps the other two
  // anonymously, so finished results never change.
  const voter = await person("voter");
  const reader = await person("reader");
  async function throwawayPoll(label) {
    const { data: poll, error } = await db
      .from("polls")
      .insert({
        question: `probe: account deletion, ${label} (removed automatically)`,
        status: "open",
        opened_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`poll ${label}: ${error.message}`);
    pollIds.push(poll.id);
    const { data: options, error: oErr } = await db
      .from("poll_options")
      .insert([
        { poll_id: poll.id, position: 1, label: "A" },
        { poll_id: poll.id, position: 2, label: "B" },
      ])
      .select("id, position");
    if (oErr) throw new Error(`poll options ${label}: ${oErr.message}`);
    const option = options.find((o) => o.position === 1).id;
    for (const who of [voter, reader]) {
      const { error: vErr } = await who.client.rpc("member_cast_vote", {
        p_poll_id: poll.id,
        p_option_id: option,
      });
      if (vErr) throw new Error(`member_cast_vote ${label}: ${vErr.message}`);
    }
    const { data: row, error: rowErr } = await db
      .from("poll_votes")
      .select("id")
      .eq("poll_id", poll.id)
      .eq("member_id", voter.id)
      .single();
    if (rowErr) throw new Error(`vote row ${label}: ${rowErr.message}`);
    voteIds.push(row.id);
    return { label, id: poll.id, option, voteId: row.id };
  }
  const running = await throwawayPoll("running");
  const closed = await throwawayPoll("closed");
  const pastDeadline = await throwawayPoll("past deadline");
  await expectError(
    voter.client.rpc("member_cast_vote", { p_poll_id: running.id, p_option_id: running.option }),
    "already_voted",
    "second vote",
  );
  const { error: closeErr } = await db
    .from("polls")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", closed.id);
  if (closeErr) throw new Error(`close poll: ${closeErr.message}`);
  const { error: deadlineErr } = await db
    .from("polls")
    .update({ ends_at: new Date(Date.now() - 60 * 1000).toISOString() })
    .eq("id", pastDeadline.id);
  if (deadlineErr) throw new Error(`past deadline: ${deadlineErr.message}`);

  const before = {};
  for (const p of [running, closed, pastDeadline]) {
    const table = await voteCount(p.id, p.option);
    const view = await viewVotes(reader.client, p.id, p.option);
    if (table !== 2 || view !== 2)
      throw new Error(`${p.label} before: table ${table}, view ${view}`);
    before[p.label] = table;
  }
  const { error: voterErr } = await voter.client.rpc("delete_my_account", { p_confirm: CONFIRM });
  if (voterErr) throw new Error(`voter delete: ${voterErr.message}`);

  const { data: runningRow, error: runningErr } = await db
    .from("poll_votes")
    .select("id")
    .eq("id", running.voteId)
    .maybeSingle();
  if (runningErr) throw new Error(`running vote row: ${runningErr.message}`);
  const runningTable = await voteCount(running.id, running.option);
  const runningView = await viewVotes(reader.client, running.id, running.option);
  if (runningRow || runningTable !== 1 || runningView !== 1) {
    throw new Error(
      `running poll vote should be gone: row ${runningRow ? "kept" : "gone"}, ` +
        `table 2->${runningTable}, view 2->${runningView}`,
    );
  }
  console.log("OK: vote in a running poll deleted with its member (table and results view 2 -> 1)");
  for (const p of [closed, pastDeadline]) {
    const { data: orphan, error: orphanErr } = await db
      .from("poll_votes")
      .select("id, member_id")
      .eq("id", p.voteId)
      .single();
    if (orphanErr) throw new Error(`${p.label} vote row: ${orphanErr.message}`);
    const table = await voteCount(p.id, p.option);
    const view = await viewVotes(reader.client, p.id, p.option);
    if (orphan.member_id !== null || table !== before[p.label] || view !== before[p.label]) {
      throw new Error(
        `${p.label} poll vote not kept anonymously: table ${before[p.label]}->${table}, ` +
          `view ${before[p.label]}->${view}, member_id ${orphan.member_id}`,
      );
    }
    console.log(
      `OK: vote in a ${p.label} poll kept anonymously (table and results view ` +
        `${before[p.label]} -> ${table}, member_id null)`,
    );
  }

  // G. the hourly purge: the command the cron job really stores, run here as the same role that
  // scheduled it, removes anonymized reservations older than 24 hours and nothing else. Three
  // made-up rows inside one rolled-back block, so nothing persists and nothing real is lost.
  const purgePhone = `+99555${randomInt(1000000, 9999999)}`;
  const keys = [hex64(), hex64(), hex64()];
  if (!keys.every((k) => /^[a-f0-9]{64}$/.test(k))) throw new Error("bad idempotency key");
  const purge = sqlError(`
do $probe$
declare
  u constant uuid := ${uuid(reader.id)};
  v_cmd text := (select command from cron.job where jobname = '${PURGE_JOB}');
  v_old_anon uuid;
  v_new_anon uuid;
  v_old_owned uuid;
begin
  if v_cmd is null then raise exception 'PROBE-ASSERT purge job missing'; end if;
  insert into public.phone_verification_send_reservations (user_id, phone, idempotency_key, created_at)
    values (null, '${purgePhone}', '${keys[0]}', now() - interval '25 hours') returning id into v_old_anon;
  insert into public.phone_verification_send_reservations (user_id, phone, idempotency_key, created_at)
    values (null, '${purgePhone}', '${keys[1]}', now() - interval '23 hours') returning id into v_new_anon;
  insert into public.phone_verification_send_reservations (user_id, phone, idempotency_key, created_at)
    values (u, '${purgePhone}', '${keys[2]}', now() - interval '25 hours') returning id into v_old_owned;
  execute v_cmd;
  if exists (select 1 from public.phone_verification_send_reservations where id = v_old_anon) then
    raise exception 'PROBE-ASSERT an anonymized reservation older than 24 hours survived the purge';
  end if;
  if not exists (select 1 from public.phone_verification_send_reservations where id = v_new_anon) then
    raise exception 'PROBE-ASSERT the purge removed an anonymized reservation younger than 24 hours';
  end if;
  if not exists (select 1 from public.phone_verification_send_reservations where id = v_old_owned) then
    raise exception 'PROBE-ASSERT the purge removed a reservation that still has its account';
  end if;
  raise exception '%', ${pass("PURGE-OK")};
end $probe$;`);
  if (!purge || !purge.includes("PROBE-PURGE-OK")) {
    throw new Error(
      `purge job command: ${purge === null ? "no error raised (not rolled back)" : purge}`,
    );
  }
  console.log(
    "OK: the purge job's stored command removes anonymized reservations older than 24 hours " +
      "only (younger anonymized and account-linked old rows kept; rolled back)",
  );
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
  // the throwaway polls take their options and every vote on them along (cascade)
  if (pollIds.length) await step("polls", () => db.from("polls").delete().in("id", pollIds));
  if (voteIds.length)
    await step("poll_votes", () => db.from("poll_votes").delete().in("id", voteIds));
  if (reservationIds.length) {
    await step("sms reservations", () =>
      db.from("phone_verification_send_reservations").delete().in("id", reservationIds),
    );
  }
  if (challengeIds.length) {
    await step("verification challenges", () =>
      db.from("phone_verification_challenges").delete().in("id", challengeIds),
    );
  }
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
  for (const [table, ids] of [
    ["poll_votes", voteIds],
    ["polls", pollIds],
    ["phone_verification_send_reservations", reservationIds],
    ["phone_verification_challenges", challengeIds],
  ]) {
    if (!ids.length) continue;
    const { count, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true })
      .in("id", ids);
    if (error) left.push(`${table}: ${error.message}`);
    else if (count) left.push(`${table}: ${count}`);
  }
  if (left.length) {
    failed = true;
    console.error(`FAIL: cleanup left residue: ${left.join("; ")}`);
  } else {
    console.log(`OK: cleanup complete (${created.length} throwaway users, nothing left behind)`);
  }
}
if (failed) process.exitCode = 1;
