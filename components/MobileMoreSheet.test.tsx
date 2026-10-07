import { fireEvent, render, screen } from "@testing-library/react";
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

  // The trap itself (Tab cycle, scroll lock) is useFocusTrap, tested through MobileMenu.
  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<MobileMoreSheet items={ITEMS} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
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
