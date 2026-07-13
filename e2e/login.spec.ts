import { expect, test } from "@playwright/test";

const TEST_PHONE = "599123123"; // staging-only; hook delivers OTP to dev_otp_inbox

test("phone OTP login end-to-end (dev delivery)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ტელეფონის ნომერი").fill(TEST_PHONE);
  await page.getByRole("button", { name: "კოდის მიღება" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await page.getByLabel("SMS კოდი").fill(otp);
  await page.getByRole("button", { name: "დადასტურება" }).click();
  await expect(page).toHaveURL(/\/me\/profile/);
  await expect(page.getByTestId("profile-phone")).toContainText("995599123123");
});
