"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { runtimeCachesToClear } from "@/lib/sw-routes";

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
    try {
      // Security audit M3: nothing from this session stays in the phone's offline
      // copy. The precache (the offline page and icons) holds no personal data.
      if (typeof caches !== "undefined") {
        const names = runtimeCachesToClear(await caches.keys());
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch {
      // best-effort: the service worker's never-cache rule already keeps
      // signed-in and Supabase responses out of these caches
    }
    router.push("/");
    router.refresh();
  };
}
