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

  it("maps only named environment secrets and checks both supplied refs before linking", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}");
    expect(workflow).toContain("SUPABASE_PROJECT_ID: ${{ secrets.PRODUCTION_PROJECT_ID }}");
    expect(workflow).toContain("SUPABASE_DB_PASSWORD: ${{ secrets.PRODUCTION_DB_PASSWORD }}");
    expect(workflow).toContain('test "$CONFIRM_PROJECT_REF" = "$EXPECTED_PRODUCTION_PROJECT_ID"');
    expect(workflow).toContain('test "$SUPABASE_PROJECT_ID" = "$EXPECTED_PRODUCTION_PROJECT_ID"');

    const validation = workflow.indexOf("Validate immutable target");
    const linking = workflow.indexOf("Link production project");
    expect(validation).toBeGreaterThan(-1);
    expect(linking).toBeGreaterThan(validation);
  });

  it("dry-runs before apply, verifies afterwards, and contains no destructive or seed/config command", () => {
    const workflow = readRepoFile(".github/workflows/production-db.yml");

    const dryRun = workflow.indexOf("supabase db push --linked --dry-run");
    const apply = workflow.indexOf("supabase db push --linked", dryRun + 1);
    const schemaCheck = workflow.indexOf("scripts/production-db-schema-check.sql");
    expect(dryRun).toBeGreaterThan(-1);
    expect(apply).toBeGreaterThan(dryRun);
    expect(schemaCheck).toBeGreaterThan(apply);
    expect(workflow.match(/supabase migration list --linked/g)).toHaveLength(2);
    expect(workflow).not.toMatch(/--include-seed|config push|db reset|seed:staging/);
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
