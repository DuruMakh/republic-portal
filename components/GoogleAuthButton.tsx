"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { safeAuthNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

const OAUTH_FAILURE_MESSAGE = "Google-ით შესვლა ვერ მოხერხდა — სცადეთ თავიდან.";

export function GoogleAuthButton({ nextPath, label }: { nextPath: string; label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function startGoogleOAuth() {
    setPending(true);
    setError(undefined);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", safeAuthNext(nextPath));
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      });
      if (!oauthError) return;
    } catch {
      // The person only needs a safe retry message; provider details stay private.
    }

    setError(OAUTH_FAILURE_MESSAGE);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={startGoogleOAuth} disabled={pending}>
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
