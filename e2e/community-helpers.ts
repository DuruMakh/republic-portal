import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { phase4PersonalId, phase4Phone, serviceClient } from "./admin-helpers";
import { loginAs, seedCompletedMember } from "./funnel-helpers";

/**
 * Sign the browser in as a completed member on phase4Phone(k) (central, tier 10).
 * Direct-seeded then logged in: the wizard UI journey is membership.spec's job —
 * these suites test community/admin behavior and get faster and less flaky by
 * skipping the funnel. Same signature and postcondition as before (browser signed in
 * as a completed member), so its consumers keep working untouched.
 */
export async function registerCompletedMember(page: Page, k: number): Promise<void> {
  const phone = phase4Phone(k);
  await seedCompletedMember({
    phone,
    firstName: "წევრი",
    lastName: "ტესტი",
    personalId: phase4PersonalId(k),
  });
  await loginAs(page, phone);
}

/**
 * A supabase-js client authenticated AS the browser's current member, for
 * direct RPC assertions (spec §7: "asserted via a direct second RPC call").
 * Reads the @supabase/ssr auth cookie(s) from the Playwright context —
 * possibly chunked (`sb-…-auth-token.0/.1`), possibly `base64-`-prefixed —
 * and mounts the access token as a Bearer header. If the cookie format ever
 * shifts, inspect the sb-*-auth-token cookie(s): the access_token JWT is
 * inside; adapt the decode, do not weaken the assertion.
 */
export async function memberRpcClient(page: Page): Promise<SupabaseClient> {
  const cookies = await page.context().cookies();
  const joined = cookies
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((c) => c.value)
    .join("");
  if (!joined) throw new Error("memberRpcClient: no sb auth cookie in context");
  const raw = joined.startsWith("base64-")
    ? Buffer.from(joined.slice("base64-".length), "base64").toString("utf8")
    : decodeURIComponent(joined);
  const session = JSON.parse(raw) as { access_token?: string };
  if (!session.access_token) throw new Error("memberRpcClient: no access_token in cookie");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("memberRpcClient needs staging env");
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-side cleanup of per-run content by title marker (cascades votes/rsvps/options). */
export async function cleanupCommunityContent(marker: string): Promise<void> {
  const db = serviceClient();
  for (const table of ["news", "events"] as const) {
    const { error } = await db.from(table).delete().like("title", `%${marker}%`);
    if (error) console.warn(`community cleanup ${table}: ${error.message}`);
  }
  const { error } = await db.from("polls").delete().like("question", `%${marker}%`);
  if (error) console.warn(`community cleanup polls: ${error.message}`);
}
