import { showEnglish } from "../lib/english-switch";

/**
 * Whether this run expects the English version (the /en pages, the KA / EN language switch) to be
 * visible. It reads the same SHOW_ENGLISH switch the app reads (owner decision 2026-10-20), with
 * the same caveats as finances-switch.ts: build, server and runner must start from one
 * environment. CI sets nothing, so CI exercises the hidden mode; the English specs are skipped,
 * not deleted, and run again once the switch is on.
 */
export const ENGLISH_SHOWN = showEnglish();
