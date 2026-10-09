import { expect, test } from "@playwright/test";
import { ACCOUNT_DELETION_CONFIRM_WORD } from "../lib/account-deletion";
import {
  ACCOUNT_DELETE_BUTTON,
  ACCOUNT_DELETE_CONFIRM_LABEL,
  ACCOUNT_DELETED_TITLE,
} from "../lib/account-deletion-copy";
import { cleanupUsersByPhone, runCleanups } from "./cleanup-helpers";
import {
  cleanupGoogleBackedTestUsers,
  createGoogleBackedTestUser,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  seedCompletedMember,
} from "./funnel-helpers";
import { serviceClient } from "./otp-helpers";

// Account deletion (spec 2026-10-08-account-deletion-design.md): a completed member signs in
// the way production members do, through a Google identity, types the confirmation word on
// /me/profile and is gone: signed out, no profile, no membership, no sign-in account. One
// journey, no SMS, no Google website (ADR-043). It runs on the throwaway database like the
// rest of the suite and never reads seeded data.
const PHONE = journeyPhone(JOURNEY.accountDelete);

// The deletion removes the user itself, so the cleanups below are no-ops on a green run. They
// matter when the journey fails part-way (the identity or profile is still there) and before a
// CI retry, which runs the same phone again. Two cleanups because the identity is email-only
// and the profile carries the phone, and a failure between the two seed steps leaves only one.
const cleanup = () =>
  runCleanups([
    () => cleanupUsersByPhone("account-deletion e2e cleanup", [`+995${PHONE}`, `995${PHONE}`]),
    () => cleanupGoogleBackedTestUsers([PHONE]),
  ]);

test.beforeAll(cleanup);
test.afterAll(cleanup);

/** What the service role can still see of this person: profile, membership rows, sign-in account. */
async function footprint(userId: string) {
  const db = serviceClient();
  const profiles = await db
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("id", userId);
  if (profiles.error) throw new Error(`profile count failed: ${profiles.error.message}`);
  const memberships = await db
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("member_id", userId);
  if (memberships.error) throw new Error(`membership count failed: ${memberships.error.message}`);
  const account = await db.auth.admin.getUserById(userId);
  // an absent user is a 404 (code user_not_found) from the auth server; any other failure must
  // not read as "gone"
  const absent = account.error?.status === 404 || account.error?.code === "user_not_found";
  if (account.error && !absent) {
    throw new Error(`sign-in account lookup failed: ${account.error.message}`);
  }
  return {
    profiles: profiles.count,
    memberships: memberships.count,
    signInAccount: account.data.user !== null,
  };
}

test("a member deletes their account and their data is gone", async ({ page }) => {
  // createGoogleBackedTestUser also installs the member's browser session
  const { id } = await createGoogleBackedTestUser(page, PHONE);
  await seedCompletedMember({
    userId: id,
    phone: PHONE,
    firstName: "Account",
    lastName: "Deletion",
    personalId: journeyPersonalId(JOURNEY.accountDelete),
  });
  // the "gone" checks below prove something only if all three existed first
  expect(await footprint(id)).toEqual({ profiles: 1, memberships: 1, signInAccount: true });

  await page.goto("/me/profile");
  const word = page.getByLabel(ACCOUNT_DELETE_CONFIRM_LABEL, { exact: true });
  const remove = page.getByRole("button", { name: ACCOUNT_DELETE_BUTTON, exact: true });

  // locked until the confirmation word is typed
  await expect(remove).toBeDisabled();
  // Retried as one block: a fill that lands before the page has hydrated is dropped and would
  // leave the button locked. Clearing first makes each retry a real change for the field.
  await expect(async () => {
    await word.fill("");
    await word.fill(ACCOUNT_DELETION_CONFIRM_WORD);
    await expect(remove).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await remove.click();

  await expect(page).toHaveURL(/\/account-deleted$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: ACCOUNT_DELETED_TITLE })).toBeVisible();

  // signed out: the cabinet asks for a login again
  await page.goto("/me");
  await expect(page).toHaveURL(/\/login/);

  // and nothing of the person is left
  expect(await footprint(id)).toEqual({ profiles: 0, memberships: 0, signInAccount: false });
});
