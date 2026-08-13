import { expect, test } from "@playwright/test";
import { runCleanups } from "./cleanup-helpers";
import {
  cleanupGoogleBackedTestUsers,
  cleanupJourneyUsers,
  getSeededReferral,
  JOURNEY,
  journeyPhone,
  passRegistration,
} from "./funnel-helpers";

test.describe.configure({ mode: "serial" });

const cleanupRegistrationUsers = () =>
  runCleanups([
    cleanupJourneyUsers,
    () =>
      cleanupGoogleBackedTestUsers([
        journeyPhone(JOURNEY.regHappy),
        journeyPhone(JOURNEY.regReferral),
      ]),
  ]);

test.beforeAll(cleanupRegistrationUsers);
test.afterAll(cleanupRegistrationUsers);

test("registers through Google and lands in the registered cabinet", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.regHappy);
  const firstName = "ნინო";
  await passRegistration(page, {
    phone,
    firstName,
    lastName: "ტესტი",
  });

  // registered overview greets them by name
  await expect(page.getByRole("heading", { name: `გამარჯობა, ${firstName}!` })).toBeVisible();

  // nav is exactly the registered set — no member-only pages
  const nav = page.getByRole("navigation", { name: "კაბინეტის ნავიგაცია" });
  for (const label of ["მთავარი", "ღონისძიებები", "სიახლეები", "პროფილი"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "გამოკითხვები" })).toHaveCount(0); // members-only

  // The same registered role must expose its four destinations plus utilities
  // through the real mobile cabinet chrome, not only the desktop CabinetNav.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.locator('a[href="/me"]')).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("button", { name: "მეტი" })).toBeVisible();
  await expect(page.locator("div.sticky.bottom-0")).toHaveCount(1);
  await page.setViewportSize({ width: 1280, height: 900 });

  // The in-progress wizard keeps the established desktop Masthead and hides
  // its mobile back header and bottom bar.
  await page.goto("/me/membership");
  await expect(page).toHaveURL(/\/me\/membership$/);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCSS("position", "static");
  await expect(page.locator("div.sticky.bottom-0")).toBeHidden();

  // members-only surface, reached directly, bounces back to the overview
  await page.goto("/me/billing");
  await expect(page).toHaveURL(/\/me$/);
});

test("a referral link is captured at registration and bound in the wizard", async ({ page }) => {
  const { code, fullName } = await getSeededReferral();
  const phone = journeyPhone(JOURNEY.regReferral);
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "რეფერალს",
    refCode: code,
  });

  // the become-a-member wizard shows the bound delegate — a read-only card, not the
  // picker (capture-at-registration, spec D1)
  await page.goto("/me/membership");
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText(/რეფერალური ბმულით/)).toBeVisible();
  await expect(page.getByLabel("დელეგატი")).toHaveCount(0);
});
