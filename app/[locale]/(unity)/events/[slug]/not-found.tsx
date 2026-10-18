import { UnityNotFoundNotice } from "@/components/UnityNotice";
import { showEvents } from "@/lib/events-switch";
import { getCopy } from "@/lib/i18n/server";

/**
 * A missing event's tab title. The page's generateMetadata returns this same result for a
 * missing slug (ADR-044): the 404's HTML takes its title from this file, its tab from the page
 * until the 60-second ISR refresh drops the page's metadata and falls back to this file's.
 * While events are hidden (ADR-042) the 404 must not name them, so it is the generic title.
 */
export async function generateMetadata() {
  const t = await getCopy();
  return {
    title: t(
      showEvents()
        ? "ღონისძიება ვერ მოიძებნა — ქართული რესპუბლიკა"
        : "გვერდი ვერ მოიძებნა — ქართული რესპუბლიკა",
    ),
  };
}

/** The notice is the public group's generic one; only the title is the event's own. */
export default function EventNotFound() {
  return <UnityNotFoundNotice />;
}
