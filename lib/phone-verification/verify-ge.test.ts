import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createVerifyGeProvider, PhoneVerificationProviderError } from "./verify-ge";

const serverSecret = "server-secret";
const idempotencyKey = "a".repeat(64);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createFetch() {
  return vi.fn<typeof fetch>();
}

function createProvider(fetcher: ReturnType<typeof createFetch>) {
  return createVerifyGeProvider(serverSecret, fetcher);
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createVerifyGeProvider", () => {
  it("sends through the API endpoint that accepts dashboard OTP keys and returns its request ID", async () => {
    const fetcher = createFetch();
    fetcher.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          requestId: "req-123",
          expiresAt: "2026-08-12T12:05:00.000Z",
          status: "SENT",
        },
      }),
    );
    const provider = createProvider(fetcher);

    await expect(
      provider.send({
        phone: "+995555123456",
        purpose: "registration",
        idempotencyKey,
      }),
    ).resolves.toEqual({ provider: "verify_ge", requestId: "req-123" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://otp-service-production-ge.up.railway.app/api/v1/otp/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverSecret}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
          "X-OTP-SDK-Language": "typescript",
          "X-OTP-SDK-Platform": "node",
          "X-OTP-SDK-Version": "2.1.7",
        },
        body: JSON.stringify({
          phoneNumber: "+995555123456",
          channel: "SMS",
          ttl: 300,
          length: 6,
        }),
      },
    );
  });

  it("verifies through the documented Verify.ge REST endpoint", async () => {
    const fetcher = createFetch();
    fetcher.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { success: true, message: "verified" } }),
    );
    const provider = createProvider(fetcher);

    await expect(provider.verify({ requestId: "req-123", code: "123456" })).resolves.toEqual({
      verified: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://otp-service-production-ge.up.railway.app/api/v1/otp/verify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverSecret}`,
          "Content-Type": "application/json",
          "X-OTP-SDK-Language": "typescript",
          "X-OTP-SDK-Platform": "node",
          "X-OTP-SDK-Version": "2.1.7",
        },
        body: JSON.stringify({ requestId: "req-123", code: "123456" }),
      },
    );
  });

  it("accepts a provider-confirmed code when the verification response omits its result", async () => {
    const fetcher = createFetch();
    fetcher
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { message: "OTP verified successfully" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            id: "req-123",
            phoneNumber: "+9955******56",
            channel: "SMS",
            status: "VERIFIED",
            attempts: 0,
            maxAttempts: 5,
            expiresAt: "2026-08-12T12:05:00.000Z",
            verifiedAt: "2026-08-12T12:01:00.000Z",
            createdAt: "2026-08-12T12:00:00.000Z",
            isExpired: false,
          },
        }),
      );
    const provider = createProvider(fetcher);

    await expect(provider.verify({ requestId: "req-123", code: "123456" })).resolves.toEqual({
      verified: true,
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://otp-service-production-ge.up.railway.app/api/v1/otp/req-123",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${serverSecret}`,
          "Content-Type": "application/json",
          "X-OTP-SDK-Language": "typescript",
          "X-OTP-SDK-Platform": "node",
          "X-OTP-SDK-Version": "2.1.7",
        },
      },
    );
  });

  it("fails closed when an ambiguous verification is not confirmed as verified", async () => {
    const fetcher = createFetch();
    fetcher
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { message: "Verification result unavailable" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            id: "req-123",
            phoneNumber: "+9955******56",
            channel: "SMS",
            status: "SENT",
            attempts: 0,
            maxAttempts: 5,
            expiresAt: "2026-08-12T12:05:00.000Z",
            verifiedAt: null,
            createdAt: "2026-08-12T12:00:00.000Z",
            isExpired: false,
          },
        }),
      );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const provider = createProvider(fetcher);

    await expect(provider.verify({ requestId: "req-123", code: "123456" })).rejects.toMatchObject({
      code: "service_unavailable",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["INVALID_OTP_CODE", "invalid_code"],
    ["OTP_EXPIRED", "expired_code"],
    ["OTP_NOT_FOUND", "expired_code"],
    ["RATE_LIMIT_EXCEEDED", "too_many_requests"],
    ["OTP_MAX_ATTEMPTS", "too_many_requests"],
  ] as const)("maps the REST API %s error without exposing its message", async (apiCode, code) => {
    const fetcher = createFetch();
    fetcher.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: {
            code: apiCode,
            message: `provider ${serverSecret}`,
            statusCode: 400,
            retryable: false,
          },
          meta: { requestId: serverSecret, timestamp: "2026-08-12T12:00:00.000Z" },
        },
        400,
      ),
    );
    const provider = createProvider(fetcher);

    const error = await captureError(() =>
      provider.verify({ requestId: "req-123", code: "123456" }),
    );

    expect(error).toMatchObject({ code, message: code });
    expect(error.message).not.toContain(serverSecret);
  });

  it("logs only safe diagnostic fields for an unknown REST verification failure", async () => {
    const fetcher = createFetch();
    fetcher.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: `provider ${serverSecret}`,
            statusCode: 503,
            retryable: true,
            details: { secret: serverSecret },
          },
          meta: { requestId: serverSecret, timestamp: "2026-08-12T12:00:00.000Z" },
        },
        503,
      ),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const provider = createProvider(fetcher);

    await expect(provider.verify({ requestId: "req-123", code: "123456" })).rejects.toMatchObject({
      code: "service_unavailable",
    });

    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({
        level: "error",
        event: "verify_ge_verification_failed",
        errorName: undefined,
        errorCode: "SERVICE_UNAVAILABLE",
        statusCode: 503,
        retryable: true,
      }),
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(serverSecret);
  });

  it("logs only safe diagnostic fields for an unknown REST send failure", async () => {
    const fetcher = createFetch();
    fetcher.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_BALANCE",
            message: `provider ${serverSecret}`,
            statusCode: 402,
            retryable: false,
            details: { secret: serverSecret },
          },
          meta: { requestId: serverSecret, timestamp: "2026-08-12T12:00:00.000Z" },
        },
        402,
      ),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const provider = createProvider(fetcher);

    await expect(
      provider.send({ phone: "+995555123456", purpose: "registration", idempotencyKey }),
    ).rejects.toMatchObject({ code: "service_unavailable" });

    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({
        level: "error",
        event: "verify_ge_send_failed",
        errorName: undefined,
        errorCode: "INSUFFICIENT_BALANCE",
        statusCode: 402,
        retryable: false,
      }),
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(serverSecret);
  });

  it.each([
    ["send", { success: true, data: { requestId: "" } }],
    ["verify", { success: true, data: { success: "yes" } }],
  ])("fails closed when the %s success response is malformed", async (operation, body) => {
    const fetcher = createFetch();
    fetcher.mockResolvedValueOnce(jsonResponse(body));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const provider = createProvider(fetcher);

    const result =
      operation === "send"
        ? provider.send({ phone: "+995555123456", purpose: "registration", idempotencyKey })
        : provider.verify({ requestId: "req-123", code: "123456" });

    await expect(result).rejects.toMatchObject({
      code: "service_unavailable",
      message: "service_unavailable",
    });
  });

  it("redacts a network failure", async () => {
    const fetcher = createFetch();
    fetcher.mockRejectedValueOnce(new TypeError(`network ${serverSecret}`));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const provider = createProvider(fetcher);

    const error = await captureError(() =>
      provider.verify({ requestId: "req-123", code: "123456" }),
    );

    expect(error).toMatchObject({ code: "service_unavailable", message: "service_unavailable" });
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(serverSecret);
  });

  it("requires a server-only API key before making requests", () => {
    expect(() => createVerifyGeProvider("", createFetch())).toThrow("VERIFY_GE_API_KEY is missing");
  });
});
