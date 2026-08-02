// The public contact page (spec docs/superpowers/specs/2026-08-02-support-page-design.md).
// Copy is imported rather than retyped -- the same discipline the rest of the
// repo uses for Georgian, and it means a copy change cannot silently desync
// this suite from the page.
import { expect, test } from "@playwright/test";
import { cleanupClient, failIfAny, runCleanups, SWEEP_HINT } from "./cleanup-helpers";
import {
  SUPPORT_FOOTER_LABEL,
  SUPPORT_HEADING,
  SUPPORT_NEED_CONTACT,
  SUPPORT_SUBMIT_LABEL,
  SUPPORT_SUCCESS,
} from "../lib/support-copy";

// Georgian fixture spliced from lib/admin-schemas.test.ts:127, never retyped.
const NAME = "ნინო";
// Per-run marker so teardown deletes THIS run's rows and nothing else. Without
// it the suite wrote a permanent row to shared staging on every CI run: the
// admin inbox is the owner's only view of real messages, and it pages 50 at a
// time, so unswept test rows would eventually bury genuine ones.
const RUN = `e2e-support-${Date.now().toString(36)}`;
const MESSAGE = `${"ა".repeat(20)} ${RUN}`;

/**
 * support_messages is revoked from every client role, so only the service key
 * can delete these -- the same reason the other write-path suites clean up
 * through cleanupClient rather than through the app.
 *
 * This one must FAIL rather than skip when credentials are absent, which is
 * where it parts company with cleanupClient's documented behaviour ("a run
 * without staging env never created anything to clean"). That holds for suites
 * that seed their own fixtures with the service key. It does not hold here: the
 * row is written by the APP SERVER out of its own environment, so this suite
 * creates a row whether or not the test process can see a credential. Skipping
 * quietly is exactly how the leftover rows this cleanup exists to prevent got
 * into the owner's inbox in the first place.
 */
async function cleanupSupportMessages(): Promise<void> {
  const client = cleanupClient("support cleanup");
  if (!client) {
    throw new Error(
      "support cleanup cannot run: staging service credentials are not in this process's env.\n" +
        "The app server wrote a real row regardless, so it would be stranded in the owner's inbox.\n" +
        "Run the suite with the staging env loaded, e.g. `node --env-file=.env.local node_modules/@playwright/test/cli.js test support`.",
    );
  }
  const { error } = await client.from("support_messages").delete().like("message", `%${RUN}%`);
  failIfAny("support cleanup", error ? [error.message] : [], SWEEP_HINT);
}

test.afterAll(() => runCleanups([cleanupSupportMessages]));

test.describe("support", () => {
  test("a visitor reaches the page from the footer and sends a message", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: SUPPORT_FOOTER_LABEL }).click();
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
