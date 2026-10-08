import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as copy from "./structure-copy";

const SPEC = readFileSync(
  path.resolve(
    __dirname,
    "../docs/superpowers/specs/2026-10-07-organization-structure-page-design.md",
  ),
  "utf8",
);

/** Every string value reachable from the module's exports (arrays and objects flattened). */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("structure copy", () => {
  it("splices every string verbatim from the approved spec text", () => {
    const values = Object.entries(copy)
      .filter(([name]) => name !== "STRUCTURE_HREF")
      .flatMap(([, value]) => strings(value))
      .filter((s) => !s.startsWith("#"));
    expect(values.length).toBeGreaterThan(25);
    for (const value of values) expect(SPEC, value).toContain(value);
  });

  it("formats the rule-card label the way the spec shows it", () => {
    expect(copy.votesLabel(4, 5)).toBe("5-დან 4 ხმა");
    expect(SPEC).toContain(copy.votesLabel(4, 5));
  });

  it("contains no quotation marks of any kind", () => {
    // Built from code points: ka-gate reads both literal curly quotes and their escapes.
    const curly = String.fromCodePoint(0x201c, 0x201d, 0x201e);
    const quote = new RegExp(`[\\x22\\x27${curly}]`);
    const all = strings(Object.values(copy)).join("");
    expect(all).not.toMatch(quote);
  });

  it("keeps the list lengths the owner approved", () => {
    expect(copy.BOARD_DUTIES).toHaveLength(4);
    expect(copy.MEMBERS_PATH_STEPS).toHaveLength(3);
    expect(copy.MEMBERS_RIGHTS).toHaveLength(4);
    expect(copy.SECTION_INDEX.map((s) => s.href)).toEqual(["#board", "#members", "#vote"]);
  });
});
