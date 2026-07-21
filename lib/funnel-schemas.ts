import { z } from "zod";
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

const phoneSchema = z
  .string()
  .refine((v) => normalizeGeorgianPhone(v) !== null, {
    message: "შეიყვანეთ ქართული მობილურის ნომერი (5XX XX XX XX)",
  })
  .transform((v) => {
    const normalized = normalizeGeorgianPhone(v);
    if (normalized === null) throw new Error("unreachable: refine guarantees a valid phone");
    return normalized;
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
  personalId: personalIdSchema,
  phone: phoneSchema,
  refCode: refCodeSchema.nullish(),
});

/** Server-action variant: the phone is already proven by the OTP session. */
export const registerActionSchema = registerSchema.omit({ phone: true });

export const membershipProfileSchema = z.object({
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
  tier: z.union([z.literal(5), z.literal(10), z.literal(20)], {
    errorMap: () => ({ message: "აირჩიე საწევრო პაკეტი." }),
  }),
});
