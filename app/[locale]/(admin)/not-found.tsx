import { NotFoundNotice } from "@/components/NotFoundNotice";

/**
 * A missing admin page (a stale content link, say): just the notice, inside the admin layout.
 * Without this file the group would render the root app/not-found.tsx here and nest the public
 * header and footer inside the admin chrome (app/route-groups.test.tsx).
 */
export default function AdminNotFound() {
  return <NotFoundNotice />;
}
