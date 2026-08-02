import { describe, expect, it } from "vitest";
import { clientIp, hashIp } from "./support-ip";

const SECRET = "test-service-key";

/** Header bag helper: `headers({ "x-real-ip": "..." })` -> a get(name) function. */
const headers =
  (bag: Record<string, string>) =>
  (name: string): string | null =>
    bag[name] ?? null;

describe("clientIp", () => {
  it("prefers the platform header over the forwardable chain", () => {
    const get = headers({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "1.2.3.4, 203.0.113.7",
    });
    expect(clientIp(get)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip before the chain", () => {
    const get = headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" });
    expect(clientIp(get)).toBe("203.0.113.7");
  });

  it("uses the chain only when no platform header is present", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7, 198.51.100.4" }))).toBe(
      "203.0.113.7",
    );
  });

  it("ignores blank platform headers rather than trusting an empty string", () => {
    const get = headers({ "x-vercel-forwarded-for": "   ", "x-forwarded-for": "203.0.113.7" });
    expect(clientIp(get)).toBe("203.0.113.7");
  });

  it("returns null when nothing identifies the caller", () => {
    expect(clientIp(headers({}))).toBeNull();
    expect(clientIp(headers({ "x-forwarded-for": "" }))).toBeNull();
    expect(clientIp(headers({ "x-forwarded-for": " , , " }))).toBeNull();
  });
});

describe("hashIp", () => {
  it("returns null when there is no address", () => {
    expect(hashIp(null, SECRET)).toBeNull();
    expect(hashIp("", SECRET)).toBeNull();
    expect(hashIp("   ", SECRET)).toBeNull();
  });

  it("returns null when the secret is absent, rather than hashing weakly", () => {
    expect(hashIp("203.0.113.7", undefined)).toBeNull();
  });

  it("is stable for one address and differs across addresses", () => {
    expect(hashIp("203.0.113.7", SECRET)).toBe(hashIp("203.0.113.7", SECRET));
    expect(hashIp("203.0.113.7", SECRET)).not.toBe(hashIp("203.0.113.8", SECRET));
  });

  it("changes with the secret, so a key rotation resets the window", () => {
    expect(hashIp("203.0.113.7", SECRET)).not.toBe(hashIp("203.0.113.7", "other-key"));
  });

  it("never contains the raw address", () => {
    const hash = hashIp("203.0.113.7", SECRET);
    expect(hash).not.toBeNull();
    expect(hash).not.toContain("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
