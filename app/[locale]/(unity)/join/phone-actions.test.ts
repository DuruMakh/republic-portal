import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHONE_VERIFICATION_MESSAGES } from "@/lib/phone-verification/contracts";
import { PhoneVerificationProviderError } from "@/lib/phone-verification/errors";
import type { ChallengeRow } from "@/lib/phone-verification/store";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
  createAdminClient: vi.fn(),
  updateUserById: vi.fn(),
  createProvider: vi.fn(),
  providerNameFor: vi.fn(),
  send: vi.fn(),
  verify: vi.fn(),
  reserveSend: vi.fn(),
  completeSend: vi.fn(),
  phoneInUse: vi.fn(),
  read: vi.fn(),
  reserveAttempt: vi.fn(),
  consume: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/phone-verification/provider", () => ({
  createProviderByName: mocks.createProvider,
  providerNameFor: mocks.providerNameFor,
}));
vi.mock("@/lib/phone-verification/store", () => ({
  reservePhoneVerificationSend: mocks.reserveSend,
  completePhoneVerificationSend: mocks.completeSend,
  phoneBelongsToAnotherProfile: mocks.phoneInUse,
  reservePhoneVerificationAttempt: mocks.reserveAttempt,
  readOwnedChallenge: mocks.read,
  consumeChallenge: mocks.consume,
}));

import { sendPhoneVerificationAction, verifyPhoneVerificationAction } from "./phone-actions";

const userId = "22222222-2222-4222-8222-222222222222";
const challengeId = "11111111-1111-4111-8111-111111111111";
const reservationId = "33333333-3333-4333-8333-333333333333";
const phone = "+995555123456";
const activeRow: ChallengeRow = {
  id: challengeId,
  user_id: userId,
  phone,
  purpose: "registration",
  provider: "test",
  provider_request_id: "provider-secret-id",
  verify_attempts: 0,
  expires_at: "2026-08-11T12:05:00.000Z",
  consumed_at: null,
  superseded_at: null,
  created_at: "2026-08-11T12:00:00.000Z",
};

function authenticate(providers: unknown = ["google"]) {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: userId, app_metadata: { providers } } },
    error: null,
  });
}

describe("phone verification server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00.000Z"));
    vi.stubEnv("PHONE_VERIFICATION_PROVIDER", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("VERCEL_ENV", "development");
    mocks.createServerSupabase.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { updateUserById: mocks.updateUserById } },
    });
    mocks.createProvider.mockReturnValue({ send: mocks.send, verify: mocks.verify });
    mocks.providerNameFor.mockReturnValue("test");
    mocks.reserveSend.mockResolvedValue({ reservationId });
    mocks.completeSend.mockResolvedValue({ id: challengeId, expiresAt: activeRow.expires_at });
    mocks.phoneInUse.mockResolvedValue(false);
    mocks.read.mockResolvedValue(activeRow);
    mocks.reserveAttempt.mockResolvedValue(1);
    mocks.consume.mockResolvedValue(true);
    mocks.send.mockResolvedValue({ provider: "test", requestId: "provider-secret-id" });
    mocks.verify.mockResolvedValue({ verified: true });
    mocks.updateUserById.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects missing or non-Google sessions before privileged dependencies", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      sendPhoneVerificationAction({ phone: "555123456", privacyConsent: true }),
    ).resolves.toMatchObject({
      ok: false,
      code: "not_authenticated",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    vi.clearAllMocks();
    authenticate(["email"]);
    mocks.createServerSupabase.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    await expect(
      sendPhoneVerificationAction({ phone: "555123456", privacyConsent: true }),
    ).resolves.toMatchObject({
      ok: false,
      code: "google_required",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("refuses an unconsented send before any privileged work or SMS", async () => {
    authenticate();
    for (const input of [{ phone: "555123456" }, { phone: "555123456", privacyConsent: false }]) {
      await expect(sendPhoneVerificationAction(input)).resolves.toEqual({
        ok: false,
        code: "privacy_consent_required",
        message: PHONE_VERIFICATION_MESSAGES.privacy_consent_required,
      });
    }
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects malformed phone input before privileged work", async () => {
    authenticate();
    await expect(
      sendPhoneVerificationAction({ phone: "bad", privacyConsent: true }),
    ).resolves.toEqual({
      ok: false,
      code: "invalid_phone",
      message: PHONE_VERIFICATION_MESSAGES.invalid_phone,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each(["send", "verify"])(
    "refuses test-provider %s on a live deployment before privileged access",
    async (action) => {
      authenticate();
      const provider = await vi.importActual<typeof import("@/lib/phone-verification/provider")>(
        "@/lib/phone-verification/provider",
      );
      mocks.providerNameFor.mockImplementation(provider.providerNameFor);
      mocks.createProvider.mockImplementation(provider.createProviderByName);
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", "development");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
      vi.stubEnv("VERCEL_ENV", "production");
      try {
        const result =
          action === "send"
            ? await sendPhoneVerificationAction({ phone: "555123456", privacyConsent: true })
            : await verifyPhoneVerificationAction({ challengeId, code: "123456" });
        expect(result).toMatchObject({ ok: false, code: "service_unavailable" });
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
        expect(mocks.reserveSend).not.toHaveBeenCalled();
        expect(mocks.read).not.toHaveBeenCalled();
        expect(mocks.send).not.toHaveBeenCalled();
        expect(mocks.verify).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it("atomically reserves the send before provider work and completes one canonical challenge", async () => {
    authenticate();
    await expect(
      sendPhoneVerificationAction({ phone: "555 12 34 56", privacyConsent: true }),
    ).resolves.toEqual({
      ok: true,
      challengeId,
      phone,
      expiresAt: activeRow.expires_at,
    });
    expect(mocks.reserveSend).toHaveBeenCalledWith(expect.anything(), {
      userId,
      phone,
      idempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(mocks.reserveSend.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.send.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mocks.completeSend).toHaveBeenCalledWith(expect.anything(), {
      reservationId,
      userId,
      provider: "test",
      providerRequestId: "provider-secret-id",
      expiresAt: activeRow.expires_at,
    });
  });

  it("returns the atomic send limit without constructing or calling the provider", async () => {
    authenticate();
    mocks.reserveSend.mockResolvedValue(null);
    await expect(
      sendPhoneVerificationAction({ phone: "555123456", privacyConsent: true }),
    ).resolves.toEqual({
      ok: false,
      code: "too_many_requests",
      message: PHONE_VERIFICATION_MESSAGES.too_many_requests,
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["send", "verify"])(
    "maps %s admin-client configuration errors to service_unavailable",
    async (action) => {
      authenticate();
      mocks.createAdminClient.mockImplementation(() => {
        throw new Error("missing service configuration");
      });
      const result =
        action === "send"
          ? await sendPhoneVerificationAction({ phone: "555123456", privacyConsent: true })
          : await verifyPhoneVerificationAction({ challengeId, code: "123456" });
      expect(result).toEqual({
        ok: false,
        code: "service_unavailable",
        message: PHONE_VERIFICATION_MESSAGES.service_unavailable,
      });
      expect(mocks.createProvider).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["malformed", { challengeId: "bad", code: "123456" }],
    ["foreign or expired", { challengeId, code: "123456" }],
  ])("returns recovery copy for a %s challenge without provider work", async (_name, input) => {
    authenticate();
    mocks.read.mockResolvedValue(null);
    await expect(verifyPhoneVerificationAction(input)).resolves.toEqual({
      ok: false,
      code: "expired_code",
      message: PHONE_VERIFICATION_MESSAGES.expired_code,
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("reserves an attempt before Verify.ge and maps a wrong code without a post-call increment", async () => {
    authenticate();
    mocks.verify.mockRejectedValue(new PhoneVerificationProviderError("invalid_code"));
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: false,
      code: "invalid_code",
      message: PHONE_VERIFICATION_MESSAGES.invalid_code,
    });
    expect(mocks.reserveAttempt).toHaveBeenCalledWith(expect.anything(), { challengeId, userId });
    expect(mocks.reserveAttempt.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.verify.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("reports a claimed phone only after the caller proves control with a correct code", async () => {
    authenticate();
    mocks.phoneInUse.mockResolvedValue(true);

    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: false,
      code: "phone_in_use",
      message: PHONE_VERIFICATION_MESSAGES.phone_in_use,
    });
    expect(mocks.reserveAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.consume).toHaveBeenCalledTimes(1);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("keeps reporting a claimed phone when retrying an already verified code", async () => {
    authenticate();
    mocks.read.mockResolvedValue({ ...activeRow, consumed_at: "2026-08-11T12:04:00.000Z" });
    mocks.phoneInUse.mockResolvedValue(true);

    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: false,
      code: "phone_in_use",
      message: PHONE_VERIFICATION_MESSAGES.phone_in_use,
    });
    expect(mocks.reserveAttempt).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("blocks the sixth concurrent attempt before provider verification", async () => {
    authenticate();
    mocks.read.mockResolvedValue({ ...activeRow, verify_attempts: 4 });
    mocks.reserveAttempt.mockResolvedValue(null);
    await expect(
      verifyPhoneVerificationAction({ challengeId, code: "123456" }),
    ).resolves.toMatchObject({ ok: false, code: "too_many_requests" });
    expect(mocks.createProvider).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("consumes a correct reserved attempt once, then confirms the Auth phone", async () => {
    authenticate();
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: true,
      phone,
    });
    expect(mocks.consume).toHaveBeenCalledWith(expect.anything(), { challengeId, userId });
    expect(mocks.updateUserById).toHaveBeenCalledWith(userId, { phone, phone_confirm: true });
  });

  it("retries only Auth attachment after one transient failure", async () => {
    authenticate();
    mocks.updateUserById
      .mockResolvedValueOnce({ data: null, error: { code: "unexpected_failure" } })
      .mockResolvedValueOnce({ data: {}, error: null });
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: true,
      phone,
    });
    expect(mocks.updateUserById).toHaveBeenCalledTimes(2);
    expect(mocks.reserveAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.consume).toHaveBeenCalledTimes(1);
  });

  it.each(["phone_exists", "user_already_exists", "identity_already_exists"])(
    "maps Auth %s to phone_in_use",
    async (code) => {
      authenticate();
      mocks.read.mockResolvedValue({ ...activeRow, consumed_at: "2026-08-11T12:04:00.000Z" });
      mocks.updateUserById.mockResolvedValue({ data: null, error: { code } });
      await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual(
        {
          ok: false,
          code: "phone_in_use",
          message: PHONE_VERIFICATION_MESSAGES.phone_in_use,
        },
      );
    },
  );

  it.each([
    [
      "provider send",
      () => mocks.send.mockRejectedValue(new Error("secret provider details")),
      () => sendPhoneVerificationAction({ phone: "555123456", privacyConsent: true }),
    ],
    [
      "provider verify",
      () =>
        mocks.verify.mockRejectedValue(new PhoneVerificationProviderError("service_unavailable")),
      () => verifyPhoneVerificationAction({ challengeId, code: "123456" }),
    ],
    [
      "provider config",
      () =>
        mocks.createProvider.mockImplementation(() => {
          throw new Error("missing secret");
        }),
      () => sendPhoneVerificationAction({ phone: "555123456", privacyConsent: true }),
    ],
  ])("redacts a %s failure", async (_name, arrange, act) => {
    authenticate();
    arrange();
    await expect(act()).resolves.toEqual({
      ok: false,
      code: "service_unavailable",
      message: PHONE_VERIFICATION_MESSAGES.service_unavailable,
    });
  });

  it("refuses a number from a country off the list before any privileged work", async () => {
    authenticate();
    await expect(
      sendPhoneVerificationAction({ phone: "+7 912 345 67 89", privacyConsent: true }),
    ).resolves.toEqual({
      ok: false,
      code: "country_not_supported",
      message: PHONE_VERIFICATION_MESSAGES.country_not_supported,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.reserveSend).not.toHaveBeenCalled();
  });

  it("refuses a foreign number while no provider serves it, without reserving", async () => {
    authenticate();
    mocks.providerNameFor.mockReturnValue(null);
    await expect(
      sendPhoneVerificationAction({ phone: "+31 6 54798014", privacyConsent: true }),
    ).resolves.toMatchObject({ ok: false, code: "country_not_supported" });
    expect(mocks.providerNameFor).toHaveBeenCalledWith("foreign");
    expect(mocks.reserveSend).not.toHaveBeenCalled();
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("sends a foreign number through the provider chosen for it and records that provider", async () => {
    authenticate();
    mocks.providerNameFor.mockReturnValue("twilio");
    mocks.send.mockResolvedValue({ provider: "twilio", requestId: "VE1" });
    await expect(
      sendPhoneVerificationAction({ phone: "+31 6 54798014", privacyConsent: true }),
    ).resolves.toMatchObject({ ok: true, phone: "+31654798014" });
    expect(mocks.providerNameFor).toHaveBeenCalledWith("foreign");
    expect(mocks.createProvider).toHaveBeenCalledWith("twilio");
    expect(mocks.reserveSend).toHaveBeenCalledWith(expect.anything(), {
      userId,
      phone: "+31654798014",
      idempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(mocks.completeSend).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ provider: "twilio", providerRequestId: "VE1" }),
    );
  });

  it("asks for the Georgian provider for a Georgian number", async () => {
    authenticate();
    mocks.providerNameFor.mockReturnValue("verify_ge");
    await sendPhoneVerificationAction({ phone: "555 12 34 56", privacyConsent: true });
    expect(mocks.providerNameFor).toHaveBeenCalledWith("georgia");
    expect(mocks.createProvider).toHaveBeenCalledWith("verify_ge");
  });

  it("checks a code with the provider stored on the challenge", async () => {
    authenticate();
    mocks.read.mockResolvedValue({ ...activeRow, provider: "twilio", phone: "+31654798014" });
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: true,
      phone: "+31654798014",
    });
    expect(mocks.createProvider).toHaveBeenCalledWith("twilio");
  });

  it("never verifies a challenge whose provider is no longer available", async () => {
    authenticate();
    mocks.read.mockResolvedValue({ ...activeRow, provider: "twilio" });
    mocks.createProvider.mockReturnValue(null);
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: false,
      code: "service_unavailable",
      message: PHONE_VERIFICATION_MESSAGES.service_unavailable,
    });
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it.each(["invalid_phone", "country_not_supported", "too_many_requests"] as const)(
    "tells the user a provider refusal of %s as it is, not as an outage",
    async (code) => {
      authenticate();
      mocks.send.mockRejectedValue(new PhoneVerificationProviderError(code));
      await expect(
        sendPhoneVerificationAction({ phone: "+31 6 54798014", privacyConsent: true }),
      ).resolves.toEqual({ ok: false, code, message: PHONE_VERIFICATION_MESSAGES[code] });
    },
  );
});
