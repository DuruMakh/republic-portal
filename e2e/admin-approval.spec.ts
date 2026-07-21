import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getAuditRows,
  getDelegateSlug,
  getReferralCode,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  profileIdByPhone,
  serviceClient,
  signOutViaNav,
} from "./admin-helpers";
import { seedCompletedMember, seedPendingDelegate } from "./funnel-helpers";

// The canonical seed keeps 3 PENDING roster delegates in the queue, so every
// interaction is scoped to this run's applicants via verify-card-<id> testids —
// a bare .first() would land on (and MUTATE) seeded data.
const APPLICANT_A = 0; // approved straight from the pending tab (spec §7 path 1)
const SUPPORTER = 1; // joins A's team after approval
const APPLICANT_B = 4; // rejected with a note, then re-approved (spec §7 path 2)

test.describe.configure({ mode: "serial" });

// Seed the two applicants as pending delegates (replaces the retired UI funnel walk).
test.beforeAll(async () => {
  await cleanupPhase4Users([APPLICANT_A, SUPPORTER, APPLICANT_B]);
  await seedPendingDelegate({
    phone: phase4Phone(APPLICANT_A),
    firstName: "ვაჟა",
    lastName: "ფშაველა",
    personalId: phase4PersonalId(APPLICANT_A),
  });
  await seedPendingDelegate({
    phone: phase4Phone(APPLICANT_B),
    firstName: "აკაკი",
    lastName: "წერეთელი",
    personalId: phase4PersonalId(APPLICANT_B),
  });
});
test.afterAll(() => cleanupPhase4Users([APPLICANT_A, SUPPORTER, APPLICANT_B]));

test("both applicants are seeded as pending delegates", async () => {
  const db = serviceClient();
  const idA = await profileIdByPhone(db, phase4Phone(APPLICANT_A));
  const idB = await profileIdByPhone(db, phase4Phone(APPLICANT_B));
  const { data } = await db.from("delegates").select("status").in("id", [idA, idB]);
  expect((data ?? []).map((d) => d.status).sort()).toEqual(["pending", "pending"]);
});

test("verifier reveals + approves A from the pending queue — public page goes live", async ({
  page,
}) => {
  const idA = await profileIdByPhone(serviceClient(), phase4Phone(APPLICANT_A));
  await loginAs(page, ADMIN_PHONES.verifier);
  await page.goto("/admin/verify");
  const cardA = page.getByTestId(`verify-card-${idA}`);
  await expect(cardA).toBeVisible();

  // audited reveal on A's card: masked → full personal ID
  await cardA.getByRole("button", { name: "ჩვენება" }).click();
  await expect(cardA.getByText(phase4PersonalId(APPLICANT_A))).toBeVisible();

  // the primary critical path: approve straight from pending
  await cardA.getByRole("button", { name: "დადასტურება" }).click();
  // approve revalidates the route (to publish /delegates/<slug>), which unmounts the
  // card before its inline done-state can be asserted — so assert the OUTCOME instead:
  // A leaves the pending queue, and their public page is now live.
  await expect(cardA).toBeHidden({ timeout: 15_000 });
  const slugA = await getDelegateSlug(phase4Phone(APPLICANT_A));
  await page.goto(`/delegates/${slugA}`);
  await expect(page.getByRole("heading", { name: "ვაჟა ფშაველა" })).toBeVisible();

  await page.goto("/admin");
  await signOutViaNav(page);
});

test("verifier rejects B with a note, then re-approves from the rejected tab", async ({ page }) => {
  const idB = await profileIdByPhone(serviceClient(), phase4Phone(APPLICANT_B));
  await loginAs(page, ADMIN_PHONES.verifier);
  await page.goto("/admin/verify");
  const cardB = page.getByTestId(`verify-card-${idB}`);
  await expect(cardB).toBeVisible();

  await cardB.getByRole("button", { name: "უარყოფა" }).click();
  await cardB.getByLabel(/შიდა შენიშვნა/).fill("დოკუმენტები გადასამოწმებელია");
  await cardB.getByRole("button", { name: "უარყოფის დადასტურება" }).click();
  // reject revalidates the route too, unmounting the card — assert the OUTCOME: B
  // leaves the pending queue.
  await expect(cardB).toBeHidden({ timeout: 15_000 });

  // rejected tab: the stored note + the decision stamp; re-approve from there
  await page.goto("/admin/verify?tab=rejected");
  const rejectedB = page.getByTestId(`verify-card-${idB}`);
  await expect(rejectedB.getByText(/დოკუმენტები გადასამოწმებელია/)).toBeVisible();
  await expect(
    rejectedB.getByText(/უარყოფილია \d{2}\.\d{2}\.\d{4} · ვერიფიკატორი გუნდი/),
  ).toBeVisible();
  await rejectedB.getByRole("button", { name: "დადასტურება" }).click();
  // re-approve from the rejected tab — assert the OUTCOME: B leaves the rejected list.
  await expect(rejectedB).toBeHidden({ timeout: 15_000 });

  await page.goto("/admin");
  await signOutViaNav(page);
});

test("audit trail holds the reveal, approve, reject and re-approve rows", async () => {
  const db = serviceClient();
  const idA = await profileIdByPhone(db, phase4Phone(APPLICANT_A));
  const idB = await profileIdByPhone(db, phase4Phone(APPLICANT_B));
  expect(await getAuditRows("delegate.reveal_personal_id", idA)).toBeGreaterThan(0);
  expect(await getAuditRows("delegate.approve", idA)).toBe(1);
  expect(await getAuditRows("delegate.reject", idB)).toBe(1);
  expect(await getAuditRows("delegate.approve", idB)).toBe(1);
});

test("A's approved referral binds a real supporter to their team", async ({ page }) => {
  // A is approved (earlier test), so its referral code is now active…
  const refCode = await getReferralCode(phase4Phone(APPLICANT_A));
  expect(refCode).toBeTruthy();
  // …and a supporter joins A's team. The referral REGISTRATION journey itself lives in
  // the registration/membership specs; here the subject is A's post-approval team, so
  // seed the supporter bound to A and assert the binding holds.
  const idA = await profileIdByPhone(serviceClient(), phase4Phone(APPLICANT_A));
  await seedCompletedMember({
    phone: phase4Phone(SUPPORTER),
    firstName: "მხარდამჭერი",
    lastName: "პირველი",
    personalId: phase4PersonalId(SUPPORTER),
    delegateId: idA,
  });
  await loginAs(page, phase4Phone(SUPPORTER));
  // the supporter's cabinet shows the applicant as their delegate — scope to the
  // current-delegate heading, since the name also appears as a <select> option
  await page.goto("/me/delegate");
  await expect(page.getByTestId("current-delegate")).toContainText("ვაჟა ფშაველა");
});
