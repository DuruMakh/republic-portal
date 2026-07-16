/**
 * TS mirror of the active-member engine (spec §2 #1–2, §4.4; ADR-015). The SQL
 * functions in 20260717150000_admin_crm.sql implement the SAME date math — the
 * test dates in active.test.ts are the shared fixtures the schema probe replays
 * against SQL. Date-only arithmetic (YYYY-MM-DD strings), no timezones.
 */

export const COVERAGE_DAYS_PER_MONTH = 30;
export const DEFAULT_GRACE_DAYS = 30;

/** Whole months a payment buys: floor(amount ÷ tier), minimum 1. 0 = not computable. */
export function monthsFor(amountGel: number, tierGel: number): number {
  if (!Number.isFinite(amountGel) || !Number.isFinite(tierGel)) return 0;
  if (amountGel <= 0 || tierGel <= 0) return 0;
  return Math.max(1, Math.floor(amountGel / tierGel));
}

export interface CoveragePayment {
  paidAt: string; // YYYY-MM-DD
  monthsCovered: number;
  voidedAt: string | null;
}

export interface CoverageResult {
  coverageEnd: string | null; // last covered day (YYYY-MM-DD)
  activeUntil: string | null; // coverageEnd + grace — last ACTIVE day
  isActive: boolean;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  // constructing via Date.UTC keeps this ICU/timezone-free (house lesson: formatDateKa)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

export function computeCoverage(
  payments: readonly CoveragePayment[],
  graceDays: number,
  today: string,
): CoverageResult {
  const live = payments
    .filter((p) => p.voidedAt === null && p.monthsCovered > 0)
    .slice()
    .sort((a, b) => (a.paidAt < b.paidAt ? -1 : a.paidAt > b.paidAt ? 1 : 0));

  let end: string | null = null;
  for (const p of live) {
    // stack: extend from the later of current coverage end and the payment's own date
    const base = end === null || p.paidAt > end ? p.paidAt : end;
    end = addDaysIso(base, p.monthsCovered * COVERAGE_DAYS_PER_MONTH);
  }
  if (end === null) return { coverageEnd: null, activeUntil: null, isActive: false };
  const activeUntil = addDaysIso(end, graceDays);
  // ISO date strings compare correctly as strings
  return { coverageEnd: end, activeUntil, isActive: today <= activeUntil };
}
