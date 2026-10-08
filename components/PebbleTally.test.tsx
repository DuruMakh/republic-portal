import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PebbleTally } from "./PebbleTally";

describe("PebbleTally", () => {
  it("draws a wider for pile than against pile, and a visible legend", () => {
    const { container } = render(<PebbleTally forLabel="მომხრე" againstLabel="წინააღმდეგი" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("ellipse.fill-brand")).toHaveLength(36);
    expect(container.querySelectorAll("ellipse.fill-line")).toHaveLength(24);
    expect(screen.getByText("მომხრე")).toBeInTheDocument();
    expect(screen.getByText("წინააღმდეგი")).toBeInTheDocument();
  });
});
