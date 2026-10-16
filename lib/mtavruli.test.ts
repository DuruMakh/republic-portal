import { describe, expect, it } from "vitest";
import { mtavruli } from "./mtavruli";

describe("mtavruli", () => {
  it("turns Georgian letters into Mtavruli capitals", () => {
    expect(mtavruli("შემოგვიერთდი")).toBe("ᲨᲔᲛᲝᲒᲕᲘᲔᲠᲗᲓᲘ");
  });

  it("leaves spaces, digits and punctuation as they are", () => {
    expect(mtavruli("ა · 1-ლი →")).toBe("Ა · 1-ᲚᲘ →");
  });
});
