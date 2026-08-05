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
import { runCleanups } from "./cleanup-helpers";

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
  const delegateContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const dPage = await delegateContext.newPage();

  // seed a pending delegate and sign in — R2 routes a non-approved delegacy through
  // the member cabinet instead (spec §3.1): the (delegate) layout now gates on
  // isApprovedDelegate only, so a pending requester lands on /me/profile, not here.
  const { id: delegateId } = await seedPendingDelegate({
    phone: delegatePhone,
    firstName: "ვატესტ",
    lastName: "პანელს",
    personalId: journeyPersonalId(PANEL_DELEGATE),
  });
  await loginAs(dPage, delegatePhone);
  await expect(dPage).toHaveURL(/\/me\/profile$/);
  await expect(dPage.getByText("დელეგატობის მოთხოვნა გაგზავნილია")).toBeVisible();

  // approve OUR OWN e2e delegate via service role (seed untouched; teardown deletes) —
  // isApprovedDelegate flips true, so /delegate itself is reachable now
  await approveOwnDelegate(delegatePhone);
  await dPage.goto("/delegate");
  const mobileNav = dPage.locator("div.sticky.bottom-0 nav");
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link")).toHaveCount(4);
  await expect(mobileNav.locator('a[href="/delegate"]')).toHaveAttribute("aria-current", "page");
  await expect(mobileNav.getByRole("button", { name: "მეტი" })).toBeVisible();
  await expect(dPage.locator("div.sticky.bottom-0")).toHaveCount(1);
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
  await expect(mobileNav.locator('a[href="/delegate"]')).toHaveAttribute("aria-current", "page");
  await expect(dPage.getByTestId("team-count")).toHaveText("1");
  await expect(dPage.getByText("ვატესტ ბმულით")).toBeVisible();
  // the row pill for a profile_completed member is „წევრი (გადახდის გარეშე)“
  // (TEAM_STATUS_LABELS, owner fix #16); scope to the table body — the header's
  // status-filter <select> carries the very same option text, and the thead th
  // „წევრი“ also sits outside the team-rows tbody, so an unscoped
  // query would be ambiguous.
  await expect(dPage.getByTestId("team-rows").getByText("წევრი (გადახდის გარეშე)")).toBeVisible();
  await dPage.getByLabel("ძებნა სახელით ან გვარით").fill("არავინა");
  await expect(dPage.getByTestId("team-no-results")).toBeVisible();
  await dPage.setViewportSize({ width: 1280, height: 900 });
  await expect(mobileNav).toBeHidden();
  await expect(
    dPage.getByRole("navigation", { name: "კაბინეტის ნავიგაცია" }).locator('a[href="/delegate"]'),
  ).toBeVisible();
  await delegateContext.close();
});

// This spec temporarily approves an extra delegate, and /leaderboard is an ISR page
// (revalidate 60): a Link prefetch during the approved window can cache a render that
// still includes this test's delegate, which a later spec could then read within its
// freshness window — the flake seen in CI run 29515512529. Leaving the world as we
// found it includes the ISR cache: after deleting this run's users, poll the page until
// THIS delegate's own name is gone. Staging is shared with real users (the owner's own
// permanently-approved delegate account among them), so the total delegate count is
// never a fixed number to poll back to — this delegate's name is the only signal
// that's ours to check.
// runCleanups so a deletion failure still lets the cache settle: skipping the poll
// re-arms the very flake this hook exists to prevent, and closing the context in
// `finally` keeps a browser context from leaking when either step throws.
test.afterAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await runCleanups([
      () => cleanupJourneyUsers(),
      async () => {
        await expect(async () => {
          await page.goto("/leaderboard");
          await expect(page.getByTestId("leader-row").getByText("ვატესტ პანელს")).toHaveCount(0, {
            timeout: 2_000,
          });
        }).toPass({ timeout: 90_000, intervals: [2_000] });
      },
    ]);
  } finally {
    await context.close();
  }
});
