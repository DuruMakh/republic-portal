import { describe, expect, it } from "vitest";
import * as home from "@/lib/home-copy";
import * as about from "@/lib/about-copy";
import * as archive from "@/lib/archive-documents";
import * as principles from "@/lib/principles-copy";
import * as structure from "@/lib/structure-copy";
import * as support from "@/lib/support-copy";
import { publicMessages } from "./messages/public";

function copyStrings(value: unknown): string[] {
  if (typeof value === "string") return /[ა-ჰ]/u.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(copyStrings);
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => key !== "sample")
      .flatMap(([, child]) => copyStrings(child));
  }
  return [];
}

describe("English public copy coverage", () => {
  it("covers the complete public copy collections, including historical notes and form errors", () => {
    const skippedExports = new Set([
      "ABOUT_INTRO",
      "ABOUT_UNITY",
      "GEORGIAN_NUMERALS",
      "SECTION_INDEX",
    ]);
    const sources = [home, about, archive, principles, structure, support].flatMap((module) =>
      Object.entries(module)
        .filter(([key]) => !skippedExports.has(key) && !key.includes("_ADMIN"))
        .flatMap(([, value]) => copyStrings(value)),
    );
    const untranslated = [...new Set(sources)].filter((source) => !publicMessages[source]);
    expect(untranslated).toEqual([]);
  });

  it("does not contain unreviewed Georgian text in its English values", () => {
    const untranslated = Object.values(publicMessages).filter((value) => /[ა-ჰ]/u.test(value));
    expect(untranslated).toEqual([]);
  });
});
