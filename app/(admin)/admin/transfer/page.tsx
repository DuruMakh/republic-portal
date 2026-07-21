import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { hasAnyRole } from "@/lib/admin";
import { pageParamSchema } from "@/lib/admin-schemas";
import { formatCountKa } from "@/lib/format";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { reassignMemberAction } from "./actions";
import { ReassignRow } from "./ReassignRow";

export const metadata: Metadata = { title: "ტრანსფერი — ადმინისტრირება" };

const PAGE_SIZE = 50;

export default async function AdminTransferPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["verifier", "super_admin"])) redirect("/admin");
  const raw = await searchParams;
  const page = pageParamSchema.parse(raw.page);
  const supabase = await createServerSupabase();

  const from = (page - 1) * PAGE_SIZE;
  const {
    data: orphans,
    count,
    error,
  } = await supabase
    .from("admin_members")
    .select("*", { count: "exact" })
    .is("delegate_id", null)
    .neq("status", "registered")
    .eq("is_delegate", false)
    // mirror admin_reassign_member's gate: only rows the RPC will accept
    .or("registration_completed_at.not.is.null,status.eq.active_member")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`admin_members failed: ${error.message}`);

  const { data: delegates, error: delegatesError } = await supabase
    .from("public_delegates")
    .select("id, first_name, last_name, region_id")
    .order("first_name");
  if (delegatesError) throw new Error(`public_delegates failed: ${delegatesError.message}`);
  const byRegion = new Map<number, { id: string; name: string }[]>();
  for (const d of delegates) {
    if (d.region_id === null) continue;
    const list = byRegion.get(d.region_id) ?? [];
    list.push({ id: d.id, name: `${d.first_name} ${d.last_name}` });
    byRegion.set(d.region_id, list);
  }

  const total = count ?? 0;

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">ადმინისტრაციული ტრანსფერი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          ცენტრალურ მოძრაობაზე მიბმული (ობოლი) წევრები გადაანაწილე შესაბამისი მხარის დამტკიცებულ
          დელეგატებზე.
        </p>
      </div>

      <Card>
        <p className="text-sm text-muted-fg">
          ℹ️ როცა წევრი რეგისტრირდება პირდაპირი დელეგატის გარეშე, ის ავტომატურად ებმის „ცენტრალურ
          მოძრაობას“. აქ შეგიძლია გადაანაწილო ის ადგილობრივ დელეგატზე — გადანაწილება ზრდის დელეგატის
          მხარდამჭერთა რაოდენობას.
        </p>
      </Card>

      <p className="mt-4 text-sm text-muted-fg">ობოლი წევრები: {formatCountKa(total)}</p>

      <div className="mt-2">
        {total === 0 ? (
          <Card>
            <div className="p-4 text-center">
              <p className="text-2xl">✅</p>
              <h3 className="mt-2 text-base font-bold text-ink">ყველა წევრი გადანაწილებულია</h3>
              <p className="mt-1 text-sm text-muted-fg">
                ცენტრალურ მოძრაობაზე მიბმული ობოლი წევრები აღარ დარჩა.
              </p>
            </div>
          </Card>
        ) : (
          <Card padded={false}>
            <DataTable
              bodyTestId="admin-transfer-body"
              head={
                <>
                  <th className={tableThClass}>წევრი</th>
                  <th className={tableThClass}>რეგიონი</th>
                  <th className={`${tableThClass} text-right`}>მიმღები დელეგატი / მოქმედება</th>
                </>
              }
            >
              {orphans.map((m) => (
                <tr key={m.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-semibold`}>
                    {m.first_name} {m.last_name}
                  </td>
                  <td className={tableCellClass}>{m.region_name_ka ?? "—"}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <ReassignRow
                      memberId={m.id}
                      options={m.region_id === null ? [] : (byRegion.get(m.region_id) ?? [])}
                      reassign={reassignMemberAction}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          </Card>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        {page > 1 ? (
          <ButtonLink href={`/admin/transfer?page=${page - 1}`} variant="ghost" size="sm">
            ← წინა
          </ButtonLink>
        ) : (
          <span />
        )}
        {from + PAGE_SIZE < total ? (
          <ButtonLink href={`/admin/transfer?page=${page + 1}`} variant="ghost" size="sm">
            შემდეგი →
          </ButtonLink>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
