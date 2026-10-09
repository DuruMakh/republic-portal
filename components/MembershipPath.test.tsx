import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MembershipPath } from "./MembershipPath";

describe("MembershipPath (ADR-048)", () => {
  it("draws the steps as teal outline pebbles, the last one filled teal, on a teal line", () => {
    const { container } = render(<MembershipPath label="Path" steps={["One", "Two", "Three"]} />);
    const tones = Array.from(container.querySelectorAll("[data-tone]")).map((el) =>
      el.getAttribute("data-tone"),
    );
    expect(tones).toEqual(["teal-outline", "teal-outline", "teal"]);
    expect(container.querySelector("ol")).toHaveClass("before:bg-teal/35");
    expect(screen.getByText("Path")).toHaveClass("text-teal");
  });
});
