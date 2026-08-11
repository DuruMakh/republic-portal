import type { createAdminClient } from "@/lib/supabase/admin";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  cleanupOldChallenges,
  consumeChallenge,
  countRecentChallenges,
  invalidateActiveChallenges,
  readOwnedChallenge,
  recordChallengeFailure,
  storeOrReuseChallenge,
  type ChallengeRow,
} from "./store";

type AdminClient = ReturnType<typeof createAdminClient>;
type QueryResponse = { data?: unknown; error: unknown; count?: number | null };

function makeQuery(response: QueryResponse) {
  const promise = Promise.resolve(response);
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    gt: vi.fn(),
    lt: vi.fn(),
    is: vi.fn(),
    neq: vi.fn(),
    or: vi.fn(),
    single: vi.fn().mockResolvedValue(response),
    maybeSingle: vi.fn().mockResolvedValue(response),
    then: promise.then.bind(promise),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.gt.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  return query;
}

function makeAdmin(queries: ReturnType<typeof makeQuery>[]) {
  const from = vi.fn(() => {
    const query = queries.shift();
    if (!query) throw new Error("unexpected query");
    return {
      ...query,
      insert: vi.fn(() => query),
      update: vi.fn(() => query),
      delete: vi.fn(() => query),
    };
  });
  const rpc = vi.fn();
  return { admin: { from, rpc } as unknown as AdminClient, from, rpc };
}

const baseRow: ChallengeRow = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  phone: "+995555123456",
  purpose: "registration",
  provider: "test",
  provider_request_id: "provider-secret-id",
  verify_attempts: 0,
  expires_at: "2026-08-11T12:05:00.000Z",
  consumed_at: null,
  created_at: "2026-08-11T12:00:00.000Z",
};

describe("phone verification challenge store", () => {
  beforeEach(() => vi.useRealTimers());

  it("counts recent challenges separately for the same user and phone", async () => {
    const userQuery = makeQuery({ error: null, count: 3 });
    const phoneQuery = makeQuery({ error: null, count: 4 });
    const { admin } = makeAdmin([userQuery, phoneQuery]);

    await expect(
      countRecentChallenges(admin, {
        userId: baseRow.user_id,
        phone: baseRow.phone,
        sinceIso: "2026-08-11T11:00:00.000Z",
      }),
    ).resolves.toEqual({ userCount: 3, phoneCount: 4 });

    expect(userQuery.eq).toHaveBeenCalledWith("user_id", baseRow.user_id);
    expect(phoneQuery.eq).toHaveBeenCalledWith("phone", baseRow.phone);
    expect(userQuery.gte).toHaveBeenCalledWith("created_at", "2026-08-11T11:00:00.000Z");
    expect(phoneQuery.gte).toHaveBeenCalledWith("created_at", "2026-08-11T11:00:00.000Z");
  });

  it("cleans up only rows older than 24 hours for the same user or phone", async () => {
    const query = makeQuery({ error: null });
    const { admin } = makeAdmin([query]);

    await cleanupOldChallenges(admin, {
      userId: baseRow.user_id,
      phone: baseRow.phone,
      beforeIso: "2026-08-10T12:00:00.000Z",
    });

    expect(query.lt).toHaveBeenCalledWith("created_at", "2026-08-10T12:00:00.000Z");
    expect(query.or).toHaveBeenCalledWith(
      `user_id.eq.${baseRow.user_id},phone.eq.${baseRow.phone}`,
    );
  });

  it("marks previous active registration challenges consumed on resend", async () => {
    const query = makeQuery({ error: null });
    const { admin, from } = makeAdmin([query]);

    await invalidateActiveChallenges(admin, {
      userId: baseRow.user_id,
      nowIso: "2026-08-11T12:01:00.000Z",
      exceptChallengeId: baseRow.id,
    });

    const update = from.mock.results[0]?.value.update;
    expect(update).toHaveBeenCalledWith({
      consumed_at: "2026-08-11T12:01:00.000Z",
      expires_at: "2026-08-11T12:00:59.999Z",
    });
    expect(query.eq).toHaveBeenCalledWith("user_id", baseRow.user_id);
    expect(query.eq).toHaveBeenCalledWith("purpose", "registration");
    expect(query.is).toHaveBeenCalledWith("consumed_at", null);
    expect(query.gt).toHaveBeenCalledWith("expires_at", "2026-08-11T12:01:00.000Z");
    expect(query.neq).toHaveBeenCalledWith("id", baseRow.id);
  });

  it("returns only the opaque local UUID when inserting a challenge", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00.000Z"));
    const lookup = makeQuery({ data: null, error: null });
    const insert = makeQuery({ data: { id: baseRow.id }, error: null });
    const { admin } = makeAdmin([lookup, insert]);

    const result = await storeOrReuseChallenge(admin, {
      user_id: baseRow.user_id,
      phone: baseRow.phone,
      purpose: "registration",
      provider: "test",
      provider_request_id: baseRow.provider_request_id,
      expires_at: baseRow.expires_at,
    });

    expect(result).toEqual({ id: baseRow.id, reused: false });
    expect(result).not.toHaveProperty("provider_request_id");
  });

  it("reuses the same owned active challenge for an idempotent provider response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:01:00.000Z"));
    const lookup = makeQuery({ data: baseRow, error: null });
    const { admin, from } = makeAdmin([lookup]);

    await expect(
      storeOrReuseChallenge(admin, {
        user_id: baseRow.user_id,
        phone: baseRow.phone,
        purpose: "registration",
        provider: "test",
        provider_request_id: baseRow.provider_request_id,
        expires_at: "2026-08-11T12:06:00.000Z",
      }),
    ).resolves.toEqual({ id: baseRow.id, reused: true });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["user", { user_id: "foreign-user" }],
    ["phone", { phone: "+995599999999" }],
  ])("rejects a provider request ID owned by another %s", async (_field, mismatch) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:01:00.000Z"));
    const lookup = makeQuery({ data: { ...baseRow, ...mismatch }, error: null });
    const { admin } = makeAdmin([lookup]);

    await expect(
      storeOrReuseChallenge(admin, {
        user_id: baseRow.user_id,
        phone: baseRow.phone,
        purpose: "registration",
        provider: "test",
        provider_request_id: baseRow.provider_request_id,
        expires_at: baseRow.expires_at,
      }),
    ).rejects.toThrow("phone verification store failed");
  });

  it("reloads and reuses the owned row when a concurrent unique insert wins", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:01:00.000Z"));
    const lookup = makeQuery({ data: null, error: null });
    const insert = makeQuery({ data: null, error: { code: "23505" } });
    const reload = makeQuery({ data: baseRow, error: null });
    const { admin } = makeAdmin([lookup, insert, reload]);

    await expect(
      storeOrReuseChallenge(admin, {
        user_id: baseRow.user_id,
        phone: baseRow.phone,
        purpose: "registration",
        provider: "test",
        provider_request_id: baseRow.provider_request_id,
        expires_at: baseRow.expires_at,
      }),
    ).resolves.toEqual({ id: baseRow.id, reused: true });
  });

  it("reads only an owned, live unconsumed challenge", async () => {
    const query = makeQuery({ data: baseRow, error: null });
    const { admin } = makeAdmin([query]);
    await expect(
      readOwnedChallenge(admin, {
        challengeId: baseRow.id,
        userId: baseRow.user_id,
        nowIso: "2026-08-11T12:01:00.000Z",
      }),
    ).resolves.toEqual(baseRow);
    expect(query.eq).toHaveBeenCalledWith("id", baseRow.id);
    expect(query.eq).toHaveBeenCalledWith("user_id", baseRow.user_id);
  });

  it("accepts a valid consumed proof but rejects expired, stale, and foreign lookups", async () => {
    const consumed = { ...baseRow, consumed_at: "2026-08-11T12:04:00.000Z" };
    const valid = makeQuery({ data: consumed, error: null });
    const expired = makeQuery({ data: { ...baseRow, expires_at: "2026-08-11T11:59:00.000Z" }, error: null });
    const stale = makeQuery({
      data: { ...baseRow, consumed_at: "2026-08-09T12:04:00.000Z" },
      error: null,
    });
    const foreign = makeQuery({ data: null, error: null });
    const { admin } = makeAdmin([valid, expired, stale, foreign]);
    const input = { challengeId: baseRow.id, userId: baseRow.user_id, nowIso: "2026-08-11T12:05:00.000Z" };

    await expect(readOwnedChallenge(admin, input)).resolves.toEqual(consumed);
    await expect(readOwnedChallenge(admin, input)).resolves.toBeNull();
    await expect(readOwnedChallenge(admin, input)).resolves.toBeNull();
    await expect(readOwnedChallenge(admin, input)).resolves.toBeNull();
  });

  it("throws instead of treating a Supabase query failure as not found", async () => {
    const query = makeQuery({ data: null, error: { message: "backend unavailable" } });
    const { admin } = makeAdmin([query]);
    await expect(
      readOwnedChallenge(admin, {
        challengeId: baseRow.id,
        userId: baseRow.user_id,
        nowIso: "2026-08-11T12:01:00.000Z",
      }),
    ).rejects.toThrow("phone verification store failed");
  });

  it("records failures and consumes challenges atomically with both IDs", async () => {
    const { admin, rpc } = makeAdmin([]);
    rpc.mockResolvedValueOnce({ data: 3, error: null }).mockResolvedValueOnce({ data: true, error: null });

    await expect(recordChallengeFailure(admin, { challengeId: baseRow.id, userId: baseRow.user_id })).resolves.toBe(3);
    await expect(consumeChallenge(admin, { challengeId: baseRow.id, userId: baseRow.user_id })).resolves.toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(1, "record_phone_verification_failure", {
      p_challenge_id: baseRow.id,
      p_user_id: baseRow.user_id,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "consume_phone_verification_challenge", {
      p_challenge_id: baseRow.id,
      p_user_id: baseRow.user_id,
    });
  });
});
