import { expect, test } from "@playwright/test";

test("home renders in Georgian with a single register CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ქართული რესპუბლიკა" })).toBeVisible();
  // one-door registration: the hero CTA is „დარეგისტრირდი"; the old „გახდი დელეგატი" is gone
  await expect(
    page.getByRole("main").getByRole("link", { name: "რეგისტრაცია →", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("გახდი დელეგატი")).toHaveCount(0);
  // the header keeps its own CTA (app/(public)/layout.tsx); the ladder's third counter
  await expect(
    page.getByRole("banner").getByRole("link", { name: "შემოგვიერთდი", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("stat-registered-total")).toBeVisible();
});

test("join shows the three-field one-door registration form", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "შემოგვიერთდი ერთ წუთში" })).toBeVisible();
  // owner fix #10: the personal ID moved to the become-a-member wizard
  await expect(page.getByLabel("პირადი ნომერი")).toHaveCount(0);
});

test("styleguide renders design system", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.getByRole("button", { name: "ძირითადი" })).toBeVisible();
  // Pill's active_member default (lib/cabinet TEAM_STATUS_LABELS.active_member =
  // „აქტიური წევრი“, owner fix #16). Scoped to the "სტატუსები" demo card and
  // exact-matched: the styleguide also has an unrelated StatCard demo labeled the
  // very same „აქტიური წევრი“ outside any <section>, so an unscoped lookup
  // would prove nothing about which one actually rendered.
  const statusesCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "სტატუსები", exact: true }) });
  await expect(statusesCard.getByText("აქტიური წევრი", { exact: true })).toBeVisible();
});

test("member area redirects anonymous users to login", async ({ page }) => {
  await page.goto("/me/profile");
  await expect(page).toHaveURL(/\/login/);
});
