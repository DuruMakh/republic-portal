import type { Expectation, ProbeOutcome, SurfaceKind, Verdict } from "./types";

/**
 * Codes that mean "the caller was turned away". 42501 is a true authorization
 * denial; 42883/PGRST202 mean the function or its signature was not found,
 * which on the deny side is equally conclusive (nothing was reachable) but on
 * the allow side means OUR probe was malformed, not that the app is broken.
 */
const DENIED_BY_PRIVILEGE = "42501";
const NOT_FOUND_CODES = new Set(["42883", "PGRST202"]);

/**
 * Surfaces you CALL, as opposed to surfaces you READ. The distinction decides
 * what "no error, no rows" means, and it is the difference between finding a
 * privilege-escalation hole and filing it as inconclusive.
 */
const INVOCATION_KINDS = new Set<SurfaceKind>(["function", "action", "endpoint"]);

export function judge(expectation: Expectation, outcome: ProbeOutcome, kind: SurfaceKind): Verdict {
  const { errorCode, rowCount } = outcome;

  if (expectation === "deny") {
    if (errorCode !== null) {
      return errorCode === DENIED_BY_PRIVILEGE || NOT_FOUND_CODES.has(errorCode)
        ? "clear"
        : "needs-live-proof";
    }
    // No error means the grant exists and the caller got through.
    //
    // For an INVOCATION that is the whole story: most definer functions return
    // nothing — they record a payment, approve a delegate, close a poll. If the
    // call completed, the actor performed the act. Waiting for a returned row
    // before calling that a finding would bury the most dangerous class of hole
    // in the inconclusive pile.
    //
    // For a READ, zero rows is genuinely ambiguous: the filter may simply have
    // matched nothing for this actor's data. Pass 4 settles it by giving the
    // actor data that should match (Task 6, Step 2).
    if (INVOCATION_KINDS.has(kind)) return "finding";
    return rowCount > 0 ? "finding" : "needs-live-proof";
  }

  if (errorCode === null) return "clear";
  // Only a privilege denial is a real over-restriction finding. A missing
  // function or argument mismatch is a defect in the probe's argument table
  // (Task 7) and must never be reported to the owner as a security finding.
  return errorCode === DENIED_BY_PRIVILEGE ? "finding" : "needs-live-proof";
}
