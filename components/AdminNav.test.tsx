import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminNav } from "./AdminNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/members",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

describe("AdminNav (spec §3.1)", () => {
  const tabs = [
    { href: "/admin", label: "მიმოხილვა" },
    { href: "/admin/members", label: "წევრები" },
  ];
  it("renders the eyebrow, tabs, active marker and sign-out", () => {
    render(<AdminNav tabs={tabs} />);
    expect(screen.getByText("ადმინისტრირება")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "მიმოხილვა" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "წევრები" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "გასვლა" })).toBeInTheDocument();
  });
  it("„მიმოხილვა“ is active only on the exact /admin path", () => {
    render(<AdminNav tabs={tabs} />);
    expect(screen.getByRole("link", { name: "მიმოხილვა" })).not.toHaveAttribute("aria-current");
  });
  it("renders no tab links for an empty tab list (editor) but keeps sign-out", () => {
    render(<AdminNav tabs={[]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "გასვლა" })).toBeInTheDocument();
  });
});
