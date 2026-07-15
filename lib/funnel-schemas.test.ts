import { describe, expect, it } from "vitest";
import {
  contactSchema,
  EMPLOYMENT_PRESETS,
  otpSchema,
  profileActionSchema,
  startSchema,
  tierSchema,
} from "./funnel-schemas";
import { BANK_DETAILS } from "./bank-details";

const validProfileBase = {
  personalId: "01001234567",
  birthDate: "1990-05-20",
  regionId: 1,
  cityId: 3,
  employment: "სტუდენტი",
};

describe("contactSchema", () => {
  it("accepts and normalizes a Georgian phone in any common format", () => {
    for (const input of ["599 12 34 56", "+995599123456", "995599123456"]) {
      const parsed = contactSchema.parse({ firstName: "ნინო", lastName: "ბერიძე", phone: input });
      expect(parsed.phone).toBe("+995599123456");
    }
  });
  it("trims names and rejects empty or over-long ones", () => {
    const ok = contactSchema.parse({ firstName: " ნინო ", lastName: "ბერიძე", phone: "599123456" });
    expect(ok.firstName).toBe("ნინო");
    expect(
      contactSchema.safeParse({ firstName: "", lastName: "ბ", phone: "599123456" }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ firstName: "ა".repeat(61), lastName: "ბ", phone: "599123456" })
        .success,
    ).toBe(false);
  });
  it("rejects non-Georgian-mobile phones", () => {
    expect(
      contactSchema.safeParse({ firstName: "ა", lastName: "ბ", phone: "499123456" }).success,
    ).toBe(false);
  });
});

describe("otpSchema", () => {
  it("requires exactly 6 digits", () => {
    expect(otpSchema.safeParse({ code: "123456" }).success).toBe(true);
    expect(otpSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(otpSchema.safeParse({ code: "12345a" }).success).toBe(false);
  });
});

describe("startSchema", () => {
  it("accepts both roles and an optional ref code", () => {
    expect(
      startSchema.safeParse({ firstName: "ა", lastName: "ბ", role: "member", refCode: "D00101" })
        .success,
    ).toBe(true);
    expect(
      startSchema.safeParse({ firstName: "ა", lastName: "ბ", role: "delegate" }).success,
    ).toBe(true);
    expect(
      startSchema.safeParse({ firstName: "ა", lastName: "ბ", role: "admin" }).success,
    ).toBe(false);
    expect(
      startSchema.safeParse({ firstName: "ა", lastName: "ბ", role: "member", refCode: "bad ref!" })
        .success,
    ).toBe(false);
  });
});

describe("profileActionSchema", () => {
  it("accepts a valid member payload (delegateId null = central)", () => {
    expect(
      profileActionSchema.safeParse({ role: "member", ...validProfileBase, delegateId: null })
        .success,
    ).toBe(true);
    expect(
      profileActionSchema.safeParse({
        role: "member",
        ...validProfileBase,
        delegateId: "2f6ae2f0-31a5-4f0f-9b60-2f4bb3170500",
      }).success,
    ).toBe(true);
  });
  it("delegate payload requires tcAccepted literally true", () => {
    expect(
      profileActionSchema.safeParse({ role: "delegate", ...validProfileBase, tcAccepted: true })
        .success,
    ).toBe(true);
    const result = profileActionSchema.safeParse({
      role: "delegate",
      ...validProfileBase,
      tcAccepted: false,
    });
    expect(result.success).toBe(false);
    // regression: zod v3's `z.literal(true, { message })` shorthand ignores the
    // custom message for invalid_literal issues and falls back to English —
    // must go through an explicit errorMap instead (see lib/funnel-schemas.ts).
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("საჭიროა წესებზე თანხმობა.");
    }
  });
  it("rejects bad personal IDs, future birth dates, empty employment", () => {
    expect(
      profileActionSchema.safeParse({
        role: "member",
        ...validProfileBase,
        personalId: "123",
        delegateId: null,
      }).success,
    ).toBe(false);
    expect(
      profileActionSchema.safeParse({
        role: "member",
        ...validProfileBase,
        birthDate: "2999-01-01",
        delegateId: null,
      }).success,
    ).toBe(false);
    expect(
      profileActionSchema.safeParse({
        role: "member",
        ...validProfileBase,
        employment: "  ",
        delegateId: null,
      }).success,
    ).toBe(false);
  });
});

describe("tierSchema", () => {
  it("accepts only 5, 10, 20", () => {
    expect(tierSchema.safeParse({ tier: 10 }).success).toBe(true);
    const result = tierSchema.safeParse({ tier: 15 });
    expect(result.success).toBe(false);
    // regression: z.union's `{ message }` shorthand ignores invalid_union issues
    // too — same zod v3 quirk as tcAccepted above.
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("აირჩიე საწევრო პაკეტი.");
    }
  });
});

describe("bank details + employment presets", () => {
  it("bank details module has the full display shape", () => {
    expect(typeof BANK_DETAILS.placeholder).toBe("boolean");
    expect(BANK_DETAILS.recipientName.length).toBeGreaterThan(0);
    expect(BANK_DETAILS.bankName.length).toBeGreaterThan(0);
    expect(BANK_DETAILS.iban.length).toBeGreaterThan(0);
  });
  it("employment presets are the prototype's five", () => {
    expect([...EMPLOYMENT_PRESETS]).toEqual([
      "დასაქმებული",
      "თვითდასაქმებული",
      "სტუდენტი",
      "პენსიონერი",
      "დროებით უმუშევარი",
    ]);
  });
});
