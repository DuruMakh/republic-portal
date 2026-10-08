import { expect, test } from "@playwright/test";
import { EVENTS_SHOWN } from "./events-switch";
import { FINANCES_PUBLIC } from "./finances-switch";

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
//   BOARD_LABEL             <- app/(public)/layout.tsx navItems ("/leaderboard"),
//                              same string as lib/mobile-nav.ts's BOARD_INDEX
//   BACK_LABEL              <- components/MobileBackHeader.tsx's BACK
//   NEWS_INDEX_LABEL        <- lib/mobile-nav.ts's NEWS_INDEX
const MENU = "მენიუ";
const MENU_NAV_LABEL = "მთავარი ნავიგაცია";
const BOARD_LABEL = "რეიტინგი";
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
  "/leaderboard",
  ...(FINANCES_PUBLIC ? ["/transparency"] : []),
  "/support",
];

test.describe("mobile chrome at 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

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
    await expect(page.getByRole("banner")).toHaveCSS("position", "static");
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
    // matches the (CSS-hidden) desktop nav link and the article's own
    // "← სიახლეები" byline, both containing the same substring.
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
      await expect(page.getByRole("link", { name: BOARD_LABEL }).first(), path).toBeVisible();
      await expect(page.getByRole("button", { name: MENU }), path).toBeHidden();
      await expect(page.locator("div.sticky.bottom-0"), path).toBeHidden();
      await expect(page.getByRole("banner").last(), path).toHaveCSS("position", "static");
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
      { index: "/leaderboard", href: "a[href^='/delegates/']", url: /\/delegates\/.+/ },
    ];

    for (const detail of details) {
      await page.goto(detail.index);
      const firstLink = page.locator(detail.href).first();
      await expect(firstLink).toBeVisible();
      await firstLink.click();
      await expect(page).toHaveURL(detail.url);
      await expect(page.getByRole("link", { name: BACK_LABEL, exact: true })).toBeHidden();
      await expect(page.getByRole("link", { name: BOARD_LABEL }).first()).toBeVisible();
      await expect(page.getByRole("banner")).toHaveCSS("position", "static");
    }
  });
});

test.describe("mobile tab labels", () => {
  // The narrowest supported width is the binding case: labels that fit at 320px fit wider.
  const width = 320;
  test(`${width}px labels fit their slots without ellipsis`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/styleguide-mobile-tabbar");
    const labels = page.locator("nav a > span:first-child");
    await expect(labels).toHaveCount(4);

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
  });
});
