import type { createServerSupabase } from "./server";

type ServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * Taken-set fetch for resolvePublishSlug — ONE home for the block the three
 * publish/approve actions (news, events, delegate verify) each carried a copy
 * of. Scoped by the prefix the resolver passes: an unscoped read would silently
 * truncate at PostgREST's 1000-row cap once enough rows hold slugs, and a
 * missed collision would burn every retry attempt on the same slug. null = the
 * query errored (callers degrade to the Georgian generic).
 */
export function takenSlugsFetcher(
  supabase: ServerClient,
  view: "admin_news" | "admin_events" | "admin_delegate_queue",
): (prefix: string) => Promise<string[] | null> {
  return async (prefix) => {
    const { data, error } = await supabase.from(view).select("slug").like("slug", `${prefix}%`);
    if (error) return null;
    return (data ?? []).map((t) => t.slug).filter((s): s is string => !!s);
  };
}
