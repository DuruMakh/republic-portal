import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Masthead } from "./Masthead";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

const NAV_ITEMS = [
  { href: "/delegates", label: "Delegates" },
  { href: "/news", label: "News" },
];
const TEST_DATE = "23.07.2026";

describe("Masthead", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReset();
  });

  it("renders the full masthead (vertical lockup + dateline) on the homepage", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<Masthead navItems={NAV_ITEMS} dateKa={TEST_DATE} cta={<span>CTA</span>} />);

    const image = screen.getByRole("img");
    expect(image.getAttribute("src")).toContain("lockup-vertical-geo-red");
    expect(screen.getByText(TEST_DATE)).toBeInTheDocument();
  });

  it("renders the compact masthead (horizontal lockup, no dateline) elsewhere", () => {
    vi.mocked(usePathname).mockReturnValue("/delegates");
    render(<Masthead navItems={NAV_ITEMS} dateKa={TEST_DATE} cta={<span>CTA</span>} />);

    const image = screen.getByRole("img");
    expect(image.getAttribute("src")).toContain("lockup-horizontal-geo-red");
    expect(image.getAttribute("src")).not.toContain("lockup-vertical-geo-red");
    expect(screen.queryByText(TEST_DATE)).not.toBeInTheDocument();
  });

  it("marks the active nav link with aria-current and leaves the rest unmarked", () => {
    vi.mocked(usePathname).mockReturnValue("/delegates");
    render(<Masthead navItems={NAV_ITEMS} dateKa={TEST_DATE} cta={<span>CTA</span>} />);
    expect(screen.getByRole("link", { name: "Delegates" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "News" })).not.toHaveAttribute("aria-current");
  });

  it("renders the caller-supplied cta and sessionSlot", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(
      <Masthead
        navItems={NAV_ITEMS}
        dateKa={TEST_DATE}
        cta={<span>JOIN_CTA</span>}
        sessionSlot={<span>SESSION_SLOT</span>}
      />,
    );
    expect(screen.getByText("JOIN_CTA")).toBeInTheDocument();
    expect(screen.getByText("SESSION_SLOT")).toBeInTheDocument();
  });

  it("renders the nav landmark with the accessible name 'მთავარი ნავიგაცია'", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<Masthead navItems={NAV_ITEMS} dateKa={TEST_DATE} cta={<span>CTA</span>} />);
    expect(screen.getByRole("navigation", { name: "მთავარი ნავიგაცია" })).toBeInTheDocument();
  });
});
