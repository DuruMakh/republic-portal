"use server";

import {
  GENERIC_FUNNEL_ERROR,
  mapFunnelError,
  type ActionResult,
  type CabinetState,
} from "@/lib/funnel";
import { registerActionSchema } from "@/lib/funnel-schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export type { ActionResult };

export async function registerAction(input: unknown): Promise<ActionResult> {
  const parsed = registerActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("register", {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_personal_id: parsed.data.personalId,
    p_ref_code: parsed.data.refCode ?? null,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as unknown as CabinetState };
}
