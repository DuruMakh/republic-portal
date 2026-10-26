import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PhoneVerificationProviderError } from "./errors";
import { createTwilioProvider } from "./twilio";

const config = { apiKeySid: "SK1", apiKeySecret: "secret", serviceSid: "VA1" };
const phone = "+31654798014";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setup() {
  const fetcher = vi.fn<typeof fetch>();
  return { fetcher, provider: createTwilioProvider(config, fetcher) };
}

async function captureError(operation: () => Promise<unknown>): Promise<string> {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(PhoneVerificationProviderError);
    return (error as PhoneVerificationProviderError).code;
  }
  throw new Error("Expected operation to reject");
}

const send = (provider: ReturnType<typeof setup>["provider"]) =>
  provider.send({ phone, purpose: "registration", idempotencyKey: "a".repeat(64) });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Twilio Verify provider", () => {
  it("sends an SMS verification with Basic auth and returns the verification SID", async () => {
    const { fetcher, provider } = setup();
    fetcher.mockImplementation(async () => jsonResponse({ sid: "VE1", status: "pending" }, 201));

    await expect(send(provider)).resolves.toEqual({ provider: "twilio", requestId: "VE1" });

    const [url, init] = fetcher.mock.calls.at(-1)!;
    expect(url).toBe("https://verify.twilio.com/v2/Services/VA1/Verifications");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(
      `Basic ${Buffer.from("SK1:secret").toString("base64")}`,
    );
    expect(headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
      To: phone,
      Channel: "sms",
    });
  });

  it.each([
    [60200, 400, "invalid_phone"],
    [21211, 400, "invalid_phone"],
    [21614, 400, "invalid_phone"],
    [60205, 400, "invalid_phone"],
    [60605, 403, "country_not_supported"],
    [60410, 403, "country_not_supported"],
    [60203, 429, "too_many_requests"],
    [20429, 429, "too_many_requests"],
    [20003, 401, "service_unavailable"],
  ])("maps send error %i to %s", async (code, status, expected) => {
    const { fetcher, provider } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetcher.mockImplementation(async () => jsonResponse({ code, status, message: "x" }, status));
    await expect(captureError(() => send(provider))).resolves.toBe(expected);
  });

  it("treats a bare 429, a non-JSON body and a network failure as the right failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const limited = setup();
    limited.fetcher.mockImplementation(async () => new Response("slow down", { status: 429 }));
    await expect(captureError(() => send(limited.provider))).resolves.toBe("too_many_requests");

    const garbled = setup();
    garbled.fetcher.mockImplementation(async () => new Response("<html>", { status: 502 }));
    await expect(captureError(() => send(garbled.provider))).resolves.toBe("service_unavailable");

    const offline = setup();
    offline.fetcher.mockRejectedValue(new TypeError("fetch failed"));
    await expect(captureError(() => send(offline.provider))).resolves.toBe("service_unavailable");
  });

  it("checks a code against the verification SID", async () => {
    const { fetcher, provider } = setup();
    fetcher.mockImplementation(async () => jsonResponse({ sid: "VE1", status: "approved" }));

    await expect(provider.verify({ requestId: "VE1", code: "123456" })).resolves.toEqual({
      verified: true,
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://verify.twilio.com/v2/Services/VA1/VerificationCheck");
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
      VerificationSid: "VE1",
      Code: "123456",
    });
  });

  it("reports a wrong code as not verified", async () => {
    const { fetcher, provider } = setup();
    fetcher.mockImplementation(async () => jsonResponse({ sid: "VE1", status: "pending" }));
    await expect(provider.verify({ requestId: "VE1", code: "000000" })).resolves.toEqual({
      verified: false,
    });
  });

  it.each([
    [20404, 404, "expired_code"],
    [60202, 429, "too_many_requests"],
    [20003, 401, "service_unavailable"],
  ])("maps verify error %i to %s", async (code, status, expected) => {
    const { fetcher, provider } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetcher.mockImplementation(async () => jsonResponse({ code, status, message: "x" }, status));
    await expect(
      captureError(() => provider.verify({ requestId: "VE1", code: "123456" })),
    ).resolves.toBe(expected);
  });

  it("never logs the phone number or the code", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const sendFail = setup();
    sendFail.fetcher.mockImplementation(async () =>
      jsonResponse({ code: 20003, status: 401, message: `bad ${phone}` }, 401),
    );
    await captureError(() => send(sendFail.provider));
    const verifyFail = setup();
    verifyFail.fetcher.mockImplementation(async () =>
      jsonResponse({ code: 20003, status: 401, message: "bad 123456" }, 401),
    );
    await captureError(() => verifyFail.provider.verify({ requestId: "VE1", code: "123456" }));

    expect(log).toHaveBeenCalledTimes(2);
    const written = log.mock.calls.flat().join(" ");
    expect(written).not.toContain("654798014");
    expect(written).not.toContain("123456");
    expect(written).toContain("twilio_send_failed");
    expect(written).toContain("twilio_verification_failed");
  });

  it("cancels a still-pending verification for the number first, so a resend gets a new code", async () => {
    const { fetcher, provider } = setup();
    fetcher
      .mockResolvedValueOnce(jsonResponse({ sid: "VE0", status: "canceled" }))
      .mockResolvedValueOnce(jsonResponse({ sid: "VE2", status: "pending" }, 201));

    await expect(send(provider)).resolves.toEqual({ provider: "twilio", requestId: "VE2" });

    expect(fetcher).toHaveBeenCalledTimes(2);
    const [cancelUrl, cancelInit] = fetcher.mock.calls[0]!;
    expect(cancelUrl).toBe(
      "https://verify.twilio.com/v2/Services/VA1/Verifications/%2B31654798014",
    );
    expect(cancelInit?.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(String(cancelInit?.body)))).toEqual({
      Status: "canceled",
    });
    expect(fetcher.mock.calls[1]![0]).toBe(
      "https://verify.twilio.com/v2/Services/VA1/Verifications",
    );
  });

  it("sends anyway when there is nothing to cancel or the cancel fails", async () => {
    const none = setup();
    none.fetcher
      .mockResolvedValueOnce(jsonResponse({ code: 20404, status: 404 }, 404))
      .mockResolvedValueOnce(jsonResponse({ sid: "VE3", status: "pending" }, 201));
    await expect(send(none.provider)).resolves.toEqual({ provider: "twilio", requestId: "VE3" });

    const offline = setup();
    offline.fetcher
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse({ sid: "VE4", status: "pending" }, 201));
    await expect(send(offline.provider)).resolves.toEqual({ provider: "twilio", requestId: "VE4" });
  });

  it("gives every Twilio call a time limit", async () => {
    const { fetcher, provider } = setup();
    fetcher.mockImplementation(async () => jsonResponse({ sid: "VE1", status: "approved" }, 201));
    await send(provider);
    await provider.verify({ requestId: "VE1", code: "123456" });
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [, init] of fetcher.mock.calls) expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
