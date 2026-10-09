import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pebble } from "./Pebble";

describe("Pebble", () => {
  it("is decorative and defaults to the brand tone", () => {
    const { container } = render(<Pebble className="h-3 w-3" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("data-tone", "brand");
  });

  it("has a filled teal tone and a teal outline tone (ADR-048, /structure)", () => {
    const filled = render(<Pebble tone="teal" />).container.firstElementChild;
    expect(filled).toHaveAttribute("data-tone", "teal");
    expect(filled).toHaveClass("bg-teal", "border-teal", "text-paper");
    const outline = render(<Pebble tone="teal-outline" />).container.firstElementChild;
    expect(outline).toHaveAttribute("data-tone", "teal-outline");
    expect(outline).toHaveClass("border-teal", "text-teal", "bg-paper-bright");
  });
});
