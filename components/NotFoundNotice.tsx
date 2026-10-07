import type { Metadata } from "next";
import { ButtonLink } from "@/components/ButtonLink";
import { CenteredNotice } from "@/components/CenteredNotice";

/** Browser-tab title for every not-found page (the framework's own default is English). */
export const NOT_FOUND_METADATA: Metadata = {
  title: "გვერდი ვერ მოიძებნა — ქართული რესპუბლიკა",
};

/**
 * The one Georgian "page not found" notice, shared by the site-wide and the public not-found
 * pages. The description is the sentence app/(public)/delegates/[slug]/not-found.tsx already
 * uses; the button offers the single way out.
 */
export function NotFoundNotice() {
  return (
    <CenteredNotice
      title="გვერდი ვერ მოიძებნა."
      description="ბმული შეიძლება მოძველდა ან არასწორად ჩაიწერა."
      actions={<ButtonLink href="/">დაბრუნდი მთავარ გვერდზე</ButtonLink>}
    />
  );
}
