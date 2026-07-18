import { describe, expect, it } from "vitest";
import {
  csvEscape,
  exportFileName,
  memberExportCsv,
  memberExportHeaders,
  toCsv,
  type MemberExportRow,
} from "./csv";

describe("csvEscape (RFC 4180)", () => {
  it("passes plain values through", () => {
    expect(csvEscape("ნინო")).toBe("ნინო");
  });
  it("quotes separators, quotes and newlines; doubles inner quotes", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('სახ "ზედმეტი"')).toBe('"სახ ""ზედმეტი"""');
    expect(csvEscape("ორი\nხაზი")).toBe('"ორი\nხაზი"');
  });
});

describe("csvEscape (formula injection)", () => {
  it("neutralizes leading = @ and tab with an apostrophe", () => {
    expect(csvEscape('=HYPERLINK("http://evil.example/")')).toBe(
      `"'=HYPERLINK(""http://evil.example/"")"`,
    );
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("@user")).toBe("'@user");
    expect(csvEscape("\tcmd")).toBe("'\tcmd");
  });
  it("neutralizes +/- only when non-numeric (formulas, not phones/amounts)", () => {
    expect(csvEscape("+A2&B2")).toBe("'+A2&B2");
    expect(csvEscape("-SUM(A1:A9)")).toBe("'-SUM(A1:A9)");
    expect(csvEscape("+995550001122")).toBe("+995550001122");
    expect(csvEscape("-5.50")).toBe("-5.50");
  });
  it("leaves ordinary Georgian text untouched", () => {
    expect(csvEscape("ნინო ბერიძე")).toBe("ნინო ბერიძე");
  });
});

describe("toCsv", () => {
  it("BOM + CRLF + header row (Excel opens Georgian correctly)", () => {
    const csv = toCsv(["ა", "ბ"], [["1", "2"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toBe("\uFEFFა,ბ\r\n1,2\r\n");
  });
});

const row: MemberExportRow = {
  firstName: "ნინო",
  lastName: "ბერიძე",
  phone: "+995550001122",
  regionNameKa: "იმერეთი",
  cityNameKa: "ქუთაისი",
  delegateName: null,
  statusKa: "აქტიური",
  tier: 20,
  referenceCode: "GR-ABC234",
  registeredAt: "2026-07-01",
};

describe("member export (spec §3.3)", () => {
  it("headers without IDs end at the registration date", () => {
    expect(memberExportHeaders(false)).toEqual([
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
    ]);
  });
  it("includeIds appends the personal-ID column", () => {
    expect(memberExportHeaders(true)).toEqual([...memberExportHeaders(false), "პირადი ნომერი"]);
  });
  it("null delegate renders as ცენტრალური მოძრაობა; null cells render empty", () => {
    const csv = memberExportCsv([row], false);
    expect(csv).toContain("ცენტრალური მოძრაობა");
    expect(csv).not.toContain("null");
  });
  it("personal IDs appear only when included", () => {
    const withId = memberExportCsv([{ ...row, personalId: "01234567890" }], true);
    const withoutId = memberExportCsv([{ ...row, personalId: "01234567890" }], false);
    expect(withId).toContain("01234567890");
    expect(withoutId).not.toContain("01234567890");
  });
});

describe("exportFileName", () => {
  it("stamps the date", () => {
    expect(exportFileName("2026-07-17")).toBe("tsevrebi-20260717.csv");
  });
});
