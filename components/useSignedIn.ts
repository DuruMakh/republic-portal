"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side session presence shared by the cached public-shell actions.
 * Guest is the initial state because app/sw.ts runtime-caches same-origin HTML;
 * resolving a session on the server could expose one visitor's state to the
 * next visitor served that shell.
 */
export function useSignedIn(): boolean {
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

  return signedIn;
}
