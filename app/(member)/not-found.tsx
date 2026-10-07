import { NotFoundNotice } from "@/components/NotFoundNotice";

/**
 * A missing cabinet page: just the notice, inside the cabinet's own layout. Without this file the
 * group would render the root app/not-found.tsx here and nest the public header and footer inside
 * the cabinet's (app/route-groups.test.tsx).
 */
export default function MemberNotFound() {
  return <NotFoundNotice />;
}
