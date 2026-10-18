import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { AdminPageHeader, adminRowClass, adminTdClass, adminThClass } from "@/components/AdminUi";
import { Caps } from "@/components/Caps";
import { DataTable } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatDateKa } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "შიგთავსი: გამოკითხვები — ქართული რესპუბლიკა" };

export default async function AdminPollsListPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("admin_polls")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`admin_polls failed: ${error.message}`);
  const rows = data ?? [];

  return (
    <div>
      <AdminPageHeader
        title="გამოკითხვები"
        action={
          <ButtonLink href="/admin/content/polls/new" size="sm">
            ახალი გამოკითხვა
          </ButtonLink>
        }
      />
      <Card padded={false}>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-fg">ჯერ ცარიელია.</p>
        ) : (
          <DataTable
            bodyTestId="admin-polls-body"
            head={
              <>
                <th className={adminThClass}>
                  <Caps>კითხვა</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>სტატუსი</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>ხმები</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>თარიღები</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>ბოლო ვადა</Caps>
                </th>
                <th className={adminThClass}></th>
              </>
            }
          >
            {rows.map((p) => (
              <tr key={p.id} className={adminRowClass}>
                <td className={`${adminTdClass} font-semibold text-ink`}>{p.question}</td>
                <td className={adminTdClass}>
                  <Pill {...contentPill(p.status)} />
                </td>
                <td className={adminTdClass}>{formatCountKa(p.total_votes)}</td>
                <td className={adminTdClass}>
                  {p.opened_at ? `გაიხსნა ${formatDateKa(p.opened_at)}` : "—"}
                  {p.closed_at ? ` · დაიხურა ${formatDateKa(p.closed_at)}` : ""}
                </td>
                <td className={adminTdClass}>
                  {p.ends_at ? formatEventTimeKa(p.ends_at, null) : "—"}
                </td>
                <td className={adminTdClass}>
                  <Link
                    href={`/admin/content/polls/${p.id}`}
                    className="font-semibold text-brand hover:underline"
                  >
                    {p.status === "draft" ? "რედაქტირება" : "ნახვა"}
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
