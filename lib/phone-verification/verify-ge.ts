import "server-only";

import {
  InvalidOtpError,
  OtpChannel,
  OtpClient,
  OtpExpiredError,
  RateLimitError,
} from "@smart-pay-chain/otp";

import {
  PHONE_VERIFICATION_CODE_LENGTH,
  PHONE_VERIFICATION_TTL_SECONDS,
  type PhoneVerificationFailureCode,
  type PhoneVerificationProvider,
} from "./contracts";

type VerifyGeSdk = Pick<OtpClient, "sendOtp" | "verifyOtp">;

export class PhoneVerificationProviderError extends Error {
  constructor(readonly code: PhoneVerificationFailureCode) {
    super(code);
    this.name = "PhoneVerificationProviderError";
  }
}

function mapVerifyGeError(error: unknown): PhoneVerificationProviderError {
  if (error instanceof InvalidOtpError) {
    return new PhoneVerificationProviderError("invalid_code");
  }

  if (error instanceof OtpExpiredError) {
    return new PhoneVerificationProviderError("expired_code");
  }

  if (error instanceof RateLimitError) {
    return new PhoneVerificationProviderError("too_many_requests");
  }

  return new PhoneVerificationProviderError("service_unavailable");
}

export function createVerifyGeProvider(apiKey: string, sdk?: VerifyGeSdk): PhoneVerificationProvider {
  if (!apiKey) {
    throw new Error("VERIFY_GE_API_KEY is missing");
  }

  const client = sdk ?? new OtpClient({ apiKey, autoConfig: true });

  return {
    async send(input) {
      let result: Awaited<ReturnType<VerifyGeSdk["sendOtp"]>>;

      try {
        result = await client.sendOtp({
          phoneNumber: input.phone,
          channel: OtpChannel.SMS,
          ttl: PHONE_VERIFICATION_TTL_SECONDS,
          length: PHONE_VERIFICATION_CODE_LENGTH,
          idempotencyKey: input.idempotencyKey,
        });
      } catch (error) {
        throw mapVerifyGeError(error);
      }

      if (!result.requestId) {
        throw new PhoneVerificationProviderError("service_unavailable");
      }

      return { provider: "verify_ge", requestId: result.requestId };
    },
    async verify(input) {
      try {
        const result = await client.verifyOtp({ requestId: input.requestId, code: input.code });
        return { verified: result.success === true };
      } catch (error) {
        throw mapVerifyGeError(error);
      }
    },
  };
}
