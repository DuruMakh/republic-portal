import { expect, test } from "@playwright/test";

// staging-only; hook delivers OTP to dev_otp_inbox. CI derives a per-run 55-block
// phone (run number + attempt, final digit 9 = login journey) so concurrent runs
// and the canonical 50-block seed can never collide.
const TEST_PHONE = process.env.E2E_TEST_PHONE ?? "550009999";

test("phone OTP login end-to-end (dev delivery)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ტელეფონის ნომერი").fill(TEST_PHONE);
  await page.getByRole("button", { name: "კოდის მიღება" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await page.getByTestId("otp-0").fill(otp);
  await page.getByRole("button", { name: "დადასტურება" }).click();
  // fresh phone with no profile row → funnel entry (spec §3.8)
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole("heading", { name: "როგორ გსურს შემოგვიერთდე?" })).toBeVisible();
});
