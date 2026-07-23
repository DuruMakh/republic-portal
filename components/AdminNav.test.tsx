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

  it("active tab has the brand underline classes, not the old pill highlight", () => {
    const { container } = render(<AdminNav tabs={tabs} />);
    const active = container.querySelector<HTMLAnchorElement>('a[href="/admin/members"]');
    expect(active!.className).toContain("border-brand");
    expect(active!.className).not.toContain("bg-brand/10");
    const inactive = container.querySelector<HTMLAnchorElement>('a[href="/admin"]');
    expect(inactive!.className).not.toContain("bg-brand/10");
    expect(inactive!.className).toContain("text-ink");
  });

  it("renders a count badge inside the tab link when a tab has a count", () => {
    const tabsWithCount = tabs.map((t) => (t.href === "/admin" ? { ...t, count: 4 } : t));
    const { container } = render(<AdminNav tabs={tabsWithCount} />);
    const link = container.querySelector('a[href="/admin"]');
    expect(link).toHaveTextContent("4");
  });
});
