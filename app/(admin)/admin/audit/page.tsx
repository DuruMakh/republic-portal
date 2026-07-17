import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { adminControlClasses } from "@/components/Field";
import {
  AUDIT_ACTION_LABELS_KA,
  auditActionLabel,
  formatDateTimeKa,
  hasAnyRole,
  TARGET_TYPE_LABELS_KA,
} from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "აუდიტი — ადმინისტრირება" };

const PAGE_SIZE = 50;

function detailsLabel(details: Json | null): string | null {
  if (details === null || typeof details !== "object" || Array.isArray(details)) return null;
  const d = details as Record<string, Json | undefined>;
  const name = d.memberName ?? d.name;
  return typeof name === "string" ? name : null;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) redirect("/admin");
  const raw = await searchParams;
  // integer-shape guard — a hand-edited ?page=1.5 / Infinity must degrade to 1, not
  // hand PostgREST a non-integer .range() bound → 500 (matches the other filters' contract)
  const parsedPage = Math.floor(Number(typeof raw.page === "string" ? raw.page : "1"));
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const action =
    typeof raw.action === "string" && raw.action in AUDIT_ACTION_LABELS_KA ? raw.action : undefined;
  // uuid-shape check — a hand-edited ?actorId=garbage must degrade to "all", not 500
  const actorId =
    typeof raw.actorId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.actorId)
      ? raw.actorId
      : undefined;
  const from =
    typeof raw.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.from) ? raw.from : undefined;
  const to = typeof raw.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.to) ? raw.to : undefined;

  const supabase = await createServerSupabase();
  let query = supabase.from("admin_audit").select("*", { count: "exact" });
  if (action) query = query.eq("action", action);
  if (actorId) query = query.eq("actor_id", actorId);
  // Tbilisi (UTC+4, no DST) day boundaries: created_at is timestamptz and the table
  // renders it in Tbilisi wall-clock (formatDateTimeKa), so a UTC-anchored bound would
  // shift the window 4h off the visible dates. Offset-aware literals align both.
  if (from) query = query.gte("created_at", `${from}T00:00:00+04:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59+04:00`);
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const {
    data: entries,
    count,
    error,
  } = await query
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeFrom + PAGE_SIZE - 1);
  if (error) throw new Error(`admin_audit failed: ${error.message}`);

  const { data: admins, error: adminsError } = await supabase
    .from("admin_admins")
    .select("user_id, first_name, last_name");
  if (adminsError) throw new Error(`admin_admins failed: ${adminsError.message}`);
  const uniqueAdmins = [...new Map(admins.map((a) => [a.user_id, a])).values()];

  const total = count ?? 0;
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (actorId) params.set("actorId", actorId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const pageHref = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    return `/admin/audit?${next.toString()}`;
  };

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">აუდიტის ჟურნალი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          ყველა ადმინისტრაციული მოქმედება — უახლესი პირველ ადგილას. ჩანაწერები წაუშლელია.
        </p>
      </div>

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            მოქმედება
            <select name="action" defaultValue={action ?? ""} className={adminControlClasses}>
              <option value="">ყველა მოქმედება</option>
              {Object.entries(AUDIT_ACTION_LABELS_KA).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            ადმინი
            <select name="actorId" defaultValue={actorId ?? ""} className={adminControlClasses}>
              <option value="">ყველა ადმინი</option>
              {uniqueAdmins.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.first_name} {a.last_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            დან
            <input
              type="date"
              name="from"
              defaultValue={from ?? ""}
              className={adminControlClasses}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            მდე
            <input type="date" name="to" defaultValue={to ?? ""} className={adminControlClasses} />
          </label>
          <Button type="submit" variant="dark">
            ფილტრი
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-sm text-muted-fg">სულ: {formatCountKa(total)}</p>

      <div className="mt-2">
        <Card padded={false}>
          {entries.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-fg">ჩანაწერები ვერ მოიძებნა.</p>
          ) : (
            <DataTable
              bodyTestId="admin-audit-body"
              head={
                <>
                  <th className={tableThClass}>დრო</th>
                  <th className={tableThClass}>ვინ</th>
                  <th className={tableThClass}>მოქმედება</th>
                  <th className={tableThClass}>ობიექტი</th>
                  <th className={tableThClass}>დეტალები</th>
                </>
              }
            >
              {entries.map((e) => (
                <tr key={e.id} className={tableRowClass}>
                  <td className={`${tableCellClass} whitespace-nowrap text-muted-fg`}>
                    {formatDateTimeKa(e.created_at)}
                  </td>
                  <td className={`${tableCellClass} font-semibold`}>
                    {e.actor_first_name ? `${e.actor_first_name} ${e.actor_last_name}` : "სისტემა"}
                  </td>
                  <td className={tableCellClass}>{auditActionLabel(e.action)}</td>
                  <td className={tableCellClass}>
                    {e.target_label ??
                      detailsLabel(e.details) ??
                      `${TARGET_TYPE_LABELS_KA[e.target_type] ?? e.target_type}${
                        e.target_id ? ` · ${e.target_id.slice(0, 8)}` : ""
                      }`}
                  </td>
                  <td className={tableCellClass}>
                    {e.details !== null ? (
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-brand">
                          დეტალები
                        </summary>
                        <pre className="mt-1 max-w-[360px] overflow-x-auto rounded bg-surface p-2 text-xs">
                          {JSON.stringify(e.details, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <div className="mt-4 flex items-center justify-between">
        {page > 1 ? (
          <ButtonLink href={pageHref(page - 1)} variant="ghost" size="sm">
            ← წინა
          </ButtonLink>
        ) : (
          <span />
        )}
        {rangeFrom + PAGE_SIZE < total ? (
          <ButtonLink href={pageHref(page + 1)} variant="ghost" size="sm">
            შემდეგი →
          </ButtonLink>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
