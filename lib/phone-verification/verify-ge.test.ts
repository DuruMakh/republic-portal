import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createVerifyGeProvider, PhoneVerificationProviderError } from "./verify-ge";

type VerifyGeSdk = NonNullable<Parameters<typeof createVerifyGeProvider>[1]>;

const serverSecret = "server-secret";
const idempotencyKey = "a".repeat(64);

function createSdk() {
  return {
    sendOtp: vi.fn<() => Promise<unknown>>().mockResolvedValue({
      requestId: "req-123",
      expiresAt: new Date("2026-08-11T12:05:00.000Z"),
      status: "SENT",
    }),
    verifyOtp: vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ success: true, message: "verified" }),
  };
}

function createProvider(sdk: ReturnType<typeof createSdk>) {
  return createVerifyGeProvider(serverSecret, sdk as unknown as VerifyGeSdk);
}

async function captureError(
  operation: () => Promise<unknown>,
): Promise<PhoneVerificationProviderError> {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(PhoneVerificationProviderError);
    return error as PhoneVerificationProviderError;
  }

  throw new Error("Expected operation to reject");
}

describe("createVerifyGeProvider", () => {
  it("sends the provider's required SMS payload and returns its request ID", async () => {
    const sdk = createSdk();
    const provider = createProvider(sdk);

    await expect(
      provider.send({
        phone: "+995555123456",
        purpose: "registration",
        idempotencyKey,
      }),
    ).resolves.toEqual({ provider: "verify_ge", requestId: "req-123" });
    expect(sdk.sendOtp).toHaveBeenCalledWith({
      phoneNumber: "+995555123456",
      channel: "SMS",
      ttl: 300,
      length: 6,
      idempotencyKey,
    });
  });

  it("returns the SDK verification decision", async () => {
    const sdk = createSdk();
    const provider = createProvider(sdk);

    await expect(provider.verify({ requestId: "req-123", code: "123456" })).resolves.toEqual({
      verified: true,
    });
    expect(sdk.verifyOtp).toHaveBeenCalledWith({ requestId: "req-123", code: "123456" });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a non-object", "sent"],
    ["a non-string request ID", { requestId: 123 }],
    ["an empty request ID", { requestId: "" }],
  ])("fails closed when the send response is %s", async (_description, response) => {
    const sdk = createSdk();
    sdk.sendOtp.mockResolvedValueOnce(response);
    const provider = createProvider(sdk);

    await expect(
      provider.send({ phone: "+995555123456", purpose: "registration", idempotencyKey }),
    ).rejects.toMatchObject({ code: "service_unavailable", message: "service_unavailable" });
  });

  it("redacts an SDK timeout or rejection", async () => {
    const sdk = createSdk();
    sdk.sendOtp.mockRejectedValueOnce(new Error(`timeout for ${serverSecret}`));
    const provider = createProvider(sdk);

    const error = await captureError(() =>
      provider.send({ phone: "+995555123456", purpose: "registration", idempotencyKey }),
    );

    expect(error).toMatchObject({ code: "service_unavailable", message: "service_unavailable" });
    expect(error.message).not.toContain(serverSecret);
  });

  it.each([
    [{ code: "INVALID_OTP_CODE", message: `invalid ${serverSecret}` }, "invalid_code"],
    [{ code: "OTP_EXPIRED", message: `expired ${serverSecret}` }, "expired_code"],
    [{ code: "RATE_LIMIT_EXCEEDED", message: `limited ${serverSecret}` }, "too_many_requests"],
  ] as const)("maps the SDK %s error code without exposing its message", async (sdkError, code) => {
    const sdk = createSdk();
    sdk.verifyOtp.mockRejectedValueOnce(sdkError);
    const provider = createProvider(sdk);

    const error = await captureError(() =>
      provider.verify({ requestId: "req-123", code: "123456" }),
    );

    expect(error).toMatchObject({ code, message: code });
    expect(error.message).not.toContain(serverSecret);
  });

  it("requires a server-only API key before constructing the SDK", () => {
    expect(() => createVerifyGeProvider("", createSdk() as unknown as VerifyGeSdk)).toThrow(
      "VERIFY_GE_API_KEY is missing",
    );
  });
});
