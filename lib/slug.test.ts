import { describe, expect, it } from "vitest";
import { makeSlug, makeSlugFrom, slugBase, slugFrom, transliterateGeorgian } from "./slug";

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

describe("makeSlug", () => {
  it("builds a lowercase hyphenated slug", () => {
    expect(makeSlug("გიორგი მაისურაძე", new Set())).toBe("giorgi-maisuradze");
  });
  it("collapses whitespace/punctuation runs and trims hyphens", () => {
    expect(makeSlug("  ანა   ჯაფარიძე  ", new Set())).toBe("ana-japaridze");
  });
  it("suffixes on collision", () => {
    const taken = new Set(["giorgi-maisuradze"]);
    expect(makeSlug("გიორგი მაისურაძე", taken)).toBe("giorgi-maisuradze-2");
    expect(
      makeSlug("გიორგი მაისურაძე", new Set(["giorgi-maisuradze", "giorgi-maisuradze-2"])),
    ).toBe("giorgi-maisuradze-3");
  });
  it("falls back to delegati for names with no Georgian/Latin characters", () => {
    // a Cyrillic name romanizes to nothing — the applicant must stay approvable
    expect(slugBase("Николай Петров")).toBe("delegati");
    expect(makeSlug("Николай Петров", new Set())).toBe("delegati");
    expect(makeSlug("Николай Петров", new Set(["delegati"]))).toBe("delegati-2");
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

  it("keeps the delegate wrappers byte-identical", () => {
    expect(slugFrom("გიორგი მაისურაძე", "delegati")).toBe("giorgi-maisuradze");
  });
});
