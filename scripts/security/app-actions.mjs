/**
 * Task 8: the 38 Server Actions -- capture once, replay under all twelve
 * sessions.
 *
 * ## How an action is addressed
 * Three things are needed and none of them can be guessed:
 *
 *   1. The ACTION ID, read at runtime from
 *      `.next/server/server-reference-manifest.json` (written by `next build`).
 *      Its `node` map holds exactly 38 entries -- independently the same 38 the
 *      audit manifest enumerates -- each with `exportedName` and the set of page
 *      entries that register it. Reading it at runtime rather than hardcoding
 *      means the ids always match the server actually under test.
 *   2. The PAGE URL, because Next refuses an action id posted to a page whose
 *      entry does not register it. The manifest's `workers` keys give the entry;
 *      `page()` below turns it into a URL, substituting a real id for a `[id]`
 *      segment.
 *   3. The ENCODING, captured from a real browser request rather than assumed
 *      (see .superpowers/sdd/task-8-report.md §1): `next-action: <id>`,
 *      `content-type: text/plain;charset=UTF-8`, `accept: text/x-component`,
 *      and a body that is a plain JSON array of the action's positional
 *      arguments. Two actions take a `FormData` instead; those are encoded by
 *      React's own `encodeReply` -- see encodeFormDataReply below.
 *
 * The replay then swaps exactly one field: the cookie header. That is the
 * attack the UI can never construct, and it is the whole point of the pass.
 *
 * ## Arguments and isolation are Pass 2b's, deliberately
 * Almost every action is a thin envelope over one RPC that Task 7 already
 * probed with valid arguments against a freshly minted target. Re-deriving that
 * here would be a second, drifting copy of the hardest part of the audit, so
 * each spec instead names its `rpc` and reuses that function's own
 * `setup`/`teardown`/`after` from scripts/security/arguments.mjs, translating
 * only the ARGUMENT SHAPE (an action takes camelCase positional arguments; the
 * RPC takes `p_`-prefixed named ones). Every actor therefore attacks an
 * identical fresh target here exactly as it did there, and the twelfth result
 * stays comparable to the first.
 *
 * ## The probe-validity self-check
 * `judge()` cannot tell "the actor was refused" from "the probe's arguments
 * were wrong" -- both are an error. So after the matrix runs, every action must
 * show at least one ALLOWED actor that did NOT land on `APP-GENERIC` /
 * `APP-UNMAPPED`. An action where every allowed actor got the generic error has
 * a broken argument list or a broken encoding, and its deny cells prove nothing.
 * That check is reported by name and fails the run's assertion set rather than
 * being left for a reader to notice.
 *
 * ## What a denied actor actually sees, and the three that stay inconclusive
 * Most actions call their RPC directly, so a denied caller gets the RPC's own
 * `missing_role` / `not_a_member` / `not_authenticated` back through
 * `mapFunnelError`, and the token is recoverable. THREE actions read a
 * self-gating admin view FIRST and bail on its error:
 * `publishNewsAction`, `publishEventAction` and `approveDelegateAction`. For a
 * denied actor the view returns zero rows, `.single()` raises PostgREST's
 * PGRST116, and the action maps that unknown message to GENERIC_FUNNEL_ERROR --
 * a real refusal that the app has collapsed into an unclassifiable string. Those
 * cells are recorded honestly as `needs-live-proof` and settled by the state
 * assertions below instead, never by guessing.
 *
 * ## State assertions: the question a verdict cannot ask
 * A verdict says whether the caller was refused. It cannot say whether the
 * target CHANGED. For the nine most sensitive mutating actions, the target's
 * state is fingerprinted immediately before and after every denied actor's
 * attempt, and any difference is a finding regardless of what the action
 * returned. That is what actually settles the three GENERIC actions above.
 */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { db } from "./db.mjs";
import { FUNCTION_SPECS, AUDIT_TAG } from "./arguments.mjs";
import { auditTeamMember } from "./actors.mjs";
import { cookieHeaderFor } from "./app-session.mjs";
import { outcomeFromActionResult, outcomeFromTransport } from "./app-outcome.mjs";

const MANIFEST_URL = new URL("../../.next/server/server-reference-manifest.json", import.meta.url);

const rand = () => Math.random().toString(36).slice(2, 10);

/** Tbilisi wall-clock "YYYY-MM-DDTHH:mm", the shape every content form takes. */
function tbilisiLocal(offsetDays) {
  const t = new Date(Date.now() + 4 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return t.toISOString().slice(0, 16);
}

/**
 * A minimal, real 1x1 PNG. Used by the two upload actions so the probe
 * exercises the true path (client-declared MIME -> PHOTO_TYPES -> service-role
 * upload) rather than stopping at the type check. 67 bytes, far under the 5 MB
 * cap.
 */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

// ---------------------------------------------------------------------------
// The action table
// ---------------------------------------------------------------------------

/**
 * `rpc`     the arguments.mjs entry whose setup/teardown/after this reuses.
 * `allow`   the actors expected to get PAST the gate. Derived from the RPC's own
 *           allow-set (Task 7, read from live `prosrc`) plus any app-side
 *           precheck the action adds before it.
 * `args`    positional arguments, as the browser would send them.
 * `page`    a URL the action id is registered under; `[id]` substituted.
 * `form`    true for the two FormData actions.
 * `state`   fingerprints the target so a denied attempt can be proven inert.
 */
export const ACTION_SPECS = {
  // --- (public)/join ------------------------------------------------------
  registerAction: {
    rpc: "register",
    allow: ["A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"],
    page: () => "/join",
    args: (_fx, c) => [
      {
        firstName: "SECAUDIT",
        lastName: "Probe",
        personalId: `907${String(c.slotIndex + 10).padStart(8, "0")}`,
        refCode: null,
      },
    ],
  },

  // --- (member)/me --------------------------------------------------------
  updateProfileAction: {
    allow: ["A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"],
    page: () => "/me/profile",
    // Content-neutral where possible: the caller's own five cabinet columns are
    // read first and written straight back. A3 (registered) has nulls where the
    // schema demands numbers, so it gets the pool's region/city and is restored
    // by teardown -- the same read-then-restore Task 7 used for
    // become_member_save_profile x A3.
    setup: async (c) => {
      const id = c.actors[c.actor].userId;
      if (!id) return { before: null };
      const { data } = await db
        .from("profiles")
        .select("first_name,last_name,region_id,city_id,employment")
        .eq("id", id)
        .maybeSingle();
      return { before: data ?? null };
    },
    args: (fx, c) => [
      {
        firstName: fx.before?.first_name ?? "SECAUDIT",
        lastName: fx.before?.last_name ?? "Probe",
        regionId: fx.before?.region_id ?? c.pool.geo.regionId,
        cityId: fx.before?.city_id ?? c.pool.geo.cityId,
        employment: fx.before?.employment ?? AUDIT_TAG,
      },
    ],
    teardown: async (fx, c) => {
      if (!fx.before) return;
      const id = c.actors[c.actor].userId;
      await db.from("profiles").update(fx.before).eq("id", id);
    },
  },
  updateRegisteredNameAction: {
    allow: ["A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"],
    page: () => "/me/profile",
    setup: async (c) => {
      const id = c.actors[c.actor].userId;
      if (!id) return { before: null };
      const { data } = await db
        .from("profiles")
        .select("first_name,last_name")
        .eq("id", id)
        .maybeSingle();
      return { before: data ?? null };
    },
    args: (fx) => [
      {
        firstName: fx.before?.first_name ?? "SECAUDIT",
        lastName: fx.before?.last_name ?? "Probe",
      },
    ],
  },
  changeDelegateAction: {
    rpc: "member_change_delegate",
    allow: ["A4", "A5", "A6", "A8", "A9", "A10", "A11", "A12"],
    page: () => "/me/delegate",
    args: (fx) => [{ delegateId: fx.delegateId }],
  },
  changeTierAction: {
    rpc: "member_change_tier",
    allow: ["A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"],
    page: () => "/me/billing",
    args: (fx) => [{ tier: fx.tier }],
  },

  // --- (member)/me/* ------------------------------------------------------
  requestDelegacyAction: {
    rpc: "request_delegacy",
    allow: ["A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"],
    // Same abstention as Pass 2b: this writes on the CALLER, and A9-A12 are the
    // canonical staging admins this audit must not mutate.
    skipFor: ["A9", "A10", "A11", "A12"],
    page: () => "/me/delegacy",
    args: () => [],
  },
  rsvpAction: {
    rpc: "member_rsvp",
    allow: ["A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"],
    page: () => "/me/events",
    args: (fx) => [{ eventId: fx.eventId, going: true }],
  },
  saveMembershipProfileAction: {
    rpc: "become_member_save_profile",
    allow: ["A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"],
    page: () => "/me/membership",
    args: (_fx, c) => [
      {
        birthDate: "1990-01-01",
        regionId: c.pool.geo.regionId,
        cityId: c.pool.geo.cityId,
        employment: AUDIT_TAG,
        delegateId: null,
      },
    ],
  },
  completeMembershipAction: {
    rpc: "become_member_complete",
    allow: ["A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"],
    page: () => "/me/membership",
    args: (fx) => [{ tier: fx.tier }],
  },
  voteAction: {
    rpc: "member_cast_vote",
    allow: ["A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"],
    page: () => "/me/polls",
    args: (fx) => [{ pollId: fx.pollId, optionId: fx.optionId }],
  },

  // --- (admin)/admin/admins ----------------------------------------------
  findAdminCandidateAction: {
    // App-side gate FIRST: hasAnyRole(["super_admin"]) at actions.ts:32.
    allow: ["A9"],
    appPrecheck: "super_admin",
    page: () => "/admin/admins",
    // The audit's auxiliary team-member fixture: a real completed member whose
    // phone is a REAL Georgian shape (5XXXXXXXX). The disposable victims cannot
    // be used here -- their phones are deliberately longer than a real number
    // and would fail the action's own zod refine before the role gate.
    args: () => [auditTeamMember().phone],
  },
  grantRoleAction: {
    rpc: "admin_grant_role",
    allow: ["A9"],
    page: () => "/admin/admins",
    args: (fx) => [fx.victim.userId, "editor"],
    state: (fx) => ({ table: "admin_roles", filter: ["user_id", fx.victim.userId] }),
  },
  revokeRoleAction: {
    rpc: "admin_revoke_role",
    allow: ["A9"],
    page: () => "/admin/admins",
    args: (fx) => [fx.victim.userId, "editor"],
  },

  // --- (admin)/admin/content/events --------------------------------------
  saveEventAction: {
    rpc: "admin_save_event",
    allow: ["A9", "A12"],
    page: () => "/admin/content/events/new",
    args: (_fx, c) => [
      {
        title: `SECAUDIT saveEventAction ${c.actor}`,
        description: AUDIT_TAG,
        location: AUDIT_TAG,
        startsAt: tbilisiLocal(30),
        endsAt: tbilisiLocal(31),
      },
    ],
  },
  publishEventAction: {
    rpc: "admin_publish_event",
    allow: ["A9", "A12"],
    page: (fx) => `/admin/content/events/${fx.id}`,
    args: (fx) => [fx.id],
    state: (fx) => ({ table: "events", filter: ["id", fx.id], columns: "status,slug" }),
  },
  cancelEventAction: {
    rpc: "admin_cancel_event",
    allow: ["A9", "A12"],
    page: (fx) => `/admin/content/events/${fx.id}`,
    args: (fx) => [fx.id],
  },
  deleteEventAction: {
    rpc: "admin_delete_event",
    allow: ["A9", "A12"],
    page: (fx) => `/admin/content/events/${fx.id}`,
    args: (fx) => [fx.id],
  },

  // --- (admin)/admin/content/news ----------------------------------------
  saveNewsAction: {
    rpc: "admin_save_news",
    allow: ["A9", "A12"],
    page: () => "/admin/content/news/new",
    args: (_fx, c) => [
      {
        title: `SECAUDIT saveNewsAction ${c.actor}`,
        body: AUDIT_TAG,
        visibility: "public",
      },
    ],
  },
  publishNewsAction: {
    rpc: "admin_publish_news",
    allow: ["A9", "A12"],
    page: (fx) => `/admin/content/news/${fx.id}`,
    args: (fx) => [fx.id],
    state: (fx) => ({ table: "news", filter: ["id", fx.id], columns: "status,slug" }),
  },
  unpublishNewsAction: {
    rpc: "admin_unpublish_news",
    allow: ["A9", "A12"],
    page: (fx) => `/admin/content/news/${fx.id}`,
    args: (fx) => [fx.id],
  },
  deleteNewsAction: {
    rpc: "admin_delete_news",
    allow: ["A9", "A12"],
    page: (fx) => `/admin/content/news/${fx.id}`,
    args: (fx) => [fx.id],
  },
  setNewsCoverAction: {
    // App-side gate FIRST: hasAnyRole(["editor","super_admin"]) at news
    // actions.ts:114-117, before createAdminClient() at line 137.
    rpc: "admin_set_news_image",
    allow: ["A9", "A12"],
    appPrecheck: "editor|super_admin",
    form: true,
    page: (fx) => `/admin/content/news/${fx.id}`,
    args: (fx) => [
      { name: "newsId", value: fx.id },
      { name: "cover", filename: "secaudit.png", type: "image/png", bytes: PNG_1PX },
    ],
    state: (fx) => ({ table: "news", filter: ["id", fx.id], columns: "image_url" }),
    // A successful upload parks a real object in the PUBLIC news-images bucket.
    // It is removed service-side the moment the probe returns, whatever the
    // verdict was -- the same discipline admin_grant_role's teardown uses for a
    // granted role.
    uploaded: (fx) => ({ bucket: "news-images", prefix: `${fx.id}-` }),
  },

  // --- (admin)/admin/content/polls ---------------------------------------
  savePollAction: {
    rpc: "admin_save_poll",
    allow: ["A9", "A12"],
    page: () => "/admin/content/polls/new",
    args: (_fx, c) => [
      {
        question: `SECAUDIT savePollAction ${c.actor}`,
        options: ["SECAUDIT-A", "SECAUDIT-B"],
        endsAt: "",
      },
    ],
  },
  openPollAction: {
    rpc: "admin_open_poll",
    allow: ["A9", "A12"],
    page: (fx) => `/admin/content/polls/${fx.pollId}`,
    args: (fx) => [fx.pollId],
  },
  closePollAction: {
    rpc: "admin_close_poll",
    allow: ["A9", "A12"],
    page: (fx) => `/admin/content/polls/${fx.pollId}`,
    args: (fx) => [fx.pollId],
  },
  deletePollAction: {
    rpc: "admin_delete_poll",
    allow: ["A9", "A12"],
    page: (fx) => `/admin/content/polls/${fx.pollId}`,
    args: (fx) => [fx.pollId],
  },

  // --- (admin)/admin/finances --------------------------------------------
  lookupMemberAction: {
    // App-side gate: hasAnyRole(["finance","super_admin"]) at finances
    // actions.ts:33-36.
    allow: ["A9", "A11"],
    appPrecheck: "finance|super_admin",
    page: () => "/admin/finances",
    // Narrowed to this audit's own synthetic victims -- the same code path
    // without pulling the live roster's names and phones into the runner.
    args: () => ["SECAUDIT"],
  },
  recordPaymentAction: {
    rpc: "admin_record_payment",
    allow: ["A9", "A11"],
    page: () => "/admin/finances",
    args: (fx, c) => [
      {
        memberId: fx.victim.userId,
        amountGel: 5,
        paidAt: c.pool.today,
        bankReference: `SECAUDIT-${rand()}`,
      },
    ],
    state: (fx) => ({ table: "payments", filter: ["member_id", fx.victim.userId] }),
  },
  previewBulkAction: {
    allow: ["A9", "A11"],
    appPrecheck: "finance|super_admin",
    page: () => "/admin/finances",
    args: (_fx, c) => [`${c.pool.victims[c.actor].referenceCode} 5.00 ${c.pool.today}`],
  },
  confirmBulkAction: {
    rpc: "admin_record_payments_bulk",
    allow: ["A9", "A11"],
    page: () => "/admin/finances",
    args: (fx, c) => [
      [{ referenceCode: fx.victim.referenceCode, amountGel: 7, paidAt: c.pool.today }],
    ],
    state: (fx) => ({ table: "payments", filter: ["member_id", fx.victim.userId] }),
  },
  voidPaymentAction: {
    rpc: "admin_void_payment",
    allow: ["A9", "A11"],
    page: () => "/admin/finances",
    args: (fx) => [fx.paymentId, `${AUDIT_TAG} void probe`],
  },

  // --- (admin)/admin/members ---------------------------------------------
  revealPersonalIdAction: {
    rpc: "admin_reveal_personal_id",
    allow: ["A9"],
    page: () => "/admin/members",
    args: (_fx, c) => [c.pool.victims[c.actor].userId],
  },

  // --- (admin)/admin/settings --------------------------------------------
  updateGraceDaysAction: {
    rpc: "admin_update_setting",
    allow: ["A9"],
    page: () => "/admin/settings",
    // Written back to the value it already holds: the RPC body runs
    // recompute_all_active() across the whole roster, so a changed value would
    // re-grade every member's standing.
    args: (_fx, c) => [c.pool.graceDays],
    state: () => ({
      table: "app_settings",
      filter: ["key", "active_grace_days"],
      columns: "value",
    }),
  },

  // --- (admin)/admin/transfer --------------------------------------------
  reassignMemberAction: {
    rpc: "admin_reassign_member",
    allow: ["A9", "A10"],
    page: () => "/admin/transfer",
    args: (fx) => [fx.victim.userId, fx.to],
    state: (fx) => ({
      table: "memberships",
      filter: ["member_id", fx.victim.userId],
      columns: "delegate_id,ended_at",
    }),
  },

  // --- (admin)/admin/verify ----------------------------------------------
  approveDelegateAction: {
    rpc: "admin_approve_delegate",
    allow: ["A9", "A10"],
    page: () => "/admin/verify",
    args: (fx) => [fx.victim.userId],
    state: (fx) => ({
      table: "delegates",
      filter: ["id", fx.victim.userId],
      columns: "status,slug,verified_at",
    }),
  },
  rejectDelegateAction: {
    rpc: "admin_reject_delegate",
    allow: ["A9", "A10"],
    page: () => "/admin/verify",
    args: (fx) => [fx.victim.userId, AUDIT_TAG],
  },
  revealApplicantIdAction: {
    rpc: "admin_reveal_applicant_personal_id",
    allow: ["A9", "A10"],
    page: () => "/admin/verify",
    args: (fx) => [fx.victim.userId],
  },
  updateDelegateProfileAction: {
    // App-side gate FIRST: hasAnyRole(["verifier","super_admin"]) at
    // verify/[id]/actions.ts:25-28, before createAdminClient() at line 51.
    rpc: "admin_update_delegate_profile",
    allow: ["A9", "A10"],
    appPrecheck: "verifier|super_admin",
    form: true,
    page: (fx) => `/admin/verify/${fx.victim.userId}`,
    args: (fx) => [
      { name: "delegateId", value: fx.victim.userId },
      { name: "bio", value: AUDIT_TAG },
      { name: "photo", filename: "secaudit.png", type: "image/png", bytes: PNG_1PX },
    ],
    state: (fx) => ({
      table: "delegates",
      filter: ["id", fx.victim.userId],
      columns: "bio,photo_url",
    }),
    uploaded: (fx) => ({ bucket: "delegate-photos", prefix: `${fx.victim.userId}-` }),
  },
};

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * The two FormData actions are encoded by REACT'S OWN `encodeReply`, the exact
 * function the browser calls, loaded out of the app's own bundled copy.
 *
 * Hand-rolling this was tried and was wrong in a way worth recording, because
 * it is precisely the failure mode this audit keeps warning about. The field
 * names were right -- root field `0` carrying `["$K1"]`, entries under
 * `_1_<name>` -- but React appends the root field **last**, after the parts it
 * references, and the server decoder depends on that ordering. Emitting `0`
 * first produced `{"ok":false,"error":"Expected string, received null"}`: the
 * action ran, saw an empty FormData, and refused. As a probe result that is
 * indistinguishable from a defence, and it would have graded twenty deny cells
 * against a request the app never understood.
 *
 * Using the real encoder makes the whole class of mistake impossible and cannot
 * drift when React changes the format. `fetch` serialises the returned FormData
 * with its own boundary, exactly as the browser does, so no content-type header
 * is set for these.
 */
const { encodeReply } = createRequire(import.meta.url)(
  "next/dist/compiled/react-server-dom-turbopack-experimental/cjs/react-server-dom-turbopack-client.browser.production.js",
);

async function encodeFormDataReply(entries) {
  const fd = new FormData();
  for (const e of entries) {
    if (e.bytes) fd.append(e.name, new Blob([e.bytes], { type: e.type }), e.filename);
    else fd.append(e.name, e.value);
  }
  return encodeReply([fd]);
}

/**
 * The action's return value out of the React Flight response.
 *
 * A flight stream is newline-delimited `<id>:<payload>` rows. The action result
 * is the one row whose payload parses as JSON carrying an `ok` field -- the
 * shape every action in this app returns. Scanning for that rather than
 * assuming a row index is what keeps this working when Next changes how much
 * tree it streams alongside the result.
 */
function extractActionResult(text) {
  for (const line of text.split("\n")) {
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const payload = line.slice(colon + 1);
    if (!payload.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object" && "ok" in parsed) return parsed;
    } catch {
      /* not this row */
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The runner half
// ---------------------------------------------------------------------------

function loadActionIds() {
  if (!existsSync(MANIFEST_URL)) {
    throw new Error(
      ".next/server/server-reference-manifest.json is missing. Server Actions have no id until " +
        "Next has compiled them, so the app must be BUILT (`npm run build`) and the running " +
        "instance must be that build. Refusing to probe.",
    );
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_URL, "utf8"));
  const byName = new Map();
  for (const [id, entry] of Object.entries(manifest.node ?? {})) {
    byName.set(entry.exportedName, { id, pages: Object.keys(entry.workers ?? {}) });
  }
  return byName;
}

const ACTOR_SLOTS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"];

export async function prepareActionRun(base, actors, pool) {
  const ids = loadActionIds();
  const missing = Object.keys(ACTION_SPECS).filter((n) => !ids.has(n));
  if (missing.length > 0) {
    throw new Error(`no action id in the build manifest for: ${missing.join(", ")}`);
  }
  const cookies = {};
  for (const actor of ACTOR_SLOTS) {
    cookies[actor] = await cookieHeaderFor(actors[actor].accessToken, actors[actor].userId);
  }
  const validity = [];
  return { base, actors, pool, ids, cookies, validity, finalAssertions: () => validity };
}

/**
 * Removes any object a successful upload action just parked in a public bucket,
 * and records it as residue. Listing by prefix rather than by remembering the
 * path is deliberate: the action mints its own `<id>-<epoch>.<ext>` filename
 * server-side, so the probe never learns it directly.
 */
async function removeUploads(spec, fx, actor, surfaceName, minted) {
  if (!spec.uploaded) return;
  const { bucket, prefix } = spec.uploaded(fx);
  const { data } = await db.storage.from(bucket).list("", { limit: 100, search: prefix });
  const paths = (data ?? []).filter((o) => o.name.startsWith(prefix)).map((o) => o.name);
  if (paths.length === 0) return;
  await db.storage.from(bucket).remove(paths);
  for (const path of paths) {
    minted.push({
      kind: "storage.object",
      id: `${bucket}/${path}`,
      surface: `action:${surfaceName}`,
      actor,
      note: "uploaded by the action itself (service role, after its role check); removed immediately",
      at: new Date().toISOString(),
    });
  }
}

async function fingerprint(spec, fx) {
  if (!spec.state) return null;
  const s = spec.state(fx);
  const { data } = await db
    .from(s.table)
    .select(s.columns ?? "*")
    .eq(s.filter[0], s.filter[1]);
  return JSON.stringify(data ?? []);
}

/**
 * One (action, actor) cell: mint a fresh target, replay the captured request
 * shape under this actor's cookie, record what came back, tear the target down.
 */
export async function probeAction(run, spec, surface, actor) {
  const extraAssertions = [];
  const minted = [];
  const ctx = {
    actor,
    actors: run.actors,
    pool: run.pool,
    slotIndex: ACTOR_SLOTS.indexOf(actor),
  };

  if (spec.skipFor?.includes(actor)) {
    return {
      outcome: {
        errorCode: "SKIP-MUTATING",
        errorMessage:
          `${surface.name} writes on the CALLER, and ${actor} is one of the four canonical ` +
          "staging admins this audit must not mutate (same abstention as Pass 2b).",
        rowCount: 0,
      },
      extraAssertions,
      minted,
    };
  }

  const fnSpec = spec.rpc ? FUNCTION_SPECS[spec.rpc] : null;
  const setup = spec.setup ?? fnSpec?.setup;
  const teardown = spec.teardown ?? fnSpec?.teardown;
  const fx = setup ? await setup(ctx) : {};

  try {
    const before = await fingerprint(spec, fx);
    const meta = run.ids.get(surface.name);
    const url = run.base + spec.page(fx, ctx);
    const cookie = run.cookies[actor];

    // FormData actions let `fetch` set the multipart content-type (with its own
    // boundary), exactly as the browser does; plain actions send the captured
    // text/plain shape.
    const body = spec.form
      ? await encodeFormDataReply(spec.args(fx, ctx))
      : JSON.stringify(spec.args(fx, ctx));
    const contentType = spec.form ? null : "text/plain;charset=UTF-8";

    let outcome;
    try {
      const res = await fetch(url, {
        method: "POST",
        redirect: "manual",
        headers: {
          "next-action": meta.id,
          ...(contentType ? { "content-type": contentType } : {}),
          accept: "text/x-component",
          ...(cookie ? { cookie } : {}),
        },
        body,
      });
      const text = await res.text();
      const result = extractActionResult(text);
      const raw = {
        url,
        actionId: meta.id,
        status: res.status,
        actionRedirect: res.headers.get("x-action-redirect"),
        result,
        snippet: result ? undefined : text.slice(0, 400),
      };
      outcome =
        result === null
          ? outcomeFromTransport(res.status, "no action result in the flight response", raw)
          : outcomeFromActionResult(result, raw);
      if (spec.appPrecheck && outcome.errorMessage === "missing_role") {
        // Same token, different layer. Graded identically -- both mean "turned
        // away by a role check" -- but never conflated in the evidence.
        outcome.raw.refusedBy = `app-precheck hasAnyRole(${spec.appPrecheck})`;
      }
    } catch (err) {
      outcome = { errorCode: "THROWN", errorMessage: String(err), rowCount: 0 };
    }

    await removeUploads(spec, fx, actor, surface.name, minted);
    const after = await fingerprint(spec, fx);
    if (before !== null && !spec.allow.includes(actor)) {
      extraAssertions.push({
        assertion: `action:${surface.name}.denied-actor-changes-nothing`,
        actor,
        expected: "the target row is byte-identical before and after the attempt",
        observed: before === after ? "unchanged" : `CHANGED: ${before} -> ${after}`,
        ok: before === after,
      });
    }

    // Gathered across actors and asserted once the matrix is done: probe
    // validity per action, and the generic-refusal argument per cell.
    run.validity.push({
      action: surface.name,
      actor,
      code: outcome.errorCode,
      allow: spec.allow,
      refused: outcome.raw?.result?.ok === false,
    });

    if (!outcome.errorCode && fnSpec?.after) {
      try {
        fnSpec.after(fx, ctx, outcome.raw?.result?.id ?? null);
      } catch {
        /* residue recording is best-effort, same contract as probe.mjs */
      }
    }
    return { outcome, extraAssertions, minted };
  } finally {
    if (teardown) {
      try {
        await teardown(fx, ctx);
      } catch (err) {
        console.error(`  TEARDOWN FAILED ${surface.id} / ${actor}: ${String(err)}`);
      }
    }
  }
}

/**
 * Why a `GENERIC_FUNNEL_ERROR` cell is a real refusal and not a broken probe.
 *
 * 58 denied cells return the app's generic message rather than a token, for two
 * structural reasons: an anonymous caller is refused `42501` by Postgres and
 * `mapFunnelError` has no entry for "permission denied for function ...", and
 * the three read-first actions collapse PostgREST's `PGRST116` the same way.
 * `judge()` cannot grade either -- `APP-GENERIC` is deliberately not in its
 * vocabulary, because a probe with WRONG ARGUMENTS returns exactly the same
 * string, and letting that clear a deny expectation is the false-all-clear this
 * audit exists to avoid.
 *
 * What can be checked, per cell, is the two-part argument that separates them:
 *
 *   1. The action REFUSED -- it returned `ok:false`, so it did not perform its
 *      work. (The state assertions say the same thing from the other side: the
 *      target row is byte-identical afterwards.)
 *   2. The arguments are NOT the problem -- the identical argument builder,
 *      against an identically minted fresh target, was accepted for at least one
 *      ALLOWED actor of the same action. Since the only field that differs
 *      between those two requests is the session cookie, the refusal is about
 *      who called, not about what was sent.
 *
 * That is recorded by name for every such cell rather than folded into the
 * verdict: the ledger keeps saying `needs-live-proof`, which is the honest
 * reading of what `judge()` can see, and the evidence lives where a reader can
 * check it.
 */
export function genericRefusalAssertions(validity) {
  const succeededByAction = new Map();
  for (const v of validity) {
    if (v.allow.includes(v.actor) && v.code === null) {
      succeededByAction.set(v.action, (succeededByAction.get(v.action) ?? 0) + 1);
    }
  }
  const out = [];
  for (const v of validity) {
    if (v.code !== "APP-GENERIC" || v.allow.includes(v.actor)) continue;
    const succeeded = succeededByAction.get(v.action) ?? 0;
    out.push({
      assertion: `action:${v.action}.generic-refusal-is-real`,
      actor: v.actor,
      expected:
        "the action returned ok:false AND the identical arguments were accepted for an allowed " +
        "actor — so the generic message is a refusal of the CALLER, not a rejection of the payload",
      observed: `refused: ${v.refused}; allowed actors that succeeded with the same arguments: ${succeeded}`,
      ok: v.refused === true && succeeded > 0,
    });
  }
  return out;
}

/**
 * The check that separates "this actor was refused" from "this probe was
 * broken". Called by the runner after the matrix.
 */
export function probeValidityAssertions(validity) {
  const byAction = new Map();
  for (const v of validity) {
    if (!byAction.has(v.action)) byAction.set(v.action, []);
    byAction.get(v.action).push(v);
  }
  const out = [];
  for (const [action, rows] of byAction) {
    const allowed = rows.filter((r) => r.allow.includes(r.actor));
    const informative = allowed.filter(
      (r) =>
        r.code !== "APP-GENERIC" &&
        r.code !== "APP-UNMAPPED" &&
        !String(r.code).startsWith("HTTP-"),
    );
    out.push({
      assertion: `action:${action}.probe-is-valid`,
      actor: "—",
      expected:
        "at least one allowed actor gets a result that is NOT the generic error — otherwise the " +
        "arguments or the encoding are wrong and this action's deny cells prove nothing",
      observed: `${informative.length}/${allowed.length} allowed actors returned an informative result`,
      ok: informative.length > 0,
    });
  }
  return out;
}
