import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ADR-046: the first production super_admin is granted by a dispatched, main-only workflow,
// not by a script run with production keys on someone's machine. These tests pin its guards.
const readRepoFile = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");
const workflow = readRepoFile(".github/workflows/production-admin.yml");
const sql = readRepoFile("scripts/production-grant-admin.sql");

describe("production admin grant workflow", () => {
  it("is manual, main-only, least-privilege, and pinned to the production project", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s{2}push:/m);
    expect(workflow).not.toMatch(/^\s{2}pull_request:/m);
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain('test "$GITHUB_REF" = "refs/heads/main"');
    expect(workflow).toContain("environment: production-db");
    expect(workflow).toContain("permissions:\n  contents: read\n");
    expect(workflow).toContain("EXPECTED_PRODUCTION_PROJECT_ID: uorvlshbrlbdnbauxsws");
    expect(workflow).toContain('test "$CONFIRM_PROJECT_REF" = "$EXPECTED_PRODUCTION_PROJECT_ID"');
    expect(workflow).toContain('test "$SUPABASE_PROJECT_ID" = "$EXPECTED_PRODUCTION_PROJECT_ID"');
  });

  it("never runs alongside a migration", () => {
    expect(workflow).toContain("group: production-db-migrations");
    expect(workflow).toContain("cancel-in-progress: false");
  });

  it("uses only the production environment's secrets", () => {
    const secretReferences = workflow.match(/secrets\.[A-Z0-9_]+/g) ?? [];
    expect([...new Set(secretReferences)].sort()).toEqual([
      "secrets.PRODUCTION_DB_PASSWORD",
      "secrets.PRODUCTION_PROJECT_ID",
      "secrets.SUPABASE_ACCESS_TOKEN",
    ]);
  });

  it("offers exactly the four admin roles", () => {
    expect(workflow).toMatch(
      /role:[\s\S]*?type: choice\s+options:\s+- super_admin\s+- verifier\s+- finance\s+- editor\n/,
    );
    expect(workflow).toContain("super_admin|verifier|finance|editor) ;;");
  });

  it("reads dispatch inputs only through environment variables, never inside a script", () => {
    for (const line of workflow.split("\n").filter((l) => l.includes("${{ inputs."))) {
      expect(line).toMatch(
        /^\s+(CONFIRM_PROJECT_REF|GRANT_EMAIL|GRANT_ROLE): \$\{\{ inputs\.\w+ \}\}$/,
      );
    }
  });

  it("validates the email strictly before linking the project or touching the database", () => {
    const emailCheck = workflow.indexOf(
      `grep -Eq '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`,
    );
    const linking = workflow.indexOf("supabase link --project-ref");
    const grant = workflow.indexOf("supabase db query --linked --file grant.sql");
    expect(emailCheck).toBeGreaterThan(-1);
    expect(linking).toBeGreaterThan(emailCheck);
    expect(grant).toBeGreaterThan(linking);
  });

  it("fills the SQL template with the validated values and checks the result", () => {
    expect(workflow).toContain("scripts/production-grant-admin.sql > grant.sql");
    expect(workflow).toContain('-e "s/__EMAIL__/${GRANT_EMAIL}/g"');
    expect(workflow).toContain('-e "s/__ROLE__/${GRANT_ROLE}/g"');
    expect(workflow).toMatch(/jq -e .*index\(\$role\)/);
  });
});

describe("production admin grant SQL", () => {
  it("has exactly the two placeholders the workflow fills", () => {
    expect([...new Set(sql.match(/__[A-Z]+__/g) ?? [])].sort()).toEqual(["__EMAIL__", "__ROLE__"]);
  });

  it("finds the person by their sign-in email and refuses anything but exactly one account", () => {
    expect(sql).toContain("from auth.users where lower(email) = lower('__EMAIL__')");
    expect(sql).toContain("<> 1 then");
  });

  it("applies the in-app rule: only completed members get a role (spec §3.7)", () => {
    expect(sql).toContain(
      "if v_profile.registration_completed_at is null and v_profile.status <> 'active_member' then",
    );
  });

  it("grants like the in-app grant: no-op if held, otherwise one audit row with a via marker", () => {
    expect(sql).toContain("values (v_user_id, '__ROLE__', null)");
    expect(sql).toContain("on conflict (user_id, role) do nothing");
    expect(sql).toContain("if v_inserted = 0 then");
    expect(sql).toContain("'admin.grant_role', 'admin_role'");
    expect(sql).toContain("'via', 'production-admin.yml'");
  });
});
