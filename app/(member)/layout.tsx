import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/CabinetNav";
import { cabinetNavItems } from "@/lib/cabinet";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";

/**
 * Registration gate (spec §3.2): any registered visitor enters /me/*; only a
 * missing profile bounces to /join. Runs server-side on every request — safe
 * because the service worker has never cached /me (NetworkOnly, app/sw.ts).
 * TODO(Task 6): standing-aware routing (registered vs member) lands here.
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const state = await getCabinetState();
  if (!state.exists) redirect("/join");
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <CabinetNav items={cabinetNavItems(state.role, state.admin)} />
      {children}
    </div>
  );
}
