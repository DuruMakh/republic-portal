import { describe, expect, it } from "vitest";
import {
  bulkConfirmSchema,
  delegateProfileSchema,
  graceDaysSchema,
  grantRoleSchema,
  memberLookupSchema,
  membersFilterSchema,
  recordPaymentSchema,
  rejectDelegateSchema,
  todayTbilisiIso,
  voidPaymentSchema,
} from "./admin-schemas";

const UUID = "6e08c9a1-2f5e-4b7a-9c3d-1a2b3c4d5e6f";

describe("todayTbilisiIso", () => {
  it("returns YYYY-MM-DD", () => {
    expect(todayTbilisiIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("recordPaymentSchema (spec §3.5)", () => {
  const ok = {
    memberId: UUID,
    amountGel: 20,
    paidAt: todayTbilisiIso(),
    bankReference: "TBC-123",
  };
  it("accepts a valid payment; bankReference defaults empty", () => {
    expect(recordPaymentSchema.parse(ok).bankReference).toBe("TBC-123");
    const { bankReference: _omit, ...rest } = ok;
    expect(recordPaymentSchema.parse(rest).bankReference).toBe("");
  });
  it("rejects non-positive, oversized and sub-cent amounts", () => {
    expect(recordPaymentSchema.safeParse({ ...ok, amountGel: 0 }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, amountGel: -5 }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, amountGel: 10001 }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, amountGel: 5.001 }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, amountGel: 5.5 }).success).toBe(true);
  });
  it("rejects future dates, pre-2026 dates and malformed dates", () => {
    expect(recordPaymentSchema.safeParse({ ...ok, paidAt: "2025-12-31" }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, paidAt: "2126-01-01" }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...ok, paidAt: "01.07.2026" }).success).toBe(false);
  });
  it("caps the bank reference at 64", () => {
    expect(recordPaymentSchema.safeParse({ ...ok, bankReference: "x".repeat(65) }).success).toBe(
      false,
    );
  });
});

describe("bulkConfirmSchema", () => {
  const row = { referenceCode: "GR-ABC234", amountGel: 20, paidAt: "2026-07-01" };
  it("accepts 1–500 valid rows", () => {
    expect(bulkConfirmSchema.safeParse({ rows: [row] }).success).toBe(true);
  });
  it("rejects empty, oversized and malformed-code batches", () => {
    expect(bulkConfirmSchema.safeParse({ rows: [] }).success).toBe(false);
    expect(bulkConfirmSchema.safeParse({ rows: Array(501).fill(row) }).success).toBe(false);
    expect(
      bulkConfirmSchema.safeParse({ rows: [{ ...row, referenceCode: "GR-ABCIL0" }] }).success,
    ).toBe(false);
  });
});

describe("void/reject/profile/grant/settings/lookup", () => {
  it("void requires a 3–500 char reason", () => {
    expect(voidPaymentSchema.safeParse({ paymentId: 1, reason: "შეცდომით" }).success).toBe(true);
    expect(voidPaymentSchema.safeParse({ paymentId: 1, reason: "აა" }).success).toBe(false);
    expect(voidPaymentSchema.safeParse({ paymentId: 0, reason: "შეცდომით" }).success).toBe(false);
  });
  it("reject note is optional but capped at 500", () => {
    expect(rejectDelegateSchema.parse({ delegateId: UUID }).note).toBe("");
    expect(
      rejectDelegateSchema.safeParse({ delegateId: UUID, note: "x".repeat(501) }).success,
    ).toBe(false);
  });
  it("bio capped at 1000", () => {
    expect(delegateProfileSchema.parse({ delegateId: UUID, bio: " ბიო " }).bio).toBe("ბიო");
    expect(
      delegateProfileSchema.safeParse({ delegateId: UUID, bio: "x".repeat(1001) }).success,
    ).toBe(false);
  });
  it("grant accepts only the four roles", () => {
    expect(grantRoleSchema.safeParse({ userId: UUID, role: "finance" }).success).toBe(true);
    expect(grantRoleSchema.safeParse({ userId: UUID, role: "root" }).success).toBe(false);
  });
  it("grace days 0–365 integer", () => {
    expect(graceDaysSchema.safeParse({ graceDays: 30 }).success).toBe(true);
    expect(graceDaysSchema.safeParse({ graceDays: -1 }).success).toBe(false);
    expect(graceDaysSchema.safeParse({ graceDays: 366 }).success).toBe(false);
    expect(graceDaysSchema.safeParse({ graceDays: 30.5 }).success).toBe(false);
  });
  it("member lookup needs ≥2 chars", () => {
    expect(memberLookupSchema.safeParse({ query: "ა" }).success).toBe(false);
    expect(memberLookupSchema.safeParse({ query: "GR-ABC234" }).success).toBe(true);
  });
});

describe("membersFilterSchema — searchParams-tolerant", () => {
  it("parses good params", () => {
    expect(
      membersFilterSchema.parse({
        search: "ნინო",
        regionId: "3",
        status: "active_member",
        page: "2",
      }),
    ).toEqual({ search: "ნინო", regionId: 3, status: "active_member", page: 2 });
  });
  it("bad values degrade instead of throwing (URLs are user input)", () => {
    const f = membersFilterSchema.parse({ regionId: "abc", status: "hacker", page: "-1" });
    expect(f.regionId).toBeUndefined();
    expect(f.status).toBeUndefined();
    expect(f.page).toBe(1);
  });
  it("empty search becomes undefined", () => {
    expect(membersFilterSchema.parse({ search: "  " }).search).toBeUndefined();
  });
});
