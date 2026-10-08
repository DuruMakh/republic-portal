import { expect, test, type Page } from "@playwright/test";
import { runCleanups } from "./cleanup-helpers";
import { EVENTS_SHOWN } from "./events-switch";
import {
  cleanupGoogleBackedTestUsers,
  cleanupJourneyUsers,
  fillMembershipProfile,
  getSeededReferral,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  passRegistration,
  seedCompletedMember,
} from "./funnel-helpers";

// the application step sends only once both consents are ticked (ADR-036)
async function agreeAndSend(page: Page) {
  await page
    .getByRole("checkbox", {
      name: "თანახმა ვარ, ჩემი პირადი მონაცემები დამუშავდეს წევრობის გასაფორმებლად",
    })
    .check();
  await page.getByRole("checkbox", { name: /ვიხდიდე ყოველთვიურ საწევროს — 10 ₾ თვეში$/ }).check();
  await page.getByRole("button", { name: "განაცხადის გაგზავნა" }).click();
}

// Journeys share the per-run journey phones -- run serially. (The registration-only
// checks that used to live in registration.spec are folded into journeys 1 and 3.)
test.describe.configure({ mode: "serial" });

// runCleanups, not sequential awaits: a throw from one cleanup must not skip the
// other, or a content failure strands this run's users where no later run looks.
const googleJourneyPhones = [
  JOURNEY.membFull,
  JOURNEY.membResume,
  JOURNEY.regReferral,
  JOURNEY.membDupId,
].map(journeyPhone);

test.beforeAll(() =>
  runCleanups([
    () => cleanupJourneyUsers(),
    () => cleanupGoogleBackedTestUsers(googleJourneyPhones),
  ]),
);
test.afterAll(() =>
  runCleanups([
    () => cleanupJourneyUsers(),
    () => cleanupGoogleBackedTestUsers(googleJourneyPhones),
  ]),
);

test("full upgrade: register → wizard → application sent and member nav", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.membFull);
  const firstName = "ვატესტ";
  await passRegistration(page, {
    phone,
    firstName,
    lastName: "წევრობას",
  });

  // registered overview greets them by name
  await expect(page.getByRole("heading", { name: `გამარჯობა, ${firstName}!` })).toBeVisible();

  // nav is exactly the registered set — no member-only pages
  const registeredNav = page.getByRole("navigation", { name: "კაბინეტის ნავიგაცია" });
  // ADR-042: no events tab while SHOW_EVENTS is off.
  const registeredLabels = [
    "მთავარი",
    ...(EVENTS_SHOWN ? ["ღონისძიებები"] : []),
    "სიახლეები",
    "პროფილი",
  ];
  for (const label of registeredLabels) {
    await expect(registeredNav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(registeredNav.getByRole("link", { name: "ღონისძიებები" })).toHaveCount(
    EVENTS_SHOWN ? 1 : 0,
  );
  await expect(registeredNav.getByRole("link", { name: "გამოკითხვები" })).toHaveCount(0); // members-only

  // the overview CTA opens the wizard's profile phase
  await page.getByTestId("become-member-cta").click();
  await expect(page).toHaveURL(/\/me\/membership/);
  // The in-progress wizard keeps the established desktop Masthead.
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("banner")).toHaveCSS("position", "static");
  await expect(page.getByLabel("დელეგატი")).toBeVisible(); // no referral → the picker shows
  await fillMembershipProfile(page, {
    regionLabel: "თბილისი",
    personalId: journeyPersonalId(JOURNEY.membFull),
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();

  // application phase (ADR-036): the board reviews it; the dues consent names the
  // amount, so a fee regression away from 10 GEL still fails here
  await expect(page.getByRole("heading", { name: "წევრობის განაცხადი" })).toBeVisible();
  await agreeAndSend(page);

  // done phase, its own route: application sent, under review, the central binding,
  // and no bank-transfer instructions any more
  await expect(page).toHaveURL(/\/me\/membership\/done/);
  await expect(page.getByRole("heading", { name: "განაცხადი გაგზავნილია ✓" })).toBeVisible();
  await expect(page.getByText("განხილვის პროცესში", { exact: true })).toBeVisible();
  await expect(page.getByTestId("reference-code")).toHaveCount(0);
  await expect(page.getByTestId("chosen-delegate")).toHaveText("არ მყავს დელეგატი");

  // into the member cabinet — the nav now carries the member-only pages, with NO reload:
  // completeMembershipAction revalidates the (member) layout server-side, so the router
  // cache no longer serves the stale registered-nav segment on this soft navigation
  await page.getByRole("link", { name: "ჩემი კაბინეტი" }).click();
  await expect(page).toHaveURL(/\/me\/profile/);
  const nav = page.getByRole("navigation", { name: "კაბინეტის ნავიგაცია" });
  await expect(nav.getByRole("link", { name: "გამოკითხვები" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "გადახდები" })).toHaveCount(0); // dues hidden
  // membership pill — exact text, pinned to the Pill's <span>: TEAM_STATUS_LABELS.
  // profile_completed in lib/cabinet.ts, plainly „წევრი“ (ADR-037). Both guards still
  // matter: the wrapping <p> concatenates the member-since text after the Pill's own
  // label, so a non-exact match would also hit the <p>; and the member-since span is
  // itself a <span>, so pinning to <span> alone isn't enough either.
  const memberPill = page
    .locator("main")
    .getByText("წევრი", { exact: true })
    .and(page.locator("span"));
  await expect(memberPill).toHaveCount(1);
  await expect(memberPill).toBeVisible();

  // the payments page does not exist while dues are hidden (ADR-037), for anyone
  await page.goto("/me/billing");
  await expect(page.getByText("გვერდი ვერ მოიძებნა.")).toBeVisible();
});

test("resume: a saved profile lands straight on the tier phase, fields intact", async ({
  page,
}) => {
  const phone = journeyPhone(JOURNEY.membResume);
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "გაგრძელებას",
  });

  // save the profile phase only, then leave the wizard
  await page.goto("/me/membership");
  await fillMembershipProfile(page, {
    regionLabel: "კახეთი",
    personalId: journeyPersonalId(JOURNEY.membResume),
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page.getByRole("heading", { name: "წევრობის განაცხადი" })).toBeVisible();

  // the overview CTA now reads „continue…"
  await page.goto("/me");
  await expect(page.getByTestId("become-member-cta")).toHaveText(/გააგრძელე/);

  // reopening resumes straight on the tier phase — the saved region survived
  await page.goto("/me/membership");
  await expect(page.getByRole("heading", { name: "წევრობის განაცხადი" })).toBeVisible();
  await page.getByRole("button", { name: "← მონაცემების შესწორება" }).click();
  await expect(page.getByLabel("მხარე")).toHaveValue(/^[1-9]\d*$/); // real region id, not placeholder
  const selected = (await page.getByLabel("მხარე").locator("option:checked").innerText()).trim();
  expect(selected).toBe("კახეთი");
});

test("referral binding survives to completion and shows as the current delegate", async ({
  page,
}) => {
  const { code, fullName } = await getSeededReferral();
  const phone = journeyPhone(JOURNEY.regReferral);
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "რეფერალით",
    refCode: code,
  });

  // complete the wizard — the referral card replaces the picker; binding is region-independent
  // (a read-only card, captured at registration, spec D1)
  await page.goto("/me/membership");
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText(/რეფერალური ბმულით/)).toBeVisible();
  await expect(page.getByLabel("დელეგატი")).toHaveCount(0);
  await fillMembershipProfile(page, {
    regionLabel: "აჭარა",
    personalId: journeyPersonalId(JOURNEY.regReferral),
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await agreeAndSend(page);
  await expect(page.getByTestId("chosen-delegate")).toHaveText(fullName);

  // the member cabinet shows the referral delegate as current
  await page.goto("/me/delegate");
  await expect(page.getByTestId("current-delegate")).toContainText(fullName);
});

test("a personal ID already claimed by another member is rejected inline, staying on the profile phase", async ({
  page,
}) => {
  // Review fix wave 1, finding F1: replaces registration.spec's retired duplicate-ID
  // coverage, which filled a /join field that no longer exists — the check now lives
  // in become_member_save_profile (owner fix #10), reached only from the wizard. The
  // "corrects without a second SMS" half of the old test is unit-covered (JoinForm's
  // afterVerify tests) and isn't recreated here.
  const heldId = journeyPersonalId(JOURNEY.regDupId);
  await seedCompletedMember({
    phone: journeyPhone(JOURNEY.regDupId),
    firstName: "ვატესტ",
    lastName: "დუბლიკატს",
    personalId: heldId,
  });

  const phone = journeyPhone(JOURNEY.membDupId);
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "წევრობას",
  });

  await page.goto("/me/membership");
  await fillMembershipProfile(page, {
    regionLabel: "თბილისი",
    personalId: heldId, // already claimed by the seeded member above
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();

  // the duplicate surfaces as a field error, not a form banner, and the wizard
  // stays on the profile phase — no silent advance to the tier phase
  await expect(page.getByText("ეს პირადი ნომერი უკვე რეგისტრირებულია.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "წევრის მონაცემები" })).toBeVisible();
});
