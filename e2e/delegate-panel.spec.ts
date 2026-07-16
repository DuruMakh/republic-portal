import { expect, test } from "@playwright/test";
import {
  approveOwnDelegate,
  cleanupJourneyUsers,
  fillStep2Basics,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  passStep1,
} from "./funnel-helpers";

test.describe.configure({ mode: "serial" });

test.beforeAll(cleanupJourneyUsers);
// Single afterAll: delete this run's users FIRST, then settle the ISR caches (the
// polling block below) — two separate afterAll hooks would run in reverse
// declaration order and poll while the 13th delegate still exists.

test("delegate lifecycle: pending panel → approval → live link → member via link → team", async ({
  browser,
}) => {
  const delegatePhone = journeyPhone(JOURNEY.panelDelegate);
  const delegateContext = await browser.newContext();
  const dPage = await delegateContext.newPage();

  // register the delegate end-to-end
  await dPage.goto("/join/step-1?role=delegate");
  await passStep1(dPage, { phone: delegatePhone, firstName: "ვატესტ", lastName: "პანელს" });
  await expect(dPage).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(dPage, {
    personalId: journeyPersonalId(JOURNEY.panelDelegate),
    regionLabel: "კახეთი",
  });
  await dPage.getByRole("checkbox").check();
  await dPage.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(dPage).toHaveURL(/\/join\/step-3/);
  await dPage.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();
  await expect(dPage).toHaveURL(/\/join\/pending/);

  // the pending screen's returning „გადადი პანელზე“ leads into the pending panel
  await dPage.getByRole("link", { name: "გადადი პანელზე" }).click();
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

  // a member registers THROUGH the live link in a separate browser context
  const ref = new URL(url).searchParams.get("ref");
  expect(ref).toBeTruthy();
  const memberContext = await browser.newContext();
  const mPage = await memberContext.newPage();
  await mPage.goto(`/join?ref=${encodeURIComponent(ref!)}`);
  await expect(mPage).toHaveURL(/\/join\/step-1\?ref=/);
  await passStep1(mPage, {
    phone: journeyPhone(JOURNEY.viaLink),
    firstName: "ვატესტ",
    lastName: "ბმულით",
  });
  await expect(mPage).toHaveURL(/\/join\/step-2/);
  await expect(mPage.getByText("ვატესტ პანელს")).toBeVisible(); // read-only referral card
  await fillStep2Basics(mPage, {
    personalId: journeyPersonalId(JOURNEY.viaLink),
    regionLabel: "თბილისი",
  });
  await mPage.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(mPage).toHaveURL(/\/join\/step-3/);
  await mPage.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();
  await expect(mPage).toHaveURL(/\/join\/done/);
  await expect(mPage.getByTestId("chosen-delegate")).toHaveText("ვატესტ პანელს");
  await memberContext.close();

  // the delegate's team reflects the new member instantly
  await dPage.goto("/delegate/team");
  await expect(dPage.getByTestId("team-count")).toHaveText("1");
  await expect(dPage.getByText("ვატესტ ბმულით")).toBeVisible();
  // scoped to the table body: TeamTable's own status-filter <select> has an
  // <option>რეგისტრირებული</option> too (profile_completed's label), so the bare
  // getByText is a strict-mode double-match — Playwright's own error suggests
  // exactly this scoping.
  await expect(dPage.getByTestId("team-rows").getByText("რეგისტრირებული")).toBeVisible();
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
