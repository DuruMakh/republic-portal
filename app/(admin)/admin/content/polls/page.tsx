import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">გამოკითხვები</h1>
        <ButtonLink href="/admin/content/polls/new" size="sm">
          ახალი გამოკითხვა
        </ButtonLink>
      </div>
      <DataTable
        bodyTestId="admin-polls-body"
        head={
          <>
            <th className={tableThClass}>კითხვა</th>
            <th className={tableThClass}>სტატუსი</th>
            <th className={tableThClass}>ხმები</th>
            <th className={tableThClass}>თარიღები</th>
            <th className={tableThClass}>ბოლო ვადა</th>
            <th className={tableThClass}></th>
          </>
        }
      >
        {rows.map((p) => (
          <tr key={p.id} className={tableRowClass}>
            <td className={`${tableCellClass} font-semibold text-ink`}>{p.question}</td>
            <td className={tableCellClass}>
              <Pill {...contentPill(p.status)} />
            </td>
            <td className={tableCellClass}>{formatCountKa(p.total_votes)}</td>
            <td className={tableCellClass}>
              {p.opened_at ? `გაიხსნა ${formatDateKa(p.opened_at)}` : "—"}
              {p.closed_at ? ` · დაიხურა ${formatDateKa(p.closed_at)}` : ""}
            </td>
            <td className={tableCellClass}>
              {p.ends_at ? formatEventTimeKa(p.ends_at, null) : "—"}
            </td>
            <td className={tableCellClass}>
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
      {rows.length === 0 ? <p className="mt-4 text-sm text-muted-fg">ჯერ ცარიელია.</p> : null}
    </div>
  );
}
