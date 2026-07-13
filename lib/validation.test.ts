import { describe, expect, it } from "vitest";
import { normalizeGeorgianPhone, validatePersonalId } from "./validation";

describe("validatePersonalId", () => {
  it("accepts exactly 11 digits", () => {
    expect(validatePersonalId("01001012345")).toBe(true);
  });
  it("rejects wrong length, letters, spaces", () => {
    expect(validatePersonalId("0100101234")).toBe(false);
    expect(validatePersonalId("010010123456")).toBe(false);
    expect(validatePersonalId("0100101234a")).toBe(false);
    expect(validatePersonalId("01001 12345")).toBe(false);
    expect(validatePersonalId("")).toBe(false);
  });
});

describe("normalizeGeorgianPhone", () => {
  it("normalizes local mobile formats to E.164", () => {
    expect(normalizeGeorgianPhone("555 12 34 56")).toBe("+995555123456");
    expect(normalizeGeorgianPhone("595123456")).toBe("+995595123456");
    expect(normalizeGeorgianPhone("+995 555 123 456")).toBe("+995555123456");
    expect(normalizeGeorgianPhone("995555123456")).toBe("+995555123456");
  });
  it("rejects non-mobile or malformed numbers", () => {
    expect(normalizeGeorgianPhone("032 2 123456")).toBeNull();
    expect(normalizeGeorgianPhone("12345")).toBeNull();
    expect(normalizeGeorgianPhone("+15551234567")).toBeNull();
    expect(normalizeGeorgianPhone("")).toBeNull();
  });
});
