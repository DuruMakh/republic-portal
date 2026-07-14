import { expect, test } from "@playwright/test";

const DEMO_BANNER = "სადემონსტრაციო გარემო — მონაცემები ფიქტიურია";

test.describe("home", () => {
  test("hero, live counters and nav work", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "ავაშენოთ ქართული რესპუბლიკა ერთად" }),
    ).toBeVisible();
    await expect(page.getByText(DEMO_BANNER)).toBeVisible();
    for (const id of ["stat-approved-delegates", "stat-active-members"]) {
      // expect.poll: CountUp (components/CountUp.tsx) renders the real value on the
      // server, then animates 0 -> value over ~1.1s after hydration. A single-shot
      // read can land on an early animation frame and see a rounded 0 for small
      // counts. Poll until the (real, settled) value is read instead of loosening
      // what's asserted.
      await expect
        .poll(async () => {
          const text = await page.getByTestId(id).innerText();
          return Number(text.replace(/[^\d]/g, ""));
        })
        .toBeGreaterThan(0);
    }
    await page.getByRole("navigation").first().getByRole("link", { name: "დელეგატები" }).click();
    await expect(page).toHaveURL(/\/delegates$/);
  });

  test("join CTAs land on the opening-soon page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "გახდი წევრი" }).first().click();
    await expect(page).toHaveURL(/\/join/);
    await expect(page.getByRole("heading", { name: "რეგისტრაცია მალე გაიხსნება" })).toBeVisible();
  });
});

test.describe("delegate directory", () => {
  test("lists approved delegates, search and region filter work", async ({ page }) => {
    await page.goto("/delegates");
    await expect(page.getByTestId("delegate-card")).toHaveCount(12);
    await expect(page.getByText("ბექა ღოღობერიძე")).toHaveCount(0); // pending stays hidden
    await page.getByPlaceholder("ძებნა სახელით...").fill("გიორგი");
    await expect(page.getByTestId("delegate-card")).toHaveCount(1);
    await page.getByPlaceholder("ძებნა სახელით...").fill("");
    await page.getByRole("combobox").selectOption({ label: "გურია" });
    await expect(page.getByTestId("delegate-card")).toHaveCount(1);
    await expect(page.getByText("ეკა მელაძე")).toBeVisible();
    await page.getByPlaceholder("ძებნა სახელით...").fill("zzz");
    await expect(
      page.getByText("ამ პარამეტრებით დელეგატი ვერ მოიძებნა", { exact: false }),
    ).toBeVisible();
  });
});

test.describe("leaderboard", () => {
  test("ranks 12 delegates with a gold medal on top", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByTestId("leader-row")).toHaveCount(12);
    const first = page.getByTestId("leader-row").first();
    await expect(first).toContainText("🥇");
    await expect(first).toContainText("გიორგი მაისურაძე");
    await expect(page.getByText("ბექა ღოღობერიძე")).toHaveCount(0);
  });
});

test.describe("delegate page", () => {
  test("renders profile, rank and share tags by slug", async ({ page, request }) => {
    await page.goto("/delegates/giorgi-maisuradze");
    await expect(page.getByRole("heading", { name: "გიორგი მაისურაძე" })).toBeVisible();
    await expect(page.getByText("#1")).toBeVisible();
    await expect(page.getByText("პოზიცია რეიტინგში")).toBeVisible();
    // .first(): this text also appears inside the CTA copy further down the page
    // ("გახდი მისი აქტიური მხარდამჭერი"), so the bare locator hits Playwright's
    // strict-mode multi-match guard. .first() disambiguates to the StatCard label
    // (the actual supporter-stat element under test) without loosening the check.
    await expect(page.getByText("აქტიური მხარდამჭერი").first()).toBeVisible(); // supporter stat present
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

test.describe("robots", () => {
  test("non-production deployments refuse indexing", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /");
  });
});
