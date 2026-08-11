import { execPath } from "node:process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

type AdvisorResult = {
  name: string;
  title: string;
  level: string;
  facing: string;
  categories: string[];
  description: string;
  detail: string;
  remediation: string;
  metadata: { name: string; schema: string; type: string };
  cacheKey: string;
};

const reviewedViews = [
  "public_delegates",
  "public_events",
  "public_news",
  "public_stats",
  "transparency_regions",
  "transparency_stats",
  "admin_admins",
  "admin_audit",
  "admin_delegate_queue",
  "admin_events",
  "admin_finance_stats",
  "admin_members",
  "admin_news",
  "admin_overview",
  "admin_payments",
  "admin_poll_options",
  "admin_polls",
  "admin_region_stats",
  "admin_settings",
  "admin_support_messages",
  "member_event_going_counts",
  "member_news",
  "member_poll_options",
  "member_polls",
  "poll_option_counts",
];

const verifierPath = resolve("scripts/verify-production-security-advisors.mjs");
const fixtureDirectories: string[] = [];

const advisorResult = (name: string): AdvisorResult => ({
  name: "security_definer_view",
  title: "Security Definer View",
  level: "ERROR",
  facing: "EXTERNAL",
  categories: ["SECURITY"],
  description: "accepted fixture",
  detail: `View public.${name} is owner-executed`,
  remediation: "https://supabase.com/docs/guides/database/database-linter",
  metadata: { name, schema: "public", type: "view" },
  cacheKey: `security_definer_view_public_${name}`,
});

const writeFixture = (contents: string) => {
  const directory = mkdtempSync(join(tmpdir(), "production-security-advisor-"));
  fixtureDirectories.push(directory);
  const path = join(directory, "advisor.json");
  writeFileSync(path, contents, "utf8");
  return path;
};

const runVerifier = (fixturePath: string) =>
  spawnSync(execPath, [verifierPath, fixturePath], { encoding: "utf8" });

const assertRejected = (result: ReturnType<typeof runVerifier>, violation: string) => {
  const output = `${result.stdout}${result.stderr}`;
  expect(result.status).not.toBe(0);
  expect(output).toContain(violation);
  expect(output).not.toContain("accepted fixture");
  expect(output).not.toContain("is owner-executed");
};

afterEach(() => {
  for (const directory of fixtureDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("production security advisor gate", () => {
  it("accepts exactly the reviewed 25 security-definer views", () => {
    const fixturePath = writeFixture(
      JSON.stringify({ results: reviewedViews.map(advisorResult) }),
    );

    const result = runVerifier(fixturePath);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Accepted 25 reviewed advisor findings.");
  });

  it("rejects malformed JSON", () => {
    const result = runVerifier(writeFixture("{not valid json"));

    assertRejected(result, "Expected property name");
  });

  it("rejects a missing allowlisted view", () => {
    const results = reviewedViews
      .filter((name) => name !== "public_stats")
      .map(advisorResult);

    const result = runVerifier(writeFixture(JSON.stringify({ results })));

    assertRejected(result, "missing=public_stats");
  });

  it("rejects an unexpected additional view", () => {
    const results = [...reviewedViews.map(advisorResult), advisorResult("surprise_view")];

    const result = runVerifier(writeFixture(JSON.stringify({ results })));

    assertRejected(result, "extra=surprise_view");
  });

  it("rejects a duplicate finding", () => {
    const results = [...reviewedViews.map(advisorResult), advisorResult("public_stats")];

    const result = runVerifier(writeFixture(JSON.stringify({ results })));

    assertRejected(result, "Duplicate advisor view.");
  });

  it.each([
    ["name", "rls_disabled"],
    ["level", "WARN"],
    ["facing", "INTERNAL"],
    ["schema", "private"],
    ["type", "table"],
  ] as const)("rejects a changed %s contract field", (field, value) => {
    const results = reviewedViews.map(advisorResult);
    const resultToMutate = results[0];
    if (!resultToMutate) throw new Error("Expected an advisor result to mutate.");

    if (field === "name") resultToMutate.name = value;
    if (field === "level") resultToMutate.level = value;
    if (field === "facing") resultToMutate.facing = value;
    if (field === "schema") resultToMutate.metadata.schema = value;
    if (field === "type") resultToMutate.metadata.type = value;

    const result = runVerifier(writeFixture(JSON.stringify({ results })));

    assertRejected(result, "Unexpected advisor result contract.");
  });
});
