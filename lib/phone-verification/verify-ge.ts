import "server-only";

import {
  PHONE_VERIFICATION_CODE_LENGTH,
  PHONE_VERIFICATION_TTL_SECONDS,
  type PhoneVerificationFailureCode,
  type PhoneVerificationProvider,
} from "./contracts";

const VERIFY_GE_BASE_URL = "https://api.verify.ge/api/v1";

type VerifyGeError = {
  name?: string;
  code?: string;
  statusCode?: number;
  retryable?: boolean;
};

type VerifyGeResponse = {
  success?: unknown;
  data?: unknown;
  error?: unknown;
};

export class PhoneVerificationProviderError extends Error {
  constructor(readonly code: PhoneVerificationFailureCode) {
    super(code);
    this.name = "PhoneVerificationProviderError";
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readError(error: unknown): VerifyGeError {
  const value = asObject(error);
  return {
    name: typeof value?.name === "string" ? value.name : undefined,
    code: typeof value?.code === "string" ? value.code : undefined,
    statusCode: typeof value?.statusCode === "number" ? value.statusCode : undefined,
    retryable: typeof value?.retryable === "boolean" ? value.retryable : undefined,
  };
}

function mapVerifyGeError(error: unknown): PhoneVerificationProviderError {
  const { code } = readError(error);
  if (code === "INVALID_OTP_CODE") return new PhoneVerificationProviderError("invalid_code");
  if (code === "OTP_EXPIRED" || code === "OTP_NOT_FOUND") {
    return new PhoneVerificationProviderError("expired_code");
  }
  if (code === "RATE_LIMIT_EXCEEDED" || code === "OTP_MAX_ATTEMPTS") {
    return new PhoneVerificationProviderError("too_many_requests");
  }
  return new PhoneVerificationProviderError("service_unavailable");
}

function logProviderFailure(
  event: "verify_ge_send_failed" | "verify_ge_verification_failed",
  error: unknown,
): void {
  const safe = readError(error);
  console.error(
    JSON.stringify({
      level: "error",
      event,
      errorName: safe.name,
      errorCode: safe.code,
      statusCode: safe.statusCode,
      retryable: safe.retryable,
    }),
  );
}

async function readVerifyGeResponse(response: Response): Promise<VerifyGeResponse> {
  const body: unknown = await response.json();
  const value = asObject(body);
  if (!value) throw new PhoneVerificationProviderError("service_unavailable");
  return value;
}

function readApiError(body: VerifyGeResponse): VerifyGeError | null {
  return body.success === false ? readError(body.error) : null;
}

function readRequestId(body: VerifyGeResponse): string | null {
  const data = asObject(body.data);
  return typeof data?.requestId === "string" && data.requestId.length > 0 ? data.requestId : null;
}

function readVerificationResult(body: VerifyGeResponse): boolean | null {
  const data = asObject(body.data);
  return typeof data?.success === "boolean" ? data.success : null;
}

export function createVerifyGeProvider(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): PhoneVerificationProvider {
  if (!apiKey) throw new Error("VERIFY_GE_API_KEY is missing");

  const baseHeaders = { "Content-Type": "application/json", "X-API-Key": apiKey };

  return {
    async send(input) {
      try {
        const response = await fetcher(`${VERIFY_GE_BASE_URL}/otp/send`, {
          method: "POST",
          headers: { ...baseHeaders, "X-Idempotency-Key": input.idempotencyKey },
          body: JSON.stringify({
            phoneNumber: input.phone,
            channel: "SMS",
            ttl: PHONE_VERIFICATION_TTL_SECONDS,
            length: PHONE_VERIFICATION_CODE_LENGTH,
          }),
        });
        const body = await readVerifyGeResponse(response);
        const apiError = readApiError(body);
        if (apiError) {
          const mappedError = mapVerifyGeError(apiError);
          if (mappedError.code === "service_unavailable") {
            logProviderFailure("verify_ge_send_failed", apiError);
          }
          throw mappedError;
        }
        const requestId = readRequestId(body);
        if (!response.ok || !requestId) {
          throw new PhoneVerificationProviderError("service_unavailable");
        }
        return { provider: "verify_ge", requestId };
      } catch (error) {
        if (error instanceof PhoneVerificationProviderError) throw error;
        const mappedError = mapVerifyGeError(error);
        if (mappedError.code === "service_unavailable")
          logProviderFailure("verify_ge_send_failed", error);
        throw mappedError;
      }
    },
    async verify(input) {
      try {
        const response = await fetcher(`${VERIFY_GE_BASE_URL}/otp/verify`, {
          method: "POST",
          headers: baseHeaders,
          body: JSON.stringify({ requestId: input.requestId, code: input.code }),
        });
        const body = await readVerifyGeResponse(response);
        const apiError = readApiError(body);
        if (apiError) throw apiError;
        const verified = readVerificationResult(body);
        if (!response.ok || verified === null) {
          throw new PhoneVerificationProviderError("service_unavailable");
        }
        return { verified };
      } catch (error) {
        const mappedError =
          error instanceof PhoneVerificationProviderError ? error : mapVerifyGeError(error);
        if (mappedError.code === "service_unavailable") {
          logProviderFailure("verify_ge_verification_failed", error);
        }
        throw mappedError;
      }
    },
  };
}
