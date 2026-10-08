/**
 * Exact instants for the phone-proof ledger. Postgres timestamptz carries microseconds;
 * JavaScript's Date keeps milliseconds and silently drops the rest, which once let a
 * superseded challenge (consumed_at = expires_at + 1µs) read as validly consumed
 * (security audit 2026-10-08, C1). Compare ledger timestamps only through this.
 */
const TIMESTAMP_RE =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/;

function isoOffset(zone: string): string {
  if (zone === "Z") return "Z";
  if (zone.length === 3) return `${zone}:00`;
  return zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
}

export function timestampMicros(value: string): bigint | null {
  const match = TIMESTAMP_RE.exec(value);
  if (!match) return null;
  const [, date, time, fraction, zone] = match;
  if (date === undefined || time === undefined || zone === undefined) return null;
  const wholeSecondMs = Date.parse(`${date}T${time}${isoOffset(zone)}`);
  if (Number.isNaN(wholeSecondMs)) return null;
  return BigInt(wholeSecondMs) * 1000n + BigInt((fraction ?? "").padEnd(6, "0"));
}
