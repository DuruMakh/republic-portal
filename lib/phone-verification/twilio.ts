import "server-only";

import type { PhoneVerificationFailureCode, PhoneVerificationProvider } from "./contracts";
import { PhoneVerificationProviderError } from "./errors";

// Twilio Verify v2 over plain fetch (ADR-055): SMS codes for foreign numbers only.
const TWILIO_VERIFY_BASE_URL = "https://verify.twilio.com/v2/Services";

export interface TwilioConfig {
  apiKeySid: string;
  apiKeySecret: string;
  serviceSid: string;
}

const SEND_ERRORS: Record<number, PhoneVerificationFailureCode> = {
  60200: "invalid_phone",
  21211: "invalid_phone",
  21614: "invalid_phone",
  60205: "invalid_phone", // a landline: SMS is not supported
  60605: "country_not_supported",
  60410: "country_not_supported",
  60203: "too_many_requests",
  20429: "too_many_requests",
};

const VERIFY_ERRORS: Record<number, PhoneVerificationFailureCode> = {
  20404: "expired_code",
  60202: "too_many_requests",
  20429: "too_many_requests",
};

type TwilioReply = { status: number; body: Record<string, unknown> | null };

async function readReply(response: Response): Promise<TwilioReply> {
  try {
    const body: unknown = await response.json();
    return {
      status: response.status,
      body: typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null,
    };
  } catch {
    return { status: response.status, body: null };
  }
}

function failureFor(
  reply: TwilioReply,
  errors: Record<number, PhoneVerificationFailureCode>,
): PhoneVerificationFailureCode {
  const code = typeof reply.body?.code === "number" ? reply.body.code : undefined;
  const mapped = code === undefined ? undefined : errors[code];
  if (mapped) return mapped;
  if (reply.status === 429) return "too_many_requests";
  if (reply.status === 404 && errors === VERIFY_ERRORS) return "expired_code";
  return "service_unavailable";
}

/** Only Twilio's numeric error code and HTTP status: its message may quote the number. */
function logFailure(
  event: "twilio_send_failed" | "twilio_verification_failed",
  reply: TwilioReply | null,
): void {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      errorCode: typeof reply?.body?.code === "number" ? reply.body.code : undefined,
      statusCode: reply?.status,
    }),
  );
}

export function createTwilioProvider(
  config: TwilioConfig,
  fetcher: typeof fetch = fetch,
): PhoneVerificationProvider {
  const authorization = `Basic ${Buffer.from(`${config.apiKeySid}:${config.apiKeySecret}`).toString("base64")}`;
  const serviceUrl = `${TWILIO_VERIFY_BASE_URL}/${encodeURIComponent(config.serviceSid)}`;

  async function post(path: string, form: Record<string, string>): Promise<TwilioReply | null> {
    try {
      const response = await fetcher(`${serviceUrl}/${path}`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(form).toString(),
      });
      return await readReply(response);
    } catch {
      return null;
    }
  }

  return {
    async send(input) {
      // Twilio keeps one verification per number for 10 minutes and a repeat request resends
      // that same code under the same SID, which our challenge ledger cannot accept. Ending any
      // pending one first gives every send a new SID and code. Nothing to cancel is fine.
      await post(`Verifications/${encodeURIComponent(input.phone)}`, { Status: "canceled" });
      const reply = await post("Verifications", { To: input.phone, Channel: "sms" });
      const sid = reply?.body?.sid;
      if (reply && reply.status < 300 && typeof sid === "string" && sid.length > 0) {
        return { provider: "twilio", requestId: sid };
      }
      const code = reply ? failureFor(reply, SEND_ERRORS) : "service_unavailable";
      if (code === "service_unavailable") logFailure("twilio_send_failed", reply);
      throw new PhoneVerificationProviderError(code);
    },
    async verify(input) {
      const reply = await post("VerificationCheck", {
        VerificationSid: input.requestId,
        Code: input.code,
      });
      const status = reply?.body?.status;
      if (reply && reply.status < 300 && typeof status === "string") {
        return { verified: status === "approved" };
      }
      const code = reply ? failureFor(reply, VERIFY_ERRORS) : "service_unavailable";
      if (code === "service_unavailable") logFailure("twilio_verification_failed", reply);
      throw new PhoneVerificationProviderError(code);
    },
  };
}
