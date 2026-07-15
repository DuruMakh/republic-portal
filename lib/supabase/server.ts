import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// No explicit <Database> on createServerClient — see the comment in client.ts
// (@supabase/ssr@0.6.x's generic is broken against the installed @supabase/supabase-js;
// annotating the function return instead gets the correct typed client). See DECISIONS.md ADR-012.
export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — middleware refreshes sessions instead
          }
        },
      },
    },
  );
}
