import { describe, expect, it } from "vitest";
import { normalizeGeorgianPhone } from "./validation";

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
