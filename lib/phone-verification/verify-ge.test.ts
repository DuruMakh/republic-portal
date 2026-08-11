import {
  InvalidOtpError,
  OtpChannel,
  OtpExpiredError,
  RateLimitError,
  type OtpClient,
} from "@smart-pay-chain/otp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createVerifyGeProvider, PhoneVerificationProviderError } from "./verify-ge";

type VerifyGeSdk = Pick<OtpClient, "sendOtp" | "verifyOtp">;

const serverSecret = "server-secret";
const idempotencyKey = "a".repeat(64);

function createSdk(): VerifyGeSdk {
  return {
    sendOtp: vi.fn().mockResolvedValue({
      requestId: "req-123",
      expiresAt: new Date("2026-08-11T12:05:00.000Z"),
      status: "SENT",
    }),
    verifyOtp: vi.fn().mockResolvedValue({ success: true, message: "verified" }),
  };
}

async function captureError(operation: () => Promise<unknown>): Promise<PhoneVerificationProviderError> {
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
    const provider = createVerifyGeProvider(serverSecret, sdk);

    await expect(
      provider.send({
        phone: "+995555123456",
        purpose: "registration",
        idempotencyKey,
      }),
    ).resolves.toEqual({ provider: "verify_ge", requestId: "req-123" });
    expect(sdk.sendOtp).toHaveBeenCalledWith({
      phoneNumber: "+995555123456",
      channel: OtpChannel.SMS,
      ttl: 300,
      length: 6,
      idempotencyKey,
    });
  });

  it("returns the SDK verification decision", async () => {
    const sdk = createSdk();
    const provider = createVerifyGeProvider(serverSecret, sdk);

    await expect(provider.verify({ requestId: "req-123", code: "123456" })).resolves.toEqual({
      verified: true,
    });
    expect(sdk.verifyOtp).toHaveBeenCalledWith({ requestId: "req-123", code: "123456" });
  });

  it("fails closed when the send response has no request ID", async () => {
    const sdk = createSdk();
    vi.mocked(sdk.sendOtp).mockResolvedValueOnce({
      requestId: "",
      expiresAt: new Date("2026-08-11T12:05:00.000Z"),
      status: "SENT",
    });
    const provider = createVerifyGeProvider(serverSecret, sdk);

    await expect(
      provider.send({ phone: "+995555123456", purpose: "registration", idempotencyKey }),
    ).rejects.toMatchObject({ code: "service_unavailable", message: "service_unavailable" });
  });

  it("redacts an SDK timeout or rejection", async () => {
    const sdk = createSdk();
    vi.mocked(sdk.sendOtp).mockRejectedValueOnce(new Error(`timeout for ${serverSecret}`));
    const provider = createVerifyGeProvider(serverSecret, sdk);

    const error = await captureError(() =>
      provider.send({ phone: "+995555123456", purpose: "registration", idempotencyKey }),
    );

    expect(error).toMatchObject({ code: "service_unavailable", message: "service_unavailable" });
    expect(error.message).not.toContain(serverSecret);
  });

  it.each([
    [new InvalidOtpError(`invalid ${serverSecret}`), "invalid_code"],
    [new OtpExpiredError(`expired ${serverSecret}`), "expired_code"],
    [new RateLimitError(`limited ${serverSecret}`), "too_many_requests"],
  ] as const)("maps %s without exposing its message", async (sdkError, code) => {
    const sdk = createSdk();
    vi.mocked(sdk.verifyOtp).mockRejectedValueOnce(sdkError);
    const provider = createVerifyGeProvider(serverSecret, sdk);

    const error = await captureError(() => provider.verify({ requestId: "req-123", code: "123456" }));

    expect(error).toMatchObject({ code, message: code });
    expect(error.message).not.toContain(serverSecret);
  });

  it("requires a server-only API key before constructing the SDK", () => {
    expect(() => createVerifyGeProvider("", createSdk())).toThrow("VERIFY_GE_API_KEY is missing");
  });
});
