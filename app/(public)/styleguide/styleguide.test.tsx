import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/styleguide",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import StyleguidePage from "./page";

describe("StyleguidePage", () => {
  it("shows the reusable auth progress and Google provider control", () => {
    render(<StyleguidePage />);

    expect(screen.getByRole("list", { name: "რეგისტრაციის ნაბიჯები" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google-ით გაგრძელება" })).toBeInTheDocument();
  });
});
