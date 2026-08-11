import { describe, expect, it } from "vitest";
import {
  buildPhoneVerificationIdempotencyKey,
  PHONE_VERIFICATION_CODE_LENGTH,
  PHONE_VERIFICATION_RESEND_SECONDS,
  PHONE_VERIFICATION_TTL_SECONDS,
} from "./contracts";

describe("phone verification contract", () => {
  it("pins the approved OTP limits", () => {
    expect(PHONE_VERIFICATION_CODE_LENGTH).toBe(6);
    expect(PHONE_VERIFICATION_TTL_SECONDS).toBe(300);
    expect(PHONE_VERIFICATION_RESEND_SECONDS).toBe(60);
  });

  it("creates a stable opaque idempotency key inside one resend window", () => {
    const input = {
      userId: "11111111-1111-4111-8111-111111111111",
      phone: "+995555123456",
      purpose: "registration" as const,
      nowMs: Date.UTC(2026, 7, 11, 12, 0, 30),
    };
    const first = buildPhoneVerificationIdempotencyKey(input);
    const second = buildPhoneVerificationIdempotencyKey({ ...input, nowMs: input.nowMs + 20_000 });

    expect(second).toBe(first);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain(input.phone);
    expect(first).not.toContain(input.userId);
  });

  it("changes the key after the 60-second resend window", () => {
    const base = {
      userId: "11111111-1111-4111-8111-111111111111",
      phone: "+995555123456",
      purpose: "registration" as const,
    };
    expect(buildPhoneVerificationIdempotencyKey({ ...base, nowMs: 0 })).not.toBe(
      buildPhoneVerificationIdempotencyKey({ ...base, nowMs: 60_000 }),
    );
  });
});
