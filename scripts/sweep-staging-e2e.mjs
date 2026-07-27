// Staging hygiene (Phase 3, spec §8): delete accumulated e2e users —
// 55-block phones / 9-prefixed personal IDs / login-journey auth orphans —
// keeping the canonical seed and the three owner smoke users. DRY RUN unless --apply.
//
// EXIT CODE is the baseline assertion, so this can gate rather than merely report:
//   dry run  → 1 if ANY accumulated e2e user is found (staging is not at baseline)
//   --apply  → 1 if any detach or deletion failed (the sweep did not land)
//   either   → 1 if the canonical seed counts have drifted
// The per-run throws in e2e/cleanup-helpers.ts only see the phones of the run that
// is executing; this sees everything, including what a cancelled job left behind.
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error(
    "needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)",
  );
}
const { protocol, hostname } = new URL(url);
if (protocol !== "https:" || hostname !== "orcxtbedkexoclbfgvzd.supabase.co") {
  throw new Error("refusing: this sweep is staging-only (project host mismatch)");
}
const db = createClient(url, key);

const KEEP_PHONES = new Set([
  "+995551234567",
  "+995551234568",
  "+995551234569",
  "995551234567",
  "995551234568",
  "995551234569",
]);

const doomed = new Map(); // id → reason

const { data: phoneRows, error: e1 } = await db
  .from("profiles")
  .select("id, phone, personal_id")
  .or("phone.like.+99555%,phone.like.99555%");
if (e1) throw e1;
for (const p of phoneRows ?? []) {
  if (p.phone && KEEP_PHONES.has(p.phone)) continue;
  doomed.set(p.id, `phone ${p.phone}`);
}

const { data: pidRows, error: e2 } = await db
  .from("profiles")
  .select("id, phone, personal_id")
  .like("personal_id", "9%");
if (e2) throw e2;
for (const p of pidRows ?? []) {
  if (p.phone && KEEP_PHONES.has(p.phone)) continue;
  doomed.set(p.id, `personal_id ${p.personal_id}`);
}

for (let page = 1; page <= 50; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) {
    if (!u.phone || !u.phone.startsWith("99555")) continue;
    if (KEEP_PHONES.has(u.phone) || KEEP_PHONES.has(`+${u.phone}`)) continue;
    if (!doomed.has(u.id)) doomed.set(u.id, `auth user ${u.phone} (no matched profile filter)`);
  }
  if (data.users.length < 1000) break;
}

console.log(`${APPLY ? "DELETING" : "DRY RUN"}: ${doomed.size} users`);
for (const [id, reason] of doomed) console.log(`  ${id} — ${reason}`);
const problems = [];
if (APPLY) {
  // memberships.delegate_id has no cascade (deliberate — see initial_schema.sql):
  // detach doomed delegates' memberships first, or deleteUser fails on FK when a
  // membership still points at them. memberships of doomed MEMBERS already cascade
  // via member_id; this only detaches rows pointing AT doomed delegates.
  const doomedIds = [...doomed.keys()];
  const { error: detachErr } = await db.from("memberships").delete().in("delegate_id", doomedIds);
  if (detachErr) problems.push(`membership detach failed: ${detachErr.message}`);
  // Carry the id AND the reason (which holds the phone or personal_id) into the
  // report: a bare count tells an operator that something survived but not what,
  // and "what" is the whole point of the sweep.
  for (const [id, reason] of doomed) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) problems.push(`deleteUser ${id} (${reason}) failed: ${error.message}`);
  }
}

const EXPECTED_SEED = { approved_delegates: 12, active_members: 1636 };

// Collected, not thrown: throwing here would abandon every detach and deletion
// failure gathered above, losing exactly the detail an operator needs.
const { data: stats, error: e3 } = await db.from("public_stats").select("*").single();
if (e3) {
  problems.push(`seed check failed: ${e3.message}`);
} else {
  console.log(
    `seed check: approved_delegates=${stats.approved_delegates} active_members=${stats.active_members} ` +
      `(expect ${EXPECTED_SEED.approved_delegates} / ${EXPECTED_SEED.active_members})`,
  );
  for (const [stat, want] of Object.entries(EXPECTED_SEED)) {
    // Number(): public_stats counts are bigint, which PostgREST may serialise as a
    // JSON string — a strict !== against a literal would then always "drift".
    if (Number(stats[stat]) !== want)
      problems.push(`seed drift: ${stat}=${stats[stat]}, expected ${want}`);
  }
}

if (!APPLY && doomed.size > 0) {
  // Printing this and exiting 0 is what let accumulation stay invisible: a dry run
  // that finds leftovers IS the failure signal, not just a report.
  problems.push(`${doomed.size} accumulated e2e user(s) on staging — re-run with --apply`);
}

if (problems.length > 0) {
  for (const p of problems) console.error(p);
  process.exitCode = 1;
}
