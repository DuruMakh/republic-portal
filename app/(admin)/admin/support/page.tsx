import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { formatDateTimeKa, hasAnyRole } from "@/lib/admin";
import { pageParamSchema } from "@/lib/admin-schemas";
import {
  SUPPORT_ADMIN_EMAIL_HEADING,
  SUPPORT_ADMIN_EMPTY,
  SUPPORT_ADMIN_NEXT,
  SUPPORT_ADMIN_PHONE_HEADING,
  SUPPORT_ADMIN_PREV,
  SUPPORT_ADMIN_TAB_LABEL,
  SUPPORT_MESSAGE_LABEL,
  SUPPORT_NAME_LABEL,
} from "@/lib/support-copy";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `${SUPPORT_ADMIN_TAB_LABEL} — ადმინისტრირება` };

const PAGE_SIZE = 50;

/**
 * Read-only inbox for the public contact form (spec §6). The role check here is
 * UX — the view itself is self-gating on super_admin, so a caller without the
 * role gets zero rows from the database regardless.
 */
export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) redirect("/admin");
  const page = pageParamSchema.parse((await searchParams).page);

  const supabase = await createServerSupabase();
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("admin_support_messages")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeFrom + PAGE_SIZE - 1);
  // Throwing, like every sibling admin page: swallowing this rendered a broken
  // or unmigrated inbox as "there are no messages", which is indistinguishable
  // from a working empty one — on the only surface that proves messages arrive.
  if (error) throw new Error(`admin_support_messages failed: ${error.message}`);
  const rows = data ?? [];
  const total = count ?? 0;

  return (
    <main>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-[2rem] font-bold text-ink">{SUPPORT_ADMIN_TAB_LABEL}</h1>
      </div>

      <Card padded={false}>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-fg">{SUPPORT_ADMIN_EMPTY}</p>
        ) : (
          <DataTable
            bodyTestId="support-messages"
            head={
              <>
                <th className={tableThClass}>{SUPPORT_NAME_LABEL}</th>
                <th className={tableThClass}>{SUPPORT_ADMIN_EMAIL_HEADING}</th>
                <th className={tableThClass}>{SUPPORT_ADMIN_PHONE_HEADING}</th>
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
                <td className={`${tableCellClass} align-top whitespace-pre-wrap`}>{row.message}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
        {page > 1 ? (
          <ButtonLink href={`/admin/support?page=${page - 1}`} variant="ghost" size="sm">
            {SUPPORT_ADMIN_PREV}
          </ButtonLink>
        ) : (
          <span />
        )}
        {rangeFrom + PAGE_SIZE < total ? (
          <ButtonLink href={`/admin/support?page=${page + 1}`} variant="ghost" size="sm">
            {SUPPORT_ADMIN_NEXT}
          </ButtonLink>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
