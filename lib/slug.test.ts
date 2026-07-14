import { describe, expect, it } from "vitest";
import { makeSlug, transliterateGeorgian } from "./slug";

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
});
