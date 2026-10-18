"use client";
import { useCopy } from "@/lib/i18n/copy";

import Image from "next/image";
import { useLocale } from "next-intl";
import { localePath } from "@/lib/i18n/routing";
import { useState } from "react";
import { safeAuthNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

const OAUTH_FAILURE_MESSAGE = "Google-ით შესვლა ვერ მოხერხდა — სცადეთ თავიდან.";

export function GoogleAuthButton({ nextPath, label }: { nextPath: string; label: string }) {
  const t = useCopy();
  const locale = useLocale() === "en" ? "en" : "ka";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function startGoogleOAuth() {
    setPending(true);
    setError(undefined);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", localePath(safeAuthNext(nextPath), locale));
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
        className="flex h-[58px] w-full cursor-pointer items-center justify-center gap-3.5 border border-ink bg-chalk px-6 text-[16px] font-semibold text-ink no-underline transition-colors hover:bg-ink hover:text-limestone disabled:pointer-events-none disabled:opacity-60 min-[900px]:h-16 min-[900px]:text-[17px]"
      >
        <Image
          src="/brand/google-g.png"
          alt=""
          aria-hidden="true"
          data-testid="google-mark"
          width={20}
          height={20}
        />
        <span>{t(label)}</span>
      </button>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {t(error ?? "")}
        </p>
      ) : null}
    </div>
  );
}
