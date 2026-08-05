import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { installMatchMedia } from "./test-utils/matchMedia";
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

  it("closes and restores body scroll when the viewport crosses above md", () => {
    const media = installMatchMedia();
    try {
      render(<MobileMenu navItems={NAV} />);
      fireEvent.click(screen.getByRole("button"));
      expect(document.body.style.overflow).toBe("hidden");

      act(() => media.emit("(min-width: 48rem)", true));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    } finally {
      media.restore();
    }
  });

  it("marks the current page for screen readers", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    expect(screen.getByRole("link", { name: "მთავარი" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "რეიტინგი" })).not.toHaveAttribute("aria-current");
  });

  it("closes when the current-route link is clicked without a pathname change", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button"));

    fireEvent.click(screen.getByRole("link", { current: "page" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is hidden from md up, where the inline masthead nav takes over", () => {
    const { container } = render(<MobileMenu navItems={NAV} />);
    expect((container.firstElementChild as HTMLElement).className).toContain("md:hidden");
  });

  // A bare `if (!open) trigger.focus()` effect also runs on mount, which stole
  // focus to the hamburger on every mobile page load and broke top-of-page tab
  // order. Both halves matter: without the second, deleting the effect passes.
  it("does not touch focus on first render", () => {
    render(<MobileMenu navItems={NAV} />);
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "მენიუ" }));
  });

  it("returns focus to the trigger after a real open then close", () => {
    render(<MobileMenu navItems={NAV} />);
    const trigger = screen.getByRole("button", { name: "მენიუ" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });

  it("moves focus into the panel on open, so the overlay owns the tab sequence", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("wraps Tab at the end of the panel back to the start", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    const dialog = screen.getByRole("dialog");
    const focusable = [...dialog.querySelectorAll<HTMLElement>("a[href], button")];
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("wraps Shift+Tab at the start of the panel round to the end", () => {
    render(<MobileMenu navItems={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: "მენიუ" }));
    const dialog = screen.getByRole("dialog");
    const focusable = [...dialog.querySelectorAll<HTMLElement>("a[href], button")];
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  // The trigger sits outside the panel, so an activeElement that is neither
  // boundary must be pulled back in — otherwise the first Shift+Tab after
  // opening escapes the overlay while it still covers the screen.
  it("pulls focus back in when it is outside the panel entirely", () => {
    render(<MobileMenu navItems={NAV} />);
    const trigger = screen.getByRole("button", { name: "მენიუ" });
    fireEvent.click(trigger);
    trigger.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});
