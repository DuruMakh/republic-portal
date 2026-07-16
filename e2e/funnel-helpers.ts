import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
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
  cabinet: 5,
  panelDelegate: 6,
  viaLink: 7,
} as const;

export function journeyPhone(journey: number): string {
  return `${BASE}${journey}`; // 9 national digits, 55-prefixed
}

export function journeyPersonalId(journey: number): string {
  return `9${BASE.slice(1)}${journey}00`; // 11 digits, 9-prefixed
}

export async function passStep1(
  page: Page,
  opts: { phone: string; firstName: string; lastName: string },
): Promise<void> {
  await page.getByLabel("სახელი").fill(opts.firstName);
  await page.getByLabel("გვარი").fill(opts.lastName);
  await page.getByLabel("ტელეფონის ნომერი").fill(opts.phone);
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await page.getByTestId("otp-0").fill(otp); // OtpInput distributes pasted digits
  await page.getByRole("button", { name: "დადასტურება" }).click();
}

export async function fillStep2Basics(
  page: Page,
  opts: { personalId: string; regionLabel: string },
): Promise<void> {
  await page.getByLabel("პირადი ნომერი").fill(opts.personalId);
  await page.getByLabel("დაბადების თარიღი").fill("1990-05-20");
  await page.getByLabel("მხარე").selectOption({ label: opts.regionLabel });
  await page.getByLabel("ქალაქი / მუნიციპალიტეტი").selectOption({ index: 1 });
  await page.getByLabel("სამუშაო ადგილი / სტატუსი").selectOption({ label: "სტუდენტი" });
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
  const ids = (rows ?? []).map((r) => r.id);
  if (ids.length === 0) return;
  // memberships.delegate_id has NO cascade: a row pointing at a journey DELEGATE
  // blocks deleteUser when iteration order deletes the delegate first. Detach
  // first — scoped strictly to this run's own users.
  const { error: detachErr } = await admin.from("memberships").delete().in("delegate_id", ids);
  if (detachErr) console.warn(`e2e cleanup: membership detach failed: ${detachErr.message}`);
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.warn(`e2e cleanup: deleteUser ${id} failed: ${error.message}`);
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
    .order("id")
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

export async function approveOwnDelegate(phoneNational: string): Promise<void> {
  if (!phoneNational.startsWith("55")) {
    throw new Error(`refusing to approve non-e2e phone ${phoneNational}`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("approveOwnDelegate needs staging service credentials");
  const admin = createClient(url, key);
  const { data: rows, error: pErr } = await admin
    .from("profiles")
    .select("id")
    .in("phone", [`+995${phoneNational}`, `995${phoneNational}`]);
  if (pErr || !rows || rows.length !== 1) {
    throw new Error(`delegate profile lookup failed: ${pErr?.message ?? `rows=${rows?.length}`}`);
  }
  const { error } = await admin
    .from("delegates")
    .update({
      status: "approved",
      verified_at: new Date().toISOString(),
      slug: `e2e-delegate-${phoneNational}`,
    })
    .eq("id", rows[0]!.id);
  if (error) throw new Error(`approve failed: ${error.message}`);
}

export async function cleanupLoginUser(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("login cleanup skipped: staging service credentials not in env");
    return;
  }
  const admin = createClient(url, key);
  const loginPhone = `995${LOGIN_PHONE}`; // auth stores phones without '+'
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || data.users.length === 0) return;
    const orphan = data.users.find((u) => u.phone === loginPhone);
    if (orphan) {
      const { error: delErr } = await admin.auth.admin.deleteUser(orphan.id);
      if (delErr) console.warn(`login cleanup: deleteUser ${orphan.id} failed: ${delErr.message}`);
      return;
    }
    if (data.users.length < 1000) return;
  }
}
