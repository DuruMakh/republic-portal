/**
 * Task 8: turning one of the twelve audit actors into a browser-shaped
 * credential the running Next.js app will accept.
 *
 * ## Why this file exists
 * Every other probe in this audit talks straight to PostgREST with an
 * `Authorization: Bearer <jwt>` header (scripts/security/actors.mjs's
 * `actorClient`). Server Actions cannot be reached that way: the app builds its
 * Supabase client from COOKIES (`lib/supabase/server.ts` ->
 * `createServerClient({ cookies })`), so an actor that holds only a bearer token
 * is anonymous as far as a Server Action is concerned. Pass 2c therefore needs
 * the same twelve identities expressed as the exact cookie set
 * `@supabase/ssr` writes at sign-in.
 *
 * ## The cookie is BUILT BY @supabase/ssr ITSELF, never hand-formatted
 * The obvious implementation -- base64 the session JSON under
 * `sb-<projectRef>-auth-token` -- is a guess about a private encoding that has
 * changed at least twice upstream (raw JSON -> `base64-` prefix -> chunked
 * `.0`/`.1` suffixes past the 3180-byte cookie limit). A guess that is subtly
 * wrong does not fail loudly: the app simply sees no session, every probe comes
 * back `not_authenticated`, and 492 cells report a defence that was never
 * tested. So this module does not format anything. It instantiates the app's OWN
 * `createServerClient` from the app's OWN installed @supabase/ssr, against an
 * in-memory jar, calls `setSession()`, and hands back whatever cookies that
 * library decided to write. Chunking, naming and encoding are therefore correct
 * by construction and stay correct across upgrades.
 *
 * ## No OTP is sent
 * `provisionActors()` (actors.mjs) hands back an access token per actor, backed
 * by the on-disk session cache. This module consumes those tokens and mints
 * nothing: a full Pass 2c run sends ZERO SMS. That is a hard requirement, not a
 * nicety -- Supabase throttles OTP sends per phone at ~60s and the audit's
 * twelve phones are shared with every other task in the phase.
 *
 * `refresh_token` is deliberately a dead string. supabase-js requires the field
 * to be non-empty but only ever USES it when the access token is at or past
 * expiry, and `getValidCachedSession()` already refuses to hand out a token
 * with less than five minutes of life left. A dead refresh token is the safer
 * choice here: it makes it impossible for a probe to silently rotate an actor's
 * real session out from under a concurrently-running task.
 *
 * ## A1 is the absence of a cookie, not a special cookie
 * `cookieHeaderFor(null)` returns `""` and the caller omits the header
 * entirely, which is exactly what an anonymous request looks like.
 */
import { createServerClient } from "@supabase/ssr";
import { url, anonKey } from "./db.mjs";

/**
 * The cookie header a browser signed in as this actor would send.
 * `accessToken` null (A1) -> "" -- send no cookie header at all.
 *
 * `expectUserId`, when supplied, is compared against the id the session
 * actually decodes to. That is the first half of the identity guarantee (see
 * verifyCookieIdentity for the second): it proves the jar carries the RIGHT
 * actor, not merely a valid one. Without it, a cache entry written under the
 * wrong phone would probe twelve cells as the wrong person and every verdict
 * would be confidently wrong.
 */
export async function cookieHeaderFor(accessToken, expectUserId = null) {
  if (!accessToken) return "";
  const jar = [];
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar.slice(),
      setAll: (list) => {
        for (const { name, value } of list) {
          const i = jar.findIndex((c) => c.name === name);
          if (i >= 0) jar[i] = { name, value };
          else jar.push({ name, value });
        }
      },
    },
  });
  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: "audit-no-refresh",
  });
  if (error) throw new Error(`setSession failed while building a cookie jar: ${error.message}`);
  if (!data?.user?.id) {
    throw new Error(
      "setSession returned no user -- the cached access token is stale or rejected. " +
        "Re-run `npm run security:actors` before probing; do NOT grade a run on this.",
    );
  }
  if (expectUserId && data.user.id !== expectUserId) {
    throw new Error(
      `cookie jar identity mismatch: the cached session decodes to ${data.user.id} but the actor ` +
        `is ${expectUserId}. Probing with it would attribute twelve cells to the wrong person.`,
    );
  }
  if (jar.length === 0) {
    throw new Error("@supabase/ssr wrote no cookies for a valid session -- refusing to probe");
  }
  return jar.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** The same jar as a Playwright-shaped cookie array (capture step only). */
export async function playwrightCookiesFor(accessToken, domain = "localhost") {
  const header = await cookieHeaderFor(accessToken);
  if (!header) return [];
  return header.split("; ").map((pair) => {
    const i = pair.indexOf("=");
    return { name: pair.slice(0, i), value: pair.slice(i + 1), domain, path: "/" };
  });
}

/**
 * Where `/me` sends each actor, computed by the app itself.
 *
 * `/me` is not a page so much as a router: `deriveDestination(cabinet_state())`
 * reads the CALLER'S OWN standing out of the database and 307s accordingly. The
 * destination is therefore a per-actor fingerprint the app produces from the
 * session it actually resolved -- which makes it a far stronger identity check
 * than "did it return 200". A jar carrying the wrong actor, or a stale jar the
 * app silently ignored, lands somewhere else on this table.
 *
 * Read off the live app, then reconciled against each actor's declared standing
 * in actors.mjs's ACTORS table -- they agree exactly, which is the point:
 *   A1  anonymous                 -> /login   (no session at all)
 *   A2  signed in, no profile     -> /join    (register() has not run)
 *   A3  registered                -> 200      (the registered cabinet renders here)
 *   A4-A6, A8-A12  completed      -> /me/profile
 *   A7  approved delegate         -> /delegate (the delegate cabinet)
 */
const ME_DESTINATION = {
  A1: "/login",
  A2: "/join",
  A3: null, // renders in place, no redirect
  A4: "/me/profile",
  A5: "/me/profile",
  A6: "/me/profile",
  A7: "/delegate",
  A8: "/me/profile",
  A9: "/me/profile",
  A10: "/me/profile",
  A11: "/me/profile",
  A12: "/me/profile",
};

/**
 * Proves, before any cell is graded, that each cookie jar authenticates as the
 * actor it claims to be -- against the RUNNING APP, not against Supabase.
 *
 * This is the check that makes the whole pass meaningful. Every "the caller was
 * refused" verdict below is only evidence if the caller was actually IDENTIFIED
 * first; a jar that silently failed to authenticate would produce a clean sweep
 * of refusals that looks exactly like a perfect defence. Two independent halves:
 *
 *   1. `cookieHeaderFor(token, expectedId)` fails unless the session decodes to
 *      the id actors.mjs minted -- the jar carries the right PERSON.
 *   2. `/me` must route this jar to that actor's declared destination -- the
 *      RUNNING APP resolved that person, from the cookie, through its own
 *      cabinet_state() read.
 *
 * An early version of this check asserted only "not a redirect", and failed ten
 * of twelve actors on correct behaviour: /me redirects by standing for everyone
 * except A3. Recording the destination instead of merely its absence turns the
 * same request into the stronger check.
 */
export async function verifyCookieIdentity(base, actors, actorIds) {
  const out = [];
  for (const actor of actorIds) {
    const cookie = await cookieHeaderFor(actors[actor].accessToken, actors[actor].userId);
    const res = await fetch(`${base}/me`, {
      headers: cookie ? { cookie } : {},
      redirect: "manual",
    });
    const location = res.headers.get("location");
    const want = ME_DESTINATION[actor];
    const ok = want === null ? res.status === 200 : location === want;
    out.push({
      assertion: "app-session.cookie-resolves-to-this-actor",
      actor,
      expected:
        `the app routes /me to ${want ?? "200 (renders in place)"} for this actor's standing, ` +
        "and the session decodes to this actor's own user id",
      observed: `GET /me -> ${res.status}${location ? ` -> ${location}` : ""}`,
      ok,
    });
  }
  return out;
}
