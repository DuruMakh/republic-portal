import { redirect } from "next/navigation";
import { deriveDestination } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

/** Single cabinet entry point (header „კაბინეტი“): members → profile, delegates → panel. */
export default async function CabinetEntryPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("funnel_state");
  if (error || data === null) {
    // transient backend failure must surface as an error, never route a
    // completed member back into the funnel as if they had no profile
    throw new Error(`funnel_state failed: ${error?.message ?? "empty response"}`);
  }
  const state = data as unknown as FunnelState;
  redirect(deriveDestination(state));
}
