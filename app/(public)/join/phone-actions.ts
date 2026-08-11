"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeGeorgianPhone } from "@/lib/validation";
import {
  buildPhoneVerificationIdempotencyKey,
  PHONE_VERIFICATION_MAX_ATTEMPTS,
  PHONE_VERIFICATION_MESSAGES,
  PHONE_VERIFICATION_TTL_SECONDS,
  type PhoneVerificationFailure,
  type PhoneVerificationFailureCode,
  type SendPhoneVerificationActionResult,
  type VerifyPhoneVerificationActionResult,
} from "@/lib/phone-verification/contracts";
import { createPhoneVerificationProvider } from "@/lib/phone-verification/provider";
import {
  completePhoneVerificationSend,
  consumeChallenge,
  readOwnedChallenge,
  reservePhoneVerificationAttempt,
  reservePhoneVerificationSend,
} from "@/lib/phone-verification/store";
import { PhoneVerificationProviderError } from "@/lib/phone-verification/verify-ge";

const sendSchema = z.object({ phone: z.string() });
const verifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

function failure(code: PhoneVerificationFailureCode): PhoneVerificationFailure {
  return { ok: false, code, message: PHONE_VERIFICATION_MESSAGES[code] };
}

function providerFailure(error: unknown): PhoneVerificationFailureCode {
  return error instanceof PhoneVerificationProviderError ? error.code : "service_unavailable";
}

async function attachConfirmedPhone(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  phone: string,
): Promise<VerifyPhoneVerificationActionResult> {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    phone,
    phone_confirm: true,
  });
  if (!error) return { ok: true, phone };
  if (error.code === "phone_exists" || error.code === "user_already_exists") {
    return failure("phone_in_use");
  }
  return failure("service_unavailable");
}

export async function sendPhoneVerificationAction(
  input: unknown,
): Promise<SendPhoneVerificationActionResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return failure("not_authenticated");
  const providers = Array.isArray(user.app_metadata.providers) ? user.app_metadata.providers : [];
  if (!providers.includes("google")) return failure("google_required");

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return failure("invalid_phone");
  const phone = normalizeGeorgianPhone(parsed.data.phone);
  if (!phone) return failure("invalid_phone");

  const nowMs = Date.now();
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return failure("service_unavailable");
  }

  try {
    const idempotencyKey = buildPhoneVerificationIdempotencyKey({
      userId: user.id,
      phone,
      purpose: "registration",
      nowMs,
    });
    const reservation = await reservePhoneVerificationSend(admin, {
      userId: user.id,
      phone,
      idempotencyKey,
    });
    if (!reservation) return failure("too_many_requests");

    const provider = createPhoneVerificationProvider();
    const sent = await provider.send({
      phone,
      purpose: "registration",
      idempotencyKey,
    });
    const expiresAt = new Date(nowMs + PHONE_VERIFICATION_TTL_SECONDS * 1000).toISOString();
    const completed = await completePhoneVerificationSend(admin, {
      reservationId: reservation.reservationId,
      userId: user.id,
      provider: sent.provider,
      providerRequestId: sent.requestId,
      expiresAt,
    });
    return { ok: true, challengeId: completed.id, phone, expiresAt: completed.expiresAt };
  } catch (caught) {
    const code = providerFailure(caught);
    return failure(code === "too_many_requests" ? code : "service_unavailable");
  }
}

export async function verifyPhoneVerificationAction(
  input: unknown,
): Promise<VerifyPhoneVerificationActionResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return failure("not_authenticated");
  const providers = Array.isArray(user.app_metadata.providers) ? user.app_metadata.providers : [];
  if (!providers.includes("google")) return failure("google_required");

  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) {
    const invalidChallenge = parsed.error.issues.some((issue) => issue.path[0] === "challengeId");
    return failure(invalidChallenge ? "expired_code" : "invalid_code");
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return failure("service_unavailable");
  }
  const nowIso = new Date().toISOString();
  try {
    const challenge = await readOwnedChallenge(admin, {
      challengeId: parsed.data.challengeId,
      userId: user.id,
      nowIso,
    });
    if (!challenge) return failure("expired_code");

    if (challenge.consumed_at !== null) {
      return attachConfirmedPhone(admin, user.id, challenge.phone);
    }

    if (challenge.verify_attempts >= PHONE_VERIFICATION_MAX_ATTEMPTS) {
      return failure("too_many_requests");
    }
    if (process.env.PHONE_VERIFICATION_PROVIDER !== challenge.provider) {
      return failure("service_unavailable");
    }

    const reservedAttempt = await reservePhoneVerificationAttempt(admin, {
      challengeId: challenge.id,
      userId: user.id,
    });
    if (reservedAttempt === null) return failure("too_many_requests");

    const provider = createPhoneVerificationProvider();
    try {
      const result = await provider.verify({
        requestId: challenge.provider_request_id,
        code: parsed.data.code,
      });
      if (!result.verified) {
        return failure("invalid_code");
      }
    } catch (caught) {
      const code = providerFailure(caught);
      return failure(code);
    }

    const consumed = await consumeChallenge(admin, {
      challengeId: challenge.id,
      userId: user.id,
    });
    if (!consumed) return failure("expired_code");
    return attachConfirmedPhone(admin, user.id, challenge.phone);
  } catch {
    return failure("service_unavailable");
  }
}
