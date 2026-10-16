import type { Metadata } from "next";
import { NOT_FOUND_DESCRIPTION, NOT_FOUND_HOME } from "@/components/NotFoundNotice";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import { UnityNotice } from "@/components/UnityNotice";
import { showRatings } from "@/lib/ratings-switch";

/**
 * A missing delegate's tab title. The page's generateMetadata returns this same object for a
 * missing slug (ADR-044): the 404's HTML takes its title from this file, its tab from the page
 * until the 60-second ISR refresh drops the page's metadata and falls back to this file's.
 */
export const metadata: Metadata = { title: "დელეგატი ვერ მოიძებნა — ქართული რესპუბლიკა" };

export default function DelegateNotFound() {
  return (
    <UnityNotice
      title="დელეგატი ვერ მოიძებნა."
      description={NOT_FOUND_DESCRIPTION}
      actions={
        // while ratings are hidden (ADR-052) there is no ranking to return to: the site-wide
        // not-found notice's home link instead
        showRatings() ? (
          <UnityButtonLink href="/leaderboard">დაბრუნდი რეიტინგზე</UnityButtonLink>
        ) : (
          <UnityButtonLink href="/">{NOT_FOUND_HOME}</UnityButtonLink>
        )
      }
    />
  );
}
