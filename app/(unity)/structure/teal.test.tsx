import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mtavruli } from "@/lib/mtavruli";
import * as copy from "@/lib/structure-copy";
import StructurePage from "./page";

// Teal on /structure (ADR-048, carried into the „ერთობა“ design): information and
// illustrations are teal; the headline accent and the decision-card headlines stay red. The
// small list labels are now the design's grey (text-secondary), no longer teal.
describe("/structure colours", () => {
  it("draws the list bullets as teal pebbles", () => {
    const { container } = render(<StructurePage />);
    const bullets = container.querySelectorAll("ul li > span[aria-hidden='true']:first-child");
    expect(bullets.length).toBeGreaterThanOrEqual(8);
    bullets.forEach((b) => expect(b).toHaveClass("bg-teal"));
  });

  it("draws the chosen board pebbles teal", () => {
    render(<StructurePage />);
    const row = screen.getByRole("group", { name: "5-დან 4 ხმა" });
    const on = within(row)
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(on).toHaveLength(4);
    on.forEach((b) => expect(b.firstElementChild).toHaveClass("bg-teal"));
  });

  it("keeps the red headline accent and red rule headlines", () => {
    const { container } = render(<StructurePage />);
    expect(container.querySelector("h1 .text-brand")).not.toBeNull();
    for (const rule of [copy.RULE_TWO_THIRDS, copy.RULE_MAJORITY]) {
      expect(screen.getByText(mtavruli(rule.headline)).closest(".text-brand")).not.toBeNull();
    }
  });
});
