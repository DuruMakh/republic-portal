"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { useSignedIn } from "@/components/useSignedIn";

/**
 * Session-aware header action (spec §3.1). Renders „შესვლა“ in the cached shell
 * and swaps after mount. useSignedIn keeps the cached shell session-agnostic.
 */
export function HeaderSessionAction() {
  const signedIn = useSignedIn();

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
