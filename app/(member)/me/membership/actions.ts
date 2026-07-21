"use server";

import { revalidatePath } from "next/cache";
import {
  GENERIC_FUNNEL_ERROR,
  mapFunnelError,
  type ActionResult,
  type CabinetState,
} from "@/lib/funnel";
import { membershipProfileSchema, tierSchema } from "@/lib/funnel-schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export async function saveMembershipProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = membershipProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("become_member_save_profile", {
    p_birth_date: parsed.data.birthDate,
    p_region_id: parsed.data.regionId,
    p_city_id: parsed.data.cityId,
    p_employment: parsed.data.employment,
    p_delegate_id: parsed.data.delegateId,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as unknown as CabinetState };
}

export async function completeMembershipAction(input: unknown): Promise<ActionResult> {
  const parsed = tierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("become_member_complete", {
    p_tier: parsed.data.tier,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  // revalidate the (member) layout so the standing flip reaches the client router cache (stale-nav bug)
  revalidatePath("/me", "layout");
  return { ok: true, state: data as unknown as CabinetState };
}
