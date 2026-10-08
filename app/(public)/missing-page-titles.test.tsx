import { readdirSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  fetchPublicNewsBySlug: vi.fn(),
  fetchDelegateBySlug: vi.fn(),
  fetchPublicEventBySlug: vi.fn(),
}));
vi.mock("@/lib/supabase/public", () => data);

import { NOT_FOUND_METADATA } from "@/components/NotFoundNotice";
import { metadata as publicNotFoundMetadata } from "./not-found";
import { generateMetadata as delegatePageMetadata } from "./delegates/[slug]/page";
import { metadata as delegateNotFoundMetadata } from "./delegates/[slug]/not-found";
import { generateMetadata as eventPageMetadata } from "./events/[slug]/page";
import { generateMetadata as eventNotFoundMetadata } from "./events/[slug]/not-found";
import { generateMetadata as newsPageMetadata } from "./news/[slug]/page";
import { metadata as newsNotFoundMetadata } from "./news/[slug]/not-found";

const params = Promise.resolve({ slug: "no-such-slug" });

beforeEach(() => {
  vi.stubEnv("SHOW_EVENTS", undefined);
  data.fetchPublicNewsBySlug.mockResolvedValue(null);
  data.fetchDelegateBySlug.mockResolvedValue(null);
  data.fetchPublicEventBySlug.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ADR-041. A missing slug's 404 takes its HTML title from the nearest not-found file and its tab
// title from the page's generateMetadata, until the 60-second ISR regeneration drops the page's
// and the tab falls back to the not-found file's. The two must therefore be the same title.
describe.each<[string, string, () => Promise<Metadata>, () => Metadata | Promise<Metadata>]>([
  [
    "/news/[slug]",
    "სიახლე ვერ მოიძებნა — ქართული რესპუბლიკა",
    () => newsPageMetadata({ params }),
    () => newsNotFoundMetadata,
  ],
  [
    "/delegates/[slug]",
    "დელეგატი ვერ მოიძებნა — ქართული რესპუბლიკა",
    () => delegatePageMetadata({ params }),
    () => delegateNotFoundMetadata,
  ],
  [
    "/events/[slug] while events are shown",
    "ღონისძიება ვერ მოიძებნა — ქართული რესპუბლიკა",
    () => eventPageMetadata({ params }),
    () => eventNotFoundMetadata(),
  ],
])("a missing %s", (route, title, pageMetadata, notFoundMetadata) => {
  beforeEach(() => {
    if (route.startsWith("/events")) vi.stubEnv("SHOW_EVENTS", "true");
  });

  it("titles its not-found file in Georgian", async () => {
    expect((await notFoundMetadata()).title).toBe(title);
  });

  it("presents the same title from the page, so the refresh cannot change the tab", async () => {
    expect(await pageMetadata()).toEqual(await notFoundMetadata());
  });
});

describe("a missing /events/[slug] while events are hidden (ADR-042)", () => {
  it("never names events, from the page or the not-found file", async () => {
    expect(await eventPageMetadata({ params })).toEqual(NOT_FOUND_METADATA);
    expect(eventNotFoundMetadata()).toEqual(NOT_FOUND_METADATA);
  });
});

describe("the public group's not-found file", () => {
  it("carries the generic not-found title, for any other public page that raises a 404", () => {
    expect(publicNotFoundMetadata).toEqual(NOT_FOUND_METADATA);
  });
});

describe("public pages with a [slug]", () => {
  const PUBLIC_DIR = path.join(process.cwd(), "app", "(public)");
  const slugDirs = readdirSync(PUBLIC_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name === "[slug]")
    .map((entry) => path.join(entry.parentPath, entry.name));

  it("are found, so the check below cannot pass by matching nothing", () => {
    expect(slugDirs.length).toBeGreaterThanOrEqual(3);
  });

  it("each own a not-found file (its metadata is the tab title after the refresh)", () => {
    const without = slugDirs.filter((dir) => !readdirSync(dir).includes("not-found.tsx"));
    expect(without).toEqual([]);
  });
});
