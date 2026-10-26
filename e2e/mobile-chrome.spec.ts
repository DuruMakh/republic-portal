import { expect, test } from "@playwright/test";
import { EVENTS_SHOWN } from "./events-switch";
import { FINANCES_PUBLIC } from "./finances-switch";
import { ENGLISH_SHOWN } from "./english-switch";
import { RATINGS_SHOWN } from "./ratings-switch";
import { STRUCTURE_NAV_LABEL } from "../lib/structure-copy";

// Task 10 regression guard for the chrome Tasks 3-9 shipped (public masthead
// menu, sticky join CTA, back headers, StickyBar's single-bar-per-route
// invariant, viewport-fit=cover). The menu dialog's focus trap and Escape, and the
// join-CTA route list, are unit-tested (MobileMenu, MobileJoinCta, lib/mobile-nav).
// Signed-in phone chrome is checked at layout level inside sessions that already exist:
// cabinet.spec (one tab bar, pinned header, the More sheet opens as a dialog) and
// community-events.spec (the delegate cabinet's one tab bar and its current tab); the
// tab bar's and More sheet's own behaviour are unit tests (MobileTabBar, MobileMoreSheet).
//
// Every Georgian literal below is copied byte-for-byte from shipped source,
// never hand-typed (DESIGN.md's Georgian integrity gate):
//   MENU / MENU_NAV_LABEL   <- components/MobileMenu.tsx (MENU, MENU_NAV_LABEL)
//   BACK_LABEL              <- components/MobileBackHeader.tsx's BACK
//   NEWS_INDEX_LABEL        <- lib/mobile-nav.ts's NEWS_INDEX
const MENU = "მენიუ";
const MENU_NAV_LABEL = "მთავარი ნავიგაცია";
const BACK_LABEL = "← უკან";
const NEWS_INDEX_LABEL = "სიახლეები";

// Public routes with plain "public" mobile chrome (join CTA bar, menu button --
// no back header, not in a cabinet), swept below for the single-bar
// invariant. /support is included even though the brief's spec code did not
// list it: it is the newest public route, and the exact bug class Task 9's
// own controller review caught (a route accidentally mounting two
// StickyBars) would otherwise ship on it unnoticed by any other test.
//
// ADR-034: /transparency is a 404 (no public chrome at all) while finances are hidden, so it
// joins this sweep only when the switch is on.
const PUBLIC_CHROME_ROUTES = [
  "/",
  "/news",
  // ADR-042: /events is a 404 too while events are hidden.
  ...(EVENTS_SHOWN ? ["/events"] : []),
  // ADR-052: /leaderboard is a 404 too while ratings are hidden.
  ...(RATINGS_SHOWN ? ["/leaderboard"] : []),
  ...(FINANCES_PUBLIC ? ["/transparency"] : []),
  "/support",
];

test.describe("mobile chrome at 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("browser Back and Forward close the Unity menu and release scrolling", async ({ page }) => {
    await page.goto("/news");
    await page.locator("a[href^='/news/']").first().click();
    await expect(page).toHaveURL(/\/news\/.+/, { timeout: 15_000 });
    const articleUrl = page.url();
    await page.getByRole("link", { name: BACK_LABEL, exact: true }).click();
    await expect(page).toHaveURL(/\/news$/, { timeout: 15_000 });
    await page.getByRole("button", { name: MENU }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: "output/playwright/audit-minimal-repairs/task-3-mobile-menu-open.png",
      style: "nextjs-portal { visibility: hidden; }",
    });
    await page.goBack();
    await expect(page).toHaveURL(articleUrl);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: MENU, includeHidden: true })).toBeHidden();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    // The hidden desktop header must no longer capture Tab on an article.
    await page.getByRole("link", { name: BACK_LABEL, exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    expect(
      await page.locator(":focus").evaluate((element) => element.closest('[role="dialog"]')),
    ).toBeNull();
    await page.keyboard.press("PageDown");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
    await page.screenshot({
      path: "output/playwright/audit-minimal-repairs/task-3-mobile-history-closed.png",
      style: "nextjs-portal { visibility: hidden; }",
    });
    await page.goForward();
    await expect(page).toHaveURL(/\/news$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: MENU }).press("Enter");
    await expect(page.getByRole("button", { name: "დახურვა" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: MENU })).toBeFocused();
  });

  // The menu's own behaviour (open, Escape, focus trap) is MobileMenu's unit test.
  test("the public masthead shows the menu button, not the inline nav, and stays pinned while the document scrolls", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: MENU })).toBeVisible();
    // The desktop <nav> and the (closed) menu's internal <nav> share the same
    // aria-label by design (components/MobileMenu.tsx) -- .first() picks the
    // one that exists before the dialog opens.
    await expect(page.getByRole("navigation", { name: MENU_NAV_LABEL }).first()).toBeHidden();
    // the viewport meta opts into the safe area (app/layout.tsx viewportFit: no unit test
    // covers it, and without it every safe-area inset silently evaluates to 0)
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("viewport-fit=cover");
    const header = page.getByRole("banner");
    await expect(header).toHaveCSS("position", "sticky");
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  });

  test("the unchanged styleguide masthead does not become sticky", async ({ page }) => {
    await page.goto("/styleguide");
    await expect(page.getByRole("banner")).not.toHaveCSS("position", "sticky");
  });

  test("a detail route gets the back header pointing at its index", async ({ page }) => {
    await page.goto("/news");
    const firstArticle = page.locator("a[href^='/news/']").first();
    await expect(firstArticle).toBeVisible();
    await firstArticle.click();
    await expect(page).toHaveURL(/\/news\/.+/);
    const back = page.getByRole("link", { name: BACK_LABEL });
    await expect(back).toBeVisible();
    // The label on the right names the section the article belongs to --
    // confirms mobileBackTarget() picked the /news rule, not a different one.
    // Scoped to the visible banner landmark: a page-wide getByText also
    // matches the article's own "← სიახლეები" byline, which contains the
    // same substring. (The header has no news link since ADR-038.)
    await expect(
      page.getByRole("banner").getByText(NEWS_INDEX_LABEL, { exact: true }),
    ).toBeVisible();
    const header = page.getByRole("banner");
    await expect(header).toHaveCSS("position", "sticky");
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
    await back.click();
    await expect(page).toHaveURL(/\/news$/);
  });

  test("exactly one bottom bar renders per route", async ({ page }) => {
    for (const path of PUBLIC_CHROME_ROUTES) {
      await page.goto(path);
      const bars = page.locator("div.sticky.bottom-0");
      await expect(bars, path).toHaveCount(1);
    }
  });

  test("the bottom bar never covers the end of the page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = page.getByText("© 2026", { exact: false });
    await expect(footer).toBeInViewport();
  });
});

test.describe("desktop chrome is unchanged at 1280px", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the inline nav is visible and no mobile chrome renders across public states", async ({
    page,
  }) => {
    for (const path of [...PUBLIC_CHROME_ROUTES, "/join", "/join/terms", "/login"]) {
      await page.goto(path);
      await expect(
        page.getByRole("link", { name: STRUCTURE_NAV_LABEL }).first(),
        path,
      ).toBeVisible();
      await expect(page.getByRole("button", { name: MENU }), path).toBeHidden();
      await expect(page.locator("div.sticky.bottom-0"), path).toBeHidden();
      // The „ერთობა“ masthead is position: relative (it layers over its hero), never pinned.
      await expect(page.getByRole("banner").last(), path).not.toHaveCSS("position", "sticky");
    }
  });

  test("all detail types keep the desktop masthead and hide the mobile back header", async ({
    page,
  }) => {
    const details = [
      { index: "/news", href: "a[href^='/news/']", url: /\/news\/.+/ },
      ...(EVENTS_SHOWN
        ? [{ index: "/events", href: "a[href^='/events/']", url: /\/events\/.+/ }]
        : []),
      ...(RATINGS_SHOWN
        ? [{ index: "/leaderboard", href: "a[href^='/delegates/']", url: /\/delegates\/.+/ }]
        : []),
    ];

    for (const detail of details) {
      await page.goto(detail.index);
      const firstLink = page.locator(detail.href).first();
      await expect(firstLink).toBeVisible();
      await firstLink.click();
      await expect(page).toHaveURL(detail.url);
      await expect(page.getByRole("link", { name: BACK_LABEL, exact: true })).toBeHidden();
      await expect(page.getByRole("link", { name: STRUCTURE_NAV_LABEL }).first()).toBeVisible();
      await expect(page.getByRole("banner")).not.toHaveCSS("position", "sticky");
    }
  });
});

test.describe("mobile tab labels", () => {
  // The narrowest supported width is the binding case: labels that fit at 320px fit wider.
  const width = 320;
  for (const prefix of ENGLISH_SHOWN ? ["", "/en"] : [""]) {
    test(`${width}px ${prefix || "Georgian"} labels fit their slots without ellipsis`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${prefix}/styleguide-mobile-tabbar`);
      const labels = page.locator("nav a > span:first-child");
      await expect(labels).toHaveCount(4);
      await page.evaluate(() => document.fonts.ready);

      const behavior = await labels.evaluateAll((elements) =>
        elements.map((element) => {
          const label = element.getBoundingClientRect();
          const slot = element.parentElement?.getBoundingClientRect();
          return {
            text: element.textContent,
            textOverflow: getComputedStyle(element).textOverflow,
            labelLeft: label.left,
            labelRight: label.right,
            slotLeft: slot?.left,
            slotRight: slot?.right,
            fits: slot ? label.left >= slot.left - 0.5 && label.right <= slot.right + 0.5 : false,
          };
        }),
      );

      for (const label of behavior) {
        expect(label.textOverflow).not.toBe("ellipsis");
        expect(label.fits, JSON.stringify(label)).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });
  }
});
