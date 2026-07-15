"use server";

import { GENERIC_FUNNEL_ERROR, mapFunnelError, type FunnelState } from "@/lib/funnel";
import { profileActionSchema, startSchema, tierSchema } from "@/lib/funnel-schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: true; state: FunnelState } | { ok: false; error: string };

function zodFail(message: string | undefined): ActionResult {
  return { ok: false, error: message ?? GENERIC_FUNNEL_ERROR };
}

export async function funnelStartAction(input: unknown): Promise<ActionResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("funnel_start", {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_role: parsed.data.role,
    p_ref_code: parsed.data.refCode ?? null,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as FunnelState };
}

export async function funnelSaveProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileActionSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("funnel_save_profile", {
    p_personal_id: parsed.data.personalId,
    p_birth_date: parsed.data.birthDate,
    p_region_id: parsed.data.regionId,
    p_city_id: parsed.data.cityId,
    p_employment: parsed.data.employment,
    p_delegate_id: parsed.data.role === "member" ? parsed.data.delegateId : null,
    p_tc_accepted: parsed.data.role === "delegate",
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as FunnelState };
}

export async function funnelCompleteAction(input: unknown): Promise<ActionResult> {
  const parsed = tierSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("funnel_complete", { p_tier: parsed.data.tier });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, state: data as FunnelState };
}
