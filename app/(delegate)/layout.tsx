import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/CabinetNav";
import { cabinetNavItems, deriveDestination, isApprovedDelegate } from "@/lib/cabinet";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";

/**
 * Delegate gate (R2): APPROVED delegates only. Pending/rejected requesters and
 * everyone else land on their derived destination — which, since R2, never
 * points a non-approved delegacy back here, so no redirect loop is possible;
 * the delegates-require-completed-member trigger removes the half-formed
 * hybrid the R1 guard defended against.
 */
export default async function DelegateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const state = await getCabinetState();
  if (!state.exists || !isApprovedDelegate(state)) {
    redirect(deriveDestination(state));
  }
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <CabinetNav items={cabinetNavItems("delegate", state.admin)} />
      {children}
    </div>
  );
}
