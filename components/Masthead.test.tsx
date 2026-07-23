import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Masthead } from "./Masthead";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

const NAV_ITEMS = [
  { href: "/delegates", label: "Delegates" },
  { href: "/news", label: "News" },
];

describe("Masthead", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReset();
  });

  it("renders the horizontal lockup", () => {
    vi.mocked(usePathname).mockReturnValue("/delegates");
    render(<Masthead navItems={NAV_ITEMS} cta={<span>CTA</span>} />);

    const image = screen.getByRole("img");
    expect(image.getAttribute("src")).toContain("lockup-horizontal-geo-red");
  });

  it("marks the active nav link with aria-current and leaves the rest unmarked", () => {
    vi.mocked(usePathname).mockReturnValue("/delegates");
    render(<Masthead navItems={NAV_ITEMS} cta={<span>CTA</span>} />);
    expect(screen.getByRole("link", { name: "Delegates" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "News" })).not.toHaveAttribute("aria-current");
  });

  it("renders the caller-supplied cta and sessionSlot", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(
      <Masthead
        navItems={NAV_ITEMS}
        cta={<span>JOIN_CTA</span>}
        sessionSlot={<span>SESSION_SLOT</span>}
      />,
    );
    expect(screen.getByText("JOIN_CTA")).toBeInTheDocument();
    expect(screen.getByText("SESSION_SLOT")).toBeInTheDocument();
  });

  it("renders the nav landmark with the accessible name 'მთავარი ნავიგაცია'", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<Masthead navItems={NAV_ITEMS} cta={<span>CTA</span>} />);
    expect(screen.getByRole("navigation", { name: "მთავარი ნავიგაცია" })).toBeInTheDocument();
  });
});
