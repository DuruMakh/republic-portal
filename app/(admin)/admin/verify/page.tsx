import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { hasAnyRole } from "@/lib/admin";
import { formatDateKa } from "@/lib/cabinet";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { approveDelegateAction, rejectDelegateAction, revealApplicantIdAction } from "./actions";
import { VerifyCard } from "./VerifyCard";

export const metadata: Metadata = { title: "ვერიფიკაცია — ადმინისტრირება" };

const TABS = [
  { key: "pending", label: "მოლოდინში" },
  { key: "approved", label: "დამტკიცებული" },
  { key: "rejected", label: "უარყოფილი" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["verifier", "super_admin"])) redirect("/admin");
  const raw = await searchParams;
  const tab: TabKey = raw.tab === "approved" || raw.tab === "rejected" ? raw.tab : "pending";

  const supabase = await createServerSupabase();
  const { data: rows, error } = await supabase
    .from("admin_delegate_queue")
    .select("*")
    .eq("status", tab)
    .order(tab === "pending" ? "created_at" : "verified_at", {
      ascending: tab === "pending", // oldest applications first; newest decisions first
    });
  if (error) throw new Error(`admin_delegate_queue failed: ${error.message}`);

  return (
    <main>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-[2rem] font-bold text-ink">დელეგატების ვერიფიკაცია</h1>
        <p className="mt-2 text-sm text-muted-fg">
          დადასტურება ააქტიურებს დელეგატის რეფერალურ ბმულს და აქცევს პროფილს საჯაროდ ხილვადს
          რეიტინგსა და პორტალზე.
        </p>
      </div>

      <nav className="mb-6 flex gap-1 border-b border-line pb-2" aria-label="სტატუსის ფილტრი">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/verify?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={
              tab === t.key
                ? "text-brand border-b-2 border-brand pb-1"
                : "text-ink hover:text-brand"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "approved" ? (
        <Card padded={false}>
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-fg">
              დამტკიცებული დელეგატები ჯერ არ არის.
            </p>
          ) : (
            <DataTable
              head={
                <>
                  <th className={tableThClass}>დელეგატი</th>
                  <th className={tableThClass}>რეგიონი</th>
                  <th className={tableThClass}>საჯარო გვერდი</th>
                  <th className={tableThClass}>მხარდამჭერები</th>
                  <th className={tableThClass}>ბიო / ფოტო</th>
                  <th className={tableThClass}>დამტკიცდა</th>
                  <th className={tableThClass}></th>
                </>
              }
            >
              {rows.map((d) => (
                <tr key={d.id} className={tableRowClass}>
                  <td className={`${tableCellClass} font-semibold`}>
                    {d.first_name} {d.last_name}
                  </td>
                  <td className={tableCellClass}>{d.region_name_ka ?? "—"}</td>
                  <td className={tableCellClass}>
                    {d.slug ? (
                      <a
                        href={`/delegates/${d.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand hover:underline"
                      >
                        /{d.slug}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={tableCellClass}>
                    {d.active_supporters} აქტიური · {d.total_supporters} სულ
                  </td>
                  <td className={tableCellClass}>
                    {d.bio ? "ბიო ✓" : "ბიო —"} · {d.photo_url ? "ფოტო ✓" : "ფოტო —"}
                  </td>
                  <td className={`${tableCellClass} text-muted-fg`}>
                    {d.verified_at ? formatDateKa(d.verified_at) : "—"}
                  </td>
                  <td className={tableCellClass}>
                    <ButtonLink href={`/admin/verify/${d.id}`} variant="ghost" size="sm">
                      რედაქტირება
                    </ButtonLink>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <div className="p-4 text-center">
            <h3 className="text-base font-bold text-ink">
              {tab === "pending"
                ? "ვერიფიკაციის მოლოდინში დელეგატები არ არის"
                : "უარყოფილი განაცხადები არ არის"}
            </h3>
            {tab === "pending" ? (
              <p className="mt-1 text-sm text-muted-fg">ყველა განაცხადი დამუშავებულია.</p>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((d) => (
            <VerifyCard
              key={d.id}
              applicant={{
                id: d.id,
                firstName: d.first_name,
                lastName: d.last_name,
                regionNameKa: d.region_name_ka,
                phone: d.phone,
                createdAt: d.created_at,
                reviewNote: d.review_note,
                verifiedAt: d.verified_at,
                verifiedByName: d.verified_by_first_name
                  ? `${d.verified_by_first_name} ${d.verified_by_last_name}`
                  : null,
              }}
              mode={tab}
              reveal={revealApplicantIdAction}
              approve={approveDelegateAction}
              reject={rejectDelegateAction}
            />
          ))}
        </div>
      )}
    </main>
  );
}
