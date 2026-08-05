"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Shared sign-out (extracted from CabinetNav when MobileMoreSheet needed the
 * same behavior). Local scope signs out this device only — the default
 * 'global' would revoke every device's refresh token and force a fresh SMS-OTP
 * login elsewhere.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  return async function signOut() {
    try {
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      // best-effort: a local session may survive a network failure — the
      // cabinet layout gates re-check server truth on the next request anyway
    }
    router.push("/");
    router.refresh();
  };
}
