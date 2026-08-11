import "server-only";

import type { PhoneVerificationProvider } from "./contracts";
import { createTestPhoneVerificationProvider } from "./test-provider";
import { createVerifyGeProvider } from "./verify-ge";

type PhoneVerificationEnvironment = {
  PHONE_VERIFICATION_PROVIDER?: string;
  NEXT_PUBLIC_APP_ENV?: string;
  VERIFY_GE_API_KEY?: string;
};

export function createPhoneVerificationProvider(
  environment?: PhoneVerificationEnvironment,
): PhoneVerificationProvider {
  const configured =
    environment ??
    {
      PHONE_VERIFICATION_PROVIDER: process.env.PHONE_VERIFICATION_PROVIDER,
      NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
      VERIFY_GE_API_KEY: process.env.VERIFY_GE_API_KEY,
    };

  if (configured.PHONE_VERIFICATION_PROVIDER === "verify_ge") {
    return createVerifyGeProvider(configured.VERIFY_GE_API_KEY ?? "");
  }

  if (configured.PHONE_VERIFICATION_PROVIDER === "test") {
    if (configured.NEXT_PUBLIC_APP_ENV === "production") {
      throw new Error("test phone verification provider is forbidden in production");
    }

    return createTestPhoneVerificationProvider();
  }

  throw new Error("PHONE_VERIFICATION_PROVIDER must be verify_ge or test");
}
