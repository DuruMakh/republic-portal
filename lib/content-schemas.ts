/**
 * zod for every Phase 5 boundary (spec §5). The same schemas drive client
 * forms and server actions; the DB re-validates inside RPCs/CHECKs. Local
 * datetimes are Tbilisi wall time "YYYY-MM-DDTHH:mm" — lexicographic order IS
 * chronological order for this fixed-width format, so refinements compare
 * strings directly; conversion to instants happens in the actions
 * (tbilisiLocalToIso, lib/community.ts).
 */
import { z } from "zod";

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;

const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const titleField = z
  .string()
  .trim()
  .min(1, { message: "სათაური სავალდებულოა." })
  .max(160, { message: "სათაური არ უნდა აღემატებოდეს 160 სიმბოლოს." });

const longTextField = z
  .string()
  .trim()
  .min(1, { message: "ტექსტი სავალდებულოა." })
  .max(20000, { message: "ტექსტი ძალიან გრძელია (მაქს. 20 000 სიმბოლო)." });

const localDatetimeField = z
  .string()
  .regex(LOCAL_DATETIME_RE, { message: "მიუთითე თარიღი და დრო." });

export const newsFormSchema = z.object({
  id: z.string().uuid().optional(),
  title: titleField,
  body: longTextField,
  visibility: z.enum(["public", "members"]),
});
export type NewsFormInput = z.infer<typeof newsFormSchema>;

export const eventFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: titleField,
    description: longTextField,
    location: z
      .string()
      .trim()
      .min(1, { message: "მიუთითე ადგილმდებარეობა." })
      .max(200, { message: "ადგილმდებარეობა ძალიან გრძელია (მაქს. 200)." }),
    startsAt: localDatetimeField,
    endsAt: z.union([localDatetimeField, z.literal("")]).optional(),
  })
  .refine((v) => !v.endsAt || v.endsAt === "" || v.endsAt > v.startsAt, {
    message: "დასრულების დრო დაწყების შემდეგ უნდა იყოს.",
    path: ["endsAt"],
  });
export type EventFormInput = z.infer<typeof eventFormSchema>;

export const pollFormSchema = z.object({
  id: z.string().uuid().optional(),
  question: z
    .string()
    .trim()
    .min(1, { message: "კითხვა სავალდებულოა." })
    .max(300, { message: "კითხვა ძალიან გრძელია (მაქს. 300)." }),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, { message: "პასუხი ცარიელია." })
        .max(120, { message: "პასუხი ძალიან გრძელია (მაქს. 120)." }),
    )
    .min(POLL_MIN_OPTIONS, { message: "მინიმუმ 2 პასუხია საჭირო." })
    .max(POLL_MAX_OPTIONS, { message: "მაქსიმუმ 10 პასუხი დაიშვება." })
    .refine((opts) => new Set(opts).size === opts.length, {
      message: "პასუხები უნიკალური უნდა იყოს.",
    }),
  endsAt: z.union([localDatetimeField, z.literal("")]).optional(),
});
export type PollFormInput = z.infer<typeof pollFormSchema>;

export const rsvpInputSchema = z.object({
  eventId: z.string().uuid(),
  going: z.boolean(),
});

export const voteInputSchema = z.object({
  pollId: z.string().uuid(),
  optionId: z.string().uuid(),
});

export const contentIdSchema = z.object({ id: z.string().uuid() });
