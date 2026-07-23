import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CabinetNav } from "./CabinetNav";

// Shared spies via vi.hoisted so both the (hoisted) vi.mock factories below and
// the test bodies can see and control the same function references.
const { push, refresh, signOut } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/me/profile",
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
});
