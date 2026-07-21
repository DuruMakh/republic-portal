import { expect, test } from "@playwright/test";

test("home renders in Georgian with a single register CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ქართული რესპუბლიკა" })).toBeVisible();
  // one-door registration: the hero CTA is „დარეგისტრირდი"; the old „გახდი დელეგატი" is gone
  await expect(page.getByRole("main").getByRole("link", { name: "დარეგისტრირდი" })).toBeVisible();
  await expect(page.getByText("გახდი დელეგატი")).toHaveCount(0);
});

test("join shows the four-field one-door registration form", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "შემოგვიერთდი ერთ წუთში" })).toBeVisible();
  await expect(page.getByLabel("პირადი ნომერი")).toBeVisible();
});

test("styleguide renders design system", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.getByRole("button", { name: "ძირითადი" })).toBeVisible();
  await expect(page.getByText("აქტიური წევრი").first()).toBeVisible();
});

test("member area redirects anonymous users to login", async ({ page }) => {
  await page.goto("/me/profile");
  await expect(page).toHaveURL(/\/login/);
});
