"use client";

import Image from "next/image";
import { useState } from "react";
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
      <button
        type="button"
        onClick={startGoogleOAuth}
        disabled={pending}
        aria-busy={pending}
        className="relative inline-flex min-h-[48px] w-full items-center justify-center border border-[#747775] bg-white px-12 text-[0.9rem] font-medium text-[#1f1f1f] no-underline transition-colors hover:bg-[#f8f9fa] disabled:pointer-events-none disabled:opacity-60"
      >
        <Image
          src="/brand/google-g.png"
          alt=""
          aria-hidden="true"
          data-testid="google-mark"
          width={20}
          height={20}
          className="absolute left-3"
        />
        <span>{label}</span>
      </button>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
