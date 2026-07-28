import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CabinetNav } from "./CabinetNav";

// vi.hoisted: vi.mock factories are hoisted above imports, so the mocks they
// close over must be created in a hoisted block too — a plain const here would
// still be in the temporal dead zone when the factory runs. pathnameRef is a
// mutable box (not a value) so a test can retarget usePathname per case.
const { push, refresh, signOut, pathnameRef } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
  pathnameRef: { current: "/me/profile" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({ push, refresh }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

const ITEMS = [
  { href: "/me/profile", label: "პროფილი" },
  { href: "/me/delegate", label: "ჩემი დელეგატი" },
  { href: "/me/billing", label: "გადახდები" },
];

describe("CabinetNav", () => {
  beforeEach(() => {
    pathnameRef.current = "/me/profile";
    push.mockClear();
    refresh.mockClear();
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
  });

  it("renders all items and marks the current one", () => {
    render(<CabinetNav items={ITEMS} />);
    const active = screen.getByRole("link", { name: "პროფილი" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "გადახდები" })).not.toHaveAttribute("aria-current");
  });
  it("has a sign-out button", () => {
    render(<CabinetNav items={ITEMS} />);
    expect(screen.getByRole("button", { name: "გასვლა" })).toBeInTheDocument();
  });
  it("clicking sign-out calls signOut and navigates home", async () => {
    render(<CabinetNav items={ITEMS} />);
    fireEvent.click(screen.getByRole("button", { name: "გასვლა" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
  it("still navigates home when signOut rejects (best-effort)", async () => {
    signOut.mockRejectedValue(new Error("network offline"));
    render(<CabinetNav items={ITEMS} />);
    fireEvent.click(screen.getByRole("button", { name: "გასვლა" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("active item has the brand underline classes, not the old pill highlight", () => {
    const { container } = render(<CabinetNav items={ITEMS} />);
    const active = container.querySelector<HTMLAnchorElement>('a[href="/me/profile"]');
    expect(active!.className).toContain("border-brand");
    expect(active!.className).not.toContain("bg-brand/10");
    const inactive = container.querySelector<HTMLAnchorElement>('a[href="/me/billing"]');
    expect(inactive!.className).not.toContain("bg-brand/10");
    expect(inactive!.className).toContain("text-ink");
  });

  it("renders a count badge inside the link when an item has a count", () => {
    const itemsWithCount = ITEMS.map((item) =>
      item.href === "/me/delegate" ? { ...item, count: 3 } : item,
    );
    const { container } = render(<CabinetNav items={itemsWithCount} />);
    const link = container.querySelector('a[href="/me/delegate"]');
    expect(link).toHaveTextContent("3");
  });

  const REGISTERED_ITEMS = [
    { href: "/me", label: "მთავარი" },
    { href: "/me/events", label: "ღონისძიებები" },
    { href: "/me/news", label: "სიახლეები" },
    { href: "/me/profile", label: "პროფილი" },
  ];

  it("root „მთავარი“ is NOT marked on sibling subpages (owner fix #7)", () => {
    pathnameRef.current = "/me/events";
    render(<CabinetNav items={REGISTERED_ITEMS} />);
    expect(screen.getByRole("link", { name: "ღონისძიებები" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "მთავარი" })).not.toHaveAttribute("aria-current");
  });

  it("root „მთავარი“ is marked on /me itself and on subroutes no other item claims", () => {
    pathnameRef.current = "/me";
    const first = render(<CabinetNav items={REGISTERED_ITEMS} />);
    expect(screen.getByRole("link", { name: "მთავარი" })).toHaveAttribute("aria-current", "page");
    first.unmount();
    pathnameRef.current = "/me/membership";
    render(<CabinetNav items={REGISTERED_ITEMS} />);
    expect(screen.getByRole("link", { name: "მთავარი" })).toHaveAttribute("aria-current", "page");
  });
});
