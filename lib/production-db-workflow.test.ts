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

  it("asserts the committed 32-file migration baseline before each database phase", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("EXPECTED_MIGRATION_FILE_COUNT: 32");
    expect(workflow.match(/Migration file baseline/g)).toHaveLength(2);
    expect(workflow).toContain("find supabase/migrations -maxdepth 1 -type f -name '*.sql'");
    expect(workflow).toContain(
      'test "$ACTUAL_MIGRATION_FILE_COUNT" = "$EXPECTED_MIGRATION_FILE_COUNT"',
    );
  });

  it("runs the post-apply security gates in dependency order and preserves their evidence", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("production-db-security-evidence/advisors.json");
    expect(workflow).toContain("verify-production-security-advisors.mjs");
    expect(workflow).toContain("production-db-security-evidence");
    expect(workflow).toContain("set role anon");
    expect(workflow).toContain("set role authenticated");
    expect(workflow).toContain("42501");
    expect(workflow).toContain("permission denied for view admin_overview");
    expect(workflow).not.toContain("permission denied for function has_any_admin_role");

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
    expect(advisorStep).not.toContain("--fail-on error");
    expect(roleProbeIndex).toBeLessThan(advisorCaptureIndex);
    expect(advisorCaptureIndex).toBeLessThan(advisorVerifyIndex);
  });

  it("keeps the post-apply SQL verifier read-only and checks RLS plus exact client view grants", () => {
    const sql = readRepoFile("scripts/production-db-schema-check.sql");
    const withoutComments = sql.replace(/--.*$/gm, "");
    const executableSql = withoutComments.replace(/'(?:''|[^'])*'/g, "''");

    expect(sql).toContain("relrowsecurity");
    expect(sql).toContain("public.regions");
    expect(sql).toContain("public.profiles");
    expect(sql).toContain("public.support_messages");
    expect(sql).toContain("role_table_grants");
    expect(sql).toContain("table_privileges");
    expect(sql).toContain("has_table_privilege");
    expect(sql).toContain("has_any_column_privilege");
    expect(sql).toContain("aclexplode");
    expect(sql).toContain("pg_has_role");
    expect(sql).toContain("production view set drifted");
    expect(sql).toContain("production view grants drifted");
    expect(sql).toContain("production view effective privileges drifted");
    expect(sql).toContain("production view column privileges drifted");
    expect(sql).toContain(
      "join expected_views as expected on expected.view_name = grants.table_name",
    );
    expect(sql).toContain("grants.grantee = 'PUBLIC'");
    expect(sql).toContain("'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'");
    expect(sql).toContain("'INSERT, UPDATE, REFERENCES'");
    expect(sql).toMatch(/\bexcept\b/i);
    expect(sql).toContain("anon");
    expect(sql).toContain("authenticated");
    expect(sql).toContain("SELECT");
    for (const viewName of [
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
    ]) {
      expect(sql).toContain(`('${viewName}')`);
    }
    for (const viewName of [
      "public_delegates",
      "public_events",
      "public_news",
      "public_stats",
      "transparency_regions",
      "transparency_stats",
    ]) {
      expect(sql).toContain(`('${viewName}', 'anon', 'SELECT')`);
      expect(sql).toContain(`('${viewName}', 'authenticated', 'SELECT')`);
    }
    for (const viewName of [
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
    ]) {
      expect(sql).toContain(`('${viewName}', 'authenticated', 'SELECT')`);
    }
    expect(executableSql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create)\b/i);
  });
});
