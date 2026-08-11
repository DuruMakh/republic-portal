import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

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
  created_at: string;
}

type NewChallenge = Omit<ChallengeRow, "id" | "verify_attempts" | "consumed_at" | "created_at">;

function storeError(): Error {
  return new Error("phone verification store failed");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function isReusable(row: ChallengeRow, input: NewChallenge): boolean {
  return (
    row.user_id === input.user_id &&
    row.phone === input.phone &&
    row.purpose === input.purpose &&
    row.provider === input.provider &&
    row.provider_request_id === input.provider_request_id &&
    row.consumed_at === null &&
    Date.parse(row.expires_at) > Date.now()
  );
}

async function findByProviderRequest(
  admin: AdminClient,
  input: Pick<NewChallenge, "provider" | "provider_request_id">,
): Promise<ChallengeRow | null> {
  const { data, error } = await admin
    .from("phone_verification_challenges")
    .select("*")
    .eq("provider", input.provider)
    .eq("provider_request_id", input.provider_request_id)
    .maybeSingle();
  if (error) throw storeError();
  return data;
}

export async function countRecentChallenges(
  admin: AdminClient,
  input: { userId: string; phone: string; sinceIso: string },
): Promise<{ userCount: number; phoneCount: number }> {
  const [userResult, phoneResult] = await Promise.all([
    admin
      .from("phone_verification_challenges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", input.userId)
      .gte("created_at", input.sinceIso),
    admin
      .from("phone_verification_challenges")
      .select("id", { count: "exact", head: true })
      .eq("phone", input.phone)
      .gte("created_at", input.sinceIso),
  ]);
  if (userResult.error || phoneResult.error) throw storeError();
  return { userCount: userResult.count ?? 0, phoneCount: phoneResult.count ?? 0 };
}

export async function cleanupOldChallenges(
  admin: AdminClient,
  input: { userId: string; phone: string; beforeIso: string },
): Promise<void> {
  const { error } = await admin
    .from("phone_verification_challenges")
    .delete()
    .lt("created_at", input.beforeIso)
    .or(`user_id.eq.${input.userId},phone.eq.${input.phone}`);
  if (error) throw storeError();
}

export async function invalidateActiveChallenges(
  admin: AdminClient,
  input: { userId: string; nowIso: string; exceptChallengeId: string },
): Promise<void> {
  const expiredBeforeConsumption = new Date(Date.parse(input.nowIso) - 1).toISOString();
  const { error } = await admin
    .from("phone_verification_challenges")
    .update({ consumed_at: input.nowIso, expires_at: expiredBeforeConsumption })
    .eq("user_id", input.userId)
    .eq("purpose", "registration")
    .is("consumed_at", null)
    .gt("expires_at", input.nowIso)
    .neq("id", input.exceptChallengeId);
  if (error) throw storeError();
}

export async function storeOrReuseChallenge(
  admin: AdminClient,
  input: NewChallenge,
): Promise<{ id: string; reused: boolean }> {
  const existing = await findByProviderRequest(admin, input);
  if (existing) {
    if (!isReusable(existing, input)) throw storeError();
    return { id: existing.id, reused: true };
  }

  const { data, error } = await admin
    .from("phone_verification_challenges")
    .insert(input)
    .select("id")
    .single();
  if (!error && data) return { id: data.id, reused: false };
  if (!isUniqueViolation(error)) throw storeError();

  const concurrent = await findByProviderRequest(admin, input);
  if (!concurrent || !isReusable(concurrent, input)) throw storeError();
  return { id: concurrent.id, reused: true };
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

  const now = Date.parse(input.nowIso);
  const expires = Date.parse(data.expires_at);
  if (data.consumed_at === null) return expires > now ? data : null;

  const consumed = Date.parse(data.consumed_at);
  const consumedIsValid =
    consumed <= expires && consumed <= now && consumed >= now - 24 * 60 * 60 * 1000;
  return consumedIsValid ? data : null;
}

export async function recordChallengeFailure(
  admin: AdminClient,
  input: { challengeId: string; userId: string },
): Promise<number | null> {
  const { data, error } = await admin.rpc("record_phone_verification_failure", {
    p_challenge_id: input.challengeId,
    p_user_id: input.userId,
  });
  if (error) throw storeError();
  return data;
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
  return data;
}
