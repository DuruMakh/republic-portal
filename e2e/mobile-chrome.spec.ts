import { expect, test, type Page } from "@playwright/test";

// Task 10 regression guard for the chrome Tasks 3-9 shipped (public masthead
// menu, sticky join CTA, back headers, StickyBar's single-bar-per-route
// invariant, viewport-fit=cover). Cabinet chrome (tab bar / overflow sheet)
// is deliberately NOT covered here -- see .superpowers/sdd/mobile-task-10-brief.md's
// scope note: reaching a cabinet needs SMS-OTP against shared staging state
// that e2e/cabinet.spec.ts owns, and the per-role tab logic already has
// exhaustive unit coverage in lib/mobile-nav.test.ts.
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
const PUBLIC_CHROME_ROUTES = ["/", "/news", "/leaderboard", "/transparency", "/support"];

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

  test("the inline nav is visible and no mobile chrome renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: BOARD_LABEL }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: MENU })).toBeHidden();
    await expect(page.locator("div.sticky.bottom-0")).toBeHidden();
  });
});
