import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// @supabase/ssr@0.6.x's createBrowserClient<Database> return type resolves to a
// broken SupabaseClient instantiation against the currently installed
// @supabase/supabase-js (its .d.ts imports a "@supabase/supabase-js/dist/module/lib/types"
// path that no longer exists in that package's build output, silently going `any`
// under skipLibCheck and shifting the generic's positional type args). Omitting the
// explicit <Database> here and instead typing the function's return means the modern
// SupabaseClient<Database> default-parameter resolution (imported directly from
// @supabase/supabase-js, unaffected by ssr's broken passthrough) runs instead — same
// runtime call, correctly typed result. See DECISIONS.md ADR-012.
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
