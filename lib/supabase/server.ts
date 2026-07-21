import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminRole } from "../admin";
import type { CabinetState } from "../funnel";
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

/**
 * Request-memoized cabinet_state read. Every cabinet request renders a route-group
 * layout AND a page, both of which need the state; React's cache() collapses the
 * two identical RPCs into one per request. Single source of the error contract, so
 * the throw message can't drift between call sites (it had). Throws on failure —
 * a transient backend blip must never masquerade as "no profile" and bounce a
 * completed member back into the funnel.
 */
export const getCabinetState = cache(async (): Promise<CabinetState> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("cabinet_state");
  if (error || data === null) {
    throw new Error(`cabinet_state failed: ${error?.message ?? "empty response"}`);
  }
  return data as unknown as CabinetState;
});

/**
 * Request-memoized own-roles read (Phase 4 §3.1). Backed by the `admin_roles`
 * "own roles readable" RLS policy — a caller can only ever see their own rows.
 * UX-only signal (nav filtering, layout gate); every view/RPC re-checks in-DB.
 */
export const getAdminRoles = cache(async (): Promise<AdminRole[]> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("admin_roles").select("role").eq("user_id", user.id);
  if (error) throw new Error(`admin_roles read failed: ${error.message}`);
  return (data ?? []).map((r) => r.role as AdminRole);
});
