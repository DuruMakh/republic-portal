import { NotFoundNotice } from "@/components/NotFoundNotice";

/**
 * Missing pages inside the public site: the notice renders within the public header and footer.
 * No metadata export on purpose: for a 404 raised by a page, Next uses that page's own metadata,
 * not this file's (each page that can 404 sets its own title).
 */
export default function PublicNotFound() {
  return <NotFoundNotice />;
}
