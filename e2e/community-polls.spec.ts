import { expect, test } from "@playwright/test";
import { formatCountKa } from "../lib/format";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  loginAs,
  phase4Phone,
  serviceClient,
  signOutViaNav,
} from "./admin-helpers";
import {
  cleanupCommunityContent,
  memberRpcClient,
  registerCompletedMember,
} from "./community-helpers";

const VOTER = 8; // phase4Phone(8)
const WATCHER = 9; // phase4Phone(9) — never votes; sees results only after close
const RUN = `e2e-poll-${Date.now().toString(36)}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupPhase4Users([VOTER, WATCHER]);
  await cleanupCommunityContent("e2e-poll-");
});

test.afterAll(async () => {
  await cleanupCommunityContent("e2e-poll-");
  await cleanupPhase4Users([VOTER, WATCHER]);
});

test("vote once, results per the visibility rule, transparency derives from the register", async ({
  page,
}) => {
  // 0) editor creates + opens a poll
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/polls/new");
  await page.getByLabel("კითხვა").fill(`არჩევანი ${RUN}?`);
  const options = page.getByLabel(/^პასუხი \d+$/);
  await options.nth(0).fill("დიახ");
  await options.nth(1).fill("არა");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/polls\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "გახსნა" }).click();
  await expect(page.getByText("ღია")).toBeVisible();
  await signOutViaNav(page);

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
  // (the UI can't even attempt it — the buttons are gone once voted). Runs
  // BEFORE sign-out: memberRpcClient reads the live session cookie.
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

  // 2) a NON-voter sees buttons, not results, while open. Sign out the still-
  // authenticated VOTER first: JoinChoice's own useEffect (app/(public)/join/
  // JoinChoice.tsx) redirects a signed-in visitor with a funnel state away
  // from /join (to deriveDestination(state), e.g. /me/profile for a completed
  // member) — confirmed by running this without the sign-out first: the
  // registration flow raced that redirect and intermittently landed on
  // /me/profile instead of /join/step-1. Every other identity switch on a
  // shared `page` in this suite (community-news.spec.ts, community-events.
  // spec.ts) already signs out first; this mirrors that idiom.
  await signOutViaNav(page);
  await registerCompletedMember(page, WATCHER);
  await page.goto("/me/polls");
  await expect(pollCard.getByRole("button", { name: "დიახ" })).toBeVisible();
  await expect(pollCard.getByText(/სულ 1 ხმა/)).not.toBeVisible();
  await signOutViaNav(page);

  // 3) editor closes → the non-voter now sees results
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/polls");
  // The list page (Tasks 18–20 sibling pattern) keeps the question cell plain
  // text — only the row's own action link navigates — so open the poll
  // through that link, scoped to this run's own row (never a bare page-wide
  // locator: other rows carry the same link text). The poll is still "open"
  // at this point (not "draft"), so admin_polls's link label is "ნახვა", not
  // "რედაქტირება" (app/(admin)/admin/content/polls/page.tsx).
  await page
    .getByTestId("admin-polls-body")
    .locator("tr", { hasText: `არჩევანი ${RUN}?` })
    .getByRole("link", { name: "ნახვა" })
    .click();
  await expect(page).toHaveURL(/\/admin\/content\/polls\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "დახურვა" }).click();
  await page.getByRole("button", { name: "დაადასტურე დახურვა" }).click();
  await expect(page.getByText("გამოკითხვა დახურულია.")).toBeVisible();
  await signOutViaNav(page);
  await loginAs(page, phase4Phone(WATCHER));
  await page.goto("/me/polls");
  await expect(pollCard.getByText(/გამოკითხვა დასრულებულია · სულ 1 ხმა/)).toBeVisible();
  await expect(pollCard.getByRole("button", { name: "დიახ" })).not.toBeVisible();
  await signOutViaNav(page);

  // 4) transparency equals the register (derived, never stored)
  //
  // Staging has 1663+ live payment rows — above PostgREST's server-side
  // max-rows cap (confirmed: even an explicit .range(0, 49999) still comes
  // back truncated at exactly 1000 rows on this project), so a single
  // unranged .select() silently undercounts (measured: 15005 vs the true,
  // correctly-displayed 24840). transparency_stats derives total_gel via an
  // in-DB SQL sum() with no such cap, so the mismatch is this fetch, not the
  // app. Page through in batches of 1000 to read every row.
  const PAYMENTS_PAGE = 1000;
  let livePayments: { amount_gel: number }[] = [];
  for (let offset = 0; ; offset += PAYMENTS_PAGE) {
    const { data: chunk, error: chunkErr } = await db
      .from("payments")
      .select("amount_gel")
      .is("voided_at", null)
      .range(offset, offset + PAYMENTS_PAGE - 1);
    if (chunkErr) throw new Error(`payments page fetch failed: ${chunkErr.message}`);
    livePayments = livePayments.concat(chunk ?? []);
    if (!chunk || chunk.length < PAYMENTS_PAGE) break;
  }
  const expectedTotal = Math.round(livePayments.reduce((s, p) => s + Number(p.amount_gel), 0));
  const { count: registered } = await db
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .neq("status", "draft");
  const { count: approvedDelegates } = await db
    .from("delegates")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");
  // one region row (spec §7): the busiest region's numbers, in its table row
  // (if registered === active there, disambiguate the second assertion with .first())
  const { data: topRegion } = await db
    .from("transparency_regions")
    .select("*")
    .order("registered", { ascending: false })
    .limit(1)
    .single();
  // /transparency is ISR-cached (revalidate 60) with no on-demand revalidation
  // trigger, and the production server (CI runs `next start`) serves the stale
  // snapshot while refreshing in the background — so a render predating this
  // run's own funnel registrations can outlive a single goto by up to ~2
  // windows. Re-request until the live-register values appear (the product
  // contract: derived figures, ≤60s staleness). Dev servers render every
  // request fresh, which is why this race never fires locally.
  test.setTimeout(300_000);
  await expect(async () => {
    await page.goto("/transparency");
    await expect(page.getByText(`${formatCountKa(expectedTotal)} ₾`)).toBeVisible({
      timeout: 1_000,
    });
    await expect(
      page
        .locator("div", { hasText: /^რეგისტრირებული წევრი$/ })
        .locator("..")
        .getByText(formatCountKa(registered ?? 0)),
    ).toBeVisible({ timeout: 1_000 });
    await expect(
      page
        .locator("div", { hasText: /^დამტკიცებული დელეგატი$/ })
        .locator("..")
        .getByText(formatCountKa(approvedDelegates ?? 0)),
    ).toBeVisible({ timeout: 1_000 });
    const regionRow = page.getByRole("row", { name: new RegExp(topRegion!.name_ka) });
    await expect(regionRow.getByText(formatCountKa(topRegion!.registered))).toBeVisible({
      timeout: 1_000,
    });
    await expect(regionRow.getByText(formatCountKa(topRegion!.active))).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 150_000, intervals: [2_000, 5_000, 10_000] });
});
