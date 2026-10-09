"use server";

import { redirect } from "next/navigation";
import { deleteAccountSchema } from "@/lib/account-deletion";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { removeDelegatePhotos } from "@/lib/supabase/delegate-photos";
import { createServerSupabase } from "@/lib/supabase/server";

export type DeleteAccountResult = { ok: false; error: string };

/**
 * Spec 2026-10-08 §3.1/§5. The RPC runs on the caller's own session: auth.uid() is the only
 * identity it erases. The service role touches Storage alone, inside removeDelegatePhotos, for
 * the session's own user id and the path the database returned (never client input).
 */
export async function deleteMyAccountAction(input: unknown): Promise<DeleteAccountResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: mapFunnelError("not_authenticated") };

  // the database compares the word exactly, so send the zod-trimmed value, not the raw input
  const { data, error } = await supabase.rpc("delete_my_account", {
    p_confirm: parsed.data.confirm,
  });
  if (error) {
    // invalid_target: the profile is already gone, which only an erasure of this same account
    // does (a double submit racing the first). That request sweeps the photos; this one just
    // finishes the exit.
    if (!error.message.includes("invalid_target")) {
      return { ok: false, error: mapFunnelError(error.message) };
    }
  } else {
    // never throws: the account is already gone, a leftover photo must not block the exit
    const photoUrl = (data as { photoUrl?: unknown } | null)?.photoUrl;
    await removeDelegatePhotos(user.id, typeof photoUrl === "string" ? photoUrl : null);
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect("/account-deleted");
}
