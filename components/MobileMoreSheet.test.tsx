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
});
