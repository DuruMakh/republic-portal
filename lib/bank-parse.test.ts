import { describe, expect, it } from "vitest";
import { parseStatementRows } from "./bank-parse";

describe("parseStatementRows (spec §3.5, §5)", () => {
  it.each([
    ["20", 20],
    ["20.00", 20],
    ["1000.00", 1000],
    ["10000.00", 10000],
    ["1 234,56", 1234.56],
    ["+20.00", 20],
    ["+20", 20],
  ])("keeps the complete positive amount %s", (token, amount) => {
    const [row] = parseStatementRows(`GR-ABC234 ${token}`);
    expect(row!.amountGel).toBe(amount);
    expect(row!.problems).toEqual([]);
  });

  it.each([
    "-20.00",
    "-20",
    "(20.00)",
    "( 20.00 )",
    "- 20.00",
    "(20)",
    "0",
    "0.00",
    "10001",
    "10001.00",
    "100000.00",
    "123456",
    "20.001",
    "20.0",
    "20.00.00",
    "1,234.56",
    ".20",
    ",20",
    "-.50",
    "20.00-",
  ])("rejects the entire invalid amount %s", (token) => {
    const [row] = parseStatementRows(`GR-ABC234 ${token}`);
    expect(row!.amountGel).toBeNull();
    expect(row!.problems).toEqual(["invalid_amount"]);
  });

  it.each([
    "20.00 fee -1.00",
    "20.00 balance 10001.00",
    "20.00 fee 0.00",
    "20 fee -1",
    "20 balance 10001",
    "20.00 malformed 1.234",
    "20.00 fee .50",
    "20.00 fee -.50",
    "20.00 fee ,50",
  ])("keeps every candidate when deciding ambiguity: %s", (tokens) => {
    const [row] = parseStatementRows(`GR-ABC234 ${tokens}`);
    expect(row!.amountGel).toBeNull();
    expect(row!.problems).toEqual(["ambiguous_amount"]);
  });

  it.each(["-20.00", "10001.00", "20.001", ".20", ",20", "-.50", "20.00-"])(
    "never falls back to an integer after %s",
    (token) => {
      const [row] = parseStatementRows(`GR-ABC234 ${token} document 7`);
      expect(row!.amountGel).toBeNull();
      expect(row!.problems).toEqual(["invalid_amount"]);
    },
  );

  it.each(["I", "L", "O", "0", "1", "A"])("rejects a reference with trailing %s", (suffix) => {
    const [row] = parseStatementRows(`GR-ABC234${suffix} 20.00`);
    expect(row!.code).toBeNull();
    expect(row!.problems).toEqual(["no_code"]);
  });

  it.each([
    "31.02.2026",
    "2026-04-31",
    "99.99.2026",
    "01.01.1999",
    "31.02.2026 01.07.2026",
    "01.07.2026 2026-04-31",
  ])("marks invalid supplied dates unresolved: %s", (dates) => {
    const [row] = parseStatementRows(`${dates} GR-ABC234 20`);
    expect(row!.paidAt).toBeNull();
    expect(row!.amountGel).toBe(20);
    expect(row!.problems).toEqual(["invalid_date"]);
  });

  it("removes every supported date token before integer fallback", () => {
    const [row] = parseStatementRows("2026-07-15 01.08.2026 GR-ABC234 20");
    expect(row!.paidAt).toBe("2026-07-15");
    expect(row!.amountGel).toBe(20);
    expect(row!.problems).toEqual([]);
  });

  it("keeps an absent date distinguishable from invalid supplied dates", () => {
    const [row] = parseStatementRows("GR-ABC234 20");
    expect(row!.paidAt).toBeNull();
    expect(row!.problems).toEqual([]);
  });

  it("preserves decimal-first classification over an unrelated integer", () => {
    const [row] = parseStatementRows("GR-ABC234 20.00 document 7");
    expect(row!.amountGel).toBe(20);
    expect(row!.problems).toEqual([]);
  });
  it("extracts code, decimal amount and date from a TSV bank row", () => {
    const [r] = parseStatementRows("01.07.2026\tDOC123456\t20.00\tგადმორიცხვა GR-ABC234 საწევრო");
    expect(r!.code).toBe("GR-ABC234");
    expect(r!.amountGel).toBe(20);
    expect(r!.paidAt).toBe("2026-07-01");
    expect(r!.problems).toEqual([]);
  });

  it("normalizes lowercase and hyphen-less codes", () => {
    const rows = parseStatementRows("gr-abc234 20.00\nGRKMN789 5.00");
    expect(rows[0]!.code).toBe("GR-ABC234");
    expect(rows[1]!.code).toBe("GR-KMN789");
  });

  it("comma decimals and space-thousands parse (Georgian bank exports)", () => {
    const rows = parseStatementRows("GR-ABC234 60,00\nGR-KMN789 1 234,56");
    expect(rows[0]!.amountGel).toBe(60);
    expect(rows[1]!.amountGel).toBe(1234.56);
  });

  it("integer fallback works when no decimal-formatted number exists", () => {
    const [r] = parseStatementRows("GR-ABC234 საწევრო 20");
    expect(r!.amountGel).toBe(20);
    expect(r!.problems).toEqual([]);
  });

  it("date fragments and the code never masquerade as the amount", () => {
    // 2026 (year), 234 (code digits) must not be amount candidates; 20 is the amount
    const [r] = parseStatementRows("01.07.2026 GR-ABC234 20");
    expect(r!.amountGel).toBe(20);
    expect(r!.paidAt).toBe("2026-07-01");
  });

  it("two plausible decimal amounts → ambiguous_amount, never a guess", () => {
    const [r] = parseStatementRows("GR-ABC234 balance 100.00 amount 20.00");
    expect(r!.amountGel).toBeNull();
    expect(r!.problems).toContain("ambiguous_amount");
  });

  it("two plausible integers → ambiguous_amount", () => {
    const [r] = parseStatementRows("GR-ABC234 20 40");
    expect(r!.amountGel).toBeNull();
    expect(r!.problems).toContain("ambiguous_amount");
  });

  it("no amount at all → no_amount", () => {
    const [r] = parseStatementRows("GR-ABC234 საწევრო გადარიცხვა");
    expect(r!.amountGel).toBeNull();
    expect(r!.problems).toContain("no_amount");
  });

  it("missing code → no_code (amount still extracted for display)", () => {
    const [r] = parseStatementRows("01.07.2026 გადმორიცხვა 20.00 უცნობი");
    expect(r!.code).toBeNull();
    expect(r!.amountGel).toBe(20);
    expect(r!.problems).toContain("no_code");
  });

  it("iso dates parse; implausible dates are ignored", () => {
    expect(parseStatementRows("GR-ABC234 20.00 2026-07-15")[0]!.paidAt).toBe("2026-07-15");
    expect(parseStatementRows("GR-ABC234 20.00 99.99.2026")[0]!.paidAt).toBeNull();
  });

  it("identical duplicate lines collapse onto the first occurrence", () => {
    const rows = parseStatementRows("GR-ABC234 20.00 01.07.2026\nGR-ABC234 20.00 01.07.2026");
    expect(rows[0]!.duplicateOfIndex).toBeNull();
    expect(rows[1]!.duplicateOfIndex).toBe(0);
  });

  it("blank lines are skipped; indexes are sequential over kept lines", () => {
    const rows = parseStatementRows("\nGR-ABC234 20.00\n\n  \nGR-KMN789 5.00\n");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.index)).toEqual([0, 1]);
  });

  it("codes with excluded letters (I, L, O) or wrong length do not match", () => {
    const rows = parseStatementRows("GR-ABCIL0 20.00\nGR-ABC23 20.00");
    expect(rows[0]!.code).toBeNull();
    expect(rows[1]!.code).toBeNull();
  });

  it("too-long code bodies do not match at all (no silent truncation)", () => {
    const [r] = parseStatementRows("15.07.2026 GR-ABC2345 20.00");
    expect(r!.code).toBeNull();
    expect(r!.problems).toContain("no_code");
  });

  it("the earliest date token wins regardless of format", () => {
    const [r] = parseStatementRows("2026-07-15 payment 01.08.2026 GR-ABC234 20.00");
    expect(r!.paidAt).toBe("2026-07-15");
  });

  it("a code repeated in the narration never pollutes amount candidates", () => {
    const [r] = parseStatementRows("15.07.2026 GR-ABC234 GR-ABC234 20");
    expect(r!.code).toBe("GR-ABC234");
    expect(r!.amountGel).toBe(20);
    expect(r!.problems).toEqual([]);
  });

  it("gr inside an ordinary word never shadows the real code on the line", () => {
    // "agreement" = a + gr + eement (6 alphabet chars) — without a leading
    // boundary the leftmost match yields phantom GR-EEMENT and drops the payment
    const [r] = parseStatementRows("payment agreement GR-ABC234 20.00 01.07.2026");
    expect(r!.code).toBe("GR-ABC234");
    expect(r!.amountGel).toBe(20);
    expect(r!.paidAt).toBe("2026-07-01");
  });

  it("impossible calendar dates are rejected; leap days are kept", () => {
    // 2026-02-31 survives string compares but blows up on the DB ::date cast
    expect(parseStatementRows("31.02.2026 GR-ABC234 20.00")[0]!.paidAt).toBeNull();
    expect(parseStatementRows("GR-ABC234 20.00 2026-04-31")[0]!.paidAt).toBeNull();
    expect(parseStatementRows("29.02.2028 GR-ABC234 20.00")[0]!.paidAt).toBe("2028-02-29");
  });
});
