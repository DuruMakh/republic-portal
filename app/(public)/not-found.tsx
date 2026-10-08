import { NotFoundNotice } from "@/components/NotFoundNotice";

/**
 * Missing pages inside the public site: the notice renders within the public header and footer.
 * No metadata export on purpose: for a 404 raised by a page, Next uses that page's own metadata,
 * not this file's (each page that can 404 sets its own title). That holds at build time and on
 * request-time renders only; a 60-second ISR regeneration drops it for the root layout's title
 * (ADR-040), which is why switch-hidden pages are answered in proxy.ts instead.
 */
export default function PublicNotFound() {
  return <NotFoundNotice />;
}
