import { execPath } from "node:process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
const viewAccessPath = resolve("scripts/production-security-view-access.json");
const migrationsDirectory = resolve("supabase/migrations");
const fixtureDirectories: string[] = [];

const relationNames = (statement: string) =>
  statement
    .replace(/^(?:revoke all|grant select) on\s+/i, "")
    .replace(/\s+(?:from|to)\s+[^;]+;$/i, "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

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
  it("declares the exact six public and nineteen signed-in client view grants", () => {
    const access = JSON.parse(readFileSync(viewAccessPath, "utf8")) as {
      public_read: string[];
      signed_in_read: string[];
    };

    expect(access).toEqual({
      public_read: [
        "public_delegates",
        "public_events",
        "public_news",
        "public_stats",
        "transparency_regions",
        "transparency_stats",
      ],
      signed_in_read: [
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
      ],
    });
  });

  it("normalizes client view grants in one forward migration", () => {
    const migrations = readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql"));
    const matchingMigrations = migrations.filter((name) =>
      name.endsWith("_normalize_production_view_grants.sql"),
    );
    const access = JSON.parse(readFileSync(viewAccessPath, "utf8")) as {
      public_read: string[];
      signed_in_read: string[];
    };

    expect(matchingMigrations).toHaveLength(1);
    expect(migrations).toHaveLength(32);
    expect(access.public_read.some((name) => access.signed_in_read.includes(name))).toBe(false);

    const migration = readFileSync(join(migrationsDirectory, matchingMigrations[0] ?? ""), "utf8");
    const revokeStatement = migration.match(
      /revoke all on\s+([\s\S]*?)\s+from public, anon, authenticated;/i,
    )?.[0];
    const publicGrantStatement = migration.match(
      /grant select on\s+([\s\S]*?)\s+to anon, authenticated;/i,
    )?.[0];
    const signedInGrantStatement = migration.match(
      /grant select on\s+(?:(?!grant select on)[\s\S])*?\s+to authenticated;/i,
    )?.[0];
    const revokeIndex = migration.indexOf(revokeStatement ?? "");
    const publicGrantIndex = migration.indexOf(publicGrantStatement ?? "");
    const signedInGrantIndex = migration.indexOf(signedInGrantStatement ?? "");
    const sqlStatements = migration
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => `${statement};`);

    expect(migration).toContain("revoke all on");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).not.toContain("security_invoker");
    expect(migration).toContain("grant select on");
    expect(migration).toContain("to anon, authenticated");
    expect(migration).toContain("to authenticated");
    expect(revokeIndex).toBeLessThan(publicGrantIndex);
    expect(revokeIndex).toBeLessThan(signedInGrantIndex);
    expect(publicGrantIndex).toBeLessThan(signedInGrantIndex);
    expect(sqlStatements).toEqual([revokeStatement, publicGrantStatement, signedInGrantStatement]);
    expect(relationNames(revokeStatement ?? "").sort()).toEqual(
      [...access.public_read, ...access.signed_in_read].sort(),
    );
    expect(relationNames(publicGrantStatement ?? "").sort()).toEqual(
      [...access.public_read].sort(),
    );
    expect(relationNames(signedInGrantStatement ?? "").sort()).toEqual(
      [...access.signed_in_read].sort(),
    );
  });

  it("accepts exactly the reviewed 25 security-definer views", () => {
    const fixturePath = writeFixture(JSON.stringify({ results: reviewedViews.map(advisorResult) }));

    const result = runVerifier(fixturePath);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Accepted 25 reviewed advisor findings.");
  });

  it("rejects malformed JSON", () => {
    const result = runVerifier(writeFixture("{not valid json"));

    assertRejected(result, "Expected property name");
  });

  it("rejects a missing allowlisted view", () => {
    const results = reviewedViews.filter((name) => name !== "public_stats").map(advisorResult);

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
