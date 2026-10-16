import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { AdminPageHeader, adminRowClass, adminTdClass, adminThClass } from "@/components/AdminUi";
import { Caps } from "@/components/Caps";
import { DataTable } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa } from "@/lib/community";
import { showEvents } from "@/lib/events-switch";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "შიგთავსი: ღონისძიებები — ქართული რესპუბლიკა" };

export default async function AdminEventsListPage() {
  // Events hidden (the default, ADR-042): the page does not exist, even by its address.
  if (!showEvents()) notFound();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("admin_events")
    .select("*")
    .order("starts_at", { ascending: false });
  if (error) throw new Error(`admin_events failed: ${error.message}`);
  const rows = data ?? [];

  return (
    <div>
      <AdminPageHeader
        title="ღონისძიებები"
        action={
          <ButtonLink href="/admin/content/events/new" size="sm">
            ახალი ღონისძიება
          </ButtonLink>
        }
      />
      <Card padded={false}>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-fg">ჯერ ცარიელია.</p>
        ) : (
          <DataTable
            bodyTestId="admin-events-body"
            head={
              <>
                <th className={adminThClass}>
                  <Caps>დასახელება</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>დრო</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>ადგილი</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>სტატუსი</Caps>
                </th>
                <th className={adminThClass}>
                  <Caps>მოდის</Caps>
                </th>
                <th className={adminThClass}></th>
              </>
            }
          >
            {rows.map((e) => (
              <tr key={e.id} className={adminRowClass}>
                <td className={`${adminTdClass} font-semibold text-ink`}>{e.title}</td>
                <td className={adminTdClass}>{formatEventTimeKa(e.starts_at, e.ends_at)}</td>
                <td className={adminTdClass}>{e.location}</td>
                <td className={adminTdClass}>
                  <Pill {...contentPill(e.status)} />
                </td>
                <td className={adminTdClass}>{formatCountKa(e.going_count)}</td>
                <td className={adminTdClass}>
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
        )}
      </Card>
    </div>
  );
}
