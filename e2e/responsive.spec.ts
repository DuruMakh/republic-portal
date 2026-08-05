import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/leaderboard",
  "/news",
  "/events",
  "/transparency",
  "/join",
  "/login",
  "/styleguide",
  // Task 10: the mobile chrome (sticky bars, back headers) is new horizontal
  // content on every page, and /support is the newest public route -- cheapest
  // place to catch it overflowing before it ships anywhere else.
  "/support",
];

test.describe("360px viewport has no horizontal overflow", () => {
  test.use({ viewport: { width: 360, height: 780 } });
  for (const path of PAGES) {
    test(`no overflow at ${path}`, async ({ page }) => {
      await page.goto(path);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, `${path} overflows horizontally`).toBeLessThanOrEqual(clientWidth);
    });
  }
});
