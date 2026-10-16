import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as copy from "@/lib/structure-copy";
import StructurePage from "./page";

// Teal on /structure (ADR-048): information and illustrations are teal; the headline accent,
// the section links and the decision-card headlines stay red.
describe("/structure colours", () => {
  it("draws the list bullets as teal pebbles", () => {
    const { container } = render(<StructurePage />);
    const bullets = container.querySelectorAll("ul li > [data-tone]");
    expect(bullets.length).toBeGreaterThan(0);
    bullets.forEach((b) => expect(b).toHaveAttribute("data-tone", "teal"));
  });

  it("colours the small labels above each list teal", () => {
    const { container } = render(<StructurePage />);
    // The labels share one small-caps style; some label words (the board) also appear elsewhere.
    const labels = Array.from(container.querySelectorAll('[class*="tracking-[.2em]"]'));
    const texts = labels.map((el) => el.textContent);
    for (const label of [
      copy.BOARD_DUTIES_LABEL,
      copy.BOARD_RULES_LABEL,
      copy.MEMBERS_PATH_LABEL,
      copy.MEMBERS_RIGHTS_LABEL,
    ]) {
      expect(texts).toContain(label);
    }
    labels.forEach((el) => expect(el).toHaveClass("text-teal"));
  });

  it("keeps the red headline accent", () => {
    const { container } = render(<StructurePage />);
    expect(container.querySelector("h1 .text-brand")).not.toBeNull();
  });
});
