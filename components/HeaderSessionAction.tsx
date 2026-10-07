"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { useSignedIn } from "@/components/useSignedIn";

/**
 * The header's single account action (spec §3.1). Guests get the join door, labelled by the
 * layout: /join and /login both continue with Google and send a registered member straight
 * to their cabinet, so one button serves new and returning people alike. After mount a
 * signed-in visitor gets the cabinet link in the same slot, with the same variant and size,
 * so the swap never changes the button's shape. useSignedIn keeps the cached shell
 * session-agnostic: guest is always the server-rendered default.
 */
export function HeaderSessionAction({ joinLabel }: { joinLabel: string }) {
  const signedIn = useSignedIn();

  return signedIn ? (
    <ButtonLink href="/me" size="sm">
      კაბინეტი
    </ButtonLink>
  ) : (
    <ButtonLink href="/join" size="sm">
      {joinLabel}
    </ButtonLink>
  );
}
