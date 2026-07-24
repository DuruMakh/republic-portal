/**
 * Generates and reconciles lib/security's surface manifest against a LIVE
 * snapshot of the database catalog.
 *
 * This script never opens a database connection itself. Supabase's JS client
 * cannot run arbitrary SQL, and the fix for that is NOT a SQL-executing RPC —
 * a general-purpose `exec_sql` function would be a far worse hole than
 * anything this audit is likely to find. Instead, scripts/security/introspect.sql
 * is run once, out of band, through `psql` over the pooler (the same
 * connection idiom docs/superpowers/plans/2026-07-15-phase-3-cabinets.md:1308
 * already uses for migration pushes):
 *
 *   export SUPABASE_DB_PASSWORD="$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2-)"
 *   psql "postgresql://postgres.orcxtbedkexoclbfgvzd:${SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
 *     -At -F'|' -f scripts/security/introspect.sql > scripts/security/live-objects.txt
 *
 * If psql is not on PATH, run the same query once in the Supabase SQL editor
 * and save its pipe-delimited output to scripts/security/live-objects.txt by
 * hand — this script only ever reads that file, never a live connection, so
 * either production route ends up in the exact same place.
 *
 * Usage (both need scripts/security/live-objects.txt to already exist):
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

const LIVE_OBJECTS_URL = new URL("./live-objects.txt", import.meta.url);
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

function parseLiveObjects(text) {
  const rows = text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split("|");
      if (parts.length !== 3) {
        throw new Error(
          `malformed live-objects.txt line (expected 3 '|'-separated fields): ${JSON.stringify(line)}`,
        );
      }
      const [kind, name, definerRaw] = parts;
      if (!DB_KINDS.has(kind)) {
        throw new Error(
          `live-objects.txt names an unknown kind ${JSON.stringify(kind)} (expected one of ${[...DB_KINDS].join(", ")}) on line: ${JSON.stringify(line)}`,
        );
      }
      if (!name) {
        throw new Error(`live-objects.txt has an empty name on line: ${JSON.stringify(line)}`);
      }
      const definer = definerRaw === "t" ? true : definerRaw === "f" ? false : null;
      return { kind, name, definer };
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
      `live-objects.txt has ${collisions.length} colliding (kind, name) pair(s), which the current Surface shape cannot disambiguate: ${list}. ` +
        `This needs a human decision (e.g. qualify introspect.sql's policy/trigger names by table) before the manifest can be trusted.`,
    );
  }

  return rows;
}

function readLiveObjects() {
  if (!existsSync(LIVE_OBJECTS_URL)) {
    throw new Error(
      "scripts/security/live-objects.txt does not exist yet. Produce it with psql over the pooler:\n\n" +
        "  export SUPABASE_DB_PASSWORD=\"$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2-)\"\n" +
        '  psql "postgresql://postgres.orcxtbedkexoclbfgvzd:${SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \\\n' +
        "    -At -F'|' -f scripts/security/introspect.sql > scripts/security/live-objects.txt\n\n" +
        "If psql is not on PATH, run the same query in the Supabase SQL editor and paste its pipe-delimited output into that file by hand.",
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
