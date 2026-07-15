import { redirect } from "next/navigation";
import { deriveDestination } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

/** Single cabinet entry point (header „კაბინეტი“): members → profile, delegates → panel. */
export default async function CabinetEntryPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("funnel_state");
  const state = data === null ? null : (data as unknown as FunnelState);
  redirect(deriveDestination(state));
}
