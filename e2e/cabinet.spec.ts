import { expect, test } from "@playwright/test";
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

test("member cabinet: profile edit, delegate change, billing, one-way funnel", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.cabinet);

  // Seed a completed member. The subject here is post-registration cabinet
  // behavior — the UI registration journey lives in registration/membership specs. The
  // default seed region (ქვემო ქართლი) has a real 3rd city, which the profile-edit step
  // below needs (თბილისი the region has exactly ONE city, so its index 2 never resolves).
  await seedCompletedMember({
    phone,
    firstName: "ვატესტ",
    lastName: "კაბინეტს",
    personalId: journeyPersonalId(JOURNEY.cabinet),
  });
  await loginAs(page, phone);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/me/profile");
  const mobileNav = page.locator("div.sticky.bottom-0 nav");
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link")).toHaveCount(4);
  await expect(mobileNav.locator('a[href="/me/profile"]')).toHaveAttribute("aria-current", "page");
  await expect(mobileNav.getByRole("button", { name: "მეტი" })).toBeVisible();
  await expect(page.locator("div.sticky.bottom-0")).toHaveCount(1);
  const mobileHeader = page.getByRole("banner");
  await expect(mobileHeader).toHaveCSS("position", "sticky");
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(async () => (await mobileHeader.boundingBox())?.y).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByText("ვატესტ კაბინეტს")).toBeVisible();
  await expect(page.getByText("წევრი").first()).toBeVisible();
  await expect(page.getByTestId("profile-pid")).toHaveValue("•••••••••••");

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

  // same-choice guard — no server call, polite Georgian refusal
  await picker.selectOption({ label: `${chosenLabel} (მიმდინარე)` });
  await page.getByRole("button", { name: "დელეგატის შეცვლა" }).click();
  await expect(page.getByTestId("change-delegate-message")).toHaveText("ეს დელეგატი უკვე არჩეულია");

  // billing: permanent code + placeholder-marked details + the fixed fee, no change
  // control (owner fix #9: the tier picker/change flow is retired)
  await page.goto("/me/billing");
  const moreButton = mobileNav.getByRole("button", { name: "მეტი" });
  await expect(moreButton).toHaveAttribute("aria-current", "page");
  await moreButton.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.locator('a[href="/me/billing"]')).toHaveAttribute("aria-current", "page");
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.querySelector('[role="dialog"]')?.contains(document.activeElement),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(moreButton).toBeFocused();
  await expect(page.getByTestId("reference-code")).toHaveText(/^GR-[A-HJKMNP-Z2-9]{6}$/);
  await expect(page.getByTestId("bank-placeholder")).toBeVisible();
  await expect(page.getByText("თვეში")).toBeVisible();
  await expect(page.getByRole("button", { name: "შეცვლა" })).toHaveCount(0);
  await expect(page.getByText("გადმორიცხე")).toContainText("10 ₾");
  await expect(page.getByTestId("billing-empty")).toBeVisible();

  // Desktop keeps the established CabinetNav and suppresses the mobile bar.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(mobileNav).toBeHidden();
  await expect(
    page
      .getByRole("navigation", { name: "კაბინეტის ნავიგაცია" })
      .getByRole("link", { name: "გადახდები" }),
  ).toBeVisible();
  await page.goto("/me/membership");
  await expect(page).toHaveURL(/\/me\/membership\/done$/);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCSS("position", "static");
  await expect(page.locator("div.sticky.bottom-0")).toBeHidden();

  // the cabinet is one-way now; a signed-in member is bounced off the join/delegate doors
  await page.goto("/join");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/delegate");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "კაბინეტი" })).toBeVisible();
});
