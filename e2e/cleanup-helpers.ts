import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Remediation for leftover users — the sweep script is the standing tool. */
export const SWEEP_HINT =
  "Leftovers leak into every later run. Sweep with:\n" +
  "  node --env-file=.env.local scripts/sweep-staging-e2e.mjs --apply";

/**
 * Fails the run with every collected cleanup failure named.
 *
 * Throwing is the whole point: a console.warn here is invisible — the suite stays
 * green while staging accumulates rows nothing will ever delete, which is how the
 * payments append-only cascade defect (d0bda26) survived a full phase of CI.
 * Playwright attributes an afterAll throw to the LAST TEST in the file, so `label`
 * leads: without it the message reads as that unrelated test's own failure.
 */
export function failIfAny(label: string, failures: readonly string[], hint: string): void {
  if (failures.length === 0) return;
  throw new Error(
    `${label} did not return staging to baseline (${failures.length} failure(s)):\n` +
      failures.map((f) => `  - ${f}`).join("\n") +
      `\n${hint}`,
  );
}

/**
 * Runs EVERY step, then fails with all of them. Hooks used to `await` two cleanups
 * in a row, so the first throw skipped the second and stranded the very users it was
 * meant to delete — worse than the console.warn it replaced, because per-run phones
 * mean no later run ever targets them again. Teardown must not be order-fragile.
 */
export async function runCleanups(steps: readonly (() => Promise<void>)[]): Promise<void> {
  const errors: Error[] = [];
  for (const step of steps) {
    try {
      await step();
    } catch (e) {
      errors.push(e instanceof Error ? e : new Error(String(e)));
    }
  }
  const [first, ...rest] = errors;
  if (!first) return;
  if (rest.length === 0) throw first;
  throw new Error(
    `${errors.length} cleanup steps failed:\n\n${errors.map((e) => e.message).join("\n\n")}`,
  );
}

/**
 * The service client for cleanup, or null when staging credentials are absent.
 * Cleanup SKIPS in that case rather than failing: a run without staging env never
 * created anything to clean, and the journeys themselves fail loudly on the missing
 * credentials long before teardown.
 */
export function cleanupClient(label: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn(`${label} skipped: staging service credentials not in env`);
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Every e2e phone lives in the 55 block (spec §7), in `+995…` or `995…` form.
 * seedCompletedMember / seedRegisteredMember / approveOwnDelegate all refuse
 * anything else; this function DELETES, takes arbitrary strings, and is driven by
 * the unvalidated E2E_TEST_PHONE — so it needs the guard more than they do.
 */
const E2E_PHONE = /^\+?99555/;

/**
 * THE per-run user cleanup: resolve `phones` to profiles, detach the memberships
 * pointing AT them, delete the auth users, then fail loudly with everything that
 * went wrong. Shared by the phase-4 range (admin/community specs) and the journey
 * range (registration/membership specs) — identical mechanics, different phones.
 */
export async function cleanupUsersByPhone(label: string, phones: readonly string[]): Promise<void> {
  const strays = phones.filter((p) => !E2E_PHONE.test(p));
  if (strays.length > 0) {
    throw new Error(`${label} refusing phones outside the 55 e2e block: ${strays.join(", ")}`);
  }
  const db = cleanupClient(label);
  if (!db) return;
  // A dropped error here is the quietest leak of the three: no ids means the delete
  // loop below has nothing to fail on, so cleanup degrades to a silent no-op.
  const { data: rows, error: lookupErr } = await db
    .from("profiles")
    .select("id")
    .in("phone", [...phones]);
  failIfAny(
    label,
    lookupErr ? [`profile lookup failed — cleaned NOTHING: ${lookupErr.message}`] : [],
    SWEEP_HINT,
  );
  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return;
  // Collect rather than bail (as scripts/sweep-staging-e2e.mjs does) so one wedged
  // user still lets the rest go, and the throw below names EVERY leftover.
  const failures: string[] = [];
  // memberships.delegate_id has NO cascade (deliberate — see initial_schema.sql): a
  // row pointing at a doomed DELEGATE blocks deleteUser when iteration order takes
  // the delegate first. Detach first, scoped strictly to this run's own users.
  const { error: detachErr } = await db.from("memberships").delete().in("delegate_id", ids);
  if (detachErr) failures.push(`membership detach failed: ${detachErr.message}`);
  for (const id of ids) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) failures.push(`deleteUser ${id} failed: ${error.message}`);
  }
  failIfAny(label, failures, SWEEP_HINT);
}
