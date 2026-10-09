// Preview test sign-in (spec 2026-10-08 simpler dev structure 4.3): CI builds as a preview on
// the throwaway local stack, so the panel is on /login and every persona must land where the
// owner expects. "New visitor" creates a made-up account; it goes away with the stack.
import { expect, test } from "@playwright/test";

const PANEL = "სატესტო შესვლა";

const LANDINGS = [
  ["ადმინი", /\/admin(\/|\?|$)/],
  ["დელეგატი", /\/(me|delegate)(\/|\?|$)/],
  ["წევრი", /\/me(\/|\?|$)/],
  ["ახალი მომხმარებელი", /\/join(\/|\?|$)/],
] as const;

for (const [label, landing] of LANDINGS) {
  test(`preview test sign-in: ${label}`, async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: PANEL })).toBeVisible();

    await page.getByRole("button", { name: label, exact: true }).click();

    await expect(page).toHaveURL(landing, { timeout: 20_000 });
    // left /login signed in: the panel is gone, and no test sign-in error was raised
    await expect(page.getByRole("heading", { name: PANEL })).toHaveCount(0);
    expect(page.url()).not.toContain("error=test_sign_in");
  });
}
