/**
 * Grants an admin role to a REGISTERED, COMPLETED member — the bootstrap path
 * for the very first super_admin (spec §3.7); after that, use /admin/admins.
 *
 * Run: node --env-file=.env.local scripts/grant-admin.mjs \
 *        --phone +995509000001 --role super_admin --confirm-ref <project-ref>
 *
 * Writes the same audit action the RPC writes, with actor null + via marker —
 * bootstrap grants stay visible in the audit viewer.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const phone = arg("--phone");
const role = arg("--role");
const ROLES = ["super_admin", "verifier", "finance", "editor"];
if (!phone || !/^\+995\d{9}$/.test(phone) || !ROLES.includes(role)) {
  console.error(
    "Usage: node --env-file=.env.local scripts/grant-admin.mjs --phone +995XXXXXXXXX --role <super_admin|verifier|finance|editor> --confirm-ref <ref>",
  );
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
if (arg("--confirm-ref") !== ref) {
  console.error(`Refusing: pass --confirm-ref ${ref} to confirm the target project.`);
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: rows, error } = await db
  .from("profiles")
  .select("id, first_name, last_name, status, registration_completed_at")
  .in("phone", [phone, phone.slice(1)]);
if (error) throw error;
if (!rows || rows.length !== 1) {
  console.error(`Expected exactly one profile for ${phone}, found ${rows?.length ?? 0}.`);
  process.exit(1);
}
const p = rows[0];
if (p.registration_completed_at === null && p.status !== "active_member") {
  console.error("Refusing: admins must be completed members (spec §3.7).");
  process.exit(1);
}

const { error: grantErr } = await db
  .from("admin_roles")
  .upsert(
    { user_id: p.id, role, granted_by: null },
    { onConflict: "user_id,role", ignoreDuplicates: true },
  );
if (grantErr) throw grantErr;

const { error: auditErr } = await db.from("audit_log").insert({
  actor_id: null,
  action: "admin.grant_role",
  target_type: "admin_role",
  target_id: p.id,
  details: { name: `${p.first_name} ${p.last_name}`, role, via: "grant-admin.mjs" },
});
if (auditErr) throw auditErr;

console.log(`OK: ${p.first_name} ${p.last_name} (${phone}) ← ${role} on project ${ref}`);
