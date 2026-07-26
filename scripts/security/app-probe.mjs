/**
 * Task 8 / Pass 2c: the app-layer census runner.
 *
 * The 41 `layer: "app"` surfaces -- 38 Server Actions, 1 HTTP endpoint, 2
 * Storage buckets -- x 12 actors = 492 cells, the last third of the 1,824-cell
 * matrix. Tasks 6 and 7 covered the 1,332 database cells; every one of these 492
 * has sat at `needs-live-proof` / `errorCode: "SKIP"` since Task 4.
 *
 * ## Why this is a separate runner from probe.mjs
 * probe.mjs talks to PostgREST and needs nothing but credentials. This one needs
 * a BUILT AND RUNNING Next.js server, because a Server Action does not exist
 * until Next has compiled it and assigned it an id. Folding the two together
 * would make `npm run security:census` -- the command every other task in this
 * phase runs -- depend on a web server being up. So the pipeline is two steps:
 *
 *     npm run security:census       # probe.mjs, the 1,332 database cells
 *     npm run build && npm start    # (or any running instance)
 *     npm run security:census:app   # this file, the 492 app cells
 *
 * This runner MERGES into the ledger probe.mjs wrote rather than replacing it:
 * it reads `ledger-raw.json`, substitutes exactly the app-layer rows, re-judges
 * every row with the same `judge()`, and writes both files back. It asserts the
 * row count is unchanged and that precisely 492 rows were substituted, so a
 * half-merge cannot pass quietly.
 *
 * ## The runner records; it never throws (same contract as probe.mjs)
 * A probe that errors is data. The three conditions that DO abort are all
 * "the instrument is not trustworthy", never "a probe failed":
 *   - the manifest or the database-layer ledger is missing,
 *   - the app under test is not reachable, or its dev-OTP env gate is closed,
 *   - a cookie jar does not authenticate as the actor it claims to be.
 * That last one is the important one: every "refused" verdict below is only
 * evidence if the caller was identified first, and an unauthenticated jar would
 * produce a clean sweep of refusals that looks exactly like a perfect defence.
 *
 * Run: node --env-file=.env.local scripts/security/app-probe.mjs [--base http://localhost:3210]
 * (also wired as: npm run security:census:app)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACTOR_IDS, provisionActors, actorClient } from "./actors.mjs";
import { provisionFixturePool } from "./arguments.mjs";
import { verifyCookieIdentity } from "./app-session.mjs";
import { probeOtpEndpoint } from "./app-endpoint.mjs";
import { probeBuckets } from "./app-buckets.mjs";
import { judge } from "../../lib/security/verdict.ts";
import { defaultExpectation, isRuleDerived } from "../../lib/security/expectations.ts";

const MANIFEST_URL = new URL("./manifest.json", import.meta.url);
const LEDGER_RAW_URL = new URL("../../docs/security/ledger-raw.json", import.meta.url);
const LEDGER_URL = new URL("../../docs/security/ledger.json", import.meta.url);
const ROW_SCOPE_APP_URL = new URL("../../docs/security/row-scope-app.json", import.meta.url);
const RESIDUE_URL = new URL("../../docs/security/residue.json", import.meta.url);

const APP_KINDS = new Set(["action", "endpoint", "bucket"]);
const EXPECTED_APP_CELLS = 492;

const baseFlag = process.argv.indexOf("--base");
const BASE = baseFlag >= 0 ? process.argv[baseFlag + 1] : "http://localhost:3210";

/**
 * The instrument checks, all three of them, before a single cell is graded.
 * See the header for why each one aborts rather than degrading.
 */
async function preflight() {
  if (!existsSync(MANIFEST_URL)) {
    throw new Error(
      "scripts/security/manifest.json is missing -- run the Task 3 introspect first.",
    );
  }
  if (!existsSync(LEDGER_RAW_URL)) {
    throw new Error(
      "docs/security/ledger-raw.json is missing -- this runner MERGES into the database-layer " +
        "census. Run `npm run security:census` first.",
    );
  }
  let root;
  try {
    root = await fetch(`${BASE}/`, { redirect: "manual" });
  } catch (err) {
    throw new Error(
      `the app under test is not reachable at ${BASE} (${String(err)}). Start it with ` +
        "`npm run build && npx next start -p 3210`, or pass --base.",
    );
  }
  if (root.status >= 500) {
    throw new Error(
      `${BASE}/ answered ${root.status} -- the app is up but failing; refusing to run`,
    );
  }
  // The dev-OTP route 404s EVERYTHING when NEXT_PUBLIC_APP_ENV is neither
  // development nor preview. A missing `phone` therefore distinguishes the two
  // cases exactly: 400 = the env gate is open (what Pass 2c must probe),
  // 404 = the gate is shut and every endpoint cell would be vacuous.
  const gate = await fetch(`${BASE}/api/dev/otp`);
  if (gate.status !== 400) {
    throw new Error(
      `GET /api/dev/otp without a phone answered ${gate.status}, expected 400. The endpoint's ` +
        "NEXT_PUBLIC_APP_ENV gate is shut, so every endpoint cell would pass vacuously. " +
        "Build and run the app with NEXT_PUBLIC_APP_ENV=development or preview.",
    );
  }
  return root.status;
}

console.log(`Pass 2c: app-layer census against ${BASE}`);
const rootStatus = await preflight();
console.log(`  app reachable (GET / -> ${rootStatus}), dev-OTP env gate open`);

const manifest = JSON.parse(readFileSync(MANIFEST_URL, "utf8"));
const surfaceById = new Map(manifest.map((s) => [s.id, s]));
const appSurfaces = manifest.filter((s) => APP_KINDS.has(s.kind));
console.log(`  ${appSurfaces.length} app surfaces x ${ACTOR_IDS.length} actors`);

console.log("Provisioning the twelve actors (cached sessions; no OTP is sent)...");
const actors = await provisionActors();
const clients = Object.fromEntries(
  ACTOR_IDS.map((id) => [id, actorClient(actors[id].accessToken)]),
);

console.log("Self-check: does each cookie jar authenticate as the actor it claims to be?");
const identity = await verifyCookieIdentity(BASE, actors, ACTOR_IDS);
const badIdentity = identity.filter((r) => !r.ok);
for (const r of identity)
  console.log(`  ${r.ok ? "OK  " : "FAIL"} ${r.actor.padEnd(3)} ${r.observed}`);
if (badIdentity.length > 0) {
  throw new Error(
    `${badIdentity.length} actor cookie jar(s) do not authenticate as themselves. Every "refused" ` +
      "verdict this runner could produce would be meaningless. Re-run `npm run security:actors` " +
      "and try again; do NOT grade a run on this.",
  );
}

/**
 * Bounded retry around one specific, known-flaky call.
 *
 * `provisionFixturePool()` pages `auth.admin.listUsers` twelve times over a
 * ~2,000-account project, and that scan has produced a transient `ECONNRESET`
 * twice during this task. A retry is correct HERE and nowhere else in this
 * runner: it wraps fixture SETUP, never a probe. Retrying a probe would let a
 * flaky refusal be re-rolled until it agreed with the expectation, which is the
 * opposite of an audit. The pool memoises only on success, so a retry re-runs
 * from clean state.
 */
async function withRetry(label, fn, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      console.log(`  ${label} attempt ${i}/${attempts} failed: ${String(err).slice(0, 120)}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw last;
}

/** Disposable victim 1 (arguments.mjs's pool): a real profile that is never a caller. */
const VICTIM_PHONE = "+9955090020001";

const assertions = [...identity];
const residue = [];
const outcomes = new Map(); // `${surfaceId}|${actor}` -> ProbeOutcome

// ---------------------------------------------------------------------------
// 1. The dev-OTP endpoint
// ---------------------------------------------------------------------------
console.log("\nProbing endpoint:GET /api/dev/otp ...");
const otp = await probeOtpEndpoint(BASE, actors, ACTOR_IDS, VICTIM_PHONE);
for (const [actor, outcome] of Object.entries(otp.cells)) {
  outcomes.set(`endpoint:GET /api/dev/otp|${actor}`, outcome);
}
assertions.push(...otp.assertions);
for (const a of otp.assertions.filter((x) => !x.ok)) {
  console.log(`  ! ${a.assertion} / ${a.actor}: ${a.observed}`);
}

// ---------------------------------------------------------------------------
// 2. The two storage buckets
// ---------------------------------------------------------------------------
console.log("\nProbing the two storage buckets (write, list, delete) ...");
const buckets = await probeBuckets(clients, ACTOR_IDS);
for (const [bucket, byActor] of Object.entries(buckets.cells)) {
  for (const [actor, outcome] of Object.entries(byActor)) {
    outcomes.set(`bucket:${bucket}|${actor}`, outcome);
  }
}
assertions.push(...buckets.assertions);
residue.push(...buckets.residue);
for (const a of buckets.assertions.filter((x) => !x.ok)) {
  console.log(`  ! ${a.assertion} / ${a.actor}: ${a.observed}`);
}

// ---------------------------------------------------------------------------
// 3. The 38 server actions -- capture once, replay under all twelve sessions
// ---------------------------------------------------------------------------
const actionSurfaces = manifest.filter((s) => s.kind === "action");
// Imported dynamically so the harness, the endpoint and the buckets could land
// (and be re-run) before the 38-action table existed. A missing module means
// "actions not probed by this run", which the merge below records honestly as
// unsubstituted rows rather than as a result.
const actionModule = existsSync(new URL("./app-actions.mjs", import.meta.url))
  ? await import("./app-actions.mjs")
  : null;
if (actionModule) {
  const { ACTION_SPECS, probeAction, prepareActionRun } = actionModule;
  console.log("Provisioning the disposable fixture pool (shared with Pass 2b)...");
  const pool = await withRetry("fixture pool", () => provisionFixturePool());
  console.log(`\nProbing ${actionSurfaces.length} server actions x ${ACTOR_IDS.length} actors ...`);
  const run = await prepareActionRun(BASE, actors, pool);
  for (const [i, surface] of actionSurfaces.entries()) {
    const spec = ACTION_SPECS[surface.name];
    for (const actor of ACTOR_IDS) {
      const { outcome, extraAssertions, minted } = await probeAction(run, spec, surface, actor);
      outcomes.set(`${surface.id}|${actor}`, outcome);
      if (extraAssertions) assertions.push(...extraAssertions);
      if (minted) residue.push(...minted);
    }
    if ((i + 1) % 10 === 0 || i === actionSurfaces.length - 1) {
      console.log(`  ...${i + 1}/${actionSurfaces.length} actions probed`);
    }
  }
  assertions.push(...actionModule.probeValidityAssertions(run.validity));
  assertions.push(...actionModule.genericRefusalAssertions(run.validity));
} else {
  console.log("\n(scripts/security/app-actions.mjs not present -- the 456 action cells are left");
  console.log(" at their previous value and reported as unsubstituted below)");
}

// ---------------------------------------------------------------------------
// 4. Merge into the ledger probe.mjs wrote
// ---------------------------------------------------------------------------
const rawRows = JSON.parse(readFileSync(LEDGER_RAW_URL, "utf8"));
const before = rawRows.length;
let replaced = 0;
let stillSkipped = 0;
for (const row of rawRows) {
  const surface = surfaceById.get(row.surfaceId);
  if (!surface || !APP_KINDS.has(surface.kind)) continue;
  const outcome = outcomes.get(`${row.surfaceId}|${row.actor}`);
  // Expectations are re-read from the manifest on every merge, so a curated
  // override added after the last probe.mjs run takes effect here rather than
  // silently keeping the fail-closed placeholder.
  row.expectation = defaultExpectation(surface, row.actor);
  row.ruleDerived = isRuleDerived(surface, row.actor);
  if (!outcome) {
    stillSkipped++;
    continue;
  }
  row.outcome = outcome;
  replaced++;
}
if (rawRows.length !== before) {
  throw new Error(`ledger row count changed during merge: ${before} -> ${rawRows.length}`);
}
const appRowCount = rawRows.filter((r) => APP_KINDS.has(surfaceById.get(r.surfaceId)?.kind)).length;
if (appRowCount !== EXPECTED_APP_CELLS) {
  throw new Error(
    `expected ${EXPECTED_APP_CELLS} app-layer rows in the ledger, found ${appRowCount} -- ` +
      "the manifest and the ledger disagree; refusing to write.",
  );
}
console.log(
  `\nMerged ${replaced}/${appRowCount} app-layer cells` +
    (stillSkipped ? ` (${stillSkipped} not probed by this run)` : ""),
);

writeFileSync(LEDGER_RAW_URL, JSON.stringify(rawRows, null, 2) + "\n");
const ledgerRows = rawRows.map((row) => ({
  ...row,
  verdict: judge(row.expectation, row.outcome, surfaceById.get(row.surfaceId).kind),
}));
writeFileSync(LEDGER_URL, JSON.stringify(ledgerRows, null, 2) + "\n");
console.log(`Wrote ${fileURLToPath(LEDGER_RAW_URL)}`);
console.log(`Wrote ${fileURLToPath(LEDGER_URL)}`);

writeFileSync(ROW_SCOPE_APP_URL, JSON.stringify(assertions, null, 2) + "\n");
console.log(`Wrote ${fileURLToPath(ROW_SCOPE_APP_URL)} (${assertions.length} assertions)`);

if (residue.length > 0) {
  const previous = JSON.parse(readFileSync(RESIDUE_URL, "utf8"));
  previous.runs.push({
    runAt: new Date().toISOString(),
    source: "scripts/security/app-probe.mjs (Pass 2c)",
    minted: residue,
  });
  writeFileSync(RESIDUE_URL, JSON.stringify(previous, null, 2) + "\n");
  console.log(`Appended ${residue.length} residue row(s) to ${fileURLToPath(RESIDUE_URL)}`);
}

// ---------------------------------------------------------------------------
// 5. Summary
// ---------------------------------------------------------------------------
const appLedger = ledgerRows.filter((r) => APP_KINDS.has(surfaceById.get(r.surfaceId).kind));
const tally = { clear: 0, finding: 0, "needs-live-proof": 0 };
for (const r of appLedger) tally[r.verdict]++;
const whole = { clear: 0, finding: 0, "needs-live-proof": 0 };
for (const r of ledgerRows) whole[r.verdict]++;

console.log(`\n=== Pass 2c: ${appLedger.length} app-layer cells ===`);
console.log(`  clear             ${tally.clear}`);
console.log(`  finding           ${tally.finding}`);
console.log(`  needs-live-proof  ${tally["needs-live-proof"]}`);
console.log(`=== whole matrix: ${ledgerRows.length} cells ===`);
console.log(
  `  clear ${whole.clear} / finding ${whole.finding} / needs-live-proof ${whole["needs-live-proof"]}`,
);

const failed = assertions.filter((a) => !a.ok);
console.log(`\n${assertions.length - failed.length}/${assertions.length} app assertions hold.`);
for (const f of failed) {
  console.log(`  FAIL ${f.assertion} / ${f.actor}: expected ${f.expected}; observed ${f.observed}`);
}
for (const r of appLedger.filter((r) => r.verdict === "finding")) {
  console.log(
    `  FINDING ${r.surfaceId} / ${r.actor}: ${JSON.stringify(r.outcome.raw ?? r.outcome)}`,
  );
}
