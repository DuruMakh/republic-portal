import { describe, expect, it } from "vitest";
import { supportMessageSchema } from "./support-schemas";
import { SUPPORT_FILL_FIELD, SUPPORT_INVALID_INPUT, SUPPORT_NEED_CONTACT } from "./support-copy";

// Georgian fixtures spliced, never retyped: NAME from lib/admin-schemas.test.ts:127,
// the "ა".repeat(n) boundary idiom from lib/cabinet-schemas.test.ts:28.
const NAME = "ნინო";
const MESSAGE = "ა".repeat(20);

describe("supportMessageSchema", () => {
  it("accepts a form with only an email", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "someone@example.com",
      phone: "",
      message: MESSAGE,
    });
    expect(r.success).toBe(true);
  });

  it("accepts a form with only a phone", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "",
      phone: "+995555123456",
      message: MESSAGE,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a form with neither, naming the contact rule", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "",
      phone: "",
      message: MESSAGE,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === SUPPORT_NEED_CONTACT)).toBe(true);
    }
  });

  it("rejects a malformed email even when a phone is present", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "not-an-address",
      phone: "+995555123456",
      message: MESSAGE,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const r = supportMessageSchema.safeParse({
      name: "",
      email: "someone@example.com",
      phone: "",
      message: MESSAGE,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a 9-character message and accepts a 10-character one", () => {
    const base = { name: NAME, email: "someone@example.com", phone: "" };
    expect(supportMessageSchema.safeParse({ ...base, message: "ა".repeat(9) }).success).toBe(false);
    expect(supportMessageSchema.safeParse({ ...base, message: "ა".repeat(10) }).success).toBe(true);
  });

  it("rejects a message over 2000 characters", () => {
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "someone@example.com",
      phone: "",
      message: "ა".repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  // Code-review regressions (2026-08-02). Each of these shipped broken once.
  it("measures length in code points, as Postgres length() does", () => {
    // Five emoji: 10 UTF-16 units but 5 characters. zod's own .min(10) accepted
    // this while the RPC's length() = 5 refused it, and the visitor was told to
    // retry text that could never succeed.
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email: "someone@example.com",
      phone: "",
      message: "\u{1F44D}".repeat(5),
    });
    expect(r.success).toBe(false);
    // ...and 10 real characters pass, so the rule did not simply get stricter.
    expect(
      supportMessageSchema.safeParse({
        name: NAME,
        email: "someone@example.com",
        phone: "",
        message: "\u{1F44D}".repeat(10),
      }).success,
    ).toBe(true);
  });

  it("answers in Georgian when a field is missing or is not text", () => {
    // The server action takes `unknown` from a public endpoint, so these are
    // reachable without any client tampering. zod's defaults are English.
    const nullEmail = supportMessageSchema.safeParse({
      name: NAME,
      email: null,
      phone: "+995555123456",
      message: MESSAGE,
    });
    expect(nullEmail.success).toBe(false);
    if (!nullEmail.success) {
      expect(nullEmail.error.issues[0]?.message).toBe(SUPPORT_INVALID_INPUT);
    }

    const missingName = supportMessageSchema.safeParse({
      email: "someone@example.com",
      message: MESSAGE,
    });
    expect(missingName.success).toBe(false);
    if (!missingName.success) {
      expect(missingName.error.issues[0]?.message).toBe(SUPPORT_FILL_FIELD);
    }
  });

  it("trims an optional field before measuring it", () => {
    // 119 real characters plus trailing spaces was rejected as over 120 while
    // the RPC, which trims first, would have accepted it.
    const email = `${"a".repeat(107)}@example.com   `;
    expect(email.trim().length).toBe(119);
    const r = supportMessageSchema.safeParse({
      name: NAME,
      email,
      phone: "",
      message: MESSAGE,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe(email.trim());
  });

  it("treats a whitespace-only message as empty, matching the RPC's trim set", () => {
    const r = supportMessageSchema.safeParse({
      name: "\t",
      email: "someone@example.com",
      phone: "",
      message: "\n".repeat(10),
    });
    expect(r.success).toBe(false);
  });

  it("normalises blank optional fields to undefined", () => {
    const r = supportMessageSchema.safeParse({
      name: `  ${NAME}  `,
      email: "someone@example.com",
      phone: "   ",
      message: `  ${MESSAGE}  `,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBeUndefined();
      expect(r.data.name).toBe(NAME);
      expect(r.data.message).toBe(MESSAGE);
    }
  });
});
