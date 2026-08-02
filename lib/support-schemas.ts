import { z } from "zod";
import {
  SUPPORT_EMAIL_INVALID,
  SUPPORT_FILL_FIELD,
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

const blankToUndefined = (v: string | undefined): string | undefined =>
  v === undefined || v.trim() === "" ? undefined : v.trim();

export const supportMessageSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: SUPPORT_FILL_FIELD })
      .max(60, { message: SUPPORT_MAX_60 }),
    email: z.string().max(120, { message: SUPPORT_MAX_120 }).optional(),
    phone: z.string().max(40, { message: SUPPORT_MAX_40 }).optional(),
    message: z
      .string()
      .trim()
      .min(10, { message: SUPPORT_MIN_10 })
      .max(2000, { message: SUPPORT_MAX_2000 }),
  })
  .transform((v) => ({
    ...v,
    email: blankToUndefined(v.email),
    phone: blankToUndefined(v.phone),
  }))
  .refine((v) => v.email !== undefined || v.phone !== undefined, {
    message: SUPPORT_NEED_CONTACT,
    path: ["email"],
  })
  .refine((v) => v.email === undefined || EMAIL_RE.test(v.email), {
    message: SUPPORT_EMAIL_INVALID,
    path: ["email"],
  });

export type SupportMessageInput = z.infer<typeof supportMessageSchema>;
