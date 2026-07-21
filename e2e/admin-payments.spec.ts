import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getReferenceCode,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  signOutViaNav,
} from "./admin-helpers";
import { seedCompletedMember } from "./funnel-helpers";

const PAYER = 2; // phase4Phone(2) — fresh member, ცენტრალური მოძრაობა, tier 10

test.describe.configure({ mode: "serial" });
test.beforeAll(() => cleanupPhase4Users([PAYER]));
test.afterAll(() => cleanupPhase4Users([PAYER]));

test("a fresh member is set up (tier 10, central)", async ({ page }) => {
  // The subject here is payment recording against a fresh member — seed the member
  // directly (its GR-code drives the finance search below) instead of walking the
  // wizard, whose journey now lives in registration/membership specs.
  await seedCompletedMember({
    phone: phase4Phone(PAYER),
    firstName: "გადამხდელი",
    lastName: "პირველი",
    personalId: phase4PersonalId(PAYER),
    tier: 10,
  });
  await loginAs(page, phase4Phone(PAYER));
  await page.goto("/me/profile");
  await expect(page.getByText("გადამხდელი პირველი")).toBeVisible();
});

test("finance records a single payment by GR-code — the member turns active", async ({ page }) => {
  const code = await getReferenceCode(phase4Phone(PAYER));
  await loginAs(page, ADMIN_PHONES.finance);
  await page.goto("/admin/finances");

  await page.getByLabel(/წევრის ძებნა/).fill(code);
  await page.getByRole("button", { name: "ძებნა" }).click();
  await page.getByRole("button", { name: /გადამხდელი პირველი/ }).click();
  await page.getByLabel(/თანხა/).fill("10");
  await expect(page.getByText("→ 1 თვე")).toBeVisible();
  await page.getByRole("button", { name: "აღრიცხვა" }).click();
  await expect(page.getByText(/აღირიცხა — 1 თვე · წევრი ახლა აქტიურია/)).toBeVisible();

  // derivation is visible platform-wide: the member list shows აქტიური. Scoped by
  // this member's own unique GR-code — never positional (spec §7 isolation rule).
  await page.goto(`/admin/members?search=${code}`);
  await expect(page.getByTestId("admin-members-body").getByText("აქტიური")).toBeVisible();
});

test("bulk paste classifies five row kinds and records exactly the two valid ones", async ({
  page,
}) => {
  const code = await getReferenceCode(phase4Phone(PAYER));
  await loginAs(page, ADMIN_PHONES.finance);
  await page.goto("/admin/finances");

  const paste = [
    `${code} 20.00`, // ok (2 months on tier 10)
    `${code} 30,00 01.07.2026`, // ok (comma decimal + explicit date)
    "GR-ZZZZZ9 10.00", // unknown code
    `${code} 20.00`, // byte-identical → duplicate line
    "გადმორიცხვა 15.00", // no code
  ].join("\n");
  await page.getByLabel(/ამონაწერის სტრიქონები/).fill(paste);
  await page.getByRole("button", { name: "გადამოწმება" }).click();

  const preview = page.getByTestId("bulk-preview-body");
  await expect(preview.getByText("ნაპოვნია")).toHaveCount(2);
  await expect(preview.getByText("უცნობი კოდი")).toBeVisible();
  await expect(preview.getByText("განმეორებული ხაზი")).toBeVisible();
  await expect(preview.getByText("კოდი ვერ მოიძებნა")).toBeVisible();
  await expect(page.getByText(/ჩაიწერება: 2/)).toBeVisible();

  await page.getByRole("button", { name: /დადასტურება \(2\)/ }).click();
  await expect(page.getByText(/აღირიცხა 2 გადახდა/)).toBeVisible();
});

test("void demotes nothing here (two live payments remain) but marks the row", async ({ page }) => {
  await loginAs(page, ADMIN_PHONES.finance);
  await page.goto("/admin/finances");
  const txBody = page.getByTestId("admin-tx-body");
  await expect(txBody.getByText("გადამხდელი პირველი").first()).toBeVisible();

  // admin-tx-body lists payments platform-wide, including seeded transaction
  // history — the void action must be scoped to one of PAYER's own rows, never a
  // bare .first() across the whole table (Task 25 precedent; spec §7 isolation
  // rule: "any admin-page interaction that could hit seeded rows must be scoped").
  const payerRow = txBody.locator("tr", { hasText: "გადამხდელი პირველი" }).first();
  await payerRow.getByRole("button", { name: "გაუქმება" }).click();
  await payerRow.getByLabel(/მიზეზი/).fill("სატესტო გაუქმება");
  await payerRow.getByRole("button", { name: "გაუქმების დადასტურება" }).click();
  await expect(payerRow.getByText("გაუქმებული")).toBeVisible({ timeout: 15_000 });
  await signOutViaNav(page);
});

test("the member's own cabinet shows the history, including the voided row", async ({ page }) => {
  await loginAs(page, phase4Phone(PAYER));
  await page.goto("/me/billing");
  await expect(page.getByText("გაუქმებული")).toBeVisible();
  await expect(page.getByText("დადასტურებული").first()).toBeVisible();
  // two live payments keep them active
  await page.goto("/me/profile");
  await expect(page.getByText("აქტიური")).toBeVisible();
});
