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

test("member cabinet: profile edit, delegate change, tier change, billing, one-way funnel", async ({
  page,
}) => {
  const phone = journeyPhone(JOURNEY.cabinet);

  // Seed a completed member (tier 20). The subject here is post-registration cabinet
  // behavior — the UI registration journey lives in registration/membership specs. The
  // default seed region (ქვემო ქართლი) has a real 3rd city, which the profile-edit step
  // below needs (თბილისი the region has exactly ONE city, so its index 2 never resolves).
  await seedCompletedMember({
    phone,
    firstName: "ვატესტ",
    lastName: "კაბინეტს",
    personalId: journeyPersonalId(JOURNEY.cabinet),
    tier: 20,
  });
  await loginAs(page, phone);

  await page.goto("/me/profile");
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
  await expect(page.getByTestId("current-delegate")).toHaveText("ცენტრალური მოძრაობა");
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

  // billing: permanent code + placeholder-marked details + tier change 20 → 5
  await page.goto("/me/billing");
  await expect(page.getByTestId("reference-code")).toHaveText(/^GR-[A-HJKMNP-Z2-9]{6}$/);
  await expect(page.getByTestId("bank-placeholder")).toBeVisible();
  await expect(page.getByTestId("current-tier")).toContainText("20 ₾");
  await page.getByRole("button", { name: "შეცვლა" }).click();
  await page.getByRole("radio", { name: /5/ }).click();
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByText("საწევრო შეიცვალა ✓")).toBeVisible();
  await expect(page.getByTestId("current-tier")).toContainText("5 ₾");
  await expect(page.getByText("გადმორიცხე")).toContainText("5 ₾");
  await expect(page.getByTestId("billing-empty")).toBeVisible();

  // the cabinet is one-way now; a signed-in member is bounced off the join/delegate doors
  await page.goto("/join");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/delegate");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "კაბინეტი" })).toBeVisible();
});
