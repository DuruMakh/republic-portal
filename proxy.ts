import { NextResponse, type NextRequest } from "next/server";
import { showEvents } from "@/lib/events-switch";
import { hiddenBySwitch } from "@/lib/hidden-routes";
import { showPublicFinances } from "@/lib/public-finances";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // A switch-hidden page gets the exact response a mistyped address gets: the site-wide not-found
  // page (404, Georgian title in the HTML itself), never the page's own cached 404 (ADR-040).
  const switches = { financesPublic: showPublicFinances(), eventsShown: showEvents() };
  if (hiddenBySwitch(request.nextUrl.pathname, switches)) {
    return NextResponse.rewrite(new URL("/_not-found", request.url));
  }
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest).*)"],
};
