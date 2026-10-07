import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");
const workflow = readRepoFile(".github/workflows/production-db.yml");

describe("production database delivery contract", () => {
  it("is manual, main-only, serialized, and pinned to the approved project", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("confirm_project_ref:");
    expect(workflow).not.toMatch(/^\s{2}push:/m);
    expect(workflow).not.toMatch(/^\s{2}pull_request:/m);
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("environment: production-db");
    expect(workflow).toContain("group: production-db-migrations");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("EXPECTED_PRODUCTION_PROJECT_ID: uorvlshbrlbdnbauxsws");
  });

  it("uses only the named environment secrets and checks both supplied refs before linking", () => {
    const secretReferences = workflow.match(/secrets\.[A-Z0-9_]+/g) ?? [];
    expect([...new Set(secretReferences)].sort()).toEqual([
      "secrets.PRODUCTION_DB_PASSWORD",
      "secrets.PRODUCTION_PROJECT_ID",
      "secrets.SUPABASE_ACCESS_TOKEN",
    ]);
    expect(workflow).toContain('test "$CONFIRM_PROJECT_REF" = "$EXPECTED_PRODUCTION_PROJECT_ID"');
    expect(workflow).toContain('test "$SUPABASE_PROJECT_ID" = "$EXPECTED_PRODUCTION_PROJECT_ID"');

    const validation = workflow.indexOf("Validate immutable target");
    const linking = workflow.indexOf("Link production project");
    expect(validation).toBeGreaterThan(-1);
    expect(linking).toBeGreaterThan(validation);
  });

  it("requires a reviewed dry-run dispatch before a separate apply dispatch", () => {
    expect(workflow).toContain("if: inputs.operation == 'dry-run'");
    expect(workflow).toContain("if: inputs.operation == 'apply'");
    expect(workflow).toContain("run-id: ${{ inputs.approved_dry_run_run_id }}");
    expect(workflow).toContain('test "$APPROVED_WORKFLOW_REF" = "$GITHUB_WORKFLOW_REF"');
    expect(workflow).toContain('test "$APPROVED_REPOSITORY" = "$GITHUB_REPOSITORY"');
    expect(workflow).toContain('test "$APPROVED_REF" = "$GITHUB_REF"');
    expect(workflow).toContain('test "$APPROVED_SHA" = "$GITHUB_SHA"');

    const dryRun = workflow.indexOf("supabase db push --linked --dry-run");
    const freshDryRun = workflow.indexOf("supabase db push --linked --dry-run", dryRun + 1);
    const evidenceComparison = workflow.indexOf(
      "cmp --silent approved-dry-run-evidence/dry-run.txt fresh-dry-run-evidence/dry-run.txt",
    );
    const apply = workflow.indexOf("run: supabase db push --linked", freshDryRun + 1);
    const schemaCheck = workflow.indexOf("scripts/production-db-schema-check.sql");
    expect(dryRun).toBeGreaterThan(-1);
    expect(freshDryRun).toBeGreaterThan(dryRun);
    expect(evidenceComparison).toBeGreaterThan(freshDryRun);
    expect(apply).toBeGreaterThan(evidenceComparison);
    expect(schemaCheck).toBeGreaterThan(apply);
    expect(workflow).not.toMatch(
      /--include-seed|config push|db reset|seed:staging|scripts\/seed-staging\.mjs/,
    );
  });

  it("accepts evidence only from the successful dry-run workflow run on this main commit", () => {
    const sourceRunCheck = workflow.indexOf("Verify approved dry-run workflow run");
    const evidenceDownload = workflow.indexOf("Download approved dry-run evidence");
    expect(sourceRunCheck).toBeGreaterThan(-1);
    expect(evidenceDownload).toBeGreaterThan(sourceRunCheck);
    expect(workflow).toContain('test "$APPROVED_RUN_ID" = "$APPROVED_DRY_RUN_RUN_ID"');
    expect(workflow).toContain('test "$APPROVED_RUN_EVENT" = "workflow_dispatch"');
    expect(workflow).toContain('test "$APPROVED_RUN_PATH" = ".github/workflows/production-db.yml"');
    expect(workflow).toContain('test "$APPROVED_RUN_REPOSITORY" = "$GITHUB_REPOSITORY"');
    expect(workflow).toContain('test "$APPROVED_RUN_HEAD_BRANCH" = "main"');
    expect(workflow).toContain('test "$APPROVED_RUN_HEAD_SHA" = "$GITHUB_SHA"');
    expect(workflow).toContain('test "$APPROVED_RUN_CONCLUSION" = "success"');
  });

  it("expects exactly the committed number of migration files in every database phase", () => {
    const committed = readdirSync(resolve(process.cwd(), "supabase/migrations")).filter((name) =>
      name.endsWith(".sql"),
    ).length;
    const expected = [...workflow.matchAll(/EXPECTED_MIGRATION_FILE_COUNT: (\d+)/g)].map((m) =>
      Number(m[1]),
    );

    expect(expected.length).toBeGreaterThan(0);
    for (const count of expected) expect(count).toBe(committed);
    expect(workflow).toContain(
      'test "$ACTUAL_MIGRATION_FILE_COUNT" = "$EXPECTED_MIGRATION_FILE_COUNT"',
    );
  });

  it("runs the post-apply security gates in dependency order and preserves their evidence", () => {
    expect(workflow).toContain("production-db-security-evidence/advisors.json");
    expect(workflow).toContain("verify-production-security-advisors.mjs");
    expect(workflow).toContain("set role anon");
    expect(workflow).toContain("set role authenticated");
    expect(workflow).toContain("42501");
    expect(workflow).toContain("permission denied for view admin_overview");

    const applyIndex = workflow.indexOf("- name: Apply migrations");
    const schemaCheckIndex = workflow.indexOf("- name: Verify schema and RLS");
    const roleProbeIndex = workflow.indexOf("- name: Run production role probes");
    const lintIndex = workflow.indexOf("- name: Lint public schema");
    const advisorCaptureIndex = workflow.indexOf("- name: Capture security advisors");
    const advisorVerifyIndex = workflow.indexOf("- name: Verify reviewed security advisor set");
    const lintStep = workflow.slice(lintIndex, advisorCaptureIndex);
    const advisorStep = workflow.slice(advisorCaptureIndex, advisorVerifyIndex);

    expect(applyIndex).toBeLessThan(schemaCheckIndex);
    expect(schemaCheckIndex).toBeLessThan(roleProbeIndex);
    expect(roleProbeIndex).toBeLessThan(lintIndex);
    expect(lintStep).toContain("--fail-on error");
    expect(lintStep).not.toContain("--fail-on none");
    expect(advisorStep).toContain("--fail-on none");
    expect(roleProbeIndex).toBeLessThan(advisorCaptureIndex);
    expect(advisorCaptureIndex).toBeLessThan(advisorVerifyIndex);
  });

  it("keeps the post-apply SQL verifier read-only and checks every reviewed client view grant", () => {
    const sql = readRepoFile("scripts/production-db-schema-check.sql");
    const executableSql = sql.replace(/--.*$/gm, "").replace(/'(?:''|[^'])*'/g, "''");
    const access = JSON.parse(readRepoFile("scripts/production-security-view-access.json")) as {
      public_read: string[];
      signed_in_read: string[];
    };

    expect(sql).toContain("relrowsecurity");
    expect(sql).toContain("production view set drifted");
    expect(sql).toContain("production view grants drifted");
    expect(sql).toContain("production view effective privileges drifted");
    expect(sql).toContain("production view column privileges drifted");
    for (const viewName of access.public_read) {
      expect(sql).toContain(`('${viewName}', 'anon', 'SELECT')`);
      expect(sql).toContain(`('${viewName}', 'authenticated', 'SELECT')`);
    }
    for (const viewName of access.signed_in_read) {
      expect(sql).toContain(`('${viewName}', 'authenticated', 'SELECT')`);
      expect(sql).not.toContain(`('${viewName}', 'anon', 'SELECT')`);
    }
    expect(executableSql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create)\b/i);
  });
});
