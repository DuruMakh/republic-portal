import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StickyBar } from "./StickyBar";

describe("StickyBar", () => {
  it("renders its children", () => {
    render(
      <StickyBar>
        <button type="button">ok</button>
      </StickyBar>,
    );
    expect(screen.getByRole("button", { name: "ok" })).toBeInTheDocument();
  });

  it("is sticky, not fixed — a fixed bar would occlude the end of the page", () => {
    const { container } = render(<StickyBar>x</StickyBar>);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("sticky");
    expect(bar.className).not.toContain("fixed");
  });

  it("is hidden from md up, so desktop chrome is untouched", () => {
    const { container } = render(<StickyBar>x</StickyBar>);
    expect((container.firstElementChild as HTMLElement).className).toContain("md:hidden");
  });

  it("pads for the iPhone home indicator", () => {
    const { container } = render(<StickyBar>x</StickyBar>);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("pb-[env(safe-area-inset-bottom)]");
  });

  it("carries the 2px ink rule the design system uses to separate chrome", () => {
    const { container } = render(<StickyBar>x</StickyBar>);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("border-t-2");
    expect(bar.className).toContain("border-ink");
  });
});
