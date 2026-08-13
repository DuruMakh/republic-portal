/** @vitest-environment node */
import { chromium } from "@playwright/test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn() }));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { installSupabaseSession } from "./otp-helpers";

const APP_BASE_URL = "http://localhost:3000";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
  createServerClient.mockImplementation((_url, _key, options) => ({
    auth: {
      setSession: async () => {
        options.cookies.setAll([
          { name: "sb-real-context", value: "serialized-session", options: { path: "/" } },
        ]);
        return { data: { session: null, user: null }, error: null };
      },
    },
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("installs every SSR cookie through Playwright's real public BrowserContext API", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await installSupabaseSession(page, {
      access_token: "local-access-token",
      refresh_token: "local-refresh-token",
    });

    expect(await context.cookies(APP_BASE_URL)).toEqual([
      expect.objectContaining({
        name: "sb-real-context",
        value: "serialized-session",
        domain: "localhost",
        path: "/",
      }),
    ]);
  } finally {
    await browser.close();
  }
});
