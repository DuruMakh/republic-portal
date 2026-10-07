import { showPublicFinances } from "../lib/public-finances";

/**
 * Whether this run expects the public finance surface (the /transparency page, its links and
 * the homepage dues figure) to be visible. It reads the same SHOW_PUBLIC_FINANCES switch the
 * app reads (ADR-034), so the specs and the server under test agree only when the build, the
 * server and this runner all start from one environment: pages built ahead of time bake the
 * switch in at build time, and a value that lives only in .env.local reaches the runner only
 * through `node --env-file`. CI sets nothing, so CI exercises the hidden mode; the visible-mode
 * specs are skipped, not deleted, and run again once the switch is on.
 */
export const FINANCES_PUBLIC = showPublicFinances();
