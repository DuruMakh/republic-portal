import { execPath } from "node:process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

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

type Verify = (payload: unknown) => { acceptedViews: string[] };

const verifierPath = resolve("scripts/verify-production-security-advisors.mjs");
const access = JSON.parse(
  readFileSync(resolve("scripts/production-security-view-access.json"), "utf8"),
) as { public_read: string[]; signed_in_read: string[] };
const reviewedViews = [...access.public_read, ...access.signed_in_read];
const fixtureDirectories: string[] = [];

let verify: Verify;
beforeAll(async () => {
  // Non-literal specifier: the script is plain .mjs (allowJs is off), typed by `Verify`.
  const mod = (await import(pathToFileURL(verifierPath).href)) as {
    verifyProductionSecurityAdvisors: Verify;
  };
  verify = mod.verifyProductionSecurityAdvisors;
});

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

afterEach(() => {
  for (const directory of fixtureDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("production security advisor gate", () => {
  it("accepts exactly the reviewed security-definer views", () => {
    expect(verify({ results: reviewedViews.map(advisorResult) }).acceptedViews).toEqual(
      [...reviewedViews].sort(),
    );
  });

  it("rejects a payload without a results array", () => {
    expect(() => verify({})).toThrow("Advisor payload must contain a results array.");
  });

  it("rejects a missing allowlisted view", () => {
    const results = reviewedViews.filter((name) => name !== "public_stats").map(advisorResult);
    expect(() => verify({ results })).toThrow("missing=public_stats");
  });

  it("rejects an unexpected additional view", () => {
    const results = [...reviewedViews.map(advisorResult), advisorResult("surprise_view")];
    expect(() => verify({ results })).toThrow("extra=surprise_view");
  });

  it("rejects a duplicate finding", () => {
    const results = [...reviewedViews.map(advisorResult), advisorResult("public_stats")];
    expect(() => verify({ results })).toThrow("Duplicate advisor view.");
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

    expect(() => verify({ results })).toThrow("Unexpected advisor result contract.");
  });

  it("as a CLI, fails the workflow step on unreadable input without echoing it", () => {
    const directory = mkdtempSync(join(tmpdir(), "production-security-advisor-"));
    fixtureDirectories.push(directory);
    const fixturePath = join(directory, "advisor.json");
    writeFileSync(fixturePath, '{not valid json "is owner-executed"', "utf8");

    const result = spawnSync(execPath, [verifierPath, fixturePath], { encoding: "utf8" });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain("is owner-executed");
  });
});
