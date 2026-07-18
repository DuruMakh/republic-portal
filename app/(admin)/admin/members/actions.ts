"use server";

import { z } from "zod";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type RevealResult = { ok: true; personalId: string | null } | { ok: false; error: string };

/** super_admin-only member-scope reveal; the RPC re-checks and audits in-DB. */
export async function revealPersonalIdAction(memberId: unknown): Promise<RevealResult> {
  const parsed = z.string().uuid().safeParse(memberId);
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_reveal_personal_id", {
    p_member_id: parsed.data,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, personalId: data ?? null };
}
