import type { Metadata } from "next";
import { NotFoundNotice } from "@/components/NotFoundNotice";

/**
 * A missing article's tab title. The page's generateMetadata returns this same object for a
 * missing slug (ADR-044): the 404's HTML takes its title from this file, its tab from the page
 * until the 60-second ISR refresh drops the page's metadata and falls back to this file's.
 */
export const metadata: Metadata = { title: "სიახლე ვერ მოიძებნა — ქართული რესპუბლიკა" };

/** The notice is the public group's generic one; only the title is the article's own. */
export default function NewsNotFound() {
  return <NotFoundNotice />;
}
