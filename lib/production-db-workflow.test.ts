import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

describe("production database delivery contract", () => {
  it("is manual, main-only, serialized, and pinned to the approved project and CLI", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("confirm_project_ref:");
    expect(workflow).not.toMatch(/^\s{2}push:/m);
    expect(workflow).not.toMatch(/^\s{2}pull_request:/m);
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("environment: production-db");
    expect(workflow).toContain("group: production-db-migrations");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("EXPECTED_PRODUCTION_PROJECT_ID: uorvlshbrlbdnbauxsws");
    expect(workflow).toContain("version: 2.109.1");
  });

  it("maps exactly the named environment secrets and checks both supplied refs before linking", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}");
    expect(workflow).toContain("SUPABASE_PROJECT_ID: ${{ secrets.PRODUCTION_PROJECT_ID }}");
    expect(workflow).toContain("SUPABASE_DB_PASSWORD: ${{ secrets.PRODUCTION_DB_PASSWORD }}");
    const secretReferences = workflow.match(/secrets\.[A-Z0-9_]+/g) ?? [];
    expect([...new Set(secretReferences)].sort()).toEqual([
      "secrets.PRODUCTION_DB_PASSWORD",
      "secrets.PRODUCTION_PROJECT_ID",
      "secrets.SUPABASE_ACCESS_TOKEN",
    ]);
    expect(secretReferences).toHaveLength(6);
    expect(workflow).toContain('test "$CONFIRM_PROJECT_REF" = "$EXPECTED_PRODUCTION_PROJECT_ID"');
    expect(workflow).toContain('test "$SUPABASE_PROJECT_ID" = "$EXPECTED_PRODUCTION_PROJECT_ID"');

    const validation = workflow.indexOf("Validate immutable target");
    const linking = workflow.indexOf("Link production project");
    expect(validation).toBeGreaterThan(-1);
    expect(linking).toBeGreaterThan(validation);
  });

  it("requires a reviewed dry-run dispatch before a separate apply dispatch", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("operation:");
    expect(workflow).toContain("- dry-run");
    expect(workflow).toContain("- apply");
    expect(workflow).toContain("approved_dry_run_run_id:");
    expect(workflow).toContain("dry_run:");
    expect(workflow).toContain("apply:");
    expect(workflow).toContain("if: inputs.operation == 'dry-run'");
    expect(workflow).toContain("if: inputs.operation == 'apply'");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain("actions/download-artifact@v5");
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
    expect(workflow.match(/supabase migration list --linked/g)).toHaveLength(3);
    expect(workflow).not.toMatch(
      /--include-seed|config push|db reset|seed:staging|scripts\/seed-staging\.mjs/,
    );
  });

  it("accepts evidence only from the successful dry-run workflow run on this main commit", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    const sourceRunCheck = workflow.indexOf("Verify approved dry-run workflow run");
    const evidenceDownload = workflow.indexOf("Download approved dry-run evidence");
    expect(sourceRunCheck).toBeGreaterThan(-1);
    expect(evidenceDownload).toBeGreaterThan(sourceRunCheck);
    expect(workflow).toContain("permissions:\n  actions: read\n  contents: read");
    expect(workflow).toContain("GH_TOKEN: ${{ github.token }}");
    expect(workflow).toContain(
      'gh api "repos/$GITHUB_REPOSITORY/actions/runs/$APPROVED_DRY_RUN_RUN_ID"',
    );
    expect(workflow).toContain("jq -r '.id'");
    expect(workflow).toContain("jq -r '.event'");
    expect(workflow).toContain("jq -r '.path'");
    expect(workflow).toContain("jq -r '.repository.full_name'");
    expect(workflow).toContain("jq -r '.head_branch'");
    expect(workflow).toContain("jq -r '.head_sha'");
    expect(workflow).toContain("jq -r '.conclusion'");
    expect(workflow).toContain('test "$APPROVED_RUN_ID" = "$APPROVED_DRY_RUN_RUN_ID"');
    expect(workflow).toContain('test "$APPROVED_RUN_EVENT" = "workflow_dispatch"');
    expect(workflow).toContain(
      'test "$APPROVED_RUN_PATH" = ".github/workflows/production-db.yml@main"',
    );
    expect(workflow).not.toContain(".github/workflows/production-db.yml@refs/heads/main");
    expect(workflow).toContain('test "$APPROVED_RUN_REPOSITORY" = "$GITHUB_REPOSITORY"');
    expect(workflow).toContain('test "$APPROVED_RUN_HEAD_BRANCH" = "main"');
    expect(workflow).toContain('test "$APPROVED_RUN_HEAD_SHA" = "$GITHUB_SHA"');
    expect(workflow).toContain('test "$APPROVED_RUN_CONCLUSION" = "success"');
  });

  it("asserts the committed 31-file migration baseline before each database phase", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("EXPECTED_MIGRATION_FILE_COUNT: 31");
    expect(workflow.match(/Migration file baseline/g)).toHaveLength(2);
    expect(workflow).toContain("find supabase/migrations -maxdepth 1 -type f -name '*.sql'");
    expect(workflow).toContain(
      'test "$ACTUAL_MIGRATION_FILE_COUNT" = "$EXPECTED_MIGRATION_FILE_COUNT"',
    );
  });

  it("keeps the post-apply SQL verifier read-only and checks RLS", () => {
    const sql = readRepoFile("scripts/production-db-schema-check.sql");
    const withoutComments = sql.replace(/--.*$/gm, "");

    expect(sql).toContain("relrowsecurity");
    expect(sql).toContain("public.regions");
    expect(sql).toContain("public.profiles");
    expect(sql).toContain("public.support_messages");
    expect(withoutComments).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create)\b/i);
  });
});
