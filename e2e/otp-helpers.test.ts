/** @vitest-environment node */
import type { Page } from "@playwright/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { createClient, createServerClient, playwrightExpect, setSession, toHaveURL } = vi.hoisted(
  () => ({
    createClient: vi.fn(),
    createServerClient: vi.fn(),
    playwrightExpect: vi.fn(),
    setSession: vi.fn(),
    toHaveURL: vi.fn(),
  }),
);

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@playwright/test", () => ({ expect: playwrightExpect }));

import { installSupabaseSession, loginAs } from "./otp-helpers";

const session = {
  access_token: "access-token-that-must-stay-private",
  refresh_token: "refresh-token-that-must-stay-private",
};

function fakePage() {
  const addCookies = vi.fn().mockResolvedValue(undefined);
  return {
    page: { context: () => ({ addCookies }) } as unknown as Page,
    addCookies,
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
  createClient.mockReset();
  createServerClient.mockReset();
  setSession.mockReset();
  toHaveURL.mockReset();
  playwrightExpect.mockReset();
  playwrightExpect.mockReturnValue({ toHaveURL });
  createServerClient.mockImplementation((_url, _key, options) => ({
    auth: {
      setSession: setSession.mockImplementation(async () => {
        options.cookies.setAll([
          { name: "sb-session.0", value: "cookie-part-0", options: { path: "/auth" } },
          { name: "sb-session.1", value: "cookie-part-1", options: {} },
        ]);
        return { data: { session: null, user: null }, error: null };
      }),
    },
  }));
});

describe("loginAs", () => {
  test("cannot request staging OTPs in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");

    await expect(loginAs({} as Page, "550001239")).rejects.toThrow(/development|preview/i);

    expect(createClient).not.toHaveBeenCalled();
  });

  test("uses the staging OTP APIs, installs the returned session, and opens the target", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    const signedInSession = {
      access_token: "signed-in-access-token",
      refresh_token: "signed-in-refresh-token",
    };
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { session: signedInSession },
      error: null,
    });
    const inboxQuery = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn().mockResolvedValue({
        data: [{ otp: "654321", created_at: new Date().toISOString() }],
        error: null,
      }),
    };
    inboxQuery.select.mockReturnValue(inboxQuery);
    inboxQuery.in.mockReturnValue(inboxQuery);
    inboxQuery.order.mockReturnValue(inboxQuery);
    createClient.mockImplementation((_url: string, key: string) =>
      key === "anon-key"
        ? { auth: { signInWithOtp, verifyOtp } }
        : { from: vi.fn().mockReturnValue(inboxQuery) },
    );
    const { page, addCookies } = fakePage();
    const goto = vi.fn().mockResolvedValue(undefined);
    Object.assign(page, { goto });
    const landing = /\/me(\/|$)/;

    await loginAs(page, "550001239", landing);

    expect(signInWithOtp).toHaveBeenCalledWith({
      phone: "+995550001239",
      options: { shouldCreateUser: false },
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      phone: "+995550001239",
      token: "654321",
      type: "sms",
    });
    expect(setSession).toHaveBeenCalledWith(signedInSession);
    expect(addCookies).toHaveBeenCalledOnce();
    expect(goto).toHaveBeenCalledWith("/me");
    expect(toHaveURL).toHaveBeenCalledWith(landing, { timeout: 15_000 });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("installSupabaseSession", () => {
  test("lets the SSR client serialize the session and installs every resulting cookie", async () => {
    const { page, addCookies } = fakePage();

    await installSupabaseSession(page, session);

    expect(createServerClient).toHaveBeenCalledWith(
      "https://staging.example.supabase.co",
      "anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
    expect(setSession).toHaveBeenCalledWith(session);
    expect(addCookies).toHaveBeenCalledWith([
      {
        name: "sb-session.0",
        value: "cookie-part-0",
        url: "http://localhost:3000",
        path: "/",
      },
      {
        name: "sb-session.1",
        value: "cookie-part-1",
        url: "http://localhost:3000",
        path: "/",
      },
    ]);
  });

  test("does not put session tokens in logs or cookie URLs", async () => {
    const { page, addCookies } = fakePage();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await installSupabaseSession(page, session);

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    const cookieUrls = addCookies.mock.calls.flatMap(([cookies]) =>
      cookies.map((cookie: { url: string }) => cookie.url),
    );
    expect(cookieUrls).toEqual(["http://localhost:3000", "http://localhost:3000"]);
    expect(cookieUrls.join(" ")).not.toContain(session.access_token);
    expect(cookieUrls.join(" ")).not.toContain(session.refresh_token);
  });

  test.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])(
    "fails clearly before session installation when %s is missing",
    async (name) => {
      vi.stubEnv(name, "");
      const { page, addCookies } = fakePage();

      await expect(installSupabaseSession(page, session)).rejects.toThrow(/public Supabase/i);

      expect(createServerClient).not.toHaveBeenCalled();
      expect(addCookies).not.toHaveBeenCalled();
    },
  );
});
