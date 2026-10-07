import { expect, test, type Page } from "@playwright/test";
import { ADMIN_PHONES, loginAs, signOutViaNav } from "./admin-helpers";
import { runCleanups } from "./cleanup-helpers";
import { cleanupCommunityContent } from "./community-helpers";
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

const RUN = `e2e-memb-${Date.now().toString(36)}`;

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

// Journeys share the per-run journey phones; journey 4 also creates an event as the
// canonical editor (audit actor stays permanent) — run serially.
test.describe.configure({ mode: "serial" });

// runCleanups, not sequential awaits: a throw from one cleanup must not skip the
// other, or a content failure strands this run's users where no later run looks.
const googleJourneyPhones = [
  JOURNEY.membFull,
  JOURNEY.membResume,
  JOURNEY.regReferral,
  JOURNEY.membRsvp,
  JOURNEY.membDupId,
].map(journeyPhone);

test.beforeAll(() =>
  runCleanups([
    () => cleanupJourneyUsers(),
    () => cleanupGoogleBackedTestUsers(googleJourneyPhones),
    () => cleanupCommunityContent("e2e-memb-"),
  ]),
);
test.afterAll(() =>
  runCleanups([
    () => cleanupCommunityContent("e2e-memb-"),
    () => cleanupJourneyUsers(),
    () => cleanupGoogleBackedTestUsers(googleJourneyPhones),
  ]),
);

test("full upgrade: register → wizard → application sent and member nav", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.membFull);
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "წევრობას",
  });

  // the overview CTA opens the wizard's profile phase
  await page.getByTestId("become-member-cta").click();
  await expect(page).toHaveURL(/\/me\/membership/);
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
  await expect(nav.getByRole("link", { name: "გადახდები" })).toBeVisible();
  // membership pill — exact text, pinned to the Pill's <span>: TEAM_STATUS_LABELS.
  // profile_completed in lib/cabinet.ts, „წევრი (გადახდის გარეშე)“ (owner fix #16).
  // Both guards still matter: the wrapping <p> concatenates the reference code and
  // the member-since text after the Pill's own label, so a non-exact match would
  // also hit the <p>; and the member-since span is itself a <span>, so pinning to
  // <span> alone isn't enough either — only the Pill satisfies both.
  const memberPill = page
    .locator("main")
    .getByText("წევრი (გადახდის გარეშე)", { exact: true })
    .and(page.locator("span"));
  await expect(memberPill).toHaveCount(1);
  await expect(memberPill).toBeVisible();
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
  await page.goto("/me/membership");
  await expect(page.getByText(fullName)).toBeVisible();
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

test("a registered member RSVPs to a published event", async ({ page }) => {
  // editor publishes a future event (canonical admin — audit actor stays permanent)
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/events/new");
  await page.getByLabel("დასახელება").fill(`შეხვედრა ${RUN}`);
  await page.getByLabel("ადგილმდებარეობა").fill("თბილისი");
  const in7d = new Date(Date.now() + 7 * 86_400_000);
  await page.getByLabel("დაწყება").fill(`${in7d.toISOString().slice(0, 10)}T19:00`);
  await page.getByLabel("აღწერა").fill("დღის წესრიგი.");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/events\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "გამოქვეყნება" }).click();
  await expect(page.getByText("გამოქვეყნებული")).toBeVisible();
  await signOutViaNav(page);

  // a REGISTERED (not member) user RSVPs — the gate is registered-level (spec §4.2, D3)
  const phone = journeyPhone(JOURNEY.membRsvp);
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "დასწრებას",
  });
  await page.goto("/me/events");
  const eventCard = page.locator("section", { hasText: `შეხვედრა ${RUN}` });
  await eventCard.getByRole("button", { name: "მოვალ" }).click();
  await expect(eventCard.getByText("✓ შენ მოდიხარ")).toBeVisible();
  await expect(eventCard.getByText(/სულ მოდის 1 მონაწილე/)).toBeVisible();

  // state + count survive a reload
  await page.reload();
  await expect(eventCard.getByText("✓ შენ მოდიხარ")).toBeVisible();
  await expect(eventCard.getByText(/სულ მოდის 1 მონაწილე/)).toBeVisible();
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
