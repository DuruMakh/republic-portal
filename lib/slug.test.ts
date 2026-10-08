import { describe, expect, it } from "vitest";
import { makeSlugFrom, slugFrom, transliterateGeorgian } from "./slug";

describe("transliterateGeorgian", () => {
  it("maps every Georgian letter (aspirates unmarked)", () => {
    expect(transliterateGeorgian("აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ")).toBe(
      "abgdevztiklmnopzhrstupkghqshchtsdztschkhjh",
    );
  });
  it("transliterates real names", () => {
    expect(transliterateGeorgian("გიორგი მაისურაძე")).toBe("giorgi maisuradze");
    expect(transliterateGeorgian("თამარ ქავთარაძე")).toBe("tamar kavtaradze");
    expect(transliterateGeorgian("მარიამ წიქარიშვილი")).toBe("mariam tsikarishvili");
    expect(transliterateGeorgian("ბექა ღოღობერიძე")).toBe("beka ghoghoberidze");
  });
  it("passes through Latin and digits untouched", () => {
    expect(transliterateGeorgian("abc 123")).toBe("abc 123");
  });
});

describe("slugFrom / makeSlugFrom (Phase 5: news + events)", () => {
  it("romanizes Georgian titles", () => {
    expect(slugFrom("ახალი წელი თბილისში", "article")).toBe("akhali-tseli-tbilisshi");
  });

  it("collapses punctuation/whitespace runs and trims hyphens", () => {
    expect(slugFrom("„დიდი შეხვედრა“ — 2026!", "event")).toBe("didi-shekhvedra-2026");
  });

  it("falls back when nothing romanizes", () => {
    expect(slugFrom("Прага 2026", "article")).toBe("2026"); // digits survive
    expect(slugFrom("Прага", "article")).toBe("article");
    expect(slugFrom("", "event")).toBe("event");
  });

  it("suffixes -2, -3 on collision", () => {
    const taken = new Set(["akhali-tseli", "akhali-tseli-2"]);
    expect(makeSlugFrom("ახალი წელი", "article", taken)).toBe("akhali-tseli-3");
    expect(makeSlugFrom("ახალი წელი", "article", new Set())).toBe("akhali-tseli");
  });

  it("romanizes a delegate name with the delegate fallback", () => {
    expect(slugFrom("გიორგი მაისურაძე", "delegati")).toBe("giorgi-maisuradze");
  });
});

describe("SLUG_MAX truncation (R2 §8.6)", () => {
  const long = "ძალიან".repeat(30); // romanizes to ~180 latin chars
  it("caps the base at 80", () => {
    const s = slugFrom(long, "article");
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
  it("keeps deduped candidates within the cap", () => {
    const base = slugFrom(long, "article");
    const taken = new Set([base]);
    const next = makeSlugFrom(long, "article", taken);
    expect(next.length).toBeLessThanOrEqual(80);
    expect(next).not.toBe(base);
  });
});
