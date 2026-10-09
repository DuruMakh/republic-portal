/**
 * Account deletion (spec docs/superpowers/specs/2026-10-08-account-deletion-design.md).
 * Pure: no React, no Next. The confirmation word is duplicated in the migration's
 * delete_my_account(); lib/account-deletion-migration.test.ts keeps the two equal.
 */
import { z } from "zod";
import {
  ACCOUNT_DELETE_CONFIRM_MISMATCH,
  ADMIN_DELETE_NAME_MISMATCH,
  ADMIN_DELETE_REASON_LENGTH,
} from "./account-deletion-copy";
import { GENERIC_FUNNEL_ERROR } from "./funnel";

export const ACCOUNT_DELETION_CONFIRM_WORD = "წაშლა";

export const deleteAccountSchema = z.object({
  confirm: z
    .string()
    .trim()
    .refine((v) => v === ACCOUNT_DELETION_CONFIRM_WORD, {
      message: ACCOUNT_DELETE_CONFIRM_MISMATCH,
    }),
});

export const adminDeleteMemberSchema = z.object({
  userId: z.string().uuid(GENERIC_FUNNEL_ERROR),
  reason: z.string().trim().min(5, ADMIN_DELETE_REASON_LENGTH).max(300, ADMIN_DELETE_REASON_LENGTH),
  typedName: z.string().trim().min(1, ADMIN_DELETE_NAME_MISMATCH).max(130),
});

const PHOTO_MARKER = "/delegate-photos/";

/** Object path of a delegate photo in its bucket, from the public URL the row stores. */
export function delegatePhotoPath(url: string | null): string | null {
  if (!url) return null;
  const idx = url.indexOf(PHOTO_MARKER);
  return idx >= 0 ? url.slice(idx + PHOTO_MARKER.length) : null;
}
