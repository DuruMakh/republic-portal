import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_VALUES,
  adminTabs,
  AUDIT_ACTION_LABELS_KA,
  auditActionLabel,
  barPct,
  contentPill,
  formatDateTimeKa,
  hasAnyRole,
  isStaff,
  MEMBER_STATUS_LABELS_KA,
  ROLE_LABELS_KA,
  sanitizeSearch,
} from "./admin";

describe("sanitizeSearch (one sanitizer for list, lookup and export)", () => {
  it("strips PostgREST or() syntax and ILIKE wildcards", () => {
    expect(sanitizeSearch("ბერიძე,")).toBe("ბერიძე");
    expect(sanitizeSearch("5%9")).toBe("5 9");
    expect(sanitizeSearch("a_b\\c")).toBe("a b c");
    expect(sanitizeSearch("(x)")).toBe("x");
  });
  it("garbage-only input sanitizes to empty (callers must then skip the filter)", () => {
    expect(sanitizeSearch("((")).toBe("");
    expect(sanitizeSearch(",,")).toBe("");
  });
});

describe("adminTabs (spec §3.1 role → tab matrix)", () => {
  it("super_admin sees all nine tabs in order", () => {
    expect(adminTabs(["super_admin"]).map((t) => t.href)).toEqual([
      "/admin",
      "/admin/members",
      "/admin/verify",
      "/admin/finances",
      "/admin/transfer",
      "/admin/content",
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
  it("editor gains only the content tab; combos union", () => {
    expect(adminTabs(["editor"])).toEqual([{ href: "/admin/content", label: "შიგთავსი" }]);
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
      "შიგთავსი",
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
  it("all 29 actions have Georgian labels", () => {
    expect(Object.keys(AUDIT_ACTION_LABELS_KA).sort()).toEqual(
      [
        "admin.grant_role",
        "admin.revoke_role",
        "delegate.approve",
        "delegate.reject",
        "delegate.reveal_personal_id",
        "delegate.update_profile",
        "event.cancel",
        "event.delete",
        "event.publish",
        "event.save",
        "event.update",
        "member.export",
        "member.reassign",
        "member.reveal_personal_id",
        "news.delete",
        "news.publish",
        "news.save",
        "news.set_image",
        "news.unpublish",
        "news.update",
        "payment.bulk_record",
        "payment.record",
        "payment.void",
        "poll.close",
        "poll.delete",
        "poll.open",
        "poll.save",
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

describe("formatDateTimeKa", () => {
  it("renders Tbilisi wall-clock time (UTC+4, no DST)", () => {
    expect(formatDateTimeKa("2026-07-17T20:30:00Z")).toBe("18.07.2026 00:30");
    expect(formatDateTimeKa("2026-07-17T08:05:00Z")).toBe("17.07.2026 12:05");
  });
});

describe("Phase 5: შიგთავსი tab", () => {
  it("editor sees exactly the content tab", () => {
    expect(adminTabs(["editor"])).toEqual([{ href: "/admin/content", label: "შიგთავსი" }]);
  });
  it("super_admin gains the content tab; staff-only roles do not", () => {
    expect(adminTabs(["super_admin"]).map((t) => t.href)).toContain("/admin/content");
    expect(adminTabs(["verifier"]).map((t) => t.href)).not.toContain("/admin/content");
    expect(adminTabs(["finance"]).map((t) => t.href)).not.toContain("/admin/content");
  });
});

describe("Phase 5: audit labels + content pills", () => {
  it("labels every content action", () => {
    for (const action of [
      "news.save",
      "news.update",
      "news.publish",
      "news.unpublish",
      "news.delete",
      "news.set_image",
      "event.save",
      "event.update",
      "event.publish",
      "event.cancel",
      "event.delete",
      "poll.save",
      "poll.open",
      "poll.close",
      "poll.delete",
    ]) {
      expect(AUDIT_ACTION_LABELS_KA[action], action).toBeTruthy();
    }
  });
  it("contentPill maps every status to a Pill config", () => {
    expect(contentPill("draft")).toEqual({ status: "draft", label: "მონახაზი" });
    expect(contentPill("published")).toEqual({ status: "approved", label: "გამოქვეყნებული" });
    expect(contentPill("cancelled")).toEqual({ status: "rejected", label: "გაუქმებული" });
    expect(contentPill("open")).toEqual({ status: "approved", label: "ღია" });
    expect(contentPill("closed")).toEqual({ status: "draft", label: "დახურული" });
  });
});
