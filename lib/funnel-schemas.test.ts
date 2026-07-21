import { describe, expect, it } from "vitest";
import {
  EMPLOYMENT_PRESETS,
  membershipProfileSchema,
  otpSchema,
  registerActionSchema,
  registerSchema,
  tierSchema,
} from "./funnel-schemas";
import { BANK_DETAILS } from "./bank-details";

describe("registerSchema", () => {
  const base = {
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalId: "01001012345",
    phone: "555 12 34 56",
  };
  it("accepts the four fields and normalizes the phone", () => {
    const parsed = registerSchema.parse(base);
    expect(parsed.phone).toBe("+995555123456");
  });
  it("rejects a personal ID that is not 11 digits, in Georgian", () => {
    const r = registerSchema.safeParse({ ...base, personalId: "123" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("პირადი ნომერი უნდა იყოს 11 ციფრი.");
    }
  });
  it("accepts an optional referral code and rejects junk", () => {
    expect(registerSchema.safeParse({ ...base, refCode: "7K3M9Q" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, refCode: "bad code!" }).success).toBe(false);
  });
});

describe("registerActionSchema", () => {
  it("has no phone field (session provides it)", () => {
    expect(
      registerActionSchema.safeParse({
        firstName: "ნინო",
        lastName: "ბერიძე",
        personalId: "01001012345",
      }).success,
    ).toBe(true);
  });
});

describe("membershipProfileSchema", () => {
  const base = {
    birthDate: "1990-05-20",
    regionId: 3,
    cityId: 7,
    employment: "სტუდენტი",
    delegateId: null,
  };
  it("accepts a full profile", () => {
    expect(membershipProfileSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a future birth date in Georgian", () => {
    const r = membershipProfileSchema.safeParse({ ...base, birthDate: "2999-01-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("თარიღი უნდა იყოს წარსულში.");
  });
});

describe("otpSchema", () => {
  it("requires exactly 6 digits", () => {
    expect(otpSchema.safeParse({ code: "123456" }).success).toBe(true);
    expect(otpSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(otpSchema.safeParse({ code: "12345a" }).success).toBe(false);
  });
});

describe("tierSchema", () => {
  it("accepts only 5, 10, 20", () => {
    expect(tierSchema.safeParse({ tier: 10 }).success).toBe(true);
    const result = tierSchema.safeParse({ tier: 15 });
    expect(result.success).toBe(false);
    // regression: z.union's `{ message }` shorthand ignores invalid_union issues
    // (see the errorMap note in lib/funnel-schemas.ts).
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
