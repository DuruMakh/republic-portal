import { describe, expect, it, vi } from "vitest";

const createVerifyGeProviderMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("./verify-ge", () => ({ createVerifyGeProvider: createVerifyGeProviderMock }));

import { createPhoneVerificationProvider } from "./provider";

describe("createPhoneVerificationProvider", () => {
  it("selects the deterministic provider when explicitly configured outside production", async () => {
    const provider = createPhoneVerificationProvider({
      PHONE_VERIFICATION_PROVIDER: "test",
      NEXT_PUBLIC_APP_ENV: "preview",
    });

    await expect(provider.verify({ requestId: "test:req-123", code: "123456" })).resolves.toEqual({
      verified: true,
    });
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
  });

  it.each([undefined, "other"])("rejects an unsupported provider value of %s", (value) => {
    expect(() => createPhoneVerificationProvider({ PHONE_VERIFICATION_PROVIDER: value })).toThrow(
      "PHONE_VERIFICATION_PROVIDER must be verify_ge or test",
    );
  });
});
