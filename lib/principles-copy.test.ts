import { describe, expect, it } from "vitest";
import {
  GEORGIAN_NUMERALS,
  PRINCIPLES,
  principleAnchor,
  principleFromHash,
  principleLabel,
} from "./principles-copy";

describe("principles copy", () => {
  it("keeps the owner's twelve principles in order", () => {
    expect(PRINCIPLES).toHaveLength(12);
    expect(PRINCIPLES[0]?.title).toBe("საქართველოს დამოუკიდებლობა და სუვერენიტეტი");
    expect(PRINCIPLES[11]?.title).toBe("მდიდარი საქართველო და ტექნოლოგიური განვითარება");
    expect(PRINCIPLES.map((p) => p.body.length)).toEqual([1, 2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2]);
  });

  it("keeps the owner's text whole: the lead is the first sentence of the first paragraph", () => {
    expect(PRINCIPLES[0]?.lead).toBe(
      "საქართველო არის და იქნება თავისუფალი, დამოუკიდებელი სახელმწიფო.",
    );
    expect(PRINCIPLES[0]?.body[0]).toMatch(/^1989 წლის 9 აპრილს/);
    // Principle 8's first paragraph is a single sentence: it is all lead.
    expect(PRINCIPLES[7]?.body[0]).toMatch(/^სახელმწიფომ ასევე/);
  });

  it("has no stray whitespace or empty text", () => {
    for (const { title, lead, body, roots } of PRINCIPLES) {
      const rootTexts = roots.flatMap((root) => Object.values(root).filter((v) => v !== root.kind));
      for (const text of [title, lead, ...body, ...rootTexts]) {
        expect(text, text).toBe(text.trim());
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives every principle a historical-roots note", () => {
    for (const { roots } of PRINCIPLES) expect(roots.length).toBeGreaterThan(0);
  });

  it("gives each principle an anchor, a label and a Georgian numeral", () => {
    expect(principleAnchor(3)).toBe("principle-3");
    expect(principleLabel(3)).toBe("პრინციპი 03");
    expect(principleLabel(12)).toBe("პრინციპი 12");
    expect(GEORGIAN_NUMERALS).toHaveLength(PRINCIPLES.length);
  });

  it("reads a principle number back from a URL hash", () => {
    expect(principleFromHash("#principle-3")).toBe(3);
    expect(principleFromHash("#principle-12")).toBe(12);
    expect(principleFromHash("#principle-13")).toBeNull();
    expect(principleFromHash("#principle-0")).toBeNull();
    expect(principleFromHash("#contents")).toBeNull();
    expect(principleFromHash("")).toBeNull();
  });
});
