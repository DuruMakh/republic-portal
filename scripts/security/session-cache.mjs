/**
 * On-disk cache for minted OTP sessions, keyed by phone.
 *
 * These are staging tokens for synthetic audit accounts on a non-production
 * Supabase project — caching them to disk is an acceptable convenience HERE,
 * for THIS narrow purpose. Do not copy this pattern to persist real user
 * sessions, production credentials, or anything else auth-shaped: writing
 * bearer tokens to disk is not a general-purpose technique, it is a
 * deliberate, scoped tradeoff against a per-phone OTP throttle that would
 * otherwise compound across every later census task in this audit phase.
 *
 * Lives under .superpowers/sdd/ (git-ignored — .gitignore:13, confirmed with
 * `git check-ignore`). Never under .env*, never committed, never containing
 * the service-role key or any other non-session secret.
 *
 * Every function here degrades to "no cache" on any error (missing file,
 * unreadable, corrupt JSON, unexpected shape) rather than throwing — a bad
 * cache file must never crash provisioning, only cost it a fresh mint.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// A URL object, passed straight to fs's read/write calls below (Node accepts
// file:// URLs natively and cross-platform — same idiom as seed-roster.json's
// own load in scripts/seed-staging.mjs). fileURLToPath is only needed for the
// one call, mkdirSync's dirname, that requires a plain string.
const CACHE_URL = new URL("../../.superpowers/sdd/actor-session-cache.json", import.meta.url);
const CACHE_DIR = dirname(fileURLToPath(CACHE_URL));

// Reuse a cached session only while it still has this much life left. Supabase's
// default access-token lifetime is 1 hour; this is a safety margin, not a guess
// at that lifetime — the real expiry always comes from the session itself
// (session.expires_at, epoch seconds), never assumed.
const SAFETY_MARGIN_SECONDS = 5 * 60;

function readCache() {
  try {
    const raw = readFileSync(CACHE_URL, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    return {}; // missing, unreadable, or corrupt — degrade to "no cache"
  }
}

/** The cached access_token for `phone`, or null if there is none / it is missing / it is too close to expiry. */
export function getValidCachedSession(phone) {
  const entry = readCache()[phone];
  if (!entry || typeof entry.accessToken !== "string" || typeof entry.expiresAt !== "number") {
    return null;
  }
  const nowSeconds = Date.now() / 1000;
  if (nowSeconds >= entry.expiresAt - SAFETY_MARGIN_SECONDS) return null;
  return entry.accessToken;
}

/**
 * Merges newly-minted {phone: {accessToken, expiresAt}} entries into the
 * on-disk cache in ONE read-modify-write. Callers collect every session
 * minted during a run and flush once at the end (rather than once per
 * phone) specifically to avoid a read-modify-write race: sessions are
 * minted in parallel, and two concurrent per-phone writes could otherwise
 * clobber each other. Best-effort: a failed write is swallowed, never
 * thrown — losing the cache costs a future mint, not this run.
 */
export function mergeCacheEntries(newEntries) {
  if (!newEntries || Object.keys(newEntries).length === 0) return;
  try {
    const merged = { ...readCache(), ...newEntries };
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_URL, JSON.stringify(merged, null, 2), "utf8");
  } catch {
    // best-effort — see function comment
  }
}
