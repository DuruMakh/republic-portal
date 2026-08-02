"use server";

import { headers } from "next/headers";
import { SUPPORT_FAILURE, SUPPORT_RATE_LIMITED } from "@/lib/support-copy";
import { hashIp } from "@/lib/support-ip";
import { supportMessageSchema } from "@/lib/support-schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export type SupportActionResult = { ok: true } | { ok: false; error: string };

export async function submitSupportMessageAction(input: unknown): Promise<SupportActionResult> {
  const parsed = supportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? SUPPORT_FAILURE };
  }

  const requestHeaders = await headers();
  const ipHash = hashIp(
    requestHeaders.get("x-forwarded-for"),
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("submit_support_message", {
    p_name: parsed.data.name,
    p_email: parsed.data.email ?? null,
    p_phone: parsed.data.phone ?? null,
    p_message: parsed.data.message,
    p_ip_hash: ipHash,
  });

  if (error) {
    // The throttle is the one failure a visitor can act on, so it is the one
    // that gets its own line; everything else is an honest generic failure.
    if (error.message.includes("too_many_requests")) {
      return { ok: false, error: SUPPORT_RATE_LIMITED };
    }
    return { ok: false, error: SUPPORT_FAILURE };
  }
  return { ok: true };
}
