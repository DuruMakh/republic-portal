// This suite asserts the canonical seed (12 approved delegates, leaderboard order, pending names
// absent). CI seeds a fresh throwaway stack every run (ADR-050); counts stay floors (>=) anchored
// on seeded names/ranks so the suite also holds against hosted staging, which carries extra
// accounts. A missing seeded name/rank or a count below 12 is a real defect or a broken seed.
import { expect, test, type Page } from "@playwright/test";
import { formatCountKa } from "../lib/format";
import { EVENTS_SHOWN } from "./events-switch";
import { FINANCES_PUBLIC } from "./finances-switch";
import { serviceClient } from "./otp-helpers";

const DEMO_BANNER = "სადემონსტრაციო გარემო — მონაცემები ფიქტიურია";
const NOT_FOUND_HEADING = "გვერდი ვერ მოიძებნა.";
const NOT_FOUND_HOME = "დაბრუნდი მთავარ გვერდზე";
const NOT_FOUND_TITLE = "გვერდი ვერ მოიძებნა — ქართული რესპუბლიკა";
// A missing article, delegate or event names what is missing (ADR-044).
const ARTICLE_NOT_FOUND_TITLE = "სიახლე ვერ მოიძებნა — ქართული რესპუბლიკა";
const DELEGATE_NOT_FOUND_TITLE = "დელეგატი ვერ მოიძებნა — ქართული რესპუბლიკა";
const DELEGATE_NOT_FOUND_HEADING = "დელეგატი ვერ მოიძებნა.";
const EVENT_NOT_FOUND_TITLE = "ღონისძიება ვერ მოიძებნა — ქართული რესპუბლიკა";

/**
 * A page hidden by a switch (ADR-034, ADR-042) must be indistinguishable from a mistyped address:
 * 404, the Georgian notice, and the exact not-found title both in the served HTML (what a link
 * preview or a browser without scripts sees) and in the tab once the page has loaded (ADR-040).
 */
async function expectHiddenPage(page: Page, path: string) {
  await expectNotFound(page, path, NOT_FOUND_TITLE, NOT_FOUND_HEADING);
}

/** A 404 with its notice, and the given title in the served HTML and in the tab. */
async function expectNotFound(page: Page, path: string, title: string, heading: string) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(404);
  expect(await response?.text(), path).toContain(`<title>${title}</title>`);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expect(page).toHaveTitle(title);
}

test.describe("home", () => {
  test("hero, live counters and nav work", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "ერთად შევქმნათ ქართული რესპუბლიკა" }),
    ).toBeVisible();
    await expect(page.getByText(DEMO_BANNER)).toBeVisible();
    // Since ADR-038 the header carries neither page: these homepage links are the way in
    // (news is also in the footer; events, while SHOW_EVENTS=true, only from here).
    await expect(page.getByRole("main").locator('a[href="/news"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "სიახლეები" })).toBeVisible();
    // ADR-042: the events section is there only while SHOW_EVENTS=true.
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
    // or phone fields appear. The authenticated form is covered in membership.spec.
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
  // An unknown URL and a missing article are different Next.js paths (the site-wide
  // not-found vs the public group's), so each gets its own check. A missing event takes the
  // same public-group path as a missing article.
  for (const path of ["/no-such-page-xyz", "/news/no-such-article-xyz"]) {
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

test.describe("member area", () => {
  test("redirects anonymous users to login", async ({ page }) => {
    await page.goto("/me/profile");
    await expect(page).toHaveURL(/\/login/);
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
});

test.describe("transparency", () => {
  test.skip(!FINANCES_PUBLIC, "finances are hidden (ADR-034) — see the finances hidden group");

  // Moved unchanged from community-polls.spec (its old step 4): needs no login, and
  // runs again once SHOW_PUBLIC_FINANCES is on (ADR-034).
  test("transparency equals the register (derived, never stored)", async ({ page }) => {
    const db = serviceClient();
    // Staging has 1663+ live payment rows — above PostgREST's server-side
    // max-rows cap (confirmed: even an explicit .range(0, 49999) still comes
    // back truncated at exactly 1000 rows on this project), so a single
    // unranged .select() silently undercounts (measured: 15005 vs the true,
    // correctly-displayed 24840). transparency_stats derives total_gel via an
    // in-DB SQL sum() with no such cap, so the mismatch is this fetch, not the
    // app. Page through in batches of 1000 to read every row.
    const PAYMENTS_PAGE = 1000;
    let livePayments: { amount_gel: number }[] = [];
    for (let offset = 0; ; offset += PAYMENTS_PAGE) {
      const { data: chunk, error: chunkErr } = await db
        .from("payments")
        .select("amount_gel")
        .is("voided_at", null)
        .order("id")
        .range(offset, offset + PAYMENTS_PAGE - 1);
      if (chunkErr) throw new Error(`payments page fetch failed: ${chunkErr.message}`);
      livePayments = livePayments.concat(chunk ?? []);
      if (!chunk || chunk.length < PAYMENTS_PAGE) break;
    }
    const expectedTotal = Math.round(livePayments.reduce((s, p) => s + Number(p.amount_gel), 0));
    // transparency_stats.registered_members counts non-registered profiles (members):
    // the enum value 'draft' was renamed to 'registered', so the page's „წევრი“ figure is
    // `count(*) where status <> 'registered'`. Query the same way — a literal 'draft' now
    // 22P02s against the renamed enum.
    const { count: registered } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .neq("status", "registered");
    const { count: approvedDelegates } = await db
      .from("delegates")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");
    // one region row (spec §7): the busiest region's row must show the same
    // members figure independently computed above. (Owner fix #5 replaced this
    // view's registered/active columns with members/collected_gel -- see
    // 20260728140000_transparency_region_money.sql. registered's old predicate
    // (status <> 'draft', OID-bound) is numerically identical to members' new
    // one (status in ('profile_completed', 'active_member')); active had no
    // replacement column because the page dropped that figure entirely, so the
    // second assertion this block used to make is gone, not ported.)
    const { data: topRegion } = await db
      .from("transparency_regions")
      .select("*")
      .order("members", { ascending: false })
      .limit(1)
      .single();
    // /transparency is ISR-cached (revalidate 60) with no on-demand revalidation
    // trigger, and the production server (CI runs `next start`) serves the stale
    // snapshot while refreshing in the background — so a render predating this
    // run's own funnel registrations can outlive a single goto by up to ~2
    // windows. Re-request until the live-register values appear (the product
    // contract: derived figures, ≤60s staleness). Dev servers render every
    // request fresh, which is why this race never fires locally.
    test.setTimeout(300_000);
    await expect(async () => {
      await page.goto("/transparency");
      await expect(page.getByText(`${formatCountKa(expectedTotal)} ₾`)).toBeVisible({
        timeout: 1_000,
      });
      await expect(
        page
          .locator("div", { hasText: /^წევრი$/ })
          .locator("..")
          .getByText(formatCountKa(registered ?? 0)),
      ).toBeVisible({ timeout: 1_000 });
      await expect(
        page
          .locator("div", { hasText: /^დამტკიცებული დელეგატი$/ })
          .locator("..")
          .getByText(formatCountKa(approvedDelegates ?? 0)),
      ).toBeVisible({ timeout: 1_000 });
      const regionRow = page.getByRole("row", { name: new RegExp(topRegion!.name_ka) });
      await expect(regionRow.getByText(formatCountKa(topRegion!.members))).toBeVisible({
        timeout: 1_000,
      });
    }).toPass({ timeout: 150_000, intervals: [2_000, 5_000, 10_000] });
  });

  test("the region table shows members and collected money", async ({ page }) => {
    await page.goto("/transparency");
    await expect(page.getByRole("columnheader", { name: "რეგიონი" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "წევრი" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /შეგროვებული თანხა/ })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "აქტიური" })).toHaveCount(0);
  });
});

test.describe("structure page", () => {
  test("the header link opens it; sections, rules, roster notice and anchors work", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("navigation").first().getByRole("link", { name: "სტრუქტურა" }).click();
    await expect(page).toHaveURL(/\/structure$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "ორგანიზაციული სტრუქტურა" }),
    ).toBeVisible();
    for (const name of ["ბორდი", "წევრები", "საერთო კენჭისყრა", "ბორდის შემადგენლობა"]) {
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("img", { name: "5-დან 4 ხმა" })).toBeVisible();
    await expect(page.getByRole("img", { name: "5-დან 3 ხმა" })).toBeVisible();
    await expect(page.getByText("ბორდის შემადგენლობა მალე გამოქვეყნდება")).toBeVisible();

    await page
      .getByRole("navigation", { name: "ორგანიზაციული სტრუქტურა" })
      .getByRole("link", { name: "საერთო კენჭისყრა", exact: true })
      .click();
    await expect(page).toHaveURL(/\/structure#vote$/);
    await expect(
      page.getByRole("heading", { level: 2, name: "საერთო კენჭისყრა", exact: true }),
    ).toBeInViewport();
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 360, height: 780 } });

    test("an index link lands its heading below the sticky header, not under it", async ({
      page,
    }) => {
      await page.goto("/structure");
      for (const name of ["ბორდი", "წევრები", "საერთო კენჭისყრა"]) {
        await page
          .getByRole("navigation", { name: "ორგანიზაციული სტრუქტურა" })
          .getByRole("link", { name, exact: true })
          .click();
        const heading = page.getByRole("heading", { level: 2, name, exact: true });
        await expect(heading).toBeInViewport();
        const header = await page.getByRole("banner").boundingBox();
        const top = await heading.boundingBox();
        expect(header, "the sticky header is on screen").not.toBeNull();
        expect(top!.y, `${name} heading clears the header`).toBeGreaterThanOrEqual(
          header!.y + header!.height,
        );
      }
    });
  });
});

// ADR-042: events are hidden unless SHOW_EVENTS=true. With the switch on, community-events.spec.ts
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

// ADR-040, ADR-044: Next regenerates a prerendered page's 60-second ISR entry without the page's
// own metadata, so a page-raised 404's tab used to fall back to the plain site name from the
// second minute on. Each address is visited three times: now, after the entry has gone stale
// (that visit starts the regeneration) and once more after it (the regenerated copy). A hidden
// page must match a mistyped address every time; a missing article, delegate or event keeps its
// own title.
test.describe("not-found titles after the 60-second refresh", () => {
  const pages: [path: string, title: string, heading: string][] = [
    ...(FINANCES_PUBLIC ? [] : ["/transparency"]),
    // a real seeded event's address too: hiding events must not leak its title
    ...(EVENTS_SHOWN ? [] : ["/events", "/events/saerto-kreba-tbilisshi"]),
  ].map((path): [string, string, string] => [path, NOT_FOUND_TITLE, NOT_FOUND_HEADING]);
  pages.push(
    ["/news/no-such-article-xyz", ARTICLE_NOT_FOUND_TITLE, NOT_FOUND_HEADING],
    ["/delegates/no-such-delegate", DELEGATE_NOT_FOUND_TITLE, DELEGATE_NOT_FOUND_HEADING],
  );
  // while events are hidden, proxy.ts answers every /events address like the hidden ones above
  if (EVENTS_SHOWN) {
    pages.push(["/events/no-such-event-xyz", EVENT_NOT_FOUND_TITLE, NOT_FOUND_HEADING]);
  }
  // Only a production server (CI's `npm run start`) regenerates pages; `next dev` has no ISR.
  test.skip(!process.env.CI, "needs the production server CI runs");

  test("keep their exact title on every visit", async ({ page }) => {
    const visitAll = async () => {
      for (const [path, title, heading] of pages) await expectNotFound(page, path, title, heading);
    };
    await visitAll();
    await page.waitForTimeout(61_000);
    await visitAll();
    await page.waitForTimeout(3_000);
    await visitAll();
  });
});

test("the privacy policy is public and linked from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "კონფიდენციალურობა" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "კონფიდენციალურობის პოლიტიკა" }),
  ).toBeVisible();
});
