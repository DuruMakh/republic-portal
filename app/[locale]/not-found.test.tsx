import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n/translate";

const nav = vi.hoisted(() => ({ pathname: "/no-such-page", locale: "ka" as "ka" | "en" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/i18n/server", () => ({
  getCopy: async () => (source: string) => translate(source, nav.locale),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import RootNotFound, { generateMetadata } from "./not-found";

afterEach(() => {
  nav.pathname = "/no-such-page";
  nav.locale = "ka";
});

describe("site-wide not-found page (unknown URLs)", () => {
  it("titles the English missing page in English", async () => {
    nav.locale = "en";
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("Page not found — Georgian Republic");
  });
  it("shows the Georgian notice and titles the tab in Georgian", async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("გვერდი ვერ მოიძებნა — ქართული რესპუბლიკა");
    render(<RootNotFound />);
    expect(
      screen.getByRole("heading", { level: 1, name: "გვერდი ვერ მოიძებნა." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "დაბრუნდი მთავარ გვერდზე" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  // This page is prerendered once, for /_not-found, but opened at whatever address was mistyped.
  // Chrome that differs by address (the phone back header under /news/, /events/ and /delegates/)
  // would exist only on the client, and hydration would fail.
  it.each(["/news/a/b", "/events/a/b", "/delegates/a/b", "/admin/a"])(
    "shows one header at %s, exactly as the prerendered page does",
    (address) => {
      nav.pathname = address;
      const { container } = render(<RootNotFound />);
      expect(container.querySelectorAll("header")).toHaveLength(1);
    },
  );
});
