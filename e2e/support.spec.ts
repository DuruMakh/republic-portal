// The public contact page (spec docs/superpowers/specs/2026-08-02-support-page-design.md).
// Copy is imported rather than retyped -- the same discipline the rest of the
// repo uses for Georgian, and it means a copy change cannot silently desync
// this suite from the page.
import { expect, test } from "@playwright/test";
import {
  SUPPORT_FOOTER_LABEL,
  SUPPORT_HEADING,
  SUPPORT_NEED_CONTACT,
  SUPPORT_SUBMIT_LABEL,
  SUPPORT_SUCCESS,
} from "../lib/support-copy";

// Georgian fixture spliced from lib/admin-schemas.test.ts:127, never retyped.
const NAME = "ნინო";
const MESSAGE = "ა".repeat(20);

test.describe("support", () => {
  test("a visitor reaches the page from the footer and sends a message", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: SUPPORT_FOOTER_LABEL })
      .click();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.getByRole("heading", { name: SUPPORT_HEADING })).toBeVisible();

    await page.getByLabel(/სახელი/).fill(NAME);
    await page.getByLabel(/ტელეფონი/).fill("+995555123456");
    await page.getByLabel(/შეტყობინება/).fill(MESSAGE);
    await page.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }).click();

    // Needs the migration applied. Until the owner pushes it, the row cannot be
    // written and this assertion is the one that will say so.
    await expect(page.getByText(SUPPORT_SUCCESS)).toBeVisible();
  });

  test("the form refuses a message with no way to reply", async ({ page }) => {
    await page.goto("/support");
    await page.getByLabel(/სახელი/).fill(NAME);
    await page.getByLabel(/შეტყობინება/).fill(MESSAGE);
    await page.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }).click();

    await expect(page.getByText(SUPPORT_NEED_CONTACT)).toBeVisible();
    await expect(page.getByText(SUPPORT_SUCCESS)).toBeHidden();
  });
});
