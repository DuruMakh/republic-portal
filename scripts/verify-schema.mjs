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

// Shared across Phase 4 and Phase 5: sign in as a canonical seeded admin (or
// any other phone-authenticated seeded user) via the dev OTP inbox, and
// assert an RPC call fails with a specific error token.
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
    .update({ status: "registered" })
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

// Shared across Phase 2 and Phase 5: the completed probe member. Phase 2
// completes it below via the progressive-registration flow (register →
// become_member_save_profile → become_member_complete); on success it survives
// (no cleanup in Phase 2's own finally) so Phase 5 (P5.4) can reuse the SAME
// completed member without re-deriving state. Phase 5 owns the eventual cleanup.
const FUNNEL_PROBE_EMAIL = "funnel-probe@example.com";
let fpId;
let funnelProbePassword;

// --- Phase 2/6: progressive-registration probes (register → become_member_*) ---
{
  // anon must not be able to call the new registration RPCs at all
  const { error: anonRegErr } = await anon.rpc("register", {
    p_first_name: "x",
    p_last_name: "y",
    p_personal_id: "00000000000",
  });
  if (!anonRegErr) throw new Error("LEAK: anon can call register()");
  if (anonRegErr.code === "PGRST202")
    throw new Error("register() does not exist yet — migration not applied");
  const { error: anonStateErr } = await anon.rpc("cabinet_state");
  if (!anonStateErr) throw new Error("LEAK: anon can call cabinet_state()");
  if (anonStateErr.code === "PGRST202")
    throw new Error("cabinet_state() does not exist yet — migration not applied");
  console.log("OK: anon register()/cabinet_state() rejected");

  // the OLD funnel surface must be GONE: PostgREST answers PGRST202 (unknown
  // function) — not 42501, which would mean it still exists, merely denied
  const { error: goneErr } = await anon.rpc("funnel_state");
  if (!goneErr) throw new Error("LEAK: anon can call funnel_state()");
  if (goneErr.code !== "PGRST202" && !goneErr.message.includes("Could not find the function"))
    throw new Error(
      `funnel_state must be dropped (expected PGRST202), got ${goneErr.code} (${goneErr.message})`,
    );
  console.log("OK: funnel_state() is gone (PGRST202)");

  // authenticated end-to-end: register → save profile → complete (twice, idempotent)
  const leftover = await findUserByEmail(FUNNEL_PROBE_EMAIL);
  if (leftover) {
    const { error } = await db.auth.admin.deleteUser(leftover.id);
    if (error) throw new Error(`cleanup of leftover funnel probe failed: ${error.message}`);
  }
  funnelProbePassword = randomBytes(24).toString("hex");
  const { data: fpUser, error: fpCreateErr } = await db.auth.admin.createUser({
    email: FUNNEL_PROBE_EMAIL,
    password: funnelProbePassword,
    email_confirm: true,
  });
  if (fpCreateErr) throw new Error(`funnel probe createUser failed: ${fpCreateErr.message}`);
  fpId = fpUser.user.id;
  let funnelSucceeded = false;
  try {
    const authed = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { error: fpSignInErr } = await authed.auth.signInWithPassword({
      email: FUNNEL_PROBE_EMAIL,
      password: funnelProbePassword,
    });
    if (fpSignInErr) throw new Error(`funnel probe sign-in failed: ${fpSignInErr.message}`);

    // register() happy path (spec §4.1) — one door, complete row, registered
    // standing. The oversized ref input doubles as the Phase 3 cap rider:
    // junk codes are silently nulled on the WRITE path, never an error.
    const { data: s1, error: e1r } = await authed.rpc("register", {
      p_first_name: "პრობი",
      p_last_name: "ფანელი",
      p_personal_id: "98765432109",
      p_ref_code: "x".repeat(64),
    });
    if (e1r) throw new Error(`register failed: ${e1r.message}`);
    if (s1.exists !== true || s1.standing !== "registered" || s1.status !== "registered")
      throw new Error(`register returned unexpected state: ${JSON.stringify(s1)}`);
    if (s1.completed !== false || s1.created !== true)
      throw new Error(`register must report completed=false, created=true: ${JSON.stringify(s1)}`);
    if (s1.personalIdMasked !== "987********")
      throw new Error(`personalIdMasked wrong: ${s1.personalIdMasked}`);
    if (s1.role !== "member" || s1.admin !== false)
      throw new Error(`register role/admin unexpected: ${s1.role}/${s1.admin}`);
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

    // idempotent: a second register() is a state read — nothing overwritten
    const { data: s2, error: e1b } = await authed.rpc("register", {
      p_first_name: "სხვა",
      p_last_name: "სახელი",
      p_personal_id: "11111111111",
    });
    if (e1b) throw new Error(`repeat register errored: ${e1b.message}`);
    if (s2.created !== false || s2.firstName !== "პრობი" || s2.personalIdMasked !== "987********")
      throw new Error(`repeat register must be a no-op state read: ${JSON.stringify(s2)}`);

    // registered-but-unsaved: wizard step B refuses until step A ran (spec §4.3)
    await expectToken(
      authed.rpc("become_member_complete", { p_tier: 10 }),
      "profile_incomplete",
      "become_member_complete before any profile save",
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

    const countMemberships = async () => {
      const { count, error } = await db
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("member_id", fpId);
      if (error) throw new Error(`membership count failed: ${error.message}`);
      return count ?? 0;
    };

    // wizard step A — an unknown delegate id must refuse (nothing stored)
    await expectToken(
      authed.rpc("become_member_save_profile", {
        p_birth_date: "1990-01-15",
        p_region_id: firstCity.region_id,
        p_city_id: firstCity.id,
        p_employment: "პრობის საქმიანობა",
        p_delegate_id: fpId, // a real uuid that is NOT a delegates row
      }),
      "invalid_delegate",
      "save_profile with an unknown delegate id",
    );

    const { data: savedState, error: e2r } = await authed.rpc("become_member_save_profile", {
      p_birth_date: "1990-01-15",
      p_region_id: firstCity.region_id,
      p_city_id: firstCity.id,
      p_employment: "პრობის საქმიანობა",
      p_delegate_id: null,
    });
    if (e2r) throw new Error(`become_member_save_profile failed: ${e2r.message}`);
    if (savedState.standing !== "registered" || savedState.completed !== false)
      throw new Error(`save_profile must keep registered standing: ${JSON.stringify(savedState)}`);
    if (savedState.birthDate !== "1990-01-15" || savedState.membershipExists !== false)
      throw new Error(
        `save_profile state wrong (membership must NOT exist yet — D1): ${JSON.stringify(savedState)}`,
      );
    if ((await countMemberships()) !== 0)
      throw new Error("save_profile must not open a membership (creation moved to complete — D1)");

    const { data: c1, error: e3r } = await authed.rpc("become_member_complete", { p_tier: 10 });
    if (e3r) throw new Error(`become_member_complete failed: ${e3r.message}`);
    if (!/^GR-[A-HJKMNP-Z2-9]{6}$/.test(c1.referenceCode ?? ""))
      throw new Error(`reference code malformed: ${c1.referenceCode}`);
    if (c1.standing !== "member" || c1.completed !== true || c1.status !== "profile_completed")
      throw new Error(`complete must flip standing to member: ${JSON.stringify(c1)}`);
    if (typeof c1.registrationCompletedAt !== "string" || c1.tier !== 10)
      throw new Error(`complete state wrong: ${JSON.stringify(c1)}`);
    if (c1.created !== undefined)
      throw new Error("created flag must only appear on register() responses");
    const { data: openAfterComplete, error: oacErr } = await db
      .from("memberships")
      .select("delegate_id")
      .eq("member_id", fpId)
      .is("ended_at", null);
    if (oacErr) throw new Error(oacErr.message);
    if (openAfterComplete.length !== 1 || openAfterComplete[0].delegate_id !== null)
      throw new Error("complete must open exactly one central membership");

    const { data: c2, error: e4r } = await authed.rpc("become_member_complete", { p_tier: 20 });
    if (e4r) throw new Error(`repeat become_member_complete errored: ${e4r.message}`);
    if (c2.referenceCode !== c1.referenceCode || c2.tier !== 10)
      throw new Error(
        `become_member_complete not idempotent: ${c1.referenceCode}/${c1.tier} → ${c2.referenceCode}/${c2.tier}`,
      );
    console.log(
      `OK: register → save → complete end-to-end (code ${c1.referenceCode}, idempotent complete)`,
    );

    // --- Phase 3: cabinet RPCs (spec §4.2–§4.5) ---
    const { data: approvedDelegate, error: apErr } = await db
      .from("delegates")
      .select("id")
      .eq("status", "approved")
      .order("id")
      .limit(1)
      .single();
    if (apErr) throw new Error(`no approved delegate for change probe: ${apErr.message}`);

    const before = await countMemberships(); // become_member_complete opened one (central)
    const { data: cdState, error: cdErr } = await authed.rpc("member_change_delegate", {
      p_delegate_id: approvedDelegate.id,
    });
    if (cdErr) throw new Error(`member_change_delegate failed: ${cdErr.message}`);
    if (!cdState.chosenDelegate || cdState.chosenDelegate.id !== approvedDelegate.id)
      throw new Error(
        `member_change_delegate must return the new cabinet state: ${JSON.stringify(cdState.chosenDelegate)}`,
      );
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
      throw new Error("cabinet_state must expose status + registrationCompletedAt");
    if (tierState.standing !== "member" || tierState.completed !== true)
      throw new Error(`cabinet_state standing/completed wrong: ${JSON.stringify(tierState)}`);

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
    // fpId survives past this block on success — Phase 5 (P5.4) reuses this
    // SAME completed member and owns its cleanup from there.
    funnelSucceeded = true;
  } finally {
    if (!funnelSucceeded) {
      const { error } = await db.auth.admin.deleteUser(fpId);
      if (error)
        console.error(
          `WARNING: funnel probe cleanup (deleteUser ${fpId}) failed: ${error.message}`,
        );
    }
  }
}

// --- Phase 6 R1: wizard edges — duplicate ID, referral precedence, registered
// gate widening (D3), lost-approval fallback (spec §8), pending_delegate_id seal ---
{
  const REF_EMAIL = "register-ref-probe@example.com";
  const PENDING_FIXTURE_EMAIL = "pending-delegate-fixture@example.com";
  for (const email of [REF_EMAIL, PENDING_FIXTURE_EMAIL]) {
    const leftover = await findUserByEmail(email);
    if (leftover) {
      const { error } = await db.auth.admin.deleteUser(leftover.id);
      if (error) throw new Error(`cleanup of leftover ${email} failed: ${error.message}`);
    }
  }

  // two DISTINCT approved delegates: one referral source, one picker candidate
  const { data: twoApproved, error: twoApprovedErr } = await db
    .from("delegates")
    .select("id, referral_code")
    .eq("status", "approved")
    .order("id")
    .limit(2);
  if (twoApprovedErr || !twoApproved || twoApproved.length !== 2)
    throw new Error(
      `R1 probes need 2 seeded approved delegates, got ${twoApproved?.length ?? 0}: ${twoApprovedErr?.message ?? ""}`,
    );
  const [refDelegate, pickedDelegate] = twoApproved;

  // an upcoming published event for the registered-RSVP probe (same fixture
  // rule as Phase 5: resolved from the live seed, never hardcoded)
  const { data: rsvpEvent, error: rsvpEventErr } = await db
    .from("events")
    .select("id")
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .single();
  if (rsvpEventErr || !rsvpEvent)
    throw new Error(`R1: seeded upcoming event missing: ${rsvpEventErr?.message}`);

  let refId;
  let fixtureId;
  try {
    // (fixture) a NON-approved delegates row — on a COMPLETED member (R2's
    // enforce_delegate_completed trigger requires registration_completed_at
    // before any delegates row can exist). Complete the fixture through the
    // real funnel first — register → save → complete, same RPC chain + signed-
    // in-client idiom as the Phase 2/6 probe above — THEN the service-role
    // delegates insert below is legal.
    const fixturePassword = randomBytes(24).toString("hex");
    const { data: fixtureUser, error: fixtureCreateErr } = await db.auth.admin.createUser({
      email: PENDING_FIXTURE_EMAIL,
      password: fixturePassword,
      email_confirm: true,
    });
    if (fixtureCreateErr)
      throw new Error(`pending fixture createUser failed: ${fixtureCreateErr.message}`);
    fixtureId = fixtureUser.user.id;
    const fixtureAuthed = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { error: fixtureSignInErr } = await fixtureAuthed.auth.signInWithPassword({
      email: PENDING_FIXTURE_EMAIL,
      password: fixturePassword,
    });
    if (fixtureSignInErr)
      throw new Error(`pending fixture sign-in failed: ${fixtureSignInErr.message}`);
    const { error: fixtureRegErr } = await fixtureAuthed.rpc("register", {
      p_first_name: "პრობი",
      p_last_name: "მომლოდინე",
      p_personal_id: "98765432113",
    });
    if (fixtureRegErr) throw new Error(`pending fixture register failed: ${fixtureRegErr.message}`);
    const { data: fixtureCity, error: fixtureCityErr } = await db
      .from("cities")
      .select("id, region_id")
      .limit(1)
      .single();
    if (fixtureCityErr)
      throw new Error(`pending fixture city lookup failed: ${fixtureCityErr.message}`);
    const { error: fixtureSaveErr } = await fixtureAuthed.rpc("become_member_save_profile", {
      p_birth_date: "1987-11-08",
      p_region_id: fixtureCity.region_id,
      p_city_id: fixtureCity.id,
      p_employment: "პრობის საქმიანობა",
      p_delegate_id: null,
    });
    if (fixtureSaveErr)
      throw new Error(`pending fixture save_profile failed: ${fixtureSaveErr.message}`);
    const { error: fixtureCompleteErr } = await fixtureAuthed.rpc("become_member_complete", {
      p_tier: 10,
    });
    if (fixtureCompleteErr)
      throw new Error(
        `pending fixture become_member_complete failed: ${fixtureCompleteErr.message}`,
      );
    // status defaults to 'pending' — never approved. Legal now: fixtureId is a
    // completed member (registration_completed_at set by the chain above).
    const { error: fixtureDelegateErr } = await db.from("delegates").insert({
      id: fixtureId,
      referral_code: `PROBE-${randomBytes(6).toString("hex")}`,
      tc_accepted_at: new Date().toISOString(),
    });
    if (fixtureDelegateErr)
      throw new Error(`pending fixture delegates insert failed: ${fixtureDelegateErr.message}`);

    const refPassword = randomBytes(24).toString("hex");
    const { data: refUser, error: refCreateErr } = await db.auth.admin.createUser({
      email: REF_EMAIL,
      password: refPassword,
      email_confirm: true,
    });
    if (refCreateErr) throw new Error(`ref probe createUser failed: ${refCreateErr.message}`);
    refId = refUser.user.id;
    const ref = createClient(url, ANON_KEY);
    const { error: refSignInErr } = await ref.auth.signInWithPassword({
      email: REF_EMAIL,
      password: refPassword,
    });
    if (refSignInErr) throw new Error(`ref probe sign-in failed: ${refSignInErr.message}`);

    // no profile at all: wizard step B refuses...
    await expectToken(
      ref.rpc("become_member_complete", { p_tier: 10 }),
      "profile_incomplete",
      "become_member_complete with no profile row",
    );
    // ...and a taken personal ID refuses without creating anything (fp holds it)
    await expectToken(
      ref.rpc("register", {
        p_first_name: "პრობი",
        p_last_name: "დუბლი",
        p_personal_id: "98765432109",
      }),
      "duplicate_personal_id",
      "register with a taken personal ID",
    );

    // register through a REAL approved delegate's referral link
    const { data: refState, error: refRegErr } = await ref.rpc("register", {
      p_first_name: "პრობი",
      p_last_name: "რეფერალი",
      p_personal_id: "98765432111",
      p_ref_code: refDelegate.referral_code,
    });
    if (refRegErr) throw new Error(`register with ref code failed: ${refRegErr.message}`);
    if (refState.standing !== "registered" || refState.created !== true)
      throw new Error(`ref register state unexpected: ${JSON.stringify(refState)}`);
    if (!refState.referral || typeof refState.referral.firstName !== "string")
      throw new Error(
        `referral block missing for a valid approved ref code: ${JSON.stringify(refState.referral)}`,
      );

    // gate widening (spec §4.2, D3): a REGISTERED (not completed) person can RSVP
    const { error: regRsvpErr } = await ref.rpc("member_rsvp", {
      p_event_id: rsvpEvent.id,
      p_going: true,
    });
    if (regRsvpErr)
      throw new Error(`registered member_rsvp must succeed (widened gate): ${regRsvpErr.message}`);
    const { data: regRsvpRow, error: regRsvpReadErr } = await db
      .from("event_rsvps")
      .select("status")
      .eq("event_id", rsvpEvent.id)
      .eq("member_id", refId)
      .single();
    if (regRsvpReadErr)
      throw new Error(`registered rsvp readback failed: ${regRsvpReadErr.message}`);
    if (regRsvpRow.status !== "going")
      throw new Error(`registered rsvp row wrong: ${regRsvpRow.status}`);
    // going counts are registered-level too (same D3 line)
    const { data: regGoing, error: regGoingErr } = await ref
      .from("member_event_going_counts")
      .select("going")
      .eq("event_id", rsvpEvent.id)
      .single();
    if (regGoingErr) throw new Error(`registered going-count read failed: ${regGoingErr.message}`);
    if (typeof regGoing.going !== "number" || regGoing.going < 1)
      throw new Error(`registered going count should include own rsvp: ${regGoing.going}`);
    // leave no residue for Phase 5's ground-truth count comparison
    const { error: rsvpCleanErr } = await db
      .from("event_rsvps")
      .delete()
      .eq("event_id", rsvpEvent.id)
      .eq("member_id", refId);
    if (rsvpCleanErr) throw new Error(`registered rsvp cleanup failed: ${rsvpCleanErr.message}`);

    // everywhere else the member wall holds: votes refuse, member views stay empty
    await expectToken(
      ref.rpc("member_cast_vote", { p_poll_id: refId, p_option_id: refId }),
      "not_completed",
      "registered member_cast_vote",
    );
    const { data: regPolls, error: regPollsErr } = await ref
      .from("member_polls")
      .select("id")
      .limit(1);
    if (regPollsErr) throw new Error(`registered member_polls errored: ${regPollsErr.message}`);
    if (regPolls.length !== 0)
      throw new Error("LEAK: registered (not completed) user got rows from member_polls");

    // pending_delegate_id is server-managed: direct PATCH refused (column grant
    // 42501 in front, protect_profile_columns trigger behind it as depth)
    const { error: pdPatchErr } = await ref
      .from("profiles")
      .update({ pending_delegate_id: pickedDelegate.id })
      .eq("id", refId);
    if (!pdPatchErr) throw new Error("LEAK: client PATCHed pending_delegate_id directly");
    if (pdPatchErr.code !== "42501" && !pdPatchErr.message.includes("server-managed"))
      throw new Error(
        `pending_delegate_id PATCH: expected 42501/protect-trigger, got ${pdPatchErr.code} (${pdPatchErr.message})`,
      );

    // referral precedence (Phase 2 parity): the stored approved referral WINS
    // over a different picker choice — the picker input is ignored entirely
    const { data: probeCity2, error: probeCity2Err } = await db
      .from("cities")
      .select("id, region_id")
      .limit(1)
      .single();
    if (probeCity2Err) throw new Error(`city lookup failed: ${probeCity2Err.message}`);
    const { data: precState, error: precErr } = await ref.rpc("become_member_save_profile", {
      p_birth_date: "1992-03-03",
      p_region_id: probeCity2.region_id,
      p_city_id: probeCity2.id,
      p_employment: "პრობა",
      p_delegate_id: pickedDelegate.id,
    });
    if (precErr) throw new Error(`precedence save_profile failed: ${precErr.message}`);
    if (!precState.pendingDelegate || precState.pendingDelegate.id !== refDelegate.id)
      throw new Error(
        `referral must beat the picker: pendingDelegate=${JSON.stringify(precState.pendingDelegate)}, expected ${refDelegate.id}`,
      );

    // wizard step A — an unapproved delegates row refuses like an unknown one.
    // Only reachable with NO stored approved referral (the referral would win
    // and shadow the picker — asserted just above), so drop the ref first.
    const { error: unshadowErr } = await db
      .from("profiles")
      .update({ signup_ref_code: null })
      .eq("id", refId);
    if (unshadowErr) throw new Error(`service ref-code clear failed: ${unshadowErr.message}`);
    await expectToken(
      ref.rpc("become_member_save_profile", {
        p_birth_date: "1992-03-03",
        p_region_id: probeCity2.region_id,
        p_city_id: probeCity2.id,
        p_employment: "პრობა",
        p_delegate_id: fixtureId,
      }),
      "invalid_delegate",
      "save_profile with a pending (unapproved) delegate",
    );

    // lost-approval fallback (spec §8): re-point the held choice at the pending
    // fixture (service write), complete — lands on central, no error
    const { error: repointErr } = await db
      .from("profiles")
      .update({ pending_delegate_id: fixtureId })
      .eq("id", refId);
    if (repointErr) throw new Error(`service repoint failed: ${repointErr.message}`);
    const { data: fbState, error: fbErr } = await ref.rpc("become_member_complete", {
      p_tier: 10,
    });
    if (fbErr) throw new Error(`fallback complete errored: ${fbErr.message}`);
    if (fbState.standing !== "member" || fbState.chosenDelegate !== null)
      throw new Error(
        `lost-approval completion must land on central: standing=${fbState.standing}, chosenDelegate=${JSON.stringify(fbState.chosenDelegate)}`,
      );
    const { data: fbRows, error: fbRowsErr } = await db
      .from("memberships")
      .select("delegate_id")
      .eq("member_id", refId)
      .is("ended_at", null);
    if (fbRowsErr) throw new Error(fbRowsErr.message);
    if (fbRows.length !== 1 || fbRows[0].delegate_id !== null)
      throw new Error("fallback membership must be exactly one open central row");

    console.log(
      "OK: R1 edges — duplicate ID, referral precedence, registered RSVP (gate widened), member wall, pending_delegate_id sealed, lost-approval → central",
    );
  } finally {
    for (const [label, id] of [
      ["ref probe", refId],
      ["pending fixture", fixtureId],
    ]) {
      if (id) {
        const { error } = await db.auth.admin.deleteUser(id);
        if (error)
          console.error(`WARNING: ${label} cleanup (deleteUser ${id}) failed: ${error.message}`);
      }
    }
  }
}

// --- Phase 6 R2: delegacy request, counters, buckets, hardening riders ---
{
  const MEMBER_EMAIL = "r2-delegacy-member-probe@example.com";
  const REG_EMAIL = "r2-registered-probe@example.com";
  for (const email of [MEMBER_EMAIL, REG_EMAIL]) {
    const leftover = await findUserByEmail(email);
    if (leftover) {
      const { error } = await db.auth.admin.deleteUser(leftover.id);
      if (error) throw new Error(`cleanup of leftover ${email} failed: ${error.message}`);
    }
  }
  let memberId;
  let regId;
  try {
    // fixtures: one COMPLETED member (with an open central membership), one registered-only
    const memberPassword = randomBytes(24).toString("hex");
    const { data: mUser, error: mErr } = await db.auth.admin.createUser({
      email: MEMBER_EMAIL,
      password: memberPassword,
      email_confirm: true,
    });
    if (mErr) throw new Error(`R2 member createUser failed: ${mErr.message}`);
    memberId = mUser.user.id;
    const { error: mpErr } = await db.from("profiles").insert({
      id: memberId,
      first_name: "პრობი",
      last_name: "დელეგატობა",
      personal_id: "98765432121",
      status: "profile_completed",
      membership_tier: 10,
      reference_code: "GR-PRB2R2",
      registration_completed_at: new Date().toISOString(),
    });
    if (mpErr) throw new Error(`R2 member profile insert failed: ${mpErr.message}`);
    const { error: mmErr } = await db
      .from("memberships")
      .insert({ member_id: memberId, delegate_id: null });
    if (mmErr) throw new Error(`R2 member membership insert failed: ${mmErr.message}`);

    const regPassword = randomBytes(24).toString("hex");
    const { data: rUser, error: rErr } = await db.auth.admin.createUser({
      email: REG_EMAIL,
      password: regPassword,
      email_confirm: true,
    });
    if (rErr) throw new Error(`R2 registered createUser failed: ${rErr.message}`);
    regId = rUser.user.id;
    const { error: rpErr } = await db.from("profiles").insert({
      id: regId,
      first_name: "პრობი",
      last_name: "მსუბუქი",
      personal_id: "98765432122",
    });
    if (rpErr) throw new Error(`R2 registered profile insert failed: ${rpErr.message}`);

    // invariant trigger: a delegates row on an incomplete profile is unrepresentable
    const { error: trigErr } = await db.from("delegates").insert({
      id: regId,
      referral_code: `PROBE-${randomBytes(6).toString("hex")}`,
      tc_accepted_at: new Date().toISOString(),
    });
    if (!trigErr) throw new Error("LEAK: delegates row created on an incomplete profile");
    if (!trigErr.message.includes("delegate_requires_completed_member"))
      throw new Error(`trigger token wrong: ${trigErr.message}`);

    // registered caller: request refused with the member-wall token
    const reg = createClient(url, ANON_KEY);
    const { error: regSignErr } = await reg.auth.signInWithPassword({
      email: REG_EMAIL,
      password: regPassword,
    });
    if (regSignErr) throw new Error(`R2 registered sign-in failed: ${regSignErr.message}`);
    await expectToken(reg.rpc("request_delegacy"), "not_a_member", "registered request_delegacy");

    // member caller: request lands pending with a minted code + T&C stamp
    const member = createClient(url, ANON_KEY);
    const { error: mSignErr } = await member.auth.signInWithPassword({
      email: MEMBER_EMAIL,
      password: memberPassword,
    });
    if (mSignErr) throw new Error(`R2 member sign-in failed: ${mSignErr.message}`);
    const { data: reqState, error: reqErr } = await member.rpc("request_delegacy");
    if (reqErr) throw new Error(`request_delegacy failed: ${reqErr.message}`);
    if (reqState.delegateStatus !== "pending")
      throw new Error(`state after request: ${JSON.stringify(reqState.delegateStatus)}`);
    const { data: dRow, error: dRowErr } = await db
      .from("delegates")
      .select("status, referral_code, tc_accepted_at")
      .eq("id", memberId)
      .single();
    if (dRowErr) throw new Error(dRowErr.message);
    if (dRow.status !== "pending" || !dRow.referral_code || !dRow.tc_accepted_at)
      throw new Error(`delegates row malformed: ${JSON.stringify(dRow)}`);

    // second request refused; rejected stays final (R2-6/D7)
    await expectToken(member.rpc("request_delegacy"), "delegacy_exists", "double request");
    const { error: rejErr } = await db
      .from("delegates")
      .update({ status: "rejected" })
      .eq("id", memberId);
    if (rejErr) throw new Error(rejErr.message);
    await expectToken(member.rpc("request_delegacy"), "delegacy_exists", "re-request after reject");

    // approval closes the requester's own open membership (spec §3.1 rider)
    const superAdmin = await signInAsSeededAdmin("509000001");
    const { error: backErr } = await db
      .from("delegates")
      .update({ status: "pending" })
      .eq("id", memberId);
    if (backErr) throw new Error(backErr.message);
    const { error: apprErr } = await superAdmin.rpc("admin_approve_delegate", {
      p_delegate_id: memberId,
      p_slug: "r2-probe-delegacy",
    });
    if (apprErr) throw new Error(`approve failed: ${apprErr.message}`);
    const { data: openRows, error: openErr } = await db
      .from("memberships")
      .select("id")
      .eq("member_id", memberId)
      .is("ended_at", null);
    if (openErr) throw new Error(openErr.message);
    if (openRows.length !== 0)
      throw new Error(`approval left ${openRows.length} open membership(s) on the new delegate`);

    // counters: registered_total is cumulative and matches ground truth
    const anonStats = createClient(url, ANON_KEY);
    const { data: stats, error: statsErr } = await anonStats
      .from("public_stats")
      .select("*")
      .single();
    if (statsErr) throw new Error(`public_stats: ${statsErr.message}`);
    const { count: profileCount, error: pcErr } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true });
    if (pcErr) throw new Error(pcErr.message);
    if (stats.registered_total !== profileCount)
      throw new Error(`registered_total ${stats.registered_total} != profiles ${profileCount}`);

    // admin buckets: disjoint and summing to the total; overview registered_total present
    const { data: bucketRows, error: bErr } = await superAdmin
      .from("admin_members")
      .select("standing");
    if (bErr) throw new Error(`admin_members standing: ${bErr.message}`);
    const bucketTotal = bucketRows.length;
    const byBucket = { registered: 0, member: 0, active: 0 };
    for (const row of bucketRows) {
      if (!(row.standing in byBucket)) throw new Error(`unknown standing ${row.standing}`);
      byBucket[row.standing] += 1;
    }
    if (byBucket.registered + byBucket.member + byBucket.active !== bucketTotal)
      throw new Error("buckets do not sum to total");
    const { data: ov, error: ovErr } = await superAdmin.from("admin_overview").select("*").single();
    if (ovErr) throw new Error(`admin_overview: ${ovErr.message}`);
    if (typeof ov.registered_total !== "number" || ov.registered_total < ov.total_completed)
      throw new Error(`overview registered_total wrong: ${JSON.stringify(ov)}`);

    // delegate_panel speaks registeredCount now (rename shipped)
    const { data: panel, error: panelErr } = await member.rpc("delegate_panel");
    if (panelErr) throw new Error(`delegate_panel: ${panelErr.message}`);
    if (!("registeredCount" in panel) || "draftCount" in panel)
      throw new Error(`panel keys wrong: ${Object.keys(panel).join(",")}`);

    // dup-ID race premise: the personal_id unique constraint carries the exact
    // name register()'s handler matches on
    const { error: dupErr } = await db.from("profiles").insert({
      id: memberId,
      first_name: "x",
      last_name: "y",
      personal_id: "98765432121",
    });
    if (!dupErr) throw new Error("duplicate insert unexpectedly succeeded");
    if (
      !dupErr.message.includes("profiles_pkey") &&
      !dupErr.message.includes("profiles_personal_id_key")
    )
      throw new Error(`constraint name premise broken: ${dupErr.message}`);

    // pending_delegate_id: deleting a delegate clears the stored choice
    const { error: pointErr } = await db
      .from("profiles")
      .update({ pending_delegate_id: memberId })
      .eq("id", regId);
    if (pointErr) throw new Error(pointErr.message);
    const { error: delDelErr } = await db.from("delegates").delete().eq("id", memberId);
    if (delDelErr) throw new Error(`delegate delete blocked: ${delDelErr.message}`);
    const { data: cleared, error: clearedErr } = await db
      .from("profiles")
      .select("pending_delegate_id")
      .eq("id", regId)
      .single();
    if (clearedErr) throw new Error(clearedErr.message);
    if (cleared.pending_delegate_id !== null)
      throw new Error("pending_delegate_id did not clear on delegate deletion");

    // rider tokens: save_news visibility + whitespace bodies + image pin.
    // HISTORICAL NOTE: this probe originally caught the deployed admin_save_news
    // guarding whitespace-only bodies with plain btrim(), which in Postgres strips
    // ONLY the space character — a body of "   \n  " collapsed to "\n" (length 1,
    // not 0), so invalid_body never raised. Fixed in
    // 20260722130000_r2_whitespace_guards.sql (explicit whitespace set).
    const editor = await signInAsSeededAdmin("509000004");
    await expectToken(
      editor.rpc("admin_save_news", {
        p_id: null,
        p_title: "პრობა",
        p_body: "ტექსტი",
        p_visibility: "everyone",
      }),
      "invalid_visibility",
      "admin_save_news bad visibility",
    );
    await expectToken(
      editor.rpc("admin_save_news", {
        p_id: null,
        p_title: "პრობა",
        p_body: "   \n  ",
        p_visibility: "public",
      }),
      "invalid_body",
      "admin_save_news whitespace body",
    );
    // cancelled events are frozen history (admin_delete_event refuses them) —
    // a crashed prior run can leave this slug behind, same defensive pre-clean
    // as the P5.5 news-slug cleanup below (service-role bypasses the RPC-level
    // delete refusal, which only guards the app's own write path).
    const { error: staleEventSlugErr } = await db
      .from("events")
      .delete()
      .eq("slug", "r2-probe-cancel-event");
    if (staleEventSlugErr)
      throw new Error(`stale probe-event cleanup failed: ${staleEventSlugErr.message}`);
    const { data: savedEventId, error: seErr } = await editor.rpc("admin_save_event", {
      p_id: null,
      p_title: "R2 პრობის ღონისძიება",
      p_description: "აღწერა",
      p_location: "თბილისი",
      p_starts_at: new Date(Date.now() + 86400000).toISOString(),
      p_ends_at: null,
    });
    if (seErr) throw new Error(`save_event: ${seErr.message}`);
    // admin_cancel_event only accepts a PUBLISHED event (draft -> published ->
    // cancelled) — publish first, matching admin_publish_event's own contract.
    const { error: pubEvErr } = await editor.rpc("admin_publish_event", {
      p_id: savedEventId,
      p_slug: "r2-probe-cancel-event",
    });
    if (pubEvErr) throw new Error(`publish_event: ${pubEvErr.message}`);
    const { error: cancErr } = await editor.rpc("admin_cancel_event", { p_id: savedEventId });
    if (cancErr) throw new Error(`cancel_event: ${cancErr.message}`);
    await expectToken(
      editor.rpc("admin_save_event", {
        p_id: savedEventId,
        p_title: "შეცვლა",
        p_description: "აღწერა",
        p_location: "თბილისი",
        p_starts_at: new Date(Date.now() + 86400000).toISOString(),
        p_ends_at: null,
      }),
      "invalid_status",
      "editing a cancelled event",
    );
    const { data: probeNewsId, error: pnErr } = await editor.rpc("admin_save_news", {
      p_id: null,
      p_title: "R2 პინის პრობა",
      p_body: "ტექსტი",
      p_visibility: "public",
    });
    if (pnErr) throw new Error(pnErr.message);
    await expectToken(
      editor.rpc("admin_set_news_image", {
        p_id: probeNewsId,
        p_image_url: "https://evil.example/storage/v1/object/public/news-images/x.jpg",
      }),
      "invalid_image",
      "foreign-host image URL",
    );
    // cleanup the probe content rows
    for (const [rpc, id] of [
      ["admin_delete_news", probeNewsId],
      ["admin_delete_event", savedEventId],
    ]) {
      const { error } = await editor.rpc(rpc, { p_id: id });
      if (error) console.error(`WARNING: R2 probe content cleanup ${rpc} failed: ${error.message}`);
    }

    // export filter already speaks the bucket vocabulary (spec §10.6: no change — assert it)
    const { data: exportRows, error: exportErr } = await superAdmin.rpc("admin_export_members", {
      p_search: null,
      p_region_id: null,
      p_status: "registered",
      p_include_ids: false,
    });
    if (exportErr) throw new Error(`export standing filter: ${exportErr.message}`);
    for (const row of exportRows) {
      if (row.status !== "registered")
        throw new Error(`export p_status=registered leaked status ${row.status}`);
    }

    console.log(
      "OK: R2 — delegacy lifecycle (request/refuse/reject-final/approve closes membership), invariant trigger, registered_total, disjoint buckets, registeredCount, rider guards",
    );
  } finally {
    for (const [label, id] of [
      ["R2 member probe", memberId],
      ["R2 registered probe", regId],
    ]) {
      if (id) {
        const { error } = await db.auth.admin.deleteUser(id);
        if (error)
          console.error(`WARNING: ${label} cleanup (deleteUser ${id}) failed: ${error.message}`);
      }
    }
  }
}

// --- Phase 4: admin CRM probes (spec §4.7) ---
{
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
    // Phase 5 (spec §4.7 extension): the community admin views join the same
    // zero-row/denial sweep below — the non-admin user this block already
    // sets up is the natural place to cover them too.
    "admin_news",
    "admin_events",
    "admin_polls",
    "admin_poll_options",
  ];

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
    // complete a registration the house way (register + become_member_*) —
    // target material for later probes
    await na.rpc("register", {
      p_first_name: "პრობი",
      p_last_name: "ადმინობის",
      p_personal_id: "98765432110",
    });
    const { data: probeCity } = await db.from("cities").select("id, region_id").limit(1).single();
    await na.rpc("become_member_save_profile", {
      p_birth_date: "1991-02-02",
      p_region_id: probeCity.region_id,
      p_city_id: probeCity.id,
      p_employment: "პრობა",
      p_delegate_id: null,
    });
    const { data: naDone, error: naDoneErr } = await na.rpc("become_member_complete", {
      p_tier: 10,
    });
    if (naDoneErr) throw new Error(`probe become_member_complete failed: ${naDoneErr.message}`);
    const naCode = naDone.referenceCode;

    for (const view of ADMIN_VIEWS) {
      const { data, error } = await na.from(view).select("*").limit(1);
      if (error) throw new Error(`non-admin ${view} select errored: ${error.message}`);
      if (data.length !== 0) throw new Error(`LEAK: non-admin got rows from ${view}`);
    }
    console.log("OK: all 13 admin views return zero rows to a non-admin");

    // personal_id/birth_date exist in NO admin view (42703 undefined column — a
    // column-list assertion over all 13), and the base-table grant no longer
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

    // deletability invariant (spec §4.7): no e2e throwaway user may EVER hold an
    // admin role — role holders act, actors become undeletable, and the disposable
    // e2e ranges must stay deletable. Both throwaway markers count: a 55-block phone
    // OR a 9-prefix personal_id — and a 9-prefix throwaway can carry NO phone at all
    // (naId itself: personal_id 98765432110, no phone), so the scan reads personal_id
    // too (service-role db can). The 4 canonical admins are permanent audit ACTORS
    // with '1'-prefixed IDs and 50-block phones — exclude them by phone so their
    // legitimate roles are never mistaken for a leak.
    const CANONICAL_ADMIN_PHONES = new Set([1, 2, 3, 4].map((n) => `+99550900000${n}`));
    const { data: allRoleRows, error: allRolesErr } = await db
      .from("admin_roles")
      .select("user_id");
    if (allRolesErr) throw new Error(`admin_roles scan failed: ${allRolesErr.message}`);
    const roleHolderIds = [...new Set((allRoleRows ?? []).map((r) => r.user_id))];
    const { data: holderProfiles, error: holderErr } = await db
      .from("profiles")
      .select("id, phone, personal_id")
      .in("id", roleHolderIds);
    if (holderErr) throw new Error(`role-holder profiles read failed: ${holderErr.message}`);
    const e2eHolders = (holderProfiles ?? []).filter((p) => {
      if (CANONICAL_ADMIN_PHONES.has(p.phone ?? "")) return false;
      const national = (p.phone ?? "").replace(/^\+?995/, "");
      return national.startsWith("55") || (p.personal_id ?? "").startsWith("9");
    });
    if (e2eHolders.length > 0)
      throw new Error(
        `LEAK: e2e throwaway users hold admin roles: ${e2eHolders
          .map((p) => p.phone ?? p.personal_id)
          .join(", ")}`,
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
    // Fixture dates must be TBILISI calendar days — the engine folds coverage from
    // tbilisi_today() (ADR-015/016), so a plain UTC slice ran one day out of step
    // during 00:00–04:00 Tbilisi. Mirrors todayTbilisiIso() (lib/admin-schemas.ts);
    // Georgia is fixed UTC+4, no DST.
    const TBILISI_OFFSET_MS = 4 * 3_600_000;
    const probeDaysAgo = (d) =>
      new Date(Date.now() - d * 86_400_000 + TBILISI_OFFSET_MS).toISOString().slice(0, 10);
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

    // lockout guard: the RPC blocks a revoke only when the GLOBAL super_admin count
    // is exactly 1 (and the target holds it). If the owner's grant-admin.mjs has
    // added a second super_admin (seed-staging.mjs anticipates this), the guard does
    // NOT fire and a real revoke would strip the canonical super_admin from the
    // shared seed. Only attempt the (then guard-blocked, non-destructive) revoke when
    // the count is 1; otherwise skip — never risk a real revoke.
    const { count: superCount, error: superCountErr } = await db
      .from("admin_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (superCountErr) throw new Error(`super_admin count failed: ${superCountErr.message}`);
    if (superCount === 1) {
      const { data: superRow, error: superRowErr } = await db
        .from("profiles")
        .select("id")
        .eq("phone", "+995509000001")
        .single();
      if (superRowErr) throw new Error(`super_admin row lookup failed: ${superRowErr.message}`);
      await expectToken(
        superAdmin.rpc("admin_revoke_role", { p_user_id: superRow.id, p_role: "super_admin" }),
        "last_super_admin",
        "removing the last super_admin",
      );
      console.log("OK: last_super_admin guard blocks revoking the only super_admin");
    } else {
      console.log(
        `SKIP: last_super_admin guard probe — found ${superCount} super_admins, refusing to risk a real revoke`,
      );
    }
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

    // recreated admin_export_members (7b): the p_status whitelist speaks the
    // NEW enum — the renamed value filters fine, the dead one refuses
    const { data: exportRegistered, error: exportRegErr } = await superAdmin.rpc(
      "admin_export_members",
      { p_search: null, p_region_id: null, p_status: "registered", p_include_ids: false },
    );
    if (exportRegErr)
      throw new Error(`export with p_status=registered failed: ${exportRegErr.message}`);
    if (!Array.isArray(exportRegistered))
      throw new Error(`export must return a jsonb array, got ${typeof exportRegistered}`);
    await expectToken(
      superAdmin.rpc("admin_export_members", {
        p_search: null,
        p_region_id: null,
        p_status: "draft",
        p_include_ids: false,
      }),
      "invalid_target",
      "export with the retired 'draft' status",
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

// --- Phase 5: community probes (spec §4.6) ---
{
  try {
    const nowIso = new Date().toISOString();

    // fixture ids/rows resolved from the live seed (Task 8) — never hardcoded uuids
    const { data: membersArticle, error: membersArticleErr } = await db
      .from("news")
      .select("id, slug")
      .eq("visibility", "members")
      .eq("status", "published")
      .single();
    if (membersArticleErr || !membersArticle)
      throw new Error(`P5: seeded members-only article missing: ${membersArticleErr?.message}`);

    const { data: upcomingEvent, error: upcomingEventErr } = await db
      .from("events")
      .select("id")
      .eq("status", "published")
      .gt("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(1)
      .single();
    if (upcomingEventErr || !upcomingEvent)
      throw new Error(`P5: seeded upcoming event missing: ${upcomingEventErr?.message}`);
    const upcomingEventId = upcomingEvent.id;

    const { data: pastEvent, error: pastEventErr } = await db
      .from("events")
      .select("id")
      .eq("status", "published")
      .lte("starts_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(1)
      .single();
    if (pastEventErr || !pastEvent)
      throw new Error(`P5: seeded past event missing: ${pastEventErr?.message}`);
    const pastEventId = pastEvent.id;

    const { data: cancelledEvent, error: cancelledEventErr } = await db
      .from("events")
      .select("id")
      .eq("status", "cancelled")
      .limit(1)
      .single();
    if (cancelledEventErr || !cancelledEvent)
      throw new Error(`P5: seeded cancelled event missing: ${cancelledEventErr?.message}`);
    const cancelledEventId = cancelledEvent.id;

    const { data: untouchedPoll, error: untouchedPollErr } = await db
      .from("polls")
      .select("id")
      .eq("question", "სად გავმართოთ შემდეგი საერთო კრება?")
      .single();
    if (untouchedPollErr || !untouchedPoll)
      throw new Error(`P5: seeded untouched poll missing: ${untouchedPollErr?.message}`);
    const { data: untouchedOpts, error: untouchedOptsErr } = await db
      .from("poll_options")
      .select("id, position")
      .eq("poll_id", untouchedPoll.id)
      .order("position");
    if (untouchedOptsErr || !untouchedOpts || untouchedOpts.length !== 4)
      throw new Error(`P5: expected 4 options on the untouched poll, got ${untouchedOpts?.length}`);

    const { data: closedPoll, error: closedPollErr } = await db
      .from("polls")
      .select("id")
      .eq("status", "closed")
      .limit(1)
      .single();
    if (closedPollErr || !closedPoll)
      throw new Error(`P5: seeded closed poll missing: ${closedPollErr?.message}`);

    const { data: otherOpenPoll, error: otherOpenPollErr } = await db
      .from("polls")
      .select("id")
      .eq("status", "open")
      .neq("id", untouchedPoll.id)
      .order("opened_at", { ascending: true })
      .limit(1)
      .single();
    if (otherOpenPollErr || !otherOpenPoll)
      throw new Error(`P5: seeded second open poll missing: ${otherOpenPollErr?.message}`);

    // fresh test data for P5.5 (editor RPCs) — spliced from the brief, not the seed
    const Q_PROBE_POLL = "პრობის გამოკითხვა?";
    const OPT_A = "ა";
    const OPT_B = "ბ";
    const PROBE_NEWS_TITLE = "პრობის სიახლე";
    const PROBE_NEWS_BODY = "პრობის ტანი";

    console.log("OK: Phase 5 fixture ids resolved (events, polls, members-only article)");

    // P5.1 anon reads: public views yes, member views no, base tables no
    {
      const { data: pubNews, error: pubNewsErr } = await anon
        .from("public_news")
        .select("slug, title")
        .limit(50);
      if (pubNewsErr) throw new Error(`P5.1: anon cannot read public_news: ${pubNewsErr.message}`);
      if (!pubNews || pubNews.length === 0) throw new Error("P5.1: public_news returned zero rows");
      if (pubNews.some((r) => !r.slug))
        throw new Error("P5.1: public_news has a row with a null slug");

      const { data: memberNewsLeak, error: memberNewsErr } = await anon
        .from("member_news")
        .select("*")
        .limit(1);
      if (!memberNewsErr)
        throw new Error(
          `LEAK: anon can read member_news (${memberNewsLeak?.length ?? 0} rows) — expected 42501`,
        );
      if (memberNewsErr.code !== "42501")
        throw new Error(
          `P5.1: member_news denial expected 42501, got ${memberNewsErr.code} (${memberNewsErr.message})`,
        );

      // gated ADMIN view, anon: same shape as the member_news denial above —
      // admin_news is granted to authenticated only (never anon).
      const { data: adminNewsLeak, error: adminNewsErr } = await anon
        .from("admin_news")
        .select("*")
        .limit(1);
      if (!adminNewsErr)
        throw new Error(
          `LEAK: anon can read admin_news (${adminNewsLeak?.length ?? 0} rows) — expected 42501`,
        );
      if (adminNewsErr.code !== "42501")
        throw new Error(
          `P5.1: admin_news denial expected 42501, got ${adminNewsErr.code} (${adminNewsErr.message})`,
        );

      const { data: baseNewsLeak, error: baseNewsErr } = await anon
        .from("news")
        .select("*")
        .limit(1);
      if (!baseNewsErr && baseNewsLeak && baseNewsLeak.length > 0)
        throw new Error("LEAK: anon can read the news base table");
      if (!baseNewsErr)
        throw new Error(
          "news base-table probe unexpectedly succeeded — expected 42501 permission denial",
        );
      if (baseNewsErr.code !== "42501")
        throw new Error(
          `news base-table probe: expected 42501, got ${baseNewsErr.code} (${baseNewsErr.message})`,
        );

      const { data: txStats, error: txStatsErr } = await anon
        .from("transparency_stats")
        .select("*")
        .single();
      if (txStatsErr)
        throw new Error(`P5.1: anon cannot read transparency_stats: ${txStatsErr.message}`);
      if (!(Number(txStats.total_gel) >= 0))
        throw new Error(`P5.1: total_gel should be ≥ 0, got ${txStats.total_gel}`);
      if (!(txStats.registered_members > 0))
        throw new Error(
          `P5.1: registered_members should be > 0, got ${txStats.registered_members}`,
        );
      if (!(txStats.approved_delegates > 0))
        throw new Error(
          `P5.1: approved_delegates should be > 0, got ${txStats.approved_delegates}`,
        );

      const { data: txRegions, error: txRegionsErr } = await anon
        .from("transparency_regions")
        .select("*");
      if (txRegionsErr)
        throw new Error(`P5.1: anon cannot read transparency_regions: ${txRegionsErr.message}`);
      if (!txRegions || txRegions.length !== 11)
        throw new Error(`P5.1: expected 11 transparency_regions rows, got ${txRegions?.length}`);
      for (const region of txRegions) {
        if (!(region.registered >= region.active && region.active >= 0))
          throw new Error(
            `P5.1: region ${region.region_id} violates registered ≥ active ≥ 0 (${region.registered}/${region.active})`,
          );
      }

      if (pubNews.length !== 4)
        throw new Error(
          `P5.1: expected exactly 4 public published news rows, got ${pubNews.length}`,
        );
      if (pubNews.some((r) => r.slug === membersArticle.slug))
        throw new Error("LEAK: public_news exposes the members-only article's slug");

      console.log(
        "OK: anon — public_news (4, no members-only leak), member_news/base news tables denied, transparency_stats/regions sane",
      );
    }

    // P5.2 transparency figures equal service-side ground truth (derived, never stored)
    {
      // PostgREST caps unpaginated selects at its default row limit (well below
      // this staging project's live payment count) — page through explicitly so
      // the "ground truth" sum isn't itself a silent undercount.
      let expectedTotal = 0;
      for (let page = 0; ; page++) {
        const { data: paymentsPage, error: paymentsPageErr } = await db
          .from("payments")
          .select("amount_gel")
          .is("voided_at", null)
          .order("id")
          .range(page * 1000, page * 1000 + 999);
        if (paymentsPageErr)
          throw new Error(
            `P5.2: live payments page ${page} read failed: ${paymentsPageErr.message}`,
          );
        expectedTotal += (paymentsPage ?? []).reduce((s, p) => s + Number(p.amount_gel), 0);
        if (!paymentsPage || paymentsPage.length < 1000) break;
      }
      const { data: derivedStats, error: derivedStatsErr } = await anon
        .from("transparency_stats")
        .select("*")
        .single();
      if (derivedStatsErr)
        throw new Error(`P5.2: transparency_stats read failed: ${derivedStatsErr.message}`);
      if (Math.abs(Number(derivedStats.total_gel) - expectedTotal) >= 0.005)
        throw new Error(
          `P5.2: transparency total_gel diverges from ground truth: view=${derivedStats.total_gel}, expected=${expectedTotal}`,
        );
      console.log(
        `OK: transparency_stats.total_gel matches live payments ground truth (${derivedStats.total_gel} GEL)`,
      );
    }

    // P5.3 pre-completion authenticated user: member views return ZERO rows (not errors)
    // (reuses the Phase 2-style throwaway boilerplate — create + sign in — but stops
    // there: no register() call, so no profile exists and nothing ever completes;
    // is_registered() is false too, so even the widened RSVP gate refuses)
    {
      const PRE_EMAIL = "community-precompletion-probe@example.com";
      const preLeftover = await findUserByEmail(PRE_EMAIL);
      if (preLeftover) {
        const { error } = await db.auth.admin.deleteUser(preLeftover.id);
        if (error)
          throw new Error(`cleanup of leftover precompletion probe failed: ${error.message}`);
      }
      const prePassword = randomBytes(24).toString("hex");
      const { data: preUser, error: preCreateErr } = await db.auth.admin.createUser({
        email: PRE_EMAIL,
        password: prePassword,
        email_confirm: true,
      });
      if (preCreateErr)
        throw new Error(`P5.3: precompletion probe createUser failed: ${preCreateErr.message}`);
      const preId = preUser.user.id;
      try {
        const pre = createClient(url, ANON_KEY);
        const { error: preSignInErr } = await pre.auth.signInWithPassword({
          email: PRE_EMAIL,
          password: prePassword,
        });
        if (preSignInErr)
          throw new Error(`P5.3: precompletion probe sign-in failed: ${preSignInErr.message}`);

        const { data: preNewsRows, error: preNewsErr } = await pre
          .from("member_news")
          .select("*")
          .limit(1);
        if (preNewsErr)
          throw new Error(
            `P5.3: member_news errored for pre-completion user: ${preNewsErr.message}`,
          );
        if (preNewsRows.length !== 0)
          throw new Error("LEAK: pre-completion user got rows from member_news");

        const { data: prePollsRows, error: prePollsErr } = await pre
          .from("member_polls")
          .select("*")
          .limit(1);
        if (prePollsErr)
          throw new Error(
            `P5.3: member_polls errored for pre-completion user: ${prePollsErr.message}`,
          );
        if (prePollsRows.length !== 0)
          throw new Error("LEAK: pre-completion user got rows from member_polls");

        const { data: preOptsRows, error: preOptsErr } = await pre
          .from("member_poll_options")
          .select("*")
          .limit(1);
        if (preOptsErr)
          throw new Error(
            `P5.3: member_poll_options errored for pre-completion user: ${preOptsErr.message}`,
          );
        if (preOptsRows.length !== 0)
          throw new Error("LEAK: pre-completion user got rows from member_poll_options");

        console.log(
          "OK: pre-completion user gets zero rows (not errors) from member_news/member_polls/member_poll_options",
        );

        await expectToken(
          pre.rpc("member_rsvp", { p_event_id: upcomingEventId, p_going: true }),
          "not_completed",
          "pre-completion member_rsvp",
        );
        await expectToken(
          pre.rpc("member_cast_vote", {
            p_poll_id: untouchedPoll.id,
            p_option_id: untouchedOpts[0].id,
          }),
          "not_completed",
          "pre-completion member_cast_vote",
        );
        console.log(
          "OK: pre-completion user's member_rsvp/member_cast_vote both refuse with not_completed",
        );
      } finally {
        const { error } = await db.auth.admin.deleteUser(preId);
        if (error)
          console.error(
            `WARNING: precompletion probe cleanup (deleteUser ${preId}) failed: ${error.message}`,
          );
      }
    }

    // P5.4 completed member (the Phase 2 probe user, already completed by that block).
    // RE-RUNNABLE: first, service-delete this user's poll_votes/event_rsvps rows on
    // the probe targets — prior runs leave them behind.
    let member;
    {
      if (!fpId)
        throw new Error("P5.4: Phase 2 probe user (fpId) missing — Phase 2 must run first");

      const { error: wipeVotesErr } = await db
        .from("poll_votes")
        .delete()
        .eq("poll_id", untouchedPoll.id)
        .eq("member_id", fpId);
      if (wipeVotesErr)
        throw new Error(`P5.4: pre-clean poll_votes failed: ${wipeVotesErr.message}`);
      const { error: wipeRsvpsErr } = await db
        .from("event_rsvps")
        .delete()
        .eq("event_id", upcomingEventId)
        .eq("member_id", fpId);
      if (wipeRsvpsErr)
        throw new Error(`P5.4: pre-clean event_rsvps failed: ${wipeRsvpsErr.message}`);

      member = createClient(url, ANON_KEY);
      const { error: memberSignInErr } = await member.auth.signInWithPassword({
        email: FUNNEL_PROBE_EMAIL,
        password: funnelProbePassword,
      });
      if (memberSignInErr)
        throw new Error(`P5.4: completed-member sign-in failed: ${memberSignInErr.message}`);

      // member_news: the seeded internal article is visible
      const { data: visibleMemberNews, error: visibleMemberNewsErr } = await member
        .from("member_news")
        .select("id, visibility")
        .eq("visibility", "members");
      if (visibleMemberNewsErr)
        throw new Error(`P5.4: member_news read failed: ${visibleMemberNewsErr.message}`);
      if (!visibleMemberNews || visibleMemberNews.length < 1)
        throw new Error(
          "P5.4: completed member should see ≥1 members-visibility article via member_news",
        );

      // member_polls: both open polls + the closed poll visible
      const { data: memberPolls, error: memberPollsErr } = await member
        .from("member_polls")
        .select("id, status");
      if (memberPollsErr)
        throw new Error(`P5.4: member_polls read failed: ${memberPollsErr.message}`);
      const memberPollIds = new Set((memberPolls ?? []).map((p) => p.id));
      for (const [label, id] of [
        ["untouched open poll", untouchedPoll.id],
        ["other open poll", otherOpenPoll.id],
        ["closed poll", closedPoll.id],
      ]) {
        if (!memberPollIds.has(id))
          throw new Error(`P5.4: member_polls missing the ${label} (${id})`);
      }

      // the untouched open poll: 4 options BEFORE voting; counts hidden pre-vote
      const { data: preVoteOptions, error: preVoteOptionsErr } = await member
        .from("member_poll_options")
        .select("option_id, position, label")
        .eq("poll_id", untouchedPoll.id);
      if (preVoteOptionsErr)
        throw new Error(`P5.4: member_poll_options read failed: ${preVoteOptionsErr.message}`);
      if (!preVoteOptions || preVoteOptions.length !== 4)
        throw new Error(
          `P5.4: expected 4 member_poll_options for the untouched poll, got ${preVoteOptions?.length}`,
        );

      const { data: preVoteCounts, error: preVoteCountsErr } = await member
        .from("poll_option_counts")
        .select("option_id, votes")
        .eq("poll_id", untouchedPoll.id);
      if (preVoteCountsErr)
        throw new Error(`P5.4: poll_option_counts read failed: ${preVoteCountsErr.message}`);
      if (preVoteCounts.length !== 0)
        throw new Error(
          `P5.4: poll_option_counts should be hidden pre-vote, got ${preVoteCounts.length} rows`,
        );

      // vote sequence (worked-example idiom)
      const firstOption = preVoteOptions.find((o) => o.position === 1);
      const secondOption = preVoteOptions.find((o) => o.position === 2);
      const { error: voteErr } = await member.rpc("member_cast_vote", {
        p_poll_id: untouchedPoll.id,
        p_option_id: firstOption.option_id,
      });
      if (voteErr) throw new Error(`P5.4: first vote failed: ${voteErr.message}`);

      const { data: postVoteCounts, error: postVoteCountsErr } = await member
        .from("poll_option_counts")
        .select("option_id, votes")
        .eq("poll_id", untouchedPoll.id);
      if (postVoteCountsErr)
        throw new Error(
          `P5.4: post-vote poll_option_counts read failed: ${postVoteCountsErr.message}`,
        );
      if (postVoteCounts.length !== 4)
        throw new Error(
          `P5.4: expected 4 poll_option_counts rows after voting, got ${postVoteCounts.length}`,
        );
      const totalVotes = postVoteCounts.reduce((s, r) => s + r.votes, 0);
      if (totalVotes < 1)
        throw new Error(`P5.4: poll_option_counts votes should sum ≥ 1, got ${totalVotes}`);

      // own-vote readback (column-scoped grant — never select("*"); created_at is
      // deliberately outside the grant)
      const { data: ownVote, error: ownVoteErr } = await member
        .from("poll_votes")
        .select("poll_id, option_id, member_id")
        .eq("poll_id", untouchedPoll.id);
      if (ownVoteErr) throw new Error(`P5.4: own-vote readback failed: ${ownVoteErr.message}`);
      if (ownVote.length !== 1)
        throw new Error(`P5.4: expected exactly 1 own poll_votes row, got ${ownVote.length}`);

      // second vote on the SAME poll must hit the PK, not app code
      await expectToken(
        member.rpc("member_cast_vote", {
          p_poll_id: untouchedPoll.id,
          p_option_id: secondOption.option_id,
        }),
        "already_voted",
        "second vote on the untouched poll",
      );
      const { count: voteCountAfterRetry, error: voteCountErr } = await db
        .from("poll_votes")
        .select("*", { count: "exact", head: true })
        .eq("poll_id", untouchedPoll.id)
        .eq("member_id", fpId);
      if (voteCountErr) throw new Error(`P5.4: vote recount failed: ${voteCountErr.message}`);
      if (voteCountAfterRetry !== 1)
        throw new Error(
          `P5.4: expected exactly 1 vote after the rejected retry, got ${voteCountAfterRetry}`,
        );

      // cross-poll option (composite FK)
      const { data: closedPollOption, error: closedPollOptionErr } = await db
        .from("poll_options")
        .select("id")
        .eq("poll_id", closedPoll.id)
        .limit(1)
        .single();
      if (closedPollOptionErr)
        throw new Error(`P5.4: closed-poll option lookup failed: ${closedPollOptionErr.message}`);
      await expectToken(
        member.rpc("member_cast_vote", {
          p_poll_id: untouchedPoll.id,
          p_option_id: closedPollOption.id,
        }),
        "invalid_option",
        "cross-poll option",
      );

      // a service-created DRAFT poll → invalid_target (status is checked before
      // the option even needs to be real)
      const { data: draftPoll, error: draftPollErr } = await db
        .from("polls")
        .insert({ question: "draft-poll-probe", status: "draft" })
        .select("id")
        .single();
      if (draftPollErr)
        throw new Error(`P5.4: draft poll creation failed: ${draftPollErr.message}`);
      try {
        await expectToken(
          member.rpc("member_cast_vote", {
            p_poll_id: draftPoll.id,
            p_option_id: firstOption.option_id,
          }),
          "invalid_target",
          "vote on a draft poll",
        );
      } finally {
        const { error: draftPollDeleteErr } = await db
          .from("polls")
          .delete()
          .eq("id", draftPoll.id);
        if (draftPollDeleteErr)
          console.error(`WARNING: P5.4 draft poll cleanup failed: ${draftPollDeleteErr.message}`);
      }

      // the closed poll: counts visible WITHOUT this user voting
      const { data: closedCounts, error: closedCountsErr } = await member
        .from("poll_option_counts")
        .select("option_id, votes")
        .eq("poll_id", closedPoll.id);
      if (closedCountsErr)
        throw new Error(
          `P5.4: closed-poll poll_option_counts read failed: ${closedCountsErr.message}`,
        );
      const { count: closedOptionCount, error: closedOptionCountErr } = await db
        .from("poll_options")
        .select("*", { count: "exact", head: true })
        .eq("poll_id", closedPoll.id);
      if (closedOptionCountErr)
        throw new Error(`P5.4: closed-poll option count failed: ${closedOptionCountErr.message}`);
      if (!closedCounts || closedCounts.length !== closedOptionCount)
        throw new Error(
          `P5.4: closed poll's counts should be visible without voting (got ${closedCounts?.length}, expected ${closedOptionCount})`,
        );

      // member_event_going_counts: matches a service-side live count (checked
      // BEFORE this member's own RSVP toggle, which flips its own row twice but
      // ends back at 'cancelled' — the seed's own rsvps are ground truth here)
      const { count: liveGoingCount, error: liveGoingErr } = await db
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", upcomingEventId)
        .eq("status", "going");
      if (liveGoingErr)
        throw new Error(`P5.4: live going-count read failed: ${liveGoingErr.message}`);
      const { data: viewGoingRow, error: viewGoingErr } = await member
        .from("member_event_going_counts")
        .select("going")
        .eq("event_id", upcomingEventId)
        .single();
      if (viewGoingErr)
        throw new Error(`P5.4: member_event_going_counts read failed: ${viewGoingErr.message}`);
      if (viewGoingRow.going !== liveGoingCount)
        throw new Error(
          `P5.4: member_event_going_counts (${viewGoingRow.going}) diverges from live count (${liveGoingCount})`,
        );

      // RSVP toggle
      const { error: rsvpGoingErr } = await member.rpc("member_rsvp", {
        p_event_id: upcomingEventId,
        p_going: true,
      });
      if (rsvpGoingErr) throw new Error(`P5.4: member_rsvp(going) failed: ${rsvpGoingErr.message}`);
      const { error: rsvpCancelErr } = await member.rpc("member_rsvp", {
        p_event_id: upcomingEventId,
        p_going: false,
      });
      if (rsvpCancelErr)
        throw new Error(`P5.4: member_rsvp(cancel) failed: ${rsvpCancelErr.message}`);
      const { data: ownRsvp, error: ownRsvpErr } = await member
        .from("event_rsvps")
        .select("event_id, member_id, status")
        .eq("event_id", upcomingEventId);
      if (ownRsvpErr) throw new Error(`P5.4: own-rsvp readback failed: ${ownRsvpErr.message}`);
      if (ownRsvp.length !== 1)
        throw new Error(`P5.4: expected exactly 1 own event_rsvps row, got ${ownRsvp.length}`);
      if (ownRsvp[0].status !== "cancelled")
        throw new Error(`P5.4: expected status 'cancelled' after toggle, got ${ownRsvp[0].status}`);

      await expectToken(
        member.rpc("member_rsvp", { p_event_id: pastEventId, p_going: true }),
        "rsvp_closed",
        "rsvp on a past event",
      );
      await expectToken(
        member.rpc("member_rsvp", { p_event_id: cancelledEventId, p_going: true }),
        "rsvp_closed",
        "rsvp on a cancelled event",
      );

      // write-denial: zero client write paths on the six base tables
      const { error: writeDenyErr } = await member.from("news").insert({ title: "x", body: "y" });
      if (!writeDenyErr) throw new Error("LEAK: authenticated client inserted directly into news");
      if (writeDenyErr.code !== "42501")
        throw new Error(
          `P5.4: news insert-denial expected 42501, got ${writeDenyErr.code} (${writeDenyErr.message})`,
        );

      console.log(
        "OK: completed member — news/polls visibility, pre-vote secrecy, vote PK, cross-poll/draft rejection, event going-count, rsvp toggle + closed-event guards",
      );
    }

    // P5.5 editor RPCs: audit-in-transaction + role gate + late-vote wall
    {
      // defensive: a previous crashed run may have left the probe article's
      // slug behind (unique constraint) — clear it before creating a fresh one
      const { error: staleSlugErr } = await db.from("news").delete().eq("slug", "probis-siakhle");
      if (staleSlugErr)
        throw new Error(`P5.5: stale probe-article cleanup failed: ${staleSlugErr.message}`);

      const editor = await signInAsSeededAdmin("509000004");
      let pollId;
      let articleId;
      try {
        const { data: newPollId, error: savePollErr } = await editor.rpc("admin_save_poll", {
          p_id: null,
          p_question: Q_PROBE_POLL,
          p_options: [OPT_A, OPT_B],
          p_ends_at: null,
        });
        if (savePollErr) throw new Error(`P5.5: admin_save_poll failed: ${savePollErr.message}`);
        pollId = newPollId;

        // first native text[] RPC parameter in this codebase — confirm the
        // array arrived intact server-side (exactly 2 options, in order)
        const { data: pollOpts, error: pollOptsErr } = await db
          .from("poll_options")
          .select("id, position, label")
          .eq("poll_id", pollId)
          .order("position");
        if (pollOptsErr)
          throw new Error(`P5.5: probe poll options read failed: ${pollOptsErr.message}`);
        if (pollOpts?.length !== 2 || pollOpts[0].label !== OPT_A || pollOpts[1].label !== OPT_B)
          throw new Error(
            `P5.5: admin_save_poll's text[] p_options did not arrive intact: ${JSON.stringify(pollOpts)}`,
          );

        const { count: saveAuditCount, error: saveAuditErr } = await db
          .from("audit_log")
          .select("*", { count: "exact", head: true })
          .eq("action", "poll.save")
          .eq("target_id", pollId);
        if (saveAuditErr)
          throw new Error(`P5.5: poll.save audit lookup failed: ${saveAuditErr.message}`);
        if (saveAuditCount !== 1)
          throw new Error(`P5.5: expected 1 poll.save audit row, got ${saveAuditCount}`);

        const { error: openErr } = await editor.rpc("admin_open_poll", { p_id: pollId });
        if (openErr) throw new Error(`P5.5: admin_open_poll failed: ${openErr.message}`);
        const { count: openAuditCount, error: openAuditErr } = await db
          .from("audit_log")
          .select("*", { count: "exact", head: true })
          .eq("action", "poll.open")
          .eq("target_id", pollId);
        if (openAuditErr)
          throw new Error(`P5.5: poll.open audit lookup failed: ${openAuditErr.message}`);
        if (openAuditCount !== 1)
          throw new Error(`P5.5: expected 1 poll.open audit row, got ${openAuditCount}`);

        const { error: expireErr } = await db
          .from("polls")
          .update({ ends_at: new Date(Date.now() - 3_600_000).toISOString() })
          .eq("id", pollId);
        if (expireErr) throw new Error(`P5.5: forcing poll expiry failed: ${expireErr.message}`);

        await expectToken(
          member.rpc("member_cast_vote", { p_poll_id: pollId, p_option_id: pollOpts[0].id }),
          "poll_closed",
          "vote past the ends_at wall",
        );

        const { error: closeErr } = await editor.rpc("admin_close_poll", { p_id: pollId });
        if (closeErr) throw new Error(`P5.5: admin_close_poll failed: ${closeErr.message}`);
        const { count: closeAuditCount, error: closeAuditErr } = await db
          .from("audit_log")
          .select("*", { count: "exact", head: true })
          .eq("action", "poll.close")
          .eq("target_id", pollId);
        if (closeAuditErr)
          throw new Error(`P5.5: poll.close audit lookup failed: ${closeAuditErr.message}`);
        if (closeAuditCount !== 1)
          throw new Error(`P5.5: expected 1 poll.close audit row, got ${closeAuditCount}`);

        // status-branch poll_closed: distinct from the ends_at-wall check above,
        // which hit poll_closed via time expiry rather than the status column.
        await expectToken(
          member.rpc("member_cast_vote", { p_poll_id: pollId, p_option_id: pollOpts[0].id }),
          "poll_closed",
          "vote on a poll closed via admin_close_poll",
        );

        console.log(
          "OK: admin_save_poll/open/close each write exactly 1 audit row; text[] p_options intact; late vote hits poll_closed",
        );

        const verifier = await signInAsSeededAdmin("509000002");
        await expectToken(
          verifier.rpc("admin_save_news", {
            p_id: null,
            p_title: "X",
            p_body: "Y",
            p_visibility: "public",
          }),
          "missing_role",
          "verifier admin_save_news",
        );

        const { data: newArticleId, error: saveNewsErr } = await editor.rpc("admin_save_news", {
          p_id: null,
          p_title: PROBE_NEWS_TITLE,
          p_body: PROBE_NEWS_BODY,
          p_visibility: "public",
        });
        if (saveNewsErr) throw new Error(`P5.5: admin_save_news failed: ${saveNewsErr.message}`);
        articleId = newArticleId;

        const { data: publish1, error: publish1Err } = await editor.rpc("admin_publish_news", {
          p_id: articleId,
          p_slug: "probis-siakhle",
        });
        if (publish1Err) throw new Error(`P5.5: admin_publish_news failed: ${publish1Err.message}`);
        const permanentSlug = publish1.slug;
        if (permanentSlug !== "probis-siakhle")
          throw new Error(`P5.5: expected slug 'probis-siakhle', got ${permanentSlug}`);
        const { count: publishAuditCount, error: publishAuditErr } = await db
          .from("audit_log")
          .select("*", { count: "exact", head: true })
          .eq("action", "news.publish")
          .eq("target_id", articleId);
        if (publishAuditErr)
          throw new Error(`P5.5: news.publish audit lookup failed: ${publishAuditErr.message}`);
        if (publishAuditCount !== 1)
          throw new Error(`P5.5: expected 1 news.publish audit row, got ${publishAuditCount}`);

        const { error: unpublishErr } = await editor.rpc("admin_unpublish_news", {
          p_id: articleId,
        });
        if (unpublishErr)
          throw new Error(`P5.5: admin_unpublish_news failed: ${unpublishErr.message}`);
        const { data: hiddenCheck, error: hiddenCheckErr } = await anon
          .from("public_news")
          .select("slug")
          .eq("slug", permanentSlug);
        if (hiddenCheckErr)
          throw new Error(
            `P5.5: post-unpublish public_news check failed: ${hiddenCheckErr.message}`,
          );
        if (hiddenCheck.length !== 0)
          throw new Error("LEAK: unpublished article's slug still visible via public_news");

        const { data: publish2, error: publish2Err } = await editor.rpc("admin_publish_news", {
          p_id: articleId,
          p_slug: "sxva-slagi",
        });
        if (publish2Err) throw new Error(`P5.5: re-publish failed: ${publish2Err.message}`);
        if (publish2.slug !== permanentSlug)
          throw new Error(`P5.5: slug must stay permanent across re-publish, got ${publish2.slug}`);

        await expectToken(
          editor.rpc("admin_delete_news", { p_id: articleId }),
          "invalid_status",
          "delete a once-published article",
        );

        console.log(
          "OK: news slug is permanent across unpublish/republish; a once-published article resists delete",
        );

        // image-URL bucket-pin (20260719150000_community.sql admin_set_news_image,
        // ~L396-421): anything outside the news-images bucket path is invalid_image;
        // a URL shaped like the real bucket public URL succeeds and is audited.
        await expectToken(
          editor.rpc("admin_set_news_image", {
            p_id: articleId,
            p_image_url: "https://evil.example/x.png",
          }),
          "invalid_image",
          "admin_set_news_image with a non-bucket URL",
        );
        // R2 (§9d) pinned the host AND the uploader's exact filename shape
        // (<news-uuid>-<epoch-ms>.<ext>) — a foreign host carrying the bucket
        // path no longer satisfies the old LIKE pattern (closed, not just
        // "known accepted" as pre-R2). Mirror the real upload filename here.
        const probeImageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/news-images/${articleId}-${Date.now()}.png`;
        const { error: setImageErr } = await editor.rpc("admin_set_news_image", {
          p_id: articleId,
          p_image_url: probeImageUrl,
        });
        if (setImageErr)
          throw new Error(`P5.5: admin_set_news_image failed: ${setImageErr.message}`);
        const { data: imagedArticle, error: imagedArticleErr } = await db
          .from("news")
          .select("image_url")
          .eq("id", articleId)
          .single();
        if (imagedArticleErr)
          throw new Error(`P5.5: post-set_image news read failed: ${imagedArticleErr.message}`);
        if (imagedArticle.image_url !== probeImageUrl)
          throw new Error(
            `P5.5: image_url not set as expected: got ${imagedArticle.image_url}, expected ${probeImageUrl}`,
          );
        const { count: setImageAuditCount, error: setImageAuditErr } = await db
          .from("audit_log")
          .select("*", { count: "exact", head: true })
          .eq("action", "news.set_image")
          .eq("target_id", articleId);
        if (setImageAuditErr)
          throw new Error(`P5.5: news.set_image audit lookup failed: ${setImageAuditErr.message}`);
        if (setImageAuditCount !== 1)
          throw new Error(`P5.5: expected 1 news.set_image audit row, got ${setImageAuditCount}`);

        console.log(
          "OK: admin_set_news_image rejects a non-bucket URL (invalid_image), accepts + audits a real bucket URL",
        );
      } finally {
        if (pollId) {
          const { error } = await db.from("polls").delete().eq("id", pollId);
          if (error) console.error(`WARNING: P5.5 probe poll cleanup failed: ${error.message}`);
        }
        if (articleId) {
          const { error } = await db.from("news").delete().eq("id", articleId);
          if (error) console.error(`WARNING: P5.5 probe article cleanup failed: ${error.message}`);
        }
      }
    }

    // P5.7 delegate_team_rsvps — the one PII-bearing surface
    {
      // the P5.4 completed member (not a delegate): rpc → error 'not_a_delegate'
      await expectToken(
        member.rpc("delegate_team_rsvps"),
        "not_a_delegate",
        "delegate_team_rsvps for a non-delegate",
      );

      // a seeded APPROVED delegate: sign in via the dev_otp_inbox flow (same
      // mechanics as signInAsSeededAdmin, phone = an approved delegate's, read
      // from the roster via the service client)
      const { data: approvedDelegateProfile, error: approvedDelegateErr } = await db
        .from("delegates")
        .select("id")
        .eq("status", "approved")
        .order("id")
        .limit(1)
        .single();
      if (approvedDelegateErr)
        throw new Error(`P5.7: approved delegate lookup failed: ${approvedDelegateErr.message}`);
      const { data: approvedDelegatePhoneRow, error: approvedDelegatePhoneErr } = await db
        .from("profiles")
        .select("phone")
        .eq("id", approvedDelegateProfile.id)
        .single();
      if (approvedDelegatePhoneErr || !approvedDelegatePhoneRow?.phone)
        throw new Error(
          `P5.7: approved delegate has no phone for OTP sign-in: ${approvedDelegatePhoneErr?.message}`,
        );
      const delegateClient = await signInAsSeededAdmin(
        approvedDelegatePhoneRow.phone.replace(/^\+995/, ""),
      );

      // recreated delegate_panel (7b): still callable; registeredCount counts
      // 'registered' standing via the same jsonb key (rename shipped — R2 §8,
      // this call site predates it and was still asserting the old key name)
      const { data: panel, error: panelErr } = await delegateClient.rpc("delegate_panel");
      if (panelErr) throw new Error(`P5.7: delegate_panel failed: ${panelErr.message}`);
      if (typeof panel.registeredCount !== "number" || panel.registeredCount < 0)
        throw new Error(`P5.7: delegate_panel registeredCount malformed: ${JSON.stringify(panel)}`);

      const { data: teamEvents, error: teamEventsErr } =
        await delegateClient.rpc("delegate_team_rsvps");
      if (teamEventsErr)
        throw new Error(`P5.7: delegate_team_rsvps failed: ${teamEventsErr.message}`);
      if (!Array.isArray(teamEvents))
        throw new Error(`P5.7: delegate_team_rsvps must return an array, got ${typeof teamEvents}`);

      // TEAM ISOLATION: every 'going' name in the result must belong to THAT
      // delegate's current team (service-verify the name set against
      // memberships where delegate_id = that delegate and ended_at is null)
      const { data: teamMembers, error: teamMembersErr } = await db
        .from("memberships")
        .select("member_id")
        .eq("delegate_id", approvedDelegateProfile.id)
        .is("ended_at", null);
      if (teamMembersErr)
        throw new Error(`P5.7: team roster lookup failed: ${teamMembersErr.message}`);
      const { data: teamProfiles, error: teamProfilesErr } = await db
        .from("profiles")
        .select("first_name, last_name")
        .in(
          "id",
          (teamMembers ?? []).map((m) => m.member_id),
        );
      if (teamProfilesErr)
        throw new Error(`P5.7: team profiles lookup failed: ${teamProfilesErr.message}`);
      const teamNameSet = new Set((teamProfiles ?? []).map((p) => `${p.first_name} ${p.last_name}`));
      for (const ev of teamEvents) {
        if (ev.goingCount !== (ev.going ?? []).length)
          throw new Error(
            `P5.7: goingCount (${ev.goingCount}) does not match going.length (${(ev.going ?? []).length}) for event ${ev.eventId}`,
          );
        for (const g of ev.going ?? []) {
          const nameKey = `${g.firstName} ${g.lastName}`;
          if (!teamNameSet.has(nameKey))
            throw new Error(
              `P5.7: TEAM ISOLATION LEAK — ${g.firstName} ${g.lastName} appears in event ${ev.eventId} but is not on delegate ${approvedDelegateProfile.id}'s team`,
            );
        }
      }
      console.log(
        `OK: delegate_team_rsvps — not_a_delegate for a member, team isolation holds for an approved delegate (${teamEvents.length} events)`,
      );
    }

    // P5.6 storage: news-images bucket exists and is public
    {
      const { data: bucket, error: bucketErr } = await db.storage.getBucket("news-images");
      if (bucketErr || !bucket)
        throw new Error(`P5.6: news-images bucket missing: ${bucketErr?.message}`);
      if (!bucket.public) throw new Error("P5.6: news-images bucket must be public-read");
      console.log("OK: news-images bucket present and public");
    }
  } finally {
    // fpId (the Phase 2 completed member) was kept alive on success for P5.4/
    // P5.5/P5.7 to reuse — Phase 5 is its last consumer, so it owns cleanup here.
    const { error } = await db.auth.admin.deleteUser(fpId);
    if (error)
      console.error(
        `WARNING: Phase 5 completed-member cleanup (deleteUser ${fpId}) failed: ${error.message}`,
      );
  }
  console.log("OK: Phase 5 community probes complete (spec §4.6 guarantees hold)");
}
