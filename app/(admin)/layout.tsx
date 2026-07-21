import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { adminTabs } from "@/lib/admin";
import { deriveDestination } from "@/lib/cabinet";
import { createServerSupabase, getAdminRoles, getCabinetState } from "@/lib/supabase/server";

/**
 * Admin gate (spec §3.1): session + ≥1 admin role, server-side on every request —
 * safe because /admin has been NetworkOnly in the service worker since Phase 0.
 * Role-specific page gates live in each page; the DB re-checks everything anyway.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const roles = await getAdminRoles();
  if (roles.length === 0) redirect(deriveDestination(await getCabinetState()));
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <AdminNav tabs={adminTabs(roles)} />
      {children}
    </div>
  );
}
