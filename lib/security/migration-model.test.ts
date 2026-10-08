import { describe, expect, it } from "vitest";
import { lastMatchIndex, latestDefinition, orderedMigrationSql } from "./migration-model";

describe("migration model", () => {
  it("returns the last definition of a function in filename order", () => {
    // register() was last redefined by the privacy-consent migration (four arguments)
    expect(latestDefinition("register")).toContain("p_privacy_version text default null");
  });

  it("finds the last match index, or -1", () => {
    expect(lastMatchIndex("a b a", /a/g)).toBe(4);
    expect(lastMatchIndex("abc", /z/g)).toBe(-1);
  });

  it("concatenates every migration", () => {
    expect(orderedMigrationSql()).toContain("create table public.phone_verification_challenges");
  });
});
