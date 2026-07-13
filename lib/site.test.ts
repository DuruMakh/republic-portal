import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("uses the production domain in production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "portal.example.ge");
    expect(siteUrl()).toBe("https://portal.example.ge");
  });
  it("uses the deployment URL on previews", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "portal-abc123.vercel.app");
    expect(siteUrl()).toBe("https://portal-abc123.vercel.app");
  });
  it("falls back to localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "development");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
