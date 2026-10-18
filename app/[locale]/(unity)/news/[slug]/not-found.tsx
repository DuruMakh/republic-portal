import { UnityNotFoundNotice } from "@/components/UnityNotice";
import { getCopy } from "@/lib/i18n/server";

/**
 * A missing article's tab title. The page's generateMetadata returns this same object for a
 * missing slug (ADR-044): the 404's HTML takes its title from this file, its tab from the page
 * until the 60-second ISR refresh drops the page's metadata and falls back to this file's.
 */
export async function generateMetadata() {
  const t = await getCopy();
  return { title: t("სიახლე ვერ მოიძებნა — ქართული რესპუბლიკა") };
}

/** The notice is the public group's generic one; only the title is the article's own. */
export default function NewsNotFound() {
  return <UnityNotFoundNotice />;
}
