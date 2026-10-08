import { expect, test } from "@playwright/test";
import { signOutViaNav } from "./admin-helpers";
import {
  cleanupJourneyUsers,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  loginAs,
  seedCompletedMember,
} from "./funnel-helpers";

test.describe.configure({ mode: "serial" });

test.beforeAll(cleanupJourneyUsers);
test.afterAll(cleanupJourneyUsers);

test("member cabinet: profile edit, delegate change, one-way funnel, no admin", async ({
  page,
}) => {
  const phone = journeyPhone(JOURNEY.cabinet);

  // Seed a completed member. The subject here is post-registration cabinet
  // behavior — the UI registration journey lives in the membership spec. The
  // default seed region (ქვემო ქართლი) has a real 3rd city, which the profile-edit step
  // below needs (თბილისი the region has exactly ONE city, so its index 2 never resolves).
  await seedCompletedMember({
    phone,
    firstName: "ვატესტ",
    lastName: "კაბინეტს",
    personalId: journeyPersonalId(JOURNEY.cabinet),
  });
  await loginAs(page, phone);
  await page.goto("/me/profile");
  await expect(page.getByText("ვატესტ კაბინეტს")).toBeVisible();
  await expect(page.getByText("წევრი").first()).toBeVisible();
  await expect(page.getByTestId("profile-pid")).toHaveValue("•••••••••••");

  // signed-in phone chrome at layout level: exactly one bottom tab bar, a header that stays
  // pinned, and the More sheet opening as a dialog (focus and Escape are its unit tests)
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNav = page.locator("div.sticky.bottom-0 nav");
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link")).toHaveCount(4);
  await expect(mobileNav.locator('a[href="/me/profile"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator("div.sticky.bottom-0")).toHaveCount(1);
  const mobileHeader = page.getByRole("banner");
  await expect(mobileHeader).toHaveCSS("position", "sticky");
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(async () => (await mobileHeader.boundingBox())?.y).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await mobileNav.getByRole("button", { name: "მეტი" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(mobileNav).toBeHidden();

  // profile edit persists across reload
  await page.getByLabel("ქალაქი / მუნიციპალიტეტი").selectOption({ index: 2 });
  const cityValue = await page.getByLabel("ქალაქი / მუნიციპალიტეტი").inputValue();
  await page.getByLabel("სამუშაო ადგილი / სტატუსი").selectOption({ label: "პენსიონერი" });
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByTestId("profile-saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("ქალაქი / მუნიციპალიტეტი")).toHaveValue(cityValue);
  await expect(page.getByLabel("სამუშაო ადგილი / სტატუსი")).toHaveValue("პენსიონერი");

  // delegate change: central → first delegate in the member's region (seeded, approved)
  await page.goto("/me/delegate");
  await expect(page.getByTestId("current-delegate")).toHaveText("არ მყავს დელეგატი");
  const picker = page.getByLabel("დელეგატი");
  await picker.selectOption({ index: 1 });
  const chosenLabel = (await picker.locator("option:checked").innerText()).trim();
  await page.getByRole("button", { name: "დელეგატის შეცვლა" }).click();
  await expect(page.getByTestId("change-delegate-message")).toHaveText("დელეგატი შეიცვალა ✓");
  await expect(page.getByTestId("current-delegate")).toHaveText(chosenLabel);

  // a completed member has nothing left to fill in: the wizard answers with its done page
  await page.goto("/me/membership");
  await expect(page).toHaveURL(/\/me\/membership\/done$/);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCSS("position", "static");

  // the cabinet is one-way now; a signed-in member is bounced off the join/delegate doors
  await page.goto("/join");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/delegate");
  await expect(page).toHaveURL(/\/me\/profile/);
  // an ordinary member (admin_roles empty) is bounced from /admin to their cabinet: the
  // admin layout gate sends it through deriveDestination()
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/me\/profile$/);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "კაბინეტი" })).toBeVisible();

  // a missing cabinet page shows just the notice inside the cabinet's own chrome: the public
  // header and footer must not nest inside it (app/route-groups.test.tsx)
  const missing = await page.goto("/me/news/no-such-article-xyz");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "გვერდი ვერ მოიძებნა." })).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);

  // the real sign-out control ends the session: home, and the cabinet asks for a login again
  await page.goto("/me/profile");
  await signOutViaNav(page);
  await page.goto("/me/profile");
  await expect(page).toHaveURL(/\/login/);
});
