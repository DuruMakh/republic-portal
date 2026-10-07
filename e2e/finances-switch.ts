import { showPublicFinances } from "../lib/public-finances";

/**
 * Whether this run expects the public finance surface (the /transparency page, its links and
 * the homepage dues figure) to be visible. It reads the same SHOW_PUBLIC_FINANCES switch the
 * app reads (ADR-034), so the specs and the server under test agree as long as both start from
 * one environment. CI sets nothing, so CI exercises the hidden mode; the visible-mode specs are
 * skipped, not deleted, and run again once the switch is on.
 */
export const FINANCES_PUBLIC = showPublicFinances();
