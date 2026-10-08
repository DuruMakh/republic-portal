/**
 * Account deletion (spec docs/superpowers/specs/2026-10-08-account-deletion-design.md).
 * Pure: no React, no Next. The confirmation word is duplicated in the migration's
 * delete_my_account(); lib/account-deletion-migration.test.ts keeps the two equal.
 */
export const ACCOUNT_DELETION_CONFIRM_WORD = "წაშლა";
