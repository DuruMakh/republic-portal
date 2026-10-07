import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PebbleCouncil } from "./PebbleCouncil";

describe("PebbleCouncil", () => {
  it("is a decorative drawing: one seat per board member around the label, members around them", () => {
    const { container } = render(<PebbleCouncil seats={5} centerLabel="ბორდი" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "-260 -260 520 520");
    expect(container.querySelectorAll("ellipse.council-seat")).toHaveLength(5);
    expect(container.querySelectorAll("ellipse.fill-line")).toHaveLength(160);
    expect(container.querySelector("text")).toHaveTextContent("ბორდი");
  });

  it("staggers the seats' fade-in", () => {
    const { container } = render(<PebbleCouncil seats={5} centerLabel="ბორდი" />);
    const delays = Array.from(container.querySelectorAll<SVGElement>("ellipse.council-seat")).map(
      (e) => e.style.animationDelay,
    );
    expect(delays).toEqual(["0.15s", "0.27s", "0.39s", "0.51s", "0.63s"]);
  });
});
