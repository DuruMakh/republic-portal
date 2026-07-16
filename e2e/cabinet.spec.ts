import { expect, test } from "@playwright/test";
import {
  cleanupJourneyUsers,
  fillStep2Basics,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  passStep1,
} from "./funnel-helpers";

test.describe.configure({ mode: "serial" });

test.beforeAll(cleanupJourneyUsers);
test.afterAll(cleanupJourneyUsers);

test("member cabinet: profile edit, delegate change, tier change, billing, one-way funnel", async ({
  page,
}) => {
  const phone = journeyPhone(JOURNEY.cabinet);

  // register a fresh member (tier 20, ცენტრალური მოძრაობა)
  // region: ქვემო ქართლი (not თბილისი) — needs a real 3rd city for the profile-edit
  // step below (seed: supabase/migrations/20260712212415_seed_regions.sql — თბილისი
  // the region has exactly ONE city, itself, so index 2 there can never resolve).
  await page.goto("/join/step-1?role=member");
  await passStep1(page, { phone, firstName: "ვატესტ", lastName: "კაბინეტს" });
  await expect(page).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(page, {
    personalId: journeyPersonalId(JOURNEY.cabinet),
    regionLabel: "ქვემო ქართლი",
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("radio", { name: /20/ }).click();
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  // fresh completion still shows the one-time done screen, now with a cabinet button
  await expect(page).toHaveURL(/\/join\/done/);
  await page.getByRole("link", { name: "ჩემი კაბინეტი" }).click();
  await expect(page).toHaveURL(/\/me\/profile/);
  await expect(page.getByText("ვატესტ კაბინეტს")).toBeVisible();
  await expect(page.getByText("რეგისტრირებული").first()).toBeVisible();
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

  // the funnel is one-way now; the header knows the session
  await page.goto("/join");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/join/done");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/delegate");
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "კაბინეტი" })).toBeVisible();
});
