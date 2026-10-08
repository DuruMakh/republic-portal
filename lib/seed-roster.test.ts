import { describe, expect, it } from "vitest";
import roster from "../scripts/seed-roster.json";
import { makeSlugFrom } from "./slug";

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
  it("uses only canonical region names", () => {
    for (const d of roster) expect(REGIONS).toContain(d.region);
  });
  it("slugs match makeSlugFrom output in roster order", () => {
    const taken = new Set<string>();
    for (const d of roster) {
      const expected = makeSlugFrom(`${d.first_name} ${d.last_name}`, "delegati", taken);
      expect(d.slug).toBe(expected);
      taken.add(expected);
    }
  });
  it("every delegate has a non-empty Georgian bio", () => {
    for (const d of roster) expect(d.bio.length).toBeGreaterThan(20);
  });
});
