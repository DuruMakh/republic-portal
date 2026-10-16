import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OfflinePage from "./page";

describe("OfflinePage", () => {
  it("carries the „ერთობა“ fonts itself, since it sits outside the ერთობა layout", () => {
    render(<OfflinePage />);
    expect(screen.getByRole("main", { name: "კავშირი გაწყვეტილია" })).toHaveClass("unity-fonts");
  });
});
