import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileMoreSheet } from "./MobileMoreSheet";

const { push, signOut } = vi.hoisted(() => ({ push: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

const ITEMS = [
  { href: "/me/delegate", label: "ჩემი დელეგატი" },
  { href: "/me/billing", label: "გადახდები" },
];

describe("MobileMoreSheet", () => {
  beforeEach(() => {
    push.mockClear();
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
  });

  it("lists the overflow destinations", () => {
    render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    expect(screen.getByRole("link", { name: "ჩემი დელეგატი" })).toHaveAttribute(
      "href",
      "/me/delegate",
    );
  });

  it("always offers the route back to the public site and sign-out", () => {
    render(<MobileMoreSheet items={[]} onClose={vi.fn()} />);
    expect(screen.getByRole("link", { name: "← საჯარო" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "გასვლა" })).toBeInTheDocument();
  });

  it("signs out and navigates home", async () => {
    render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "გასვლა" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("closes when the scrim is clicked", () => {
    const onClose = vi.fn();
    render(<MobileMoreSheet items={ITEMS} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("more-scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is a modal dialog", () => {
    render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  // An aria-modal dialog must own the keyboard. Without a trap, Tab walks out
  // into the tab bar and cabinet content under the opaque overlay — reachable
  // by keyboard and by screen-reader swipe while nothing is visible.
  it("moves focus into the dialog on open", () => {
    render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<MobileMoreSheet items={ITEMS} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks body scroll while open and restores it on close", () => {
    const { unmount } = render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("wraps Tab at the end of the dialog back to the start", () => {
    render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    const focusable = [...dialog.querySelectorAll<HTMLElement>("a[href], button")];
    const first = focusable[0]!;
    focusable[focusable.length - 1]!.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("pulls focus back in when it has escaped the dialog", () => {
    render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    const scrim = screen.getByTestId("more-scrim");
    scrim.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("returns focus to whatever opened it", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<MobileMoreSheet items={ITEMS} onClose={vi.fn()} />);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
