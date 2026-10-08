import { showEvents } from "../lib/events-switch";

/**
 * Whether this run expects events (the /events pages, their links, the cabinet events tab and
 * page, the delegate panel's team-RSVP card, the admin events editor) to be visible. It reads
 * the same SHOW_EVENTS switch the app reads (ADR-042), with the same caveats as
 * finances-switch.ts: build, server and runner must start from one environment. CI sets
 * nothing, so CI exercises the hidden mode; the shown-mode specs are skipped, not deleted, and
 * run again once the switch is on.
 */
export const EVENTS_SHOWN = showEvents();
