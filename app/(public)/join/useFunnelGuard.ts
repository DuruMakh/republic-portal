"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { canAccess, deriveFunnelStep, funnelRoute, type FunnelState, type FunnelStep } from "@/lib/funnel";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side funnel guard (spec §3.8): fetch state on mount, redirect when this
 * screen isn't accessible for the current state. Never a server redirect — cached
 * shells stay valid. state === null (with ready) means signed out.
 */
export function useFunnelGuard(step: FunnelStep): {
  state: FunnelState | null;
  ready: boolean;
  refresh: () => Promise<FunnelState | null>;
} {
  const router = useRouter();
  const [state, setState] = useState<FunnelState | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async (): Promise<FunnelState | null> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState(null);
      return null;
    }
    const { data, error } = await supabase.rpc("funnel_state");
    if (error || data === null) {
      setState(null);
      return null;
    }
    const next = data as FunnelState;
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().then((fetched) => {
      if (cancelled) return;
      if (fetched === null) {
        // signed out: only step 1 (and the choice screen, which doesn't guard) works
        if (step !== "step-1") router.replace("/join/step-1");
      } else if (!canAccess(step, fetched)) {
        router.replace(funnelRoute(deriveFunnelStep(fetched)));
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, router, step]);

  return { state, ready, refresh };
}
