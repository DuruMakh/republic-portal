// This suite asserts the CANONICAL STAGING SEED (12 approved delegates, leaderboard
// order, pending names absent) is present. Staging is shared with real users — the
// owner is now an approved delegate too, so roster/leaderboard counts are floors (>=)
// anchored on seeded names/ranks, not exact totals. CI never seeds — if these fail on
// a missing seeded name/rank or a count below 12, staging drifted; see scripts/seed-staging.mjs.
import { expect, test, type Page } from "@playwright/test";
import { EVENTS_SHOWN } from "./events-switch";
import { FINANCES_PUBLIC } from "./finances-switch";
import { serviceClient } from "./otp-helpers";

const DEMO_BANNER = "სადემონსტრაციო გარემო — მონაცემები ფიქტიურია";
const NOT_FOUND_HEADING = "გვერდი ვერ მოიძებნა.";
const NOT_FOUND_HOME = "დაბრუნდი მთავარ გვერდზე";
const NOT_FOUND_TITLE = "გვერდი ვერ მოიძებნა — ქართული რესპუბლიკა";

/**
 * A page hidden by a switch (ADR-034, ADR-038) must be indistinguishable from a mistyped address:
 * 404, the Georgian notice, and the exact not-found title both in the served HTML (what a link
 * preview or a browser without scripts sees) and in the tab once the page has loaded (ADR-040).
 */
async function expectHiddenPage(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(404);
  expect(await response?.text(), path).toContain(`<title>${NOT_FOUND_TITLE}</title>`);
  await expect(page.getByRole("heading", { level: 1, name: NOT_FOUND_HEADING })).toBeVisible();
  await expect(page).toHaveTitle(NOT_FOUND_TITLE);
}

test.describe("home", () => {
  test("hero, live counters and nav work", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "ერთად შევქმნათ ქართული რესპუბლიკა" }),
    ).toBeVisible();
    await expect(page.getByText(DEMO_BANNER)).toBeVisible();
    await expect(page.getByRole("main").locator('a[href="/news"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "სიახლეები" })).toBeVisible();
    // ADR-038: the events section is there only while SHOW_EVENTS=true.
    await expect(page.getByRole("main").locator('a[href="/events"]')).toHaveCount(
      EVENTS_SHOWN ? 1 : 0,
    );
    await expect(page.getByRole("heading", { name: "ღონისძიებები" })).toHaveCount(
      EVENTS_SHOWN ? 1 : 0,
    );
    let members = 0;
    for (const id of ["stat-approved-delegates", "stat-members-total"]) {
      // playwright.config.ts sets use.contextOptions.reducedMotion: "reduce", so
      // CountUp's (components/CountUp.tsx) animation effect short-circuits on its
      // matchMedia check and the SSR-rendered, already-settled value is what's
      // on screen immediately — a direct read is deterministic, no polling needed.
      const text = await page.getByTestId(id).innerText();
      const n = Number(text.replace(/[^\d]/g, ""));
      expect(n).toBeGreaterThan(0);
      if (id === "stat-members-total") members = n;
    }

    // registered_total is cumulative — every profile, ever (D5/R2-5) — and the home
    // page is ISR-cached (revalidate 60, app/(public)/page.tsx): a render predating
    // another spec's own seed/cleanup churn can lag a stale snapshot by up to one
    // window, so settle-poll the UI against a FRESH DB truth on every attempt (a
    // count captured once could itself go stale mid-loop).
    const db = serviceClient();
    await expect(async () => {
      const { count: registeredTotal, error } = await db
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (error) throw new Error(`profiles head-count failed: ${error.message}`);
      await page.goto("/");
      const text = await page.getByTestId("stat-registered-total").innerText();
      expect(Number(text.replace(/[^\d]/g, ""))).toBe(registeredTotal);
      // registered is the whole register; members are a subset of it (D5/R2-5, ADR-037)
      expect(registeredTotal ?? 0).toBeGreaterThanOrEqual(members);
    }).toPass({ timeout: 90_000, intervals: [2_000, 5_000, 10_000] });

    await page.getByRole("navigation").first().getByRole("link", { name: "რეიტინგი" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
  });

  test("the single register CTA lands on the Google-gated join flow", async ({ page }) => {
    await page.goto("/");
    // One door now: the ladder's first column CTA is „გახდი მხარდამჭერი →“ (app/(public)/page.tsx);
    // the old two-door „გახდი დელეგატი“ is gone. Scope to <main> — the header keeps its own
    // „შემოგვიერთდი“ link outside <main> (app/(public)/layout.tsx).
    const cta = page
      .getByRole("main")
      .getByRole("link", { name: "გახდი მხარდამჭერი →", exact: true });
    await expect(cta).toBeVisible();
    await expect(page.getByText("გახდი დელეგატი")).toHaveCount(0);
    await cta.click();
    await expect(page).toHaveURL(/\/join$/);
    // Logged-out visitors must establish the Google identity before any personal
    // or phone fields appear. The authenticated form is covered in registration.spec.
    await expect(page.getByRole("heading", { name: "შემოგვიერთდი", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Google-ით გაგრძელება" })).toBeVisible();
    await expect(page.getByLabel("ტელეფონის ნომერი")).toHaveCount(0);
    await expect(page.getByLabel("პირადი ნომერი")).toHaveCount(0);
  });
});

test.describe("leaderboard", () => {
  test("ranks 12 delegates with plain numbering, no medals", async ({ page }) => {
    await page.goto("/leaderboard");
    const rows = page.getByTestId("leader-row");
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(12); // seeded roster; staging may carry real extras
    await expect(rows.first().getByTestId("rank-1")).toBeVisible();
    await expect(page.getByText("🥇")).toHaveCount(0);
    await expect(rows.first()).toContainText("გიორგი მაისურაძე");
    await expect(page.getByText("ბექა ღოღობერიძე")).toHaveCount(0);
  });

  test("search and region filter work, no-results notice shows", async ({ page }) => {
    await page.goto("/leaderboard");
    const rows = page.getByTestId("leader-row");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(12); // seeded roster; staging may carry real extras
    await expect(page.getByText("ბექა ღოღობერიძე")).toHaveCount(0); // pending stays hidden
    await page.getByPlaceholder("ძებნა სახელით...").fill("გიორგი");
    await expect(page.getByText("გიორგი მაისურაძე")).toBeVisible();
    await page.getByPlaceholder("ძებნა სახელით...").fill("");
    await page.getByRole("combobox").selectOption({ label: "გურია" });
    await expect(page.getByText("ეკა მელაძე")).toBeVisible();
    await page.getByPlaceholder("ძებნა სახელით...").fill("zzz");
    await expect(
      page.getByText("ამ პარამეტრებით დელეგატი ვერ მოიძებნა", { exact: false }),
    ).toBeVisible();
  });

  test("the retired /delegates index redirects, profile pages still resolve", async ({ page }) => {
    await page.goto("/delegates");
    await expect(page).toHaveURL(/\/leaderboard$/);
    const profile = await page.goto("/delegates/giorgi-maisuradze");
    expect(profile?.status()).toBe(200);
  });
});

test.describe("delegate page", () => {
  test("renders profile, rank and share tags by slug", async ({ page, request }) => {
    await page.goto("/delegates/giorgi-maisuradze");
    await expect(page.getByRole("heading", { name: "გიორგი მაისურაძე" })).toBeVisible();
    await expect(page.getByText("#1")).toBeVisible();
    await expect(page.getByText("პოზიცია რეიტინგში")).toBeVisible();
    // .first() keeps the locator on the StatCard label (the active-member stat under
    // test) should the wording ever repeat on the page, without loosening the check.
    await expect(page.getByText("წევრი", { exact: true }).first()).toBeVisible(); // member stat present (ADR-037)
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toContain("გიორგი მაისურაძე");
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toBeTruthy();
    const image = await request.get(ogImage!);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
  });

  test("unknown slug shows the Georgian 404", async ({ page }) => {
    const response = await page.goto("/delegates/no-such-delegate");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("დელეგატი ვერ მოიძებნა.")).toBeVisible();
  });
});

test.describe("missing pages", () => {
  // An unknown URL and a missing article or event are different Next.js paths (the site-wide
  // not-found vs the public group's), so each gets its own check.
  for (const path of [
    "/no-such-page-xyz",
    "/news/no-such-article-xyz",
    "/events/no-such-event-xyz",
  ]) {
    test(`${path} is a Georgian 404 inside the site header`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: NOT_FOUND_HEADING })).toBeVisible();
      await expect(page.getByRole("link", { name: NOT_FOUND_HOME })).toHaveAttribute("href", "/");
      await expect(
        page.getByRole("banner").getByRole("link", { name: "შემოგვიერთდი", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("This page could not be found")).toHaveCount(0);
      // Articles and events set their own Georgian "not found" titles; whatever the page, the
      // framework's English default must never reach the tab.
      await expect(page).not.toHaveTitle(/could not be found/);
    });
  }

  test("an unknown URL titles the tab in Georgian", async ({ page }) => {
    await page.goto("/no-such-page-xyz");
    await expect(page).toHaveTitle(NOT_FOUND_TITLE);
  });
});

test.describe("robots", () => {
  test("non-production deployments refuse indexing", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /");
  });
});

// ADR-034: the finance page is hidden unless SHOW_PUBLIC_FINANCES=true. Exactly one of the two
// groups below runs, so flipping the switch re-enables the original assertions untouched.
test.describe("finances hidden", () => {
  test.skip(FINANCES_PUBLIC, "finances are public — see the transparency group");

  test("/transparency answers 404 even with the exact address", async ({ page }) => {
    // the tab names no finance page either: it reads as any other missing page
    await expectHiddenPage(page, "/transparency");
    await expect(page.getByRole("columnheader", { name: "რეგიონი" })).toHaveCount(0);
  });

  test("no public page links to it", async ({ page }) => {
    for (const path of ["/", "/news", "/events", "/leaderboard", "/join", "/support"]) {
      await page.goto(path);
      await expect(page.locator('a[href="/transparency"]'), path).toHaveCount(0);
    }
  });
});

test.describe("transparency", () => {
  test.skip(!FINANCES_PUBLIC, "finances are hidden (ADR-034) — see the finances hidden group");

  test("the region table shows members and collected money", async ({ page }) => {
    await page.goto("/transparency");
    await expect(page.getByRole("columnheader", { name: "რეგიონი" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "წევრი" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /შეგროვებული თანხა/ })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "აქტიური" })).toHaveCount(0);
  });
});

// ADR-038: events are hidden unless SHOW_EVENTS=true. With the switch on, community-events.spec.ts
// and the homepage check above cover the visible pages.
test.describe("events hidden", () => {
  test.skip(EVENTS_SHOWN, "events are shown — see community-events.spec.ts");

  test("/events answers 404 even with the exact address, and the tab never names events", async ({
    page,
  }) => {
    await expectHiddenPage(page, "/events");
  });

  test("an old event address on a phone has no back link to the hidden index", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto("/events/no-such-event-xyz");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: NOT_FOUND_HEADING })).toBeVisible();
    await expect(page.locator('a[href="/events"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /ღონისძიებ/ })).toHaveCount(0);
  });

  test("no public page links to it", async ({ page }) => {
    for (const path of ["/", "/news", "/leaderboard", "/join", "/support"]) {
      await page.goto(path);
      await expect(page.locator('a[href="/events"]'), path).toHaveCount(0);
      await expect(page.locator('a[href^="/events/"]'), path).toHaveCount(0);
    }
  });
});

// ADR-040: Next regenerates a hidden page's 60-second ISR entry without the page's own metadata,
// so the tab used to fall back to the plain site name from the second minute on. Each address is
// visited three times: now, after the entry has gone stale (that visit starts the regeneration)
// and once more after it (the regenerated copy). None may differ from a mistyped address.
test.describe("hidden pages after the 60-second refresh", () => {
  const hidden = [
    ...(FINANCES_PUBLIC ? [] : ["/transparency"]),
    // a real seeded event's address too: hiding events must not leak its title
    ...(EVENTS_SHOWN ? [] : ["/events", "/events/saerto-kreba-tbilisshi"]),
  ];
  test.skip(hidden.length === 0, "every switch is on: nothing is hidden");
  // Only a production server (CI's `npm run start`) regenerates pages; `next dev` has no ISR.
  test.skip(!process.env.CI, "needs the production server CI runs");

  test("keep the exact not-found title on every visit", async ({ page }) => {
    for (const path of hidden) await expectHiddenPage(page, path);
    await page.waitForTimeout(61_000);
    for (const path of hidden) await expectHiddenPage(page, path);
    await page.waitForTimeout(3_000);
    for (const path of hidden) await expectHiddenPage(page, path);
  });
});
