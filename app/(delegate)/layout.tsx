import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/CabinetNav";
import { cabinetNavItems, deriveDestination } from "@/lib/cabinet";
import { createServerSupabase, getFunnelState } from "@/lib/supabase/server";

/**
 * Delegate gate (spec §3.2): completed delegates only (any verification
 * status); members and unfinished registrants bounce to their own area.
 */
export default async function DelegateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const state = await getFunnelState();
  if (!state.exists || !state.completed || state.role !== "delegate") {
    redirect(deriveDestination(state));
  }
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <CabinetNav items={cabinetNavItems("delegate", state.admin)} />
      {children}
    </div>
  );
}
