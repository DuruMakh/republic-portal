/**
 * The twelve audit actor positions (spec §2.1:
 * docs/superpowers/specs/2026-07-25-security-checkup-design.md) and the
 * machinery to impersonate each one for real: mint a session the way an
 * attacker's own client would (signInWithOtp on the anon key, read the code
 * from dev_otp_inbox with the service client, verifyOtp, keep the
 * access_token), then hand back a PostgREST client bound to that JWT. Probing
 * then goes straight to PostgREST — the app's own UI is never involved, which
 * is the correct threat perspective: an attacker does not use our UI either.
 *
 * A1 (anonymous) needs no session at all — the bare anon key. A2 (signed in,
 * no profile row) is a real, reachable state — login mints an auth session
 * before register() ever runs — and is created here with deliberately NO
 * profiles row. A9-A12 are the four canonical staging admins seeded by
 * scripts/seed-staging.mjs; they and A1 are never created here, only looked
 * up.
 *
 * A3-A8 are driven to their declared standing (ACTORS[id].standing /
 * .delegate) through the app's own RPCs — the same doors a real member,
 * delegate or admin would use — never by hand-writing rows with the service
 * role. See driveStandings() below; every RPC name/signature is cited against
 * the migration that defines it.
 *
 * Every audit-created user (A2-A8, plus the one auxiliary team-member fixture
 * for A7) is tagged user_metadata.audit_tag so the end-of-phase reseed
 * (scripts/seed-staging.mjs) can identify and sweep them.
 *
 * Run: node --env-file=.env.local scripts/security/actors.mjs --verify
 */
import { createClient } from "@supabase/supabase-js";
import { db, anonClient, url, anonKey } from "./db.mjs";
import { readFreshInboxOtp } from "./otp.mjs";
import { getValidCachedSession, mergeCacheEntries } from "./session-cache.mjs";

export { db, anonClient };

/**
 * Phones reserved for the audit. +995509001xxx sits outside the seed's
 * +99550XXXXXXX roster (scripts/seed-staging.mjs phoneFor: "+99550" + a
 * 7-digit zero-padded member index over the ~1,900-person seeded roster —
 * nowhere near 9001xxx) and outside the four canonical admin phones
 * (+995509000001..4, A9-A12 below). Confirmed free against live auth.users
 * and profiles on staging on 2026-07-25 (zero collisions) before this table
 * was written — see .superpowers/sdd/task-1-report.md. 509001009 (the
 * auxiliary team-member fixture below) was confirmed free the same way.
 */
export const ACTORS = {
  A1: { label: "anonymous", phone: null, standing: null },
  A2: { label: "signed in, no profile", phone: "509001002", standing: null },
  A3: { label: "registered", phone: "509001003", standing: "registered" },
  A4: { label: "profile_completed", phone: "509001004", standing: "profile_completed" },
  A5: { label: "active_member", phone: "509001005", standing: "active_member" },
  A6: {
    label: "pending delegate",
    phone: "509001006",
    standing: "active_member",
    delegate: "pending",
  },
  A7: {
    label: "approved delegate",
    phone: "509001007",
    standing: "active_member",
    delegate: "approved",
  },
  A8: {
    label: "rejected delegate",
    phone: "509001008",
    standing: "active_member",
    delegate: "rejected",
  },
  // A9-A12 declare profile_completed, NOT active_member: that is their real
  // state on staging, verified directly against profiles on 2026-07-25. The
  // declaration must describe what the account IS, because later tasks read
  // this table to decide what a given actor should be able to reach — a
  // standing stated here but not true in the database would silently invalidate
  // every expectation derived from it. Their standing is now asserted by
  // --verify like every other actor's.
  A9: {
    label: "super_admin",
    phone: "509000001",
    standing: "profile_completed",
    role: "super_admin",
  },
  A10: { label: "verifier", phone: "509000002", standing: "profile_completed", role: "verifier" },
  A11: { label: "finance", phone: "509000003", standing: "profile_completed", role: "finance" },
  A12: { label: "editor", phone: "509000004", standing: "profile_completed", role: "editor" },
};

/** Canonical iteration order for the probe matrix used by Task 4. */
export const ACTOR_IDS = Object.keys(ACTORS);

const AUDIT_TAG = "security-audit-2026-07";

/**
 * Auxiliary fixture, deliberately NOT one of the twelve audit positions (it
 * has no ActorId and is never added to ACTORS/ACTOR_IDS — Task 4's matrix
 * loop must keep iterating over exactly twelve). A7 ("approved delegate")
 * needs a real team member bound to it, or "can a delegate read a rival
 * delegate's team" has no data to probe against. This is a second real,
 * completed member who ends up on A7's team via member_change_delegate, the
 * same RPC any member uses to pick a delegate.
 */
const TEAM_MEMBER_PHONE = "509001009";

/**
 * Set by provisionActorsOnce() below; read through auditTeamMember(). Task 6
 * needs this fixture as a WRITE target it is allowed to spend: it is the only
 * completed-member account in the whole audit that is not one of the twelve
 * probe positions, so a mutation aimed at it can never contaminate an actor's
 * declared standing, and it is audit-tagged (unlike A9-A12, the canonical
 * staging admins, which this audit must not mutate at all). It stays OUT of
 * ACTORS/ACTOR_IDS — the probe matrix must keep iterating over exactly twelve.
 */
let _teamMember = null;

/** The auxiliary team-member fixture, available after provisionActors() resolves. */
export function auditTeamMember() {
  if (!_teamMember) {
    throw new Error("auditTeamMember() called before provisionActors() resolved");
  }
  return _teamMember;
}

async function findUserByPhone(phone) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.phone === `995${phone}`);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
}

async function ensureUser(phone) {
  const existing = await findUserByPhone(phone);
  if (existing) return existing;
  const { data, error } = await db.auth.admin.createUser({
    phone: `995${phone}`,
    phone_confirm: true,
    user_metadata: { audit_tag: AUDIT_TAG },
  });
  if (error) throw error;
  return data.user;
}

/**
 * Mints (or reuses) a session for `phone`. `pending`, when supplied, is a
 * shared accumulator that a freshly-minted {accessToken, expiresAt} gets
 * written into — see provisionActorsOnce for why the actual disk write is
 * batched rather than done here per-phone. `fresh: true` skips the cache
 * read entirely (still writes the new session back to `pending`, so a
 * `--fresh` run still leaves the cache usable for the next normal run).
 */
async function mintSession(phone, { fresh = false, pending } = {}) {
  if (!fresh) {
    const cached = getValidCachedSession(phone);
    if (cached) {
      _sessionStats.hit++;
      console.log(`session cache HIT  ${phone}`);
      return cached;
    }
  }
  _sessionStats.minted++;
  console.log(`session cache MINT ${phone}${fresh ? " (--fresh)" : ""}`);

  const client = anonClient();
  const sentAt = Date.now() - 2000;
  const { error: sendError } = await client.auth.signInWithOtp({ phone: `+995${phone}` });
  if (sendError) throw new Error(`OTP send failed for ${phone}: ${sendError.message}`);
  const token = await readFreshInboxOtp(phone, sentAt);
  const { data, error } = await client.auth.verifyOtp({
    phone: `+995${phone}`,
    token,
    type: "sms",
  });
  if (error) throw new Error(`OTP verify failed for ${phone}: ${error.message}`);
  if (!data.session) throw new Error(`no session returned for ${phone}`);

  const { access_token, expires_at } = data.session;
  if (pending && typeof expires_at === "number") {
    pending[phone] = { accessToken: access_token, expiresAt: expires_at };
  }
  return access_token;
}

/** Reset at the start of every provisionActorsOnce() run; read by its closing log line. */
let _sessionStats = { hit: 0, minted: 0 };

/** A client bound to a specific actor's JWT — or the plain anon client when accessToken is null (A1). */
export function actorClient(accessToken) {
  if (!accessToken) return anonClient();
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// ---------------------------------------------------------------------------
// Standing-driving: every state transition below goes through the same RPC
// surface a real user/admin would call, never a service-role write. Every
// helper re-reads ground truth (service role, read-only) before acting, so
// driving standings is idempotent — a second run (or a resumed partial run)
// skips whatever is already done rather than re-doing or duplicating it.
// RPC names/signatures below are cited against the migration that defines
// the LIVE (latest create-or-replace) body, confirmed by reading the
// migrations directly rather than assuming names:
//   register(text,text,text,text default null)                — supabase/migrations/20260722140000_r2_review_fixes.sql:34
//   become_member_save_profile(date,int,int,text,uuid=null)    — supabase/migrations/20260721120000_progressive_registration.sql:468
//   become_member_complete(int)                                — supabase/migrations/20260721120000_progressive_registration.sql:529
//   request_delegacy()                                         — supabase/migrations/20260722140000_r2_review_fixes.sql:107
//   admin_approve_delegate(uuid,text)                          — supabase/migrations/20260722120000_r2_ladder_and_numbers.sql:130
//   admin_reject_delegate(uuid,text default null)               — supabase/migrations/20260717150000_admin_crm.sql:385 (never replaced)
//   admin_record_payment(uuid,numeric,date,text default null)  — supabase/migrations/20260718100000_admin_crm_hardening.sql:98
//   member_change_delegate(uuid default null)                  — supabase/migrations/20260722140000_r2_review_fixes.sql:149
// All eight exist under exactly the names/signatures the coordinator listed;
// nothing needed correcting.
// ---------------------------------------------------------------------------

async function readProfile(userId) {
  const { data, error } = await db
    .from("profiles")
    .select("status, registration_completed_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function readDelegate(userId) {
  const { data, error } = await db
    .from("delegates")
    .select("status")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function countOpenTeam(delegateUserId) {
  const { count, error } = await db
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("delegate_id", delegateUserId)
    .is("ended_at", null);
  if (error) throw error;
  return count ?? 0;
}

async function fetchAnyCity() {
  const { data, error } = await db.from("cities").select("id, region_id").limit(1).single();
  if (error) throw error;
  return data;
}

// 11 digits (profiles.personal_id check ^\d{11}$), unique per audit fixture,
// disjoint from the seed's own scheme (personalIdFor = "1" + 10-digit index
// in scripts/seed-staging.mjs) so the two can never collide.
const personalIdFor = (phone) => `99${phone}`;

// Tbilisi (UTC+4) is always the same calendar day as UTC or one day ahead of
// it, never behind — so UTC-today, as a plain date string, is always <=
// tbilisi_today() and always satisfies admin_record_payment's
// "not in the future" check regardless of what wall-clock hour this runs at.
const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const FIXTURE_BIRTH_DATE = "1990-06-15";
const FIXTURE_EMPLOYMENT = "უსაფრთხოების აუდიტის ფიქსტურა";
const FIXTURE_TIER = 10; // one of (5, 10, 20); payment amount below matches it 1:1

/** register(): idempotent by itself (a state read once a profile exists) — always safe to call. */
async function ensureRegistered(actorOut, firstName, lastName) {
  const client = actorClient(actorOut.accessToken);
  const { error } = await client.rpc("register", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_personal_id: personalIdFor(actorOut.phone),
  });
  if (error) throw new Error(`register failed for ${actorOut.phone}: ${error.message}`);
}

/** become_member_save_profile + become_member_complete: skipped once already completed. */
async function ensureCompleted(actorOut, city) {
  const profile = await readProfile(actorOut.userId);
  if (profile?.registration_completed_at) return;
  const client = actorClient(actorOut.accessToken);
  const { error: saveErr } = await client.rpc("become_member_save_profile", {
    p_birth_date: FIXTURE_BIRTH_DATE,
    p_region_id: city.region_id,
    p_city_id: city.id,
    p_employment: FIXTURE_EMPLOYMENT,
    p_delegate_id: null, // central membership; A7's team member re-points explicitly below
  });
  if (saveErr)
    throw new Error(`become_member_save_profile failed for ${actorOut.phone}: ${saveErr.message}`);
  const { error: completeErr } = await client.rpc("become_member_complete", {
    p_tier: FIXTURE_TIER,
  });
  if (completeErr)
    throw new Error(`become_member_complete failed for ${actorOut.phone}: ${completeErr.message}`);
}

/**
 * admin_record_payment as the finance admin: skipped once the member is
 * already active_member. Guarding on current status (not "any payment ever")
 * makes this self-healing if a fixture ever lapses past its coverage window,
 * not just idempotent against an immediate re-run.
 */
async function ensurePaid(actorOut, financeActorOut) {
  const profile = await readProfile(actorOut.userId);
  if (profile?.status === "active_member") return;
  const finance = actorClient(financeActorOut.accessToken);
  const { error } = await finance.rpc("admin_record_payment", {
    p_member_id: actorOut.userId,
    p_amount_gel: FIXTURE_TIER, // amount == tier -> months_covered = 1 (floor(amount/tier))
    p_paid_at: todayIsoDate(),
    p_bank_reference: null,
  });
  if (error) throw new Error(`admin_record_payment failed for ${actorOut.phone}: ${error.message}`);
}

/** request_delegacy(): skipped once a delegates row already exists (any status — a repeat call throws delegacy_exists). */
async function ensureDelegacyRequested(actorOut) {
  const existing = await readDelegate(actorOut.userId);
  if (existing) return;
  const client = actorClient(actorOut.accessToken);
  const { error } = await client.rpc("request_delegacy");
  if (error) throw new Error(`request_delegacy failed for ${actorOut.phone}: ${error.message}`);
}

/** admin_approve_delegate as verifier: skipped once already approved (a repeat call throws invalid_target). */
async function ensureApproved(actorOut, verifierActorOut) {
  const current = await readDelegate(actorOut.userId);
  if (current?.status === "approved") return;
  const verifier = actorClient(verifierActorOut.accessToken);
  const { error } = await verifier.rpc("admin_approve_delegate", {
    p_delegate_id: actorOut.userId,
    p_slug: "security-audit-a7-delegate",
  });
  if (error)
    throw new Error(`admin_approve_delegate failed for ${actorOut.phone}: ${error.message}`);
}

/** admin_reject_delegate as verifier: skipped once already rejected (a repeat call throws invalid_target). */
async function ensureRejected(actorOut, verifierActorOut) {
  const current = await readDelegate(actorOut.userId);
  if (current?.status === "rejected") return;
  const verifier = actorClient(verifierActorOut.accessToken);
  const { error } = await verifier.rpc("admin_reject_delegate", {
    p_delegate_id: actorOut.userId,
    p_note: "უსაფრთხოების აუდიტის ფიქსტურა — განზრახ უარყოფილი",
  });
  if (error)
    throw new Error(`admin_reject_delegate failed for ${actorOut.phone}: ${error.message}`);
}

/** member_change_delegate as the team member: naturally idempotent (no-op on an unchanged target). */
async function ensureBoundToDelegate(memberOut, delegateUserId) {
  const client = actorClient(memberOut.accessToken);
  const { error } = await client.rpc("member_change_delegate", { p_delegate_id: delegateUserId });
  if (error)
    throw new Error(`member_change_delegate failed for ${memberOut.phone}: ${error.message}`);
}

/**
 * Drives A3-A8 (and the A7 team-member fixture) to their declared standing.
 * A9-A12 are untouched here — they are the canonical seeded admins, owned by
 * scripts/seed-staging.mjs, and out of this task's remit (see
 * task-1-report.md for the standing discrepancy this leaves on the record).
 */
async function driveStandings(out, teamMember) {
  const city = await fetchAnyCity();

  // A3: registered only — account + personal data, no membership.
  await ensureRegistered(out.A3, "აუდიტი", "რეგისტრირებული");

  // A4: profile_completed — member, membership open, unpaid.
  await ensureRegistered(out.A4, "აუდიტი", "დასრულებული");
  await ensureCompleted(out.A4, city);

  // A5: active_member — paid, counted in public figures.
  await ensureRegistered(out.A5, "აუდიტი", "აქტიური");
  await ensureCompleted(out.A5, city);
  await ensurePaid(out.A5, out.A11);

  // A6: pending delegate applicant — keeps full (paid) member life.
  await ensureRegistered(out.A6, "აუდიტი", "მოლოდინში");
  await ensureCompleted(out.A6, city);
  await ensurePaid(out.A6, out.A11);
  await ensureDelegacyRequested(out.A6);

  // A7: approved delegate — keeps full member life, must have a real team.
  await ensureRegistered(out.A7, "აუდიტი", "დამტკიცებული");
  await ensureCompleted(out.A7, city);
  await ensurePaid(out.A7, out.A11);
  await ensureDelegacyRequested(out.A7);
  await ensureApproved(out.A7, out.A10);

  // Team-member fixture: a second real completed member, bound to A7 via the
  // same RPC any member uses to choose a delegate. Must come AFTER A7's
  // approval — member_change_delegate only accepts an approved delegate id.
  await ensureRegistered(teamMember, "აუდიტი", "გუნდელი");
  await ensureCompleted(teamMember, city);
  await ensureBoundToDelegate(teamMember, out.A7.userId);

  // A8: rejected delegate applicant — terminal, keeps full member life.
  await ensureRegistered(out.A8, "აუდიტი", "უარყოფილი");
  await ensureCompleted(out.A8, city);
  await ensurePaid(out.A8, out.A11);
  await ensureDelegacyRequested(out.A8);
  await ensureRejected(out.A8, out.A10);
}

async function provisionActorsOnce(fresh) {
  _sessionStats = { hit: 0, minted: 0 };
  // Sessions minted this run, flushed to the on-disk cache ONCE at the end
  // (see session-cache.mjs's mergeCacheEntries doc comment for why: eleven
  // actor phones mint in parallel below, and a per-phone read-modify-write
  // would race and could clobber a sibling's just-written entry).
  const pending = {};

  const out = {};
  await Promise.all(
    ACTOR_IDS.map(async (id) => {
      const def = ACTORS[id];
      if (!def.phone) {
        out[id] = { phone: null, userId: null, accessToken: null };
        return;
      }
      const user = await ensureUser(def.phone);
      out[id] = {
        phone: def.phone,
        userId: user.id,
        accessToken: await mintSession(def.phone, { fresh, pending }),
      };
    }),
  );

  const teamMemberUser = await ensureUser(TEAM_MEMBER_PHONE);
  const teamMember = {
    phone: TEAM_MEMBER_PHONE,
    userId: teamMemberUser.id,
    accessToken: await mintSession(TEAM_MEMBER_PHONE, { fresh, pending }),
  };
  _teamMember = teamMember;

  mergeCacheEntries(pending);
  console.log(
    `session cache: ${_sessionStats.hit} reused, ${_sessionStats.minted} minted (fresh OTP sends)`,
  );

  await driveStandings(out, teamMember);

  return out;
}

// Memoized: a second call in the same process returns the SAME promise
// instead of re-minting every session. provisionActors() sends up to twelve
// OTPs (eleven ACTORS phones — A1 is anonymous and sends none — plus the one
// A7 team-member fixture); the on-disk session cache (session-cache.mjs) is
// what makes a SEPARATE process invocation cheap, this in-memory cache is
// what makes repeated calls WITHIN one process cheap. Task 4's matrix loop
// (154 surfaces × 12 actors) must call this once and hold onto the result,
// exactly like this module's own --verify does below; the cache makes that
// the path of least resistance rather than a rule callers have to remember.
// A failure clears the cache so a later call can retry instead of
// permanently caching a transient error (e.g. one throttled send).
//
// `fresh` only has an effect on the call that actually triggers
// provisioning — once cached, later calls in the same process return that
// same result regardless of what `fresh` they pass. This matches "call it
// once per process" being the rule either way; --fresh is a whole-run
// choice, not a per-call one.
let _cache = null;
export function provisionActors({ fresh = false } = {}) {
  if (!_cache) {
    _cache = provisionActorsOnce(fresh).catch((err) => {
      _cache = null;
      throw err;
    });
  }
  return _cache;
}

/**
 * Ground-truth check for --verify: does this actor's real DB state match
 * what ACTORS declares? Deliberately reads via the service role (`db`), not
 * through the actor's own client — this is confirming the FIXTURE is set up
 * correctly, not probing what the actor can see (that is later tasks' job).
 */
async function verifyStanding(id, actorOut) {
  const def = ACTORS[id];
  if (id === "A1") return { ok: true, detail: "anonymous" };

  if (id === "A2") {
    const profile = await readProfile(actorOut.userId);
    const ok = profile === null;
    return {
      ok,
      detail: ok ? "no profile row" : `UNEXPECTED profile row (status=${profile.status})`,
    };
  }

  if (["A9", "A10", "A11", "A12"].includes(id)) {
    // Owned by scripts/seed-staging.mjs — Task 1 never DRIVES these accounts,
    // but it does assert them: both the admin role and the declared standing.
    // Asserting the standing is what stops ACTORS drifting away from reality,
    // which is exactly the defect this check was added to close.
    const { data, error } = await db
      .from("admin_roles")
      .select("role")
      .eq("user_id", actorOut.userId)
      .eq("role", def.role);
    if (error) throw error;
    const roleOk = (data?.length ?? 0) > 0;

    const profile = await readProfile(actorOut.userId);
    const standingOk = profile?.status === def.standing;

    const detail =
      `role=${roleOk ? def.role : `MISSING admin_roles row for ${def.role}`}` +
      ` status=${profile?.status ?? "MISSING profile row"}` +
      (standingOk ? "" : ` (EXPECTED ${def.standing})`);
    return { ok: roleOk && standingOk, detail };
  }

  // A3-A8
  const profile = await readProfile(actorOut.userId);
  if (!profile) return { ok: false, detail: "MISSING profile row" };
  let ok = profile.status === def.standing;
  let detail = `status=${profile.status}`;

  if (def.delegate) {
    const delegate = await readDelegate(actorOut.userId);
    const delegateOk = delegate?.status === def.delegate;
    ok = ok && delegateOk;
    detail += ` delegate=${delegate?.status ?? "MISSING"}`;

    if (id === "A7") {
      const teamCount = await countOpenTeam(actorOut.userId);
      const teamOk = teamCount >= 1;
      ok = ok && teamOk;
      detail += ` team=${teamCount}`;
    }
  }

  return { ok, detail };
}

if (process.argv.includes("--verify")) {
  const fresh = process.argv.includes("--fresh");
  const actors = await provisionActors({ fresh });
  let failed = 0;
  for (const [id, a] of Object.entries(actors)) {
    const { data } = await actorClient(a.accessToken).auth.getUser();
    const jwtOk = a.accessToken ? data.user?.id === a.userId : true;
    const standing = await verifyStanding(id, a);
    const ok = jwtOk && standing.ok;
    if (!ok) failed++;
    const jwtNote = jwtOk ? "" : " [JWT MISMATCH]";
    console.log(
      `${ok ? "OK " : "FAIL"} ${id} ${ACTORS[id].label} ${a.userId ?? "(anon)"} — ${standing.detail}${jwtNote}`,
    );
  }
  process.exit(failed === 0 ? 0 : 1);
}
