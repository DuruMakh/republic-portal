/**
 * Seeds STAGING with the prototype roster. Destructive by design: wipes all
 * auth users EXCEPT the 4 canonical admins (permanent audit actors — see below),
 * then recreates roster delegates + their supporter members deterministically.
 * Reseeding is routine drift recovery: the admin steps are all idempotent.
 *
 * Phase 4: statuses are NO LONGER hand-written. The seed writes payment
 * histories (bank_reference "SEED-<i>") and lets the engine derive
 * active_member via recompute_all_active(). Staging activity therefore decays
 * honestly over time (members lapse ~60 days after their seeded payment) —
 * re-run this seed to refresh. Also seeds 4 canonical admin accounts
 * (+99550900000{1..4}: super_admin/verifier/finance/editor) used by e2e and
 * the schema probes as audit ACTORS (never deleted — audit_log.actor_id is a
 * plain FK and audit rows are append-only).
 *
 * Guards: refuses on NEXT_PUBLIC_APP_ENV=production; requires
 * `--confirm-ref <project-ref>` matching NEXT_PUBLIC_SUPABASE_URL.
 *
 * Run: node --env-file=.env.local scripts/seed-staging.mjs --confirm-ref <ref>
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
// Canonical production detection lives in lib/env.ts (isProductionEnv). This .mjs guard mirrors
// the env-flag half; the --confirm-ref check below pins the exact target project, which is the
// stronger guard for this destructive script.
if (process.env.NEXT_PUBLIC_APP_ENV === "production") {
  console.error("Refusing to seed: NEXT_PUBLIC_APP_ENV=production");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
const flagIdx = process.argv.indexOf("--confirm-ref");
if (flagIdx < 0 || process.argv[flagIdx + 1] !== ref) {
  console.error(`Refusing to seed: pass --confirm-ref ${ref} to confirm the target project.`);
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const roster = JSON.parse(readFileSync(new URL("./seed-roster.json", import.meta.url), "utf8"));

const pad = (n, w) => String(n).padStart(w, "0");
const phoneFor = (i) => `+99550${pad(i, 7)}`; // 9 national digits starting 5; '50' block is seed-only
const personalIdFor = (i) => `1${pad(i, 10)}`;
const ACTIVE_RATIO = 0.86; // prototype parity
const TIERS = [5, 10, 20];
const tierFor = (i) => TIERS[i % 3];
// GR-code alphabet (lib/funnel.ts FUNNEL_CODE_ALPHABET) — deterministic base-31
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const refCodeFor = (i) => {
  let n = i;
  let out = "";
  for (let k = 0; k < 6; k++) {
    out = CODE_ALPHABET[n % 31] + out;
    n = Math.floor(n / 31);
  }
  return `GR-${out}`;
};
const daysAgoIso = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
const daysAgoDate = (d) => daysAgoIso(d).slice(0, 10);

const FIRST = [
  "ნინო",
  "გიორგი",
  "მარიამ",
  "დავით",
  "ანა",
  "ლევან",
  "სოფიო",
  "ზურაბ",
  "ეკა",
  "ირაკლი",
  "თამარ",
  "ლუკა",
  "ბარბარე",
  "სანდრო",
];
const LAST = [
  "ბერიძე",
  "მაისურაძე",
  "ლომიძე",
  "კაპანაძე",
  "ჯღარკავა",
  "წერეთელი",
  "გოგოლაძე",
  "ხარაზი",
  "ნოზაძე",
  "ფარცხალაძე",
];

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

async function insertChunked(table, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await db.from(table).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
}

console.log(`Seeding project ${ref} …`);

// 1) Full reset: delete every auth user EXCEPT the canonical admins. They are
// permanent audit ACTORS — audit_log.actor_id is a plain FK and audit rows are
// append-only, so once an admin has acted, deleting them is IMPOSSIBLE (FK 23503);
// skipping them is what keeps reseeds repeatable. Cascades handle everyone else:
// profiles → delegates/memberships/payments.
const ADMIN_AUTH_PHONES = new Set(
  [1, 2, 3, 4].map((n) => `99550900000${n}`), // auth stores phones without '+'
);
const isCanonicalAdmin = (u) => ADMIN_AUTH_PHONES.has((u.phone ?? "").replace(/^\+/, ""));
// Admin membership rows point at a roster delegate this wipe deletes, and
// memberships.delegate_id has NO cascade — detach first (re-attached in the
// canonical-admins step below).
const { data: oldAdmins, error: oldAdminErr } = await db
  .from("profiles")
  .select("id")
  .in(
    "phone",
    [1, 2, 3, 4].flatMap((n) => [`+99550900000${n}`, `99550900000${n}`]),
  );
if (oldAdminErr) throw oldAdminErr;
const oldAdminIds = (oldAdmins ?? []).map((r) => r.id);
if (oldAdminIds.length > 0) {
  const { error: detachErr } = await db.from("memberships").delete().in("member_id", oldAdminIds);
  if (detachErr) throw new Error(`admin membership detach failed: ${detachErr.message}`);
}
let wiped = 0;
for (;;) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const doomed = data.users.filter((u) => !isCanonicalAdmin(u));
  if (doomed.length === 0) break;
  await mapLimit(doomed, 10, async (u) => {
    const { error: e } = await db.auth.admin.deleteUser(u.id);
    if (e) throw new Error(`deleteUser ${u.id}: ${e.message}`);
  });
  wiped += doomed.length;
}
const { error: otpWipe } = await db.from("dev_otp_inbox").delete().gte("id", 0);
if (otpWipe) throw otpWipe;
console.log(`wiped ${wiped} auth users + dev_otp_inbox (canonical admins kept)`);

// 2) Region name → id
const { data: regions, error: regErr } = await db.from("regions").select("id, name_ka");
if (regErr) throw regErr;
const regionId = new Map(regions.map((r) => [r.name_ka, r.id]));
for (const d of roster) {
  if (!regionId.has(d.region)) throw new Error(`unknown region in roster: ${d.region}`);
}

// 3) Build the full person list: 15 delegates + their supporters
let seq = 0;
const people = []; // { i, first_name, last_name, region, kind, delegate: rosterEntry|null, supporterOf: slug|null }
for (const d of roster) {
  people.push({
    i: ++seq,
    first_name: d.first_name,
    last_name: d.last_name,
    region: d.region,
    kind: "active", // delegates pay too — the engine derives their status
    delegate: d,
    supporterOf: null,
  });
}
for (const d of roster) {
  const active = Math.round(d.supporters * ACTIVE_RATIO);
  for (let k = 0; k < d.supporters; k++) {
    const i = ++seq;
    people.push({
      i,
      first_name: FIRST[(k + i) % FIRST.length],
      last_name: LAST[(k * 3 + i) % LAST.length],
      region: d.region,
      kind: k < active ? "active" : k % 2 === 0 ? "completed" : "draft",
      delegate: null,
      supporterOf: d.slug,
    });
  }
}
console.log(`creating ${people.length} auth users (a few minutes) …`);

// 4) Auth users (concurrency 10), then bulk-insert profiles/delegates/memberships
const created = await mapLimit(people, 10, async (p) => {
  const { data, error } = await db.auth.admin.createUser({
    phone: phoneFor(p.i),
    phone_confirm: true,
  });
  if (error) throw new Error(`createUser #${p.i}: ${error.message}`);
  return { ...p, id: data.user.id };
});

await insertChunked(
  "profiles",
  created.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    phone: phoneFor(p.i),
    personal_id: personalIdFor(p.i),
    region_id: regionId.get(p.region),
    // the engine owns profile_completed ⇄ active_member; seed never writes 'active_member'
    status: p.kind === "draft" ? "draft" : "profile_completed",
    ...(p.kind === "draft"
      ? {}
      : {
          membership_tier: tierFor(p.i),
          reference_code: refCodeFor(p.i),
          registration_completed_at: daysAgoIso(30 + (p.i % 200)),
        }),
    ...(p.delegate ? { signup_role: "delegate" } : {}),
  })),
);

const delegateIdBySlug = new Map();
for (const p of created) {
  if (p.delegate) delegateIdBySlug.set(p.delegate.slug, p.id);
}
await insertChunked(
  "delegates",
  created
    .filter((p) => p.delegate)
    .map((p) => ({
      id: p.id,
      status: p.delegate.status,
      referral_code: `D${pad(p.i, 5)}`,
      slug: p.delegate.slug,
      bio: p.delegate.bio,
      tc_accepted_at: new Date().toISOString(),
    })),
);
await insertChunked(
  "memberships",
  created
    .filter((p) => p.supporterOf)
    .map((p) => ({ member_id: p.id, delegate_id: delegateIdBySlug.get(p.supporterOf) })),
);

// Payments make people active — the engine derives status from these rows.
// paid_at within the last 25 days ⇒ coverage (30d) + grace (30d) safely covers today.
// Every 7th active person prepays 3 months (multi-month coverage in the demo data).
// Every 5th COMPLETED person carries a LAPSED payment (70–99 days old — outside the
// 60-day window): staging demonstrates expiry histories (spec §8) without changing
// who is active. Keep `paymentRows` in scope — the step-6 assertion counts it.
const paymentRows = created
  .filter((p) => p.kind === "active")
  .map((p) => {
    const tier = tierFor(p.i);
    const months = p.i % 7 === 0 ? 3 : 1;
    return {
      member_id: p.id,
      amount_gel: tier * months,
      paid_at: daysAgoDate(p.i % 25),
      bank_reference: `SEED-${p.i}`,
      source: "manual",
      recorded_by: null,
      tier_gel_at_payment: tier,
    };
  })
  .concat(
    created
      .filter((p) => p.kind === "completed" && p.i % 5 === 0)
      .map((p) => {
        const tier = tierFor(p.i);
        return {
          member_id: p.id,
          amount_gel: tier,
          paid_at: daysAgoDate(70 + (p.i % 30)),
          bank_reference: `SEED-L${p.i}`,
          source: "manual",
          recorded_by: null,
          tier_gel_at_payment: tier,
        };
      }),
  );
await insertChunked("payments", paymentRows);

// Canonical admins (spec §7 + §8): fixed phones, completed members, roles attached.
// e2e + probes sign in as these via the dev OTP inbox. NEVER deleted — they are
// audit ACTORS (audit_log.actor_id FK + append-only trigger make actors permanent);
// the wipe above skips them, so this step is get-or-create (idempotent reseeds).
// Deliberate spec §8 deviation, recorded there: FOUR roles (the e2e editor-notice
// flow needs an editor login) on the 509-block — the 55-block is the DISPOSABLE
// e2e range, and permanent audit actors must live outside it.
const ADMIN_SEED = [
  { n: 1, role: "super_admin", first_name: "ადმინი", last_name: "მთავარი" },
  { n: 2, role: "verifier", first_name: "ვერიფიკატორი", last_name: "გუნდი" },
  { n: 3, role: "finance", first_name: "ფინანსური", last_name: "გუნდი" },
  { n: 4, role: "editor", first_name: "რედაქტორი", last_name: "გუნდი" },
];
const tbilisiId = regionId.get("თბილისი");
const firstDelegateId = delegateIdBySlug.get(roster[0].slug);
for (const a of ADMIN_SEED) {
  const phone = `+99550900000${a.n}`;
  const { data: prior, error: priorErr } = await db
    .from("profiles")
    .select("id")
    .in("phone", [phone, phone.slice(1)]);
  if (priorErr) throw new Error(`admin lookup ${phone}: ${priorErr.message}`);
  let adminId = prior?.[0]?.id;
  if (!adminId) {
    const { data: u, error: uErr } = await db.auth.admin.createUser({
      phone,
      phone_confirm: true,
    });
    if (uErr) throw new Error(`admin createUser ${phone}: ${uErr.message}`);
    adminId = u.user.id;
    const { error: pErr } = await db.from("profiles").insert({
      id: adminId,
      first_name: a.first_name,
      last_name: a.last_name,
      phone,
      personal_id: `1${pad(9000000 + a.n, 10)}`,
      region_id: tbilisiId,
      status: "profile_completed",
      membership_tier: 10,
      reference_code: refCodeFor(900000 + a.n),
      registration_completed_at: daysAgoIso(10),
    });
    if (pErr) throw new Error(`admin profile ${phone}: ${pErr.message}`);
  }
  // open membership row: detached before the wipe (the old delegate is gone) —
  // attach to this run's first roster delegate
  const { error: mErr } = await db
    .from("memberships")
    .insert({ member_id: adminId, delegate_id: firstDelegateId });
  if (mErr) throw new Error(`admin membership ${phone}: ${mErr.message}`);
  const { error: rErr } = await db
    .from("admin_roles")
    .upsert(
      { user_id: adminId, role: a.role, granted_by: null },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
  if (rErr) throw new Error(`admin role ${phone}: ${rErr.message}`);
}
console.log("seeded 4 canonical admin accounts (+99550900000{1..4})");

// 5) Sanity: the views must report exactly the expected world
// The engine, not the seed, decides who is active (spec §8).
const { error: recomputeErr } = await db.rpc("recompute_all_active");
if (recomputeErr) throw new Error(`recompute_all_active failed: ${recomputeErr.message}`);

const { data: stats, error: statsErr } = await db.from("public_stats").select("*").single();
if (statsErr) throw statsErr;
const { data: top, error: topErr } = await db
  .from("public_delegates")
  .select("slug, active_supporters")
  .order("active_supporters", { ascending: false })
  .limit(1)
  .single();
if (topErr) throw topErr;

console.log(`public_stats: ${JSON.stringify(stats)}; top: ${JSON.stringify(top)}`);
if (stats.approved_delegates !== 12)
  throw new Error(`expected 12 approved delegates, got ${stats.approved_delegates}`);
if (stats.active_members !== 1636)
  throw new Error(`expected 1636 active members, got ${stats.active_members}`);
if (top.slug !== "giorgi-maisuradze" || top.active_supporters !== 294)
  throw new Error(`unexpected leaderboard top: ${JSON.stringify(top)}`);

const { count: paymentCount, error: payCountErr } = await db
  .from("payments")
  .select("*", { count: "exact", head: true })
  .like("bank_reference", "SEED-%");
if (payCountErr) throw payCountErr;
if (paymentCount !== paymentRows.length)
  throw new Error(`expected ${paymentRows.length} seeded payments, got ${paymentCount}`);
// Count only the CANONICAL admins' roles — the owner's own grant-admin.mjs grant
// must not break reseeds.
const { data: canonAdmins, error: canonErr } = await db
  .from("profiles")
  .select("id")
  .in(
    "phone",
    [1, 2, 3, 4].flatMap((n) => [`+99550900000${n}`, `99550900000${n}`]),
  );
if (canonErr) throw canonErr;
const { count: adminCount, error: adminCountErr } = await db
  .from("admin_roles")
  .select("*", { count: "exact", head: true })
  .in(
    "user_id",
    (canonAdmins ?? []).map((r) => r.id),
  );
if (adminCountErr) throw adminCountErr;
if (adminCount !== 4) throw new Error(`expected 4 canonical admin roles, got ${adminCount}`);
console.log("SEED OK");
