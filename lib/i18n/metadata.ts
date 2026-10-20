import type { Metadata } from "next";
import { showEnglish } from "@/lib/english-switch";
import { localePath, type Locale } from "./routing";

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
