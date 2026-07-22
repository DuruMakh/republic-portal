import { makeSlugFrom, slugFrom } from "./slug";

/**
 * One home for the publish-time slug decision (news/events/delegates each kept a
 * copy of this block — R2 §8.7): an already-minted slug is permanent; otherwise
 * mint against the caller-fetched taken set. `fetchTaken(base)` receives the
 * base so callers can scope their LIKE query; null = the query errored.
 */
export async function resolvePublishSlug(opts: {
  title: string;
  fallback: string;
  existingSlug: string | null;
  fetchTaken: (base: string) => Promise<string[] | null>;
}): Promise<string | null> {
  if (opts.existingSlug) return opts.existingSlug;
  const base = slugFrom(opts.title, opts.fallback);
  const taken = await opts.fetchTaken(base);
  if (taken === null) return null;
  return makeSlugFrom(opts.title, opts.fallback, new Set(taken));
}
