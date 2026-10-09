import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PebbleTally } from "./PebbleTally";

describe("PebbleTally", () => {
  it("is a decorative drawing with a visible legend (pile sizes: lib/pebbles)", () => {
    const { container } = render(<PebbleTally forLabel="მომხრე" againstLabel="წინააღმდეგი" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("მომხრე")).toBeInTheDocument();
    expect(screen.getByText("წინააღმდეგი")).toBeInTheDocument();
  });

  it("draws the for pile and its legend swatch in teal, against stays line-grey (ADR-048)", () => {
    const { container } = render(<PebbleTally forLabel="For" againstLabel="Against" />);
    expect(container.querySelectorAll("ellipse.fill-teal").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("ellipse.fill-brand")).toHaveLength(0);
    expect(container.querySelectorAll("ellipse.fill-line").length).toBeGreaterThan(0);
    expect(container.querySelector('[data-tone="teal"]')).not.toBeNull();
  });
});
