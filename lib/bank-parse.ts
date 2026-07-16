/**
 * Bulk-matching paste parser (spec §3.5, §5). Conservative by design: when a
 * line offers more than one plausible amount the row is flagged, never guessed —
 * finance resolves flagged rows via single entry. DB-dependent classification
 * (unknown code, duplicate reference, incomplete registration) happens in the
 * preview server action, not here.
 */
import { FUNNEL_CODE_ALPHABET } from "./funnel";

export type ParserProblem = "no_code" | "no_amount" | "ambiguous_amount";

export interface ParsedStatementRow {
  index: number;
  line: string;
  code: string | null;
  amountGel: number | null;
  paidAt: string | null;
  duplicateOfIndex: number | null;
  problems: ParserProblem[];
}

// hyphen optional, any case; captured body normalized to GR-UPPER
const CODE_RE = new RegExp(`GR-?([${FUNNEL_CODE_ALPHABET}]{6})`, "i");
// dd.mm.yyyy or yyyy-mm-dd
const DATE_DOT_RE = /\b(\d{2})\.(\d{2})\.(\d{4})\b/;
const DATE_ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
// decimals: optional space-thousands, dot/comma + exactly two digits
const DECIMAL_RE = /(?<![\d.,])\d{1,3}(?: \d{3})*[.,]\d{2}(?![\d.,])/g;
// integer fallback: standalone 1–5 digit runs
const INT_RE = /(?<![\d.,])\d{1,5}(?![\d.,])/g;

function plausibleDate(y: number, m: number, d: number): boolean {
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function extractDate(line: string): { iso: string; raw: string } | null {
  const dot = DATE_DOT_RE.exec(line);
  if (dot) {
    const [raw, dd, mm, yyyy] = dot;
    if (plausibleDate(Number(yyyy), Number(mm), Number(dd)))
      return { iso: `${yyyy}-${mm}-${dd}`, raw };
  }
  const iso = DATE_ISO_RE.exec(line);
  if (iso) {
    const [raw, yyyy, mm, dd] = iso;
    if (plausibleDate(Number(yyyy), Number(mm), Number(dd)))
      return { iso: `${yyyy}-${mm}-${dd}`, raw };
  }
  return null;
}

function toAmount(token: string): number {
  return Number(token.replaceAll(" ", "").replace(",", "."));
}

function parseLine(line: string, index: number): ParsedStatementRow {
  const problems: ParserProblem[] = [];

  const codeMatch = CODE_RE.exec(line);
  const code = codeMatch ? `GR-${codeMatch[1]!.toUpperCase()}` : null;
  if (!code) problems.push("no_code");

  const date = extractDate(line);

  // strip code + date substrings so their digits never become amount candidates
  let cleaned = line;
  if (codeMatch) cleaned = cleaned.replace(codeMatch[0], " ");
  if (date) cleaned = cleaned.replace(date.raw, " ");

  let amountGel: number | null = null;
  const decimals = [...cleaned.matchAll(DECIMAL_RE)].map((m) => toAmount(m[0]));
  const plausibleDecimals = decimals.filter((n) => n > 0 && n <= 10000);
  if (plausibleDecimals.length === 1) {
    amountGel = plausibleDecimals[0]!;
  } else if (plausibleDecimals.length > 1) {
    problems.push("ambiguous_amount");
  } else {
    const ints = [...cleaned.matchAll(INT_RE)]
      .map((m) => Number(m[0]))
      .filter((n) => n > 0 && n <= 10000);
    if (ints.length === 1) amountGel = ints[0]!;
    else if (ints.length > 1) problems.push("ambiguous_amount");
    else problems.push("no_amount");
  }

  return {
    index,
    line,
    code,
    amountGel,
    paidAt: date?.iso ?? null,
    duplicateOfIndex: null,
    problems,
  };
}

export function parseStatementRows(text: string): ParsedStatementRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const rows = lines.map(parseLine).map((row, index) => ({ ...row, index }));
  const seen = new Map<string, number>();
  for (const row of rows) {
    const prior = seen.get(row.line);
    if (prior !== undefined) row.duplicateOfIndex = prior;
    else seen.set(row.line, row.index);
  }
  return rows;
}
