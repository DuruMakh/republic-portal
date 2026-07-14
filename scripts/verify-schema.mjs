import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(url, key);

const { count: regionCount, error: e1 } = await db
  .from("regions")
  .select("*", { count: "exact", head: true });
if (e1) throw e1;
if (regionCount !== 11) throw new Error(`expected 11 regions, got ${regionCount}`);

const { count: cityCount, error: e2 } = await db
  .from("cities")
  .select("*", { count: "exact", head: true });
if (e2) throw e2;
if (cityCount < 30) throw new Error(`expected ≥30 cities, got ${cityCount}`);

const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: leak, error: e3 } = await anon.from("dev_otp_inbox").select("*").limit(1);
if (e3 && e3.code !== "42501") {
  throw new Error(`anon query errored — check Data API exposure/grants: ${e3.message}`);
}
if (!e3 && leak && leak.length > 0) throw new Error("RLS FAILURE: anon can read dev_otp_inbox");
if (e3) console.log("OK: anon dev_otp_inbox query permission-denied (42501) — grants/RLS holding");

// --- Phase 1: public read model probes ---
const { data: viewRows, error: e4 } = await anon
  .from("public_delegates")
  .select(
    "id, slug, first_name, last_name, region_id, region_name_ka, bio, photo_url, active_supporters",
  )
  .limit(3);
if (e4) throw new Error(`anon cannot read public_delegates: ${e4.message}`);

const { error: e5 } = await anon.from("public_stats").select("*").single();
if (e5) throw new Error(`anon cannot read public_stats: ${e5.message}`);

const { data: baseLeak, error: e6 } = await anon
  .from("delegates")
  .select("tc_accepted_at")
  .limit(1);
if (!e6 && baseLeak && baseLeak.length > 0)
  throw new Error("LEAK: anon can read the delegates base table");
if (!e6)
  throw new Error(
    "delegates base-table probe unexpectedly succeeded — expected 42501 permission denial",
  );
if (e6.code !== "42501")
  throw new Error(`delegates base-table probe: expected 42501, got ${e6.code} (${e6.message})`);

// --- Phase 1 rider: created_at protection trigger + authenticated delegates seal ---
// The probes above only exercise the service-role and anon roles. This block drives
// the *authenticated* role end-to-end against a throwaway user, proving:
//   (a) protect_profile_columns() discriminates by column (an ordinary update succeeds)
//       rather than RLS silently blocking every update outright;
//   (b) the same trigger actually rejects a created_at write, by message, not just
//       "some error happened";
//   (c) the delegates base-table seal (RLS + revoked grants in
//       20260713175043_public_read_model.sql) holds for authenticated too, not only anon.
// Self-contained and idempotent: cleans up its own leftovers on every run.
const PROBE_EMAIL = "schema-probe@example.com";

async function findUserByEmail(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
}

let probeUserId;
try {
  const leftover = await findUserByEmail(PROBE_EMAIL);
  if (leftover) {
    const { error } = await db.auth.admin.deleteUser(leftover.id);
    if (error) throw new Error(`cleanup of leftover probe user failed: ${error.message}`);
  }

  const probePassword = randomBytes(24).toString("hex");
  const { data: createdUser, error: createErr } = await db.auth.admin.createUser({
    email: PROBE_EMAIL,
    password: probePassword,
    email_confirm: true,
  });
  if (createErr) throw new Error(`probe createUser failed: ${createErr.message}`);
  probeUserId = createdUser.user.id;

  const { error: profileErr } = await db
    .from("profiles")
    .insert({ id: probeUserId, first_name: "პრობი" });
  if (profileErr)
    throw new Error(`service-role probe profile insert failed: ${profileErr.message}`);

  const authed = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { error: signInErr } = await authed.auth.signInWithPassword({
    email: PROBE_EMAIL,
    password: probePassword,
  });
  if (signInErr) throw new Error(`probe sign-in failed: ${signInErr.message}`);

  // (a) an ordinary column update must succeed end-to-end — check the row actually
  // came back updated, since an UPDATE with no matching rows also reports no error.
  const { data: updated, error: updateErr } = await authed
    .from("profiles")
    .update({ first_name: "პრობი2" })
    .eq("id", probeUserId)
    .select("first_name");
  if (updateErr)
    throw new Error(`expected first_name update to succeed, got: ${updateErr.message}`);
  if (!updated || updated.length !== 1 || updated[0].first_name !== "პრობი2")
    throw new Error(`first_name update affected ${updated?.length ?? 0} rows, expected 1`);

  // (b) created_at must be rejected by the trigger, by message — not RLS, not silence.
  const { error: createdAtErr } = await authed
    .from("profiles")
    .update({ created_at: "2020-01-01T00:00:00Z" })
    .eq("id", probeUserId);
  if (!createdAtErr) throw new Error("expected created_at update to fail, but it succeeded");
  if (!createdAtErr.message.includes("server-managed"))
    throw new Error(
      `expected a "server-managed" trigger error, got (${createdAtErr.code}) ${createdAtErr.message}`,
    );

  // (c) delegates base table must stay sealed to authenticated too (revoked grants +
  // RLS), matching the anon probe above.
  const { data: delegateLeak, error: delegateErr } = await authed
    .from("delegates")
    .select("tc_accepted_at")
    .limit(1);
  if (!delegateErr)
    throw new Error(
      `authenticated delegates probe unexpectedly succeeded (${delegateLeak?.length ?? 0} rows) — expected 42501`,
    );
  if (delegateErr.code !== "42501")
    throw new Error(
      `authenticated delegates probe: expected 42501, got ${delegateErr.code} (${delegateErr.message})`,
    );
} finally {
  // Best-effort: never let a cleanup failure mask a real assertion failure above.
  // A leftover here is still safe — the next run's findUserByEmail sweep removes it.
  if (probeUserId) {
    const { error } = await db.auth.admin.deleteUser(probeUserId);
    if (error)
      console.error(`WARNING: probe cleanup (deleteUser ${probeUserId}) failed: ${error.message}`);
  }
}

console.log(
  `OK: ${regionCount} regions, ${cityCount} cities, RLS holding, public views readable (${viewRows.length} sample rows), delegates base table sealed, created_at trigger enforced, authenticated sealed`,
);
