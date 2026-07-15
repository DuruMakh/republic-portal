import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/CabinetNav";
import { cabinetNavItems, deriveDestination } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Completion gate (spec §3.2): only completed registrants enter /me/*; everyone
 * else is bounced to their exact funnel step. Runs server-side on every request —
 * safe because the service worker has never cached /me (NetworkOnly, app/sw.ts).
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.rpc("funnel_state");
  if (error || data === null) {
    // transient backend failure must surface as an error, never route a
    // completed member back into the funnel as if they had no profile
    throw new Error(`funnel_state failed: ${error?.message ?? "empty response"}`);
  }
  const state = data as unknown as FunnelState;
  if (!state.exists || !state.completed) redirect(deriveDestination(state));
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <CabinetNav items={cabinetNavItems(state.role)} />
      {children}
    </div>
  );
}
