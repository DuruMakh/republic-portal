import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pebble } from "./Pebble";

describe("Pebble", () => {
  it("is decorative, carries the pebble shape and defaults to the brand tone", () => {
    const { container } = render(<Pebble className="h-3 w-3" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("data-tone", "brand");
    expect(el.className).toContain("pebble");
    expect(el.className).toContain("bg-brand");
    expect(el.className).toContain("h-3 w-3");
  });

  it("renders the empty and outline tones", () => {
    const { container } = render(
      <>
        <Pebble tone="empty" />
        <Pebble tone="outline">1</Pebble>
      </>,
    );
    const [empty, outline] = Array.from(container.children) as HTMLElement[];
    expect(empty?.className).toContain("bg-surface");
    expect(outline?.className).toContain("border-brand");
    expect(outline).toHaveTextContent("1");
  });
});
