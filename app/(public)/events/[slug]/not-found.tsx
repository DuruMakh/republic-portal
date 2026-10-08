import type { Metadata } from "next";
import { NOT_FOUND_METADATA, NotFoundNotice } from "@/components/NotFoundNotice";
import { showEvents } from "@/lib/events-switch";

const EVENT_NOT_FOUND_METADATA: Metadata = {
  title: "ღონისძიება ვერ მოიძებნა — ქართული რესპუბლიკა",
};

/**
 * A missing event's tab title. The page's generateMetadata returns this same result for a
 * missing slug (ADR-041): the 404's HTML takes its title from this file, its tab from the page
 * until the 60-second ISR refresh drops the page's metadata and falls back to this file's.
 * While events are hidden (ADR-042) the 404 must not name them, so it is the generic title.
 */
export function generateMetadata(): Metadata {
  return showEvents() ? EVENT_NOT_FOUND_METADATA : NOT_FOUND_METADATA;
}

/** The notice is the public group's generic one; only the title is the event's own. */
export default function EventNotFound() {
  return <NotFoundNotice />;
}
