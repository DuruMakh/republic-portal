import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import {
  AdminPageHeader,
  adminRowClass,
  AdminSubNav,
  adminTdClass,
  adminThClass,
} from "@/components/AdminUi";
import { Caps } from "@/components/Caps";
import { DataTable } from "@/components/DataTable";
import { hasAnyRole } from "@/lib/admin";
import { formatDateKa } from "@/lib/cabinet";
import { showRatings } from "@/lib/ratings-switch";
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
      <AdminPageHeader
        title="დელეგატების ვერიფიკაცია"
        lede={`დადასტურება ააქტიურებს დელეგატის რეფერალურ ბმულს და აქცევს პროფილს საჯაროდ ხილვადს ${
          // while ratings are hidden for launch (ADR-052) the profile shows on the portal only
          showRatings() ? "რეიტინგსა და პორტალზე" : "პორტალზე"
        }.`}
      />

      <AdminSubNav
        label="სტატუსის ფილტრი"
        items={TABS.map((t) => ({
          href: `/admin/verify?tab=${t.key}`,
          label: t.label,
          active: tab === t.key,
        }))}
      />

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
                  <th className={adminThClass}>
                    <Caps>დელეგატი</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>რეგიონი</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>საჯარო გვერდი</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>გუნდი</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>ბიო / ფოტო</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>დამტკიცდა</Caps>
                  </th>
                  <th className={adminThClass}></th>
                </>
              }
            >
              {rows.map((d) => (
                <tr key={d.id} className={adminRowClass}>
                  <td className={`${adminTdClass} font-semibold`}>
                    {d.first_name} {d.last_name}
                  </td>
                  <td className={adminTdClass}>{d.region_name_ka ?? "—"}</td>
                  <td className={adminTdClass}>
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
                  <td className={adminTdClass}>{d.total_supporters} წევრი</td>
                  <td className={adminTdClass}>
                    {d.bio ? "ბიო ✓" : "ბიო —"} · {d.photo_url ? "ფოტო ✓" : "ფოტო —"}
                  </td>
                  <td className={`${adminTdClass} text-muted-fg`}>
                    {d.verified_at ? formatDateKa(d.verified_at) : "—"}
                  </td>
                  <td className={adminTdClass}>
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
