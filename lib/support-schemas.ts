import { z } from "zod";
import {
  SUPPORT_EMAIL_INVALID,
  SUPPORT_FILL_FIELD,
  SUPPORT_INVALID_INPUT,
  SUPPORT_MAX_40,
  SUPPORT_MAX_60,
  SUPPORT_MAX_120,
  SUPPORT_MAX_2000,
  SUPPORT_MIN_10,
  SUPPORT_NEED_CONTACT,
} from "./support-copy";

// Deliberately looser than a full RFC address grammar: the point is to stop
// nonsense reaching a mailbox, not to adjudicate exotic-but-legal addresses
// and reject a real person.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Length in CODE POINTS, matching Postgres `length()`.
 *
 * zod's own `.min`/`.max` measure UTF-16 code units, so every astral character
 * (an emoji, a flag) counts twice on the client and once in the RPC. A message
 * of five emoji measured 10 here and 5 there: the form accepted it and the
 * database refused it, and the visitor was told to try again with text that
 * could never succeed. Counting the same units on both sides removes the
 * class of bug rather than the one instance.
 */
const codePoints = (value: string): number => [...value].length;

/**
 * zod's built-in messages are English, and this schema backs a PUBLIC server
 * action taking `unknown` — a request omitting a field or sending a number
 * would otherwise surface „Required“ or „Expected string, received null“ as
 * user-facing copy on a Georgian-only site (CLAUDE.md). `{ message }` on a
 * check cannot reach those codes; an errorMap can. Same reason
 * lib/funnel-schemas.ts and lib/admin-schemas.ts carry one.
 */
const georgianErrors: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return { message: issue.received === "undefined" ? SUPPORT_FILL_FIELD : SUPPORT_INVALID_INPUT };
  }
  return { message: ctx.defaultError };
};

/** Trimmed with JS semantics, then measured in code points — see above. */
const requiredText = (min: number, max: number, minMessage: string, maxMessage: string) =>
  z
    .string({ errorMap: georgianErrors })
    .transform((value) => value.trim())
    .refine((value) => codePoints(value) >= min, { message: minMessage })
    .refine((value) => codePoints(value) <= max, { message: maxMessage });

/** Trimmed BEFORE measuring, so trailing spaces cannot fail a length rule. */
const optionalText = (max: number, maxMessage: string) =>
  z
    .string({ errorMap: georgianErrors })
    .transform((value) => value.trim())
    .refine((value) => codePoints(value) <= max, { message: maxMessage })
    .transform((value) => (value === "" ? undefined : value))
    .optional();

export const supportMessageSchema = z
  .object({
    name: requiredText(1, 60, SUPPORT_FILL_FIELD, SUPPORT_MAX_60),
    email: optionalText(120, SUPPORT_MAX_120),
    phone: optionalText(40, SUPPORT_MAX_40),
    message: requiredText(10, 2000, SUPPORT_MIN_10, SUPPORT_MAX_2000),
  })
  .refine((v) => v.email !== undefined || v.phone !== undefined, {
    message: SUPPORT_NEED_CONTACT,
    path: ["email"],
  })
  .refine((v) => v.email === undefined || EMAIL_RE.test(v.email), {
    message: SUPPORT_EMAIL_INVALID,
    path: ["email"],
  });

export type SupportMessageInput = z.infer<typeof supportMessageSchema>;
