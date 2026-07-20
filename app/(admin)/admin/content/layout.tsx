import { redirect } from "next/navigation";
import { ContentNav } from "@/components/ContentNav";
import { hasAnyRole } from "@/lib/admin";
import { getAdminRoles } from "@/lib/supabase/server";

/**
 * Content gate (spec §3.7): editor | super_admin. The outer (admin) layout has
 * already required a session + ≥1 admin role; the DB re-checks every read
 * (admin_* content views) and mutation (RPC role checks) regardless.
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["editor", "super_admin"])) redirect("/admin");
  return (
    <div>
      <ContentNav />
      {children}
    </div>
  );
}
