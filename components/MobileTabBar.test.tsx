import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "./MobileTabBar";

const { pathnameRef } = vi.hoisted(() => ({ pathnameRef: { current: "/me/polls" } }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } }),
}));

const TABS = [
  { href: "/me/profile", label: "პროფილი" },
  { href: "/me/polls", label: "გამოკითხვა", count: 2 },
  { href: "/me/events", label: "ღონისძიება" },
  { href: "/me/news", label: "სიახლე" },
];
const MORE = [
  { href: "/me/delegate", label: "ჩემი დელეგატი" },
  { href: "/me/billing", label: "გადახდები" },
];

describe("MobileTabBar", () => {
  beforeEach(() => {
    pathnameRef.current = "/me/polls";
  });

  it("renders four destinations plus the overflow trigger", () => {
    render(<MobileTabBar tabs={TABS} more={MORE} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "მეტი" })).toBeInTheDocument();
  });

  it("marks the current tab for screen readers", () => {
    render(<MobileTabBar tabs={TABS} more={MORE} />);
    expect(screen.getByRole("link", { name: /გამოკითხვა/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "პროფილი" })).not.toHaveAttribute("aria-current");
  });

  it("carries the open-polls count as a badge", () => {
    render(<MobileTabBar tabs={TABS} more={MORE} />);
    expect(screen.getByRole("link", { name: /გამოკითხვა/ })).toHaveTextContent("2");
  });

  it("opens and closes the overflow sheet", () => {
    render(<MobileTabBar tabs={TABS} more={MORE} />);
    fireEvent.click(screen.getByRole("button", { name: "მეტი" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("still offers the overflow trigger when a role has no extra destinations, because sign-out lives there", () => {
    render(<MobileTabBar tabs={TABS} more={[]} />);
    expect(screen.getByRole("button", { name: "მეტი" })).toBeInTheDocument();
  });

  it("hides itself on the membership wizard, which must not offer five exits", () => {
    pathnameRef.current = "/me/membership";
    const { container } = render(<MobileTabBar tabs={TABS} more={MORE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps every tab label at or above the 0.74rem floor", () => {
    const { container } = render(<MobileTabBar tabs={TABS} more={MORE} />);
    const bar = container.querySelector("nav")!;
    expect(bar.className).toContain("text-[0.74rem]");
  });

  // Regression guard for owner fix #7. The registered tab set contains /me,
  // which is a prefix of every other cabinet route; a naive prefix match marks
  // two tabs at once. This is the exact bug already fixed in CabinetNav.
  it("marks only the deepest tab when the registered set includes the /me root", () => {
    const registered = [
      { href: "/me", label: "მთავარი" },
      { href: "/me/events", label: "ღონისძიება" },
      { href: "/me/news", label: "სიახლე" },
      { href: "/me/profile", label: "პროფილი" },
    ];
    pathnameRef.current = "/me/events";
    const { container } = render(<MobileTabBar tabs={registered} more={[]} />);
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(screen.getByRole("link", { name: "ღონისძიება" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "მთავარი" })).not.toHaveAttribute("aria-current");
  });
});
