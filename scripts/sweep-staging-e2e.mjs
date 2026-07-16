// One-time staging hygiene (Phase 3, spec §8): delete accumulated e2e users —
// 55-block phones / 9-prefixed personal IDs / login-journey auth orphans —
// keeping the canonical seed and the three owner smoke users. DRY RUN unless --apply.
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
let failedDeletions = 0;
if (APPLY) {
  // memberships.delegate_id has no cascade (deliberate — see initial_schema.sql):
  // detach doomed delegates' memberships first, or deleteUser fails on FK when a
  // membership still points at them. memberships of doomed MEMBERS already cascade
  // via member_id; this only detaches rows pointing AT doomed delegates.
  const doomedIds = [...doomed.keys()];
  const { error: detachErr } = await db.from("memberships").delete().in("delegate_id", doomedIds);
  if (detachErr) console.error(`membership detach failed: ${detachErr.message}`);
  for (const [id] of doomed) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) {
      failedDeletions++;
      console.error(`  FAILED ${id}: ${error.message}`);
    }
  }
}

const { data: stats, error: e3 } = await db.from("public_stats").select("*").single();
if (e3) throw e3;
console.log(
  `seed check: approved_delegates=${stats.approved_delegates} active_members=${stats.active_members} (expect 12 / 1636)`,
);
if (failedDeletions > 0) {
  console.error(`${failedDeletions} deletion(s) failed`);
  process.exitCode = 1;
}
