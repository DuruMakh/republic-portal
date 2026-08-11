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
  cleanup: vi.fn(),
  count: vi.fn(),
  store: vi.fn(),
  invalidate: vi.fn(),
  read: vi.fn(),
  recordFailure: vi.fn(),
  consume: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/phone-verification/provider", () => ({
  createPhoneVerificationProvider: mocks.createProvider,
}));
vi.mock("@/lib/phone-verification/store", () => ({
  cleanupOldChallenges: mocks.cleanup,
  countRecentChallenges: mocks.count,
  storeOrReuseChallenge: mocks.store,
  invalidateActiveChallenges: mocks.invalidate,
  readOwnedChallenge: mocks.read,
  recordChallengeFailure: mocks.recordFailure,
  consumeChallenge: mocks.consume,
}));

import { sendPhoneVerificationAction, verifyPhoneVerificationAction } from "./phone-actions";

const userId = "22222222-2222-4222-8222-222222222222";
const challengeId = "11111111-1111-4111-8111-111111111111";
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
    mocks.cleanup.mockResolvedValue(undefined);
    mocks.count.mockResolvedValue({ userCount: 0, phoneCount: 0 });
    mocks.send.mockResolvedValue({ provider: "test", requestId: "provider-secret-id" });
    mocks.store.mockResolvedValue({ id: challengeId, reused: false });
    mocks.invalidate.mockResolvedValue(undefined);
    mocks.read.mockResolvedValue(activeRow);
    mocks.recordFailure.mockResolvedValue(1);
    mocks.consume.mockResolvedValue(true);
    mocks.verify.mockResolvedValue({ verified: true });
    mocks.updateUserById.mockResolvedValue({ data: {}, error: null });
  });

  it("rejects a missing session before creating privileged dependencies", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(sendPhoneVerificationAction({ phone: "555123456" })).resolves.toEqual({
      ok: false,
      code: "not_authenticated",
      message: PHONE_VERIFICATION_MESSAGES.not_authenticated,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("requires a server-owned Google provider before privileged work", async () => {
    authenticate(["email"]);
    await expect(sendPhoneVerificationAction({ phone: "555123456" })).resolves.toEqual({
      ok: false,
      code: "google_required",
      message: PHONE_VERIFICATION_MESSAGES.google_required,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("rejects a malformed phone before privileged work", async () => {
    authenticate();
    await expect(sendPhoneVerificationAction({ phone: "not-a-phone" })).resolves.toEqual({
      ok: false,
      code: "invalid_phone",
      message: PHONE_VERIFICATION_MESSAGES.invalid_phone,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("enforces the 60-second and hourly limits without calling the provider", async () => {
    authenticate();
    mocks.count.mockResolvedValueOnce({ userCount: 1, phoneCount: 0 });
    await expect(sendPhoneVerificationAction({ phone: "555123456" })).resolves.toMatchObject({
      ok: false,
      code: "too_many_requests",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();

    vi.clearAllMocks();
    authenticate();
    mocks.createServerSupabase.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.createAdminClient.mockReturnValue({ auth: { admin: { updateUserById: mocks.updateUserById } } });
    mocks.cleanup.mockResolvedValue(undefined);
    mocks.count
      .mockResolvedValueOnce({ userCount: 0, phoneCount: 0 })
      .mockResolvedValueOnce({ userCount: 5, phoneCount: 0 });
    await expect(sendPhoneVerificationAction({ phone: "555123456" })).resolves.toMatchObject({
      ok: false,
      code: "too_many_requests",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("sends a normalized phone with an opaque idempotency key and 300-second expiry", async () => {
    authenticate();
    const result = await sendPhoneVerificationAction({ phone: "555 12 34 56" });

    expect(result).toEqual({
      ok: true,
      challengeId,
      phone,
      expiresAt: "2026-08-11T12:05:00.000Z",
    });
    expect(mocks.send).toHaveBeenCalledWith({
      phone,
      purpose: "registration",
      idempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(mocks.send.mock.calls[0]?.[0].idempotencyKey).not.toContain(phone);
    expect(mocks.store).toHaveBeenCalledWith(expect.anything(), {
      user_id: userId,
      phone,
      purpose: "registration",
      provider: "test",
      provider_request_id: "provider-secret-id",
      expires_at: "2026-08-11T12:05:00.000Z",
    });
    expect(mocks.invalidate).toHaveBeenCalledWith(expect.anything(), {
      userId,
      nowIso: "2026-08-11T12:00:00.000Z",
      exceptChallengeId: challengeId,
    });
    expect(result).not.toHaveProperty("provider_request_id");
  });

  it("reuses the provider request expiry and still invalidates older active challenges", async () => {
    authenticate();
    mocks.store.mockResolvedValue({ id: challengeId, reused: true });
    mocks.read.mockResolvedValue({ ...activeRow, expires_at: "2026-08-11T12:04:00.000Z" });

    await expect(sendPhoneVerificationAction({ phone: "555123456" })).resolves.toEqual({
      ok: true,
      challengeId,
      phone,
      expiresAt: "2026-08-11T12:04:00.000Z",
    });
    expect(mocks.invalidate).toHaveBeenCalledWith(expect.anything(), {
      userId,
      nowIso: "2026-08-11T12:00:00.000Z",
      exceptChallengeId: challengeId,
    });
  });

  it.each([
    ["malformed", { challengeId: "bad", code: "123456" }],
    ["foreign", { challengeId, code: "123456" }],
    ["expired", { challengeId, code: "123456" }],
    ["stale consumed", { challengeId, code: "123456" }],
  ])("returns the recovery message for a %s challenge without provider work", async (_name, input) => {
    authenticate();
    mocks.read.mockResolvedValue(null);
    await expect(verifyPhoneVerificationAction(input)).resolves.toEqual({
      ok: false,
      code: "expired_code",
      message: PHONE_VERIFICATION_MESSAGES.expired_code,
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("atomically records a wrong code and maps the provider error to approved copy", async () => {
    authenticate();
    mocks.verify.mockRejectedValue(new PhoneVerificationProviderError("invalid_code"));
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: false,
      code: "invalid_code",
      message: PHONE_VERIFICATION_MESSAGES.invalid_code,
    });
    expect(mocks.recordFailure).toHaveBeenCalledWith(expect.anything(), { challengeId, userId });
  });

  it("returns recovery copy when a concurrent state change prevents wrong-code accounting", async () => {
    authenticate();
    mocks.verify.mockRejectedValue(new PhoneVerificationProviderError("invalid_code"));
    mocks.recordFailure.mockResolvedValue(null);
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: false,
      code: "expired_code",
      message: PHONE_VERIFICATION_MESSAGES.expired_code,
    });
  });

  it("refuses a sixth attempt without calling the provider", async () => {
    authenticate();
    mocks.read.mockResolvedValue({ ...activeRow, verify_attempts: 5 });
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toMatchObject({
      ok: false,
      code: "too_many_requests",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("consumes a correct proof once, then attaches and confirms the phone", async () => {
    authenticate();
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: true,
      phone,
    });
    expect(mocks.consume).toHaveBeenCalledWith(expect.anything(), { challengeId, userId });
    expect(mocks.updateUserById).toHaveBeenCalledWith(userId, { phone, phone_confirm: true });
  });

  it("retries only Auth phone attachment after verification succeeded but attachment failed", async () => {
    authenticate();
    mocks.read
      .mockResolvedValueOnce(activeRow)
      .mockResolvedValueOnce({ ...activeRow, consumed_at: "2026-08-11T12:04:00.000Z" });
    mocks.updateUserById
      .mockResolvedValueOnce({ data: null, error: { code: "unexpected_failure" } })
      .mockResolvedValueOnce({ data: {}, error: null });

    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: false,
      code: "service_unavailable",
      message: PHONE_VERIFICATION_MESSAGES.service_unavailable,
    });
    await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
      ok: true,
      phone,
    });
    expect(mocks.createProvider).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.consume).toHaveBeenCalledTimes(1);
    expect(mocks.updateUserById).toHaveBeenCalledTimes(2);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["phone_exists", "user_already_exists"])(
    "maps Supabase Auth %s to phone_in_use without profile writes",
    async (code) => {
      authenticate();
      mocks.read.mockResolvedValue({ ...activeRow, consumed_at: "2026-08-11T12:04:00.000Z" });
      mocks.updateUserById.mockResolvedValue({ data: null, error: { code } });
      await expect(verifyPhoneVerificationAction({ challengeId, code: "123456" })).resolves.toEqual({
        ok: false,
        code: "phone_in_use",
        message: PHONE_VERIFICATION_MESSAGES.phone_in_use,
      });
      expect(mocks.updateUserById).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["send", () => mocks.send.mockRejectedValue(new Error("secret provider details")), () => sendPhoneVerificationAction({ phone: "555123456" })],
    ["verify", () => mocks.verify.mockRejectedValue(new PhoneVerificationProviderError("service_unavailable")), () => verifyPhoneVerificationAction({ challengeId, code: "123456" })],
    ["config", () => mocks.createProvider.mockImplementation(() => { throw new Error("missing secret"); }), () => sendPhoneVerificationAction({ phone: "555123456" })],
  ])("redacts a %s failure as service_unavailable", async (_name, arrange, act) => {
    authenticate();
    arrange();
    await expect(act()).resolves.toEqual({
      ok: false,
      code: "service_unavailable",
      message: PHONE_VERIFICATION_MESSAGES.service_unavailable,
    });
  });
});
