/**
 * Task 8: the one HTTP endpoint surface -- `GET /api/dev/otp`
 * (app/api/dev/otp/route.ts).
 *
 * ## What the census cell asks
 * "Can this actor obtain a live sign-in code for an account that already
 * exists?" That is the account-takeover question the R1 hardening exists to
 * answer, and the answer must be no for all twelve. The probe therefore aims at
 * a phone that BOTH has a `profiles` row AND has a fresh, real-shaped row
 * waiting in `dev_otp_inbox` -- otherwise a 404 would prove only that there was
 * no code to leak, not that the gate withheld one. Expectation: `deny` x12.
 *
 * ## The three properties recorded beyond the verdict
 * The endpoint has NO authentication of any kind -- it is reachable by anyone
 * who can reach the origin, in `development` and `preview` only
 * (`NEXT_PUBLIC_APP_ENV` gate, line 5-8). That is by design for a dev helper, so
 * "every actor reaches it" is not itself the finding. Three separate properties
 * are, and none of them is expressible as a per-actor verdict, so each is
 * recorded as a named assertion instead:
 *
 *   1. BODY ORACLE. The two 404s are distinguishable. A phone WITH a profile is
 *      refused `{"error":"not found"}` at line 43; a phone with NO profile and
 *      no pending code falls through the retry loop to `{"error":"no otp"}` at
 *      line 57. Anyone may therefore ask "does this number have an account?"
 *      and read the answer off the body.
 *   2. TIMING ORACLE, which survives fixing the first. The profile-exists branch
 *      returns immediately; the no-profile branch first polls ten times at 500ms
 *      (lines 47-56) before giving up. Unifying the two bodies would leave a
 *      ~5-second gap answering the same question. Measured here, not asserted.
 *   3. UNAUTHENTICATED SERVICE-ROLE DELETE. Lines 17-20 run
 *      `admin.from("dev_otp_inbox").delete().lt("created_at", now-1h)` with the
 *      service-role key, BEFORE any check -- before the env gate has any bearing
 *      on it, before the phone is even validated. Any unauthenticated caller can
 *      drive an unbounded number of service-role DELETEs against that table.
 *
 * ## Four cases, because two of them are the control
 * A: profile + code  -> the hardening. Must withhold. (the census cell)
 * B: no profile + code -> must SERVE the code. This is the control: without it,
 *    case A withholding proves nothing -- an endpoint that is simply broken
 *    would also withhold. It is also the documented, intended behaviour (a
 *    brand-new signup has no profile row at OTP time).
 * C: profile, no code -> fast 404 "not found".
 * D: no profile, no code -> slow 404 "no otp". C vs D is the oracle.
 *
 * ## Fixtures
 * Both phones are synthetic and audit-owned. The with-profile phone is one of
 * arguments.mjs's twelve disposable victims (+9955090020001), chosen because
 * victims are documented never to receive a real OTP -- so a synthetic inbox row
 * for one of them cannot collide with any real sign-in, including a concurrent
 * `provisionActors()` mint. The no-profile phone (+9955090029999) is checked
 * live for absence before use. Every `dev_otp_inbox` row this module writes is
 * removed in teardown, whatever the outcome.
 */
import { db } from "./db.mjs";
import { outcomeAdmitted, outcomeDeniedByPrivilege, outcomeFromTransport } from "./app-outcome.mjs";
import { cookieHeaderFor } from "./app-session.mjs";

/** Marked so a stray row is obviously the audit's, never a real sign-in code. */
const SYNTHETIC_OTP = "424242";
const NO_PROFILE_PHONE = "+9955090029999";

async function get(base, phone, cookie) {
  const startedAt = Date.now();
  const res = await fetch(`${base}/api/dev/otp?phone=${encodeURIComponent(phone)}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON body is itself evidence; `text` is kept */
  }
  return { status: res.status, body, text: text.slice(0, 300), elapsedMs: Date.now() - startedAt };
}

async function putCode(phone) {
  await db.from("dev_otp_inbox").delete().eq("phone", phone);
  const { error } = await db.from("dev_otp_inbox").insert({ phone, otp: SYNTHETIC_OTP });
  if (error) throw new Error(`could not stage a dev_otp_inbox row for ${phone}: ${error.message}`);
}

const clearCode = (phone) => db.from("dev_otp_inbox").delete().eq("phone", phone);

/**
 * Confirms the two fixture phones really are in the states the four cases
 * assume. Grading case A as "the hardening held" when the phone had no profile
 * row would be exactly the class of defect this audit keeps hitting: a probe
 * that failed for the wrong reason looking like a defence.
 */
async function assertFixtureStates(withProfilePhone) {
  const { data: has, error: e1 } = await db
    .from("profiles")
    .select("id")
    .eq("phone", withProfilePhone)
    .maybeSingle();
  if (e1) throw new Error(`fixture check failed: ${e1.message}`);
  if (!has) {
    throw new Error(
      `endpoint fixture ${withProfilePhone} has NO profiles row -- case A would pass vacuously. ` +
        "Run the Pass 2b census first so the victim pool exists.",
    );
  }
  const { data: hasnt, error: e2 } = await db
    .from("profiles")
    .select("id")
    .in("phone", [NO_PROFILE_PHONE, NO_PROFILE_PHONE.slice(1)])
    .maybeSingle();
  if (e2) throw new Error(`fixture check failed: ${e2.message}`);
  if (hasnt) {
    throw new Error(`endpoint fixture ${NO_PROFILE_PHONE} unexpectedly HAS a profiles row`);
  }
}

/**
 * Returns { cells, assertions }. `cells` is one ProbeOutcome per actor for
 * `endpoint:GET /api/dev/otp`; `assertions` are the oracle + hygiene results.
 */
export async function probeOtpEndpoint(base, actors, actorIds, withProfilePhone) {
  await assertFixtureStates(withProfilePhone);
  const assertions = [];
  const cells = {};

  try {
    // ---- the census cell: case A, once per actor --------------------------
    await putCode(withProfilePhone);
    for (const actor of actorIds) {
      const cookie = await cookieHeaderFor(actors[actor].accessToken, actors[actor].userId);
      const r = await get(base, withProfilePhone, cookie);
      const raw = { case: "A: profile + live code", ...r };
      if (r.status === 200 && r.body?.otp) {
        // A code for an account that exists. Threat D5, Critical.
        cells[actor] = outcomeAdmitted(1, raw);
      } else if (r.status === 404 && r.body?.error === "not found") {
        cells[actor] = outcomeDeniedByPrivilege(
          "dev-OTP endpoint withheld the code: a profiles row exists for this phone (route.ts:42-44)",
          raw,
        );
      } else {
        cells[actor] = outcomeFromTransport(
          r.status,
          `unexpected dev-OTP response: ${r.text}`,
          raw,
        );
      }
      assertions.push({
        assertion: "endpoint:dev-otp.withholds-code-for-existing-profile",
        actor,
        expected: '404 {"error":"not found"} — the code is never served',
        observed: `${r.status} ${r.text}`,
        ok: r.status === 404 && r.body?.error === "not found",
      });
    }

    // ---- case B: the control ---------------------------------------------
    await putCode(NO_PROFILE_PHONE);
    const b = await get(base, NO_PROFILE_PHONE, "");
    assertions.push({
      assertion: "endpoint:dev-otp.serves-code-when-no-profile",
      actor: "A1",
      expected: `200 {"otp":"${SYNTHETIC_OTP}"} — the control: proves case A withheld rather than merely failed`,
      observed: `${b.status} ${b.text} (${b.elapsedMs}ms)`,
      ok: b.status === 200 && b.body?.otp === SYNTHETIC_OTP,
    });
    await clearCode(NO_PROFILE_PHONE);

    // ---- cases C and D: the oracle, body and timing ----------------------
    await clearCode(withProfilePhone);
    const c = await get(base, withProfilePhone, "");
    const d = await get(base, NO_PROFILE_PHONE, "");

    assertions.push({
      assertion: "endpoint:dev-otp.body-oracle",
      actor: "A1",
      expected:
        "IDENTICAL bodies for a phone that has an account and one that does not — " +
        "anything else answers 'does this number have an account?' to any caller",
      observed: `has-account: ${c.status} ${c.text} | no-account: ${d.status} ${d.text}`,
      ok: c.text === d.text,
      finding: c.text === d.text ? undefined : "D5/R2 — account-existence oracle (response body)",
    });

    // Timing is measured three times per branch and reported as a median, so a
    // single slow round-trip cannot manufacture (or hide) a gap.
    const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const hasTimes = [c.elapsedMs];
    const notTimes = [d.elapsedMs];
    for (let i = 0; i < 2; i++) {
      hasTimes.push((await get(base, withProfilePhone, "")).elapsedMs);
      notTimes.push((await get(base, NO_PROFILE_PHONE, "")).elapsedMs);
    }
    const hasMed = median(hasTimes);
    const notMed = median(notTimes);
    assertions.push({
      assertion: "endpoint:dev-otp.timing-oracle",
      actor: "A1",
      expected:
        "no measurable timing difference between a phone that has an account and one that " +
        "does not (< 250ms) — this oracle SURVIVES unifying the two response bodies",
      observed:
        `has-account median ${hasMed}ms (${hasTimes.join("/")}), ` +
        `no-account median ${notMed}ms (${notTimes.join("/")}), gap ${notMed - hasMed}ms`,
      ok: Math.abs(notMed - hasMed) < 250,
      finding:
        Math.abs(notMed - hasMed) < 250
          ? undefined
          : "D5/R2 — account-existence oracle (response timing, independent of the body)",
    });

    // ---- the unauthenticated service-role DELETE -------------------------
    // Proven by construction, not by damaging real data: an hour-old row is
    // staged for a phone nothing else uses, an ANONYMOUS request is made, and
    // the row is checked afterwards. Only the endpoint could have removed it —
    // the anon caller holds no delete grant on this table (Pass 2a: zero rows
    // even readable).
    const stalePhone = "+9955090029998";
    await db.from("dev_otp_inbox").delete().eq("phone", stalePhone);
    const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { error: staleErr } = await db
      .from("dev_otp_inbox")
      .insert({ phone: stalePhone, otp: SYNTHETIC_OTP, created_at: staleAt });
    if (staleErr) throw new Error(`could not stage the stale row: ${staleErr.message}`);
    await get(base, NO_PROFILE_PHONE, ""); // one anonymous, unauthenticated call
    const { data: survivors } = await db.from("dev_otp_inbox").select("id").eq("phone", stalePhone);
    assertions.push({
      assertion: "endpoint:dev-otp.no-unauthenticated-service-role-write",
      actor: "A1",
      expected:
        "an anonymous GET performs no service-role write — the hour-old row survives " +
        "(route.ts:17-20 runs a service-role DELETE before any check, including the env gate's)",
      observed:
        (survivors?.length ?? 0) > 0
          ? "the stale row survived"
          : "the stale row was DELETED by an unauthenticated GET",
      ok: (survivors?.length ?? 0) > 0,
      finding:
        (survivors?.length ?? 0) > 0
          ? undefined
          : "R2 — unauthenticated caller drives an unbounded service-role DELETE on dev_otp_inbox",
    });
    await db.from("dev_otp_inbox").delete().eq("phone", stalePhone);
  } finally {
    await clearCode(withProfilePhone);
    await clearCode(NO_PROFILE_PHONE);
    await db.from("dev_otp_inbox").delete().eq("phone", "+9955090029998");
  }

  return { cells, assertions };
}
