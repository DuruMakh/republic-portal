import { beforeEach, describe, expect, it, vi } from "vitest";

const createVerifyGeProviderMock = vi.hoisted(() => vi.fn());
const createTwilioProviderMock = vi.hoisted(() => vi.fn());
const createTestPhoneVerificationProviderMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("./test-provider", () => ({
  createTestPhoneVerificationProvider: createTestPhoneVerificationProviderMock,
}));
vi.mock("./verify-ge", () => ({ createVerifyGeProvider: createVerifyGeProviderMock }));
vi.mock("./twilio", () => ({ createTwilioProvider: createTwilioProviderMock }));

import { createProviderByName, providerNameFor } from "./provider";

const twilio = {
  TWILIO_API_KEY_SID: "SK1",
  TWILIO_API_KEY_SECRET: "secret",
  TWILIO_VERIFY_SERVICE_SID: "VA1",
};
const live = { PHONE_VERIFICATION_PROVIDER: "verify_ge", VERIFY_GE_API_KEY: "key", ...twilio };

describe("providerNameFor", () => {
  it("uses the deterministic provider for every number outside production", () => {
    const env = {
      PHONE_VERIFICATION_PROVIDER: "test",
      NEXT_PUBLIC_APP_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    };
    expect(providerNameFor("georgia", env)).toBe("test");
    expect(providerNameFor("foreign", env)).toBe("test");
  });

  it("keeps Georgian numbers on Verify.ge and sends foreign ones to Twilio", () => {
    expect(providerNameFor("georgia", live)).toBe("verify_ge");
    expect(providerNameFor("foreign", live)).toBe("twilio");
  });

  it.each(Object.keys(twilio))("refuses foreign numbers when %s is missing", (key) => {
    expect(providerNameFor("foreign", { ...live, [key]: "" })).toBeNull();
    expect(providerNameFor("georgia", { ...live, [key]: "" })).toBe("verify_ge");
  });

  it.each([undefined, "other"])("rejects an unsupported provider value of %s", (value) => {
    expect(() => providerNameFor("georgia", { PHONE_VERIFICATION_PROVIDER: value })).toThrow(
      "PHONE_VERIFICATION_PROVIDER must be verify_ge or test",
    );
  });
});

describe("createProviderByName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes its environment to the deterministic provider outside production", () => {
    const provider = { send: vi.fn(), verify: vi.fn() };
    createTestPhoneVerificationProviderMock.mockReturnValueOnce(provider);
    const environment = {
      PHONE_VERIFICATION_PROVIDER: "test",
      NEXT_PUBLIC_APP_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    };

    expect(createProviderByName("test", environment)).toBe(provider);
    expect(createTestPhoneVerificationProviderMock).toHaveBeenCalledWith(environment);
  });

  it("forbids the deterministic provider in production", () => {
    expect(() =>
      createProviderByName("test", {
        PHONE_VERIFICATION_PROVIDER: "test",
        NEXT_PUBLIC_APP_ENV: "production",
      }),
    ).toThrow("test phone verification provider is forbidden in production");
    expect(createTestPhoneVerificationProviderMock).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, "http://127.0.0.1:54321", undefined],
    ["Development", "http://127.0.0.1:54321", undefined],
    ["production", "http://127.0.0.1:54321", undefined],
    ["development", "http://127.0.0.1:54321", "production"],
    ["development", "https://uorvlshbrlbdnbauxsws.supabase.co", undefined],
    ["development", "https://unknown.supabase.co", undefined],
    ["development", undefined, undefined],
  ])("refuses an unsafe injected environment (%s, %s, %s)", (appEnv, url, vercelEnv) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    const environment = {
      PHONE_VERIFICATION_PROVIDER: "test",
      NEXT_PUBLIC_APP_ENV: appEnv,
      NEXT_PUBLIC_SUPABASE_URL: url,
      VERCEL_ENV: vercelEnv,
    };
    try {
      expect(() => providerNameFor("georgia", environment)).toThrow(/forbidden/);
      expect(() => providerNameFor("foreign", environment)).toThrow(/forbidden/);
      expect(() => createProviderByName("test", environment)).toThrow(/forbidden/);
      expect(createTestPhoneVerificationProviderMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("uses the complete process environment when no environment is injected", () => {
    vi.stubEnv("PHONE_VERIFICATION_PROVIDER", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("VERCEL_ENV", "preview");
    try {
      expect(providerNameFor("foreign")).toBe("test");
      createProviderByName("test");
      expect(createTestPhoneVerificationProviderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
          VERCEL_ENV: "preview",
        }),
      );
      vi.clearAllMocks();
      vi.stubEnv("VERCEL_ENV", "production");
      expect(() => providerNameFor("foreign")).toThrow(/forbidden/);
      expect(() => createProviderByName("test")).toThrow(/forbidden/);
      expect(createTestPhoneVerificationProviderMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("passes the server-only keys to Verify.ge and Twilio", () => {
    const provider = { send: vi.fn(), verify: vi.fn() };
    createVerifyGeProviderMock.mockReturnValueOnce(provider);
    createTwilioProviderMock.mockReturnValueOnce(provider);

    expect(createProviderByName("verify_ge", live)).toBe(provider);
    expect(createVerifyGeProviderMock).toHaveBeenCalledWith("key");
    expect(createProviderByName("twilio", live)).toBe(provider);
    expect(createTwilioProviderMock).toHaveBeenCalledWith({
      apiKeySid: "SK1",
      apiKeySecret: "secret",
      serviceSid: "VA1",
    });
  });

  it("refuses a provider the current environment does not allow", () => {
    const test = {
      PHONE_VERIFICATION_PROVIDER: "test",
      NEXT_PUBLIC_APP_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    };
    expect(createProviderByName("twilio", { ...live, TWILIO_API_KEY_SECRET: "" })).toBeNull();
    expect(createProviderByName("verify_ge", test)).toBeNull();
    expect(createProviderByName("twilio", { ...test, ...twilio })).toBeNull();
    expect(createProviderByName("test", live)).toBeNull();
    expect(createVerifyGeProviderMock).not.toHaveBeenCalled();
    expect(createTwilioProviderMock).not.toHaveBeenCalled();
  });
});
