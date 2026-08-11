import type { PhoneVerificationProvider } from "./contracts";

type TestProviderEnvironment = {
  NEXT_PUBLIC_APP_ENV?: string;
};

export function createTestPhoneVerificationProvider(
  environment?: TestProviderEnvironment,
): PhoneVerificationProvider {
  const appEnvironment = environment?.NEXT_PUBLIC_APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV;

  if (appEnvironment === "production") {
    throw new Error("test phone verification provider is forbidden in production");
  }

  return {
    async send(input) {
      return { provider: "test", requestId: `test:${input.idempotencyKey}` };
    },
    async verify(input) {
      return { verified: input.requestId.startsWith("test:") && input.code === "123456" };
    },
  };
}
