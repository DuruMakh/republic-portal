/**
 * zod for every Phase 4 admin boundary (spec §5). Same schemas drive client
 * forms and server actions; the database re-validates inside the RPCs. House
 * pattern: Georgian messages on every user-visible failure.
 */
import { z } from "zod";
import { ADMIN_ROLE_VALUES } from "./admin";
import { isReferenceCode } from "./funnel";

/** Georgia is UTC+4 year-round — same fixed-offset trick as lib/cabinet.ts. */
export function todayTbilisiIso(): string {
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const uuid = z.string().uuid("ჩანაწერი ვერ მოიძებნა — განაახლე გვერდი.");

const amountGel = z
  .number({ invalid_type_error: "თანხა არასწორია." })
  .positive("თანხა არასწორია.")
  .max(10000, "თანხა არასწორია.")
  .multipleOf(0.01, "თანხა არასწორია.");

const paidAt = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "თარიღი არასწორია.")
  .refine((v) => v >= "2026-01-01" && v <= todayTbilisiIso(), "თარიღი არასწორია.");

export const approveDelegateSchema = z.object({ delegateId: uuid });

export const rejectDelegateSchema = z.object({
  delegateId: uuid,
  note: z.string().trim().max(500, "შენიშვნა ძალიან გრძელია (მაქს. 500).").default(""),
});

export const delegateProfileSchema = z.object({
  delegateId: uuid,
  bio: z.string().trim().max(1000, "ბიოგრაფია ძალიან გრძელია (მაქს. 1000).").default(""),
});

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Accepted upload mime types → stored file extension (spec §3.4). */
export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const recordPaymentSchema = z.object({
  memberId: uuid,
  amountGel,
  paidAt,
  bankReference: z.string().trim().max(64, "რეფერენსი ძალიან გრძელია (მაქს. 64).").default(""),
});

export const bulkPreviewSchema = z.object({
  text: z.string().min(1, "ჩასვი ამონაწერის სტრიქონები.").max(50_000, "ტექსტი ძალიან დიდია."),
});

const bulkRowSchema = z.object({
  referenceCode: z.string().refine(isReferenceCode, "კოდი არასწორია."),
  amountGel,
  paidAt,
});
export type BulkRow = z.infer<typeof bulkRowSchema>;

export const bulkConfirmSchema = z.object({
  rows: z
    .array(bulkRowSchema)
    .min(1, "ასარჩევი რიგები არ არის.")
    .max(500, "მაქს. 500 რიგი ერთ ჯერზე."),
});

export const voidPaymentSchema = z.object({
  paymentId: z.number().int().positive("ჩანაწერი ვერ მოიძებნა — განაახლე გვერდი."),
  reason: z
    .string()
    .trim()
    .min(3, "მიუთითე მიზეზი (3–500 სიმბოლო).")
    .max(500, "მიუთითე მიზეზი (3–500 სიმბოლო)."),
});

export const reassignSchema = z.object({ memberId: uuid, delegateId: uuid });

export const grantRoleSchema = z.object({
  userId: uuid,
  role: z.enum(ADMIN_ROLE_VALUES, { errorMap: () => ({ message: "როლი არასწორია." }) }),
});
export const revokeRoleSchema = grantRoleSchema;

export const graceDaysSchema = z.object({
  graceDays: z
    .number({ invalid_type_error: "დღეების რაოდენობა არასწორია." })
    .int("დღეების რაოდენობა არასწორია.")
    .min(0, "დღეების რაოდენობა არასწორია.")
    .max(365, "დღეების რაოდენობა არასწორია."),
});

export const memberLookupSchema = z.object({
  query: z.string().trim().min(2, "ჩაწერე მინ. 2 სიმბოლო.").max(100, "ძებნა ძალიან გრძელია."),
});

/** searchParams live in URLs — degrade gracefully on garbage, never 500. */
export const membersFilterSchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .catch(undefined),
  regionId: z.coerce.number().int().positive().optional().catch(undefined),
  status: z.enum(["draft", "profile_completed", "active_member"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
export type MembersFilter = z.infer<typeof membersFilterSchema>;
