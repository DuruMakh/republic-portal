import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { hasAnyRole, ROLE_LABELS_KA, type AdminRole } from "@/lib/admin";
import { formatDateKa, formatPhoneKa } from "@/lib/cabinet";
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">ადმინების მართვა</h1>
        <p className="mt-2 text-sm text-muted-fg">
          როლების მინიჭება და მოხსნა — ყველა ცვლილება აღირიცხება აუდიტის ჟურნალში.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Card header={<h3 className="text-base font-bold text-ink">როლის მინიჭება</h3>}>
          <GrantRoleForm find={findAdminCandidateAction} grant={grantRoleAction} />
        </Card>

        <Card
          header={<h3 className="text-base font-bold text-ink">მიმდინარე ადმინები</h3>}
          padded={false}
        >
          <DataTable
            bodyTestId="admin-admins-body"
            head={
              <>
                <th className={tableThClass}>ადმინი</th>
                <th className={tableThClass}>ტელეფონი</th>
                <th className={tableThClass}>როლები</th>
                <th className={tableThClass}>მინიჭების თარიღი</th>
              </>
            }
          >
            {[...byUser.entries()].map(([userId, admin]) => (
              <tr key={userId} className={tableRowClass}>
                <td className={`${tableCellClass} font-semibold`}>{admin.name}</td>
                <td className={tableCellClass}>{formatPhoneKa(admin.phone)}</td>
                <td className={tableCellClass}>
                  <span className="flex flex-wrap gap-2">
                    {admin.roles.map((r) => (
                      <span
                        key={r.role}
                        className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink"
                      >
                        {ROLE_LABELS_KA[r.role]}
                        <RevokeRoleButton userId={userId} role={r.role} revoke={revokeRoleAction} />
                      </span>
                    ))}
                  </span>
                </td>
                <td className={`${tableCellClass} text-muted-fg`}>
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
