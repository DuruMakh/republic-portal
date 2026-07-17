"use server";

import { hasAnyRole } from "@/lib/admin";
import { memberLookupSchema, recordPaymentSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, isReferenceCode, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import type { LookupResult, MemberCandidate, RecordResult } from "./types";
import type { MemberStatusRow } from "@/lib/supabase/types";

export async function lookupMemberAction(query: unknown): Promise<LookupResult> {
  const parsed = memberLookupSchema.safeParse({ query });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["finance", "super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const supabase = await createServerSupabase();
  const q = parsed.data.query;
  let builder = supabase
    .from("admin_members")
    .select("id, first_name, last_name, region_name_ka, membership_tier, status, reference_code")
    // only completed members can be paid for — they are exactly those with a code
    .not("reference_code", "is", null)
    .limit(8);
  if (isReferenceCode(q.toUpperCase())) {
    builder = builder.eq("reference_code", q.toUpperCase());
  } else {
    const s = q.replaceAll(/[,%()]/g, " ").trim();
    builder = builder.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  const { data, error } = await builder;
  if (error) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const candidates: MemberCandidate[] = (data ?? []).map((m) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`,
    regionNameKa: m.region_name_ka,
    tier: m.membership_tier,
    status: m.status,
    referenceCode: m.reference_code as string,
  }));
  return { ok: true, candidates };
}

export async function recordPaymentAction(input: unknown): Promise<RecordResult> {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_record_payment", {
    p_member_id: parsed.data.memberId,
    p_amount_gel: parsed.data.amountGel,
    p_paid_at: parsed.data.paidAt,
    p_bank_reference: parsed.data.bankReference === "" ? null : parsed.data.bankReference,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  const result = data as { months: number; newStatus: MemberStatusRow };
  return { ok: true, months: result.months, newStatus: result.newStatus };
}
