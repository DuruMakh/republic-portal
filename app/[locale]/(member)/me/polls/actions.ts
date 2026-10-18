"use server";

import { voteInputSchema } from "@/lib/content-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type VoteResult = { ok: true } | { ok: false; error: string };

/** Thin action in front of member_cast_vote — the PK makes double votes impossible. */
export async function voteAction(input: unknown): Promise<VoteResult> {
  const parsed = voteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("member_cast_vote", {
    p_poll_id: parsed.data.pollId,
    p_option_id: parsed.data.optionId,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true };
}
