import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

// 2026-10-08: the browser install hung on GitHub's runner and held the quality job for
// GitHub's 6-hour default before failing (run 37688049932). The install normally takes
// under a minute and a whole run 8–41 minutes, so both get a cap well above normal.
describe("CI quality job time limits", () => {
  const workflow = readRepoFile(".github/workflows/ci.yml");

  it("caps the whole quality job at 60 minutes", () => {
    // job level: indented under `quality:` and before its `steps:`
    expect(workflow).toMatch(
      /\n {2}quality:\n(?: {4}.*\n)*? {4}timeout-minutes: 60\n(?: {4}.*\n)*? {4}steps:/,
    );
  });

  it("caps the Playwright browser install at 10 minutes", () => {
    expect(workflow).toMatch(
      /- run: npx playwright install --with-deps chromium\n\s+timeout-minutes: 10\n/,
    );
  });
});
