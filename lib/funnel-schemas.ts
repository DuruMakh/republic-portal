import { z } from "zod";
import { PRIVACY_CONSENT_REQUIRED_MESSAGE } from "./privacy";
import { parseRegistrationPhone } from "./phone-number";
import { normalizeGeorgianPhone } from "./validation";

export const EMPLOYMENT_PRESETS = [
  "დასაქმებული",
  "თვითდასაქმებული",
  "სტუდენტი",
  "პენსიონერი",
  "დროებით უმუშევარი",
] as const;

export const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "შეავსე ეს ველი" })
  .max(60, { message: "მაქსიმუმ 60 სიმბოლო" });

const phoneSchema = z.string().transform((v, ctx) => {
  const parsed = parseRegistrationPhone(v);
  if (parsed.ok) return parsed.phone;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message:
      parsed.reason === "country_not_supported"
        ? "ამ ქვეყნის ნომერზე კოდს ჯერ ვერ ვაგზავნით."
        : "შეიყვანეთ მობილურის ნომერი (5XX XX XX XX, ან საზღვარგარეთის ნომერი ქვეყნის კოდით)",
  });
  return z.NEVER;
});

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { message: "შეიყვანე 6-ნიშნა კოდი" }),
});

const refCodeSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,32}$/, { message: "არასწორი რეფერალური კოდი" });

export const employmentSchema = z
  .string()
  .trim()
  .min(1, { message: "მიუთითე საქმიანობა." })
  .max(100, { message: "მაქსიმუმ 100 სიმბოლო" });

export const regionIdSchema = z.number().int().positive({ message: "აირჩიე მხარე." });
export const cityIdSchema = z.number().int().positive({ message: "აირჩიე ქალაქი." });
export const delegateIdSchema = z.string().uuid({ message: "არასწორი დელეგატი" }).nullable();

const personalIdSchema = z
  .string()
  .regex(/^\d{11}$/, { message: "პირადი ნომერი უნდა იყოს 11 ციფრი." });

export const registerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  refCode: refCodeSchema.nullish(),
  // Registration privacy consent (spec 2026-10-08 §4). zod v3's `{ message }` shorthand
  // does not reach z.literal's issues (see tierSchema below), so an explicit errorMap.
  privacyConsent: z.literal(true, {
    errorMap: () => ({ message: PRIVACY_CONSENT_REQUIRED_MESSAGE }),
  }),
});

/**
 * The old phone-OTP sign-up (NEXT_PUBLIC_AUTH_MODE=phone, unused in production) sends its SMS
 * through Supabase Auth, outside the Twilio routing and the foreign brake, so it stays Georgian.
 */
export const legacyRegisterSchema = registerSchema.extend({
  phone: z.string().transform((v, ctx) => {
    const georgian = normalizeGeorgianPhone(v);
    if (georgian !== null) return georgian;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "შეიყვანეთ ქართული მობილურის ნომერი (5XX XX XX XX)",
    });
    return z.NEVER;
  }),
});

/** Server-action variant: the phone is already proven by the OTP session. */
export const registerActionSchema = registerSchema.omit({ phone: true });

export const membershipProfileSchema = z.object({
  personalId: personalIdSchema.nullable(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "მიუთითე დაბადების თარიღი." })
    .refine((v) => v >= "1900-01-01" && v < new Date().toISOString().slice(0, 10), {
      message: "თარიღი უნდა იყოს წარსულში.",
    }),
  regionId: regionIdSchema,
  cityId: cityIdSchema,
  employment: employmentSchema,
  delegateId: delegateIdSchema,
});

export const tierSchema = z.object({
  // zod v3's `{ message }` shorthand only feeds invalid_type / invalid_enum_value
  // issues (see processCreateParams in zod/v3/types.js) — a z.union's
  // `invalid_union` issue code ignores it too, so this needs an explicit errorMap.
  // Fixed fee (owner fix #9): the 5/10/20 choice is retired, but the literal still
  // needs its own errorMap — z.literal's `{ message }` shorthand has the same gap.
  tier: z.literal(10, {
    errorMap: () => ({ message: "აირჩიე საწევრო პაკეტი." }),
  }),
});
