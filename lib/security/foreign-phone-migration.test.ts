import { describe, expect, it } from "vitest";
import { latestDefinition, orderedMigrationSql } from "./migration-model";

// Foreign numbers at registration (spec 2026-10-23): wider checks, the twilio provider and a
// site-wide brake of 100 foreign sends a day that Georgian sends never touch.
describe("foreign phone numbers migration", () => {
  it("accepts any E.164 number in both verification tables", () => {
    const sql = orderedMigrationSql();
    expect(sql).toContain("drop constraint phone_verification_challenges_phone_check");
    expect(sql).toContain("drop constraint phone_verification_send_reservations_phone_check");
    expect(sql.split("check (phone ~ '^\\+[1-9][0-9]{7,14}$')").length - 1).toBe(2);
  });

  it("knows the twilio provider", () => {
    expect(orderedMigrationSql()).toContain(
      "check (provider in ('verify_ge', 'twilio', 'test'))",
    );
    expect(latestDefinition("complete_phone_verification_send")).toContain(
      "p_provider not in ('verify_ge', 'twilio', 'test')",
    );
  });

  it("brakes foreign sends at 100 a day, serialized, without touching Georgian ones", () => {
    const body = latestDefinition("reserve_phone_verification_send");
    expect(body).toMatch(/if p_phone not like '\+995%' then/);
    expect(body).toContain("pg_catalog.pg_advisory_xact_lock(8613, 0)");
    expect(body).toContain("v_foreign_day >= 100");
  });
});
