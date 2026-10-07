import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/no-such-page" }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import RootNotFound, { metadata } from "./not-found";

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

  it("titles the tab in Georgian instead of the framework's English default", () => {
    expect(metadata.title).toBe("გვერდი ვერ მოიძებნა — ქართული რესპუბლიკა");
  });
});
