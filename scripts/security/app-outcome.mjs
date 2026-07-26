/**
 * Task 8: normalising an APP-layer result into the ProbeOutcome vocabulary
 * `lib/security/verdict.ts` already grades.
 *
 * ## The problem this solves
 * A Server Action does not answer with a SQLSTATE. It answers with
 * `{ ok: false, error: "<Georgian sentence>" }`, because every action funnels
 * its failure through `mapFunnelError()` (lib/funnel.ts), which replaces the
 * database's `missing_role` / `invalid_target` / ... token with user-facing
 * Georgian before it ever leaves the server. `judge()` classifies on the token,
 * so the one field it needs is precisely the one the app destroys.
 *
 * ## Recovering the token: invert the LIVE function, never a copy of its table
 * `ERROR_MESSAGES` is module-private, so the obvious fix is to paste a copy of
 * it here -- and a pasted copy is a second source of truth that goes stale
 * silently, in the reassuring direction (an unrecognised message degrades to
 * "inconclusive", so nobody notices). Instead the inverse map is BUILT by
 * calling the real, exported `mapFunnelError()` once per candidate token and
 * recording what comes back. If a message is ever reworded, the inverse rewords
 * with it, in the same commit, with no action from anyone.
 *
 * The candidate list is `REFUSAL_TOKENS + POST_GATE_TOKENS` (exported from
 * verdict.ts, and themselves drift-guarded against the live migration text by
 * lib/security/verdict.tokens-drift.test.ts) plus the two tokens verdict.ts
 * deliberately leaves unclassified. Tokens with no `ERROR_MESSAGES` entry map to
 * the generic string and are dropped: the app cannot surface them distinctly, so
 * neither can this.
 *
 * Injectivity is ASSERTED at module load. Two tokens sharing one Georgian
 * sentence would make recovery a coin flip, and a coin flip on the deny side is
 * the difference between "clear" and "finding". Today there are 44 messages and
 * zero collisions; if that ever changes this module throws rather than guesses.
 *
 * ## The normalisation, stated exactly
 * These two codes are the ONLY ones `judge()` accepts as proof of a refusal, so
 * they are the only two an app-layer refusal may normalise onto:
 *
 *   null                  the caller GOT THROUGH -- the action returned ok:true,
 *                         or the endpoint served the thing it guards. On a deny
 *                         expectation judge() calls this a finding by itself,
 *                         which is the correct reading for an invocation.
 *
 *   "P0001" + <token>     a schema token was recovered from the Georgian. For
 *                         the ~33 actions that are thin wrappers this is
 *                         literally the database's own P0001 travelling through
 *                         mapFunnelError and back; nothing is invented. For the
 *                         five actions carrying an app-side `hasAnyRole`
 *                         precheck the SAME token (`missing_role`) was raised by
 *                         the app before the database was consulted -- the
 *                         refusal is equally real and means the same thing, and
 *                         the row records `refusedBy: "app-precheck"` so the two
 *                         are never conflated in evidence even though they grade
 *                         alike.
 *
 *   "42501"               a genuine privilege refusal with no schema token to
 *                         recover: the caller was identified and turned away by
 *                         a gate that answers in HTTP rather than in Postgres.
 *                         Used for exactly two things in this pass -- Storage's
 *                         RLS refusal on a bucket write, and the dev-OTP
 *                         endpoint's profile-exists gate withholding a code.
 *                         Both are "turned away by a real privilege check",
 *                         which is what verdict.ts's DENIED_BY_PRIVILEGE means;
 *                         the code is a vocabulary, not a claim that Postgres
 *                         raised it. Every such row carries the raw HTTP status
 *                         and payload in `raw` so the normalisation can be
 *                         re-checked against the evidence rather than trusted.
 *
 * Everything else normalises onto a code `judge()` does NOT recognise, and so
 * lands on `needs-live-proof`:
 *
 *   "APP-GENERIC"         the action returned GENERIC_FUNNEL_ERROR. That string
 *                         means "a zod parse failed, or the database said
 *                         something unmapped" -- it is the app admitting it does
 *                         not know either. It must never clear a deny
 *                         expectation: a probe whose ARGUMENTS were wrong
 *                         returns exactly this, and would otherwise be
 *                         indistinguishable from a defence.
 *   "APP-UNMAPPED"        an `ok:false` whose Georgian is not in the inverse map
 *                         (a hardcoded per-action string, or a zod issue
 *                         message).
 *   "HTTP-<status>"       the request never produced an action result at all.
 *   "THROWN"              the probe itself failed (transport, timeout).
 *
 * The asymmetry is deliberate and is the whole safety property: a specific,
 * named refusal can clear a deny expectation; "an error happened" cannot.
 */
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "../../lib/funnel.ts";
import { REFUSAL_TOKENS, POST_GATE_TOKENS } from "../../lib/security/verdict.ts";

/**
 * verdict.ts leaves these two unclassified on purpose (the same text means a
 * caller-standing gate in the member RPCs and a target-state validation in the
 * admin ones). They are still worth RECOVERING -- a row that records
 * `not_completed` says far more than one that records "unmapped" -- they simply
 * will not resolve a verdict, which is verdict.ts's call to make, not this
 * module's.
 */
const UNCLASSIFIED_TOKENS = ["not_completed", "profile_incomplete"];

function buildInverse() {
  const inverse = new Map();
  const seen = new Map();
  const candidates = [...REFUSAL_TOKENS, ...POST_GATE_TOKENS, ...UNCLASSIFIED_TOKENS];
  for (const token of candidates) {
    const ka = mapFunnelError(token);
    if (ka === GENERIC_FUNNEL_ERROR) continue; // no ERROR_MESSAGES entry: not surfaceable
    if (inverse.has(ka)) {
      throw new Error(
        `app-outcome.mjs: mapFunnelError is not injective over the classified tokens -- ` +
          `"${seen.get(ka)}" and "${token}" both render as ${JSON.stringify(ka)}. ` +
          "Recovering a token from a message would be a coin flip, and on the deny side that is " +
          "the difference between `clear` and `finding`. Refusing to run.",
      );
    }
    inverse.set(ka, token);
    seen.set(ka, token);
  }
  if (inverse.size === 0) {
    throw new Error("app-outcome.mjs: inverse map is empty -- lib/funnel.ts changed shape");
  }
  return inverse;
}

/** Georgian sentence -> the schema token that produced it. */
export const MESSAGE_TO_TOKEN = buildInverse();

/** Every token this module can recover (for the harness's own self-check). */
export const RECOVERABLE_TOKENS = new Set(MESSAGE_TO_TOKEN.values());

/**
 * A Server Action's `{ ok, error }` -> ProbeOutcome.
 * `raw` carries the untouched evidence: status, the exact `error` string, and
 * whether an app-side precheck rather than the database produced it.
 */
export function outcomeFromActionResult(result, raw) {
  if (result && result.ok === true) {
    return { errorCode: null, errorMessage: null, rowCount: 1, raw };
  }
  const message = result?.error;
  if (typeof message !== "string") {
    return {
      errorCode: "APP-UNMAPPED",
      errorMessage: `action returned no recognisable result: ${JSON.stringify(result)?.slice(0, 300)}`,
      rowCount: 0,
      raw,
    };
  }
  if (message === GENERIC_FUNNEL_ERROR) {
    return {
      errorCode: "APP-GENERIC",
      errorMessage:
        "GENERIC_FUNNEL_ERROR -- a zod parse failure or an unmapped database error. " +
        "Deliberately not gradeable: a probe with wrong arguments returns exactly this.",
      rowCount: 0,
      raw,
    };
  }
  const token = MESSAGE_TO_TOKEN.get(message);
  if (!token) {
    return {
      errorCode: "APP-UNMAPPED",
      errorMessage: `unmapped action error (hardcoded string or zod issue): ${message}`,
      rowCount: 0,
      raw,
    };
  }
  return { errorCode: "P0001", errorMessage: token, rowCount: 0, raw };
}

/** A transport-level outcome: the request never produced an action result. */
export function outcomeFromTransport(status, detail, raw) {
  return { errorCode: `HTTP-${status}`, errorMessage: detail, rowCount: 0, raw };
}

/** A genuine privilege refusal with no schema token to recover. See the header. */
export function outcomeDeniedByPrivilege(detail, raw) {
  return { errorCode: "42501", errorMessage: detail, rowCount: 0, raw };
}

/** The caller got through. */
export function outcomeAdmitted(rowCount, raw) {
  return { errorCode: null, errorMessage: null, rowCount, raw };
}
