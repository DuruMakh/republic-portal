import { expect, test, type Page } from "@playwright/test";
import {
  cleanupJourneyUsers,
  getSeededReferral,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
} from "./funnel-helpers";

// Journeys share per-run users and the duplicate test depends on the member
// journey's personal ID already existing — run serially.
test.describe.configure({ mode: "serial" });

test.beforeAll(cleanupJourneyUsers);
test.afterAll(cleanupJourneyUsers);

async function passStep1(
  page: Page,
  opts: { phone: string; firstName: string; lastName: string },
): Promise<void> {
  await page.getByLabel("სახელი").fill(opts.firstName);
  await page.getByLabel("გვარი").fill(opts.lastName);
  await page.getByLabel("ტელეფონის ნომერი").fill(opts.phone);
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await page.getByTestId("otp-0").fill(otp); // OtpInput distributes pasted digits
  await page.getByRole("button", { name: "დადასტურება" }).click();
}

async function fillStep2Basics(
  page: Page,
  opts: { personalId: string; regionLabel: string },
): Promise<void> {
  await page.getByLabel("პირადი ნომერი").fill(opts.personalId);
  await page.getByLabel("დაბადების თარიღი").fill("1990-05-20");
  await page.getByLabel("მხარე").selectOption({ label: opts.regionLabel });
  await page.getByLabel("ქალაქი / მუნიციპალიტეტი").selectOption({ index: 1 });
  await page.getByLabel("სამუშაო ადგილი / სტატუსი").selectOption({ label: "სტუდენტი" });
}

test("member registers end-to-end and gets a reference code", async ({ page, request }) => {
  const phone = journeyPhone(JOURNEY.member);
  await page.goto("/join");
  // The header nav's "გახდი წევრი" link (app/(public)/layout.tsx, href="/join") is
  // also present on /join itself, alongside the choice screen's own CTA — scope to
  // <main> to resolve the strict-mode ambiguity, same as e2e/public.spec.ts.
  await page.getByRole("main").getByRole("link", { name: "გახდი წევრი" }).click();
  await expect(page).toHaveURL(/\/join\/step-1\?role=member/);
  await passStep1(page, { phone, firstName: "ვატესტ", lastName: "წევრობას" });

  await expect(page).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(page, {
    personalId: journeyPersonalId(JOURNEY.member),
    regionLabel: "თბილისი",
  });
  // binding block: central movement is the default; a Tbilisi delegate is offered
  await expect(page.getByLabel("დელეგატი")).toHaveValue("central");
  await page.getByRole("button", { name: "გაგრძელება →" }).click();

  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("radio", { name: /20/ }).click();
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  await expect(page).toHaveURL(/\/join\/done/);
  await expect(page.getByTestId("reference-code")).toHaveText(/^GR-[A-HJKMNP-Z2-9]{6}$/);
  await expect(page.getByTestId("bank-placeholder")).toBeVisible();
  await expect(page.getByText("20 ₾")).toBeVisible();
  await expect(page.getByTestId("chosen-delegate")).toHaveText("ცენტრალური მოძრაობა");

  // hardening (spec §4.4): a completed account's dev code is refused
  const res = await request.get(`/api/dev/otp?phone=${encodeURIComponent(`+995${phone}`)}`);
  expect(res.status()).toBe(404);
});

test("delegate must accept terms, ends pending, stays off public pages", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.delegate);
  const firstName = "ვატესტდელეგატ";
  const lastName = "მოლოდინში";
  await page.goto("/join?role=delegate");
  await expect(page).toHaveURL(/\/join\/step-1\?role=delegate/);
  await passStep1(page, { phone, firstName, lastName });

  await expect(page).toHaveURL(/\/join\/step-2/);
  await expect(page.getByText("დელეგატის რეგისტრაცია").first()).toBeVisible();
  await fillStep2Basics(page, {
    personalId: journeyPersonalId(JOURNEY.delegate),
    regionLabel: "იმერეთი",
  });
  // T&C is mandatory: submitting unchecked shows the Georgian error
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page.getByText("საჭიროა წესებზე თანხმობა.")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "გაგრძელება →" }).click();

  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  await expect(page).toHaveURL(/\/join\/pending/);
  await expect(page.getByText("შენი დელეგატის პროფილი განიხილება")).toBeVisible();
  await expect(page.getByText("განხილვის პროცესში")).toBeVisible();
  await expect(page.getByTestId("reference-code")).toHaveText(/^GR-/);

  // pending delegates appear on no public surface (spec §11)
  await page.goto("/delegates");
  await expect(page.getByText(`${firstName} ${lastName}`)).toHaveCount(0);
  await page.goto("/leaderboard");
  await expect(page.getByText(`${firstName} ${lastName}`)).toHaveCount(0);
});

test("duplicate personal ID is rejected with the Georgian message", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.duplicate);
  await page.goto("/join/step-1?role=member");
  await passStep1(page, { phone, firstName: "ვატესტ", lastName: "დუბლიკატს" });
  await expect(page).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(page, {
    personalId: journeyPersonalId(JOURNEY.member), // taken by the member journey
    regionLabel: "თბილისი",
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page.getByText("ეს პირადი ნომერი უკვე რეგისტრირებულია.")).toBeVisible();
  await expect(page).toHaveURL(/\/join\/step-2/); // still on step 2
});

test("mid-funnel draft resumes on a new device at the right step", async ({ browser }) => {
  const phone = journeyPhone(JOURNEY.resume);
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await pageA.goto("/join/step-1?role=member");
  await passStep1(pageA, { phone, firstName: "ვატესტ", lastName: "გაგრძელებას" });
  await expect(pageA).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(pageA, {
    personalId: journeyPersonalId(JOURNEY.resume),
    regionLabel: "კახეთი",
  });
  await pageA.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(pageA).toHaveURL(/\/join\/step-3/);
  await contextA.close(); // "left, device lost"

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto("/login");
  await pageB.getByLabel("ტელეფონის ნომერი").fill(phone);
  const devOtp = pageB.getByTestId("dev-otp");
  // Supabase enforces a short per-phone minimum interval between SMS OTP sends
  // (supabase/config.toml [auth.sms] max_frequency = "5s", verified live via
  // auth/v1/otp → 429 over_sms_send_rate_limit); this device switch can land
  // inside that window since device A's OTP send is only seconds earlier. Retry
  // past it rather than asserting on the first click.
  await expect(async () => {
    await pageB.getByRole("button", { name: "კოდის მიღება" }).click();
    await expect(devOtp).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await pageB.getByTestId("otp-0").fill(otp);
  await pageB.getByRole("button", { name: "დადასტურება" }).click();
  await expect(pageB).toHaveURL(/\/join\/step-3/); // resumed exactly where they left off
  await contextB.close();
});

test("referral link pre-fills its delegate through the whole funnel", async ({ page }) => {
  const { code, fullName } = await getSeededReferral();
  const phone = journeyPhone(JOURNEY.referral);
  await page.goto(`/join?ref=${encodeURIComponent(code)}`);
  await expect(page).toHaveURL(new RegExp(`/join/step-1\\?ref=`));
  await passStep1(page, { phone, firstName: "ვატესტ", lastName: "რეფერალს" });

  await expect(page).toHaveURL(/\/join\/step-2/);
  // read-only referral card instead of the picker
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText(/რეფერალური ბმულით/)).toBeVisible();
  await expect(page.getByLabel("დელეგატი")).toHaveCount(0);
  await fillStep2Basics(page, {
    personalId: journeyPersonalId(JOURNEY.referral),
    regionLabel: "აჭარა", // any region — referral binding is region-independent
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();
  await expect(page).toHaveURL(/\/join\/done/);
  await expect(page.getByTestId("chosen-delegate")).toHaveText(fullName);
});
