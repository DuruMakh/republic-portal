import "server-only";

import type { PhoneRegion } from "../phone-number";
import type { PhoneVerificationProvider, PhoneVerificationProviderName } from "./contracts";
import { createTestPhoneVerificationProvider } from "./test-provider";
import { createTwilioProvider } from "./twilio";
import { createVerifyGeProvider } from "./verify-ge";

type PhoneVerificationEnvironment = {
  PHONE_VERIFICATION_PROVIDER?: string;
  NEXT_PUBLIC_APP_ENV?: string;
  VERIFY_GE_API_KEY?: string;
  TWILIO_API_KEY_SID?: string;
  TWILIO_API_KEY_SECRET?: string;
  TWILIO_VERIFY_SERVICE_SID?: string;
};

function readEnvironment(environment?: PhoneVerificationEnvironment): PhoneVerificationEnvironment {
  return (
    environment ?? {
      PHONE_VERIFICATION_PROVIDER: process.env.PHONE_VERIFICATION_PROVIDER,
      NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
      VERIFY_GE_API_KEY: process.env.VERIFY_GE_API_KEY,
      TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID,
      TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET,
      TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID,
    }
  );
}

function twilioConfigured(env: PhoneVerificationEnvironment): boolean {
  return Boolean(
    env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET && env.TWILIO_VERIFY_SERVICE_SID,
  );
}

/** The providers this deployment may use: `test` alone, or Verify.ge plus Twilio when configured. */
function allowedProviders(env: PhoneVerificationEnvironment): PhoneVerificationProviderName[] {
  if (env.PHONE_VERIFICATION_PROVIDER === "test") return ["test"];
  if (env.PHONE_VERIFICATION_PROVIDER === "verify_ge") {
    return twilioConfigured(env) ? ["verify_ge", "twilio"] : ["verify_ge"];
  }
  throw new Error("PHONE_VERIFICATION_PROVIDER must be verify_ge or test");
}

/**
 * Who sends a new code (ADR-055): Georgian numbers stay on Verify.ge, foreign ones go to Twilio;
 * null when no provider serves this kind of number here.
 */
export function providerNameFor(
  region: PhoneRegion,
  environment?: PhoneVerificationEnvironment,
): PhoneVerificationProviderName | null {
  const allowed = allowedProviders(readEnvironment(environment));
  if (allowed.includes("test")) return "test";
  if (region === "georgia") return "verify_ge";
  return allowed.includes("twilio") ? "twilio" : null;
}

/**
 * The provider a stored challenge names, or null when this deployment no longer allows it —
 * a challenge is never checked by a provider other than the one that sent it.
 */
export function createProviderByName(
  name: PhoneVerificationProviderName,
  environment?: PhoneVerificationEnvironment,
): PhoneVerificationProvider | null {
  const env = readEnvironment(environment);
  if (name === "test" && env.PHONE_VERIFICATION_PROVIDER === "test") {
    if (env.NEXT_PUBLIC_APP_ENV === "production") {
      throw new Error("test phone verification provider is forbidden in production");
    }
    return createTestPhoneVerificationProvider(env);
  }
  if (!allowedProviders(env).includes(name)) return null;
  if (name === "verify_ge") return createVerifyGeProvider(env.VERIFY_GE_API_KEY ?? "");
  return createTwilioProvider({
    apiKeySid: env.TWILIO_API_KEY_SID ?? "",
    apiKeySecret: env.TWILIO_API_KEY_SECRET ?? "",
    serviceSid: env.TWILIO_VERIFY_SERVICE_SID ?? "",
  });
}
