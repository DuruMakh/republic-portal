import type { Expectation, ProbeOutcome, SurfaceKind, Verdict } from "./types";

/**
 * The only code that means "the caller was turned away by a real privilege
 * check". 42883 (undefined function) and PGRST202 (function absent from
 * PostgREST's schema cache) mean no function/signature by that name was
 * found — and since every surface in the manifest comes from live
 * introspection (Task 3) and therefore definitely exists, a not-found code
 * can only mean OUR call was malformed (wrong argument list, a typo in the
 * probe's argument table — Task 7), never that the app correctly refused the
 * actor. That holds on BOTH sides: on the allow side it obviously isn't a
 * finding, but on the deny side it is not proof of denial either — treating
 * it as "clear" would silently launder a probe defect into a false all-clear
 * on exactly the surfaces this audit exists to check. So only 42501 clears a
 * deny expectation; a not-found code always defers to needs-live-proof,
 * same as any other unexpected error.
 */
const DENIED_BY_PRIVILEGE = "42501";

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
      return errorCode === DENIED_BY_PRIVILEGE ? "clear" : "needs-live-proof";
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
