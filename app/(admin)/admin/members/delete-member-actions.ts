"use server";

import { revalidatePath } from "next/cache";
import { adminDeleteMemberSchema, delegatePhotoPath, normalizeName } from "@/lib/account-deletion";
import { ADMIN_DELETE_NAME_MISMATCH } from "@/lib/account-deletion-copy";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type DeleteMemberResult = { ok: true } | { ok: false; error: string };

/**
 * The erased member's delegate photo, if any. The account is already gone when this runs, so
 * nothing here may fail the action: every failure is logged and swallowed, and the service
 * role is created only when there is a path to remove (the path is the database's, never client
 * input).
 */
async function removeDelegatePhoto(result: unknown): Promise<void> {
  try {
    const photoUrl = (result as { photoUrl?: unknown } | null)?.photoUrl;
    const path = typeof photoUrl === "string" ? delegatePhotoPath(photoUrl) : null;
    if (!path) return;
    const { error } = await createAdminClient().storage.from("delegate-photos").remove([path]);
    if (error) console.error("member deletion: photo removal failed", error.message);
  } catch (e) {
    console.error("member deletion: photo removal threw", e instanceof Error ? e.message : e);
  }
}

/**
 * Spec 2026-10-08 §3.4: a top-level admin erases a member on request. Authorization is the
 * RPC's (session, super_admin, reason, not-self, staff refusals, and the member.delete audit
 * row, all in one transaction: ADR-014). It runs on the caller's own session, so auth.uid() is
 * the admin. The typed name is a UX guard against deleting the wrong row, not security.
 */
export async function deleteMemberAction(
  userId: unknown,
  reason: unknown,
  typedName: unknown,
  expectedName: unknown,
): Promise<DeleteMemberResult> {
  const parsed = adminDeleteMemberSchema.safeParse({ userId, reason, typedName });
  if (!parsed.success) {
    // the schema's own messages are Georgian; zod's built-in "Expected string" for a field of
    // the wrong type is English and must not reach the admin (only a forged request sends one)
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue && issue.code !== "invalid_type" ? issue.message : GENERIC_FUNNEL_ERROR,
    };
  }
  if (typeof expectedName !== "string") return { ok: false, error: GENERIC_FUNNEL_ERROR };
  // both sides normalized: the page shows a stored "a  b" or "a<nbsp>b" as one plain space
  if (normalizeName(parsed.data.typedName) !== normalizeName(expectedName)) {
    return { ok: false, error: ADMIN_DELETE_NAME_MISMATCH };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_delete_member", {
    p_user_id: parsed.data.userId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };

  await removeDelegatePhoto(data);
  revalidatePath("/admin/members");
  return { ok: true };
}
