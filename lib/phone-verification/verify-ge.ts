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

function hasSdkErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function hasRequestId(result: unknown): result is { requestId: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "requestId" in result &&
    typeof result.requestId === "string" &&
    result.requestId.length > 0
  );
}

function mapVerifyGeError(error: unknown): PhoneVerificationProviderError {
  if (error instanceof InvalidOtpError || hasSdkErrorCode(error, "INVALID_OTP_CODE")) {
    return new PhoneVerificationProviderError("invalid_code");
  }

  if (error instanceof OtpExpiredError || hasSdkErrorCode(error, "OTP_EXPIRED")) {
    return new PhoneVerificationProviderError("expired_code");
  }

  if (error instanceof RateLimitError || hasSdkErrorCode(error, "RATE_LIMIT_EXCEEDED")) {
    return new PhoneVerificationProviderError("too_many_requests");
  }

  return new PhoneVerificationProviderError("service_unavailable");
}

export function createVerifyGeProvider(
  apiKey: string,
  sdk?: VerifyGeSdk,
): PhoneVerificationProvider {
  if (!apiKey) {
    throw new Error("VERIFY_GE_API_KEY is missing");
  }

  const client = sdk ?? new OtpClient({ apiKey, autoConfig: true });

  return {
    async send(input) {
      try {
        const result: unknown = await client.sendOtp({
          phoneNumber: input.phone,
          channel: OtpChannel.SMS,
          ttl: PHONE_VERIFICATION_TTL_SECONDS,
          length: PHONE_VERIFICATION_CODE_LENGTH,
          idempotencyKey: input.idempotencyKey,
        });

        if (!hasRequestId(result)) {
          throw new PhoneVerificationProviderError("service_unavailable");
        }

        return { provider: "verify_ge", requestId: result.requestId };
      } catch (error) {
        throw error instanceof PhoneVerificationProviderError ? error : mapVerifyGeError(error);
      }
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
