import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getAuditRows,
  getReferenceCode,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  profileIdByPhone,
  serviceClient,
} from "./admin-helpers";
import { seedCompletedMember } from "./funnel-helpers";

const PAYER = 2; // phase4Phone(2) — fresh member, ცენტრალური მოძრაობა, tier 10

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await cleanupPhase4Users([PAYER]);
  // The subject here is payment recording against a fresh member — seed the member
  // directly (its GR-code drives the finance search below) instead of walking the
  // wizard, whose journey lives in the membership spec.
  await seedCompletedMember({
    phone: phase4Phone(PAYER),
    firstName: "გადამხდელი",
    lastName: "პირველი",
    personalId: phase4PersonalId(PAYER),
  });
});
test.afterAll(() => cleanupPhase4Users([PAYER]));

// One finance session records, bulk-records and voids. How each pasted line is
// classified is lib/bank-parse's job (unit-tested); this journey proves the server
// writes exactly the valid rows and that a void really voids.
test("finance records a payment, confirms a bulk paste and voids a payment", async ({ page }) => {
  const db = serviceClient();
  const code = await getReferenceCode(phase4Phone(PAYER));
  const payerId = await profileIdByPhone(db, phase4Phone(PAYER));
  const payments = async () => {
    const { data, error } = await db
      .from("payments")
      .select("id, voided_at, void_reason")
      .eq("member_id", payerId);
    if (error) throw new Error(`payments read failed: ${error.message}`);
    return data ?? [];
  };
  const memberStatus = async () => {
    const { data, error } = await db.from("profiles").select("status").eq("id", payerId).single();
    if (error) throw new Error(`profile read failed: ${error.message}`);
    return data.status as string;
  };

  await loginAs(page, ADMIN_PHONES.finance);

  await test.step("a single payment by GR-code — the member turns active", async () => {
    await page.goto("/admin/finances");
    await page.getByLabel(/წევრის ძებნა/).fill(code);
    await page.getByRole("button", { name: "ძებნა" }).click();
    await page.getByRole("button", { name: /გადამხდელი პირველი/ }).click();
    await page.getByLabel(/თანხა/).fill("10");
    await expect(page.getByText("→ 1 თვე")).toBeVisible();
    await page.getByRole("button", { name: "აღრიცხვა" }).click();
    await expect(page.getByText(/აღირიცხა — 1 თვე · წევრი ახლა აქტიურია/)).toBeVisible();
    expect(await payments()).toHaveLength(1);

    // the member list shows a paying member plainly as a member (no active tier, ADR-037).
    // Scoped by this member's own unique GR-code — never positional (spec §7 isolation rule).
    await page.goto(`/admin/members?search=${code}`);
    const body = page.getByTestId("admin-members-body");
    await expect(body.getByText("წევრი", { exact: true })).toBeVisible();
    await expect(body.getByText("აქტიური")).toHaveCount(0);
  });

  await test.step("a bulk paste records exactly the two valid lines", async () => {
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
    await expect(page.getByText(/ჩაიწერება: 2/)).toBeVisible();

    await page.getByRole("button", { name: /დადასტურება \(2\)/ }).click();
    await expect(page.getByText(/აღირიცხა 2 გადახდა/)).toBeVisible();
    expect(await payments()).toHaveLength(3);
  });

  await test.step("a void marks one row voided, keeps the other two live, demotes nothing", async () => {
    const statusBefore = await memberStatus();
    await page.goto("/admin/finances");
    const txBody = page.getByTestId("admin-tx-body");
    await expect(txBody.getByText("გადამხდელი პირველი").first()).toBeVisible();

    // admin-tx-body lists payments platform-wide, including seeded transaction
    // history — the void action must be scoped to one of PAYER's own rows, never a
    // bare .first() across the whole table (spec §7 isolation rule: "any admin-page
    // interaction that could hit seeded rows must be scoped").
    const payerRow = txBody.locator("tr", { hasText: "გადამხდელი პირველი" }).first();
    await payerRow.getByRole("button", { name: "გაუქმება" }).click();
    await payerRow.getByLabel(/მიზეზი/).fill("სატესტო გაუქმება");
    await payerRow.getByRole("button", { name: "გაუქმების დადასტურება" }).click();
    await expect(payerRow.getByText("გაუქმებული")).toBeVisible({ timeout: 15_000 });

    // DB truth: exactly one of the three is voided, with the reason, and audited
    const rows = await payments();
    const voided = rows.filter((p) => p.voided_at !== null);
    expect(voided).toHaveLength(1);
    expect(voided[0]!.void_reason).toBe("სატესტო გაუქმება");
    expect(rows.filter((p) => p.voided_at === null)).toHaveLength(2);
    expect(await getAuditRows("payment.void", String(voided[0]!.id))).toBe(1);
    // two live payments still cover the member, so the void demotes nothing
    expect(await memberStatus()).toBe(statusBefore);
  });
});
