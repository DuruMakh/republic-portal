/**
 * Task 8: the two Storage buckets -- `delegate-photos` and `news-images`.
 *
 * ## The question is WRITE, not read
 * Both buckets are created `public => true` on purpose
 * (20260717150000_admin_crm.sql:1014, 20260719150000_community.sql:827) and
 * both migrations say the same thing in a comment: "public read; writes only via
 * the service-role upload action". Neither migration creates a single
 * `storage.objects` policy, so no client role should be able to put an object
 * in either bucket -- including A12, the editor, whose legitimate route is
 * `setNewsCoverAction` (which uploads with the SERVICE ROLE after re-checking
 * the role, never with the caller's own credentials).
 *
 * Expectation: `deny` x12 on both buckets. Any success is a finding.
 *
 * ## Three verbs, not one
 * The census cell is INSERT (upload), because that is the verb the design note
 * is about. But `storage.objects` is one table with one policy set, and a
 * missing policy on SELECT/DELETE would be just as real, so `list` and `delete`
 * are probed too and recorded as named assertions. Probing only the verb you
 * expect to be blocked is how a hole in a sibling verb survives an audit.
 *
 * ## The public-read control
 * A refusal only means something if the bucket was reachable in the first
 * place. So before the write probes, one object is uploaded SERVICE-SIDE and
 * fetched anonymously over its public URL. If that fetch works, the bucket
 * exists, is public, and is serving -- which makes every subsequent client-side
 * write refusal a statement about the policy rather than about the bucket. The
 * control object is removed immediately afterwards, whatever happened.
 *
 * ## Residue
 * If a client write ever DOES land, the object is deleted with the service role
 * in the same pass and recorded, because leaving an attacker-shaped object in a
 * public bucket to prove a point is not acceptable even on staging.
 */
import { db } from "./db.mjs";
import { outcomeAdmitted, outcomeDeniedByPrivilege, outcomeFromTransport } from "./app-outcome.mjs";

export const BUCKETS = ["delegate-photos", "news-images"];

/** Marked so anything that survives is unmistakably the audit's. */
const PREFIX = "secaudit";
const PAYLOAD = "security-audit-2026-07 pass 2c write probe";

/**
 * A Storage refusal is only a defence when it is THE refusal we predicted.
 * Storage answers an RLS denial with 4xx and a message naming the row-level
 * policy (or a bare `Unauthorized` from the API gateway). Anything else -- a
 * 404 for a missing bucket, a 413, a network error -- is a probe defect wearing
 * a defence's clothes, and is deliberately NOT allowed to clear a deny
 * expectation.
 */
const RLS_REFUSAL = /row-level security|Unauthorized|not authorized|violates row-level/i;

function classify(error, raw) {
  const status = Number(error.statusCode ?? error.status ?? 0);
  if ([400, 401, 403].includes(status) && RLS_REFUSAL.test(error.message ?? "")) {
    return outcomeDeniedByPrivilege(
      `storage refused the write: ${error.message} (HTTP ${status})`,
      raw,
    );
  }
  return outcomeFromTransport(
    status || "unknown",
    `unexpected storage error: ${error.message}`,
    raw,
  );
}

async function publicReadControl(bucket) {
  const path = `${PREFIX}-control-${Date.now()}.txt`;
  const { error: upErr } = await db.storage
    .from(bucket)
    .upload(path, new Blob([PAYLOAD]), { contentType: "text/plain" });
  if (upErr) {
    return {
      assertion: `bucket:${bucket}.public-read-control`,
      actor: "A1",
      expected: "a service-role object is fetchable anonymously over its public URL",
      observed: `service-role upload itself failed: ${upErr.message}`,
      ok: false,
      unproven: true,
      why: "the control could not be staged, so the write refusals below are not yet distinguishable from an unreachable bucket",
    };
  }
  const url = db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const res = await fetch(url);
  const body = await res.text();
  await db.storage.from(bucket).remove([path]);
  return {
    assertion: `bucket:${bucket}.public-read-control`,
    actor: "A1",
    expected:
      "200 and the exact bytes — public read is by design, and it is what makes the write " +
      "refusals below a statement about the policy rather than about the bucket",
    observed: `${res.status}, body matches: ${body === PAYLOAD}`,
    ok: res.status === 200 && body === PAYLOAD,
  };
}

/** Returns { cells, assertions, residue }. `cells` is keyed bucket -> actor. */
export async function probeBuckets(clients, actorIds) {
  const cells = {};
  const assertions = [];
  const residue = [];

  for (const bucket of BUCKETS) {
    assertions.push(await publicReadControl(bucket));
    cells[bucket] = {};

    for (const actor of actorIds) {
      const path = `${PREFIX}-${actor}-${Date.now()}.txt`;
      const client = clients[actor];

      // --- the census cell: INSERT -------------------------------------
      const { data, error } = await client.storage
        .from(bucket)
        .upload(path, new Blob([PAYLOAD]), { contentType: "text/plain" });
      const raw = {
        verb: "upload",
        bucket,
        path,
        status: error ? (error.statusCode ?? error.status ?? null) : 200,
        message: error?.message ?? null,
      };
      if (!error) {
        cells[bucket][actor] = outcomeAdmitted(1, raw);
        residue.push({
          kind: "storage.object",
          id: `${bucket}/${data?.path ?? path}`,
          surface: `bucket:${bucket}`,
          actor,
          note: "UPLOADED BY A CLIENT ROLE — a finding; removed service-side immediately",
          at: new Date().toISOString(),
        });
        await db.storage.from(bucket).remove([data?.path ?? path]);
      } else {
        cells[bucket][actor] = classify(error, raw);
      }
      assertions.push({
        assertion: `bucket:${bucket}.no-client-write`,
        actor,
        expected: "refused — neither migration creates a storage.objects INSERT policy",
        observed: error ? `${raw.status} ${error.message}` : "UPLOAD SUCCEEDED",
        ok: Boolean(error),
      });

      // --- sibling verbs: list and delete -------------------------------
      const { data: listed, error: listErr } = await client.storage.from(bucket).list("", {
        limit: 5,
      });
      assertions.push({
        assertion: `bucket:${bucket}.no-client-list`,
        actor,
        expected: "no object names — no storage.objects SELECT policy exists for a client role",
        observed: listErr ? `refused: ${listErr.message}` : `${listed?.length ?? 0} object(s)`,
        ok: Boolean(listErr) || (listed?.length ?? 0) === 0,
      });

      const { data: removed, error: rmErr } = await client.storage
        .from(bucket)
        .remove([`${PREFIX}-does-not-exist.txt`]);
      assertions.push({
        assertion: `bucket:${bucket}.no-client-delete`,
        actor,
        expected:
          "no object removed — probed against a name that does not exist, so a permitted " +
          "DELETE returns an empty set and destroys nothing either way",
        observed: rmErr ? `refused: ${rmErr.message}` : `${removed?.length ?? 0} object(s) removed`,
        ok: Boolean(rmErr) || (removed?.length ?? 0) === 0,
      });
    }
  }

  return { cells, assertions, residue };
}
