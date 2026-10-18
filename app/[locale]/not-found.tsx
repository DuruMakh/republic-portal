import UnityLayout from "@/app/[locale]/(unity)/layout";
import { PinChromePathname } from "@/components/ChromePathname";
import { UnityNotFoundNotice } from "@/components/UnityNotice";
import { getCopy } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getCopy();
  return { title: t("გვერდი ვერ მოიძებნა — ქართული რესპუბლიკა") };
}

/**
 * Unknown URLs land here: the same Georgian notice, wrapped in the redesigned public site chrome so the
 * visitor keeps the header and footer instead of a bare page.
 *
 * Every route group has its own not-found.tsx that shows just the notice inside its own layout
 * (app/route-groups.test.tsx enforces it). A group without one would render THIS file inside its
 * layout and nest the public header and footer in the cabinet's or the admin chrome.
 *
 * This page is prerendered once, for /_not-found, but opened at whatever address was mistyped. The
 * chrome is therefore pinned to that path: left to read the live address, a deep one such as
 * /news/a/b would add the phone back header on the client only, and hydration would fail.
 *
 * UnityLayout must stay static (no cookies(), headers() or database reads): this file is built
 * into every route's not-found boundary, so a dynamic layout here would make every route dynamic.
 */
export default function RootNotFound() {
  return (
    <PinChromePathname pathname="/_not-found">
      <UnityLayout>
        <UnityNotFoundNotice />
      </UnityLayout>
    </PinChromePathname>
  );
}
