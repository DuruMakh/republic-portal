import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { contentPill, VISIBILITY_LABELS_KA } from "@/lib/admin";
import { formatDateKa } from "@/lib/cabinet";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "შიგთავსი: სიახლეები — ქართული რესპუბლიკა" };

export default async function AdminNewsListPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("admin_news")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`admin_news failed: ${error.message}`);
  const rows = data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">სიახლეები</h1>
        <ButtonLink href="/admin/content/news/new" size="sm">
          ახალი სიახლე
        </ButtonLink>
      </div>
      <DataTable
        bodyTestId="admin-news-body"
        head={
          <>
            <th className={tableThClass}>სათაური</th>
            <th className={tableThClass}>ხილვადობა</th>
            <th className={tableThClass}>სტატუსი</th>
            <th className={tableThClass}>გამოქვეყნდა</th>
            <th className={tableThClass}></th>
          </>
        }
      >
        {rows.map((n) => (
          <tr key={n.id} className={tableRowClass}>
            <td className={`${tableCellClass} font-semibold text-ink`}>{n.title}</td>
            <td className={tableCellClass}>{VISIBILITY_LABELS_KA[n.visibility]}</td>
            <td className={tableCellClass}>
              <Pill {...contentPill(n.status)} />
            </td>
            <td className={tableCellClass}>
              {n.published_at ? formatDateKa(n.published_at) : "—"}
            </td>
            <td className={tableCellClass}>
              <Link
                href={`/admin/content/news/${n.id}`}
                className="font-semibold text-brand hover:underline"
              >
                რედაქტირება
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>
      {rows.length === 0 ? <p className="mt-4 text-sm text-muted-fg">ჯერ ცარიელია.</p> : null}
    </div>
  );
}
