import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/CabinetNav";
import { cabinetNavItems, cabinetRole } from "@/lib/cabinet";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";

/**
 * Registration gate (spec §3.2/§4.2): any registered visitor enters /me/*;
 * only a missing profile bounces to /join. Nav is standing-aware
 * (cabinetRole: registered/member/delegate) — member-only pages gate
 * themselves on state.completed. Runs server-side on every request — safe
 * because the service worker has never cached /me (NetworkOnly, app/sw.ts).
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
      <CabinetNav items={cabinetNavItems(cabinetRole(state), state.admin)} />
      {children}
    </div>
  );
}
