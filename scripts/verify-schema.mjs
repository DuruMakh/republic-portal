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
//   (a) profiles UPDATE stays denied for any column outside Phase 3's scoped grant
//       (status here — a server-managed column; the five plain fields are writable now);
//   (b) a server-managed column write is denied at the column grant (42501); the
//       protect trigger stays behind it as depth;
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

  // (a) `status` sits outside Phase 3's scoped grant (first_name, last_name, region_id,
  // city_id, employment) and is also protect_profile_columns-guarded — it must stay
  // DENIED at the column grant both before and after the Phase 3 migration lands.
  // (first_name itself flips to ALLOWED post-migration — exercised by the dedicated
  // scoped-grant probe further down, not here.)
  const { error: updateErr } = await authed
    .from("profiles")
    .update({ status: "draft" })
    .eq("id", probeUserId);
  if (!updateErr)
    throw new Error(
      "LEAK: expected status update to be denied (outside scoped grant), but it succeeded",
    );
  if (updateErr.code !== "42501" && !updateErr.message.includes("permission denied"))
    throw new Error(
      `expected 42501/permission denied for status update, got (${updateErr.code}) ${updateErr.message}`,
    );

  // (b) created_at: denied at the column grant (42501) — it sits outside Phase 3's
  // scoped re-grant, same as (a). The protect_profile_columns trigger remains
  // behind the grant as defense-in-depth.
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

    // referral-cap rider (spec §4.6): while still draft, an oversized ref input
    // must be silently nulled on the WRITE path (stored column, not the lookup)
    const { error: capErr } = await authed.rpc("funnel_start", {
      p_first_name: "პრობა",
      p_last_name: "პრობიშვილი",
      p_role: "member",
      p_ref_code: "x".repeat(64),
    });
    if (capErr)
      throw new Error(`funnel_start with oversized ref must not error: ${capErr.message}`);
    const { data: capRow, error: capReadErr } = await db
      .from("profiles")
      .select("signup_ref_code")
      .eq("id", fpId)
      .single();
    if (capReadErr) throw new Error(`cap probe read failed: ${capReadErr.message}`);
    if (capRow.signup_ref_code !== null)
      throw new Error(
        `oversized referral input must be stored as null, got ${capRow.signup_ref_code}`,
      );

    // Phase 3 (spec §4.1): the scoped re-grant. An allowed column writes; a
    // server-managed column is refused at the column-privilege level (42501) —
    // the protect_profile_columns() trigger stays behind it as defense-in-depth.
    const { error: scopedOkErr } = await authed
      .from("profiles")
      .update({ first_name: "შეცვლილი" })
      .eq("id", fpId);
    if (scopedOkErr)
      throw new Error(`scoped profiles UPDATE (allowed column) failed: ${scopedOkErr.message}`);
    const { error: protectedErr } = await authed
      .from("profiles")
      .update({ reference_code: "GR-AAAAAA" })
      .eq("id", fpId);
    if (!protectedErr)
      throw new Error("LEAK: authenticated changed a server-managed profile column");
    if (protectedErr.code !== "42501")
      throw new Error(
        `protected-column probe: expected 42501, got ${protectedErr.code} (${protectedErr.message})`,
      );
    console.log(
      "OK: profiles UPDATE column-scoped (allowed column writes, protected column 42501)",
    );

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

    // --- Phase 3: cabinet RPCs (spec §4.2–§4.5) ---
    const { data: approvedDelegate, error: apErr } = await db
      .from("delegates")
      .select("id")
      .eq("status", "approved")
      .order("id")
      .limit(1)
      .single();
    if (apErr) throw new Error(`no approved delegate for change probe: ${apErr.message}`);

    const countMemberships = async () => {
      const { count, error } = await db
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("member_id", fpId);
      if (error) throw new Error(`membership count failed: ${error.message}`);
      return count ?? 0;
    };

    const before = await countMemberships(); // funnel_save_profile opened one (central)
    const { error: cdErr } = await authed.rpc("member_change_delegate", {
      p_delegate_id: approvedDelegate.id,
    });
    if (cdErr) throw new Error(`member_change_delegate failed: ${cdErr.message}`);
    if ((await countMemberships()) !== before + 1)
      throw new Error("change_delegate must close-and-open (history row expected)");
    const { data: openRows, error: openErr } = await db
      .from("memberships")
      .select("delegate_id")
      .eq("member_id", fpId)
      .is("ended_at", null);
    if (openErr) throw new Error(openErr.message);
    if (openRows.length !== 1 || openRows[0].delegate_id !== approvedDelegate.id)
      throw new Error("exactly one open membership pointing at the new delegate expected");

    const { error: noopErr } = await authed.rpc("member_change_delegate", {
      p_delegate_id: approvedDelegate.id,
    });
    if (noopErr) throw new Error(`same-delegate no-op errored: ${noopErr.message}`);
    if ((await countMemberships()) !== before + 1)
      throw new Error("same-delegate call must not mint a history row");

    const { data: tierState, error: tierErr } = await authed.rpc("member_change_tier", {
      p_tier: 5,
    });
    if (tierErr) throw new Error(`member_change_tier failed: ${tierErr.message}`);
    if (tierState.tier !== 5) throw new Error(`tier should be 5, got ${tierState.tier}`);
    if (tierState.referenceCode !== c1.referenceCode)
      throw new Error("tier change must never touch the reference code");
    if (
      tierState.status !== "profile_completed" ||
      typeof tierState.registrationCompletedAt !== "string"
    )
      throw new Error("funnel_state must expose status + registrationCompletedAt (spec §4.6)");

    const { error: notDelegateErr } = await authed.rpc("delegate_panel");
    if (!notDelegateErr || !notDelegateErr.message.includes("not_a_delegate"))
      throw new Error("delegate_panel must refuse a non-delegate caller");
    const { error: teamGateErr } = await authed.rpc("delegate_team");
    if (!teamGateErr || !teamGateErr.message.includes("not_a_delegate"))
      throw new Error("delegate_team must refuse a non-delegate caller");

    const { error: anonRpcErr } = await anon.rpc("member_change_delegate", {
      p_delegate_id: null,
    });
    if (!anonRpcErr) throw new Error("LEAK: anon can execute member_change_delegate");

    console.log(
      "OK: cabinet RPCs — history-keeping change, no-op guard, tier change, gates, ref cap",
    );
  } finally {
    const { error } = await db.auth.admin.deleteUser(fpId);
    if (error)
      console.error(`WARNING: funnel probe cleanup (deleteUser ${fpId}) failed: ${error.message}`);
  }
}

// --- Phase 4: admin CRM probes (spec §4.7) ---
{
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ADMIN_VIEWS = [
    "admin_overview",
    "admin_region_stats",
    "admin_members",
    "admin_delegate_queue",
    "admin_payments",
    "admin_finance_stats",
    "admin_admins",
    "admin_audit",
    "admin_settings",
  ];

  /** Canonical seeded admins (seed-staging.mjs): audit ACTORS must be permanent. */
  async function signInAsSeededAdmin(phoneNational) {
    const phone = `+995${phoneNational}`;
    const client = createClient(url, ANON_KEY);
    const { error: sendErr } = await client.auth.signInWithOtp({ phone });
    if (sendErr) throw new Error(`OTP send to ${phone} failed: ${sendErr.message}`);
    // dev hook writes the code to dev_otp_inbox; auth may store phones without '+'
    const { data: otpRow, error: otpErr } = await db
      .from("dev_otp_inbox")
      .select("otp")
      .in("phone", [phone, phone.slice(1)])
      .order("id", { ascending: false })
      .limit(1)
      .single();
    if (otpErr) throw new Error(`dev OTP read for ${phone} failed: ${otpErr.message}`);
    const { error: verifyErr } = await client.auth.verifyOtp({
      phone,
      token: otpRow.otp,
      type: "sms",
    });
    if (verifyErr) throw new Error(`verifyOtp for ${phone} failed: ${verifyErr.message}`);
    return client;
  }

  async function expectToken(promise, token, what) {
    const { error } = await promise;
    if (!error) throw new Error(`LEAK: ${what} unexpectedly succeeded`);
    if (!error.message.includes(token))
      throw new Error(`${what}: expected '${token}', got: ${error.message}`);
  }

  // ---- (1) a non-admin authenticated user: zero rows everywhere, refusals on RPCs ----
  const NA_EMAIL = "admin-probe-nonadmin@example.com";
  const naLeftover = await findUserByEmail(NA_EMAIL);
  if (naLeftover) await db.auth.admin.deleteUser(naLeftover.id);
  const naPassword = randomBytes(24).toString("hex");
  const { data: naUser, error: naCreateErr } = await db.auth.admin.createUser({
    email: NA_EMAIL,
    password: naPassword,
    email_confirm: true,
  });
  if (naCreateErr) throw new Error(`nonadmin createUser failed: ${naCreateErr.message}`);
  const naId = naUser.user.id;
  try {
    const na = createClient(url, ANON_KEY);
    const { error: naSignIn } = await na.auth.signInWithPassword({
      email: NA_EMAIL,
      password: naPassword,
    });
    if (naSignIn) throw new Error(`nonadmin sign-in failed: ${naSignIn.message}`);
    // complete a registration the house way (funnel RPCs) — target material for later probes
    await na.rpc("funnel_start", {
      p_first_name: "პრობი",
      p_last_name: "ადმინობის",
      p_role: "member",
      p_ref_code: null,
    });
    const { data: probeCity } = await db.from("cities").select("id, region_id").limit(1).single();
    await na.rpc("funnel_save_profile", {
      p_personal_id: "98765432110",
      p_birth_date: "1991-02-02",
      p_region_id: probeCity.region_id,
      p_city_id: probeCity.id,
      p_employment: "პრობა",
      p_delegate_id: null,
      p_tc_accepted: false,
    });
    const { data: naDone, error: naDoneErr } = await na.rpc("funnel_complete", { p_tier: 10 });
    if (naDoneErr) throw new Error(`probe funnel_complete failed: ${naDoneErr.message}`);
    const naCode = naDone.referenceCode;

    for (const view of ADMIN_VIEWS) {
      const { data, error } = await na.from(view).select("*").limit(1);
      if (error) throw new Error(`non-admin ${view} select errored: ${error.message}`);
      if (data.length !== 0) throw new Error(`LEAK: non-admin got rows from ${view}`);
    }
    console.log("OK: all 9 admin views return zero rows to a non-admin");

    // personal_id/birth_date exist in NO admin view (42703 undefined column — a
    // column-list assertion over all 9), and the base-table grant no longer
    // includes them (42501)
    for (const view of ADMIN_VIEWS) {
      for (const col of ["personal_id", "birth_date"]) {
        const { error: colErr } = await na.from(view).select(col).limit(1);
        if (!colErr || colErr.code !== "42703")
          throw new Error(`${view} must not have ${col}: ${colErr?.code}`);
      }
    }
    const { error: baseErr } = await na.from("profiles").select("personal_id").eq("id", naId);
    if (!baseErr || baseErr.code !== "42501")
      throw new Error(`profiles.personal_id must be revoked: ${baseErr?.code}`);
    const { error: birthErr } = await na.from("profiles").select("birth_date").eq("id", naId);
    if (!birthErr || birthErr.code !== "42501")
      throw new Error(`profiles.birth_date must be revoked: ${birthErr?.code}`);
    // the surviving columns still read fine (own row)
    const { error: okColsErr } = await na
      .from("profiles")
      .select("first_name, phone, status, reference_code")
      .eq("id", naId)
      .single();
    if (okColsErr) throw new Error(`scoped profile select broke: ${okColsErr.message}`);
    console.log("OK: personal_id/birth_date locked down (views 42703, base grant 42501)");

    // spec §4.7: EVERY §4.5 RPC refuses a non-admin. The role check precedes
    // argument validation in all 13, so type-valid dummy args suffice.
    const RPC_REFUSALS = [
      ["admin_approve_delegate", { p_delegate_id: naId, p_slug: null }],
      ["admin_reject_delegate", { p_delegate_id: naId, p_note: "პრობა" }],
      ["admin_update_delegate_profile", { p_delegate_id: naId, p_bio: "პრობა", p_photo_url: null }],
      ["admin_reveal_applicant_personal_id", { p_delegate_id: naId }],
      ["admin_reveal_personal_id", { p_member_id: naId }],
      [
        "admin_export_members",
        { p_search: null, p_region_id: null, p_status: null, p_include_ids: false },
      ],
      ["admin_reassign_member", { p_member_id: naId, p_delegate_id: naId }],
      [
        "admin_record_payment",
        { p_member_id: naId, p_amount_gel: 10, p_paid_at: "2026-07-01", p_bank_reference: null },
      ],
      ["admin_record_payments_bulk", { p_rows: [] }],
      ["admin_void_payment", { p_payment_id: 1, p_reason: "პრობის მიზეზი" }],
      ["admin_grant_role", { p_user_id: naId, p_role: "editor" }],
      ["admin_revoke_role", { p_user_id: naId, p_role: "editor" }],
      ["admin_update_setting", { p_key: "active_grace_days", p_value: 30 }],
    ];
    for (const [fn, args] of RPC_REFUSALS) {
      await expectToken(na.rpc(fn, args), "missing_role", `non-admin ${fn}`);
    }
    const { error: anonAdminErr } = await anon.rpc("admin_reveal_personal_id", {
      p_member_id: naId,
    });
    if (!anonAdminErr) throw new Error("LEAK: anon can call admin_reveal_personal_id");
    console.log("OK: all 13 admin RPCs refuse a non-admin (anon spot-check too)");

    // own admin_roles are readable (empty for a non-admin) — the layout's gate read
    const { data: ownRoles, error: ownRolesErr } = await na
      .from("admin_roles")
      .select("role")
      .eq("user_id", naId);
    if (ownRolesErr) throw new Error(`own admin_roles read failed: ${ownRolesErr.message}`);
    if (ownRoles.length !== 0) throw new Error("non-admin should hold no roles");

    // deletability invariant (spec §4.7): no e2e 55-block user may EVER hold an
    // admin role — role holders act, actors become undeletable, and the 55-block
    // must stay disposable
    const { data: allRoleRows, error: allRolesErr } = await db
      .from("admin_roles")
      .select("user_id");
    if (allRolesErr) throw new Error(`admin_roles scan failed: ${allRolesErr.message}`);
    const roleHolderIds = [...new Set((allRoleRows ?? []).map((r) => r.user_id))];
    const { data: holderProfiles, error: holderErr } = await db
      .from("profiles")
      .select("id, phone")
      .in("id", roleHolderIds);
    if (holderErr) throw new Error(`role-holder profiles read failed: ${holderErr.message}`);
    const e2eHolders = (holderProfiles ?? []).filter((p) =>
      (p.phone ?? "").replace(/^\+?995/, "").startsWith("55"),
    );
    if (e2eHolders.length > 0)
      throw new Error(
        `LEAK: e2e 55-block users hold admin roles: ${e2eHolders.map((p) => p.phone).join(", ")}`,
      );
    console.log("OK: no e2e-block user holds an admin role (deletability invariant)");

    // ---- (2) verifier: scope edges + audited applicant reveal ----
    const verifier = await signInAsSeededAdmin("509000002");
    const { data: vMembers, error: vMembersErr } = await verifier
      .from("admin_members")
      .select("id")
      .limit(1);
    if (vMembersErr || vMembers.length !== 1)
      throw new Error(`verifier should read admin_members: ${vMembersErr?.message}`);
    const { data: vPay, error: vPayErr } = await verifier
      .from("admin_payments")
      .select("id")
      .limit(1);
    if (vPayErr) throw new Error(`verifier admin_payments errored: ${vPayErr.message}`);
    if (vPay.length !== 0) throw new Error("LEAK: verifier got rows from admin_payments");
    await expectToken(
      verifier.rpc("admin_record_payment", {
        p_member_id: naId,
        p_amount_gel: 10,
        p_paid_at: "2026-07-01",
        p_bank_reference: null,
      }),
      "missing_role",
      "verifier record_payment",
    );
    await expectToken(
      verifier.rpc("admin_export_members", {
        p_search: null,
        p_region_id: null,
        p_status: null,
        p_include_ids: false,
      }),
      "missing_role",
      "verifier export",
    );
    await expectToken(
      verifier.rpc("admin_reveal_personal_id", { p_member_id: naId }),
      "missing_role",
      "verifier member-scope reveal",
    );
    // applicant-scope reveal: the probe member is NOT a delegate → invalid_target
    await expectToken(
      verifier.rpc("admin_reveal_applicant_personal_id", { p_delegate_id: naId }),
      "invalid_target",
      "verifier reveal of a non-delegate",
    );
    console.log("OK: verifier scope edges hold (no finance surface, member-reveal denied)");

    // ---- (3) finance: record → duplicate blocked → void frees → bulk is atomic ----
    const finance = await signInAsSeededAdmin("509000003");
    const probeRef = `PROBE-${Date.now()}`;
    const { data: rec1, error: rec1Err } = await finance.rpc("admin_record_payment", {
      p_member_id: naId,
      p_amount_gel: 10,
      p_paid_at: "2026-07-01",
      p_bank_reference: probeRef,
    });
    if (rec1Err) throw new Error(`finance record failed: ${rec1Err.message}`);
    if (rec1.months !== 1 || rec1.newStatus !== "active_member")
      throw new Error(`record result unexpected: ${JSON.stringify(rec1)}`);
    await expectToken(
      finance.rpc("admin_record_payment", {
        p_member_id: naId,
        p_amount_gel: 10,
        p_paid_at: "2026-07-02",
        p_bank_reference: probeRef,
      }),
      "duplicate_reference",
      "duplicate bank reference",
    );
    const { data: payRow, error: payRowErr } = await finance
      .from("admin_payments")
      .select("id, months_covered")
      .eq("bank_reference", probeRef)
      .single();
    if (payRowErr) throw new Error(`admin_payments lookup failed: ${payRowErr.message}`);
    if (payRow.months_covered !== 1)
      throw new Error(`generated months_covered wrong: ${payRow.months_covered}`);
    const { data: voided, error: voidErr } = await finance.rpc("admin_void_payment", {
      p_payment_id: payRow.id,
      p_reason: "პრობის გაუქმება",
    });
    if (voidErr) throw new Error(`void failed: ${voidErr.message}`);
    if (voided.newStatus !== "profile_completed")
      throw new Error(`void must demote the probe member: ${JSON.stringify(voided)}`);
    const { error: reuseErr } = await finance.rpc("admin_record_payment", {
      p_member_id: naId,
      p_amount_gel: 60,
      p_paid_at: "2026-07-01",
      p_bank_reference: probeRef,
    });
    if (reuseErr) throw new Error(`voided reference must be reusable: ${reuseErr.message}`);
    // engine math via SQL: 60 GEL on tier 10 = 6 months → months_covered 6
    const { data: reuseRow } = await finance
      .from("admin_payments")
      .select("months_covered")
      .eq("bank_reference", probeRef)
      .is("voided_at", null)
      .single();
    if (reuseRow.months_covered !== 6)
      throw new Error(`SQL months math diverges from lib/active.ts: ${reuseRow.months_covered}`);

    const { count: beforeBulk } = await db
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("member_id", naId);
    await expectToken(
      finance.rpc("admin_record_payments_bulk", {
        p_rows: [
          { referenceCode: naCode, amountGel: 10, paidAt: "2026-07-03" },
          { referenceCode: "GR-ZZZZZ9", amountGel: 10, paidAt: "2026-07-03" },
        ],
      }),
      "bulk_row:1:unknown_code",
      "bulk with an unknown code",
    );
    const { count: afterBulk } = await db
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("member_id", naId);
    if (beforeBulk !== afterBulk)
      throw new Error("LEAK: failed bulk landed rows — batch must be all-or-nothing");
    console.log("OK: finance flows — record, dedup, void-frees-ref, months math, atomic bulk");

    // ---- (3b) engine date fixtures vs SQL — Task 1's semantics, replayed live ----
    // Relative dates make the assertions run-date-independent: with grace 30 and
    // 10 GEL on tier 10 (= one 30-day month), a member is active through day 60
    // after payment (the owner's "single payment = exactly 60 days") and lapsed on
    // day 61. Stacking: neither old payment alone covers today — only the
    // greatest(prev_end, paid_at) fold does. Void: voided rows never count.
    const probeDaysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
    async function engineCase(label, paidDaysAgo, expectStatus, voidAll = false) {
      const { error: wipeErr } = await db.from("payments").delete().eq("member_id", naId);
      if (wipeErr) throw new Error(`engine ${label}: wipe failed: ${wipeErr.message}`);
      const { error: insErr } = await db.from("payments").insert(
        paidDaysAgo.map((d, i) => ({
          member_id: naId,
          amount_gel: 10,
          paid_at: probeDaysAgo(d),
          bank_reference: `PROBE-EN-${label}-${i}`,
          source: "manual",
          recorded_by: null,
          tier_gel_at_payment: 10,
        })),
      );
      if (insErr) throw new Error(`engine ${label}: insert failed: ${insErr.message}`);
      if (voidAll) {
        const { error: vErr } = await db
          .from("payments")
          .update({ voided_at: new Date().toISOString(), void_reason: "engine probe" })
          .eq("member_id", naId);
        if (vErr) throw new Error(`engine ${label}: void failed: ${vErr.message}`);
      }
      const { error: rcErr } = await db.rpc("recompute_all_active");
      if (rcErr) throw new Error(`engine ${label}: recompute failed: ${rcErr.message}`);
      const { data: prof, error: profErr } = await db
        .from("profiles")
        .select("status")
        .eq("id", naId)
        .single();
      if (profErr) throw new Error(`engine ${label}: status read failed: ${profErr.message}`);
      if (prof.status !== expectStatus)
        throw new Error(`engine ${label}: expected ${expectStatus}, got ${prof.status}`);
    }
    await engineCase("day60", [60], "active_member"); // last covered day — still active
    await engineCase("day61", [61], "profile_completed"); // one day past the window
    await engineCase("stack", [80, 65], "active_member"); // only the fold covers today
    await engineCase("voided", [60], "profile_completed", true); // voided rows don't count
    console.log("OK: engine date fixtures hold in SQL (60/61 boundary, stacking, void)");

    // ---- (4) super_admin: audited reveal, grant/revoke, lockout guard, settings ----
    const superAdmin = await signInAsSeededAdmin("509000001");
    const { data: revealed, error: revealErr } = await superAdmin.rpc("admin_reveal_personal_id", {
      p_member_id: naId,
    });
    if (revealErr) throw new Error(`super reveal failed: ${revealErr.message}`);
    if (revealed !== "98765432110") throw new Error("reveal returned the wrong personal ID");
    const { data: revealAudit } = await db
      .from("audit_log")
      .select("id")
      .eq("action", "member.reveal_personal_id")
      .eq("target_id", naId)
      .limit(1);
    if (!revealAudit || revealAudit.length === 0)
      throw new Error("reveal must write its audit row in the same transaction");

    const { error: grantErr } = await superAdmin.rpc("admin_grant_role", {
      p_user_id: naId,
      p_role: "editor",
    });
    if (grantErr) throw new Error(`grant editor failed: ${grantErr.message}`);
    // editor is not staff: still zero rows from admin_members
    const { data: editorRows, error: editorErr } = await na
      .from("admin_members")
      .select("id")
      .limit(1);
    if (editorErr || editorRows.length !== 0)
      throw new Error("editor-only user must get zero rows from admin_members");
    const { error: revokeErr } = await superAdmin.rpc("admin_revoke_role", {
      p_user_id: naId,
      p_role: "editor",
    });
    if (revokeErr) throw new Error(`revoke editor failed: ${revokeErr.message}`);

    const { data: superRow } = await db
      .from("profiles")
      .select("id")
      .eq("phone", "+995509000001")
      .single();
    await expectToken(
      superAdmin.rpc("admin_revoke_role", { p_user_id: superRow.id, p_role: "super_admin" }),
      "last_super_admin",
      "removing the last super_admin",
    );
    await expectToken(
      superAdmin.rpc("admin_update_setting", { p_key: "active_grace_days", p_value: 999 }),
      "invalid_setting",
      "out-of-range grace",
    );
    await expectToken(
      superAdmin.rpc("admin_update_setting", { p_key: "other_key", p_value: 30 }),
      "invalid_setting",
      "unknown setting key",
    );
    console.log("OK: super flows — audited reveal, grant/revoke, lockout + settings guards");

    // ---- (5) the sweep demotes a synthetically-expired member ----
    const { error: expireErr } = await db
      .from("payments")
      .update({ voided_at: new Date().toISOString(), void_reason: "probe expiry setup" })
      .eq("member_id", naId)
      .is("voided_at", null);
    if (expireErr) throw new Error(`probe expiry setup failed: ${expireErr.message}`);
    const { error: forceActiveErr } = await db
      .from("profiles")
      .update({ status: "active_member" })
      .eq("id", naId);
    if (forceActiveErr) throw new Error(`probe force-active failed: ${forceActiveErr.message}`);
    const { data: swept, error: sweepErr } = await db.rpc("active_sweep");
    if (sweepErr) throw new Error(`active_sweep failed: ${sweepErr.message}`);
    if (typeof swept !== "number" || swept < 1)
      throw new Error(`sweep should demote ≥1 (the probe member), got ${swept}`);
    const { data: sweptProfile } = await db
      .from("profiles")
      .select("status")
      .eq("id", naId)
      .single();
    if (sweptProfile.status !== "profile_completed")
      throw new Error(`sweep must demote the lapsed probe member: ${sweptProfile.status}`);
    console.log(`OK: active_sweep demoted ${swept} lapsed member(s), audited`);

    // ---- (6) storage bucket exists and is public ----
    const { data: bucket, error: bucketErr } = await db.storage.getBucket("delegate-photos");
    if (bucketErr || !bucket)
      throw new Error(`delegate-photos bucket missing: ${bucketErr?.message}`);
    if (!bucket.public) throw new Error("delegate-photos bucket must be public-read");
    console.log("OK: delegate-photos bucket present and public");
  } finally {
    const { error } = await db.auth.admin.deleteUser(naId);
    if (error)
      console.error(`WARNING: admin-probe cleanup (deleteUser ${naId}) failed: ${error.message}`);
  }
  console.log("OK: Phase 4 admin probes complete");
}

console.log(
  `OK: ${regionCount} regions, ${cityCount} cities, RLS holding, public views readable (${viewRows.length} sample rows), delegates base table sealed, profiles UPDATE column-scoped, authenticated sealed`,
);
