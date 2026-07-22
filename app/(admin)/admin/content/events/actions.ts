"use server";

import { revalidatePath } from "next/cache";
import { contentIdSchema, eventFormSchema } from "@/lib/content-schemas";
import { tbilisiLocalToIso } from "@/lib/community";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { resolvePublishSlug } from "@/lib/publish-slug";
import { takenSlugsFetcher } from "@/lib/supabase/slugs";
import { createServerSupabase } from "@/lib/supabase/server";

export type SaveEventResult = { ok: true; id: string } | { ok: false; error: string };
export type EventActionResult = { ok: true } | { ok: false; error: string };

function revalidateEvents(slug: string | null) {
  revalidatePath("/events");
  revalidatePath("/me/events");
  if (slug) revalidatePath(`/events/${slug}`);
}

export async function saveEventAction(input: unknown): Promise<SaveEventResult> {
  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const startsAtIso = tbilisiLocalToIso(parsed.data.startsAt);
  const endsAtIso =
    parsed.data.endsAt && parsed.data.endsAt !== "" ? tbilisiLocalToIso(parsed.data.endsAt) : null;
  if (!startsAtIso) return { ok: false, error: mapFunnelError("invalid_event_dates") };
  if (parsed.data.endsAt && parsed.data.endsAt !== "" && !endsAtIso) {
    return { ok: false, error: mapFunnelError("invalid_event_dates") };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_save_event", {
    p_id: parsed.data.id ?? null,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_location: parsed.data.location,
    p_starts_at: startsAtIso,
    p_ends_at: endsAtIso,
  });
  if (error || !data) return { ok: false, error: mapFunnelError(error?.message) };
  const { data: row } = await supabase.from("admin_events").select("slug").eq("id", data).single();
  revalidateEvents(row?.slug ?? null);
  return { ok: true, id: data };
}

export async function publishEventAction(id: unknown): Promise<EventActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();

  const { data: event, error: eventError } = await supabase
    .from("admin_events")
    .select("title, slug")
    .eq("id", parsed.data.id)
    .single();
  if (eventError || !event) {
    return { ok: false, error: mapFunnelError(eventError?.message ?? "invalid_target") };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = await resolvePublishSlug({
      title: event.title,
      fallback: "event",
      existingSlug: event.slug,
      fetchTaken: takenSlugsFetcher(supabase, "admin_events"),
    });
    if (slug === null) return { ok: false, error: GENERIC_FUNNEL_ERROR };
    const { data, error } = await supabase.rpc("admin_publish_event", {
      p_id: parsed.data.id,
      p_slug: slug,
    });
    if (!error) {
      revalidateEvents((data as { slug: string }).slug);
      return { ok: true };
    }
    if (error.code !== "23505") return { ok: false, error: mapFunnelError(error.message) };
  }
  return { ok: false, error: mapFunnelError("invalid_slug") };
}

export async function cancelEventAction(id: unknown): Promise<EventActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("admin_events")
    .select("slug")
    .eq("id", parsed.data.id)
    .single();
  const { error } = await supabase.rpc("admin_cancel_event", { p_id: parsed.data.id });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidateEvents(row?.slug ?? null);
  return { ok: true };
}

export async function deleteEventAction(id: unknown): Promise<EventActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_delete_event", { p_id: parsed.data.id });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/content/events");
  return { ok: true };
}
