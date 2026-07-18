/**
 * CSV export (spec §3.3, decision #4): UTF-8 BOM + CRLF so Excel renders
 * Georgian correctly out of a double-click. Generic roster CSV — the
 * Ministry-of-Justice template is a deferred follow-up (spec §9).
 */

// Cells starting with these are evaluated as formulas by Excel/Sheets — a
// member-supplied name like "=HYPERLINK(…)" must never execute on an admin's
// machine (CSV injection). +/- get a numeric exception so phones ("+995…")
// and negative amounts survive untouched.
const NUMERIC_LEAD_RE = /^[+-][\d\s.,-]*$/;

function neutralizeFormula(value: string): string {
  const first = value[0];
  if (first === "=" || first === "@" || first === "\t") return `'${value}`;
  if ((first === "+" || first === "-") && !NUMERIC_LEAD_RE.test(value)) return `'${value}`;
  return value;
}

export function csvEscape(value: string): string {
  const v = neutralizeFormula(value);
  if (/[",\r\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
  return v;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [headers, ...rows].map((cells) => cells.map(csvEscape).join(","));
  // explicit escape — an invisible literal BOM would not survive copy-paste review
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export interface MemberExportRow {
  firstName: string;
  lastName: string;
  phone: string | null;
  regionNameKa: string | null;
  cityNameKa: string | null;
  delegateName: string | null; // null = ცენტრალური მოძრაობა
  statusKa: string;
  tier: number | null;
  referenceCode: string | null;
  registeredAt: string;
  personalId?: string | null;
}

const BASE_HEADERS = [
  "სახელი",
  "გვარი",
  "ტელეფონი",
  "რეგიონი",
  "ქალაქი",
  "დელეგატი",
  "სტატუსი",
  "საწევრო",
  "კოდი",
  "რეგისტრაციის თარიღი",
] as const;

export function memberExportHeaders(includeIds: boolean): string[] {
  return includeIds ? [...BASE_HEADERS, "პირადი ნომერი"] : [...BASE_HEADERS];
}

export function memberExportCsv(rows: readonly MemberExportRow[], includeIds: boolean): string {
  const body = rows.map((r) => {
    const cells = [
      r.firstName,
      r.lastName,
      r.phone ?? "",
      r.regionNameKa ?? "",
      r.cityNameKa ?? "",
      r.delegateName ?? "ცენტრალური მოძრაობა",
      r.statusKa,
      r.tier === null ? "" : String(r.tier),
      r.referenceCode ?? "",
      r.registeredAt,
    ];
    if (includeIds) cells.push(r.personalId ?? "");
    return cells;
  });
  return toCsv(memberExportHeaders(includeIds), body);
}

export function exportFileName(todayIso: string): string {
  return `tsevrebi-${todayIso.replaceAll("-", "")}.csv`;
}
