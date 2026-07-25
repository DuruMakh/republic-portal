/**
 * Task 4: the probe runner and ledger.
 *
 * For every surface in scripts/security/manifest.json (152) crossed with
 * every actor in ACTOR_IDS (12) -- 1,824 cells -- attempt access exactly the
 * way an attacker's own client would (straight to PostgREST, the app's UI
 * never involved, using the JWT actors.mjs minted), record what happened,
 * and judge it against that actor's expected access. This is a MATRIX, not
 * a sample: every cell gets a row in the ledger, including the ones this
 * task cannot yet resolve (`needs-live-proof`) or does not yet attempt
 * (kinds owned by Tasks 6 and 8).
 *
 * ## The runner records; it never throws.
 * A probe that errors is data, not a failure -- that is the entire point of
 * an audit like this. The only two conditions that abort the whole run are
 * a missing manifest and a failed actor mint (provisionActors() itself
 * throws for that; nothing here adds a third during probing). A third kind
 * of failure DOES throw, deliberately, after every row is already safely on
 * disk: the self-check at the bottom of this file. See its own comment for
 * why that is not a contradiction of "never throws".
 *
 * ## Judging happens in this same process, via direct .ts import
 * lib/security/{verdict,expectations}.ts are TypeScript; this runner is
 * plain .mjs. scripts/security/introspect.mjs already imports
 * lib/security/manifest.ts directly and it works on this machine (Node
 * v24.14.0 strips erasable TypeScript syntax with no flag and no build
 * step -- confirmed by that script's own successful `npm run
 * security:introspect` runs, and re-confirmed here: see the self-check
 * below, which would fail loudly if the imported `judge` were somehow not
 * the real thing). This runner reuses exactly that pattern for `judge`,
 * `defaultExpectation` and `isRuleDerived` rather than building the brief's
 * alternative two-file pipeline (raw ledger + a separate vitest-run
 * TypeScript judging step) -- the judgement logic still lives in exactly
 * ONE tested place (lib/security/verdict.ts, exercised by verdict.test.ts
 * and verdict.tokens-drift.test.ts) either way; direct import just avoids a
 * second file and a second script for no benefit here, and needs no
 * --experimental-strip-types flag on this Node version.
 *
 * CAVEAT for whoever runs this on a different machine: package.json
 * declares only `"node": ">=22"`, and unflagged type stripping was NOT
 * default-on across every 22.x point release (it shipped experimental,
 * behind --experimental-strip-types, in 22.6; only later did a no-flag
 * default ship). On an old 22.x point release the two `.ts` imports below
 * throw immediately at startup with a clear syntax/module error. The fix is
 * a current Node, not adding the experimental flag back as a workaround --
 * that would mask the version gap instead of surfacing it. (Also cosmetic:
 * because package.json has no top-level "type" field, Node prints a
 * one-line MODULE_TYPELESS_PACKAGE_JSON warning to stderr when it strips
 * the first `.ts` file. Harmless, same as introspect.mjs already does --
 * see task-3-report.md -- not worth changing package.json's "type" for.)
 *
 * ## Never `db`, never as a probe actor
 * The service-role client is not even imported into this file -- only
 * ACTOR_IDS / provisionActors / actorClient come from ./actors.mjs, never
 * `db`. `db` bypasses every check by design; using it as one of the twelve
 * "actors" would report every surface as reachable, a false all-clear
 * across the entire audit. Making the import list itself omit `db` means
 * that mistake cannot happen by accident here, not merely "is discouraged".
 *
 * ## Two `function` surfaces are deliberately not invoked with {}
 * See MUTATING_ZERO_ARG_FUNCTIONS below for exactly which two and why.
 *
 * ## `outcome.errorCode` carries three load-bearing sentinel values
 * `verdict` alone conflates three different reasons a row can land on
 * `needs-live-proof`: a kind this task doesn't probe at all yet, one of the
 * two mutating functions this task deliberately didn't invoke, and a
 * surface that WAS genuinely probed but came back inconclusive (mostly a
 * PGRST202 argument mismatch, to be resolved by Task 7's real arguments).
 * Tasks 6, 8 and 9 need to tell these apart, and `verdict` alone cannot --
 * the only field that does is `outcome.errorCode`:
 *   - "SKIP"          -- kind not probed this task (policy / trigger /
 *                         action / endpoint / bucket -- see
 *                         NOT_YET_PROBED_KINDS below)
 *   - "SKIP-MUTATING" -- one of the two functions in
 *                         MUTATING_ZERO_ARG_FUNCTIONS below, deliberately
 *                         not invoked
 *   - anything else (a real Postgres/PostgREST code, or null) -- a probe
 *                         that actually ran
 * These two strings are a stable contract other tasks may key on, not an
 * incidental debug label -- filtering on `verdict === "needs-live-proof"`
 * without also branching on `outcome.errorCode` silently treats all three
 * populations as one.
 *
 * Run: node --env-file=.env.local scripts/security/probe.mjs
 * (also wired as: npm run security:census)
 */
import { dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACTOR_IDS, provisionActors, actorClient } from "./actors.mjs";
import { judge, REFUSAL_TOKENS, POST_GATE_TOKENS } from "../../lib/security/verdict.ts";
import { defaultExpectation, isRuleDerived } from "../../lib/security/expectations.ts";

const MANIFEST_URL = new URL("./manifest.json", import.meta.url);
const LEDGER_RAW_URL = new URL("../../docs/security/ledger-raw.json", import.meta.url);
const LEDGER_URL = new URL("../../docs/security/ledger.json", import.meta.url);

// SurfaceKinds this task does not probe at all -- Tasks 6 (policy, trigger)
// and 8 (action, endpoint, bucket) own them. Recorded with a distinct,
// clearly-marked outcome (errorCode "SKIP") so nobody downstream mistakes
// an unprobed surface for a cleared one.
const NOT_YET_PROBED_KINDS = new Set(["policy", "trigger", "action", "endpoint", "bucket"]);

/**
 * Exactly two of the manifest's 54 `function` surfaces are BOTH callable
 * with `{}` (every parameter optional or absent) AND perform a live write
 * when they run:
 *
 *   - request_delegacy() -- `grant execute on function request_delegacy()
 *     to authenticated` (supabase/migrations/20260722140000_r2_review_fixes.sql:142).
 *     Creates a real `delegates` row (status='pending') for any caller whose
 *     profile is already profile_completed-or-above and who doesn't have a
 *     delegates row yet.
 *   - member_change_delegate(uuid default null) -- `grant execute ... to
 *     authenticated` (same file, line 194). Closes/reopens `memberships`
 *     rows for the caller; a no-op only when the (defaulted-null) target
 *     already equals their current delegate.
 *
 * Six of the twelve actors -- A4, A5, A9, A10, A11, A12 -- are
 * profile_completed-or-above with no delegates row today (A6/A7/A8 already
 * have one, so for them request_delegacy() would only hit the harmless
 * `delegacy_exists` post-gate refusal, not a new row). Calling
 * request_delegacy() for real would therefore CREATE a live delegate
 * application for each of those six. A9-A12 are the four CANONICAL staging
 * admins (scripts/seed-staging.mjs owns them, per actors.mjs's own header
 * comment -- they are explicitly outside this audit's AUDIT_TAG sweep) --
 * mutating them is not this task's fixture to spend.
 *
 * The other SIXTEEN zero/all-default-arg functions in the schema ARE
 * invoked for real below (nothing else is excluded) -- but "invoked for
 * real and it came back an error" does not mean the same thing for all
 * sixteen. There are three distinct groups here, confirmed by reading each
 * one, not assumed by pattern-matching the first result:
 *
 *   GROUP A -- revoked from every client role, sealed at the DB layer (6):
 *   active_grace_days(), active_coverage(uuid), recompute_member_active(uuid),
 *   recompute_all_active(), active_sweep() are all `revoke execute ... from
 *   public, anon, authenticated` (supabase/migrations/20260717150000_admin_crm.sql
 *   -- line 77 active_grace_days, line 94 active_coverage, line 117
 *   recompute_member_active, line 137 recompute_all_active, line 165
 *   active_sweep). Only two of those five carry an explicit re-grant --
 *   recompute_all_active to service_role (line 139: "the seed script
 *   (service role) runs the full recompute after inserting payments") and
 *   active_sweep to service_role (line 166: "-- probes exercise it");
 *   active_grace_days, active_coverage and recompute_member_active carry NO
 *   grant to anything at all, relying on being called only from inside
 *   other SECURITY DEFINER bodies (active_sweep and recompute_all_active
 *   both call active_coverage and active_grace_days internally), same
 *   pattern as tbilisi_today() below. Either way none of the twelve actors
 *   hold service_role, so Postgres refuses all five at the GRANT layer
 *   before the body ever runs. tbilisi_today() is sealed the identical way
 *   -- `revoke execute on function tbilisi_today() from public, anon,
 *   authenticated` (20260718100000_admin_crm_hardening.sql:31), no grant to
 *   anything, called only internally -- and is grouped here, NOT with
 *   Group B below despite also being a simple read: live result is real
 *   42501 for all twelve actors including the four admins, confirmed
 *   against the ledger, not the not_authenticated-gated pattern Group B
 *   uses. Six functions, six real 42501s, zero mutation risk.
 *
 *   GROUP B -- granted to authenticated, gated inside the body, confirmed
 *   pure reads (6): cabinet_state(), delegate_panel(), delegate_team(),
 *   delegate_team_rsvps(), is_registered(), is_completed_member() -- each
 *   read by body (no insert/update/delete anywhere in any of them), gated
 *   by the usual not_authenticated / not_a_delegate / not_approved chain.
 *   Being called for real is the entire point of probing these -- e.g.
 *   whether A1 (anonymous) can reach cabinet_state() at all is exactly the
 *   kind of finding this audit exists to catch.
 *
 *   GROUP C -- DB-level reachable, API-gateway-level filtered, NOT the same
 *   kind of safe as A or B (4): audit_log_immutable(), set_updated_at(),
 *   enforce_delegate_completed(), protect_profile_columns() all `returns
 *   trigger`, and NOTHING in any migration revokes their EXECUTE grant --
 *   confirmed by grepping every migration for each of the four names next
 *   to "grant"/"revoke": zero hits. Postgres grants EXECUTE on every
 *   newly-created function to PUBLIC by default (unlike tables, which get
 *   no such default), so `anon` and `authenticated` DO hold real, unrevoked,
 *   database-level permission to call all four of these right now. All 48
 *   cells (4 functions x 12 actors) came back PGRST202, confirmed against
 *   the live ledger, no exceptions -- but that is PostgREST filtering
 *   trigger-returning functions out of its RPC-callable schema cache, an
 *   API-GATEWAY behaviour, not a database control. Group A is refused by
 *   Postgres itself before the body ever runs; Group C is never even
 *   reached by PostgREST's routing, and the GRANT underneath would allow it
 *   if it were. This is not filed away as "safe" -- two of these four,
 *   audit_log_immutable (enforces the append-only audit log) and
 *   protect_profile_columns (enforces that status/personal_id/phone/id are
 *   server-managed), are precisely the functions this schema relies on to
 *   enforce its two strongest controls, and this task's own result only
 *   establishes that PostgREST's function-type filtering is the CURRENT
 *   backstop for all four -- not that the backstop is by design, or that it
 *   would hold if this app ever gained a second API surface onto the same
 *   database. Recorded as a candidate finding for Pass 4 (Task 10), tracked
 *   there, not resolved here.
 *
 * send_sms_hook(event jsonb) is the one non-zero-arg function worth naming
 * for contrast: it takes a required argument (PGRST202 regardless of who
 * calls it) AND is granted only to supabase_auth_admin, no client role at
 * all (initial_schema.sql:137-138) -- doubly inert, unlike Group C.
 *
 * The two mutating functions above are therefore excluded from real
 * invocation and recorded with a DISTINCT outcome (errorCode
 * "SKIP-MUTATING") -- never folded into the generic NOT_YET_PROBED_KINDS
 * skip, because these ARE function-kind surfaces this task owns; they are
 * deferred specifically because Task 7 already exists to probe every
 * function with deliberate, controlled arguments ("Tasks 6-7 supply real
 * arguments per function" -- brief), and that task can budget fixture
 * cleanup the way Task 1's driveStandings() does. Blind {} invocation here
 * would contaminate exactly the fixture state every other script in this
 * audit goes out of its way to keep clean and RPC-driven -- actors.mjs's
 * own header comment: "never by hand-writing rows with the service role".
 * Task 4 must not be the one script in the family that skips that
 * discipline in the opposite direction (an accidental REAL write instead of
 * an accidental service-role write).
 */
const MUTATING_ZERO_ARG_FUNCTIONS = new Set(["request_delegacy", "member_change_delegate"]);

async function probe(client, surface) {
  try {
    if (surface.kind === "view" || surface.kind === "table") {
      const { data, error } = await client.from(surface.name).select("*").limit(5);
      return {
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        rowCount: data?.length ?? 0,
      };
    }
    if (surface.kind === "function") {
      if (MUTATING_ZERO_ARG_FUNCTIONS.has(surface.name)) {
        return {
          errorCode: "SKIP-MUTATING",
          errorMessage:
            `${surface.name} takes only optional/defaulted arguments and performs a live write when ` +
            "invoked; deliberately not called with {} here to avoid mutating real actor/admin fixture " +
            "state (see MUTATING_ZERO_ARG_FUNCTIONS in this file). Deferred to Task 7's controlled, " +
            "real-argument pass.",
          rowCount: 0,
        };
      }
      // NOTE: errorMessage below is PostgREST's raw `error.message`, passed
      // through with zero transformation -- no wrap, prefix, or trim. See
      // the self-check near the bottom of this file for why that matters
      // and how it's proven, not just asserted in a comment.
      const { data, error } = await client.rpc(surface.name, {});
      return {
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        rowCount: Array.isArray(data) ? data.length : data == null ? 0 : 1,
      };
    }
    return {
      errorCode: "SKIP",
      errorMessage: `${surface.kind} probed in a later task`,
      rowCount: 0,
    };
  } catch (err) {
    return { errorCode: "THROWN", errorMessage: String(err), rowCount: 0 };
  }
}

function loadManifest() {
  if (!existsSync(MANIFEST_URL)) {
    throw new Error(
      "scripts/security/manifest.json does not exist yet -- run " +
        "`node --env-file=.env.local scripts/security/introspect.mjs --write` (Task 3) first. " +
        "This is one of the runner's two fatal conditions (the other is a failed actor mint).",
    );
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_URL, "utf8"));
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error(
      "scripts/security/manifest.json exists but is not a non-empty array -- refusing to run.",
    );
  }
  return manifest;
}

/**
 * Self-check: prove PostgREST's raw error message reached judge() with zero
 * mutation, all the way through this file's own JSON write + re-read.
 *
 * Why this exists (C3 in the phase progress ledger, .superpowers/sdd/
 * progress.md): judge()'s P0001 token match is EXACT-STRING
 * (REFUSAL_TOKENS.has(...) / POST_GATE_TOKENS.has(...) in
 * lib/security/verdict.ts), never a substring or regex sweep. If this
 * runner wrapped, prefixed, trimmed, or in any way altered the message on
 * its way from the Supabase client's `error.message` into the ledger, every
 * token would silently stop matching and every P0001 row would silently
 * degrade to needs-live-proof -- a SAFE direction, but a SILENT one, and
 * nothing downstream would notice on its own. This function turns that
 * "would silently degrade" risk into a loud, checked assertion instead.
 *
 * Two things are checked, and both must hold:
 *   1. Round-trip fidelity: every row written to ledger-raw.json, read back
 *      off disk, must have byte-identical outcome.errorMessage to the
 *      in-memory row that produced it, AND re-running judge() on the
 *      disk-read row (using the SAME imported judge(), looking `kind` up
 *      from the manifest by surfaceId -- the exact mechanism Task 6/7/8
 *      will also have to use, since LedgerRow itself carries no `kind`)
 *      must reproduce the exact verdict this run already computed in
 *      memory.
 *   2. Positive proof, not just absence-of-mutation: at least one LIVE
 *      P0001 row this run actually produced must carry a message that is a
 *      byte-exact member of judge()'s own REFUSAL_TOKENS/POST_GATE_TOKENS
 *      sets. Check 1 alone could pass vacuously on a run where the token
 *      branch was never exercised at all (e.g. if every P0001 message this
 *      run happened to be unrecognised); this closes that gap by requiring
 *      real evidence that the classifier actually fired against real
 *      PostgREST output, not just structurally-valid fixtures.
 *
 * Deliberately throws (unlike probe() itself) if either check fails: by the
 * time this runs, both ledger files are already safely on disk, so nothing
 * is lost -- a thrown error here means "the files exist but do not carry
 * the guarantee the rest of the audit depends on", which must stop the run
 * loudly, not be swallowed the way a single probe's own error is.
 */
function runSelfCheck(rawRows, ledgerRows, surfaceById) {
  console.log("\nSelf-check: raw-message integrity + judge() determinism...");

  const diskRawRows = JSON.parse(readFileSync(LEDGER_RAW_URL, "utf8"));
  if (diskRawRows.length !== rawRows.length) {
    throw new Error(
      `SELF-CHECK FAILED: wrote ${rawRows.length} raw rows but read back ${diskRawRows.length} -- ` +
        "the ledger is corrupt. Do not trust ledger.json from this run.",
    );
  }

  let messageMismatches = 0;
  let verdictMismatches = 0;
  for (let i = 0; i < rawRows.length; i++) {
    const memRow = rawRows[i];
    const diskRow = diskRawRows[i];

    if (memRow.outcome.errorMessage !== diskRow.outcome.errorMessage) {
      messageMismatches++;
      console.error(
        `  MESSAGE MUTATED in the write/read round-trip at row ${i} (${memRow.surfaceId} / ${memRow.actor}): ` +
          `in-memory ${JSON.stringify(memRow.outcome.errorMessage)} vs on-disk ${JSON.stringify(diskRow.outcome.errorMessage)}`,
      );
    }

    const surface = surfaceById.get(diskRow.surfaceId);
    if (!surface) {
      throw new Error(
        `SELF-CHECK FAILED: ledger-raw.json row ${i} names unknown surfaceId ${diskRow.surfaceId}`,
      );
    }
    const replayedVerdict = judge(diskRow.expectation, diskRow.outcome, surface.kind);
    const liveVerdict = ledgerRows[i].verdict;
    if (replayedVerdict !== liveVerdict) {
      verdictMismatches++;
      console.error(
        `  VERDICT NOT REPRODUCIBLE from the on-disk raw ledger at row ${i} (${diskRow.surfaceId} / ${diskRow.actor}): ` +
          `live judge()=${liveVerdict}, replayed-from-disk judge()=${replayedVerdict}`,
      );
    }
  }

  const p0001Rows = ledgerRows.filter(
    (r) => r.outcome.errorCode === "P0001" && r.outcome.errorMessage !== null,
  );
  const classifiedP0001Rows = p0001Rows.filter(
    (r) =>
      REFUSAL_TOKENS.has(r.outcome.errorMessage) || POST_GATE_TOKENS.has(r.outcome.errorMessage),
  );
  const classifiedAndResolved = classifiedP0001Rows.filter((r) => r.verdict !== "needs-live-proof");

  if (messageMismatches > 0 || verdictMismatches > 0) {
    throw new Error(
      `SELF-CHECK FAILED: ${messageMismatches} message mismatch(es), ${verdictMismatches} verdict ` +
        "mismatch(es) -- see the lines above. The raw-message-integrity guarantee is violated; " +
        "ledger.json from this run cannot be trusted.",
    );
  }
  if (classifiedP0001Rows.length === 0) {
    throw new Error(
      "SELF-CHECK FAILED: zero live P0001 rows matched a known REFUSAL_TOKENS/POST_GATE_TOKENS entry -- " +
        "the token-classification path was never exercised this run, so the round-trip check above proves " +
        "nothing about whether a real refusal message would survive. Investigate before trusting ledger.json.",
    );
  }

  console.log(
    `  OK: ${rawRows.length}/${rawRows.length} messages survived the write/read round-trip byte-for-byte.`,
  );
  console.log(
    `  OK: ${rawRows.length}/${rawRows.length} verdicts are reproducible from the on-disk raw ledger.`,
  );
  console.log(
    `  OK: ${classifiedP0001Rows.length} live P0001 row(s) matched a known token ` +
      `(${classifiedAndResolved.length} resolved to clear/finding; the rest are the not_authenticated ` +
      "carve-out on the allow side, which is correct, not a gap -- see verdict.ts's NO_SESSION_TOKEN).",
  );
}

function printSummary(ledgerRows, manifest) {
  const byVerdict = { clear: 0, finding: 0, "needs-live-proof": 0 };
  let ruleDerivedFindings = 0;
  let explicitFindings = 0;
  let notYetProbed = 0;
  let mutatingDeferred = 0;
  let genuineInconclusive = 0;

  const byKind = new Map();
  for (const s of manifest) {
    byKind.set(s.kind, { total: 0, clear: 0, finding: 0, "needs-live-proof": 0 });
  }

  const surfaceById = new Map(manifest.map((s) => [s.id, s]));
  for (const row of ledgerRows) {
    byVerdict[row.verdict]++;
    const kind = surfaceById.get(row.surfaceId).kind;
    const kindStats = byKind.get(kind);
    kindStats.total++;
    kindStats[row.verdict]++;

    if (row.verdict === "finding") {
      if (row.ruleDerived) ruleDerivedFindings++;
      else explicitFindings++;
    }
    if (row.verdict === "needs-live-proof") {
      if (NOT_YET_PROBED_KINDS.has(kind)) notYetProbed++;
      else if (row.outcome.errorCode === "SKIP-MUTATING") mutatingDeferred++;
      else genuineInconclusive++;
    }
  }

  console.log(
    `\n=== Verdict summary (${ledgerRows.length} rows = ${manifest.length} surfaces x ${ACTOR_IDS.length} actors) ===`,
  );
  console.log(`  clear             ${byVerdict.clear}`);
  console.log(
    `  finding           ${byVerdict.finding}  (${ruleDerivedFindings} rule-derived placeholder expectation -- ` +
      `expect false positives until Tasks 6-7 replace the fail-closed default; ${explicitFindings} explicit/role-derived)`,
  );
  console.log(`  needs-live-proof  ${byVerdict["needs-live-proof"]}`);
  console.log(
    `    ${notYetProbed} not probed by this task yet (policy/trigger/action/endpoint/bucket -- Tasks 6 & 8)`,
  );
  console.log(
    `    ${mutatingDeferred} the 2 mutating zero-arg functions x 12 actors, deliberately not invoked (Task 7)`,
  );
  console.log(
    `    ${genuineInconclusive} genuinely probed (view/table/function) and inconclusive for now ` +
      "(mostly PGRST202 argument mismatches -- expected; Task 7 supplies real arguments)",
  );

  console.log("\n  By kind:");
  const kindOrder = [...byKind.keys()].sort();
  for (const kind of kindOrder) {
    const s = byKind.get(kind);
    const tag = NOT_YET_PROBED_KINDS.has(kind) ? "  [not probed this task]" : "";
    console.log(
      `    ${kind.padEnd(9)} ${String(s.total).padStart(4)} rows -- clear ${s.clear}, finding ${s.finding}, needs-live-proof ${s["needs-live-proof"]}${tag}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const manifest = loadManifest();
const surfaceById = new Map(manifest.map((s) => [s.id, s]));
console.log(`Loaded ${manifest.length} surfaces from scripts/security/manifest.json.`);

console.log("Provisioning all 12 actors (minted/reused exactly once for this run)...");
const actors = await provisionActors();
const clients = Object.fromEntries(
  ACTOR_IDS.map((id) => [id, actorClient(actors[id].accessToken)]),
);
console.log(
  "Actors ready. Probing the matrix (one round per surface, all 12 actors in parallel per round)...",
);

const startedAt = Date.now();
const rawRows = [];
for (const [i, surface] of manifest.entries()) {
  const cells = await Promise.all(
    ACTOR_IDS.map(async (actor) => ({
      surfaceId: surface.id,
      actor,
      expectation: defaultExpectation(surface, actor),
      ruleDerived: isRuleDerived(surface, actor),
      outcome: await probe(clients[actor], surface),
    })),
  );
  rawRows.push(...cells);
  if ((i + 1) % 20 === 0 || i === manifest.length - 1) {
    console.log(`  ...${i + 1}/${manifest.length} surfaces probed`);
  }
}
const elapsedMs = Date.now() - startedAt;
console.log(
  `Probed ${rawRows.length} cells (${manifest.length} surfaces x ${ACTOR_IDS.length} actors) in ${(elapsedMs / 1000).toFixed(1)}s.`,
);

mkdirSync(dirname(fileURLToPath(LEDGER_RAW_URL)), { recursive: true });
writeFileSync(LEDGER_RAW_URL, JSON.stringify(rawRows, null, 2) + "\n");
console.log(`Wrote ${fileURLToPath(LEDGER_RAW_URL)}`);

const ledgerRows = rawRows.map((row) => ({
  ...row,
  verdict: judge(row.expectation, row.outcome, surfaceById.get(row.surfaceId).kind),
}));
writeFileSync(LEDGER_URL, JSON.stringify(ledgerRows, null, 2) + "\n");
console.log(`Wrote ${fileURLToPath(LEDGER_URL)}`);

runSelfCheck(rawRows, ledgerRows, surfaceById);
printSummary(ledgerRows, manifest);
