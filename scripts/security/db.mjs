/**
 * The single place that reads staging credentials and builds Supabase
 * clients for the security-audit scripts. Split out of actors.mjs so that
 * actors.mjs and otp.mjs can each depend on `db` without depending on each
 * other: otp.mjs needs `db` for the dev_otp_inbox poll, actors.mjs needs
 * `db` for fixture provisioning AND needs otp.mjs for the OTP poll. Without
 * this split those two formed a real (if currently harmless) circular
 * import — this module is the acyclic fix: db.mjs has no local imports,
 * otp.mjs depends only on db.mjs, actors.mjs depends on both.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error("security probing needs NEXT_PUBLIC_SUPABASE_URL, ANON_KEY and SERVICE_ROLE_KEY");
}

export { url, anonKey };

/**
 * Service-role client: fixture provisioning, dev_otp_inbox reads, and
 * ground-truth reads for --verify ONLY. Never used as a probe actor — it
 * bypasses every check by design and would report every surface as
 * reachable, producing a false all-clear for the whole audit.
 */
export const db = createClient(url, serviceKey, { auth: { persistSession: false } });
export const anonClient = () => createClient(url, anonKey, { auth: { persistSession: false } });
