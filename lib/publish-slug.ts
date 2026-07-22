import { SLUG_MAX, makeSlugFrom, slugFrom } from "./slug";

/**
 * One home for the publish-time slug decision (news/events/delegates each kept a
 * copy of this block — R2 §8.7): an already-minted slug is permanent; otherwise
 * mint against the caller-fetched taken set. `fetchTaken(prefix)` receives a
 * prefix so callers can scope their LIKE query; null = the query errored.
 */
export async function resolvePublishSlug(opts: {
  title: string;
  fallback: string;
  existingSlug: string | null;
  fetchTaken: (prefix: string) => Promise<string[] | null>;
}): Promise<string | null> {
  if (opts.existingSlug) return opts.existingSlug;
  const base = slugFrom(opts.title, opts.fallback);
  // Suffixed candidates TRUNCATE the base to stay ≤ SLUG_MAX ("-2" → slice(0, 78)),
  // so a fetch scoped to the full base misses them once the base runs ≥ 79 chars —
  // the collision then re-mints the same candidate on every retry. Scope the fetch
  // to the shortest prefix any realistic candidate keeps (suffixes up to "-999");
  // for bases under the cap this is the base itself, unchanged.
  const prefix = base.slice(0, SLUG_MAX - 4).replace(/-+$/g, "");
  const taken = await opts.fetchTaken(prefix);
  if (taken === null) return null;
  return makeSlugFrom(opts.title, opts.fallback, new Set(taken));
}
