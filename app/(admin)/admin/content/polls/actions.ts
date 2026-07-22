"use server";

import { revalidatePath } from "next/cache";
import { contentIdSchema, pollFormSchema } from "@/lib/content-schemas";
import { tbilisiLocalToIso } from "@/lib/community";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type SavePollResult = { ok: true; id: string } | { ok: false; error: string };
export type PollActionResult = { ok: true } | { ok: false; error: string };

export async function savePollAction(input: unknown): Promise<SavePollResult> {
  const parsed = pollFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const endsAtIso =
    parsed.data.endsAt && parsed.data.endsAt !== "" ? tbilisiLocalToIso(parsed.data.endsAt) : null;
  if (parsed.data.endsAt && parsed.data.endsAt !== "" && !endsAtIso) {
    return { ok: false, error: mapFunnelError("invalid_event_dates") };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_save_poll", {
    p_id: parsed.data.id ?? null,
    p_question: parsed.data.question,
    p_options: parsed.data.options,
    p_ends_at: endsAtIso,
  });
  if (error || !data) return { ok: false, error: mapFunnelError(error?.message) };
  return { ok: true, id: data };
}

function makeStatusAction(rpc: "admin_open_poll" | "admin_close_poll" | "admin_delete_poll") {
  return async function pollStatusAction(id: unknown): Promise<PollActionResult> {
    const parsed = contentIdSchema.safeParse({ id });
    if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
    const supabase = await createServerSupabase();
    const { error } = await supabase.rpc(rpc, { p_id: parsed.data.id });
    if (error) return { ok: false, error: mapFunnelError(error.message) };
    revalidatePath("/admin/content/polls");
    // member surface too, same contract as revalidateNews/revalidateEvents — a
    // closed/deleted poll must not linger votable in a member's cached /me/polls
    revalidatePath("/me/polls");
    return { ok: true };
  };
}

export const openPollAction = makeStatusAction("admin_open_poll");
export const closePollAction = makeStatusAction("admin_close_poll");
export const deletePollAction = makeStatusAction("admin_delete_poll");
