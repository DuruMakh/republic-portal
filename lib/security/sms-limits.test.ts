import { describe, expect, it } from "vitest";
import { latestDefinition, orderedMigrationSql } from "./migration-model";

describe("SMS send limits (security audit M1)", () => {
  const reserve = () => latestDefinition("reserve_phone_verification_send");

  it("keeps the 60-second gap per account and per number", () => {
    expect(reserve()).toMatch(
      /created_at >= v_now - interval '60 seconds'\s+and \(user_id = p_user_id or phone = p_phone\)/,
    );
  });

  it("caps each account per hour, per day and in different numbers", () => {
    const body = reserve();
    expect(body).toContain("v_user_hour >= 5");
    expect(body).toContain("v_user_day >= 10");
    expect(body).toMatch(/v_user_phone_day = 0\s+and v_user_numbers_day >= 3/);
  });

  it("caps a number per day across accounts, but never an account's first three codes today", () => {
    // the owner keeps a small allowance even when others push the number to its cap
    expect(reserve()).toMatch(/v_phone_day >= 10\s+and v_user_phone_day >= 3/);
    // the old shared hourly per-number cap (the lockout lever) is gone
    expect(reserve()).not.toContain("v_phone_count >= 5");
  });

  it("caps the whole site per hour", () => {
    expect(reserve()).toContain("v_site_hour >= 1000");
    expect(orderedMigrationSql()).toMatch(
      /create index phone_verification_send_by_created\s+on public\.phone_verification_send_reservations \(created_at\)/,
    );
  });

  it("never looks at who owns a number", () => {
    expect(reserve()).not.toContain("public.profiles");
  });

  it("lets a send cancel only the sender's own codes", () => {
    const complete = latestDefinition("complete_phone_verification_send");
    expect(complete).toMatch(/and id <> v_challenge_id\s+and user_id = p_user_id;/);
    expect(complete).not.toContain("or phone = v_phone");
  });
});
