"use client";

import NextLink from "next/link";
import { useRouter as useNextRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useMemo, type ComponentProps } from "react";
import { localePath } from "./routing";

/** Same Link contract, with language applied only to portal page addresses. */
export function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale() === "en" ? "en" : "ka";
  const localized =
    typeof href === "string"
      ? localePath(href, locale)
      : href.host || href.hostname || href.protocol
        ? href
        : { ...href, pathname: href.pathname ? localePath(href.pathname, locale) : href.pathname };
  return <NextLink {...props} href={localized} />;
}

export default Link;

export function useRouter() {
  const { back, forward, refresh, push, replace, prefetch } = useNextRouter();
  const locale = useLocale() === "en" ? "en" : "ka";
  return useMemo(
    () => ({
      back,
      forward,
      refresh,
      push: (href: string, options?: Parameters<typeof push>[1]) =>
        options === undefined
          ? push(localePath(href, locale))
          : push(localePath(href, locale), options),
      replace: (href: string, options?: Parameters<typeof replace>[1]) =>
        options === undefined
          ? replace(localePath(href, locale))
          : replace(localePath(href, locale), options),
      prefetch: (href: string, options?: Parameters<typeof prefetch>[1]) =>
        options === undefined
          ? prefetch(localePath(href, locale))
          : prefetch(localePath(href, locale), options),
    }),
    [back, forward, refresh, push, replace, prefetch, locale],
  );
}
