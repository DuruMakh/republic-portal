import { showRatings } from "../lib/ratings-switch";

/**
 * Whether this run expects ratings (the /leaderboard page and its header link, the homepage top
 * five, a delegate's member count and rank, the delegate panel's place in the ranking) to be
 * visible. It reads the same SHOW_RATINGS switch the app reads (ADR-052), with the same caveats
 * as finances-switch.ts: build, server and runner must start from one environment. CI sets
 * nothing, so CI exercises the hidden mode; the shown-mode specs are skipped, not deleted, and
 * run again once the switch is on.
 */
export const RATINGS_SHOWN = showRatings();
