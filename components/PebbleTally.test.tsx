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
});
