import { expect, test } from "@playwright/test";
import { ADMIN_PHONES, loginAs, signOutViaNav } from "./admin-helpers";
import { cleanupCommunityContent } from "./community-helpers";
import {
  cleanupJourneyUsers,
  fillMembershipProfile,
  getSeededReferral,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  passRegistration,
} from "./funnel-helpers";

const RUN = `e2e-memb-${Date.now().toString(36)}`;

// Journeys share the per-run journey phones; journey 4 also creates an event as the
// canonical editor (audit actor stays permanent) — run serially.
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupJourneyUsers();
  await cleanupCommunityContent("e2e-memb-");
});
test.afterAll(async () => {
  await cleanupCommunityContent("e2e-memb-");
  await cleanupJourneyUsers();
});

test("full upgrade: register → wizard → member with a reference code and member nav", async ({
  page,
}) => {
  const phone = journeyPhone(JOURNEY.membFull);
  await page.goto("/join");
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "წევრობას",
    personalId: journeyPersonalId(JOURNEY.membFull),
  });

  // the overview CTA opens the wizard's profile phase
  await page.getByTestId("become-member-cta").click();
  await expect(page).toHaveURL(/\/me\/membership/);
  await expect(page.getByLabel("დელეგატი")).toBeVisible(); // no referral → the picker shows
  await fillMembershipProfile(page, { regionLabel: "თბილისი" });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();

  // tier phase → complete on tier 10
  await expect(page.getByRole("heading", { name: "საწევრო შენატანი" })).toBeVisible();
  await page.getByRole("radio", { name: /10/ }).click();
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  // done phase: a GR- code and the central binding
  await expect(page.getByTestId("reference-code")).toHaveText(/^GR-[A-HJKMNP-Z2-9]{6}$/);
  await expect(page.getByTestId("chosen-delegate")).toHaveText("ცენტრალური მოძრაობა");

  // into the member cabinet — the nav now carries the member-only pages
  await page.getByRole("link", { name: "ჩემი კაბინეტი" }).click();
  await expect(page).toHaveURL(/\/me\/profile/);
  const nav = page.getByRole("navigation", { name: "კაბინეტის ნავიგაცია" });
  await expect(nav.getByRole("link", { name: "გამოკითხვები" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "გადახდები" })).toBeVisible();
  await expect(page.getByText("წევრი").first()).toBeVisible(); // membership pill
});

test("resume: a saved profile lands straight on the tier phase, fields intact", async ({ page }) => {
  const phone = journeyPhone(JOURNEY.membResume);
  await page.goto("/join");
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "გაგრძელებას",
    personalId: journeyPersonalId(JOURNEY.membResume),
  });

  // save the profile phase only, then leave the wizard
  await page.goto("/me/membership");
  await fillMembershipProfile(page, { regionLabel: "კახეთი" });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page.getByRole("heading", { name: "საწევრო შენატანი" })).toBeVisible();

  // the overview CTA now reads „continue…"
  await page.goto("/me");
  await expect(page.getByTestId("become-member-cta")).toHaveText(/გააგრძელე/);

  // reopening resumes straight on the tier phase — the saved region survived
  await page.goto("/me/membership");
  await expect(page.getByRole("heading", { name: "საწევრო შენატანი" })).toBeVisible();
  await page.getByRole("button", { name: "← პროფილის შესწორება" }).click();
  await expect(page.getByLabel("მხარე")).toHaveValue(/^[1-9]\d*$/); // real region id, not placeholder
  const selected = (await page.getByLabel("მხარე").locator("option:checked").innerText()).trim();
  expect(selected).toBe("კახეთი");
});

test("referral binding survives to completion and shows as the current delegate", async ({
  page,
}) => {
  const { code, fullName } = await getSeededReferral();
  const phone = journeyPhone(JOURNEY.regReferral);
  await page.goto(`/join?ref=${encodeURIComponent(code)}`);
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "რეფერალით",
    personalId: journeyPersonalId(JOURNEY.regReferral),
  });

  // complete the wizard — the referral card replaces the picker; binding is region-independent
  await page.goto("/me/membership");
  await expect(page.getByText(fullName)).toBeVisible();
  await fillMembershipProfile(page, { regionLabel: "აჭარა" });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();
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
  await page.goto("/join");
  await passRegistration(page, {
    phone,
    firstName: "ვატესტ",
    lastName: "დასწრებას",
    personalId: journeyPersonalId(JOURNEY.membRsvp),
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
