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

// Spec 2026-10-08 simpler dev structure 4.1: every run builds and tests against its own
// freshly seeded local stack, so shared staging drift can no longer fail CI.
describe("CI runs on a throwaway Supabase stack", () => {
  const workflow = readRepoFile(".github/workflows/ci.yml");

  it("never reads the staging database secrets", () => {
    expect(workflow).not.toContain("STAGING_SUPABASE");
  });

  it("starts a pinned Supabase CLI and seeds the local stack", () => {
    expect(workflow).toMatch(/uses: supabase\/setup-cli@[0-9a-f]{40} # v/);
    expect(workflow).toContain("supabase start");
    expect(workflow).toContain("scripts/seed-staging.mjs --confirm-ref local");
  });

  it("starts the stack, loads its settings, then seeds, then builds", () => {
    const at = (needle: string) => workflow.indexOf(needle);
    expect(at("supabase start")).toBeGreaterThan(-1);
    expect(at("supabase start")).toBeLessThan(at("supabase status -o env"));
    expect(at("supabase status -o env")).toBeLessThan(at("scripts/seed-staging.mjs"));
    expect(at("scripts/seed-staging.mjs")).toBeLessThan(at("- run: npm run build"));
  });

  it("fails the settings step when any of the three settings is missing", () => {
    expect(workflow).toContain("set -o pipefail");
    expect(workflow).toContain('test "$(grep -cE "$SETTINGS" "$GITHUB_ENV")" -eq 3');
  });

  it("caps the stack start at 10 minutes", () => {
    expect(workflow).toMatch(/run: supabase start[^\n]*\n\s+timeout-minutes: 10\n/);
  });
});

// 2026-10-09 simpler delivery: quick checks on every push, the slow database + browser job only
// once the work is ready, and nothing for documentation-only pull requests.
describe("CI runs in two speeds", () => {
  const workflow = readRepoFile(".github/workflows/ci.yml");
  // A job's block: from `  <name>:` to the next two-space-indented key (or the end of the file).
  const job = (name: string): string => {
    const start = workflow.indexOf(`\n  ${name}:\n`);
    expect(start, `job ${name}`).toBeGreaterThan(-1);
    const rest = workflow.slice(start + 1);
    const next = rest.slice(1).search(/\n {2}[a-z-]+:\n/);
    return next === -1 ? rest : rest.slice(0, next + 1);
  };

  it("runs the quick checks in their own job, without a database", () => {
    const checks = job("checks");
    for (const gate of ["typecheck", "lint", "format:check", "ka:scan", "test"]) {
      expect(checks).toContain(`- run: npm run ${gate}\n`);
    }
    expect(checks).not.toContain("supabase");
  });

  it("installs the browser before the unit tests (one of them drives Playwright)", () => {
    const checks = job("checks");
    expect(checks).toMatch(
      /- run: npx playwright install --with-deps chromium\n\s+timeout-minutes: 10\n/,
    );
    expect(checks.indexOf("playwright install")).toBeLessThan(
      checks.indexOf("- run: npm run test\n"),
    );
  });

  it("keeps the database, build and browser tests in the quality job only", () => {
    const quality = job("quality");
    for (const step of ["supabase start", "- run: npm run build", "- run: npm run e2e"]) {
      expect(quality).toContain(step);
    }
    for (const gate of ["typecheck", "lint", "format:check", "ka:scan"]) {
      expect(quality).not.toContain(`npm run ${gate}`);
    }
  });

  it("skips the quality job while a pull request is a draft", () => {
    expect(workflow).toMatch(
      /pull_request:\n\s+types: \[opened, synchronize, reopened, ready_for_review\]/,
    );
    expect(job("quality")).toContain(
      "if: github.event_name == 'push' || !github.event.pull_request.draft",
    );
  });

  it("skips documentation-only pull requests but always checks main", () => {
    const split = workflow.indexOf("\n  push:\n");
    expect(split).toBeGreaterThan(-1);
    const prTrigger = workflow.slice(0, split);
    const pushTrigger = workflow.slice(split, workflow.indexOf("\n\n", split));
    expect(prTrigger).toMatch(/paths-ignore:\n\s+- "docs\/\*\*"\n\s+- "\*\*\/\*\.md"/);
    expect(pushTrigger).toContain("branches: [main]");
    expect(pushTrigger).not.toContain("paths-ignore");
  });
});
