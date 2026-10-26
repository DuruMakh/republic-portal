/**
 * Bulk-matching paste parser (spec §3.5, §5). Conservative by design: when a
 * line offers more than one plausible amount the row is flagged, never guessed —
 * finance resolves flagged rows via single entry. DB-dependent classification
 * (unknown code, duplicate reference, incomplete registration) happens in the
 * preview server action, not here.
 */
import { FUNNEL_CODE_ALPHABET } from "./funnel";

export type ParserProblem =
  "no_code" | "no_amount" | "ambiguous_amount" | "invalid_amount" | "invalid_date";

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
  `(?<![A-Za-z0-9])GR-?([${FUNNEL_CODE_ALPHABET}]{6})(?![A-Za-z0-9])`,
  "i",
);
// dd.mm.yyyy or yyyy-mm-dd
const DATE_RE = /\b(?:(\d{2})\.(\d{2})\.(\d{4})|(\d{4})-(\d{2})-(\d{2}))\b/g;
// Collect whole numeric tokens, including signs, parentheses and malformed
// fractions. Validate only AFTER choosing the decimal or integer candidate class.
const MONEY_RE =
  /(?<![A-Za-z0-9.,()+-])(?:[-+(]\s*)*[.,]*\d+(?: \d{3})*(?:[.,+-]\d*)*(?:\s*\))*(?![A-Za-z0-9.,()+-])/g;
const VALID_AMOUNT_RE = /^\+?(?:\d+|\d{1,3}(?: \d{3})+)(?:[.,]\d{2})?$/;

function plausibleDate(y: number, m: number, d: number): boolean {
  if (y < 2000 || y > 2100) return false;
  // round-trip through Date.UTC: "31.02.2026" must NOT yield a paidAt of
  // 2026-02-31, which every string compare accepts and the DB ::date cast
  // then rejects — aborting a whole bulk batch with a generic error
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toAmount(token: string): number {
  return Number(token.replaceAll(" ", "").replace(",", "."));
}

function parseLine(line: string, index: number): ParsedStatementRow {
  const problems: ParserProblem[] = [];

  const codeMatch = CODE_RE.exec(line);
  const code = codeMatch ? `GR-${codeMatch[1]!.toUpperCase()}` : null;
  if (!code) problems.push("no_code");

  let paidAt: string | null = null;
  for (const date of line.matchAll(DATE_RE)) {
    const [yyyy, mm, dd] = date[1] ? [date[3]!, date[2]!, date[1]] : [date[4]!, date[5]!, date[6]!];
    if (!plausibleDate(Number(yyyy), Number(mm), Number(dd))) {
      if (!problems.includes("invalid_date")) problems.push("invalid_date");
    } else if (paidAt === null) paidAt = `${yyyy}-${mm}-${dd}`;
  }
  if (problems.includes("invalid_date")) paidAt = null;

  // strip code + date substrings (every occurrence) so their digits never
  // become amount candidates
  let cleaned = line;
  if (codeMatch) cleaned = cleaned.replaceAll(codeMatch[0], " ");
  cleaned = cleaned.replace(DATE_RE, " ");

  let amountGel: number | null = null;
  const tokens = [...cleaned.matchAll(MONEY_RE)].map((m) => m[0]);
  const decimals = tokens.filter((token) => /[.,]/.test(token));
  const candidates = decimals.length > 0 ? decimals : tokens;
  if (candidates.length > 1) {
    problems.push("ambiguous_amount");
  } else if (candidates.length === 1) {
    const token = candidates[0]!;
    const amount = toAmount(token);
    if (VALID_AMOUNT_RE.test(token) && amount > 0 && amount <= 10000) amountGel = amount;
    else problems.push("invalid_amount");
  } else {
    problems.push("no_amount");
  }

  return {
    index,
    line,
    code,
    amountGel,
    paidAt,
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
