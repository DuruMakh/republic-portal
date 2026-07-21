/**
 * Seeds STAGING with the prototype roster. Destructive by design: wipes all
 * payments and all auth users EXCEPT permanent audit actors (the 4 canonical
 * admins + anyone who ever acted in the append-only audit log — deleting an
 * actor is impossible, FK 23503), then recreates roster delegates + their
 * supporter members deterministically. Reseeding is routine drift recovery:
 * the admin steps are all idempotent and orphan-tolerant.
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
const KA_LAT = {
  ა: "a",
  ბ: "b",
  გ: "g",
  დ: "d",
  ე: "e",
  ვ: "v",
  ზ: "z",
  თ: "t",
  ი: "i",
  კ: "k",
  ლ: "l",
  მ: "m",
  ნ: "n",
  ო: "o",
  პ: "p",
  ჟ: "zh",
  რ: "r",
  ს: "s",
  ტ: "t",
  უ: "u",
  ფ: "p",
  ქ: "k",
  ღ: "gh",
  ყ: "q",
  შ: "sh",
  ჩ: "ch",
  ც: "ts",
  ძ: "dz",
  წ: "ts",
  ჭ: "ch",
  ხ: "kh",
  ჯ: "j",
  ჰ: "h",
};
const slugify = (text, fallback) => {
  const s = [...text]
    .map((c) => KA_LAT[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
};
const hoursFromNowIso = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

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

// 0) One-off debris cleanup: a prior task's LIVE verification against staging
// (manual register()/become_member exercise) left disclosed QA rows behind.
// Idempotent and harmless when the rows are already absent — matched by phone
// OR personal_id, since a debris row may only carry one of the two disclosed
// identifiers. Mirrors e2e/funnel-helpers.ts cleanupJourneyUsers'
// detach-then-delete pattern: memberships.delegate_id has NO cascade, so a
// membership pointing at a debris row (as a delegate) would block deleteUser.
{
  const debrisPhones = ["+995555000071", "995555000071"];
  const debrisPersonalIds = ["19990000071", "19990000099"];
  const { data: debrisByPhone, error: debrisPhoneErr } = await db
    .from("profiles")
    .select("id")
    .in("phone", debrisPhones);
  if (debrisPhoneErr) throw new Error(`debris cleanup (phone lookup): ${debrisPhoneErr.message}`);
  const { data: debrisByPid, error: debrisPidErr } = await db
    .from("profiles")
    .select("id")
    .in("personal_id", debrisPersonalIds);
  if (debrisPidErr) throw new Error(`debris cleanup (personal_id lookup): ${debrisPidErr.message}`);
  const debrisIds = [
    ...new Set([...(debrisByPhone ?? []), ...(debrisByPid ?? [])].map((r) => r.id)),
  ];
  if (debrisIds.length > 0) {
    const { error: debrisDetachErr } = await db
      .from("memberships")
      .delete()
      .in("delegate_id", debrisIds);
    if (debrisDetachErr)
      throw new Error(`debris cleanup: membership detach failed: ${debrisDetachErr.message}`);
    for (const id of debrisIds) {
      const { error: debrisDelErr } = await db.auth.admin.deleteUser(id);
      if (debrisDelErr)
        throw new Error(`debris cleanup: deleteUser ${id} failed: ${debrisDelErr.message}`);
    }
    console.log(`debris cleanup: removed ${debrisIds.length} disclosed QA row(s)`);
  }
}

// 1) Full reset: delete every auth user EXCEPT the permanent audit ACTORS —
// audit_log.actor_id is a plain FK and audit rows are append-only, so once an
// admin has acted, deleting them is IMPOSSIBLE (FK 23503). That covers the 4
// canonical admins AND any admin the owner granted via grant-admin.mjs; the
// wipe must SKIP all of them or it aborts half-done on the FK. Cascades handle
// everyone else: profiles → delegates/memberships.
const ADMIN_AUTH_PHONES = new Set(
  [1, 2, 3, 4].map((n) => `99550900000${n}`), // auth stores phones without '+'
);
const isCanonicalAdmin = (u) => ADMIN_AUTH_PHONES.has((u.phone ?? "").replace(/^\+/, ""));
// memberships.delegate_id has NO cascade, so deleting a roster delegate is
// blocked while any membership still references it — supporter rows AND the
// canonical admins' own rows. The auth-user wipe below is concurrent and
// unordered, so a delegate can be reached before its supporters. Clear EVERY
// membership up front to make the wipe order-independent; all memberships are
// re-created in the reseed (supporters below, canonical admins in their step).
// (id is bigserial, always > 0 — matches all rows.)
const { error: detachErr } = await db.from("memberships").delete().gte("id", 0);
if (detachErr) throw new Error(`membership wipe failed: ${detachErr.message}`);
// Payments are wiped outright, not left to the profile cascade: (a) a QA
// payment recorded FOR a wipe-surviving admin would otherwise persist, make the
// engine mark them active and poison the exact-count assertions forever, and
// (b) payments.recorded_by/voided_by reference the recording admin, blocking
// user deletion in FK-order-dependent ways. Every payment is re-created below.
const { error: payWipeErr } = await db.from("payments").delete().gte("id", 0);
if (payWipeErr) throw new Error(`payments wipe failed: ${payWipeErr.message}`);
// app_settings.updated_by references profiles — clear it so a settings change
// by a non-canonical admin never blocks that admin's (or anyone's) deletion.
const { error: settingsDetachErr } = await db
  .from("app_settings")
  .update({ updated_by: null })
  .not("updated_by", "is", null);
if (settingsDetachErr) throw new Error(`app_settings detach failed: ${settingsDetachErr.message}`);
// Undeletable users = anyone who ever ACTED in the audit log (append-only —
// those rows can never be cleared) + current role holders (about to act).
const protectedIds = new Set();
for (let off = 0; ; off += 1000) {
  const { data: acts, error: actErr } = await db
    .from("audit_log")
    .select("actor_id")
    .not("actor_id", "is", null)
    .order("id")
    .range(off, off + 999);
  if (actErr) throw new Error(`audit actors read failed: ${actErr.message}`);
  for (const a of acts ?? []) protectedIds.add(a.actor_id);
  if ((acts ?? []).length < 1000) break;
}
const { data: roleHolders, error: roleHoldersErr } = await db.from("admin_roles").select("user_id");
if (roleHoldersErr) throw new Error(`admin_roles read failed: ${roleHoldersErr.message}`);
for (const r of roleHolders ?? []) protectedIds.add(r.user_id);
let wiped = 0;
for (;;) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const doomed = data.users.filter((u) => !isCanonicalAdmin(u) && !protectedIds.has(u.id));
  if (doomed.length === 0) break;
  await mapLimit(doomed, 10, async (u) => {
    const { error: e } = await db.auth.admin.deleteUser(u.id);
    if (e) throw new Error(`deleteUser ${u.id}: ${e.message}`);
  });
  wiped += doomed.length;
}
const { error: otpWipe } = await db.from("dev_otp_inbox").delete().gte("id", 0);
if (otpWipe) throw otpWipe;
// One pass over what survived: canonical auth ids (get-or-create below reuses
// them even when a prior crash left no profiles row — keying existence on
// profiles alone bricked reseeding forever) + non-canonical survivors, whose
// approved-delegate rows must widen the count assertions.
const canonicalAuthIdByPhone = new Map();
const survivorIds = [];
for (let pageNo = 1; ; pageNo++) {
  const { data: rem, error: remErr } = await db.auth.admin.listUsers({
    page: pageNo,
    perPage: 1000,
  });
  if (remErr) throw remErr;
  for (const u of rem.users) {
    const bare = (u.phone ?? "").replace(/^\+/, "");
    if (ADMIN_AUTH_PHONES.has(bare)) canonicalAuthIdByPhone.set(`+${bare}`, u.id);
    else survivorIds.push(u.id);
  }
  if (rem.users.length < 1000) break;
}
if (survivorIds.length > 0) {
  console.warn(
    `WARN: ${survivorIds.length} non-canonical audit actor(s) survive the wipe ` +
      `(append-only audit rows make them undeletable); count assertions adjust below`,
  );
}
console.log(`wiped ${wiped} auth users + all payments + dev_otp_inbox (audit actors kept)`);

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
      kind: k < active ? "active" : k % 2 === 0 ? "completed" : "registered",
      delegate: null,
      supporterOf: d.slug,
    });
  }
}
const kindCounts = people.reduce((acc, p) => {
  acc[p.kind] = (acc[p.kind] ?? 0) + 1;
  return acc;
}, {});
console.log(`people by kind: ${JSON.stringify(kindCounts)}`);
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
    // the engine owns profile_completed ⇄ active_member; seed never writes 'active_member'
    status: p.kind === "registered" ? "registered" : "profile_completed",
    // registered-kind rows completed only the light form (name+surname+personal_id+
    // phone, spec §4.1) — no region/tier/reference_code/completion stamp yet.
    ...(p.kind === "registered"
      ? {}
      : {
          region_id: regionId.get(p.region),
          membership_tier: tierFor(p.i),
          reference_code: refCodeFor(p.i),
          registration_completed_at: daysAgoIso(30 + (p.i % 200)),
        }),
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
// Only member-standing kinds (active/completed) open a membership row — spec
// invariant D1 ("only members hold a membership; backing is a member
// privilege"). Registered-kind supporters keep supporterOf (the referral /
// signup_ref_code capture is legitimate — they were genuinely referred by a
// delegate) but must NOT get a membership row: they are light standing, not
// members. Keep `memberRows` in scope — the D1 self-check below counts it.
const memberRows = created
  .filter((p) => p.supporterOf && (p.kind === "active" || p.kind === "completed"))
  .map((p) => ({ member_id: p.id, delegate_id: delegateIdBySlug.get(p.supporterOf) }));
await insertChunked("memberships", memberRows);

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
    // orphan-safe: a prior crash between createUser and the profiles insert
    // leaves an auth user with no profile — reuse it instead of a createUser
    // that fails "phone already registered" on every subsequent run
    adminId = canonicalAuthIdByPhone.get(phone) ?? null;
    if (!adminId) {
      const { data: u, error: uErr } = await db.auth.admin.createUser({
        phone,
        phone_confirm: true,
      });
      if (uErr) throw new Error(`admin createUser ${phone}: ${uErr.message}`);
      adminId = u.user.id;
    }
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

// --- Phase 5: community content ------------------------------------------------
console.log("Seeding community content…");

// wipe (uuid PKs — filter on created_at; votes/options/rsvps cascade)
for (const table of ["news", "events", "polls"]) {
  const { error } = await db.from(table).delete().gte("created_at", "1970-01-01T00:00:00Z");
  if (error) throw new Error(`${table} wipe failed: ${error.message}`);
}

// author: the canonical editor (never wiped — audit-actor invariant)
const { data: editorProfile, error: editorErr } = await db
  .from("profiles")
  .select("id")
  .in("phone", ["+995509000004", "995509000004"])
  .single();
if (editorErr || !editorProfile)
  throw new Error("canonical editor profile missing — run the admin section first");
const editorId = editorProfile.id;

// a completed-member pool for votes/RSVPs (never canonical admins as SUBJECTS is
// fine — votes/RSVPs are member acts, not audited admin acts; still, use roster members)
const { data: memberPool, error: poolErr } = await db
  .from("profiles")
  .select("id")
  .neq("status", "registered")
  .not("phone", "like", "+9955090000%")
  .order("created_at")
  .limit(120);
if (poolErr || !memberPool || memberPool.length < 30) {
  throw new Error(
    `member pool too small for community seed: ${poolErr?.message ?? memberPool?.length}`,
  );
}
const poolIds = memberPool.map((r) => r.id);

// news: 4 public published, 1 members-only published, 1 draft
const NEWS = [
  { t: "მოძრაობა იწყებს რეგიონულ ტურს", d: 2, vis: "public" },
  { t: "გამოქვეყნდა პლატფორმის განახლება", d: 5, vis: "public" },
  { t: "შეხვედრა თბილისის გუნდთან", d: 9, vis: "public" },
  { t: "როგორ მუშაობს დელეგატების სისტემა", d: 14, vis: "public" },
  { t: "შიდა შეხვედრის ოქმი — მხოლოდ წევრებისთვის", d: 3, vis: "members" },
  { t: "მონახაზი: მომავალი კამპანია", d: 0, vis: "public", draft: true },
];
const newsRows = NEWS.map((n) => ({
  title: n.t,
  body: `${n.t} — სრული ტექსტი.\n\nდეტალები: https://respublika.ge/rules\n\nშემოგვიერთდი და მიიღე მონაწილეობა.`,
  visibility: n.vis,
  status: n.draft ? "draft" : "published",
  slug: n.draft ? null : slugify(n.t, "article"),
  published_at: n.draft ? null : daysAgoIso(n.d),
  created_by: editorId,
}));
await insertChunked("news", newsRows);

// one seeded cover on the first article (public bucket, tiny valid PNG)
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
{
  const path = "seed-cover.png";
  const { error: upErr } = await db.storage
    .from("news-images")
    .upload(path, PNG_1PX, { contentType: "image/png", upsert: true });
  if (upErr) throw new Error(`seed cover upload failed: ${upErr.message}`);
  const url = db.storage.from("news-images").getPublicUrl(path).data.publicUrl;
  const { data: first } = await db.from("news").select("id").eq("slug", newsRows[0].slug).single();
  if (first) {
    const { error } = await db.from("news").update({ image_url: url }).eq("id", first.id);
    if (error) throw new Error(`seed cover attach failed: ${error.message}`);
  }
}

// events: 2 upcoming, 2 past, 1 cancelled-upcoming
const EVENTS = [
  { t: "საერთო კრება თბილისში", startH: 24 * 7, endH: 24 * 7 + 2, status: "published" },
  { t: "რეგიონული შეხვედრა ქუთაისში", startH: 24 * 21, endH: null, status: "published" },
  { t: "გუნდის ვორქშოპი", startH: -24 * 7, endH: -24 * 7 + 3, status: "published" },
  { t: "წევრების პიკნიკი", startH: -24 * 30, endH: null, status: "published" },
  { t: "გაუქმებული ბრიფინგი", startH: 24 * 10, endH: null, status: "cancelled" },
];
const eventRows = EVENTS.map((e) => ({
  title: e.t,
  description: `${e.t}.\n\nდღის წესრიგი: https://respublika.ge/agenda`,
  location: "თბილისი, თავისუფლების მოედანი 1",
  starts_at: hoursFromNowIso(e.startH),
  ends_at: e.endH === null ? null : hoursFromNowIso(e.endH),
  status: e.status,
  slug: slugify(e.t, "event"),
  published_at: daysAgoIso(30),
  created_by: editorId,
}));
await insertChunked("events", eventRows);
const { data: seededEvents } = await db.from("events").select("id, slug, status, starts_at");
const upcomingIds = (seededEvents ?? [])
  .filter((e) => e.status === "published" && new Date(e.starts_at) > new Date())
  .map((e) => e.id);
const pastIds = (seededEvents ?? [])
  .filter((e) => e.status === "published" && new Date(e.starts_at) <= new Date())
  .map((e) => e.id);
const rsvpRows = [];
upcomingIds.forEach((eventId, ei) => {
  poolIds.slice(0, 40 + ei * 10).forEach((memberId, mi) => {
    rsvpRows.push({
      event_id: eventId,
      member_id: memberId,
      status: mi % 6 === 5 ? "cancelled" : "going",
    });
  });
});
pastIds.forEach((eventId) => {
  poolIds.slice(0, 25).forEach((memberId) => {
    rsvpRows.push({ event_id: eventId, member_id: memberId, status: "going" });
  });
});
await insertChunked("event_rsvps", rsvpRows);

// polls: closed-with-votes, open-with-votes (future ends_at), open-untouched
const POLLS = [
  {
    q: "უნდა ჩატარდეს თუ არა ღია პრაიმერიზი რეგიონულ დელეგატებზე?",
    opts: ["დიახ", "არა", "თავს ვიკავებ"],
    status: "closed",
    openedD: 30,
    closedD: 10,
    weights: [0.71, 0.14, 0.15],
    turnout: 90,
  },
  {
    q: "რომელი მიმართულება უნდა იყოს პრიორიტეტი 2026-ში?",
    opts: ["დეცენტრალიზაცია", "სასამართლო რეფორმა", "ეკონომიკა"],
    status: "open",
    openedD: 5,
    endsH: 24 * 10,
    weights: [0.44, 0.38, 0.18],
    turnout: 60,
  },
  {
    q: "სად გავმართოთ შემდეგი საერთო კრება?",
    opts: ["თბილისი", "ქუთაისი", "ბათუმი", "ონლაინ"],
    status: "open",
    openedD: 1,
    turnout: 0,
  },
];
for (const p of POLLS) {
  const { data: poll, error: pollErr } = await db
    .from("polls")
    .insert({
      question: p.q,
      status: p.status,
      ends_at: p.endsH ? hoursFromNowIso(p.endsH) : null,
      opened_at: daysAgoIso(p.openedD),
      closed_at: p.closedD ? daysAgoIso(p.closedD) : null,
      created_by: editorId,
    })
    .select("id")
    .single();
  if (pollErr || !poll) throw new Error(`poll insert failed: ${pollErr?.message}`);
  const optionRows = p.opts.map((label, i) => ({ poll_id: poll.id, position: i + 1, label }));
  const { data: options, error: optErr } = await db
    .from("poll_options")
    .insert(optionRows)
    .select("id, position");
  if (optErr || !options) throw new Error(`poll options failed: ${optErr?.message}`);
  if (p.turnout > 0) {
    const sorted = [...options].sort((a, b) => a.position - b.position);
    const voters = poolIds.slice(0, p.turnout);
    let cursor = 0;
    const voteRows = [];
    p.weights.forEach((w, oi) => {
      const n =
        oi === p.weights.length - 1 ? voters.length - cursor : Math.round(voters.length * w);
      voters.slice(cursor, cursor + n).forEach((memberId) => {
        voteRows.push({ poll_id: poll.id, option_id: sorted[oi].id, member_id: memberId });
      });
      cursor += n;
    });
    await insertChunked("poll_votes", voteRows);
  }
}
console.log(
  `Community: ${newsRows.length} news, ${eventRows.length} events, ${rsvpRows.length} rsvps, ${POLLS.length} polls`,
);

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
// Wipe-surviving audit actors may hold approved delegates rows from an earlier
// world — widen the expectation instead of failing a reseed forever. They can
// never be active_member (the wipe deleted every payment), so 1636 stays exact.
let expectedApproved = 12;
if (survivorIds.length > 0) {
  const { data: survDelegates, error: survErr } = await db
    .from("delegates")
    .select("id")
    .eq("status", "approved")
    .in("id", survivorIds);
  if (survErr) throw new Error(`survivor delegates read failed: ${survErr.message}`);
  expectedApproved += (survDelegates ?? []).length;
}
if (stats.approved_delegates !== expectedApproved)
  throw new Error(
    `expected ${expectedApproved} approved delegates, got ${stats.approved_delegates}`,
  );
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
const { count: pubNewsCount } = await db
  .from("news")
  .select("*", { count: "exact", head: true })
  .eq("status", "published")
  .eq("visibility", "public");
if (pubNewsCount !== 4) throw new Error(`expected 4 public published news, got ${pubNewsCount}`);
const { count: voteCount } = await db
  .from("poll_votes")
  .select("*", { count: "exact", head: true });
if (!voteCount || voteCount < 100) throw new Error(`expected ≥100 seeded votes, got ${voteCount}`);

// D1 self-check #1: "only members hold a membership; backing is a member
// privilege" — no registered-standing profile may hold an open membership.
// Reads profiles.status fresh from the DB (not the in-memory `kind` the
// filter above used) so this actually catches a regression in that filter.
const { data: registeredProfiles, error: registeredErr } = await db
  .from("profiles")
  .select("id")
  .eq("status", "registered");
if (registeredErr) throw new Error(`registered-profile read failed: ${registeredErr.message}`);
const registeredIds = (registeredProfiles ?? []).map((r) => r.id);
let registeredWithMembership = 0;
if (registeredIds.length > 0) {
  const { count, error: badMembErr } = await db
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .in("member_id", registeredIds)
    .is("ended_at", null);
  if (badMembErr) throw new Error(`D1 check query failed: ${badMembErr.message}`);
  registeredWithMembership = count ?? 0;
}
if (registeredWithMembership !== 0)
  throw new Error(
    `D1 VIOLATION: ${registeredWithMembership} registered-standing profile(s) hold an open membership`,
  );
console.log(
  `D1 check: 0/${registeredIds.length} registered-standing profiles hold a membership (OK)`,
);

// D1 self-check #2 (sanity — don't over-exclude): member-standing rows still
// get their membership. Every open membership in the table is either a seeded
// member-kind supporter (memberRows) or one of the 4 canonical admins — the
// wipe above clears every membership and only those two steps recreate any,
// so the total must match exactly.
const { count: openMemberships, error: openMembErr } = await db
  .from("memberships")
  .select("*", { count: "exact", head: true })
  .is("ended_at", null);
if (openMembErr) throw new Error(`open memberships count failed: ${openMembErr.message}`);
const expectedOpenMemberships = memberRows.length + 4;
if (openMemberships !== expectedOpenMemberships)
  throw new Error(
    `expected ${expectedOpenMemberships} open memberships (seeded member-kind rows + 4 admins), got ${openMemberships}`,
  );
console.log(`D1 sanity: ${openMemberships} open memberships match seeded member rows (OK)`);

console.log("SEED OK");
