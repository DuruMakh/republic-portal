import { expect, test } from "@playwright/test";
import {
  cleanupJourneyUsers,
  getSeededReferral,
  JOURNEY,
  journeyPhone,
  passRegistration,
  submitJoinAndReadInboxOtp,
} from "./funnel-helpers";

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
  });

  // registered overview greets them by name
  await expect(page.getByRole("heading", { name: `გამარჯობა, ${firstName}!` })).toBeVisible();

  // nav is exactly the registered set — no member-only pages
  const nav = page.getByRole("navigation", { name: "კაბინეტის ნავიგაცია" });
  for (const label of ["მთავარი", "ღონისძიებები", "სიახლეები", "პროფილი"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "გამოკითხვები" })).toHaveCount(0); // members-only

  // The same registered role must expose its four destinations plus utilities
  // through the real mobile cabinet chrome, not only the desktop CabinetNav.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.locator('a[href="/me"]')).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("button", { name: "მეტი" })).toBeVisible();
  await expect(page.locator("div.sticky.bottom-0")).toHaveCount(1);
  await page.setViewportSize({ width: 1280, height: 900 });

  // The in-progress wizard keeps the established desktop Masthead and hides
  // its mobile back header and bottom bar.
  await page.goto("/me/membership");
  await expect(page).toHaveURL(/\/me\/membership$/);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCSS("position", "static");
  await expect(page.locator("div.sticky.bottom-0")).toBeHidden();

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
  await page.getByLabel("ტელეფონის ნომერი").fill(phone);
  const reentryOtp = await submitJoinAndReadInboxOtp(page, phone);
  await page.getByTestId("otp-0").fill(reentryOtp);
  await page.getByRole("button", { name: "დადასტურება" }).click();

  await expect(page.getByTestId("join-notice")).toHaveText("ეს ნომერი უკვე რეგისტრირებულია");
  await expect(page).toHaveURL(/\/me$/);
  // original identity untouched — the greeting is still the first registration's name
  await expect(page.getByRole("heading", { name: `გამარჯობა, ${firstName}!` })).toBeVisible();
});

test("a referral link is captured at registration and bound in the wizard", async ({ page }) => {
  const { code, fullName } = await getSeededReferral();
  const phone = journeyPhone(JOURNEY.regReferral);
  await page.goto(`/join?ref=${encodeURIComponent(code)}`);
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "რეფერალს",
  });

  // the become-a-member wizard shows the bound delegate — a read-only card, not the
  // picker (capture-at-registration, spec D1)
  await page.goto("/me/membership");
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText(/რეფერალური ბმულით/)).toBeVisible();
  await expect(page.getByLabel("დელეგატი")).toHaveCount(0);
});
