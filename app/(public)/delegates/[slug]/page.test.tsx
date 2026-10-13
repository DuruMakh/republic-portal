import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/public", () => ({
  fetchPublicDelegates: async () => [
    {
      id: "00000000-0000-0000-0000-000000000001",
      slug: "eka-meladze",
      first_name: "ეკა",
      last_name: "მელაძე",
      region_id: 8,
      region_name_ka: "გურია",
      bio: null,
      photo_url: null,
      active_supporters: 3,
      members: 84,
    },
  ],
  fetchDelegateBySlug: async () => null,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

import DelegatePage from "./page";
import DelegateNotFound from "./not-found";

const params = Promise.resolve({ slug: "eka-meladze" });

beforeEach(() => {
  vi.stubEnv("SHOW_RATINGS", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("delegate profile while ratings are hidden (ADR-052)", () => {
  it("shows the profile and the join call, but no member count, rank or link to the ranking", async () => {
    render(await DelegatePage({ params }));

    expect(screen.getByRole("heading", { level: 1, name: "ეკა მელაძე" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "გახდი მისი მხარდამჭერი" })).toBeInTheDocument();
    expect(screen.queryByText("84")).toBeNull();
    expect(screen.queryByText("#1")).toBeNull();
    expect(screen.queryByText(/რეიტინგ/)).toBeNull();
    expect(document.querySelector('a[href="/leaderboard"]')).toBeNull();
  });

  it("sends a missing delegate's visitor home instead of to the ranking", () => {
    render(<DelegateNotFound />);

    expect(document.querySelector('a[href="/leaderboard"]')).toBeNull();
    expect(screen.getByRole("link", { name: "დაბრუნდი მთავარ გვერდზე" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("delegate profile once SHOW_RATINGS=true", () => {
  it("brings back the member count, the rank and the link to the ranking", async () => {
    vi.stubEnv("SHOW_RATINGS", "true");

    render(await DelegatePage({ params }));

    expect(screen.getByText("84")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(document.querySelector('a[href="/leaderboard"]')).not.toBeNull();
  });

  it("sends a missing delegate's visitor back to the ranking", () => {
    vi.stubEnv("SHOW_RATINGS", "true");
    render(<DelegateNotFound />);

    expect(screen.getByRole("link", { name: "დაბრუნდი რეიტინგზე" })).toHaveAttribute(
      "href",
      "/leaderboard",
    );
  });
});
