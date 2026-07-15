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
//   (a) direct authenticated UPDATEs on profiles are denied at the grant (Phase 2
//       revoked the grant; all writes go through the funnel RPCs);
//   (b) a created_at write is denied the same way; the trigger-message assertion
//       returns when Phase 3 re-grants scoped updates;
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

  // (a) Phase 2 revoked the authenticated UPDATE grant on profiles (all writes go
  // through the funnel RPCs); the protect_profile_columns trigger remains as
  // defense-in-depth for Phase 3's scoped re-grant. An ordinary column update
  // must now be DENIED at the grant.
  const { error: updateErr } = await authed
    .from("profiles")
    .update({ first_name: "პრობი2" })
    .eq("id", probeUserId);
  if (!updateErr)
    throw new Error(
      "LEAK: expected first_name update to be denied (grant revoked), but it succeeded",
    );
  if (updateErr.code !== "42501" && !updateErr.message.includes("permission denied"))
    throw new Error(
      `expected 42501/permission denied for first_name update, got (${updateErr.code}) ${updateErr.message}`,
    );

  // (b) created_at: denied at the revoked grant too. The trigger-message
  // ("server-managed") assertion returns when Phase 3 re-grants scoped updates.
  const { error: createdAtErr } = await authed
    .from("profiles")
    .update({ created_at: "2020-01-01T00:00:00Z" })
    .eq("id", probeUserId);
  if (!createdAtErr) throw new Error("expected created_at update to fail, but it succeeded");
  if (createdAtErr.code !== "42501" && !createdAtErr.message.includes("permission denied"))
    throw new Error(
      `expected 42501/permission denied for created_at update, got (${createdAtErr.code}) ${createdAtErr.message}`,
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

// --- Phase 2: registration funnel probes ---
{
  // anon must not be able to call the funnel RPCs at all
  const { error: anonRpcErr } = await anon.rpc("funnel_state");
  if (!anonRpcErr) throw new Error("LEAK: anon can call funnel_state()");
  console.log("OK: anon funnel_state() rejected");

  // authenticated end-to-end: start → save profile → complete (twice, idempotent)
  const FUNNEL_PROBE_EMAIL = "funnel-probe@example.com";
  const leftover = await findUserByEmail(FUNNEL_PROBE_EMAIL);
  if (leftover) {
    const { error } = await db.auth.admin.deleteUser(leftover.id);
    if (error) throw new Error(`cleanup of leftover funnel probe failed: ${error.message}`);
  }
  const funnelProbePassword = randomBytes(24).toString("hex");
  const { data: fpUser, error: fpCreateErr } = await db.auth.admin.createUser({
    email: FUNNEL_PROBE_EMAIL,
    password: funnelProbePassword,
    email_confirm: true,
  });
  if (fpCreateErr) throw new Error(`funnel probe createUser failed: ${fpCreateErr.message}`);
  const fpId = fpUser.user.id;
  try {
    const authed = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { error: fpSignInErr } = await authed.auth.signInWithPassword({
      email: FUNNEL_PROBE_EMAIL,
      password: funnelProbePassword,
    });
    if (fpSignInErr) throw new Error(`funnel probe sign-in failed: ${fpSignInErr.message}`);

    const { data: s1, error: e1r } = await authed.rpc("funnel_start", {
      p_first_name: "პრობი",
      p_last_name: "ფანელი",
      p_role: "member",
      p_ref_code: null,
    });
    if (e1r) throw new Error(`funnel_start failed: ${e1r.message}`);
    if (s1.exists !== true || s1.role !== "member")
      throw new Error(`funnel_start returned unexpected state: ${JSON.stringify(s1)}`);

    // direct client write to a guarded funnel column must be denied (grant revoked)
    const { error: directErr } = await authed
      .from("profiles")
      .update({ first_name: "შეცვლილი" })
      .eq("id", fpId);
    if (!directErr)
      throw new Error("LEAK: authenticated can still UPDATE profiles directly (grant not revoked)");
    console.log("OK: direct authenticated profiles UPDATE denied");

    const { data: firstCity, error: cityErr } = await db
      .from("cities")
      .select("id, region_id")
      .limit(1)
      .single();
    if (cityErr) throw new Error(`city lookup failed: ${cityErr.message}`);

    const { error: e2r } = await authed.rpc("funnel_save_profile", {
      p_personal_id: "98765432109",
      p_birth_date: "1990-01-15",
      p_region_id: firstCity.region_id,
      p_city_id: firstCity.id,
      p_employment: "პრობის საქმიანობა",
      p_delegate_id: null,
      p_tc_accepted: false,
    });
    if (e2r) throw new Error(`funnel_save_profile failed: ${e2r.message}`);

    const { data: c1, error: e3r } = await authed.rpc("funnel_complete", { p_tier: 10 });
    if (e3r) throw new Error(`funnel_complete failed: ${e3r.message}`);
    if (!/^GR-[A-HJKMNP-Z2-9]{6}$/.test(c1.referenceCode ?? ""))
      throw new Error(`reference code malformed: ${c1.referenceCode}`);

    const { data: c2, error: e4r } = await authed.rpc("funnel_complete", { p_tier: 20 });
    if (e4r) throw new Error(`repeat funnel_complete errored: ${e4r.message}`);
    if (c2.referenceCode !== c1.referenceCode || c2.tier !== 10)
      throw new Error(
        `funnel_complete not idempotent: ${c1.referenceCode}/${c1.tier} → ${c2.referenceCode}/${c2.tier}`,
      );
    console.log(`OK: funnel RPCs end-to-end (code ${c1.referenceCode}, idempotent complete)`);
  } finally {
    const { error } = await db.auth.admin.deleteUser(fpId);
    if (error)
      console.error(`WARNING: funnel probe cleanup (deleteUser ${fpId}) failed: ${error.message}`);
  }
}

console.log(
  `OK: ${regionCount} regions, ${cityCount} cities, RLS holding, public views readable (${viewRows.length} sample rows), delegates base table sealed, client profiles UPDATE revoked, authenticated sealed`,
);
