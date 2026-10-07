import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/no-such-page" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import RootNotFound, { metadata } from "./not-found";

afterEach(() => {
  nav.pathname = "/no-such-page";
});

describe("site-wide not-found page (unknown URLs)", () => {
  it("shows the Georgian notice", () => {
    render(<RootNotFound />);
    expect(
      screen.getByRole("heading", { level: 1, name: "გვერდი ვერ მოიძებნა." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "დაბრუნდი მთავარ გვერდზე" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("keeps the site header, with its one account action, and the footer around it", () => {
    render(<RootNotFound />);
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "შემოგვიერთდი" })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  // This page is prerendered once, for /_not-found, but opened at whatever address was mistyped.
  // Chrome that differs by address (the phone back header under /news/, /events/ and /delegates/,
  // the non-sticky header under /admin) would exist only on the client, and hydration would fail.
  it.each(["/news/a/b", "/events/a/b", "/delegates/a/b"])(
    "shows one header at %s, exactly as the prerendered page does",
    (address) => {
      nav.pathname = address;
      const { container } = render(<RootNotFound />);
      expect(container.querySelectorAll("header")).toHaveLength(1);
    },
  );

  it("keeps the sticky phone header at /admin/a, exactly as the prerendered page does", () => {
    nav.pathname = "/admin/a";
    render(<RootNotFound />);
    expect(screen.getByRole("banner").className).toContain("sticky");
  });

  it("titles the tab in Georgian instead of the framework's English default", () => {
    expect(metadata.title).toBe("გვერდი ვერ მოიძებნა — ქართული რესპუბლიკა");
  });
});
