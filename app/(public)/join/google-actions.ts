"use server";

import {
  GENERIC_FUNNEL_ERROR,
  mapFunnelError,
  type ActionResult,
  type CabinetState,
} from "@/lib/funnel";
import { registerActionSchema } from "@/lib/funnel-schemas";
import { PHONE_VERIFICATION_MESSAGES } from "@/lib/phone-verification/contracts";
import { createServerSupabase } from "@/lib/supabase/server";

function mapGoogleRegistrationError(message: string | null | undefined): string {
  if (message?.includes("phone_in_use")) return PHONE_VERIFICATION_MESSAGES.phone_in_use;
  return mapFunnelError(message);
}

export async function registerGoogleAction(input: unknown): Promise<ActionResult> {
  const parsed = registerActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("register_google", {
      p_first_name: parsed.data.firstName,
      p_last_name: parsed.data.lastName,
      p_ref_code: parsed.data.refCode ?? null,
    });
    if (error) return { ok: false, error: mapGoogleRegistrationError(error.message) };
    return { ok: true, state: data as unknown as CabinetState };
  } catch {
    return { ok: false, error: GENERIC_FUNNEL_ERROR };
  }
}
