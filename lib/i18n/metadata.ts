import type { Metadata } from "next";
import { showEnglish } from "@/lib/english-switch";
import { localePath, type Locale } from "./routing";

/** For pages that must never appear in search results. */
export const NOINDEX = { index: false, follow: false } as const;

/**
 * The share-preview fields every page needs. A page that sets its own `openGraph` replaces the
 * layout's object instead of merging with it, so such pages spread this first.
 */
export function openGraphDefaults(locale: Locale): {
  siteName: string;
  locale: "ka_GE" | "en_GB";
  type: "website";
} {
  return locale === "en"
    ? { siteName: "Georgian Republic", locale: "en_GB", type: "website" }
    : { siteName: "ქართული რესპუბლიკა", locale: "ka_GE", type: "website" };
}

export function languageAlternates(path: string, locale: Locale): Pick<Metadata, "alternates"> {
  // While English is hidden there is no other language to point search engines at.
  if (!showEnglish()) return { alternates: { canonical: localePath(path, locale) } };
  return {
    alternates: {
      canonical: localePath(path, locale),
      languages: {
        ka: localePath(path, "ka"),
        en: localePath(path, "en"),
        "x-default": localePath(path, "ka"),
      },
    },
  };
}
