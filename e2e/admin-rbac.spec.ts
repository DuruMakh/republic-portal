import { expect, test } from "@playwright/test";
import { ADMIN_PHONES, loginAs } from "./admin-helpers";

// The four canonical seed admins (ADMIN_PHONES) are actors here only to authenticate —
// this smoke is read/navigation only, no audited mutations. One sign-in per role. The
// ordinary-member bounce from /admin lives in cabinet.spec's member session.

test("verifier sees the overview but is blocked from finance surfaces server-side", async ({
  page,
}) => {
  await loginAs(page, ADMIN_PHONES.verifier);
  await page.goto("/admin");

  // R2 (spec §5): admin_overview grew the registered-total + conversion figures; any
  // staff role (the verifier included) gets the overview cards.
  await expect(page.getByText("მხარდამჭერი", { exact: true })).toBeVisible();
  await expect(page.getByText("კონვერსია")).toBeVisible();

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
});

test("editor-only admin lands on the content hub; a missing admin page keeps the admin chrome", async ({
  page,
}) => {
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/content\/news$/); // editor lands on the hub
  await expect(page.getByRole("heading", { name: "სიახლეები" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "ადმინისტრირების ნავიგაცია" });
  await expect(nav.getByRole("link", { name: "წევრები" })).not.toBeVisible();

  // an absent but well-formed id: the editor's lookup finds no row and raises not-found
  const response = await page.goto("/admin/content/news/00000000-0000-4000-8000-000000000000");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "გვერდი ვერ მოიძებნა." })).toBeVisible();
  // the admin layout's own header only: the public header and footer would nest a second one
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
});

test("anonymous visitors land on /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});
