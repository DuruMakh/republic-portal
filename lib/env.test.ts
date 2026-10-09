import { afterEach, describe, expect, it, vi } from "vitest";
import { isProductionEnv, isTestDatabaseUrl, testSignInEnabled } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("isProductionEnv", () => {
  it("is true when the flag says production and the database is not staging", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://prodrefabcdefgh.supabase.co");
    expect(isProductionEnv()).toBe(true);
  });

  it("is false when the flag says production but the database is still staging", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
    expect(isProductionEnv()).toBe(false);
  });

  it("is false on preview even when pointed at a production-looking database", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://prodrefabcdefgh.supabase.co");
    expect(isProductionEnv()).toBe(false);
  });

  it("fails safe when the database URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(isProductionEnv()).toBe(false);
  });
});

describe("isTestDatabaseUrl", () => {
  it.each([
    ["https://orcxtbedkexoclbfgvzd.supabase.co", true],
    ["http://127.0.0.1:54321", true],
    ["http://localhost:54321", true],
    ["https://uorvlshbrlbdnbauxsws.supabase.co", false],
    ["http://orcxtbedkexoclbfgvzd.supabase.co", false],
    ["https://orcxtbedkexoclbfgvzd.supabase.co.evil.example", false],
    ["http://127.0.0.1:9999", false],
    ["not a url", false],
    ["", false],
    [undefined, false],
  ])("%s → %s", (url, expected) => {
    expect(isTestDatabaseUrl(url)).toBe(expected);
  });
});

describe("testSignInEnabled", () => {
  it("is on for a preview pointed at staging", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
    expect(testSignInEnabled()).toBe(true);
  });

  it("is off when the flag says production, even on a test database", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
    expect(testSignInEnabled()).toBe(false);
  });

  it("is off on the production database whatever the flag says", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://uorvlshbrlbdnbauxsws.supabase.co");
    expect(testSignInEnabled()).toBe(false);
  });

  it.each([[""], ["staging"], ["Preview"]])(
    "is off when the flag is %j, not an explicit preview or development",
    (flag) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", flag);
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
      expect(testSignInEnabled()).toBe(false);
    },
  );

  // ADR-050 review: the demo project's PRODUCTION deployment is built with APP_ENV=preview on
  // the staging database (unlocked 2026-07-20 for owner testing). Vercel's runtime VERCEL_ENV
  // cannot be overridden by a build setting, so it is the last word on "is this a live site".
  it("is off on any Vercel production deployment, even one built as a preview on staging", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
    expect(testSignInEnabled()).toBe(false);
  });

  it.each([["preview"], [""]])(
    "stays on with VERCEL_ENV %j (Vercel previews, CI, local)",
    (vercelEnv) => {
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://orcxtbedkexoclbfgvzd.supabase.co");
      expect(testSignInEnabled()).toBe(true);
    },
  );

  it("is on for local development against the local stack", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(testSignInEnabled()).toBe(true);
  });

  it("is off when the database URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(testSignInEnabled()).toBe(false);
  });
});
