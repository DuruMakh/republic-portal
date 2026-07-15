import { z } from "zod";
import { normalizeGeorgianPhone } from "./validation";

export const EMPLOYMENT_PRESETS = [
  "დასაქმებული",
  "თვითდასაქმებული",
  "სტუდენტი",
  "პენსიონერი",
  "დროებით უმუშევარი",
] as const;

const nameSchema = z
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

export const contactSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
});

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { message: "შეიყვანე 6-ნიშნა კოდი" }),
});

const refCodeSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,32}$/, { message: "არასწორი რეფერალური კოდი" });

export const startSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  role: z.enum(["member", "delegate"]),
  refCode: refCodeSchema.nullish(),
});

const profileBase = {
  personalId: z.string().regex(/^\d{11}$/, { message: "პირადი ნომერი უნდა იყოს 11 ციფრი." }),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "მიუთითე დაბადების თარიღი." })
    .refine((v) => v >= "1900-01-01" && v < new Date().toISOString().slice(0, 10), {
      message: "თარიღი უნდა იყოს წარსულში.",
    }),
  regionId: z.number().int().positive({ message: "აირჩიე მხარე." }),
  cityId: z.number().int().positive({ message: "აირჩიე ქალაქი." }),
  employment: z
    .string()
    .trim()
    .min(1, { message: "მიუთითე საქმიანობა." })
    .max(100, { message: "მაქსიმუმ 100 სიმბოლო" }),
};

export const profileActionSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("member"),
    ...profileBase,
    delegateId: z.string().uuid({ message: "არასწორი დელეგატი" }).nullable(),
  }),
  z.object({
    role: z.literal("delegate"),
    ...profileBase,
    // zod v3's `{ message }` shorthand only feeds invalid_type / invalid_enum_value
    // issues (see processCreateParams in zod/v3/types.js) — a literal mismatch
    // raises `invalid_literal`, so `z.literal(true, { message })` silently falls
    // back to zod's English default ("Invalid literal value, expected true") and
    // breaks the Georgian-only UI text rule (CLAUDE.md). An explicit errorMap
    // applies unconditionally and fixes it.
    tcAccepted: z.literal(true, {
      errorMap: () => ({ message: "საჭიროა წესებზე თანხმობა." }),
    }),
  }),
]);

export const tierSchema = z.object({
  // Same zod v3 quirk as tcAccepted above: a z.union's `invalid_union` issue code
  // ignores the `{ message }` shorthand too, so this needs an explicit errorMap.
  tier: z.union([z.literal(5), z.literal(10), z.literal(20)], {
    errorMap: () => ({ message: "აირჩიე საწევრო პაკეტი." }),
  }),
});
