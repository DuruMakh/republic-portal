import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import {
  AdminPageHeader,
  adminRowClass,
  AdminSectionTitle,
  adminTdClass,
  adminThClass,
} from "@/components/AdminUi";
import { Caps } from "@/components/Caps";
import { DataTable } from "@/components/DataTable";
import { hasAnyRole, ROLE_LABELS_KA, roleDutiesKa, type AdminRole } from "@/lib/admin";
import { formatDateKa, formatPhoneKa } from "@/lib/cabinet";
import { showEvents } from "@/lib/events-switch";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { findAdminCandidateAction, grantRoleAction, revokeRoleAction } from "./actions";
import { GrantRoleForm } from "./GrantRoleForm";
import { RevokeRoleButton } from "./RevokeRoleButton";

export const metadata: Metadata = { title: "ადმინები — ადმინისტრირება" };

export default async function AdminAdminsPage() {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) redirect("/admin");
  const supabase = await createServerSupabase();
  const { data: rows, error } = await supabase
    .from("admin_admins")
    .select("*")
    .order("granted_at", { ascending: true });
  if (error) throw new Error(`admin_admins failed: ${error.message}`);

  const byUser = new Map<
    string,
    {
      name: string;
      phone: string | null;
      roles: { role: AdminRole; grantedAt: string; grantedBy: string | null }[];
    }
  >();
  for (const r of rows) {
    const entry = byUser.get(r.user_id) ?? {
      name: `${r.first_name} ${r.last_name}`,
      phone: r.phone,
      roles: [],
    };
    entry.roles.push({
      role: r.role as AdminRole,
      grantedAt: r.granted_at,
      grantedBy: r.granted_by_first_name
        ? `${r.granted_by_first_name} ${r.granted_by_last_name}`
        : null,
    });
    byUser.set(r.user_id, entry);
  }

  return (
    <main>
      <AdminPageHeader
        title="ადმინების მართვა"
        lede="როლების მინიჭება და მოხსნა — ყველა ცვლილება აღირიცხება აუდიტის ჟურნალში."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 font-serif text-[22px] leading-[1.3] font-semibold">
            როლის მინიჭება
          </h2>
          <GrantRoleForm
            find={findAdminCandidateAction}
            grant={grantRoleAction}
            duties={roleDutiesKa(showEvents())}
          />
        </Card>

        <Card>
          <AdminSectionTitle>მიმდინარე ადმინები</AdminSectionTitle>
          <DataTable
            bodyTestId="admin-admins-body"
            head={
              <>
                <th className={adminThClass}>
                  <Caps>ადმინი</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>ტელეფონი</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>როლები</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>მინიჭების თარიღი</Caps>
                </th>
              </>
            }
          >
            {[...byUser.entries()].map(([userId, admin]) => (
              <tr key={userId} className={adminRowClass}>
                <td className={`${adminTdClass} font-semibold`}>{admin.name}</td>
                <td className={adminTdClass}>{formatPhoneKa(admin.phone)}</td>
                <td className={adminTdClass}>
                  <span className="flex flex-wrap gap-2">
                    {admin.roles.map((r) => (
                      <span
                        key={r.role}
                        className="inline-flex items-center gap-1 bg-surface px-2 py-0.5 text-xs font-semibold text-ink"
                      >
                        {ROLE_LABELS_KA[r.role]}
                        <RevokeRoleButton userId={userId} role={r.role} revoke={revokeRoleAction} />
                      </span>
                    ))}
                  </span>
                </td>
                <td className={`${adminTdClass} text-muted-fg`}>
                  {formatDateKa(admin.roles[0]!.grantedAt)}
                  {admin.roles[0]!.grantedBy ? ` · ${admin.roles[0]!.grantedBy}` : ""}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </main>
  );
}
