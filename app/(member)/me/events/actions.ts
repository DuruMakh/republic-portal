"use server";

import { rsvpInputSchema } from "@/lib/content-schemas";
import { showEvents } from "@/lib/events-switch";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";

export type RsvpResult = { ok: true } | { ok: false; error: string };

/** Thin action in front of member_rsvp (ADR-009 envelope: the RPC re-validates everything). */
export async function rsvpAction(input: unknown): Promise<RsvpResult> {
  // Events hidden (the default, ADR-038): the page is gone, so a direct call is refused too.
  if (!showEvents()) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const parsed = rsvpInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("member_rsvp", {
    p_event_id: parsed.data.eventId,
    p_going: parsed.data.going,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true };
}
