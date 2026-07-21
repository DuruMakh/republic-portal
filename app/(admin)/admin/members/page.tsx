import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { hasAnyRole, isStaff, MEMBER_STATUS_LABELS_KA, sanitizeSearch } from "@/lib/admin";
import { adminControlClasses } from "@/components/Field";
import { formatCountKa } from "@/lib/format";
import { membersFilterSchema } from "@/lib/admin-schemas";
import { formatDateKa, formatPhoneKa } from "@/lib/cabinet";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { revealPersonalIdAction } from "./actions";
import { ExportControls } from "./ExportControls";
import { RevealPersonalId } from "./RevealPersonalId";

export const metadata: Metadata = { title: "წევრები — ადმინისტრირება" };

const PAGE_SIZE = 50;

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/members?${next.toString()}`;
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!isStaff(roles)) redirect("/admin");
  const supabase = await createServerSupabase();
  const raw = await searchParams;
  const filter = membersFilterSchema.parse(raw);
  const canReveal = hasAnyRole(roles, ["super_admin"]);
  const canExport = hasAnyRole(roles, ["finance", "super_admin"]);

  let query = supabase.from("admin_members").select("*", { count: "exact" });
  if (filter.search) {
    // ONE sanitizer with the payment lookup and the CSV export — the audited
    // export must never see a different row set than this list
    const s = sanitizeSearch(filter.search);
    if (s.length > 0) {
      query = query.or(
        `first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,reference_code.ilike.%${s}%`,
      );
    }
  }
  if (filter.regionId) query = query.eq("region_id", filter.regionId);
  if (filter.status) query = query.eq("status", filter.status);
  const from = (filter.page - 1) * PAGE_SIZE;
  const {
    data: members,
    count,
    error,
  } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`admin_members failed: ${error.message}`);

  const { data: regions, error: regionsError } = await supabase
    .from("regions")
    .select("id, name_ka")
    .order("id");
  if (regionsError) throw new Error(`regions failed: ${regionsError.message}`);

  const total = count ?? 0;
  const shownFrom = total === 0 ? 0 : from + 1;
  const shownTo = Math.min(from + PAGE_SIZE, total);
  const currentParams = new URLSearchParams();
  if (filter.search) currentParams.set("search", filter.search);
  if (filter.regionId) currentParams.set("regionId", String(filter.regionId));
  if (filter.status) currentParams.set("status", filter.status);

  return (
    <main>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">წევრების მართვა</h1>
        <p className="mt-2 text-sm text-muted-fg">
          გაფილტრე, მოძებნე და დაათვალიერე ყველა რეგისტრირებული წევრი.
        </p>
      </div>

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-2 flex-col gap-1 text-sm font-semibold text-ink">
            ძებნა
            <input
              type="text"
              name="search"
              defaultValue={filter.search ?? ""}
              placeholder="სახელი, ტელეფონი ან GR-კოდი…"
              className={adminControlClasses}
            />
          </label>
          <label className="flex min-w-[170px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            რეგიონი
            <select
              name="regionId"
              defaultValue={filter.regionId ? String(filter.regionId) : ""}
              className={adminControlClasses}
            >
              <option value="">ყველა მხარე</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name_ka}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            სტატუსი
            <select
              name="status"
              defaultValue={filter.status ?? ""}
              className={adminControlClasses}
            >
              <option value="">ყველა სტატუსი</option>
              <option value="active_member">{MEMBER_STATUS_LABELS_KA.active_member}</option>
              <option value="profile_completed">{MEMBER_STATUS_LABELS_KA.profile_completed}</option>
              <option value="registered">{MEMBER_STATUS_LABELS_KA.registered}</option>
            </select>
          </label>
          <Button type="submit" variant="dark">
            ფილტრი
          </Button>
        </form>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-fg">
          ნაჩვენებია {formatCountKa(shownFrom)}–{formatCountKa(shownTo)} / {formatCountKa(total)}
        </p>
        {canExport ? (
          <ExportControls
            search={filter.search}
            regionId={filter.regionId}
            status={filter.status}
            canIncludeIds={hasAnyRole(roles, ["super_admin"])}
          />
        ) : null}
      </div>

      <div className="mt-2">
        <Card padded={false}>
          {members.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-fg">შედეგი ვერ მოიძებნა.</p>
          ) : (
            <DataTable
              bodyTestId="admin-members-body"
              head={
                <>
                  <th className={tableThClass}>სახელი გვარი</th>
                  {/* ტელეფონი is a deliberate addition to the spec's column list:
                    search matches phone, so operators must see why a row matched */}
                  <th className={tableThClass}>ტელეფონი</th>
                  <th className={tableThClass}>რეგიონი</th>
                  <th className={tableThClass}>დელეგატი</th>
                  <th className={tableThClass}>საწევრო</th>
                  <th className={tableThClass}>კოდი</th>
                  <th className={tableThClass}>სტატუსი</th>
                  <th className={tableThClass}>თარიღი</th>
                  {canReveal ? <th className={tableThClass}>პირადი ნომერი</th> : null}
                </>
              }
            >
              {members.map((m) => (
                <tr key={m.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-semibold`}>
                    {m.first_name} {m.last_name}
                    {m.is_delegate ? (
                      <span className="ms-1 text-xs text-muted-fg">· დელეგატი</span>
                    ) : null}
                  </td>
                  <td className={tableCellClass}>{formatPhoneKa(m.phone)}</td>
                  <td className={tableCellClass}>{m.region_name_ka ?? "—"}</td>
                  <td className={tableCellClass}>
                    {m.delegate_id
                      ? `${m.delegate_first_name} ${m.delegate_last_name}`
                      : "ცენტრალური მოძრაობა"}
                  </td>
                  <td className={tableCellClass}>
                    {m.membership_tier === null ? "—" : `${m.membership_tier} ₾`}
                  </td>
                  <td className={`${tableCellClass} font-mono text-xs`}>
                    {m.reference_code ?? "—"}
                  </td>
                  <td className={tableCellClass}>
                    <Pill status={m.status} label={MEMBER_STATUS_LABELS_KA[m.status]} />
                  </td>
                  <td className={`${tableCellClass} text-muted-fg`}>
                    {formatDateKa(m.created_at)}
                  </td>
                  {canReveal ? (
                    <td className={tableCellClass}>
                      <RevealPersonalId memberId={m.id} reveal={revealPersonalIdAction} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <div className="mt-4 flex items-center justify-between">
        {filter.page > 1 ? (
          <ButtonLink href={pageHref(currentParams, filter.page - 1)} variant="ghost" size="sm">
            ← წინა
          </ButtonLink>
        ) : (
          <span />
        )}
        {shownTo < total ? (
          <ButtonLink href={pageHref(currentParams, filter.page + 1)} variant="ghost" size="sm">
            შემდეგი →
          </ButtonLink>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
