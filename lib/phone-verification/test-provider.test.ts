import { describe, expect, it } from "vitest";

import { createTestPhoneVerificationProvider } from "./test-provider";

describe("createTestPhoneVerificationProvider", () => {
  it("forbids direct construction in production", () => {
    expect(() =>
      createTestPhoneVerificationProvider({ NEXT_PUBLIC_APP_ENV: "production" }),
    ).toThrow("test phone verification provider is forbidden in production");
  });

  it("returns a deterministic request ID derived from the idempotency key", async () => {
    const provider = createTestPhoneVerificationProvider();

    await expect(
      provider.send({
        phone: "+995555123456",
        purpose: "registration",
        idempotencyKey: "a".repeat(64),
      }),
    ).resolves.toEqual({ provider: "test", requestId: `test:${"a".repeat(64)}` });
  });

  it("accepts only the fixed test code for its own request IDs", async () => {
    const provider = createTestPhoneVerificationProvider();

    await expect(provider.verify({ requestId: "test:req-123", code: "123456" })).resolves.toEqual({
      verified: true,
    });
    await expect(provider.verify({ requestId: "test:req-123", code: "000000" })).resolves.toEqual({
      verified: false,
    });
    await expect(provider.verify({ requestId: "verify:req-123", code: "123456" })).resolves.toEqual(
      {
        verified: false,
      },
    );
  });
});
