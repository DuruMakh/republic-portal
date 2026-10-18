import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

const PUBLIC_PATHS = [
  "",
  "/about",
  "/principles",
  "/structure",
  "/support",
  "/privacy",
  "/join/terms",
  "/news",
  "/login",
  "/join",
];

for (const path of PUBLIC_PATHS) {
  test(`English page ${path || "/"} renders without untranslated interface copy`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`/en${path}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("main")).toBeVisible();
    const untranslated = await page.locator("body").evaluate((body) => {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const found: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim() ?? "";
        const element = node.parentElement;
        if (!/[\u10a0-\u10ff\u1c90-\u1cbf]/u.test(text) || !element?.checkVisibility()) continue;
        if (element.closest('[lang="ka"], [aria-hidden="true"], script, style, nextjs-portal'))
          continue;
        // The language selector names Georgian in Georgian.
        if (element.closest('[hreflang="ka"]')) continue;
        found.push(text);
      }
      return [...new Set(found)];
    });
    expect(untranslated).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("switching language preserves the page, referral query and anchor", async ({ page }) => {
  await page.goto("/en/about?ref=AB2C3D#goal-title");
  await page.getByRole("link", { name: "ქართული", exact: true }).first().click();
  await expect(page).toHaveURL(/\/about\?ref=AB2C3D#goal-title$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ka");
  await page.getByRole("link", { name: "English", exact: true }).first().click();
  await expect(page).toHaveURL(/\/en\/about\?ref=AB2C3D#goal-title$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

for (const width of [360, 390, 768, 1280]) {
  test(`English layouts fit a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["", "/about", "/principles", "/structure", "/login"]) {
      await page.goto(`/en${path}`);
      const dimensions = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      expect(dimensions.page, `${path} at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
  });
}

test("English public navigation keeps the selected language", async ({ page }) => {
  await page.goto("/en");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "About us" })
    .click();
  await expect(page).toHaveURL(/\/en\/about$/);
});

test("English test member sign-in keeps the account and sign-out in English", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByRole("button", { name: "Member", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/me(?:\/|\?|$)/, { timeout: 20_000 });
  await page.goto("/en/me/profile");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("profile-pid")).toHaveValue("•••••••••••");
  await expect(page.locator('a[href="/en/me/profile"]').first()).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/en(?:\/|$)/, { timeout: 15_000 });
  await page.goto("/en/me/profile");
  await expect(page).toHaveURL(/\/en\/login(?:\?|$)/);
});

test("English delegates can open their team and keep English on mobile", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByRole("button", { name: "Delegate", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/delegate$/, { timeout: 20_000 });
  await page.getByRole("link", { name: /View your team/ }).click();
  await expect(page).toHaveURL(/\/en\/delegate\/team$/);
  await expect(page.getByRole("heading", { name: "My team", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 844 });
  await expect(page.getByRole("navigation", { name: "Account navigation" }).last()).toBeVisible();
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  expect(fits).toBe(true);
});

test("an English new visitor reaches the English registration form", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByRole("button", { name: "New visitor", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/join$/, { timeout: 20_000 });
  await expect(page.getByRole("textbox", { name: "First name", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Last name", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy Policy", exact: true })).toHaveAttribute(
    "href",
    "/en/privacy",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
