import type { MemberStatusRow } from "@/lib/supabase/types";

export interface MemberCandidate {
  id: string;
  name: string;
  regionNameKa: string | null;
  tier: number | null;
  status: MemberStatusRow;
  referenceCode: string;
}
export type LookupResult =
  { ok: true; candidates: MemberCandidate[] } | { ok: false; error: string };
export type RecordResult =
  { ok: true; months: number; newStatus: MemberStatusRow } | { ok: false; error: string };

export type BulkStatus =
  | "ok"
  | "no_code"
  | "no_amount"
  | "ambiguous_amount"
  | "unknown_code"
  | "duplicate"
  | "duplicate_line"
  | "not_completed"
  | "bad_date";
export interface BulkPreviewRow {
  index: number;
  line: string;
  code: string | null;
  amountGel: number | null;
  paidAt: string | null;
  status: BulkStatus;
  memberName: string | null;
  months: number | null;
}
export type BulkPreviewResult = { ok: true; rows: BulkPreviewRow[] } | { ok: false; error: string };
export type BulkConfirmResult =
  | { ok: true; count: number; totalGel: number }
  | { ok: false; error: string; rowIndex: number | null };

export type VoidResult = { ok: true } | { ok: false; error: string };
