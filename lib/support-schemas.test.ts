import { describe, expect, it } from "vitest";
import { supportMessageSchema } from "./support-schemas";
import { SUPPORT_NEED_CONTACT } from "./support-copy";

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
