import { expect, test } from "@playwright/test";
import { ENGLISH_SHOWN } from "./english-switch";

test.skip(ENGLISH_SHOWN, "English is on — see english.spec.ts");

test("an English address lands on the same Georgian page, keeping the referral query", async ({
  page,
}) => {
  await page.goto("/en/about?ref=AB2C3D");
  await expect(page).toHaveURL(/localhost:3000\/about\?ref=AB2C3D$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ka");
  await expect(page.locator("main")).toBeVisible();
});

test("the English home address lands on the Georgian home page", async ({ page }) => {
  await page.goto("/en");
  await expect(page).toHaveURL(/localhost:3000\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ka");
});

test("no page offers a language switch while English is hidden", async ({ page }) => {
  for (const path of ["/", "/about", "/principles", "/login"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator('[hreflang="en"]')).toHaveCount(0);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "მენიუ" }).click();
  await expect(page.locator('[hreflang="en"]')).toHaveCount(0);
});
