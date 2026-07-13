import { expect, test } from "@playwright/test";

test("home renders in Georgian", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ქართული რესპუბლიკა" })).toBeVisible();
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
