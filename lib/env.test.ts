import { afterEach, describe, expect, it, vi } from "vitest";
import { isProductionEnv } from "./env";

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
