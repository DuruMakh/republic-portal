"use server";

import { GENERIC_FUNNEL_ERROR, mapFunnelError, type CabinetState } from "@/lib/funnel";
import { registerActionSchema } from "@/lib/funnel-schemas";
import { PHONE_VERIFICATION_MESSAGES } from "@/lib/phone-verification/contracts";
import { createServerSupabase } from "@/lib/supabase/server";

export type GoogleRegistrationFailureCode =
  | "invalid_input"
  | "not_authenticated"
  | "google_required"
  | "phone_required"
  | "service_unavailable";

export type GoogleRegistrationActionResult =
  | { ok: true; state: CabinetState }
  | { ok: false; code: GoogleRegistrationFailureCode; error: string };

interface GoogleRegistrationRpcError {
  code?: unknown;
  message?: unknown;
}

function mapGoogleRegistrationError(
  error: GoogleRegistrationRpcError,
): Extract<GoogleRegistrationActionResult, { ok: false }> {
  if (error.code === "P0001") {
    switch (error.message) {
      case "not_authenticated":
        return {
          ok: false,
          code: "not_authenticated",
          error: PHONE_VERIFICATION_MESSAGES.not_authenticated,
        };
      case "google_required":
        return { ok: false, code: "google_required", error: mapFunnelError(error.message) };
      case "phone_required":
        return { ok: false, code: "phone_required", error: mapFunnelError(error.message) };
    }
  }
  return { ok: false, code: "service_unavailable", error: GENERIC_FUNNEL_ERROR };
}

export async function registerGoogleAction(
  input: unknown,
): Promise<GoogleRegistrationActionResult> {
  const parsed = registerActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR,
    };
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("register_google", {
      p_first_name: parsed.data.firstName,
      p_last_name: parsed.data.lastName,
      p_ref_code: parsed.data.refCode ?? null,
    });
    if (error) return mapGoogleRegistrationError(error);
    return { ok: true, state: data as unknown as CabinetState };
  } catch {
    return { ok: false, code: "service_unavailable", error: GENERIC_FUNNEL_ERROR };
  }
}
