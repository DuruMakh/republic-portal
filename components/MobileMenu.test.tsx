import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileMenu } from "./MobileMenu";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

// Georgian fixtures spliced from existing source (never hand-typed): the
// route labels from lib/mobile-nav.ts's NEWS_INDEX/BOARD_INDEX and the /me
// label from scratch/mobile-strings.txt's nav-item fixture.
const NAV = [
  { href: "/", label: "მთავარი" },
  { href: "/leaderboard", label: "რეიტინგი" },
  { href: "/news", label: "სიახლეები" },
];

describe("MobileMenu", () => {
  it("starts closed, showing only its trigger", () => {
    render(<MobileMenu navItems={NAV} />);
    expect(screen.getByRole("button", { name: "მენიუ" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on click and lists every public destination", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    for (const item of NAV) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  it("closes on the close button", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    fireEvent.click(screen.getByRole("button", { name: "დახურვა" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("locks body scroll while open and restores it on close", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).toBe("");
  });

  it("marks the current page for screen readers", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    expect(screen.getByRole("link", { name: "მთავარი" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "რეიტინგი" })).not.toHaveAttribute("aria-current");
  });

  it("is hidden from md up, where the inline masthead nav takes over", () => {
    const { container } = render(<MobileMenu navItems={NAV} />);
    expect((container.firstElementChild as HTMLElement).className).toContain("md:hidden");
  });
});
