import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { formatDateTimeKa, hasAnyRole } from "@/lib/admin";
import {
  SUPPORT_ADMIN_EMPTY,
  SUPPORT_ADMIN_TAB_LABEL,
  SUPPORT_EMAIL_LABEL,
  SUPPORT_MESSAGE_LABEL,
  SUPPORT_NAME_LABEL,
  SUPPORT_PHONE_LABEL,
} from "@/lib/support-copy";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export const metadata: Metadata = { title: SUPPORT_ADMIN_TAB_LABEL };

const PAGE_SIZE = 50;

/**
 * Read-only inbox for the public contact form (spec §6). The client-side role
 * check here is UX — the view itself is self-gating on super_admin, so a
 * caller without the role gets zero rows from the database regardless.
 */
export default async function AdminSupportPage() {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) redirect("/admin");

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("admin_support_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  const rows = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-ink">{SUPPORT_ADMIN_TAB_LABEL}</h1>
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-fg">{SUPPORT_ADMIN_EMPTY}</p>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="p-6">
            <DataTable
              bodyTestId="support-messages"
              head={
                <>
                  <th className={tableThClass}>{SUPPORT_NAME_LABEL}</th>
                  <th className={tableThClass}>{SUPPORT_EMAIL_LABEL}</th>
                  <th className={tableThClass}>{SUPPORT_PHONE_LABEL}</th>
                  <th className={tableThClass}>{SUPPORT_MESSAGE_LABEL}</th>
                </>
              }
            >
              {rows.map((row) => (
                <tr key={row.id} className={tableRowClass}>
                  <td className={`${tableCellClass} align-top`}>
                    {row.name}
                    <span className="block text-[0.74rem] text-muted-fg">
                      {formatDateTimeKa(row.created_at)}
                    </span>
                  </td>
                  <td className={`${tableCellClass} align-top`}>{row.email ?? "—"}</td>
                  <td className={`${tableCellClass} align-top`}>{row.phone ?? "—"}</td>
                  <td className={`${tableCellClass} align-top whitespace-pre-wrap`}>
                    {row.message}
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Card>
      )}
    </div>
  );
}
