/** Where a member's dues and payment history live. */
export const BILLING_HREF = "/me/billing";

/**
 * Whether membership dues are shown anywhere: the cabinet's payments tab and page, the fee
 * step of the membership wizard, the bank-transfer details after it, the dues line on the
 * cabinet invitation, the payment reference in the profile header and the admin dues total.
 * Hidden unless SHOW_MEMBERSHIP_DUES is the word "true" (owner decision 2026-10-07, ADR-036:
 * nobody pays at this stage), so an unset or mistyped value never asks anyone for money.
 * Whitespace around the word is ignored, as for SHOW_PUBLIC_FINANCES.
 *
 * Server-side only, and deliberately not a NEXT_PUBLIC_ variable: read it where the page
 * renders and pass the result down.
 */
export function showMembershipDues(): boolean {
  return process.env.SHOW_MEMBERSHIP_DUES?.trim() === "true";
}

/** Drops the payments link from a cabinet nav list unless dues are shown. */
export function filterBillingLinks<T extends { href: string }>(
  links: readonly T[],
  duesShown: boolean,
): T[] {
  return duesShown ? [...links] : links.filter((link) => link.href !== BILLING_HREF);
}
