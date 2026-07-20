import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  signOutViaNav,
} from "./admin-helpers";
import { fillStep2Basics, passStep1 } from "./funnel-helpers";

// k=3 is reserved for this spec (spec §7 isolation) — phase4Phone(3) ends in 8, a
// slot no other admin spec touches (admin-approval uses 0/1/4, admin-payments uses
// 2). CIVILIAN only ever runs the ordinary member funnel and is NEVER granted an
// admin role. The four canonical seed admins (ADMIN_PHONES) are actors here only to
// authenticate — this smoke is read/navigation only, no audited mutations.
const CIVILIAN = 3; // phase4Phone(3) — ordinary member for the bounce check

test.describe.configure({ mode: "serial" });
test.beforeAll(() => cleanupPhase4Users([CIVILIAN]));
test.afterAll(() => cleanupPhase4Users([CIVILIAN]));

test("verifier is blocked from finance surfaces server-side, not just hidden tabs", async ({
  page,
}) => {
  await loginAs(page, ADMIN_PHONES.verifier);
  await page.goto("/admin");

  // Scoped to AdminNav itself: the overview page also renders a "გადადი
  // ვერიფიკაციაზე →" button for this same role (lib/admin.ts hasAnyRole check), and
  // "ვერიფიკაცია" is a substring of "ვერიფიკაციაზე" — Playwright's default substring
  // name matching would otherwise resolve two elements and throw a strict-mode error.
  const nav = page.getByRole("navigation", { name: "ადმინისტრირების ნავიგაცია" });
  await expect(nav.getByRole("link", { name: "ვერიფიკაცია" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "ფინანსები" })).not.toBeVisible();

  await page.goto("/admin/finances");
  await expect(page).toHaveURL(/\/admin$/); // server redirect, not a rendered page
  await page.goto("/admin/admins");
  await expect(page).toHaveURL(/\/admin$/);
  await signOutViaNav(page);
});

test("editor-only admin lands on the content hub with no staff tabs", async ({ page }) => {
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/content\/news$/); // editor lands on the hub
  await expect(page.getByRole("heading", { name: "სიახლეები" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "ადმინისტრირების ნავიგაცია" });
  await expect(nav.getByRole("link", { name: "წევრები" })).not.toBeVisible();
  await signOutViaNav(page);
});

test("an ordinary member is bounced from /admin to their cabinet", async ({ page }) => {
  // Mirrors e2e/funnel.spec.ts's member journey (role choice → step 1 → step 2 →
  // step 3) with this run's own identity. CIVILIAN completes registration as an
  // ordinary member — admin_roles stays empty — so the layout gate (roles.length
  // === 0) sends it through deriveDestination(), landing on its own cabinet.
  const phone = phase4Phone(CIVILIAN);
  await page.goto("/join");
  await page.getByRole("main").getByRole("link", { name: "გახდი წევრი" }).click();
  await expect(page).toHaveURL(/\/join\/step-1\?role=member/);
  await passStep1(page, { phone, firstName: "რიგითი", lastName: "წევრი" });

  await expect(page).toHaveURL(/\/join\/step-2/);
  await fillStep2Basics(page, {
    personalId: phase4PersonalId(CIVILIAN),
    regionLabel: "თბილისი",
  });
  await expect(page.getByLabel("დელეგატი")).toHaveValue("central");
  await page.getByRole("button", { name: "გაგრძელება →" }).click();

  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("radio", { name: /20/ }).click();
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();

  await expect(page).toHaveURL(/\/join\/done/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/me\/profile$/);
});

test("anonymous visitors land on /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});
