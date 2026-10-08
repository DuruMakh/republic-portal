import { describe, expect, it } from "vitest";
import { timestampMicros } from "./timestamps";

describe("timestampMicros", () => {
  it("keeps the microsecond that Date.parse throws away (security audit C1)", () => {
    const expires = "2026-08-11T12:05:00.123+00:00";
    const superseded = "2026-08-11T12:05:00.123001+00:00";
    // the bug: JavaScript sees the two instants as equal
    expect(Date.parse(superseded)).toBe(Date.parse(expires));
    expect(timestampMicros(superseded)).toBe(timestampMicros(expires)! + 1n);
  });

  it("reads Z, long and short offsets, and the Postgres text separator", () => {
    const utc = timestampMicros("2026-08-11T12:05:00Z");
    expect(utc).toBe(BigInt(Date.parse("2026-08-11T12:05:00Z")) * 1000n);
    expect(timestampMicros("2026-08-11T12:05:00+00:00")).toBe(utc);
    expect(timestampMicros("2026-08-11T16:05:00+04:00")).toBe(utc);
    expect(timestampMicros("2026-08-11 16:05:00+04")).toBe(utc);
    expect(timestampMicros("2026-08-11T12:05:00.5Z")).toBe(utc! + 500_000n);
    expect(timestampMicros("2026-08-11T12:05:00.000Z")).toBe(utc);
  });

  it("refuses anything it cannot read exactly", () => {
    for (const bad of [
      "",
      "not a time",
      "2026-08-11T12:05:00", // no zone
      "2026-08-11T12:05:00.1234567Z", // finer than Postgres stores
      "2026-13-45T12:05:00Z",
    ]) {
      expect(timestampMicros(bad)).toBeNull();
    }
  });
});
