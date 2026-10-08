import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site", () => ({ siteUrl: () => "https://example.test" }));
vi.mock("@/lib/supabase/public", () => ({ fetchPublicDelegates: async () => [] }));

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists the privacy policy like the delegate rules", async () => {
    const entries = await sitemap();
    expect(entries).toContainEqual({
      url: "https://example.test/privacy",
      changeFrequency: "monthly",
      priority: 0.3,
    });
  });
});
