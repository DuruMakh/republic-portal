import { describe, expect, it } from "vitest";
import { resolvePublishSlug } from "./publish-slug";
import { SLUG_MAX } from "./slug";

describe("resolvePublishSlug", () => {
  it("reuses an existing slug without fetching", async () => {
    const slug = await resolvePublishSlug({
      title: "ახალი ამბები",
      fallback: "article",
      existingSlug: "akhali-ambebi",
      fetchTaken: async () => {
        throw new Error("must not fetch");
      },
    });
    expect(slug).toBe("akhali-ambebi");
  });
  it("mints against the taken set", async () => {
    const slug = await resolvePublishSlug({
      title: "ახალი ამბები",
      fallback: "article",
      existingSlug: null,
      fetchTaken: async () => ["akhali-ambebi"],
    });
    expect(slug).toBe("akhali-ambebi-2");
  });
  it("null on a taken-set query failure", async () => {
    const slug = await resolvePublishSlug({
      title: "x",
      fallback: "article",
      existingSlug: null,
      fetchTaken: async () => null,
    });
    expect(slug).toBeNull();
  });

  it("at the 80-char cap, the fetch prefix still covers truncated-suffix candidates", async () => {
    // an 80-char base: suffixed candidates truncate ("-2" → first 78 chars + "-2"),
    // so they no longer start with the full base — the fetch scope must shrink with them
    const base = "a".repeat(SLUG_MAX);
    const truncatedTwo = `${base.slice(0, SLUG_MAX - 2)}-2`;
    const prefixes: string[] = [];
    const slug = await resolvePublishSlug({
      title: base, // already-latin: slugFrom passes it through
      fallback: "article",
      existingSlug: null,
      fetchTaken: async (prefix) => {
        prefixes.push(prefix);
        return [base, truncatedTwo]; // both live rows must be visible to the mint
      },
    });
    // the resolver must see truncatedTwo (it starts with the requested prefix)…
    expect(truncatedTwo.startsWith(prefixes[0]!)).toBe(true);
    expect(base.startsWith(prefixes[0]!)).toBe(true);
    // …and therefore mint the NEXT free candidate instead of re-minting "-2"
    expect(slug).toBe(`${base.slice(0, SLUG_MAX - 2)}-3`);
    expect(slug!.length).toBeLessThanOrEqual(SLUG_MAX);
  });
});
