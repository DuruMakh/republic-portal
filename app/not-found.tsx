import PublicLayout from "@/app/(public)/layout";
import { NOT_FOUND_METADATA, NotFoundNotice } from "@/components/NotFoundNotice";

export const metadata = NOT_FOUND_METADATA;

/**
 * Unknown URLs, and not-found raised in the member or admin areas, land here: the same Georgian
 * notice, wrapped in the public site chrome so the visitor keeps the header and footer instead of
 * a bare page. Missing pages inside (public) use app/(public)/not-found.tsx, which already
 * renders within that layout.
 */
export default function RootNotFound() {
  return (
    <PublicLayout>
      <NotFoundNotice />
    </PublicLayout>
  );
}
