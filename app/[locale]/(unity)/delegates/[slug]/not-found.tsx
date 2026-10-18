import { NOT_FOUND_DESCRIPTION, NOT_FOUND_HOME } from "@/components/NotFoundNotice";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import { UnityNotice } from "@/components/UnityNotice";
import { showRatings } from "@/lib/ratings-switch";
import { useCopy } from "@/lib/i18n/copy";
import { getCopy } from "@/lib/i18n/server";

/**
 * A missing delegate's tab title. The page's generateMetadata returns this same object for a
 * missing slug (ADR-044): the 404's HTML takes its title from this file, its tab from the page
 * until the 60-second ISR refresh drops the page's metadata and falls back to this file's.
 */
export async function generateMetadata() {
  const t = await getCopy();
  return { title: t("დელეგატი ვერ მოიძებნა — ქართული რესპუბლიკა") };
}

export default function DelegateNotFound() {
  const t = useCopy();
  return (
    <UnityNotice
      title="დელეგატი ვერ მოიძებნა."
      description={NOT_FOUND_DESCRIPTION}
      actions={
        // while ratings are hidden (ADR-052) there is no ranking to return to: the site-wide
        // not-found notice's home link instead
        showRatings() ? (
          <UnityButtonLink href="/leaderboard">{t("დაბრუნდი რეიტინგზე")}</UnityButtonLink>
        ) : (
          <UnityButtonLink href="/">{t(NOT_FOUND_HOME)}</UnityButtonLink>
        )
      }
    />
  );
}
