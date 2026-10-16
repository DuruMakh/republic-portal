import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { AdminPageHeader, adminRowClass, adminTdClass, adminThClass } from "@/components/AdminUi";
import { Caps } from "@/components/Caps";
import { DataTable } from "@/components/DataTable";
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
      <AdminPageHeader
        title="სიახლეები"
        action={
          <ButtonLink href="/admin/content/news/new" size="sm">
            ახალი სიახლე
          </ButtonLink>
        }
      />
      <Card padded={false}>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-fg">ჯერ ცარიელია.</p>
        ) : (
          <DataTable
            bodyTestId="admin-news-body"
            head={
              <>
                <th className={adminThClass}>
                  <Caps>სათაური</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>ხილვადობა</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>სტატუსი</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>გამოქვეყნდა</Caps>
                </th>
                <th className={adminThClass}></th>
              </>
            }
          >
            {rows.map((n) => (
              <tr key={n.id} className={adminRowClass}>
                <td className={`${adminTdClass} font-semibold text-ink`}>{n.title}</td>
                <td className={adminTdClass}>{VISIBILITY_LABELS_KA[n.visibility]}</td>
                <td className={adminTdClass}>
                  <Pill {...contentPill(n.status)} />
                </td>
                <td className={adminTdClass}>
                  {n.published_at ? formatDateKa(n.published_at) : "—"}
                </td>
                <td className={adminTdClass}>
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
        )}
      </Card>
    </div>
  );
}
