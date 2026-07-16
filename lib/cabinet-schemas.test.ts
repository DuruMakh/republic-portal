import { describe, expect, it } from "vitest";
import { changeDelegateSchema, profileUpdateSchema } from "./cabinet-schemas";

const valid = {
  firstName: "ნინო",
  lastName: "ბერიძე",
  regionId: 1,
  cityId: 3,
  employment: "სტუდენტი",
};

describe("profileUpdateSchema", () => {
  it("accepts a full valid update and trims names/employment", () => {
    const parsed = profileUpdateSchema.parse({
      ...valid,
      firstName: " ნინო ",
      employment: " მეწარმე ",
    });
    expect(parsed.firstName).toBe("ნინო");
    expect(parsed.employment).toBe("მეწარმე");
  });
  it("rejects empty / too-long names with the funnel's Georgian messages", () => {
    expect(profileUpdateSchema.safeParse({ ...valid, firstName: "  " }).success).toBe(false);
    const long = profileUpdateSchema.safeParse({ ...valid, lastName: "ა".repeat(61) });
    expect(long.success).toBe(false);
    if (!long.success) expect(long.error.issues[0]?.message).toBe("მაქსიმუმ 60 სიმბოლო");
  });
  it("rejects missing/non-positive region or city ids", () => {
    expect(profileUpdateSchema.safeParse({ ...valid, regionId: 0 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...valid, cityId: -1 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...valid, cityId: 1.5 }).success).toBe(false);
  });
  it("rejects empty or >100-char employment", () => {
    expect(profileUpdateSchema.safeParse({ ...valid, employment: " " }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...valid, employment: "ა".repeat(101) }).success).toBe(
      false,
    );
  });
});

describe("changeDelegateSchema", () => {
  it("accepts a uuid and null (null = ცენტრალური მოძრაობა)", () => {
    expect(
      changeDelegateSchema.safeParse({ delegateId: "6f9619ff-8b86-d011-b42d-00c04fc964ff" })
        .success,
    ).toBe(true);
    expect(changeDelegateSchema.safeParse({ delegateId: null }).success).toBe(true);
  });
  it("rejects non-uuid strings and undefined", () => {
    const bad = changeDelegateSchema.safeParse({ delegateId: "not-a-uuid" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0]?.message).toBe("არასწორი დელეგატი");
    expect(changeDelegateSchema.safeParse({}).success).toBe(false);
  });
});
