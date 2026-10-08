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
});
