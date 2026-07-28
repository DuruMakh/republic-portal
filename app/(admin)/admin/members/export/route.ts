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
  // KNOWN GAP (owner fix #16): filter.cityId is deliberately NOT forwarded below.
  // admin_export_members()'s signature has no p_city_id parameter — unlike
  // region/status, city has no filter here yet, so a city-filtered list export
  // still returns every city. Giving the RPC a city parameter means changing a
  // SECURITY DEFINER function's argument list, which either leaves a stale
  // unused overload behind or requires a drop+recreate plus re-grants — and
  // this RPC is tracked column-for-column by the scripts/security/ audit
  // manifest (manifest.json's function:admin_export_members entry, live-verified
  // against staging). That is a separate, carefully-scoped change this task's
  // brief did not ask for and this agent cannot re-verify live (no DB access) —
  // flagged as a follow-up rather than risked here.
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
