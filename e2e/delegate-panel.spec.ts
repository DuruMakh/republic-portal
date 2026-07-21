import { expect, test } from "@playwright/test";
import {
  approveOwnDelegate,
  cleanupJourneyUsers,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  loginAs,
  seedCompletedMember,
  seedPendingDelegate,
} from "./funnel-helpers";

test.describe.configure({ mode: "serial" });

test.beforeAll(cleanupJourneyUsers);
// Single afterAll: delete this run's users FIRST, then settle the ISR caches (the
// polling block below) — two separate afterAll hooks would run in reverse
// declaration order and poll while the 13th delegate still exists.

// This spec runs fully isolated (workers=1 + per-spec cleanupJourneyUsers), so it
// borrows two journey slots for its throwaway users — the slot NAMES carry no
// cross-spec meaning here. These are the old panelDelegate(6)/viaLink(7) slots,
// renamed membRsvp/spare in the R1 rework; the phone numbers are unchanged.
const PANEL_DELEGATE = JOURNEY.membRsvp; // slot 6
const VIA_LINK_MEMBER = JOURNEY.spare; // slot 7

test("delegate lifecycle: pending panel → approval → live link → team", async ({ browser }) => {
  const delegatePhone = journeyPhone(PANEL_DELEGATE);
  const delegateContext = await browser.newContext();
  const dPage = await delegateContext.newPage();

  // seed a pending delegate and sign in — the pending panel (replaces the funnel walk)
  const { id: delegateId } = await seedPendingDelegate({
    phone: delegatePhone,
    firstName: "ვატესტ",
    lastName: "პანელს",
    personalId: journeyPersonalId(PANEL_DELEGATE),
  });
  await loginAs(dPage, delegatePhone);
  await expect(dPage).toHaveURL(/\/delegate$/);
  await expect(dPage.getByText("განხილვის პროცესში").first()).toBeVisible();
  await expect(dPage.getByText("რეფერალური ბმული ჯერ დეაქტივირებულია.")).toBeVisible();
  await expect(dPage.getByTestId("referral-url")).toHaveCount(0);

  // approve OUR OWN e2e delegate via service role (seed untouched; teardown deletes)
  await approveOwnDelegate(delegatePhone);
  await dPage.reload();
  await expect(dPage.getByText("დამტკიცებული").first()).toBeVisible();
  const url = (await dPage.getByTestId("referral-url").innerText()).trim();
  expect(url).toMatch(/\/join\?ref=/);
  await expect(dPage.getByRole("img", { name: "რეფერალური ბმულის QR კოდი" })).toBeVisible();

  // a member joins the delegate's team (seed bound to the delegate; the referral
  // REGISTRATION journey itself lives in the registration/membership specs)
  await seedCompletedMember({
    phone: journeyPhone(VIA_LINK_MEMBER),
    firstName: "ვატესტ",
    lastName: "ბმულით",
    personalId: journeyPersonalId(VIA_LINK_MEMBER),
    delegateId,
  });

  // the delegate's team reflects the new member instantly
  await dPage.goto("/delegate/team");
  await expect(dPage.getByTestId("team-count")).toHaveText("1");
  await expect(dPage.getByText("ვატესტ ბმულით")).toBeVisible();
  // the row pill for a profile_completed member is „წევრი" (TEAM_STATUS_LABELS); scope
  // to the table body — the header's status-filter <select> carries its own
  // „რეგისტრირებული" option, and the thead th „წევრი" sits outside the team-rows tbody.
  await expect(dPage.getByTestId("team-rows").getByText("წევრი")).toBeVisible();
  await dPage.getByLabel("ძებნა სახელით ან გვარით").fill("არავინა");
  await expect(dPage.getByTestId("team-no-results")).toBeVisible();
  await delegateContext.close();
});

// This spec temporarily approves a 13th delegate, and /delegates + /leaderboard are
// ISR pages (revalidate 60): a Link prefetch during the approved window caches a
// 13-delegate render that public.spec (which runs later and asserts the canonical
// 12) can then read within its freshness window — the exact flake seen in CI run
// 29515512529. Leaving the world as we found it includes the ISR caches: after
// deleting this run's users, poll both pages until they render 12 again.
test.afterAll(async ({ browser }) => {
  await cleanupJourneyUsers();
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const [path, testId] of [
    ["/delegates", "delegate-card"],
    ["/leaderboard", "leader-row"],
  ] as const) {
    await expect(async () => {
      await page.goto(path);
      await expect(page.getByTestId(testId)).toHaveCount(12, { timeout: 2_000 });
    }).toPass({ timeout: 90_000, intervals: [2_000] });
  }
  await context.close();
});
