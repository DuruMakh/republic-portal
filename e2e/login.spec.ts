import { expect, test } from "@playwright/test";
import { cleanupLoginUser, loginAs, seedRegisteredMember } from "./funnel-helpers";

// staging-only; hook delivers OTP to dev_otp_inbox. CI derives a per-run 55-block
// phone (run number + attempt, final digit 9 = login journey) so concurrent runs
// and the canonical 50-block seed can never collide.
const TEST_PHONE = process.env.E2E_TEST_PHONE ?? "550009999";

// The registered-standing case seeds a profile on TEST_PHONE, so it must run AFTER
// the fresh-phone case (which asserts TEST_PHONE has no profile yet).
test.describe.configure({ mode: "serial" });
test.afterAll(cleanupLoginUser);

test("fresh phone OTP login lands on the one-door /join form", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ტელეფონის ნომერი").fill(TEST_PHONE);
  await page.getByRole("button", { name: "კოდის მიღება" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await page.getByTestId("otp-0").fill(otp);
  await page.getByRole("button", { name: "დადასტურება" }).click();
  // fresh phone with no profile → the one-door registration form (spec §4.1/§4.2)
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole("heading", { name: "შემოგვიერთდი ერთ წუთში" })).toBeVisible();
  await expect(page.getByLabel("პირადი ნომერი")).toBeVisible();
});

test("a registered-standing user logs in and lands on the registered cabinet", async ({ page }) => {
  await cleanupLoginUser(); // drop the profile-less auth user the first test left behind
  await seedRegisteredMember({
    phone: TEST_PHONE,
    firstName: "ნინო",
    lastName: "ტესტი",
    personalId: `9${TEST_PHONE}9`, // 11-digit, reserved 9-prefix, unique to this phone
  });

  // Regression (restores the lost funnel.spec V13): /api/dev/otp must WITHHOLD the code
  // for any existing account — now including a REGISTERED one (a real account carrying a
  // name, personal ID and cabinet). The endpoint is enabled in this env (the fresh-phone
  // test above renders the on-screen code), so this 404 is the account-takeover guard,
  // not the env gate.
  const withheld = await page.request.get(
    `/api/dev/otp?phone=${encodeURIComponent(`+995${TEST_PHONE}`)}`,
  );
  expect(withheld.status()).toBe(404);

  await loginAs(page, TEST_PHONE);
  // registered standing routes to /me (the overview), not the member /me/profile
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("heading", { name: "გამარჯობა, ნინო!" })).toBeVisible();
});
