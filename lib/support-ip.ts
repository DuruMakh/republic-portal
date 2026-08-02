import { createHmac } from "node:crypto";

/**
 * Headers the PLATFORM sets, in preference order. A client can put anything in
 * `x-forwarded-for` -- the leftmost entry of that chain is literally whatever
 * the sender typed -- so keying a rate limit on it lets an attacker mint a
 * fresh identity per request and defeat the limit from an ordinary browser.
 * These two are written by the edge and are not settable by the caller.
 */
const PLATFORM_IP_HEADERS = ["x-vercel-forwarded-for", "x-real-ip"] as const;

/**
 * Best available client address, or null when none can be trusted.
 *
 * `x-forwarded-for` is the LAST resort and is read leftmost, which is correct
 * only because the edge in front of this app overwrites the header rather than
 * appending to it. That assumption is why the platform headers are preferred:
 * where they exist, no assumption is needed.
 */
export function clientIp(get: (name: string) => string | null): string | null {
  for (const header of PLATFORM_IP_HEADERS) {
    const value = get(header)?.trim();
    if (value) return value;
  }
  const chain = get("x-forwarded-for");
  if (!chain) return null;
  const first = chain
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return first ?? null;
}

/**
 * Salted hash of a visitor's address, for the support form's rate limit.
 *
 * The salt is DERIVED from a secret the app already holds rather than read
 * from a new environment variable, so the page needs no deployment setup
 * (spec §5). HMAC output never reveals its key, so this neither weakens nor
 * exposes that credential. When the secret is absent the function returns
 * null -- rate limiting simply does not engage -- because storing a
 * weakly-salted address hash would be worse than storing nothing: the IPv4
 * space is small enough to brute-force.
 */
export function hashIp(ip: string | null, secret: string | undefined): string | null {
  if (!secret) return null;
  const trimmed = ip?.trim();
  if (!trimmed) return null;
  return createHmac("sha256", secret).update(`support-ip:${trimmed}`).digest("hex");
}
