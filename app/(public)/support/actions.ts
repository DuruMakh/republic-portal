"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_FAILURE, SUPPORT_INVALID_INPUT, SUPPORT_RATE_LIMITED } from "@/lib/support-copy";
import { clientIp, hashIp } from "@/lib/support-ip";
import { supportMessageSchema } from "@/lib/support-schemas";

export type SupportActionResult = { ok: true } | { ok: false; error: string };

/**
 * Why the service client, on a public page.
 *
 * The throttle's key is the caller's address hash, and the caller supplies it.
 * While EXECUTE was granted to `anon`, anyone holding the public key could
 * call the RPC directly and simply omit that argument, so the rate limit only
 * bound callers who chose to be bound. Postgres cannot tell "our server" from
 * "a browser with the same public key" — the only thing that can is a
 * credential the browser does not have. EXECUTE is now restricted to
 * service_role and this action is the sole caller, which is what the design
 * claimed from the start.
 *
 * The privilege is confined to this one RPC, which is `security definer` and
 * re-checks every rule before inserting into a single table. No user-supplied
 * value selects a table, a column or a row, so there is no path here that
 * reads anything back.
 */
export async function submitSupportMessageAction(input: unknown): Promise<SupportActionResult> {
  const parsed = supportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? SUPPORT_FAILURE };
  }

  const requestHeaders = await headers();
  const ipHash = hashIp(
    clientIp((name) => requestHeaders.get(name)),
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { error } = await createAdminClient().rpc("submit_support_message", {
    p_name: parsed.data.name,
    p_email: parsed.data.email ?? null,
    p_phone: parsed.data.phone ?? null,
    p_message: parsed.data.message,
    p_ip_hash: ipHash,
  });

  if (error) {
    // Distinguish the two the visitor can act on from the ones they cannot.
    // Telling someone to "try again" when the server rejected their payload
    // sends them to retry text that will fail identically every time.
    if (error.message.includes("too_many_requests")) {
      return { ok: false, error: SUPPORT_RATE_LIMITED };
    }
    if (error.message.includes("invalid_support_message")) {
      return { ok: false, error: SUPPORT_INVALID_INPUT };
    }
    return { ok: false, error: SUPPORT_FAILURE };
  }
  return { ok: true };
}
