// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nextConfig from "./next.config";

beforeEach(() => {
  vi.stubEnv("SHOW_RATINGS", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("redirects", () => {
  it("sends nobody from /delegates to the hidden ranking while ratings are hidden (ADR-052)", async () => {
    expect(await nextConfig.redirects?.()).toEqual([]);
  });

  it("sends the retired /delegates index to the ranking once SHOW_RATINGS=true", async () => {
    vi.stubEnv("SHOW_RATINGS", "true");
    expect(await nextConfig.redirects?.()).toEqual([
      { source: "/delegates", destination: "/leaderboard", permanent: true },
    ]);
  });
});
