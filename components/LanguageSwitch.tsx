"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useSyncExternalStore, type MouseEvent } from "react";
import { useEnglishShown } from "@/components/EnglishShown";
import { localePath, type Locale } from "@/lib/i18n/routing";

function browserAddress() {
  return window.location.pathname + window.location.search + window.location.hash;
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

// A fixed server fallback also keeps static not-found pages free of hydration mismatches.
const serverAddress = () => "/";

/**
 * A language change always retains the actual address, including referral and section details.
 * Renders nothing while the English version is hidden (SHOW_ENGLISH, lib/english-switch.ts).
 */
export function LanguageSwitch(props: { className?: string; onNavigate?: () => void }) {
  return useEnglishShown() ? <LanguageLinks {...props} /> : null;
}

function LanguageLinks({
  className = "",
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const locale = useLocale() === "en" ? "en" : "ka";
  // Subscribe to Next navigations too; the browser address remains authoritative for its hash.
  usePathname();
  const address = useSyncExternalStore(subscribe, browserAddress, serverAddress);

  function refreshLink(event: MouseEvent<HTMLAnchorElement>, target: Locale) {
    event.currentTarget.href = localePath(browserAddress(), target);
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-[12px] font-bold tracking-[.04em] ${className}`}
    >
      {(["ka", "en"] as const).map((target, index) => (
        <span key={target} className="inline-flex items-center gap-1">
          {index ? (
            <span aria-hidden="true" className="opacity-50">
              /
            </span>
          ) : null}
          {target === locale ? (
            <span
              lang={target}
              aria-current="true"
              className="px-1.5 py-2 underline underline-offset-4"
            >
              {target === "ka" ? "KA" : "EN"}
            </span>
          ) : (
            <Link
              href={localePath(address, target)}
              hrefLang={target}
              lang={target}
              aria-label={target === "ka" ? "ქართული" : "English"}
              prefetch={false}
              className="px-1.5 py-2 text-current no-underline hover:text-current hover:underline"
              onClick={(event) => refreshLink(event, target)}
              onAuxClick={(event) => refreshLink(event, target)}
              onNavigate={(event) => {
                event.preventDefault();
                onNavigate?.();
                window.location.assign(localePath(browserAddress(), target));
              }}
            >
              {target === "ka" ? "KA" : "EN"}
            </Link>
          )}
        </span>
      ))}
    </span>
  );
}
