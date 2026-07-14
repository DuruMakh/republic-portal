import { describe, expect, it } from "vitest";
import roster from "../scripts/seed-roster.json";
import { makeSlug } from "./slug";

const REGIONS = [
  "თბილისი",
  "აჭარა",
  "იმერეთი",
  "კახეთი",
  "ქვემო ქართლი",
  "სამეგრელო-ზემო სვანეთი",
  "სამცხე-ჯავახეთი",
  "გურია",
  "მცხეთა-მთიანეთი",
  "რაჭა-ლეჩხუმი და ქვემო სვანეთი",
  "შიდა ქართლი",
];

describe("seed roster", () => {
  it("has 12 approved and 3 pending delegates", () => {
    expect(roster.filter((d) => d.status === "approved")).toHaveLength(12);
    expect(roster.filter((d) => d.status === "pending")).toHaveLength(3);
  });
  it("uses only canonical region names", () => {
    for (const d of roster) expect(REGIONS).toContain(d.region);
  });
  it("slugs match makeSlug output in roster order", () => {
    const taken = new Set<string>();
    for (const d of roster) {
      const expected = makeSlug(`${d.first_name} ${d.last_name}`, taken);
      expect(d.slug).toBe(expected);
      taken.add(expected);
    }
  });
  it("keeps prototype supporter totals (leaderboard parity)", () => {
    const approved = roster.filter((d) => d.status === "approved");
    expect(approved.reduce((sum, d) => sum + d.supporters, 0)).toBe(1862);
    expect(Math.max(...approved.map((d) => d.supporters))).toBe(342);
  });
  it("every delegate has a non-empty Georgian bio", () => {
    for (const d of roster) expect(d.bio.length).toBeGreaterThan(20);
  });
});
