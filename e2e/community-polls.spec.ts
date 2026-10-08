import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  serviceClient,
} from "./admin-helpers";
import { runCleanups } from "./cleanup-helpers";
import {
  cleanupCommunityContent,
  memberRpcClient,
  registerCompletedMember,
} from "./community-helpers";
import {
  cleanupGoogleBackedTestUsers,
  createGoogleBackedTestUser,
  seedCompletedMember,
} from "./funnel-helpers";

const VOTER = 8; // phase4Phone(8)
const WATCHER = 9; // phase4Phone(9) — never votes; sees results only after close
const RUN = `e2e-poll-${Date.now().toString(36)}`;

test.describe.configure({ mode: "serial" });

const cleanupUsers = () =>
  runCleanups([
    () => cleanupPhase4Users([VOTER, WATCHER]),
    () => cleanupGoogleBackedTestUsers([phase4Phone(WATCHER)]),
  ]);

// runCleanups, not sequential awaits: a throw from one cleanup must not skip the
// other, or a content failure strands this run's users where no later run looks.
test.beforeAll(() => runCleanups([cleanupUsers, () => cleanupCommunityContent("e2e-poll-")]));

test.afterAll(() => runCleanups([() => cleanupCommunityContent("e2e-poll-"), cleanupUsers]));

/** The poll's per-option counts as `client` may read them through poll_option_counts. */
async function visibleVotes(client: SupabaseClient, pollId: string): Promise<number[]> {
  const { data, error } = await client
    .from("poll_option_counts")
    .select("votes")
    .eq("poll_id", pollId);
  if (error) throw new Error(`poll_option_counts read failed: ${error.message}`);
  return (data ?? []).map((row) => row.votes as number);
}

// The real vote path: one vote per member, enforced by the database even against a
// direct second RPC call; and the database's own visibility rule (poll_option_counts:
// counts only once the poll is closed OR the caller has voted), read directly as a voter
// and as a non-voter. How the card renders that is lib/community's poll-view, unit-tested.
// Every actor keeps its own context: the editor and voter sign in through loginAs, the
// non-voter through the Google password fixture. Neither sends an SMS.
test("vote once; a direct second vote is refused; counts stay hidden from non-voters until close", async ({
  page,
  browser,
}) => {
  const editorContext = await browser.newContext();
  const watcherContext = await browser.newContext();
  try {
    const editorPage = await editorContext.newPage();
    const wPage = await watcherContext.newPage();

    // 0) editor creates + opens a poll
    await loginAs(editorPage, ADMIN_PHONES.editor);
    await editorPage.goto("/admin/content/polls/new");
    await editorPage.getByLabel("კითხვა").fill(`არჩევანი ${RUN}?`);
    const options = editorPage.getByLabel(/^პასუხი \d+$/);
    await options.nth(0).fill("დიახ");
    await options.nth(1).fill("არა");
    await editorPage.getByRole("button", { name: "შენახვა" }).click();
    await expect(editorPage).toHaveURL(/\/admin\/content\/polls\/[0-9a-f-]{36}$/);
    await editorPage.getByRole("button", { name: "გახსნა" }).click();
    await expect(editorPage.getByText("ღია")).toBeVisible();

    // 1) voter registers, sees BUTTONS (labels visible pre-vote), votes, sees bars + own mark
    await registerCompletedMember(page, VOTER);
    await page.goto("/me/polls");
    const pollCard = page.locator("[data-testid^='poll-']", { hasText: RUN });
    await expect(pollCard.getByRole("button", { name: "დიახ" })).toBeVisible();
    await pollCard.getByRole("button", { name: "დიახ" }).click();
    await expect(pollCard.getByText(/✓ შენ უკვე მიეცი ხმა · სულ 1 ხმა/)).toBeVisible();
    await expect(pollCard.getByText("✓ შენი არჩევანი")).toBeVisible();
    await expect(pollCard.getByRole("button", { name: "დიახ" })).not.toBeVisible();
    await page.reload();
    await expect(pollCard.getByText(/✓ შენ უკვე მიეცი ხმა/)).toBeVisible(); // persisted

    // DB truth: the vote is a single PK row
    const db = serviceClient();
    const { data: pollRow } = await db
      .from("polls")
      .select("id")
      .like("question", `%${RUN}%`)
      .single();
    const { count } = await db
      .from("poll_votes")
      .select("*", { count: "exact", head: true })
      .eq("poll_id", pollRow!.id as string);
    expect(count).toBe(1);

    // Spec §7: the constraint itself, via a DIRECT second RPC call as the voter
    // (the UI can't even attempt it — the buttons are gone once voted).
    // memberRpcClient reads the voter's live session cookie.
    const { data: optRows } = await db
      .from("poll_options")
      .select("id, position")
      .eq("poll_id", pollRow!.id as string)
      .order("position");
    const voterRpc = await memberRpcClient(page);
    const { error: directErr } = await voterRpc.rpc("member_cast_vote", {
      p_poll_id: pollRow!.id as string,
      p_option_id: optRows![1]!.id as string,
    });
    expect(directErr?.message ?? "").toContain("already_voted");
    const { count: afterDirect } = await db
      .from("poll_votes")
      .select("*", { count: "exact", head: true })
      .eq("poll_id", pollRow!.id as string);
    expect(afterDirect).toBe(1);

    // 2) a NON-voter sees buttons, not results, while open — in the UI and in the
    // database view itself; the voter can read the counts already
    const watcherPhone = phase4Phone(WATCHER);
    const { id: watcherId } = await createGoogleBackedTestUser(wPage, watcherPhone);
    await seedCompletedMember({
      userId: watcherId,
      phone: watcherPhone,
      firstName: "წევრი",
      lastName: "ტესტი",
      personalId: phase4PersonalId(WATCHER),
    });
    const pollId = pollRow!.id as string;
    const watcherDb = await memberRpcClient(wPage);
    expect(await visibleVotes(watcherDb, pollId)).toEqual([]);
    expect((await visibleVotes(voterRpc, pollId)).reduce((a, b) => a + b, 0)).toBe(1);
    await wPage.goto("/me/polls");
    const watcherCard = wPage.locator("[data-testid^='poll-']", { hasText: RUN });
    await expect(watcherCard.getByRole("button", { name: "დიახ" })).toBeVisible();
    await expect(watcherCard.getByText(/სულ 1 ხმა/)).not.toBeVisible();

    // 3) editor closes (its session is still open) → both now see the final results
    await editorPage.goto("/admin/content/polls");
    // The list page (Tasks 18–20 sibling pattern) keeps the question cell plain
    // text — only the row's own action link navigates — so open the poll
    // through that link, scoped to this run's own row (never a bare page-wide
    // locator: other rows carry the same link text). The poll is still "open"
    // at this point (not "draft"), so admin_polls's link label is "ნახვა", not
    // "რედაქტირება" (app/(admin)/admin/content/polls/page.tsx).
    await editorPage
      .getByTestId("admin-polls-body")
      .locator("tr", { hasText: `არჩევანი ${RUN}?` })
      .getByRole("link", { name: "ნახვა" })
      .click();
    await expect(editorPage).toHaveURL(/\/admin\/content\/polls\/[0-9a-f-]{36}$/);
    await editorPage.getByRole("button", { name: "დახურვა" }).click();
    await editorPage.getByRole("button", { name: "დაადასტურე დახურვა" }).click();
    await expect(editorPage.getByText("გამოკითხვა დახურულია.")).toBeVisible();
    await page.goto("/me/polls");
    await expect(pollCard.getByText(/გამოკითხვა დასრულებულია · სულ 1 ხმა/)).toBeVisible();
    await expect(pollCard.getByRole("button", { name: "დიახ" })).not.toBeVisible();
    const closedVotes = await visibleVotes(watcherDb, pollId);
    expect(closedVotes).toHaveLength(2);
    expect(closedVotes.reduce((a, b) => a + b, 0)).toBe(1);
    await wPage.goto("/me/polls");
    await expect(watcherCard.getByText(/გამოკითხვა დასრულებულია · სულ 1 ხმა/)).toBeVisible();
    await expect(watcherCard.getByRole("button", { name: "დიახ" })).not.toBeVisible();
  } finally {
    await Promise.all([editorContext.close(), watcherContext.close()]);
  }
});
