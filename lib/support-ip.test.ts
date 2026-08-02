import { describe, expect, it } from "vitest";
import { hashIp } from "./support-ip";

const SECRET = "test-service-key";

describe("hashIp", () => {
  it("returns null when there is no forwarded address", () => {
    expect(hashIp(null, SECRET)).toBeNull();
    expect(hashIp("", SECRET)).toBeNull();
    expect(hashIp("   ", SECRET)).toBeNull();
  });

  it("returns null when the secret is absent, rather than hashing weakly", () => {
    expect(hashIp("203.0.113.7", undefined)).toBeNull();
  });

  it("uses only the first address in a proxy chain", () => {
    expect(hashIp("203.0.113.7, 198.51.100.4", SECRET)).toBe(hashIp("203.0.113.7", SECRET));
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
