"use server";

import { hasAnyRole } from "@/lib/admin";
import {
  bulkConfirmSchema,
  bulkPreviewSchema,
  memberLookupSchema,
  recordPaymentSchema,
  todayTbilisiIso,
  voidPaymentSchema,
} from "@/lib/admin-schemas";
import { monthsFor } from "@/lib/active";
import { parseStatementRows } from "@/lib/bank-parse";
import { GENERIC_FUNNEL_ERROR, isReferenceCode, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import type {
  BulkConfirmResult,
  BulkPreviewResult,
  BulkPreviewRow,
  LookupResult,
  MemberCandidate,
  RecordResult,
  VoidResult,
} from "./types";
import type { Json, MemberStatusRow } from "@/lib/supabase/types";

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

export async function previewBulkAction(text: unknown): Promise<BulkPreviewResult> {
  const parsed = bulkPreviewSchema.safeParse({ text });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["finance", "super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const supabase = await createServerSupabase();
  const parsedRows = parseStatementRows(parsed.data.text);

  const codes = [...new Set(parsedRows.flatMap((r) => (r.code ? [r.code] : [])))];
  const { data: matches, error: matchError } =
    codes.length > 0
      ? await supabase
          .from("admin_members")
          .select("id, first_name, last_name, membership_tier, reference_code")
          .in("reference_code", codes)
      : { data: [], error: null };
  if (matchError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const byCode = new Map((matches ?? []).map((m) => [m.reference_code as string, m]));

  // duplicate check: an identical LIVE payment (member+amount+date) already recorded
  const memberIds = [...new Set((matches ?? []).map((m) => m.id))];
  const { data: existing, error: existingError } =
    memberIds.length > 0
      ? await supabase
          .from("admin_payments")
          .select("member_id, amount_gel, paid_at")
          .in("member_id", memberIds)
          .is("voided_at", null)
      : { data: [], error: null };
  if (existingError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const existingKeys = new Set(
    (existing ?? []).map((p) => `${p.member_id}|${p.amount_gel}|${p.paid_at}`),
  );

  const today = todayTbilisiIso();
  const rows: BulkPreviewRow[] = parsedRows.map((r) => {
    const paidAt = r.paidAt ?? today; // the date that WILL be recorded is shown
    const base: BulkPreviewRow = {
      index: r.index,
      line: r.line,
      code: r.code,
      amountGel: r.amountGel,
      paidAt,
      status: "ok",
      memberName: null,
      months: null,
    };
    if (r.duplicateOfIndex !== null) return { ...base, status: "duplicate_line" };
    if (r.problems.includes("no_code")) return { ...base, status: "no_code" };
    if (r.problems.includes("ambiguous_amount")) return { ...base, status: "ambiguous_amount" };
    if (r.problems.includes("no_amount")) return { ...base, status: "no_amount" };
    // outside the confirm schema's window (2026-01-01..today) — classify HERE so a
    // single out-of-range date can never abort the whole all-or-nothing confirm
    if (paidAt < "2026-01-01" || paidAt > today) return { ...base, status: "bad_date" };
    const member = byCode.get(r.code as string);
    if (!member) return { ...base, status: "unknown_code" };
    const name = `${member.first_name} ${member.last_name}`;
    if (member.membership_tier === null) {
      // matched a real code, but the registration is incomplete — the RPC would
      // refuse this row (not_completed), so it must not preview as ✓
      return { ...base, status: "not_completed", memberName: name };
    }
    if (existingKeys.has(`${member.id}|${r.amountGel}|${paidAt}`)) {
      return { ...base, status: "duplicate", memberName: name };
    }
    return {
      ...base,
      memberName: name,
      months: member.membership_tier
        ? monthsFor(r.amountGel as number, member.membership_tier)
        : null,
    };
  });
  return { ok: true, rows };
}

export async function confirmBulkAction(rows: unknown): Promise<BulkConfirmResult> {
  const parsed = bulkConfirmSchema.safeParse({ rows });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR,
      rowIndex: null,
    };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_record_payments_bulk", {
    p_rows: parsed.data.rows as unknown as Json,
  });
  if (error) {
    // 'bulk_row:<index>:<reason>' — surface the offending row (spec §4.5)
    const match = /bulk_row:(\d+):(\w+)/.exec(error.message);
    if (match) {
      return { ok: false, error: mapFunnelError(match[2]), rowIndex: Number(match[1]) };
    }
    return { ok: false, error: mapFunnelError(error.message), rowIndex: null };
  }
  const result = data as { count: number; totalGel: number };
  return { ok: true, count: result.count, totalGel: result.totalGel };
}

export async function voidPaymentAction(paymentId: unknown, reason: unknown): Promise<VoidResult> {
  const parsed = voidPaymentSchema.safeParse({ paymentId, reason });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_void_payment", {
    p_payment_id: parsed.data.paymentId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true };
}
