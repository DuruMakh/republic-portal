import "server-only";

import { z } from "zod";
import type { createAdminClient } from "@/lib/supabase/admin";
import { timestampMicros } from "./timestamps";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface ChallengeRow {
  id: string;
  user_id: string;
  phone: string;
  purpose: "registration";
  provider: "verify_ge" | "test";
  provider_request_id: string;
  verify_attempts: number;
  expires_at: string;
  consumed_at: string | null;
  /** Set when a newer send replaced this challenge; a superseded challenge is never usable. */
  superseded_at: string | null;
  created_at: string;
}

const sendReservationResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("reserved"), reservation_id: z.string().uuid() }),
  z.object({ status: z.literal("limited") }),
]);

const completedSendSchema = z.object({
  challenge_id: z.string().uuid(),
  expires_at: z.string().datetime({ offset: true }),
});
const reservedAttemptSchema = z.number().int().min(1).max(5).nullable();
const consumedChallengeSchema = z.boolean();

function storeError(): Error {
  return new Error("phone verification store failed");
}

/** A consumed proof stays usable for idempotent re-attachment for one day. */
const PROOF_WINDOW_MICROS = 24n * 60n * 60n * 1_000_000n;

function exactMicros(value: string): bigint {
  const micros = timestampMicros(value);
  if (micros === null) throw storeError();
  return micros;
}

export async function phoneBelongsToAnotherProfile(
  admin: AdminClient,
  input: { userId: string; phone: string },
): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", input.phone)
    .neq("id", input.userId)
    .limit(1)
    .maybeSingle();
  if (error) throw storeError();
  return data !== null;
}

export async function reservePhoneVerificationSend(
  admin: AdminClient,
  input: { userId: string; phone: string; idempotencyKey: string },
): Promise<{ reservationId: string } | null> {
  const { data, error } = await admin.rpc("reserve_phone_verification_send", {
    p_user_id: input.userId,
    p_phone: input.phone,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw storeError();
  const parsed = sendReservationResultSchema.safeParse(data);
  if (!parsed.success) throw storeError();
  return parsed.data.status === "limited" ? null : { reservationId: parsed.data.reservation_id };
}

export async function completePhoneVerificationSend(
  admin: AdminClient,
  input: {
    reservationId: string;
    userId: string;
    provider: "verify_ge" | "test";
    providerRequestId: string;
    expiresAt: string;
  },
): Promise<{ id: string; expiresAt: string }> {
  const { data, error } = await admin.rpc("complete_phone_verification_send", {
    p_reservation_id: input.reservationId,
    p_user_id: input.userId,
    p_provider: input.provider,
    p_provider_request_id: input.providerRequestId,
    p_expires_at: input.expiresAt,
  });
  if (error) throw storeError();
  const parsed = completedSendSchema.safeParse(data);
  if (!parsed.success) throw storeError();
  return { id: parsed.data.challenge_id, expiresAt: parsed.data.expires_at };
}

export async function readOwnedChallenge(
  admin: AdminClient,
  input: { challengeId: string; userId: string; nowIso: string },
): Promise<ChallengeRow | null> {
  const { data, error } = await admin
    .from("phone_verification_challenges")
    .select("*")
    .eq("id", input.challengeId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error) throw storeError();
  if (!data) return null;
  // `typeof` rather than `!== null`: on a database that has not received the
  // superseded_at migration yet the field is absent, and that must not reject every row.
  if (typeof data.superseded_at === "string") return null;

  // Exact to the microsecond (security audit C1): a superseded challenge was once stamped
  // consumed_at = expires_at + 1µs, which millisecond Date math read as "in time".
  const now = exactMicros(input.nowIso);
  const expires = exactMicros(data.expires_at);
  if (data.consumed_at === null) return expires > now ? data : null;

  const consumed = exactMicros(data.consumed_at);
  const consumedIsValid =
    consumed <= expires && consumed <= now && consumed >= now - PROOF_WINDOW_MICROS;
  return consumedIsValid ? data : null;
}

export async function reservePhoneVerificationAttempt(
  admin: AdminClient,
  input: { challengeId: string; userId: string },
): Promise<number | null> {
  const { data, error } = await admin.rpc("reserve_phone_verification_attempt", {
    p_challenge_id: input.challengeId,
    p_user_id: input.userId,
  });
  if (error) throw storeError();
  const parsed = reservedAttemptSchema.safeParse(data);
  if (!parsed.success) throw storeError();
  return parsed.data;
}

export async function consumeChallenge(
  admin: AdminClient,
  input: { challengeId: string; userId: string },
): Promise<boolean> {
  const { data, error } = await admin.rpc("consume_phone_verification_challenge", {
    p_challenge_id: input.challengeId,
    p_user_id: input.userId,
  });
  if (error) throw storeError();
  const parsed = consumedChallengeSchema.safeParse(data);
  if (!parsed.success) throw storeError();
  return parsed.data;
}
