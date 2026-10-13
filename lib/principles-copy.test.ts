import { describe, expect, it } from "vitest";
import { PRINCIPLES, principleAnchor } from "./principles-copy";

describe("principles copy", () => {
  it("keeps the owner's twelve principles in order", () => {
    expect(PRINCIPLES).toHaveLength(12);
    expect(PRINCIPLES[0]?.title).toBe("საქართველოს დამოუკიდებლობა და სუვერენიტეტი");
    expect(PRINCIPLES[11]?.title).toBe("მდიდარი საქართველო და ტექნოლოგიური განვითარება");
    expect(PRINCIPLES.map((p) => p.paragraphs.length)).toEqual([
      1, 2, 2, 2, 2, 1, 1, 2, 1, 2, 2, 2,
    ]);
  });

  it("has no stray whitespace or empty paragraphs", () => {
    for (const { title, paragraphs } of PRINCIPLES) {
      for (const text of [title, ...paragraphs]) {
        expect(text, text).toBe(text.trim());
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives each principle an anchor", () => {
    expect(principleAnchor(3)).toBe("principle-3");
  });
});
