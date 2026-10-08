import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PebbleCouncil } from "./PebbleCouncil";

describe("PebbleCouncil", () => {
  it("is a decorative drawing around the label (seat and member counts: lib/pebbles)", () => {
    const { container } = render(<PebbleCouncil seats={5} centerLabel="ბორდი" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("text")).toHaveTextContent("ბორდი");
  });

  it("leaves its width to the caller (a built-in w-full would override the page's clamp)", () => {
    const { container } = render(
      <PebbleCouncil seats={5} centerLabel="ბორდი" className="w-[200px]" />,
    );
    const classes = container.querySelector("svg")?.getAttribute("class")?.split(/\s+/) ?? [];
    expect(classes).toContain("w-[200px]");
    expect(classes.filter((c) => c.startsWith("w-"))).toEqual(["w-[200px]"]);
  });
});
