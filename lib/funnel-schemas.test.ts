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
    phone: "555 12 34 56",
  };
  it("accepts the three fields and normalizes the phone (owner fix #10: no personal ID at registration)", () => {
    const parsed = registerSchema.parse(base);
    expect(parsed.phone).toBe("+995555123456");
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
      }).success,
    ).toBe(true);
  });
});

describe("membershipProfileSchema", () => {
  const base = {
    personalId: "01001012345",
    birthDate: "1990-05-20",
    regionId: 3,
    cityId: 7,
    employment: "სტუდენტი",
    delegateId: null,
  };
  it("accepts a full profile", () => {
    expect(membershipProfileSchema.safeParse(base).success).toBe(true);
  });
  it("accepts a null personal ID — owner fix #10: a profile that already has one is not asked again", () => {
    expect(membershipProfileSchema.safeParse({ ...base, personalId: null }).success).toBe(true);
  });
  it("rejects a personal ID that is not 11 digits, in Georgian (moved from registerSchema, owner fix #10)", () => {
    const r = membershipProfileSchema.safeParse({ ...base, personalId: "123" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("პირადი ნომერი უნდა იყოს 11 ციფრი.");
    }
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
  it("accepts the fee and reports the Georgian message for anything else", () => {
    expect(tierSchema.safeParse({ tier: 10 }).success).toBe(true);
    const result = tierSchema.safeParse({ tier: 15 });
    expect(result.success).toBe(false);
    // regression: z.literal's `{ message }` shorthand ignores invalid_literal issues,
    // same gap the retired z.union had (see the errorMap note in lib/funnel-schemas.ts).
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("აირჩიე საწევრო პაკეტი.");
    }
  });
});

describe("tierSchema — fixed fee (owner fix #9)", () => {
  it("accepts the fixed 10 GEL fee", () => {
    expect(tierSchema.safeParse({ tier: 10 }).success).toBe(true);
  });

  it("rejects the retired 5 and 20 GEL tiers", () => {
    expect(tierSchema.safeParse({ tier: 5 }).success).toBe(false);
    expect(tierSchema.safeParse({ tier: 20 }).success).toBe(false);
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
