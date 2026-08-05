import { expect, test, type Page } from "@playwright/test";

// Task 10 regression guard for the chrome Tasks 3-9 shipped (public masthead
// menu, sticky join CTA, back headers, StickyBar's single-bar-per-route
// invariant, viewport-fit=cover). Authenticated cabinet chrome is covered in
// the existing isolated registration, cabinet, and delegate-panel journeys,
// which already own their staging identities.
//
// Every Georgian literal below is copied byte-for-byte from shipped source,
// never hand-typed (DESIGN.md's Georgian integrity gate):
//   MENU / MENU_NAV_LABEL   <- components/MobileMenu.tsx (MENU, MENU_NAV_LABEL)
//   BOARD_LABEL             <- app/(public)/layout.tsx navItems ("/leaderboard"),
//                              same string as lib/mobile-nav.ts's BOARD_INDEX
//   JOIN_CTA_LABEL          <- app/(public)/layout.tsx HEADER_CTA_LABEL,
//                              same string as components/MobileJoinCta.tsx's JOIN
//   BACK_LABEL              <- components/MobileBackHeader.tsx's BACK
//   NEWS_INDEX_LABEL        <- lib/mobile-nav.ts's NEWS_INDEX
const MENU = "მენიუ";
const MENU_NAV_LABEL = "მთავარი ნავიგაცია";
const BOARD_LABEL = "რეიტინგი";
const JOIN_CTA_LABEL = "შემოგვიერთდი";
const BACK_LABEL = "← უკან";
const NEWS_INDEX_LABEL = "სიახლეები";

// Public routes with plain "public" mobile chrome (join CTA bar, menu button --
// no back header, not in a cabinet), swept below for the single-bar
// invariant. /support is included even though the brief's spec code did not
// list it: it is the newest public route, and the exact bug class Task 9's
// own controller review caught (a route accidentally mounting two
// StickyBars) would otherwise ship on it unnoticed by any other test.
const PUBLIC_CHROME_ROUTES = ["/", "/news", "/events", "/leaderboard", "/transparency", "/support"];

// The menu trigger is a plain <button onClick> with no href fallback, so
// clicking it only works once React has attached the handler. A goto() that
// resolves before hydration finishes would otherwise make this click land on
// dead markup and silently no-op (brief: "a click issued immediately after
// page.goto can land before hydration"). Retrying the click until the dialog
// actually appears converges as soon as hydration completes instead of
// guessing a fixed delay.
async function openMobileMenu(page: Page) {
  const trigger = page.getByRole("button", { name: MENU });
  await expect(trigger).toBeVisible();
  await expect(async () => {
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

test.describe("mobile chrome at 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("public routes get the menu button, not the inline nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: MENU })).toBeVisible();
    // The desktop <nav> and the (closed) menu's internal <nav> share the same
    // aria-label by design (components/MobileMenu.tsx) -- .first() picks the
    // one that exists before the dialog opens.
    await expect(page.getByRole("navigation", { name: MENU_NAV_LABEL }).first()).toBeHidden();
  });

  test("the menu opens, lists destinations, and closes on Escape", async ({ page }) => {
    await page.goto("/");
    await openMobileMenu(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: BOARD_LABEL })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the menu traps keyboard focus and restores it to the trigger", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: MENU });
    await openMobileMenu(page);
    const dialog = page.getByRole("dialog");
    const focusable = dialog.locator("a[href], button:not([disabled])");
    const first = focusable.first();
    const last = focusable.last();

    await last.focus();
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the public masthead remains pinned while the document scrolls", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header).toHaveCSS("position", "sticky");
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  });

  test("the join CTA is present on public routes and absent on the join flow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: JOIN_CTA_LABEL })).toBeVisible();
    await page.goto("/join");
    await expect(page.getByRole("link", { name: JOIN_CTA_LABEL })).toHaveCount(0);
    // The link being gone should mean the bar itself is gone, not just its
    // content -- /join gets a back header instead (spec's declared-parent
    // rule), and a bar with nothing visible in it would still occlude space.
    await expect(page.locator("div.sticky.bottom-0")).toHaveCount(0);
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

  test("the viewport meta opts into the safe area", async ({ page }) => {
    await page.goto("/");
    const content = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(content).toContain("viewport-fit=cover");
  });
});

test.describe("desktop chrome is unchanged at 1280px", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the inline nav is visible and no mobile chrome renders across public states", async ({
    page,
  }) => {
    for (const path of [...PUBLIC_CHROME_ROUTES, "/join", "/login"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: BOARD_LABEL }).first(), path).toBeVisible();
      await expect(page.getByRole("button", { name: MENU }), path).toBeHidden();
      await expect(page.locator("div.sticky.bottom-0"), path).toBeHidden();
      await expect(page.getByRole("banner").last(), path).toHaveCSS("position", "static");
    }
  });

  test("a detail route keeps the desktop masthead and hides the mobile back header", async ({
    page,
  }) => {
    await page.goto("/news");
    const firstArticle = page.locator("a[href^='/news/']").first();
    await expect(firstArticle).toBeVisible();
    await firstArticle.click();
    await expect(page).toHaveURL(/\/news\/.+/);
    await expect(page.getByRole("link", { name: BACK_LABEL })).toBeHidden();
    await expect(page.getByRole("link", { name: BOARD_LABEL }).first()).toBeVisible();
  });
});

test.describe("mobile tab labels", () => {
  for (const width of [320, 360, 390]) {
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
  }
});
