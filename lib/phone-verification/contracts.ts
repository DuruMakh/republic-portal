import { createHash } from "node:crypto";

export const PHONE_VERIFICATION_TTL_SECONDS = 300;
export const PHONE_VERIFICATION_CODE_LENGTH = 6;
export const PHONE_VERIFICATION_RESEND_SECONDS = 60;
export const PHONE_VERIFICATION_MAX_SENDS_PER_HOUR = 5;
export const PHONE_VERIFICATION_MAX_ATTEMPTS = 5;

export type PhoneVerificationPurpose = "registration";
export type PhoneVerificationFailureCode =
  | "not_authenticated"
  | "google_required"
  | "invalid_phone"
  | "too_many_requests"
  | "invalid_code"
  | "expired_code"
  | "phone_in_use"
  | "service_unavailable";

export const PHONE_VERIFICATION_MESSAGES = {
  not_authenticated: "სესია ამოიწურა — შედი Google-ით თავიდან.",
  google_required: "რეგისტრაციისთვის გამოიყენე Google-ით შესვლა.",
  invalid_phone: "შეიყვანე ქართული მობილურის ნომერი (5XX XX XX XX).",
  too_many_requests: "ძალიან ბევრი კოდი მოითხოვე — სცადე ცოტა ხანში.",
  invalid_code: "კოდი არასწორია.",
  expired_code: "კოდის მოქმედების დრო ამოიწურა — მოითხოვე ახალი.",
  phone_in_use: "ეს ნომერი უკვე გამოყენებულია სხვა ანგარიშზე.",
  service_unavailable: "კოდის სერვისი დროებით მიუწვდომელია — სცადე თავიდან.",
} satisfies Record<PhoneVerificationFailureCode, string>;

export type PhoneVerificationFailure = {
  ok: false;
  code: PhoneVerificationFailureCode;
  message: string;
};

export type SendPhoneVerificationActionResult =
  | { ok: true; challengeId: string; phone: string; expiresAt: string }
  | PhoneVerificationFailure;

export type VerifyPhoneVerificationActionResult =
  | { ok: true; phone: string }
  | PhoneVerificationFailure;

export interface SendPhoneVerificationInput {
  phone: string;
  purpose: PhoneVerificationPurpose;
  idempotencyKey: string;
}

export interface SentPhoneVerification {
  provider: "verify_ge" | "test";
  requestId: string;
}

export interface VerifyPhoneCodeInput {
  requestId: string;
  code: string;
}

export interface PhoneVerificationProvider {
  send(input: SendPhoneVerificationInput): Promise<SentPhoneVerification>;
  verify(input: VerifyPhoneCodeInput): Promise<{ verified: boolean }>;
}

export function buildPhoneVerificationIdempotencyKey(input: {
  userId: string;
  phone: string;
  purpose: PhoneVerificationPurpose;
  nowMs: number;
}): string {
  const window = Math.floor(input.nowMs / (PHONE_VERIFICATION_RESEND_SECONDS * 1000));
  return createHash("sha256")
    .update(`${input.userId}:${input.phone}:${input.purpose}:${window}`)
    .digest("hex");
}
