import type { Metadata } from "next";
import { localePath, type Locale } from "./routing";

export function languageAlternates(path: string, locale: Locale): Pick<Metadata, "alternates"> {
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
