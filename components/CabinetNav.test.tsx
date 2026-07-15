import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CabinetNav } from "./CabinetNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/me/profile",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } }),
}));

const ITEMS = [
  { href: "/me/profile", label: "პროფილი" },
  { href: "/me/delegate", label: "ჩემი დელეგატი" },
  { href: "/me/billing", label: "გადახდები" },
];

describe("CabinetNav", () => {
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
});
