import { NOT_FOUND_METADATA, NotFoundNotice } from "@/components/NotFoundNotice";

/**
 * The generic title for a 404 raised by a public page without a not-found file of its own (today
 * /transparency and /events while hidden, whose pages present the same title). For a page-raised
 * 404 the served HTML takes its title from the nearest not-found file, while the tab takes the
 * page's own until a 60-second ISR regeneration drops it and falls back to the file's (ADR-041).
 * Pages with their own "not found" title (an article, a delegate, an event) therefore keep a
 * not-found file next to them whose metadata is the page's.
 */
export const metadata = NOT_FOUND_METADATA;

/** Missing pages inside the public site: the notice renders within the public header and footer. */
export default function PublicNotFound() {
  return <NotFoundNotice />;
}
