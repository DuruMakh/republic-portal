import { expect, test } from "@playwright/test";
import { FINANCES_PUBLIC } from "./finances-switch";

test("the header has one account action, and no finance link while finances are hidden", async ({
  page,
}) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "შემოგვიერთდი", exact: true })).toHaveCount(1);
  await expect(header.getByRole("link", { name: "შესვლა", exact: true })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "ფინანსები", exact: true })).toHaveCount(
    FINANCES_PUBLIC ? 1 : 0,
  );
});

test("home renders in Georgian with a single register CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ქართული რესპუბლიკა" })).toBeVisible();
  // one-door registration: the hero CTA is „დარეგისტრირდი"; the old „გახდი დელეგატი" is gone
  await expect(
    page.getByRole("main").getByRole("link", { name: "გახდი მხარდამჭერი →", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("გახდი დელეგატი")).toHaveCount(0);
  // the header keeps its own CTA (app/(public)/layout.tsx); the ladder's third counter
  await expect(
    page.getByRole("banner").getByRole("link", { name: "შემოგვიერთდი", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("stat-registered-total")).toBeVisible();
});

test("join requires Google before showing registration fields", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "შემოგვიერთდი", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google-ით გაგრძელება" })).toBeVisible();
  await expect(page.getByLabel("ტელეფონის ნომერი")).toHaveCount(0);
  await expect(page.getByLabel("პირადი ნომერი")).toHaveCount(0);
});

test("styleguide renders design system", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.getByRole("button", { name: "ძირითადი" })).toBeVisible();
  // Pill's member default (both member statuses read „წევრი“, ADR-037). Scoped to the
  // "სტატუსები" demo card and exact-matched: the styleguide also has an unrelated StatCard
  // demo labeled the very same word outside any <section>, so an unscoped lookup would
  // prove nothing about which one actually rendered. Two pills carry it, hence toHaveCount.
  const statusesCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "სტატუსები", exact: true }) });
  await expect(statusesCard.getByText("წევრი", { exact: true })).toHaveCount(2);
});

test("member area redirects anonymous users to login", async ({ page }) => {
  await page.goto("/me/profile");
  await expect(page).toHaveURL(/\/login/);
});
