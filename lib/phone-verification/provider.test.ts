import { beforeEach, describe, expect, it, vi } from "vitest";

const createVerifyGeProviderMock = vi.hoisted(() => vi.fn());
const createTestPhoneVerificationProviderMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("./test-provider", () => ({
  createTestPhoneVerificationProvider: createTestPhoneVerificationProviderMock,
}));
vi.mock("./verify-ge", () => ({ createVerifyGeProvider: createVerifyGeProviderMock }));

import { createPhoneVerificationProvider } from "./provider";

describe("createPhoneVerificationProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes its environment to the deterministic provider outside production", () => {
    const provider = { send: vi.fn(), verify: vi.fn() };
    createTestPhoneVerificationProviderMock.mockReturnValueOnce(provider);
    const environment = {
      PHONE_VERIFICATION_PROVIDER: "test",
      NEXT_PUBLIC_APP_ENV: "preview",
    };

    expect(createPhoneVerificationProvider(environment)).toBe(provider);
    expect(createTestPhoneVerificationProviderMock).toHaveBeenCalledWith(environment);
  });

  it("passes the server-only key to the Verify.ge provider", () => {
    const provider = { send: vi.fn(), verify: vi.fn() };
    createVerifyGeProviderMock.mockReturnValueOnce(provider);

    expect(
      createPhoneVerificationProvider({
        PHONE_VERIFICATION_PROVIDER: "verify_ge",
        VERIFY_GE_API_KEY: "configured-server-key",
      }),
    ).toBe(provider);
    expect(createVerifyGeProviderMock).toHaveBeenCalledWith("configured-server-key");
  });

  it("forbids the deterministic provider in production", () => {
    expect(() =>
      createPhoneVerificationProvider({
        PHONE_VERIFICATION_PROVIDER: "test",
        NEXT_PUBLIC_APP_ENV: "production",
      }),
    ).toThrow("test phone verification provider is forbidden in production");
    expect(createTestPhoneVerificationProviderMock).not.toHaveBeenCalled();
  });

  it.each([undefined, "other"])("rejects an unsupported provider value of %s", (value) => {
    expect(() => createPhoneVerificationProvider({ PHONE_VERIFICATION_PROVIDER: value })).toThrow(
      "PHONE_VERIFICATION_PROVIDER must be verify_ge or test",
    );
  });
});
