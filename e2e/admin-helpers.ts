import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Canonical seeded admins (scripts/seed-staging.mjs) — permanent audit actors. */
export const ADMIN_PHONES = {
  super: "509000001",
  verifier: "509000002",
  finance: "509000003",
  editor: "509000004",
} as const;

const LOGIN_PHONE = process.env.E2E_TEST_PHONE ?? "550009999";
const BASE7 = LOGIN_PHONE.slice(0, 7);

/**
 * Phase-4 per-run users: 55-block, LAST digit pinned to 8 — the only slot
 * funnel-helpers never uses (journeys take 0–7, login takes 9), so these can
 * never equal a journey/login phone of ANY attempt of the same run. k sits in
 * the attempt position, which makes the phones attempt-independent — hence
 * cleanup in beforeAll AND afterAll.
 */
export function phase4Phone(k: number): string {
  return `${BASE7}${k}8`;
}
export function phase4PersonalId(k: number): string {
  return `9${BASE7.slice(1)}${k}800`; // 11 digits, reserved 9-prefix
}

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("admin e2e needs staging service credentials");
  return createClient(url, key);
}

/** /login flow (mirrors e2e/login.spec.ts); admins are completed members → cabinet. */
export async function loginAs(page: Page, phoneNational: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("ტელეფონის ნომერი").fill(phoneNational);
  await page.getByRole("button", { name: "კოდის მიღება" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await page.getByTestId("otp-0").fill(otp);
  await page.getByRole("button", { name: "დადასტურება" }).click();
  await expect(page).toHaveURL(/\/(me\/profile|delegate)$/, { timeout: 15_000 });
}

/** Both CabinetNav and AdminNav expose the same გასვლა control. */
export async function signOutViaNav(page: Page): Promise<void> {
  await page.getByRole("button", { name: "გასვლა" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

/** Exported: specs scope card interactions to `verify-card-<id>` testids with it. */
export async function profileIdByPhone(db: SupabaseClient, phoneNational: string): Promise<string> {
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .in("phone", [`+995${phoneNational}`, `995${phoneNational}`]);
  if (error || !data || data.length !== 1) {
    throw new Error(
      `profile lookup for ${phoneNational} failed: ${error?.message ?? data?.length}`,
    );
  }
  return data[0]!.id as string;
}

export async function getReferenceCode(phoneNational: string): Promise<string> {
  const db = serviceClient();
  const id = await profileIdByPhone(db, phoneNational);
  const { data, error } = await db.from("profiles").select("reference_code").eq("id", id).single();
  if (error || !data?.reference_code) throw new Error(`no reference code for ${phoneNational}`);
  return data.reference_code as string;
}

export async function getReferralCode(phoneNational: string): Promise<string> {
  const db = serviceClient();
  const id = await profileIdByPhone(db, phoneNational);
  const { data, error } = await db.from("delegates").select("referral_code").eq("id", id).single();
  if (error || !data?.referral_code) throw new Error(`no referral code for ${phoneNational}`);
  return data.referral_code as string;
}

export async function getAuditRows(action: string, targetId: string): Promise<number> {
  const db = serviceClient();
  const { count, error } = await db
    .from("audit_log")
    .select("*", { count: "exact", head: true })
    .eq("action", action)
    .eq("target_id", targetId);
  if (error) throw new Error(`audit read failed: ${error.message}`);
  return count ?? 0;
}

/** Deletes this run's phase-4 users (payments cascade; memberships detached first). */
export async function cleanupPhase4Users(ks: readonly number[]): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("phase-4 e2e cleanup skipped: staging service credentials not in env");
    return;
  }
  const db = createClient(url, key);
  const phones = ks.flatMap((k) => [`+995${phase4Phone(k)}`, `995${phase4Phone(k)}`]);
  const { data: rows } = await db.from("profiles").select("id").in("phone", phones);
  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return;
  const { error: detachErr } = await db.from("memberships").delete().in("delegate_id", ids);
  if (detachErr) console.warn(`phase-4 cleanup: membership detach failed: ${detachErr.message}`);
  for (const id of ids) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) console.warn(`phase-4 cleanup: deleteUser ${id} failed: ${error.message}`);
  }
}
