import { describe, expect, it } from "vitest";
import { resolvePublishSlug } from "./publish-slug";

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
});
