import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("theme tokens (ADR-046)", () => {
  it("defines the teal second colour and its hover shade", () => {
    expect(css).toMatch(/--color-teal:\s*#235b59;/i);
    expect(css).toMatch(/--color-teal-dark:\s*#1a4644;/i);
  });

  it("has no teal tint token (owner, 2026-10-08: no tinted panels)", () => {
    expect(css).not.toMatch(/--color-teal-(tint|soft|light|pale)/);
  });

  it("draws the masthead rule as one bottom border: 2px ink, a 2px see-through gap, 1px teal", () => {
    const block = css.match(/@utility masthead-rule \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toContain("border-bottom: 5px solid");
    expect(block).toMatch(/var\(--color-teal\) 0 1px/);
    expect(block).toMatch(/transparent 1px 3px/);
    expect(block).toMatch(/var\(--color-ink\) 3px 5px/);
    expect(block).toMatch(/\b0 0 5 0;/);
  });
});
