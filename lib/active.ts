/**
 * Date-only helpers shared with the active-member engine (spec §2 #2, §4.4; ADR-015).
 * Coverage itself is computed by the SQL functions in 20260717150000_admin_crm.sql;
 * these are the pieces the app needs for previews (months a payment buys) and date
 * arithmetic. YYYY-MM-DD strings, no timezones.
 */

/** Whole months a payment buys: floor(amount ÷ tier), minimum 1. 0 = not computable. */
export function monthsFor(amountGel: number, tierGel: number): number {
  if (!Number.isFinite(amountGel) || !Number.isFinite(tierGel)) return 0;
  if (amountGel <= 0 || tierGel <= 0) return 0;
  return Math.max(1, Math.floor(amountGel / tierGel));
}

export function addDaysIso(isoDate: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`addDaysIso: malformed ISO date: ${isoDate}`);
  // regex match above guarantees groups 1-3 exist
  // constructing via Date.UTC keeps this ICU/timezone-free (house lesson: formatDateKa)
  const dt = new Date(Date.UTC(Number(m[1]!), Number(m[2]!) - 1, Number(m[3]!) + days));
  return dt.toISOString().slice(0, 10);
}
