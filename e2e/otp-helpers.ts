import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** THE service-role client for e2e seeding + dev-OTP inbox reads (staging only). */
export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("e2e needs staging service credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Click `buttonName` and wait for EITHER `success` or the send-failed notice.
 * Supabase throttles per-phone OTP sends (~60s): on a throttled send, ride the
 * window out and retry, up to 3 attempts. Returns the `sentAt` timestamp of the
 * successful attempt (2s slack for test-machine vs DB clock skew) so callers can
 * reject stale inbox rows. Single home for the idiom previously copied across
 * loginAs (×2) and submitJoinAndReadInboxOtp.
 */
export async function clickThroughOtpThrottle(
  page: Page,
  buttonName: string,
  success: Locator,
): Promise<number> {
  const sendError = page.getByText("კოდის გაგზავნა ვერ მოხერხდა");
  for (let attempt = 0; attempt < 3; attempt++) {
    const sentAt = Date.now() - 2000;
    await page.getByRole("button", { name: buttonName }).click();
    await expect(success.or(sendError)).toBeVisible({ timeout: 15_000 });
    if (await success.isVisible()) return sentAt;
    if (attempt < 2) await page.waitForTimeout(62_000);
  }
  throw new Error("OTP send throttled for this phone after 3 attempts");
}

/** THE dev_otp_inbox poll: newest row for the phone, no older than sentAt. */
export async function readFreshInboxOtp(phoneNational: string, sentAt: number): Promise<string> {
  const db = serviceClient();
  const forms = [`+995${phoneNational}`, `995${phoneNational}`];
  for (let i = 0; i < 20; i++) {
    const { data } = await db
      .from("dev_otp_inbox")
      .select("otp, created_at")
      .in("phone", forms)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (row && new Date(row.created_at as string).getTime() >= sentAt) {
      return row.otp as string;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no fresh OTP in dev_otp_inbox for ${phoneNational}`);
}

/**
 * THE /login flow. Works for every standing: the /api/dev/otp UI element is
 * withheld for ANY existing profile (account-takeover guard, R1 hardening), so
 * the code is always read from dev_otp_inbox via the service client. The default
 * landing regex admits the registered cabinet (/me), member/delegate cabinets and
 * /admin; admin-helpers narrows it for completed accounts.
 */
export async function loginAs(
  page: Page,
  phoneNational: string,
  landing: RegExp = /\/(me|delegate|admin)(\/|\?|#|$)/,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("ტელეფონის ნომერი").fill(phoneNational);
  const otpGroup = page.getByRole("group", { name: "SMS კოდი" });
  const sentAt = await clickThroughOtpThrottle(page, "კოდის მიღება", otpGroup);
  const otp = await readFreshInboxOtp(phoneNational, sentAt);
  await page.getByTestId("otp-0").fill(otp); // OtpInput distributes the pasted digits
  await page.getByRole("button", { name: "დადასტურება" }).click();
  await expect(page).toHaveURL(landing, { timeout: 15_000 });
}
