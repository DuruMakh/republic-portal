import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getAuditRows,
  loginAs as adminLoginAs,
  phase4PersonalId,
  phase4Phone,
  profileIdByPhone,
  serviceClient,
  signOutViaNav,
} from "./admin-helpers";
import { loginAs, seedCompletedMember } from "./funnel-helpers";

// phase4Phone's single-digit domain (0-9 — the format is ^5\d{8}$, so k must stay one
// digit) is already claimed one-owner-per-file: admin-approval (0/1/4), admin-payments
// (2), admin-rbac (3), community-news (5), community-events (6/7), community-polls
// (8/9) — grep confirmed zero slots are free. Reusing 5/6 here is safe by the suite's
// own design: playwright.config.ts pins workers:1 with "spec files must never
// overlap", every phase4Phone owner's beforeAll/afterAll self-heals by phone LOOKUP
// (not by which file created the row), and alphabetical file scheduling runs this spec
// after both community-news.spec.ts and community-events.spec.ts, so their rows are
// already gone by the time our own beforeAll runs regardless.
const REQUESTER = 5; // approved end-to-end
const REJECTEE = 6; // rejected, stays final

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupPhase4Users([REQUESTER, REJECTEE]);
  await seedCompletedMember({
    phone: phase4Phone(REQUESTER),
    firstName: "დელეგატობის",
    lastName: "მსურველი",
    personalId: phase4PersonalId(REQUESTER),
  });
  await seedCompletedMember({
    phone: phase4Phone(REJECTEE),
    firstName: "უარყოფილი",
    lastName: "კანდიდატი",
    personalId: phase4PersonalId(REJECTEE),
  });
});
test.afterAll(async () => {
  await cleanupPhase4Users([REQUESTER, REJECTEE]);
});

test("member requests delegacy -> pending card, member life intact", async ({ page }) => {
  await loginAs(page, phase4Phone(REQUESTER));
  // the profile card advertises the ladder
  await page.goto("/me/profile");
  await page.getByRole("link", { name: "გაიგე მეტი →" }).click();
  await expect(page).toHaveURL(/\/me\/delegacy/);
  await page.getByRole("button", { name: "მოთხოვნის გაგზავნა" }).click();
  await expect(page.getByText("მოთხოვნა გაგზავნილია")).toBeVisible();
  // member life untouched: member nav still carries polls + billing
  const nav = page.getByRole("navigation", { name: "კაბინეტის ნავიგაცია" });
  await expect(nav.getByRole("link", { name: "გამოკითხვები" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "გადახდები" })).toBeVisible();
  await signOutViaNav(page);
});

test("verifier approves -> delegate cabinet + public page live + membership closed", async ({
  page,
}) => {
  const db = serviceClient();
  const requesterId = await profileIdByPhone(db, phase4Phone(REQUESTER));
  await adminLoginAs(page, ADMIN_PHONES.verifier);
  await page.goto("/admin/verify");
  const card = page.getByTestId(`verify-card-${requesterId}`);
  await expect(card).toBeVisible();
  // drive the approve control inside the card (admin-approval.spec's exact locator)
  await card.getByRole("button", { name: "დადასტურება" }).click();
  // approve revalidates the route (to publish /delegates/<slug>), which unmounts the
  // card before its inline done-state can be asserted — assert the OUTCOME instead,
  // exactly as admin-approval.spec does: the card leaves the pending queue.
  await expect(card).toHaveCount(0, { timeout: 15_000 });
  expect(await getAuditRows("delegate.approve", requesterId)).toBeGreaterThan(0);
  await signOutViaNav(page);

  // approval closed the requester's own membership (spec §3.1 rider)
  const { data: open } = await db
    .from("memberships")
    .select("id")
    .eq("member_id", requesterId)
    .is("ended_at", null);
  expect(open ?? []).toHaveLength(0);

  // the new delegate lands in the delegate cabinet; public page live
  await loginAs(page, phase4Phone(REQUESTER));
  await expect(page).toHaveURL(/\/delegate(\/|\?|#|$)/);
  const { data: dRow } = await db.from("delegates").select("slug").eq("id", requesterId).single();
  const res = await page.goto(`/delegates/${dRow!.slug as string}`);
  expect(res!.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "დელეგატობის მსურველი" })).toBeVisible();
  // the public page has no CabinetNav/AdminNav — back to an authenticated page first
  // (admin-approval.spec's exact idiom: `goto("/admin")` before its own signOutViaNav)
  await page.goto("/delegate");
  await signOutViaNav(page);
});

test("rejection is a calm final state", async ({ page }) => {
  const db = serviceClient();
  const rejecteeId = await profileIdByPhone(db, phase4Phone(REJECTEE));
  await loginAs(page, phase4Phone(REJECTEE));
  await page.goto("/me/delegacy");
  await page.getByRole("button", { name: "მოთხოვნის გაგზავნა" }).click();
  await expect(page.getByText("მოთხოვნა გაგზავნილია")).toBeVisible();
  await signOutViaNav(page);

  await adminLoginAs(page, ADMIN_PHONES.verifier);
  await page.goto("/admin/verify");
  const card = page.getByTestId(`verify-card-${rejecteeId}`);
  await card.getByRole("button", { name: "უარყოფა" }).click();
  // rejection needs the note flow — admin-approval.spec's exact reject steps
  await card.getByLabel(/შიდა შენიშვნა/).fill("დოკუმენტები გადასამოწმებელია");
  await card.getByRole("button", { name: "უარყოფის დადასტურება" }).click();
  // reject revalidates the route too, unmounting the card — assert the OUTCOME: the
  // card leaves the pending queue.
  await expect(card).toHaveCount(0, { timeout: 15_000 });
  await signOutViaNav(page);

  await loginAs(page, phase4Phone(REJECTEE));
  await expect(page).toHaveURL(/\/me\/profile/); // NOT /delegate
  await page.goto("/me/delegacy");
  await expect(page.getByText("მოთხოვნა არ დამტკიცდა")).toBeVisible();
  await expect(page.getByRole("button", { name: "მოთხოვნის გაგზავნა" })).toHaveCount(0);
  await signOutViaNav(page);
});
