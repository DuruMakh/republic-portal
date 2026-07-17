import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_VALUES,
  adminTabs,
  AUDIT_ACTION_LABELS_KA,
  auditActionLabel,
  barPct,
  hasAnyRole,
  isStaff,
  MEMBER_STATUS_LABELS_KA,
  ROLE_LABELS_KA,
} from "./admin";

describe("adminTabs (spec §3.1 role → tab matrix)", () => {
  it("super_admin sees all eight tabs in order", () => {
    expect(adminTabs(["super_admin"]).map((t) => t.href)).toEqual([
      "/admin",
      "/admin/members",
      "/admin/verify",
      "/admin/finances",
      "/admin/transfer",
      "/admin/admins",
      "/admin/audit",
      "/admin/settings",
    ]);
  });
  it("verifier: overview, members, verify, transfer", () => {
    expect(adminTabs(["verifier"]).map((t) => t.href)).toEqual([
      "/admin",
      "/admin/members",
      "/admin/verify",
      "/admin/transfer",
    ]);
  });
  it("finance: overview, members, finances", () => {
    expect(adminTabs(["finance"]).map((t) => t.href)).toEqual([
      "/admin",
      "/admin/members",
      "/admin/finances",
    ]);
  });
  it("editor sees no tabs (Phase 5 notice instead); combos union", () => {
    expect(adminTabs(["editor"])).toEqual([]);
    expect(adminTabs([])).toEqual([]);
    expect(adminTabs(["verifier", "finance"]).map((t) => t.href)).toEqual([
      "/admin",
      "/admin/members",
      "/admin/verify",
      "/admin/finances",
      "/admin/transfer",
    ]);
  });
  it("labels are the prototype's Georgian nav vocabulary", () => {
    const labels = adminTabs(["super_admin"]).map((t) => t.label);
    expect(labels).toEqual([
      "მიმოხილვა",
      "წევრები",
      "ვერიფიკაცია",
      "ფინანსები",
      "ტრანსფერი",
      "ადმინები",
      "აუდიტი",
      "პარამეტრები",
    ]);
  });
});

describe("isStaff (spec §4.2 gate)", () => {
  it("super_admin/verifier/finance are staff; editor alone is not", () => {
    expect(isStaff(["super_admin"])).toBe(true);
    expect(isStaff(["verifier"])).toBe(true);
    expect(isStaff(["finance"])).toBe(true);
    expect(isStaff(["editor"])).toBe(false);
    expect(isStaff([])).toBe(false);
    expect(isStaff(["editor", "finance"])).toBe(true);
  });
});

describe("audit taxonomy (spec §4.5)", () => {
  it("all 14 actions have Georgian labels", () => {
    expect(Object.keys(AUDIT_ACTION_LABELS_KA).sort()).toEqual(
      [
        "admin.grant_role",
        "admin.revoke_role",
        "delegate.approve",
        "delegate.reject",
        "delegate.reveal_personal_id",
        "delegate.update_profile",
        "member.export",
        "member.reassign",
        "member.reveal_personal_id",
        "payment.bulk_record",
        "payment.record",
        "payment.void",
        "settings.update",
        "system.active_sweep",
      ].sort(),
    );
  });
  it("unknown actions fall back to the raw string", () => {
    expect(auditActionLabel("delegate.approve")).toBe("დელეგატის დამტკიცება");
    expect(auditActionLabel("future.action")).toBe("future.action");
  });
});

describe("vocabulary and bars", () => {
  it("member statuses cover all three values", () => {
    expect(MEMBER_STATUS_LABELS_KA).toEqual({
      draft: "მონახაზი",
      profile_completed: "რეგისტრირებული",
      active_member: "აქტიური",
    });
  });
  it("role labels exist for every role", () => {
    for (const role of ADMIN_ROLE_VALUES) expect(ROLE_LABELS_KA[role]).toBeTruthy();
  });
  it("barPct is clamped and zero-safe", () => {
    expect(barPct(294, 294)).toBe(100);
    expect(barPct(0, 294)).toBe(0);
    expect(barPct(147, 294)).toBe(50);
    expect(barPct(5, 0)).toBe(0);
  });
});

describe("hasAnyRole (page gates)", () => {
  it("checks intersection", () => {
    expect(hasAnyRole(["verifier"], ["super_admin", "verifier"])).toBe(true);
    expect(hasAnyRole(["finance"], ["super_admin", "verifier"])).toBe(false);
    expect(hasAnyRole([], ["super_admin"])).toBe(false);
  });
});
