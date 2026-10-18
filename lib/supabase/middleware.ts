import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export async function updateSession(
  request: NextRequest,
  response = NextResponse.next({ request }),
) {
  // No explicit <Database> on createServerClient — see the comment in client.ts
  // (@supabase/ssr@0.6.x's generic is broken against the installed @supabase/supabase-js;
  // annotating the variable instead gets the correct typed client). See DECISIONS.md ADR-012.
  const supabase: SupabaseClient<Database> = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Preserve the language rewrite while forwarding refreshed cookies to this render.
          const refreshed = NextResponse.next({ request });
          refreshed.headers.forEach((value, name) => {
            if (
              name === "x-middleware-override-headers" ||
              name.startsWith("x-middleware-request-")
            ) {
              response.headers.set(name, value);
            }
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await supabase.auth.getUser();
  return response;
}
