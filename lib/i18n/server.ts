import { getLocale as intlLocale } from "next-intl/server";
import { copyFor } from "./translate";
import type { Locale } from "./routing";
import { headers } from "next/headers";

export async function getLocale(): Promise<Locale> {
  return (await intlLocale()) === "en" ? "en" : "ka";
}

export async function getCopy() {
  const locale = await getLocale();
  return copyFor(locale);
}

/** Root params are unavailable in Server Actions; the proxy overwrites this request header. */
export async function getActionLocale(): Promise<Locale> {
  return (await headers()).get("x-portal-locale") === "en" ? "en" : "ka";
}
