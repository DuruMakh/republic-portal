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

import { installSupabaseSession, loginAs, serviceClient } from "./otp-helpers";

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

function fakeNavigablePage() {
  const { page, addCookies } = fakePage();
  const goto = vi.fn().mockResolvedValue(undefined);
  Object.assign(page, { goto });
  return { page, addCookies, goto };
}

type FakeAuthUser = { id: string; email?: string };
type FixtureCredentials = { email: string; password: string; email_confirm: boolean };

/**
 * A staging stand-in: profiles maps stored phones to auth ids, auth users hold an
 * optional email, and the password grant accepts only the credentials last set
 * through the admin API (or pre-seeded via `passwords`). The anon client has no
 * OTP method at all, so a stray SMS request would crash the test.
 */
function fakeStaging(opts: {
  profiles: Record<string, string>;
  users: Record<string, FakeAuthUser>;
  passwords?: Record<string, string>;
  signInError?: { code: string; message: string };
}) {
  const passwords = new Map(Object.entries(opts.passwords ?? {}));
  const signInWithPassword = vi.fn(
    async ({ email, password }: { email: string; password: string }) => {
      if (opts.signInError) return { data: { session: null }, error: opts.signInError };
      if (passwords.get(email) === password) {
        return {
          data: { session: { access_token: `at-${email}`, refresh_token: `rt-${email}` } },
          error: null,
        };
      }
      return {
        data: { session: null },
        error: { code: "invalid_credentials", message: "Invalid login credentials" },
      };
    },
  );
  const updateUserById = vi.fn(async (id: string, attrs: FixtureCredentials) => {
    opts.users[id] = { id, email: attrs.email };
    passwords.set(attrs.email, attrs.password);
    return { data: { user: opts.users[id] }, error: null };
  });
  const getUserById = vi.fn(async (id: string) => ({
    data: { user: opts.users[id] ?? null },
    error: opts.users[id] ? null : { message: "User not found" },
  }));
  const phonesQueried: string[][] = [];
  const query = {
    select: () => query,
    in: async (_column: string, values: string[]) => {
      phonesQueried.push(values);
      const data = Object.entries(opts.profiles)
        .filter(([phone]) => values.includes(phone))
        .map(([, id]) => ({ id }));
      return { data, error: null };
    },
  };
  createClient.mockImplementation((_url: string, key: string) =>
    key === "anon-key"
      ? { auth: { signInWithPassword } }
      : { from: () => query, auth: { admin: { getUserById, updateUserById } } },
  );
  return { signInWithPassword, updateUserById, phonesQueried };
}

const FIXTURE_PASSWORD = /^E2e-[0-9a-f]{32}!Aa1$/;

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
  test.each([undefined, "test", "staging", "production", "Preview"])(
    "cannot sign anyone in when NEXT_PUBLIC_APP_ENV is %s",
    async (appEnv) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", appEnv);

      await expect(loginAs({} as Page, "550001239")).rejects.toThrow(/development|preview/i);

      expect(createClient).not.toHaveBeenCalled();
    },
  );

  test.each([
    "599123456",
    "509000005",
    "50900000",
    "5500012390",
    "+995550001239",
    // the owner's kept smoke accounts (scripts/sweep-staging-e2e.mjs) sit in the 55 block
    "551234567",
    "551234568",
    "551234569",
  ])("refuses %s (not an e2e fixture phone) before touching staging", async (phone) => {
    await expect(loginAs({} as Page, phone)).rejects.toThrow(/fixture/i);

    expect(createClient).not.toHaveBeenCalled();
  });

  test("first sign-in gives the fixture a password and installs the session, no SMS", async () => {
    const staging = fakeStaging({
      profiles: { "+995550001239": "user-1" },
      users: { "user-1": { id: "user-1" } },
    });
    const { page, addCookies, goto } = fakeNavigablePage();
    const landing = /\/me(\/|$)/;

    await loginAs(page, "550001239", landing);

    expect(staging.phonesQueried).toEqual([["+995550001239", "995550001239"]]);
    expect(staging.updateUserById).toHaveBeenCalledOnce();
    const [id, attrs] = staging.updateUserById.mock.calls[0]!;
    expect(id).toBe("user-1");
    expect(attrs).toEqual({
      email: "e2e-login+550001239@example.invalid",
      password: expect.stringMatching(FIXTURE_PASSWORD),
      email_confirm: true,
    });
    expect(staging.signInWithPassword).toHaveBeenLastCalledWith({
      email: "e2e-login+550001239@example.invalid",
      password: attrs.password,
    });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "at-e2e-login+550001239@example.invalid",
      refresh_token: "rt-e2e-login+550001239@example.invalid",
    });
    expect(addCookies).toHaveBeenCalledOnce();
    expect(goto).toHaveBeenCalledWith("/me");
    expect(toHaveURL).toHaveBeenCalledWith(landing, { timeout: 15_000 });
  });

  test("a fixture that already has its password is signed in without being changed", async () => {
    // Setting a password ends the account's other sessions, so an overlapping CI run
    // signed in as the same seeded admin must not be logged out by this one.
    const first = fakeStaging({
      profiles: { "+995509000004": "editor" },
      users: { editor: { id: "editor" } },
    });
    await loginAs(fakeNavigablePage().page, "509000004");
    const password = first.updateUserById.mock.calls[0]![1].password;

    const second = fakeStaging({
      profiles: { "+995509000004": "editor" },
      users: { editor: { id: "editor", email: "e2e-login+509000004@example.invalid" } },
      passwords: { "e2e-login+509000004@example.invalid": password },
    });
    await loginAs(fakeNavigablePage().page, "509000004");

    expect(second.signInWithPassword).toHaveBeenCalledOnce();
    expect(second.signInWithPassword).toHaveBeenCalledWith({
      email: "e2e-login+509000004@example.invalid",
      password,
    });
    expect(second.updateUserById).not.toHaveBeenCalled();
  });

  test("each fixture phone gets its own password", async () => {
    const staging = fakeStaging({
      profiles: { "+995509000001": "super", "+995509000002": "verifier" },
      users: { super: { id: "super" }, verifier: { id: "verifier" } },
    });

    await loginAs(fakeNavigablePage().page, "509000001");
    await loginAs(fakeNavigablePage().page, "509000002");

    const [a, b] = staging.updateUserById.mock.calls.map(([, attrs]) => attrs.password);
    expect(a).toMatch(FIXTURE_PASSWORD);
    expect(b).toMatch(FIXTURE_PASSWORD);
    expect(a).not.toBe(b);
  });

  test("the password depends on the service-role key, not on the phone alone", async () => {
    const passwordUnder = async (serviceKey: string) => {
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", serviceKey);
      const staging = fakeStaging({
        profiles: { "+995509000003": "finance" },
        users: { finance: { id: "finance" } },
      });
      await loginAs(fakeNavigablePage().page, "509000003");
      return staging.updateUserById.mock.calls[0]![1].password;
    };

    expect(await passwordUnder("service-role-key")).not.toBe(
      await passwordUnder("another-service-role-key"),
    );
  });

  test("refuses when more than one profile holds the phone", async () => {
    const staging = fakeStaging({
      profiles: { "+995550001239": "user-1", "995550001239": "user-2" },
      users: { "user-1": { id: "user-1" }, "user-2": { id: "user-2" } },
    });

    await expect(loginAs(fakeNavigablePage().page, "550001239")).rejects.toThrow(/rows=2/);

    expect(staging.updateUserById).not.toHaveBeenCalled();
  });

  test("keeps an existing e2e email (a Google fixture) and only resets the password", async () => {
    const staging = fakeStaging({
      profiles: { "995550001231": "google-user" },
      users: { "google-user": { id: "google-user", email: "e2e+550001231@example.invalid" } },
      passwords: { "e2e+550001231@example.invalid": "random-password-from-the-fixture" },
    });

    await loginAs(fakeNavigablePage().page, "550001231");

    expect(staging.updateUserById).toHaveBeenCalledWith("google-user", {
      email: "e2e+550001231@example.invalid",
      password: expect.stringMatching(FIXTURE_PASSWORD),
      email_confirm: true,
    });
  });

  test("refuses an account carrying a real email address", async () => {
    const staging = fakeStaging({
      profiles: { "+995509000001": "super" },
      users: { super: { id: "super", email: "someone@gmail.com" } },
    });

    await expect(loginAs(fakeNavigablePage().page, "509000001")).rejects.toThrow(/real email/i);

    expect(staging.signInWithPassword).not.toHaveBeenCalled();
    expect(staging.updateUserById).not.toHaveBeenCalled();
  });

  test("a sign-in failure other than wrong credentials is reported, not papered over", async () => {
    const staging = fakeStaging({
      profiles: { "+995550001239": "user-1" },
      users: { "user-1": { id: "user-1", email: "e2e-login+550001239@example.invalid" } },
      signInError: { code: "over_request_rate_limit", message: "Request rate limit reached" },
    });

    await expect(loginAs(fakeNavigablePage().page, "550001239")).rejects.toThrow(/could not sign/i);

    expect(staging.updateUserById).not.toHaveBeenCalled();
  });

  test("names the phone when no profile holds it", async () => {
    fakeStaging({ profiles: {}, users: {} });

    await expect(loginAs(fakeNavigablePage().page, "550001239")).rejects.toThrow(/550001239/);
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
      },
      {
        name: "sb-session.1",
        value: "cookie-part-1",
        url: "http://localhost:3000",
      },
    ]);
    for (const cookie of addCookies.mock.calls[0]![0]) {
      expect(cookie).not.toHaveProperty("path");
      expect(cookie).not.toHaveProperty("domain");
    }
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

describe("service-role fixture boundary", () => {
  test.each([undefined, "test", "staging", "production", "Preview"])(
    "rejects before creating a service client when NEXT_PUBLIC_APP_ENV is %s",
    (appEnv) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", appEnv);

      expect(() => serviceClient()).toThrow(/development|preview/i);

      expect(createClient).not.toHaveBeenCalled();
    },
  );
});
