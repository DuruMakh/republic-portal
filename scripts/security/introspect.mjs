/**
 * Generates and reconciles lib/security's surface manifest against a LIVE
 * snapshot of the database catalog.
 *
 * This script never opens a database connection itself. Supabase's JS client
 * cannot run arbitrary SQL, and the fix for that is NOT a SQL-executing RPC —
 * a general-purpose `exec_sql` function would be a far worse hole than
 * anything this audit is likely to find. Instead, scripts/security/introspect.sql
 * is run once, out of band, through the Supabase CLI (already a devDependency —
 * no new package, no psql install needed), which can execute arbitrary SQL
 * against the live remote database directly:
 *
 *   export SUPABASE_DB_PASSWORD="$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2-)"
 *   ENC_PW="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$SUPABASE_DB_PASSWORD")"
 *   npx supabase db query -f scripts/security/introspect.sql \
 *     --db-url "postgresql://postgres.orcxtbedkexoclbfgvzd:${ENC_PW}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
 *     --output-format json > scripts/security/live-objects.json
 *
 * The password MUST be percent-encoded (the `ENC_PW` step) — the CLI's
 * --db-url parsing requires it and fails confusingly otherwise. Never echo
 * SUPABASE_DB_PASSWORD, ENC_PW, or the assembled URL. --output-format csv is
 * available too if json ever proves awkward; this script only reads
 * live-objects.json, so either works as long as the file matches.
 *
 * The CLI wraps every result in its own safety framing —
 * `{ boundary, rows: [...], warning: "...untrusted data..." }` — precisely
 * because query results are attacker-influenceable content. This script
 * honors that: every field it reads out of `rows` (kind, name, definer) is
 * treated as inert data, never as an instruction, no matter what it says.
 *
 * Usage (both need scripts/security/live-objects.json to already exist):
 *   node --env-file=.env.local scripts/security/introspect.mjs --write
 *     Regenerate scripts/security/manifest.json from the live snapshot plus
 *     the hand-enumerated app-layer surfaces below.
 *
 *   node --env-file=.env.local scripts/security/introspect.mjs
 *     Reconcile the COMMITTED manifest.json against the live snapshot and
 *     exit non-zero on any drift. This is the form Task 4 (and any later
 *     re-check) runs.
 *
 * --env-file is accepted for symmetry with every other scripts/security/*.mjs
 * entry point even though nothing here reads an env var — this script never
 * touches Supabase credentials, by design (see above).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { reconcile } from "../../lib/security/manifest.ts";

const LIVE_OBJECTS_URL = new URL("./live-objects.json", import.meta.url);
const MANIFEST_URL = new URL("./manifest.json", import.meta.url);

/** The SurfaceKind values introspect.sql's UNION ALL can produce. */
const DB_KINDS = new Set(["function", "view", "table", "policy", "trigger"]);

function surfaceId(kind, name) {
  return `${kind}:${name}`;
}

function action(name) {
  return { id: surfaceId("action", name), kind: "action", name, layer: "app" };
}
function endpoint(name) {
  return { id: surfaceId("endpoint", name), kind: "endpoint", name, layer: "app" };
}
function bucket(name) {
  return { id: surfaceId("bucket", name), kind: "bucket", name, layer: "app" };
}

/**
 * The application-layer surfaces: exported Server Actions, the one public
 * HTTP endpoint, and the two Storage buckets. None of these live in
 * Postgres's catalog, so — unlike the five DB_KINDS above — they are
 * enumerated by hand from source, carry layer: "app", and are never touched
 * by reconcile() (it filters to layer === "db" before comparing).
 *
 * Re-derive the action list with:
 *   grep -rn "^export async function" $(grep -rl '"use server"' app lib components)
 * then trim each match down to the function name (everything from the
 * opening parenthesis onward is signature noise), and add the three this
 * literal recipe misses: openPollAction,
 * closePollAction, deletePollAction in
 * app/(admin)/admin/content/polls/actions.ts are each
 * `export const X = makeStatusAction(...)` — a higher-order factory
 * returning an async function, not an `export async function` declaration.
 * They are still real, callable Server Actions: Next's file-level
 * "use server" directive covers every exported async-function-VALUED
 * binding in the file, not only `function`-declaration syntax, and each one
 * routes to a real RPC (admin_open_poll / admin_close_poll /
 * admin_delete_poll).
 *
 * Counted twice on 2026-07-25 — the Grep tool's own count mode, then an
 * independent manual per-file tally — landing on 35 (the literal recipe,
 * which is also exactly the spec's own "35" — unsurprising, since spec §2
 * was itself derived by grepping) + 3 (the factory actions the recipe
 * can't see) = 38 true total, across the same 16 files the spec names. A
 * prior review's count of 26 is not reproducible by any enumeration method
 * tried here and is superseded by this one. Full trail in task-3-report.md.
 */
const APP_LAYER_SURFACES = [
  // app/(public)/join/actions.ts
  action("registerAction"),
  // app/(member)/me/actions.ts
  action("updateProfileAction"),
  action("updateRegisteredNameAction"),
  action("changeDelegateAction"),
  action("changeTierAction"),
  // app/(member)/me/delegacy/actions.ts
  action("requestDelegacyAction"),
  // app/(member)/me/events/actions.ts
  action("rsvpAction"),
  // app/(member)/me/membership/actions.ts
  action("saveMembershipProfileAction"),
  action("completeMembershipAction"),
  // app/(member)/me/polls/actions.ts
  action("voteAction"),
  // app/(admin)/admin/admins/actions.ts
  action("findAdminCandidateAction"),
  action("grantRoleAction"),
  action("revokeRoleAction"),
  // app/(admin)/admin/content/events/actions.ts
  action("saveEventAction"),
  action("publishEventAction"),
  action("cancelEventAction"),
  action("deleteEventAction"),
  // app/(admin)/admin/content/news/actions.ts
  action("saveNewsAction"),
  action("publishNewsAction"),
  action("unpublishNewsAction"),
  action("deleteNewsAction"),
  action("setNewsCoverAction"),
  // app/(admin)/admin/content/polls/actions.ts
  action("savePollAction"),
  action("openPollAction"),
  action("closePollAction"),
  action("deletePollAction"),
  // app/(admin)/admin/finances/actions.ts
  action("lookupMemberAction"),
  action("recordPaymentAction"),
  action("previewBulkAction"),
  action("confirmBulkAction"),
  action("voidPaymentAction"),
  // app/(admin)/admin/members/actions.ts
  action("revealPersonalIdAction"),
  // app/(admin)/admin/settings/actions.ts
  action("updateGraceDaysAction"),
  // app/(admin)/admin/transfer/actions.ts
  action("reassignMemberAction"),
  // app/(admin)/admin/verify/actions.ts
  action("approveDelegateAction"),
  action("rejectDelegateAction"),
  action("revealApplicantIdAction"),
  // app/(admin)/admin/verify/[id]/actions.ts
  action("updateDelegateProfileAction"),

  // app/api/dev/otp/route.ts — the only exported HTTP method is GET.
  endpoint("GET /api/dev/otp"),

  // supabase/migrations/20260717150000_admin_crm.sql:1014,
  // 20260719150000_community.sql:827 — both public-read, RPC-mediated write.
  bucket("delegate-photos"),
  bucket("news-images"),
];

/**
 * Parses the Supabase CLI's `--output-format json` shape for `db query`:
 * `{ boundary: string, rows: object[], warning: string }`. `boundary` and
 * `warning` are the CLI's own framing (the warning is its explicit "this is
 * untrusted data" notice) and carry no surface information — only `rows` is
 * read. Every value pulled off a row is treated as inert data: a `name` is
 * recorded as a string and nothing else, never evaluated or acted on, no
 * matter what it contains.
 */
function parseLiveObjects(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(
      `live-objects.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (parsed === null || typeof parsed !== "object" || !Array.isArray(parsed.rows)) {
    throw new Error(
      "live-objects.json doesn't look like `supabase db query --output-format json` output " +
        '(expected a top-level { "rows": [...] } object).',
    );
  }

  const rows = parsed.rows.map((row, i) => {
    if (
      row === null ||
      typeof row !== "object" ||
      typeof row.kind !== "string" ||
      typeof row.name !== "string"
    ) {
      throw new Error(`live-objects.json rows[${i}] is malformed: ${JSON.stringify(row)}`);
    }
    if (!DB_KINDS.has(row.kind)) {
      throw new Error(
        `live-objects.json rows[${i}] names an unknown kind ${JSON.stringify(row.kind)} (expected one of ${[...DB_KINDS].join(", ")}): ${JSON.stringify(row)}`,
      );
    }
    if (!row.name) {
      throw new Error(`live-objects.json rows[${i}] has an empty name: ${JSON.stringify(row)}`);
    }
    const definer = row.definer === true ? true : row.definer === false ? false : null;
    return { kind: row.kind, name: row.name, definer };
  });

  // Guard against silent under-counting: policies and triggers are scoped
  // per-table in Postgres, so two DIFFERENT objects (e.g. a same-named
  // trigger on two different tables) could in principle share a (kind, name)
  // pair. reconcile()'s LiveObject shape has no table-qualifier slot (see
  // lib/security/types.ts's Surface — Task 2 owns that type, out of scope to
  // widen here), so a genuine collision would silently collapse two live
  // surfaces into one manifest row and one of them would never be probed —
  // exactly the "silent hole" this whole task exists to prevent. Fail loudly
  // instead of ever letting that happen quietly.
  const seen = new Map();
  for (const row of rows) {
    const id = surfaceId(row.kind, row.name);
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
  }
  const collisions = [...seen.entries()].filter(([, count]) => count > 1);
  if (collisions.length > 0) {
    const list = collisions.map(([id, count]) => `${id} (${count}x)`).join(", ");
    throw new Error(
      `live-objects.json has ${collisions.length} colliding (kind, name) pair(s), which the current Surface shape cannot disambiguate: ${list}. ` +
        `This needs a human decision (e.g. qualify introspect.sql's policy/trigger names by table) before the manifest can be trusted.`,
    );
  }

  return rows;
}

function readLiveObjects() {
  if (!existsSync(LIVE_OBJECTS_URL)) {
    throw new Error(
      "scripts/security/live-objects.json does not exist yet. Produce it with the Supabase CLI:\n\n" +
        "  export SUPABASE_DB_PASSWORD=\"$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2-)\"\n" +
        '  ENC_PW="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$SUPABASE_DB_PASSWORD")"\n' +
        "  npx supabase db query -f scripts/security/introspect.sql \\\n" +
        '    --db-url "postgresql://postgres.orcxtbedkexoclbfgvzd:${ENC_PW}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \\\n' +
        "    --output-format json > scripts/security/live-objects.json\n\n" +
        "The password must be percent-encoded (the ENC_PW step) or the CLI fails confusingly. Never echo the password or the assembled URL.",
    );
  }
  return parseLiveObjects(readFileSync(LIVE_OBJECTS_URL, "utf8"));
}

function summarize(label, surfaces) {
  const counts = {};
  for (const s of surfaces) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
  const parts = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, n]) => `${kind}: ${n}`);
  console.log(`${label} (${surfaces.length} total) — ${parts.join(", ")}`);
}

function byId(a, b) {
  return a.id.localeCompare(b.id);
}

const write = process.argv.includes("--write");
const liveObjects = readLiveObjects();

if (write) {
  const dbSurfaces = liveObjects.map((o) => ({
    id: surfaceId(o.kind, o.name),
    kind: o.kind,
    name: o.name,
    layer: "db",
  }));
  const manifest = [...dbSurfaces, ...APP_LAYER_SURFACES].sort(byId);

  // --write rebuilds every surface as a bare {id, kind, name, layer}, which
  // DISCARDS the per-actor `overrides` and `note` fields that Tasks 6 and 7
  // spend their entire effort establishing — the census's stated intent, read
  // from live object definitions one surface at a time. Losing them silently
  // would not fail anything: the census would simply re-run green against
  // naming-convention defaults, which is precisely the false all-clear this
  // phase exists to prevent. So refuse, and make the operator say what they
  // want. --force still regenerates (it is the correct move if the schema
  // itself changed), but only as a deliberate act with the count in view.
  if (existsSync(MANIFEST_URL)) {
    const existing = JSON.parse(readFileSync(MANIFEST_URL, "utf8"));
    const enriched = existing.filter((s) => s.overrides !== undefined || s.note !== undefined);
    if (enriched.length > 0 && !process.argv.includes("--force")) {
      const overrideCells = enriched.reduce((n, s) => n + Object.keys(s.overrides ?? {}).length, 0);
      throw new Error(
        `REFUSING to overwrite ${fileURLToPath(MANIFEST_URL)}.\n` +
          `  It carries curated census data: ${enriched.length} surfaces, ${overrideCells} per-actor expectations.\n` +
          `  --write rebuilds bare surfaces and would discard all of it silently.\n` +
          `  If the live schema really changed, re-run with --force and diff the result before committing.`,
      );
    }
  }

  writeFileSync(MANIFEST_URL, JSON.stringify(manifest, null, 2) + "\n");

  const definerCount = liveObjects.filter(
    (o) => o.kind === "function" && o.definer === true,
  ).length;
  const nonDefinerFnCount = liveObjects.filter(
    (o) => o.kind === "function" && o.definer === false,
  ).length;
  console.log(`Wrote ${fileURLToPath(MANIFEST_URL)} — ${manifest.length} surfaces.`);
  summarize("  db layer", dbSurfaces);
  console.log(
    `    of which functions: ${definerCount} security definer, ${nonDefinerFnCount} other`,
  );
  summarize("  app layer", APP_LAYER_SURFACES);
} else {
  if (!existsSync(MANIFEST_URL)) {
    throw new Error("scripts/security/manifest.json does not exist yet. Run with --write first.");
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_URL, "utf8"));
  const result = reconcile(manifest, liveObjects);

  summarize(
    "live db objects",
    liveObjects.map((o) => ({ kind: o.kind })),
  );
  console.log(`unchanged: ${result.unchanged}`);
  console.log(
    `added (live but not in manifest): ${result.added.length}${result.added.length ? "\n  " + result.added.join("\n  ") : ""}`,
  );
  console.log(
    `removed (in manifest but not live): ${result.removed.length}${result.removed.length ? "\n  " + result.removed.join("\n  ") : ""}`,
  );

  if (result.added.length > 0 || result.removed.length > 0) {
    console.error(
      "DRIFT DETECTED — manifest.json no longer matches the live database. Regenerate with --write and review the diff.",
    );
    process.exit(1);
  }
  console.log("OK: manifest.json matches the live database exactly.");
}
