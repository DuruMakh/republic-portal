import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/delegates",
  "/leaderboard",
  "/news",
  "/events",
  "/transparency",
  "/join",
  "/login",
  "/styleguide",
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
