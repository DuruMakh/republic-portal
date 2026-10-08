import { describe, expect, it } from "vitest";
import { latestDefinition, orderedMigrationSql } from "./migration-model";

describe("approved delegates' names (security audit M2)", () => {
  it("are locked against client roles through a definer helper", () => {
    const trigger = latestDefinition("protect_profile_columns");
    expect(trigger).toMatch(
      /new\.first_name is distinct from old\.first_name\s+or new\.last_name is distinct from old\.last_name\)\s+and public\.is_approved_delegate\(\)/,
    );
    expect(trigger).toContain("raise exception 'name_locked'");
    // the guarded list and value rules stay intact
    expect(trigger).toContain("new.privacy_version is distinct from old.privacy_version");
    expect(trigger).toContain("raise exception 'invalid_name'");
  });

  it("checks approval as the owner, because clients cannot read delegates", () => {
    const helper = latestDefinition("is_approved_delegate");
    expect(helper).toContain("security definer set search_path = ''");
    expect(helper).toContain("where d.id = auth.uid() and d.status = 'approved'");
  });

  it("can be corrected only by super_admin or verifier, with an audit row", () => {
    const rpc = latestDefinition("admin_update_delegate_name");
    expect(rpc).toContain("public.has_any_admin_role('super_admin', 'verifier')");
    expect(rpc).toContain("'delegate.update_name'");
    expect(rpc).toMatch(/not between 1 and 60/);
    expect(orderedMigrationSql()).toMatch(
      /revoke execute on function admin_update_delegate_name\(uuid, text, text\) from public, anon;/,
    );
  });
});
