import { expect, test } from "@playwright/test";
import { fillStep2Basics, passStep1 } from "./funnel-helpers";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getAuditRows,
  getReferralCode,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  profileIdByPhone,
  serviceClient,
  signOutViaNav,
} from "./admin-helpers";

// The canonical seed keeps 3 PENDING roster delegates in the queue, so every
// interaction is scoped to this run's applicants via verify-card-<id> testids —
// a bare .first() would land on (and MUTATE) seeded data.
const APPLICANT_A = 0; // approved straight from the pending tab (spec §7 path 1)
const SUPPORTER = 1; // registers through A's referral link
const APPLICANT_B = 4; // rejected with a note, then re-approved (spec §7 path 2)

test.describe.configure({ mode: "serial" });
test.beforeAll(() => cleanupPhase4Users([APPLICANT_A, SUPPORTER, APPLICANT_B]));
test.afterAll(() => cleanupPhase4Users([APPLICANT_A, SUPPORTER, APPLICANT_B]));

test("two delegates apply and land in the pending queue", async ({ page }) => {
  // Applicant A — mirrors e2e/funnel.spec.ts's delegate journey (role choice via
  // ?role=delegate → step 1 → step 2 with T&C → step 3 default tier → pending).
  const phoneA = phase4Phone(APPLICANT_A);
  const firstNameA = "ვაჟა";
  const lastNameA = "ფშაველა";
  await page.goto("/join?role=delegate");
  await expect(page).toHaveURL(/\/join\/step-1\?role=delegate/);
  await passStep1(page, { phone: phoneA, firstName: firstNameA, lastName: lastNameA });

  await expect(page).toHaveURL(/\/join\/step-2/);
  await expect(page.getByText("დელეგატის რეგისტრაცია").first()).toBeVisible();
  await fillStep2Basics(page, {
    personalId: phase4PersonalId(APPLICANT_A),
    regionLabel: "თბილისი",
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "გაგრძელება →" }).click();

  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  await expect(page).toHaveURL(/\/join\/pending/);

  // A's session must not bleed into B's registration (isolation rule, spec §7).
  await page.context().clearCookies();

  // Applicant B — same journey, different identity; ends up in the same queue.
  const phoneB = phase4Phone(APPLICANT_B);
  const firstNameB = "აკაკი";
  const lastNameB = "წერეთელი";
  await page.goto("/join?role=delegate");
  await expect(page).toHaveURL(/\/join\/step-1\?role=delegate/);
  await passStep1(page, { phone: phoneB, firstName: firstNameB, lastName: lastNameB });

  await expect(page).toHaveURL(/\/join\/step-2/);
  await expect(page.getByText("დელეგატის რეგისტრაცია").first()).toBeVisible();
  await fillStep2Basics(page, {
    personalId: phase4PersonalId(APPLICANT_B),
    regionLabel: "იმერეთი",
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "გაგრძელება →" }).click();

  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  await expect(page).toHaveURL(/\/join\/pending$/);
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
  await expect(cardA.getByText(/დელეგატი დამტკიცდა/)).toBeVisible();

  // the success notice links the live public page — open it and see the applicant
  const publicHref = await cardA.getByRole("link", { name: /საჯარო გვერდი/ }).getAttribute("href");
  expect(publicHref).toMatch(/^\/delegates\/.+/);
  await page.goto(publicHref as string);
  await expect(page.getByText("ვაჟა ფშაველა")).toBeVisible();

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
  await expect(cardB.getByText("განაცხადი უარყოფილია.")).toBeVisible();

  // rejected tab: the stored note + the decision stamp; re-approve from there
  await page.goto("/admin/verify?tab=rejected");
  const rejectedB = page.getByTestId(`verify-card-${idB}`);
  await expect(rejectedB.getByText(/დოკუმენტები გადასამოწმებელია/)).toBeVisible();
  await expect(
    rejectedB.getByText(/უარყოფილია \d{2}\.\d{2}\.\d{4} · ვერიფიკატორი გუნდი/),
  ).toBeVisible();
  await rejectedB.getByRole("button", { name: "დადასტურება" }).click();
  await expect(rejectedB.getByText(/დელეგატი დამტკიცდა/)).toBeVisible();

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

test("the activated referral link registers a real supporter", async ({ page }) => {
  const refCode = await getReferralCode(phase4Phone(APPLICANT_A));
  // Referral journey — mirrors e2e/funnel.spec.ts's referral test, with A as the
  // referring delegate (already approved by the earlier test in this serial file).
  const phone = phase4Phone(SUPPORTER);
  await page.goto(`/join?ref=${encodeURIComponent(refCode)}`);
  await expect(page).toHaveURL(new RegExp(`/join/step-1\\?ref=`));
  await passStep1(page, { phone, firstName: "მხარდამჭერი", lastName: "პირველი" });

  await expect(page).toHaveURL(/\/join\/step-2/);
  // read-only referral card instead of the picker — the referring delegate is A
  await expect(page.getByText("ვაჟა ფშაველა")).toBeVisible();
  await expect(page.getByText(/რეფერალური ბმულით/)).toBeVisible();
  await expect(page.getByLabel("დელეგატი")).toHaveCount(0);
  await fillStep2Basics(page, {
    personalId: phase4PersonalId(SUPPORTER),
    regionLabel: "აჭარა", // any region — referral binding is region-independent
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();
  await expect(page).toHaveURL(/\/join\/done$/);
  // the supporter's cabinet shows the applicant as their delegate
  await page.goto("/me/delegate");
  await expect(page.getByText("ვაჟა ფშაველა")).toBeVisible();
});
