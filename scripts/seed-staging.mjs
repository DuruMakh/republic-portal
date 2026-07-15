/**
 * Seeds STAGING with the prototype roster. Destructive by design:
 * wipes ALL auth users (staging holds synthetic data only), then recreates
 * roster delegates + their supporter members deterministically.
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

// 1) Full reset: delete every auth user (cascades: profiles → delegates/memberships)
let wiped = 0;
for (;;) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  if (data.users.length === 0) break;
  await mapLimit(data.users, 10, async (u) => {
    const { error: e } = await db.auth.admin.deleteUser(u.id);
    if (e) throw new Error(`deleteUser ${u.id}: ${e.message}`);
  });
  wiped += data.users.length;
}
const { error: otpWipe } = await db.from("dev_otp_inbox").delete().gte("id", 0);
if (otpWipe) throw otpWipe;
console.log(`wiped ${wiped} auth users + dev_otp_inbox`);

// 2) Region name → id
const { data: regions, error: regErr } = await db.from("regions").select("id, name_ka");
if (regErr) throw regErr;
const regionId = new Map(regions.map((r) => [r.name_ka, r.id]));
for (const d of roster) {
  if (!regionId.has(d.region)) throw new Error(`unknown region in roster: ${d.region}`);
}

// 3) Build the full person list: 15 delegates + their supporters
let seq = 0;
const people = []; // { i, first_name, last_name, region, status, delegate: rosterEntry|null, supporterOf: slug|null }
for (const d of roster) {
  people.push({
    i: ++seq,
    first_name: d.first_name,
    last_name: d.last_name,
    region: d.region,
    status: "active_member",
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
      status: k < active ? "active_member" : k % 2 === 0 ? "profile_completed" : "draft",
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
    status: p.status,
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

// 5) Sanity: the views must report exactly the expected world
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
console.log("SEED OK");
