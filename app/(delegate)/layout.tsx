import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/CabinetNav";
import { cabinetNavItems, deriveDestination } from "@/lib/cabinet";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";

/**
 * Delegate gate (spec §3.2): completed delegates only (any verification
 * status); members and unfinished registrants bounce to their own area.
 * The two checks are deliberately separate (defense in depth): a delegates-row
 * holder who is somehow not completed must land in the cabinet (/me), never
 * back at deriveDestination's "/delegate" — that would be a redirect loop,
 * since deriveDestination sends any delegate-row holder straight back here.
 */
export default async function DelegateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const state = await getCabinetState();
  if (!state.exists || state.role !== "delegate") {
    redirect(deriveDestination(state));
  }
  if (!state.completed) redirect("/me");
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <CabinetNav items={cabinetNavItems("delegate", state.admin)} />
      {children}
    </div>
  );
}
