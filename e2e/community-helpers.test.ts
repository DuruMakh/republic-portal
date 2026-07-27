/** @vitest-environment node */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { fakeContentClient } from "./cleanup-test-support";
import { cleanupCommunityContent } from "./community-helpers";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  createClient.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

// The marker is the only thing standing between this cleanup and the canonical
// staging seed's own news/events/polls, which public.spec asserts exact counts
// against — so pin the table, the column and the pattern, not just the outcome.
test("scopes every delete to the run marker", async () => {
  const db = fakeContentClient();
  createClient.mockReturnValue(db.client);

  await cleanupCommunityContent("e2e-news-");

  expect(db.likes).toEqual([
    { table: "news", column: "title", pattern: "%e2e-news-%" },
    { table: "events", column: "title", pattern: "%e2e-news-%" },
    { table: "polls", column: "question", pattern: "%e2e-news-%" },
  ]);
});

test("rejects when a content delete fails, naming the table", async () => {
  const db = fakeContentClient({ events: { message: "rsvps still reference it" } });
  createClient.mockReturnValue(db.client);

  await expect(cleanupCommunityContent("e2e-event-")).rejects.toThrow(
    /events.*rsvps still reference it/s,
  );
});

test("reports every failed table, not just the first", async () => {
  const db = fakeContentClient({
    news: { message: "boom news" },
    polls: { message: "boom polls" },
  });
  createClient.mockReturnValue(db.client);

  await expect(cleanupCommunityContent("e2e-poll-")).rejects.toThrow(/news.*polls/s);
});

test("resolves when all three deletes succeed", async () => {
  const db = fakeContentClient();
  createClient.mockReturnValue(db.client);

  await expect(cleanupCommunityContent("e2e-news-")).resolves.toBeUndefined();
});

// Matches cleanupUsersByPhone: without staging credentials every cleanup skips
// alike, rather than one throwing and its neighbour returning.
test("skips quietly when staging credentials are absent", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

  await expect(cleanupCommunityContent("e2e-news-")).resolves.toBeUndefined();
  expect(createClient).not.toHaveBeenCalled();
});
