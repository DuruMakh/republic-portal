"use server";

import { revalidatePath } from "next/cache";
import { graceDaysSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

/** Updates the rule AND recomputes every member in the same transaction (spec §3.9). */
export async function updateGraceDaysAction(graceDays: unknown): Promise<SettingsActionResult> {
  const parsed = graceDaysSchema.safeParse({ graceDays });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_update_setting", {
    p_key: "active_grace_days",
    p_value: parsed.data.graceDays,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/settings");
  return { ok: true };
}
