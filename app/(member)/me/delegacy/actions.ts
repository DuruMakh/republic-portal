"use server";

import { revalidatePath } from "next/cache";
import { mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type DelegacyActionResult = { ok: true } | { ok: false; error: string };

/** No input to parse — request_delegacy() re-checks standing + uniqueness in-DB (ADR-009). */
export async function requestDelegacyAction(): Promise<DelegacyActionResult> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("request_delegacy");
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  // the profile card + this page both flip to pending
  revalidatePath("/me", "layout");
  return { ok: true };
}
