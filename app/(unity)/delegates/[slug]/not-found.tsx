import type { Metadata } from "next";
import { ButtonLink } from "@/components/ButtonLink";
import { CenteredNotice } from "@/components/CenteredNotice";
import { showRatings } from "@/lib/ratings-switch";

/**
 * A missing delegate's tab title. The page's generateMetadata returns this same object for a
 * missing slug (ADR-044): the 404's HTML takes its title from this file, its tab from the page
 * until the 60-second ISR refresh drops the page's metadata and falls back to this file's.
 */
export const metadata: Metadata = { title: "დელეგატი ვერ მოიძებნა — ქართული რესპუბლიკა" };

export default function DelegateNotFound() {
  return (
    <CenteredNotice
      title="დელეგატი ვერ მოიძებნა."
      description="ბმული შეიძლება მოძველდა ან არასწორად ჩაიწერა."
      actions={
        // while ratings are hidden (ADR-052) there is no ranking to return to: the site-wide
        // not-found notice's home link instead
        showRatings() ? (
          <ButtonLink href="/leaderboard" variant="ghost">
            დაბრუნდი რეიტინგზე
          </ButtonLink>
        ) : (
          <ButtonLink href="/" variant="ghost">
            დაბრუნდი მთავარ გვერდზე
          </ButtonLink>
        )
      }
    />
  );
}
