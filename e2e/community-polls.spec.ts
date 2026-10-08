import { expect, test } from "@playwright/test";
import { ADMIN_PHONES, cleanupPhase4Users, loginAs, serviceClient } from "./admin-helpers";
import { runCleanups } from "./cleanup-helpers";
import {
  cleanupCommunityContent,
  memberRpcClient,
  registerCompletedMember,
} from "./community-helpers";

const VOTER = 8; // phase4Phone(8)
const RUN = `e2e-poll-${Date.now().toString(36)}`;

test.describe.configure({ mode: "serial" });

// runCleanups, not sequential awaits: a throw from one cleanup must not skip the
// other, or a content failure strands this run's users where no later run looks.
test.beforeAll(() =>
  runCleanups([() => cleanupPhase4Users([VOTER]), () => cleanupCommunityContent("e2e-poll-")]),
);

test.afterAll(() =>
  runCleanups([() => cleanupCommunityContent("e2e-poll-"), () => cleanupPhase4Users([VOTER])]),
);

// Who sees results when (voter vs non-voter, open vs closed) is lib/community's poll-view
// rule, unit-tested there; this journey proves the real vote path: one vote per member,
// enforced by the database even against a direct second RPC call. The editor keeps its
// own signed-in context, so each actor signs in once.
test("vote once; a direct second vote is refused; closing shows the final results", async ({
  page,
  browser,
}) => {
  const editorContext = await browser.newContext();
  try {
    const editorPage = await editorContext.newPage();

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

    // 2) editor closes (its session is still open) → the voter now sees the final results
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
  } finally {
    await editorContext.close();
  }
});
