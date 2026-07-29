import { expect, test } from "@playwright/test";
import { ADMIN_PHONES, loginAs, signOutViaNav } from "./admin-helpers";
import { runCleanups } from "./cleanup-helpers";
import { cleanupCommunityContent } from "./community-helpers";
import {
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

// Journeys share the per-run journey phones; journey 4 also creates an event as the
// canonical editor (audit actor stays permanent) — run serially.
test.describe.configure({ mode: "serial" });

// runCleanups, not sequential awaits: a throw from one cleanup must not skip the
// other, or a content failure strands this run's users where no later run looks.
test.beforeAll(() =>
  runCleanups([() => cleanupJourneyUsers(), () => cleanupCommunityContent("e2e-memb-")]),
);
test.afterAll(() =>
  runCleanups([() => cleanupCommunityContent("e2e-memb-"), () => cleanupJourneyUsers()]),
);

test("full upgrade: register → wizard → member with a reference code and member nav", async ({
  page,
}) => {
  const phone = journeyPhone(JOURNEY.membFull);
  await page.goto("/join");
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

  // tier phase → confirm the fixed fee and complete (owner fix #9: no more picker)
  await expect(page.getByRole("heading", { name: "საწევრო შენატანი" })).toBeVisible();
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  // done phase, now its own route: a GR- code and the central binding
  await expect(page).toHaveURL(/\/me\/membership\/done/);
  await expect(page.getByTestId("reference-code")).toHaveText(/^GR-[A-HJKMNP-Z2-9]{6}$/);
  await expect(page.getByTestId("chosen-delegate")).toHaveText("არ მყავს დელეგატი");
  // the done screen's own pill has no label override, so it falls through to
  // Pill's own default for profile_completed — TEAM_STATUS_LABELS.profile_completed
  // in lib/cabinet.ts, „წევრი (გადახდის გარეშე)“, owner fix #16
  // (exact: pins the match to this literal label, not a substring hit elsewhere on the page)
  await expect(page.getByText("წევრი (გადახდის გარეშე)", { exact: true })).toBeVisible();

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
  await page.goto("/join");
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
  });

  // complete the wizard — the referral card replaces the picker; binding is region-independent
  await page.goto("/me/membership");
  await expect(page.getByText(fullName)).toBeVisible();
  await fillMembershipProfile(page, {
    regionLabel: "აჭარა",
    personalId: journeyPersonalId(JOURNEY.regReferral),
  });
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
  await page.goto("/join");
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
  await expect(page.getByRole("heading", { name: "იურიდიული პროფილი" })).toBeVisible();
});
