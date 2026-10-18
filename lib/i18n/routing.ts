import { defineRouting } from "next-intl/routing";

export type Locale = "ka" | "en";

export const routing = defineRouting({
  locales: ["ka", "en"],
  defaultLocale: "ka",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});

export function isLocale(value: string): value is Locale {
  return value === "ka" || value === "en";
}

export function stripLocale(pathname: string): string {
  const path = pathname.replace(/^\/(?:en|ka)(?=\/|[?#]|$)/, "");
  return !path || /^[?#]/.test(path) ? `/${path}` : path;
}

export function localePath(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const path = stripLocale(href);
  if (/^\/(?:admin|api|auth)(?:\/|[?#]|$)/.test(path) || /\.[a-z0-9]+(?:[?#]|$)/i.test(path)) {
    return path;
  }
  if (locale === "ka") return path;
  return `/en${path.replace(/^\/(?=[?#]|$)/, "")}`;
}
