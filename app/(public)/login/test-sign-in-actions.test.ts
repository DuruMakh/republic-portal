import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirectMock(path) }));

const setSessionMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { setSession: setSessionMock } }),
}));

const fixtureSessionForMock = vi.fn();
const freshVisitorSessionMock = vi.fn();
const resolvePersonaPhoneMock = vi.fn();
const isPersonaPhoneStub = (phone: string) => phone.length === 9;
vi.mock("@/lib/fixture-auth", () => ({
  fixtureSessionFor: (...args: unknown[]) => fixtureSessionForMock(...args),
  freshVisitorSession: (...args: unknown[]) => freshVisitorSessionMock(...args),
  resolvePersonaPhone: (...args: unknown[]) => resolvePersonaPhoneMock(...args),
  isPersonaPhone: (phone: string) => isPersonaPhoneStub(phone),
}));

import { testSignInAction } from "./test-sign-in-actions";

const SESSION = { access_token: "a", refresh_token: "r" };
const CONFIG = {
  url: "https://orcxtbedkexoclbfgvzd.supabase.co",
  anonKey: "anon",
  serviceKey: "service",
};

function form(persona: string): FormData {
  const data = new FormData();
  data.set("persona", persona);
  return data;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", CONFIG.url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", CONFIG.anonKey);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", CONFIG.serviceKey);
  setSessionMock.mockResolvedValue({ error: null });
  fixtureSessionForMock.mockResolvedValue(SESSION);
  freshVisitorSessionMock.mockResolvedValue(SESSION);
  resolvePersonaPhoneMock.mockResolvedValue("509000001");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("testSignInAction", () => {
  it("signs the admin persona in with the persona allow-list and lands on /admin", async () => {
    await expect(testSignInAction(form("admin"))).rejects.toThrow("REDIRECT:/admin");
    expect(resolvePersonaPhoneMock).toHaveBeenCalledWith(CONFIG, "admin");
    expect(fixtureSessionForMock).toHaveBeenCalledWith(CONFIG, "509000001", expect.any(Function));
    const allowList = fixtureSessionForMock.mock.calls[0]![2] as (phone: string) => boolean;
    expect(allowList("509000001")).toBe(true);
    expect(setSessionMock).toHaveBeenCalledWith(SESSION);
  });

  it.each([
    ["delegate", "/me"],
    ["member", "/me"],
  ])("signs the %s persona in and lands on %s", async (persona, landing) => {
    await expect(testSignInAction(form(persona))).rejects.toThrow(`REDIRECT:${landing}`);
    expect(resolvePersonaPhoneMock).toHaveBeenCalledWith(CONFIG, persona);
  });

  it("creates a fresh visitor and lands on /join", async () => {
    await expect(testSignInAction(form("visitor"))).rejects.toThrow("REDIRECT:/join");
    expect(freshVisitorSessionMock).toHaveBeenCalledWith(CONFIG);
    expect(fixtureSessionForMock).not.toHaveBeenCalled();
  });

  it("refuses on the production database without touching any account", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://uorvlshbrlbdnbauxsws.supabase.co");
    await expect(testSignInAction(form("admin"))).rejects.toThrow("REDIRECT:/login");
    expect(resolvePersonaPhoneMock).not.toHaveBeenCalled();
    expect(freshVisitorSessionMock).not.toHaveBeenCalled();
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it.each(["production", "", "staging"])(
    "refuses when the build flag is %j, even on a test database",
    async (flag) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", flag);
      await expect(testSignInAction(form("admin"))).rejects.toThrow("REDIRECT:/login");
      expect(resolvePersonaPhoneMock).not.toHaveBeenCalled();
      expect(setSessionMock).not.toHaveBeenCalled();
    },
  );

  it("refuses when the service key is missing", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(testSignInAction(form("admin"))).rejects.toThrow("REDIRECT:/login");
    expect(resolvePersonaPhoneMock).not.toHaveBeenCalled();
  });

  it.each(["superuser", "", "ADMIN"])("rejects the unknown persona %j", async (persona) => {
    await expect(testSignInAction(form(persona))).rejects.toThrow("REDIRECT:/login");
    expect(resolvePersonaPhoneMock).not.toHaveBeenCalled();
  });

  it("reports a failed sign-in instead of throwing", async () => {
    fixtureSessionForMock.mockRejectedValue(new Error("boom"));
    await expect(testSignInAction(form("member"))).rejects.toThrow(
      "REDIRECT:/login?error=test_sign_in",
    );
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it("reports a session the cookie store refused", async () => {
    setSessionMock.mockResolvedValue({ error: { message: "bad session" } });
    await expect(testSignInAction(form("admin"))).rejects.toThrow(
      "REDIRECT:/login?error=test_sign_in",
    );
  });
});
