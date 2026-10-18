import type { Locale } from "./routing";
import { publicMessages } from "./messages/public";
import { accountMessages } from "./messages/accounts";
import { sharedMessages } from "./messages/shared";

const english: Record<string, string> = {
  ...publicMessages,
  ...accountMessages,
  ...sharedMessages,
};

/** Georgian remains the source of truth. Only explicitly supplied copy is translated. */
export function translate(source: string, locale: Locale): string {
  return locale === "en" ? (english[source] ?? source) : source;
}

const copies = {
  ka: (source: string) => source,
  en: (source: string) => translate(source, "en"),
};

export function copyFor(locale: Locale): (source: string) => string {
  return copies[locale];
}
