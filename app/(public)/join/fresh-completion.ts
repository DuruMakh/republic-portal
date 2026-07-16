/**
 * One-shot "just completed the funnel" marker (spec §3.2). Step 3 sets it right
 * before navigating to /join/done|/join/pending; those screens render only when
 * it is present and forward to the cabinet otherwise. peek/clear are separate
 * because React StrictMode double-invokes render-phase initializers — peeking
 * must not consume.
 */
export const FRESH_COMPLETION_KEY = "gr:fresh-completion";

export function markFreshCompletion(): void {
  try {
    sessionStorage.setItem(FRESH_COMPLETION_KEY, "1");
  } catch {
    // storage unavailable → the completion screens will forward to the cabinet
  }
}

export function peekFreshCompletion(): boolean {
  try {
    return sessionStorage.getItem(FRESH_COMPLETION_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearFreshCompletion(): void {
  try {
    sessionStorage.removeItem(FRESH_COMPLETION_KEY);
  } catch {
    // nothing to clear
  }
}
