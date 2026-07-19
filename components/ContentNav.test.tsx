import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/content/events" }));

import { ContentNav } from "./ContentNav";

describe("ContentNav", () => {
  it("renders the three sections and marks the active one", () => {
    render(<ContentNav />);
    expect(screen.getByRole("link", { name: "სიახლეები" })).toHaveAttribute(
      "href",
      "/admin/content/news",
    );
    expect(screen.getByRole("link", { name: "ღონისძიებები" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "გამოკითხვები" })).not.toHaveAttribute("aria-current");
  });
});
