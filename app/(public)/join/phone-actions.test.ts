import { beforeEach, describe, expect, it, vi } from "vitest";
import { PHONE_VERIFICATION_MESSAGES } from "@/lib/phone-verification/contracts";
import { PhoneVerificationProviderError } from "@/lib/phone-verification/verify-ge";
import type { ChallengeRow } from "@/lib/phone-verification/store";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
  createAdminClient: vi.fn(),
  updateUserById: vi.fn(),
  createProvider: vi.fn(),
  send: vi.fn(),
  verify: vi.fn(),
  reserveSend: vi.fn(),
  completeSend: vi.fn(),
  read: vi.fn(),
  reserveAttempt: vi.fn(),
  consume: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/phone-verification/provider", () => ({
  createPhoneVerificationProvider: mocks.createProvider,
}));
vi.mock("@/lib/phone-verification/store", () => ({
  reservePhoneVerificationSend: mocks.reserveSend,
  completePhoneVerificationSend: mocks.completeSend,
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
    process.env.PHONE_VERIFICATION_PROVIDER = "test";
    mocks.createServerSupabase.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { updateUserById: mocks.updateUserById } },
    });
    mocks.createProvider.mockReturnValue({ send: mocks.send, verify: mocks.verify });
    mocks.reserveSend.mockResolvedValue({ reservationId });
    mocks.completeSend.mockResolvedValue({ id: challengeId, expiresAt: activeRow.expires_at });
    mocks.read.mockResolvedValue(activeRow);
    mocks.reserveAttempt.mockResolvedValue(1);
    mocks.consume.mockResolvedValue(true);
    mocks.send.mockResolvedValue({ provider: "test", requestId: "provider-secret-id" });
    mocks.verify.mockResolvedValue({ verified: true });
    mocks.updateUserById.mockResolvedValue({ data: {}, error: null });
  });

  it("rejects missing or non-Google sessions before privileged dependencies", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(sendPhoneVerificationAction({ phone: "555123456" })).resolves.toMatchObject({
      ok: false,
      code: "not_authenticated",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    vi.clearAllMocks();
    authenticate(["email"]);
    mocks.createServerSupabase.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    await expect(sendPhoneVerificationAction({ phone: "555123456" })).resolves.toMatchObject({
      ok: false,
      code: "google_required",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects malformed phone input before privileged work", async () => {
    authenticate();
    await expect(sendPhoneVerificationAction({ phone: "bad" })).resolves.toEqual({
      ok: false,
      code: "invalid_phone",
      message: PHONE_VERIFICATION_MESSAGES.invalid_phone,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("atomically reserves the send before provider work and completes one canonical challenge", async () => {
    authenticate();
    await expect(sendPhoneVerificationAction({ phone: "555 12 34 56" })).resolves.toEqual({
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
    await expect(sendPhoneVerificationAction({ phone: "555123456" })).resolves.toEqual({
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
          ? await sendPhoneVerificationAction({ phone: "555123456" })
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

  it.each(["phone_exists", "user_already_exists"])("maps Auth %s to phone_in_use", async (code) => {
    authenticate();
    mocks.read.mockResolvedValue({ ...activeRow, consumed_at: "2026-08-11T12:04:00.000Z" });
    mocks.updateUserById.mockResolvedValue({ data: null, error: { code } });
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: false,
      code: "phone_in_use",
      message: PHONE_VERIFICATION_MESSAGES.phone_in_use,
    });
  });

  it.each([
    [
      "provider send",
      () => mocks.send.mockRejectedValue(new Error("secret provider details")),
      () => sendPhoneVerificationAction({ phone: "555123456" }),
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
      () => sendPhoneVerificationAction({ phone: "555123456" }),
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
});
