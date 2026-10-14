import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site", () => ({ siteUrl: () => "https://example.test" }));
vi.mock("@/lib/supabase/public", () => ({ fetchPublicDelegates: async () => [] }));

import sitemap from "./sitemap";

beforeEach(() => {
  vi.stubEnv("SHOW_RATINGS", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap", () => {
  it("lists the privacy policy like the delegate rules", async () => {
    const entries = await sitemap();
    expect(entries).toContainEqual({
      url: "https://example.test/privacy",
      changeFrequency: "monthly",
      priority: 0.3,
    });
  });

  it("lists the about page", async () => {
    const entries = await sitemap();
    expect(entries).toContainEqual({
      url: "https://example.test/about",
      changeFrequency: "monthly",
      priority: 0.7,
    });
  });

  it("leaves the ranking out while ratings are hidden, and lists it once they are on", async () => {
    const hidden = await sitemap();
    expect(hidden.map((e) => e.url)).not.toContain("https://example.test/leaderboard");
    vi.stubEnv("SHOW_RATINGS", "true");
    const shown = await sitemap();
    expect(shown.map((e) => e.url)).toContain("https://example.test/leaderboard");
  });
});
