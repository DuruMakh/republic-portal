import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileJoinCta } from "./MobileJoinCta";

const { getSession, onAuthStateChange, pathnameRef } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  pathnameRef: { current: "/" },
}));

vi.mock("next/navigation", () => ({ usePathname: () => pathnameRef.current }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession, onAuthStateChange } }),
}));

describe("MobileJoinCta", () => {
  beforeEach(() => {
    pathnameRef.current = "/";
    getSession.mockResolvedValue({ data: { session: null } });
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("invites a guest to join", async () => {
    render(<MobileJoinCta />);
    const cta = await screen.findByRole("link", { name: "შემოგვიერთდი" });
    expect(cta).toHaveAttribute("href", "/join");
  });

  it("shows the reassurance line to a guest", async () => {
    render(<MobileJoinCta />);
    expect(await screen.findByText("ერთ წუთში · გადახდის გარეშე")).toBeInTheDocument();
  });

  it("renders the guest CTA first, so the cached shell is never signed-in", () => {
    getSession.mockReturnValue(new Promise(() => {}));
    render(<MobileJoinCta />);
    expect(screen.getByRole("link", { name: "შემოგვიერთდი" })).toBeInTheDocument();
  });

  it("swaps to the cabinet link once a session resolves", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    render(<MobileJoinCta />);
    const cta = await screen.findByRole("link", { name: "ჩემი კაბინეტი →" });
    expect(cta).toHaveAttribute("href", "/me");
    expect(screen.queryByText("ერთ წუთში · გადახდის გარეშე")).toBeNull();
  });

  it("renders nothing on the routes that are themselves the call to action", () => {
    for (const path of ["/join", "/join/terms", "/login"]) {
      pathnameRef.current = path;
      const { container, unmount } = render(<MobileJoinCta />);
      expect(container, path).toBeEmptyDOMElement();
      unmount();
    }
  });
});
