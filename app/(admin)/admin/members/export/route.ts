import { hasAnyRole, MEMBER_STATUS_LABELS_KA, sanitizeSearch } from "@/lib/admin";
import { membersFilterSchema, todayTbilisiIso } from "@/lib/admin-schemas";
import { exportFileName, memberExportCsv, type MemberExportRow } from "@/lib/csv";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import type { MemberStatusRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface ExportedRow {
  firstName: string;
  lastName: string;
  phone: string | null;
  regionNameKa: string | null;
  cityNameKa: string | null;
  delegateName: string | null;
  status: MemberStatusRow;
  tier: number | null;
  referenceCode: string | null;
  registeredAt: string;
  personalId?: string | null;
}

/** Audited roster export (spec §3.3): the RPC re-checks roles and writes member.export. */
export async function GET(request: Request) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["finance", "super_admin"])) {
    return new Response("წვდომა აკრძალულია", { status: 403 });
  }
  const url = new URL(request.url);
  const filter = membersFilterSchema.parse(Object.fromEntries(url.searchParams));
  const includeIds = url.searchParams.get("includeIds") === "1";
  if (includeIds && !hasAnyRole(roles, ["super_admin"])) {
    return new Response("წვდომა აკრძალულია", { status: 403 });
  }

  // ONE sanitizer with the on-screen list: raw %/_ would act as ILIKE wildcards
  // inside the RPC and the audited CSV would diverge from what the admin saw
  const search = filter.search ? sanitizeSearch(filter.search) : "";
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_export_members", {
    p_search: search.length > 0 ? search : null,
    p_region_id: filter.regionId ?? null,
    p_status: filter.status ?? null,
    p_include_ids: includeIds,
  });
  if (error) {
    console.error(`member export failed: ${error.message}`); // detail stays server-side
    return new Response("ექსპორტი ვერ შესრულდა", { status: 500 });
  }

  const rows = (data as unknown as ExportedRow[]).map((r): MemberExportRow => ({
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone,
    regionNameKa: r.regionNameKa,
    cityNameKa: r.cityNameKa,
    delegateName: r.delegateName,
    statusKa: MEMBER_STATUS_LABELS_KA[r.status],
    tier: r.tier,
    referenceCode: r.referenceCode,
    registeredAt: r.registeredAt,
    personalId: r.personalId ?? null,
  }));
  const csv = memberExportCsv(rows, includeIds);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFileName(todayTbilisiIso())}"`,
      "cache-control": "no-store",
    },
  });
}
