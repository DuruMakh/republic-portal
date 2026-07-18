"use server";

import { revalidatePath } from "next/cache";
import { reassignSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type ReassignResult = { ok: true } | { ok: false; error: string };

/** ADR-013 semantics in-DB: close the central row, open the new one, audited. */
export async function reassignMemberAction(
  memberId: unknown,
  delegateId: unknown,
): Promise<ReassignResult> {
  const parsed = reassignSchema.safeParse({ memberId, delegateId });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_reassign_member", {
    p_member_id: parsed.data.memberId,
    p_delegate_id: parsed.data.delegateId,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/transfer");
  return { ok: true };
}
