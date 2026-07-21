"use server";

import {
  changeDelegateSchema,
  profileUpdateSchema,
  registeredNameUpdateSchema,
} from "@/lib/cabinet-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { tierSchema } from "@/lib/funnel-schemas";
import { createServerSupabase } from "@/lib/supabase/server";

// No `state` field: every caller re-reads the truth via router.refresh() (the
// layout/page cabinet_state fetch), so returning state here was dead weight — and,
// for updateProfileAction, an extra read whose transient failure was wrongly
// reported as a failed save even though the UPDATE had already committed.
export type CabinetActionResult = { ok: true } | { ok: false; error: string };

function zodFail(message: string | undefined): CabinetActionResult {
  return { ok: false, error: message ?? GENERIC_FUNNEL_ERROR };
}

/**
 * Scoped-path profile edit (spec §4.1, ADR-013): a plain UPDATE through the
 * caller's own cookie-bound client — the column-scoped grant, own-row RLS and
 * the protect trigger enforce everything in-DB. No service role anywhere.
 */
export async function updateProfileAction(input: unknown): Promise<CabinetActionResult> {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: mapFunnelError("not_authenticated") };
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      region_id: parsed.data.regionId,
      city_id: parsed.data.cityId,
      employment: parsed.data.employment,
    })
    .eq("id", user.id);
  if (error) {
    // 23503 = composite (city_id, region_id) FK — the city isn't in the chosen region
    if (error.code === "23503") return { ok: false, error: mapFunnelError("invalid_city") };
    return { ok: false, error: GENERIC_FUNNEL_ERROR };
  }
  return { ok: true };
}

/**
 * Registered-standing name edit (spec §4.2): same scoped-path pattern as
 * updateProfileAction, narrowed to the two columns a registered row actually
 * has editable meaning for — region/city/employment don't exist yet (Task 7).
 */
export async function updateRegisteredNameAction(input: unknown): Promise<CabinetActionResult> {
  const parsed = registeredNameUpdateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: mapFunnelError("not_authenticated") };
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: parsed.data.firstName, last_name: parsed.data.lastName })
    .eq("id", user.id);
  if (error) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  return { ok: true };
}

export async function changeDelegateAction(input: unknown): Promise<CabinetActionResult> {
  const parsed = changeDelegateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("member_change_delegate", {
    p_delegate_id: parsed.data.delegateId,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true };
}

export async function changeTierAction(input: unknown): Promise<CabinetActionResult> {
  const parsed = tierSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error.issues[0]?.message);
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("member_change_tier", { p_tier: parsed.data.tier });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true };
}
