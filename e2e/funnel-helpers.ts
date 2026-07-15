import { createClient } from "@supabase/supabase-js";

// Per-run isolation (spec §7): E2E_TEST_PHONE is CI-derived in the 55XXXXXXX block
// (run number + attempt) and ends in 9 — the login journey's digit. Funnel journeys
// replace the final digit. Personal IDs use the reserved 9-prefix (seed uses 1-prefix).
const LOGIN_PHONE = process.env.E2E_TEST_PHONE ?? "550009999";
const BASE = LOGIN_PHONE.slice(0, 8);

export const JOURNEY = {
  member: 0,
  delegate: 1,
  duplicate: 2,
  resume: 3,
  referral: 4,
} as const;

export function journeyPhone(journey: number): string {
  return `${BASE}${journey}`; // 9 national digits, 55-prefixed
}

export function journeyPersonalId(journey: number): string {
  return `9${BASE.slice(1)}${journey}00`; // 11 digits, 9-prefixed
}

export async function cleanupJourneyUsers(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("e2e cleanup skipped: staging service credentials not in env");
    return;
  }
  const admin = createClient(url, key);
  const phones = Object.values(JOURNEY).flatMap((j) => [
    `+995${journeyPhone(j)}`,
    `995${journeyPhone(j)}`,
  ]);
  const { data: rows } = await admin.from("profiles").select("id").in("phone", phones);
  for (const row of rows ?? []) {
    await admin.auth.admin.deleteUser(row.id);
  }
}

export async function getSeededReferral(): Promise<{ code: string; fullName: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("referral journey needs staging service credentials");
  const admin = createClient(url, key);
  // PostgREST cannot embed delegates→profiles in one call here: delegates has TWO
  // FK paths to profiles (id→profiles.id AND verified_by→profiles.id), so
  // `.select("referral_code, profiles(...)")` is ambiguous (PGRST201) without an
  // explicit `!<fkey>` hint. Two queries instead of guessing the constraint name.
  const { data: delegate, error: delegateErr } = await admin
    .from("delegates")
    .select("id, referral_code")
    .eq("status", "approved")
    .limit(1)
    .single();
  if (delegateErr || !delegate)
    throw new Error(`no approved seeded delegate found: ${delegateErr?.message}`);
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", delegate.id)
    .single();
  if (profileErr || !profile) throw new Error(`delegate profile not found: ${profileErr?.message}`);
  return {
    code: delegate.referral_code as string,
    fullName: `${profile.first_name} ${profile.last_name}`,
  };
}
