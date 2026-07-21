import { expect, test } from "@playwright/test";
import {
  cleanupJourneyUsers,
  getSeededReferral,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  passRegistration,
  submitJoinAndReadInboxOtp,
} from "./funnel-helpers";

// Journeys share per-run users and the duplicate-ID test depends on the happy-path
// journey's personal ID already existing — run serially.
test.describe.configure({ mode: "serial" });

test.beforeAll(cleanupJourneyUsers);
test.afterAll(cleanupJourneyUsers);

test("registers in one door, lands in the registered cabinet; same phone re-entry no-ops", async ({
  page,
}) => {
  test.setTimeout(200_000); // headroom for the 62s OTP cooldown ride-out below
  const phone = journeyPhone(JOURNEY.regHappy);
  const firstName = "ნინო";
  await page.goto("/join");
  await passRegistration(page, {
    phone,
    firstName,
    lastName: "ტესტი",
    personalId: journeyPersonalId(JOURNEY.regHappy),
  });

  // registered overview greets them by name
  await expect(page.getByRole("heading", { name: `გამარჯობა, ${firstName}!` })).toBeVisible();

  // nav is exactly the registered set — no member-only pages
  const nav = page.getByRole("navigation", { name: "კაბინეტის ნავიგაცია" });
  for (const label of ["მთავარი", "ღონისძიებები", "სიახლეები", "პროფილი"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "გამოკითხვები" })).toHaveCount(0); // members-only

  // members-only surface, reached directly, bounces back to the overview
  await page.goto("/me/billing");
  await expect(page).toHaveURL(/\/me$/);

  // Same phone, fresh (signed-out) session: proving ownership again is a no-op — the
  // RPC never overwrites the existing profile, so the original first name survives.
  // This phone now HAS a registered profile, so /api/dev/otp withholds the on-screen
  // code (account-takeover guard) — read it from dev_otp_inbox via the service client.
  // Re-sending to the just-verified phone also hits Supabase's ~60s per-phone cooldown,
  // which submitJoinAndReadInboxOtp rides out before returning the code.
  await page.context().clearCookies();
  await page.goto("/join");
  await page.getByLabel("სახელი").fill("სხვა");
  await page.getByLabel("გვარი").fill("სახელი");
  await page.getByLabel("პირადი ნომერი").fill(journeyPersonalId(JOURNEY.spare)); // a different ID
  await page.getByLabel("ტელეფონის ნომერი").fill(phone);
  const reentryOtp = await submitJoinAndReadInboxOtp(page, phone);
  await page.getByTestId("otp-0").fill(reentryOtp);
  await page.getByRole("button", { name: "დადასტურება" }).click();

  await expect(page.getByTestId("join-notice")).toHaveText("ეს ნომერი უკვე რეგისტრირებულია");
  await expect(page).toHaveURL(/\/me$/);
  // original identity untouched — the greeting is still the first registration's name
  await expect(page.getByRole("heading", { name: `გამარჯობა, ${firstName}!` })).toBeVisible();
});

test("duplicate personal ID is rejected inline, then corrected without a second code", async ({
  page,
}) => {
  const phone = journeyPhone(JOURNEY.regDupId);
  await page.goto("/join");
  await page.getByLabel("სახელი").fill("ვატესტ");
  await page.getByLabel("გვარი").fill("დუბლიკატს");
  await page.getByLabel("პირადი ნომერი").fill(journeyPersonalId(JOURNEY.regHappy)); // taken already
  await page.getByLabel("ტელეფონის ნომერი").fill(phone);
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("otp-0").fill((await devOtp.locator("strong").innerText()).trim());
  await page.getByRole("button", { name: "დადასტურება" }).click();

  // the duplicate surfaces as a field error; the phone stays proven (disabled)
  await expect(page.getByText("ეს პირადი ნომერი უკვე რეგისტრირებულია.")).toBeVisible();
  await expect(page.getByLabel("ტელეფონის ნომერი")).toBeDisabled();

  // correct the ID and resubmit — the button is now „დარეგისტრირება" (no fresh OTP)
  await page.getByLabel("პირადი ნომერი").fill(journeyPersonalId(JOURNEY.regDupId));
  await page.getByRole("button", { name: "დარეგისტრირება" }).click();
  await expect(page).toHaveURL(/\/me(\/|\?|#|$)/);
  await expect(page.getByRole("heading", { name: /გამარჯობა/ })).toBeVisible();
});

test("a referral link is captured at registration and bound in the wizard", async ({ page }) => {
  const { code, fullName } = await getSeededReferral();
  const phone = journeyPhone(JOURNEY.regReferral);
  await page.goto(`/join?ref=${encodeURIComponent(code)}`);
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "რეფერალს",
    personalId: journeyPersonalId(JOURNEY.regReferral),
  });

  // the become-a-member wizard shows the bound delegate — a read-only card, not the
  // picker (capture-at-registration, spec D1)
  await page.goto("/me/membership");
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText(/რეფერალური ბმულით/)).toBeVisible();
  await expect(page.getByLabel("დელეგატი")).toHaveCount(0);
});
