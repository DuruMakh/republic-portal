"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { useChromePathname } from "@/components/ChromePathname";
import { StickyBar } from "@/components/StickyBar";
import { useSignedIn } from "@/components/useSignedIn";
import { showsJoinCta } from "@/lib/mobile-nav";

// „შემოგვიერთდი“ is the shipped HEADER_CTA_LABEL from app/(public)/layout.tsx; the
// cabinet label is spliced from the reference bundle's CTA bar. No time or price line
// under the guest CTA, by owner decision (ADR-035).
const JOIN = "შემოგვიერთდი";
const CABINET = "ჩემი კაბინეტი →";

/**
 * The public sticky CTA (spec §4.5).
 *
 * The signed-in swap happens client-side AFTER mount, never on the server --
 * app/sw.ts runtime-caches same-origin HTML, so a server-rendered session
 * state would be handed to the next visitor. useSignedIn shares that behavior
 * with HeaderSessionAction; the guest CTA is the correct cached default.
 */
export function MobileJoinCta() {
  const pathname = useChromePathname();
  const signedIn = useSignedIn();

  // The hook above still subscribes on /join, /join/terms and /login, where this
  // renders nothing: hook rules put it before this guard. That is deliberate.
  // Gating the effect on the initial pathname instead would be worse — it has
  // [] deps, so a visitor who lands on /join and then navigates to / keeps the
  // same mounted instance and would never subscribe, leaving the bar stuck on
  // its guest state forever. The subscription is torn down on unmount, so the
  // cost is one idle listener on three routes, not a leak.
  if (!showsJoinCta(pathname)) return null;

  return (
    <StickyBar>
      <div className="px-5 pt-3 pb-3.5">
        {signedIn ? (
          <ButtonLink href="/me" size="lg" className="w-full">
            {CABINET}
          </ButtonLink>
        ) : (
          <ButtonLink href="/join" size="lg" className="w-full">
            {JOIN}
          </ButtonLink>
        )}
      </div>
    </StickyBar>
  );
}
