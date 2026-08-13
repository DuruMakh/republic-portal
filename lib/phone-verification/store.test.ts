import type { createAdminClient } from "@/lib/supabase/admin";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  completePhoneVerificationSend,
  consumeChallenge,
  phoneBelongsToAnotherProfile,
  readOwnedChallenge,
  reservePhoneVerificationAttempt,
  reservePhoneVerificationSend,
  type ChallengeRow,
} from "./store";

type AdminClient = ReturnType<typeof createAdminClient>;

function makeAdmin() {
  const rpc = vi.fn();
  return { admin: { rpc } as unknown as AdminClient, rpc };
}

function makeReadAdmin(response: { data: ChallengeRow | null; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(response);
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { admin: { from: vi.fn(() => query) } as unknown as AdminClient, query };
}

function makePhoneOwnerAdmin(response: { data: { id: string } | null; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(response);
  const query = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), limit: vi.fn(), maybeSingle };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return { admin: { from: vi.fn(() => query) } as unknown as AdminClient, query };
}

const userId = "22222222-2222-4222-8222-222222222222";
const challengeId = "11111111-1111-4111-8111-111111111111";
const reservationId = "33333333-3333-4333-8333-333333333333";
const phone = "+995555123456";
const baseRow: ChallengeRow = {
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

describe("phone verification challenge store", () => {
  it("detects a profile that already owns the phone without returning its identity", async () => {
    const conflict = makePhoneOwnerAdmin({
      data: { id: "44444444-4444-4444-8444-444444444444" },
      error: null,
    });

    await expect(phoneBelongsToAnotherProfile(conflict.admin, { userId, phone })).resolves.toBe(
      true,
    );
    expect(conflict.query.eq).toHaveBeenCalledWith("phone", phone);
    expect(conflict.query.neq).toHaveBeenCalledWith("id", userId);
  });

  it("allows an unclaimed phone and fails closed when the ownership check fails", async () => {
    const available = makePhoneOwnerAdmin({ data: null, error: null });
    await expect(phoneBelongsToAnotherProfile(available.admin, { userId, phone })).resolves.toBe(
      false,
    );

    const failed = makePhoneOwnerAdmin({ data: null, error: { message: "backend unavailable" } });
    await expect(phoneBelongsToAnotherProfile(failed.admin, { userId, phone })).rejects.toThrow(
      "phone verification store failed",
    );
  });

  it("reserves a send atomically and returns only the opaque reservation ID", async () => {
    const { admin, rpc } = makeAdmin();
    rpc.mockResolvedValue({
      data: { status: "reserved", reservation_id: reservationId },
      error: null,
    });
    await expect(
      reservePhoneVerificationSend(admin, { userId, phone, idempotencyKey: "a".repeat(64) }),
    ).resolves.toEqual({ reservationId });
    expect(rpc).toHaveBeenCalledWith("reserve_phone_verification_send", {
      p_user_id: userId,
      p_phone: phone,
      p_idempotency_key: "a".repeat(64),
    });
  });

  it("returns a rate-limit decision without exposing reservation internals", async () => {
    const { admin, rpc } = makeAdmin();
    rpc.mockResolvedValue({ data: { status: "limited" }, error: null });
    await expect(
      reservePhoneVerificationSend(admin, { userId, phone, idempotencyKey: "a".repeat(64) }),
    ).resolves.toBeNull();
  });

  it("fails closed on malformed reservation or backend responses", async () => {
    const { admin, rpc } = makeAdmin();
    rpc.mockResolvedValueOnce({ data: { status: "reserved", reservation_id: "bad" }, error: null });
    await expect(
      reservePhoneVerificationSend(admin, { userId, phone, idempotencyKey: "a".repeat(64) }),
    ).rejects.toThrow("phone verification store failed");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "backend unavailable" } });
    await expect(
      reservePhoneVerificationSend(admin, { userId, phone, idempotencyKey: "a".repeat(64) }),
    ).rejects.toThrow("phone verification store failed");
  });

  it("atomically finalizes the reservation and returns only the canonical challenge", async () => {
    const { admin, rpc } = makeAdmin();
    rpc.mockResolvedValue({
      data: { challenge_id: challengeId, expires_at: baseRow.expires_at },
      error: null,
    });
    await expect(
      completePhoneVerificationSend(admin, {
        reservationId,
        userId,
        provider: "test",
        providerRequestId: baseRow.provider_request_id,
        expiresAt: baseRow.expires_at,
      }),
    ).resolves.toEqual({ id: challengeId, expiresAt: baseRow.expires_at });
    expect(rpc).toHaveBeenCalledWith("complete_phone_verification_send", {
      p_reservation_id: reservationId,
      p_user_id: userId,
      p_provider: "test",
      p_provider_request_id: baseRow.provider_request_id,
      p_expires_at: baseRow.expires_at,
    });
  });

  it("reserves each provider verification attempt atomically before use", async () => {
    const { admin, rpc } = makeAdmin();
    rpc.mockResolvedValue({ data: 5, error: null });
    await expect(reservePhoneVerificationAttempt(admin, { challengeId, userId })).resolves.toBe(5);
    expect(rpc).toHaveBeenCalledWith("reserve_phone_verification_attempt", {
      p_challenge_id: challengeId,
      p_user_id: userId,
    });
  });

  it("returns null when the atomic attempt cap or challenge state rejects a reservation", async () => {
    const { admin, rpc } = makeAdmin();
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(
      reservePhoneVerificationAttempt(admin, { challengeId, userId }),
    ).resolves.toBeNull();
  });

  it("fails closed when the attempt RPC returns an out-of-contract count", async () => {
    const { admin, rpc } = makeAdmin();
    rpc.mockResolvedValue({ data: 6, error: null });
    await expect(reservePhoneVerificationAttempt(admin, { challengeId, userId })).rejects.toThrow(
      "phone verification store failed",
    );
  });

  it("reads only an owned live challenge and accepts a fresh valid consumed proof", async () => {
    const live = makeReadAdmin({ data: baseRow, error: null });
    const input = { challengeId, userId, nowIso: "2026-08-11T12:01:00.000Z" };
    await expect(readOwnedChallenge(live.admin, input)).resolves.toEqual(baseRow);
    expect(live.query.eq).toHaveBeenCalledWith("id", challengeId);
    expect(live.query.eq).toHaveBeenCalledWith("user_id", userId);

    const consumed = { ...baseRow, consumed_at: "2026-08-11T12:04:00.000Z" };
    const recovery = makeReadAdmin({ data: consumed, error: null });
    await expect(
      readOwnedChallenge(recovery.admin, { ...input, nowIso: "2026-08-11T12:05:00.000Z" }),
    ).resolves.toEqual(consumed);
  });

  it("rejects expired, stale-consumed, foreign, and backend-failed reads", async () => {
    const input = { challengeId, userId, nowIso: "2026-08-11T12:05:00.000Z" };
    const cases = [
      makeReadAdmin({ data: { ...baseRow, expires_at: "2026-08-11T11:59:00.000Z" }, error: null }),
      makeReadAdmin({ data: { ...baseRow, consumed_at: "2026-08-09T12:04:00.000Z" }, error: null }),
      makeReadAdmin({ data: null, error: null }),
    ];
    for (const entry of cases)
      await expect(readOwnedChallenge(entry.admin, input)).resolves.toBeNull();
    const failed = makeReadAdmin({ data: null, error: { message: "backend unavailable" } });
    await expect(readOwnedChallenge(failed.admin, input)).rejects.toThrow(
      "phone verification store failed",
    );
  });

  it("consumes the proof atomically with both challenge and user IDs", async () => {
    const { admin, rpc } = makeAdmin();
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(consumeChallenge(admin, { challengeId, userId })).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("consume_phone_verification_challenge", {
      p_challenge_id: challengeId,
      p_user_id: userId,
    });
  });

  it("fails closed when the consume RPC returns a non-boolean value", async () => {
    const { admin, rpc } = makeAdmin();
    rpc.mockResolvedValue({ data: "true", error: null });
    await expect(consumeChallenge(admin, { challengeId, userId })).rejects.toThrow(
      "phone verification store failed",
    );
  });
});
