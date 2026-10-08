import { expect, test } from "@playwright/test";
import { EVENTS_SHOWN } from "./events-switch";
import { FINANCES_PUBLIC } from "./finances-switch";

const PAGES = [
  "/",
  "/leaderboard",
  "/news",
  // ADR-042: /events is a 404 while events are hidden.
  ...(EVENTS_SHOWN ? ["/events"] : []),
  // ADR-034: /transparency is a 404 while finances are hidden, so it joins the sweep only
  // when the switch is on.
  ...(FINANCES_PUBLIC ? ["/transparency"] : []),
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
      const response = await page.goto(path);
      // an error page can be narrow too: the sweep only counts if the page itself rendered
      expect(response?.ok(), `${path} answered ${response?.status()}`).toBe(true);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, `${path} overflows horizontally`).toBeLessThanOrEqual(clientWidth);
    });
  }
});
