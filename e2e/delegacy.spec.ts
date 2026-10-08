import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getAuditRows,
  getDelegateSlug,
  loginAs as adminLoginAs,
  phase4PersonalId,
  phase4Phone,
  profileIdByPhone,
  serviceClient,
} from "./admin-helpers";
import { loginAs, seedCompletedMember, seedPendingDelegate } from "./funnel-helpers";

// The whole delegacy review in one journey (formerly delegacy.spec + admin-approval.spec).
// Every actor keeps its own browser context, so each signs in exactly once: the requester,
// ONE verifier session for every decision, and the rejectee. Three SMS logins in all.
//
// The canonical seed keeps 3 PENDING roster delegates in the queue, so every interaction
// is scoped to this run's applicants via verify-card-<id> testids -- a bare .first() would
// land on (and MUTATE) seeded data.
//
// phase4Phone slots 0/1/4 (admin-payments 2, community-news 5, community-events 6/7,
// community-polls 8). referral-split.spec borrows the same three: safe because files never
// overlap (workers=1) and both clean these phones before and after.
const REQUESTER = 0; // asks through the page, approved straight from the pending tab
const REJECTEE = 1; // seeded pending, rejected, stays final
const REAPPROVED = 4; // seeded pending, rejected with a note, re-approved from the rejected tab

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupPhase4Users([REQUESTER, REJECTEE, REAPPROVED]);
  await seedCompletedMember({
    phone: phase4Phone(REQUESTER),
    firstName: "დელეგატობის",
    lastName: "მსურველი",
    personalId: phase4PersonalId(REQUESTER),
  });
  await seedPendingDelegate({
    phone: phase4Phone(REJECTEE),
    firstName: "უარყოფილი",
    lastName: "კანდიდატი",
    personalId: phase4PersonalId(REJECTEE),
  });
  await seedPendingDelegate({
    phone: phase4Phone(REAPPROVED),
    firstName: "აკაკი",
    lastName: "წერეთელი",
    personalId: phase4PersonalId(REAPPROVED),
  });
});
test.afterAll(() => cleanupPhase4Users([REQUESTER, REJECTEE, REAPPROVED]));

test("request, review and both outcomes: approve, reject, re-approve", async ({ browser }) => {
  const db = serviceClient();
  const requesterId = await profileIdByPhone(db, phase4Phone(REQUESTER));
  const rejecteeId = await profileIdByPhone(db, phase4Phone(REJECTEE));
  const reapprovedId = await profileIdByPhone(db, phase4Phone(REAPPROVED));

  const requesterContext = await browser.newContext();
  const verifierContext = await browser.newContext();
  const rejecteeContext = await browser.newContext();
  try {
    const rPage = await requesterContext.newPage();
    const vPage = await verifierContext.newPage();
    const xPage = await rejecteeContext.newPage();

    await test.step("member requests delegacy -> pending card, member life intact", async () => {
      await loginAs(rPage, phase4Phone(REQUESTER));
      // the profile card advertises the ladder
      await rPage.goto("/me/profile");
      await rPage.getByRole("link", { name: "გაიგე მეტი →" }).click();
      await expect(rPage).toHaveURL(/\/me\/delegacy/);
      await rPage.getByRole("button", { name: "მოთხოვნის გაგზავნა" }).click();
      await expect(rPage.getByText("მოთხოვნა გაგზავნილია")).toBeVisible();
      // member life untouched: member nav still carries polls (and no payments while dues
      // are hidden, ADR-037)
      const nav = rPage.getByRole("navigation", { name: "კაბინეტის ნავიგაცია" });
      await expect(nav.getByRole("link", { name: "გამოკითხვები" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "გადახდები" })).toHaveCount(0);
    });

    await test.step("verifier reveals + approves the requester from the pending queue", async () => {
      await adminLoginAs(vPage, ADMIN_PHONES.verifier);
      await vPage.goto("/admin/verify");
      const card = vPage.getByTestId(`verify-card-${requesterId}`);
      await expect(card).toBeVisible();

      // audited reveal: masked -> full personal ID
      await card.getByRole("button", { name: "ჩვენება" }).click();
      await expect(card.getByText(phase4PersonalId(REQUESTER))).toBeVisible();

      await card.getByRole("button", { name: "დადასტურება" }).click();
      // approve revalidates the route (to publish /delegates/<slug>), which unmounts the
      // card before its inline done-state can be asserted -- so assert the OUTCOME instead:
      // the card leaves the pending queue.
      await expect(card).toHaveCount(0, { timeout: 15_000 });

      // the public page is live
      const slug = await getDelegateSlug(phase4Phone(REQUESTER));
      const res = await vPage.goto(`/delegates/${slug}`);
      expect(res!.status()).toBe(200);
      await expect(vPage.getByRole("heading", { name: "დელეგატობის მსურველი" })).toBeVisible();
    });

    await test.step("approval closed the membership; the requester's cabinet is now the delegate one", async () => {
      // approval closed the requester's own membership (spec §3.1 rider)
      const { data: open } = await db
        .from("memberships")
        .select("id")
        .eq("member_id", requesterId)
        .is("ended_at", null);
      expect(open ?? []).toHaveLength(0);
      // the requester's session (still open since the request) now routes to /delegate
      await rPage.goto("/me");
      await expect(rPage).toHaveURL(/\/delegate(\/|\?|#|$)/, { timeout: 15_000 });
    });

    await test.step("verifier rejects two applicants with a note, re-approves one from the rejected tab", async () => {
      await vPage.goto("/admin/verify");
      for (const id of [rejecteeId, reapprovedId]) {
        const card = vPage.getByTestId(`verify-card-${id}`);
        await expect(card).toBeVisible();
        await card.getByRole("button", { name: "უარყოფა" }).click();
        await card.getByLabel(/შიდა შენიშვნა/).fill("დოკუმენტები გადასამოწმებელია");
        await card.getByRole("button", { name: "უარყოფის დადასტურება" }).click();
        // reject revalidates the route too, unmounting the card -- assert the OUTCOME:
        // the card leaves the pending queue.
        await expect(card).toBeHidden({ timeout: 15_000 });
      }

      // rejected tab: the stored note + the decision stamp; re-approve from there
      await vPage.goto("/admin/verify?tab=rejected");
      const rejectedB = vPage.getByTestId(`verify-card-${reapprovedId}`);
      await expect(rejectedB.getByText(/დოკუმენტები გადასამოწმებელია/)).toBeVisible();
      await expect(
        rejectedB.getByText(/უარყოფილია \d{2}\.\d{2}\.\d{4} · ვერიფიკატორი გუნდი/),
      ).toBeVisible();
      await rejectedB.getByRole("button", { name: "დადასტურება" }).click();
      // re-approve from the rejected tab -- assert the OUTCOME: B leaves the rejected list.
      await expect(rejectedB).toBeHidden({ timeout: 15_000 });
      // the final rejection is still listed there
      await expect(vPage.getByTestId(`verify-card-${rejecteeId}`)).toBeVisible();
    });

    await test.step("audit trail holds the reveal, approve, reject and re-approve rows", async () => {
      expect(await getAuditRows("delegate.reveal_personal_id", requesterId)).toBeGreaterThan(0);
      expect(await getAuditRows("delegate.approve", requesterId)).toBe(1);
      expect(await getAuditRows("delegate.reject", rejecteeId)).toBe(1);
      expect(await getAuditRows("delegate.approve", rejecteeId)).toBe(0);
      expect(await getAuditRows("delegate.reject", reapprovedId)).toBe(1);
      expect(await getAuditRows("delegate.approve", reapprovedId)).toBe(1);
      const { data } = await db
        .from("delegates")
        .select("id, status")
        .in("id", [requesterId, rejecteeId, reapprovedId]);
      const status = new Map((data ?? []).map((d) => [d.id as string, d.status as string]));
      expect(status.get(requesterId)).toBe("approved");
      expect(status.get(rejecteeId)).toBe("rejected");
      expect(status.get(reapprovedId)).toBe("approved");
    });

    await test.step("rejection is a calm final state", async () => {
      await loginAs(xPage, phase4Phone(REJECTEE));
      await expect(xPage).toHaveURL(/\/me\/profile/); // NOT /delegate
      await xPage.goto("/me/delegacy");
      await expect(xPage.getByText("მოთხოვნა არ დამტკიცდა")).toBeVisible();
      await expect(xPage.getByRole("button", { name: "მოთხოვნის გაგზავნა" })).toHaveCount(0);
    });
  } finally {
    await Promise.all([requesterContext.close(), verifierContext.close(), rejecteeContext.close()]);
  }
});
