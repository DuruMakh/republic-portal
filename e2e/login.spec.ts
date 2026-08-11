import { expect, test } from "@playwright/test";
import { runCleanups } from "./cleanup-helpers";
import {
  cleanupGoogleBackedTestUsers,
  cleanupLoginUser,
  createGoogleBackedTestUser,
  seedRegisteredMember,
} from "./funnel-helpers";

// staging-only; hook delivers OTP to dev_otp_inbox. CI derives a per-run 55-block
// phone (run number + attempt, final digit 9 = login journey) so concurrent runs
// and the canonical 50-block seed can never collide.
const TEST_PHONE = process.env.E2E_TEST_PHONE ?? "550009999";

test.describe.configure({ mode: "serial" });

const cleanupLoginFixtures = () =>
  runCleanups([cleanupLoginUser, () => cleanupGoogleBackedTestUsers([TEST_PHONE])]);

test.beforeAll(cleanupLoginFixtures);
test.afterAll(cleanupLoginFixtures);

test("logged-out login offers only Google and no phone or OTP controls", async ({ page }) => {
  await page.goto("/login");
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Google-ით შესვლა" })).toBeVisible();
  await expect(main.getByRole("button")).toHaveCount(1);
  await expect(main.getByLabel("ტელეფონის ნომერი")).toHaveCount(0);
  await expect(main.getByRole("group", { name: "SMS კოდი" })).toHaveCount(0);
  await expect(main.getByTestId("otp-0")).toHaveCount(0);
});

test("a programmatically authenticated Google fixture reaches its registered cabinet", async ({
  page,
}) => {
  const user = await createGoogleBackedTestUser(page, TEST_PHONE);
  await seedRegisteredMember({
    userId: user.id,
    phone: TEST_PHONE,
    firstName: "ნინო",
    lastName: "ტესტი",
    personalId: `9${TEST_PHONE}9`, // 11-digit, reserved 9-prefix, unique to this phone
  });

  await page.goto("/me");
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("heading", { name: "გამარჯობა, ნინო!" })).toBeVisible();
  await expect(page.getByRole("link", { name: "პროფილი" })).toBeVisible();
});
