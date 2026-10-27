import { describe, expect, it, vi } from "vitest";
import { fakeSession, ok, raised } from "../../../_test-utils/fake-supabase";
const server = vi.hoisted(() => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("../actions", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
}));
import EditPollPage from "./page";
describe("poll option read", () => {
  it("throws to the existing error boundary when options cannot be read", async () => {
    const { client } = fakeSession({
      from: (table) =>
        table === "admin_polls"
          ? ok({ id: "p1", status: "draft", question: "Question", total_votes: 0, ends_at: null })
          : raised("options unavailable"),
    });
    server.createServerSupabase.mockResolvedValue(client);
    await expect(EditPollPage({ params: Promise.resolve({ id: "p1" }) })).rejects.toThrow(
      "admin_poll_options by id failed: options unavailable",
    );
  });
});
