"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ButtonLink";
import { createClient } from "@/lib/supabase/client";

/**
 * Session-aware header action (spec §3.1). Renders „შესვლა“ in the cached shell
 * and swaps after mount — the public shell must stay session-agnostic because
 * the service worker precaches it (same reason the funnel fetches client-side).
 */
export function HeaderSessionAction() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setSignedIn(session !== null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(session !== null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return signedIn ? (
    <ButtonLink href="/me" variant="ghost" size="sm">
      კაბინეტი
    </ButtonLink>
  ) : (
    <ButtonLink href="/login" variant="ghost" size="sm">
      შესვლა
    </ButtonLink>
  );
}
