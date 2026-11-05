import { NextResponse, type NextRequest } from "next/server";
import { showEnglish } from "@/lib/english-switch";
import { showEvents } from "@/lib/events-switch";
import { hiddenBySwitch } from "@/lib/hidden-routes";
import { showPublicFinances } from "@/lib/public-finances";
import { showRatings } from "@/lib/ratings-switch";
import { updateSession } from "@/lib/supabase/middleware";
import { stripLocale } from "@/lib/i18n/routing";

export async function proxy(request: NextRequest) {
  const incoming = request.nextUrl.pathname;
  const locale = /^\/en(?:\/|$)/.test(incoming) ? "en" : "ka";
  const pathname = stripLocale(incoming);
  // These headers are derived from the URL, never trusted from a caller.
  request.headers.set("x-portal-locale", locale);
  request.headers.set("x-portal-pathname", pathname);
  // /ka is the internal Georgian prefix and never public: its addresses move for good.
  if (/^\/ka(?:\/|$)/.test(incoming)) {
    const destination = request.nextUrl.clone();
    destination.pathname = pathname;
    return NextResponse.redirect(destination, 308);
  }
  // While the English version is hidden (owner decision 2026-10-20), an /en address, a shared
  // link or a search result alike, lands on the same Georgian page. A temporary redirect: the
  // addresses come back when the switch is on.
  if (locale === "en" && (!showEnglish() || /^\/admin(?:\/|$)/.test(pathname))) {
    const destination = request.nextUrl.clone();
    destination.pathname = pathname;
    return NextResponse.redirect(destination);
  }
  if (/^\/(?:api|auth)(?:\/|$)/.test(pathname) || /\.[a-z0-9]+$/i.test(pathname)) {
    return updateSession(request);
  }
  // A switch-hidden page gets the exact response a mistyped address gets: the site-wide not-found
  // page (404, Georgian title in the HTML itself), never the page's own cached 404 (ADR-040).
  // The status is set outright: Vercel answers a bare rewrite to /_not-found with 200.
  const switches = {
    financesPublic: showPublicFinances(),
    eventsShown: showEvents(),
    ratingsShown: showRatings(),
  };
  if (hiddenBySwitch(pathname, switches)) {
    return NextResponse.rewrite(new URL(`/${locale}/missing-page`, request.url), {
      status: 404,
      request,
    });
  }
  const destination = request.nextUrl.clone();
  destination.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const response =
    locale === "en"
      ? NextResponse.next({ request })
      : NextResponse.rewrite(destination, { request });
  return await updateSession(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|unity|sw.js|manifest.webmanifest).*)"],
};
