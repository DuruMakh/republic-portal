"use server";

import { redirect } from "next/navigation";
import { delegatePhotoPath, deleteAccountSchema } from "@/lib/account-deletion";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type DeleteAccountResult = { ok: false; error: string };

/**
 * Spec 2026-10-08 §3.1/§5. The RPC runs on the caller's own session: auth.uid() is the
 * only identity it erases. The service-role client touches Storage alone, for the path the
 * database returned (never client input).
 */
export async function deleteMyAccountAction(input: unknown): Promise<DeleteAccountResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  // the database compares the word exactly, so send the zod-trimmed value, not the raw input
  const { data, error } = await supabase.rpc("delete_my_account", {
    p_confirm: parsed.data.confirm,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };

  // The account is already gone; a leftover photo is logged, never allowed to block the exit.
  const path = delegatePhotoPath((data as { photoUrl?: string | null } | null)?.photoUrl ?? null);
  if (path) {
    const { error: removeError } = await createAdminClient()
      .storage.from("delegate-photos")
      .remove([path]);
    if (removeError) console.error("account deletion: photo removal failed", removeError.message);
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect("/account-deleted");
}
