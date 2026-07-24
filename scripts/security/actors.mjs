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
 * Every audit-created user (A2-A8) is tagged user_metadata.audit_tag so the
 * end-of-phase reseed (scripts/seed-staging.mjs) can identify and sweep them.
 *
 * Run: node --env-file=.env.local scripts/security/actors.mjs --verify
 */
import { createClient } from "@supabase/supabase-js";
import { readFreshInboxOtp } from "./otp.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error("security probing needs NEXT_PUBLIC_SUPABASE_URL, ANON_KEY and SERVICE_ROLE_KEY");
}

/**
 * Service-role client: fixture provisioning + dev_otp_inbox reads ONLY.
 * Never used as a probe actor — it bypasses every check by design and would
 * report every surface as reachable, producing a false all-clear for the
 * whole audit.
 */
export const db = createClient(url, serviceKey, { auth: { persistSession: false } });
export const anonClient = () => createClient(url, anonKey, { auth: { persistSession: false } });

/**
 * Phones reserved for the audit. +995509001xxx sits outside the seed's
 * +99550XXXXXXX roster (scripts/seed-staging.mjs phoneFor: "+99550" + a
 * 7-digit zero-padded member index over the ~1,900-person seeded roster —
 * nowhere near 9001xxx) and outside the four canonical admin phones
 * (+995509000001..4, A9-A12 below). Confirmed free against live auth.users
 * and profiles on staging on 2026-07-25 (zero collisions) before this table
 * was written — see .superpowers/sdd/task-1-report.md.
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
  A9: { label: "super_admin", phone: "509000001", standing: "active_member", role: "super_admin" },
  A10: { label: "verifier", phone: "509000002", standing: "active_member", role: "verifier" },
  A11: { label: "finance", phone: "509000003", standing: "active_member", role: "finance" },
  A12: { label: "editor", phone: "509000004", standing: "active_member", role: "editor" },
};

/** Canonical iteration order for the probe matrix used by Task 4. */
export const ACTOR_IDS = Object.keys(ACTORS);

const AUDIT_TAG = "security-audit-2026-07";

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

async function mintSession(phone) {
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
  return data.session.access_token;
}

/** A client bound to a specific actor's JWT — or the plain anon client when accessToken is null (A1). */
export function actorClient(accessToken) {
  if (!accessToken) return anonClient();
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Mints all twelve actors. Sessions for distinct phones can be minted in
 * parallel (the OTP throttle is per-phone, ~60s, not global) — but call this
 * ONCE per process run and reuse the result. Minting the same phone twice
 * inside 60s throttles the send.
 */
export async function provisionActors() {
  const out = {};
  await Promise.all(
    Object.entries(ACTORS).map(async ([id, def]) => {
      if (!def.phone) {
        out[id] = { phone: null, userId: null, accessToken: null };
        return;
      }
      const user = await ensureUser(def.phone);
      out[id] = { phone: def.phone, userId: user.id, accessToken: await mintSession(def.phone) };
    }),
  );
  return out;
}

if (process.argv.includes("--verify")) {
  const actors = await provisionActors();
  let failed = 0;
  for (const [id, a] of Object.entries(actors)) {
    const { data } = await actorClient(a.accessToken).auth.getUser();
    const ok = a.accessToken ? data.user?.id === a.userId : true;
    if (!ok) failed++;
    console.log(`${ok ? "OK " : "FAIL"} ${id} ${ACTORS[id].label} ${a.userId ?? "(anon)"}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}
