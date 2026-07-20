import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "შიგთავსი: ღონისძიებები — ქართული რესპუბლიკა" };

export default async function AdminEventsListPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("admin_events")
    .select("*")
    .order("starts_at", { ascending: false });
  if (error) throw new Error(`admin_events failed: ${error.message}`);
  const rows = data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">ღონისძიებები</h1>
        <ButtonLink href="/admin/content/events/new" size="sm">
          ახალი ღონისძიება
        </ButtonLink>
      </div>
      <DataTable
        bodyTestId="admin-events-body"
        head={
          <>
            <th className={tableThClass}>დასახელება</th>
            <th className={tableThClass}>დრო</th>
            <th className={tableThClass}>ადგილი</th>
            <th className={tableThClass}>სტატუსი</th>
            <th className={tableThClass}>მოდის</th>
            <th className={tableThClass}></th>
          </>
        }
      >
        {rows.map((e) => (
          <tr key={e.id} className={tableRowClass}>
            <td className={`${tableCellClass} font-semibold text-ink`}>{e.title}</td>
            <td className={tableCellClass}>{formatEventTimeKa(e.starts_at, e.ends_at)}</td>
            <td className={tableCellClass}>{e.location}</td>
            <td className={tableCellClass}>
              <Pill {...contentPill(e.status)} />
            </td>
            <td className={tableCellClass}>{formatCountKa(e.going_count)}</td>
            <td className={tableCellClass}>
              <Link
                href={`/admin/content/events/${e.id}`}
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
