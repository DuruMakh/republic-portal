import { expect, test } from "@playwright/test";

test("home renders in Georgian with a single register CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ქართული რესპუბლიკა" })).toBeVisible();
  // one-door registration: the hero CTA is „დარეგისტრირდი"; the old „გახდი დელეგატი" is gone
  await expect(page.getByRole("main").getByRole("link", { name: "დარეგისტრირდი" })).toBeVisible();
  await expect(page.getByText("გახდი დელეგატი")).toHaveCount(0);
  // the header keeps its own CTA (app/(public)/layout.tsx); the ladder's third counter
  await expect(page.getByRole("banner").getByRole("link", { name: "დარეგისტრირდი" })).toBeVisible();
  await expect(page.getByTestId("stat-registered-total")).toBeVisible();
});

test("join shows the four-field one-door registration form", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "შემოგვიერთდი ერთ წუთში" })).toBeVisible();
  await expect(page.getByLabel("პირადი ნომერი")).toBeVisible();
});

test("styleguide renders design system", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.getByRole("button", { name: "ძირითადი" })).toBeVisible();
  // Pill's active_member default (lib/cabinet TEAM_STATUS_LABELS.active_member = „აქტიური").
  // Scoped to the "სტატუსები" demo card and exact-matched: the styleguide also has an
  // unrelated StatCard demo labeled „აქტიური წევრი" (the retired Pill default), and
  // Playwright's default getByText is a case-insensitive SUBSTRING match — an unscoped,
  // non-exact „აქტიური წევრი" lookup would silently keep passing against that StatCard
  // even if Pill's own active_member default regressed back to the retired string.
  const statusesCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "სტატუსები", exact: true }) });
  await expect(statusesCard.getByText("აქტიური", { exact: true })).toBeVisible();
});

test("member area redirects anonymous users to login", async ({ page }) => {
  await page.goto("/me/profile");
  await expect(page).toHaveURL(/\/login/);
});
