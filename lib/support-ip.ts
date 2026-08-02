import { createHmac } from "node:crypto";

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
export function hashIp(forwardedFor: string | null, secret: string | undefined): string | null {
  if (!secret) return null;
  const first = forwardedFor?.split(",")[0]?.trim();
  if (!first) return null;
  return createHmac("sha256", secret).update(`support-ip:${first}`).digest("hex");
}
