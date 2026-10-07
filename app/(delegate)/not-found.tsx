import { NotFoundNotice } from "@/components/NotFoundNotice";

/**
 * A missing delegate-panel page: just the notice, inside the delegate layout. Without this file
 * the group would render the root app/not-found.tsx here and nest the public header and footer
 * inside the panel's (app/route-groups.test.tsx).
 */
export default function DelegateNotFound() {
  return <NotFoundNotice />;
}
