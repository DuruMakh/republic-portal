import { expect, test } from "@playwright/test";
import { runCleanups } from "./cleanup-helpers";
import {
  cleanupGoogleBackedTestUsers,
  cleanupJourneyUsers,
  createGoogleBackedTestUser,
  getSeededReferral,
  JOURNEY,
  journeyPhone,
  passRegistration,
} from "./funnel-helpers";
import { clientFor, serviceClient } from "./otp-helpers";

test.describe.configure({ mode: "serial" });

const cleanupRegistrationUsers = () =>
  runCleanups([
    cleanupJourneyUsers,
    () =>
      cleanupGoogleBackedTestUsers([
        journeyPhone(JOURNEY.regHappy),
        journeyPhone(JOURNEY.regReferral),
      ]),
  ]);

test.beforeAll(cleanupRegistrationUsers);
test.afterAll(cleanupRegistrationUsers);

// Privacy consent (spec 2026-10-08 sections 4 and 6). Runs first in serial mode on the
// regHappy slot and frees it again for the happy path below.
test("no code is sent and no account is created without the privacy consent tick", async ({
  page,
}) => {
  const phone = journeyPhone(JOURNEY.regHappy);
  const { id, session } = await createGoogleBackedTestUser(page, phone);
  try {
    await page.goto("/join");
    await expect(page.getByRole("link", { name: "კონფიდენციალურობის პოლიტიკის" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    await page.getByLabel("სახელი").fill("ნინო");
    await page.getByLabel("გვარი").fill("ტესტი");
    await page.getByLabel("ტელეფონის ნომერი").fill(phone);
    await page.getByRole("button", { name: "კოდის მიღება" }).click();
    await expect(page.getByText("გასაგრძელებლად მონიშნე თანხმობა.")).toBeVisible();
    await expect(page.getByTestId("otp-0")).toHaveCount(0);

    // Bypassing the page does not help: the database refuses a version that is not the
    // current policy. (A missing version is refused only from 20261008150000, which reaches
    // staging after this PR merges, so every open PR's CI keeps working until then; that
    // case is covered by lib/privacy.test.ts and checked live when the migration lands.)
    const client = await clientFor(session);
    const { error } = await client.rpc("register", {
      p_first_name: "ნინო",
      p_last_name: "ტესტი",
      p_ref_code: null,
      p_privacy_version: "2000-01-v0",
    });
    expect(error?.message).toBe("privacy_consent_required");
    const { data: profile } = await serviceClient()
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    expect(profile).toBeNull();
  } finally {
    await cleanupGoogleBackedTestUsers([phone]);
  }
});

test("registers through Google and lands in the registered cabinet", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.regHappy);
  const firstName = "ნინო";
  await passRegistration(page, {
    phone,
    firstName,
    lastName: "ტესტი",
  });

  // consent is recorded with the policy version (spec 2026-10-08 section 6)
  const { data: consent, error: consentError } = await serviceClient()
    .from("profiles")
    .select("privacy_version, privacy_accepted_at")
    .eq("phone", `+995${phone}`)
    .single();
  expect(consentError).toBeNull();
  expect(consent?.privacy_version).toBe("2026-10-v1");
  expect(consent?.privacy_accepted_at).not.toBeNull();

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

  // the payments page does not exist while dues are hidden (ADR-037), for anyone
  await page.goto("/me/billing");
  await expect(page.getByText("გვერდი ვერ მოიძებნა.")).toBeVisible();
});

test("a referral link is captured at registration and bound in the wizard", async ({ page }) => {
  const { code, fullName } = await getSeededReferral();
  const phone = journeyPhone(JOURNEY.regReferral);
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "რეფერალს",
    refCode: code,
  });

  // the become-a-member wizard shows the bound delegate — a read-only card, not the
  // picker (capture-at-registration, spec D1)
  await page.goto("/me/membership");
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText(/რეფერალური ბმულით/)).toBeVisible();
  await expect(page.getByLabel("დელეგატი")).toHaveCount(0);
});

test("the privacy policy is public and linked from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "კონფიდენციალურობა" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "კონფიდენციალურობის პოლიტიკა" }),
  ).toBeVisible();
});
