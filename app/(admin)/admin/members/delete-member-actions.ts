"use server";

import { revalidatePath } from "next/cache";
import { adminDeleteMemberSchema, normalizeName } from "@/lib/account-deletion";
import {
  ADMIN_DELETE_NAME_MISMATCH,
  ADMIN_DELETE_STAFF_HISTORY,
} from "@/lib/account-deletion-copy";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { removeDelegatePhotos } from "@/lib/supabase/delegate-photos";
import { createServerSupabase } from "@/lib/supabase/server";

export type DeleteMemberResult = { ok: true } | { ok: false; error: string };

/**
 * The admin's wording for a database refusal. staff_history gets its own sentence: the shared
 * mapFunnelError text speaks to the member themselves ("write to us"), not to the admin.
 */
function refusalMessage(message: string): string {
  return message.includes("staff_history") ? ADMIN_DELETE_STAFF_HISTORY : mapFunnelError(message);
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
  if (error) return { ok: false, error: refusalMessage(error.message) };

  // never throws: the account is already gone, so a leftover photo must not fail the action.
  // The sweep is keyed to the id the database just erased (zod-checked), never to free input.
  const photoUrl = (data as { photoUrl?: unknown } | null)?.photoUrl;
  await removeDelegatePhotos(parsed.data.userId, typeof photoUrl === "string" ? photoUrl : null);
  revalidatePath("/admin/members");
  return { ok: true };
}
