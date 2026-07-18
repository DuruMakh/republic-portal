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

// hyphen optional, any case; captured body normalized to GR-UPPER;
// leading lookbehind: "GR" must start a token — without it the leftmost match
// lands INSIDE ordinary words ("agreement" → gr+eement → phantom GR-EEMENT)
// and shadows the real code later on the line;
// trailing lookahead: an over-long body must not match at all (no silent truncation)
const CODE_RE = new RegExp(
  `(?<![A-Za-z0-9])GR-?([${FUNNEL_CODE_ALPHABET}]{6})(?![${FUNNEL_CODE_ALPHABET}])`,
  "i",
);
// dd.mm.yyyy or yyyy-mm-dd
const DATE_DOT_RE = /\b(\d{2})\.(\d{2})\.(\d{4})\b/;
const DATE_ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
// decimals: optional space-thousands, dot/comma + exactly two digits
const DECIMAL_RE = /(?<![\d.,])\d{1,3}(?: \d{3})*[.,]\d{2}(?![\d.,])/g;
// integer fallback: standalone 1–5 digit runs
const INT_RE = /(?<![\d.,])\d{1,5}(?![\d.,])/g;

function plausibleDate(y: number, m: number, d: number): boolean {
  if (y < 2000 || y > 2100) return false;
  // round-trip through Date.UTC: "31.02.2026" must NOT yield a paidAt of
  // 2026-02-31, which every string compare accepts and the DB ::date cast
  // then rejects — aborting a whole bulk batch with a generic error
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function extractDate(line: string): { iso: string; raw: string } | null {
  // spec §5: the FIRST plausible date token wins, regardless of format — so
  // collect each format's first match and pick the one starting earliest.
  const candidates: { at: number; iso: string; raw: string }[] = [];
  const dot = DATE_DOT_RE.exec(line);
  if (dot) {
    // `!`: a successful match guarantees capture groups 1–3 exist
    const [dd, mm, yyyy] = [dot[1]!, dot[2]!, dot[3]!];
    if (plausibleDate(Number(yyyy), Number(mm), Number(dd)))
      candidates.push({ at: dot.index, iso: `${yyyy}-${mm}-${dd}`, raw: dot[0] });
  }
  const iso = DATE_ISO_RE.exec(line);
  if (iso) {
    // `!`: a successful match guarantees capture groups 1–3 exist
    const [yyyy, mm, dd] = [iso[1]!, iso[2]!, iso[3]!];
    if (plausibleDate(Number(yyyy), Number(mm), Number(dd)))
      candidates.push({ at: iso.index, iso: `${yyyy}-${mm}-${dd}`, raw: iso[0] });
  }
  candidates.sort((a, b) => a.at - b.at);
  const first = candidates[0];
  return first ? { iso: first.iso, raw: first.raw } : null;
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

  // strip code + date substrings (every occurrence) so their digits never
  // become amount candidates
  let cleaned = line;
  if (codeMatch) cleaned = cleaned.replaceAll(codeMatch[0], " ");
  if (date) cleaned = cleaned.replaceAll(date.raw, " ");

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
  const rows = lines.map(parseLine);
  const seen = new Map<string, number>();
  for (const row of rows) {
    const prior = seen.get(row.line);
    if (prior !== undefined) row.duplicateOfIndex = prior;
    else seen.set(row.line, row.index);
  }
  return rows;
}
