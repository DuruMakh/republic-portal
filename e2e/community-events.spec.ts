import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  serviceClient,
  signOutViaNav,
} from "./admin-helpers";
import { approveOwnDelegate, seedCompletedMember, seedPendingDelegate } from "./funnel-helpers";
import { cleanupCommunityContent } from "./community-helpers";

const DELEGATE = 6; // phase4Phone(6) — seeded delegate, service-approved
const SUPPORTER = 7; // phase4Phone(7) — seeded onto the delegate's team, RSVPs
const RUN = `e2e-event-${Date.now().toString(36)}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupPhase4Users([DELEGATE, SUPPORTER]);
  await cleanupCommunityContent("e2e-event-");
});

test.afterAll(async () => {
  await cleanupCommunityContent("e2e-event-");
  await cleanupPhase4Users([DELEGATE, SUPPORTER]);
});

test("member RSVPs and cancels; delegate sees the team overview", async ({ page, browser }) => {
  // 0) editor publishes a future event
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/events/new");
  await page.getByLabel("დასახელება").fill(`კრება ${RUN}`);
  await page.getByLabel("ადგილმდებარეობა").fill("თბილისი");
  const in7d = new Date(Date.now() + 7 * 86_400_000);
  const local = `${in7d.toISOString().slice(0, 10)}T19:00`;
  await page.getByLabel("დაწყება").fill(local);
  await page.getByLabel("აღწერა").fill("დღის წესრიგი.");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/events\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "გამოქვეყნება" }).click();
  await expect(page.getByText("გამოქვეყნებული")).toBeVisible();
  await signOutViaNav(page);

  // 1) the delegate applicant is seeded + service-approved (kept signed in in its own
  //    context, dPage); the supporter is seeded onto the delegate's team. The referral
  //    REGISTRATION journey itself lives in the registration/membership specs — here the
  //    subject is events, RSVP and the delegate's team-attendance view.
  const delegateContext = await browser.newContext();
  const dPage = await delegateContext.newPage();
  const delegatePhone = phase4Phone(DELEGATE);
  const { id: delegateId } = await seedPendingDelegate({
    phone: delegatePhone,
    firstName: "ვაჟა",
    lastName: "ფშაველა",
    personalId: phase4PersonalId(DELEGATE),
  });
  await approveOwnDelegate(delegatePhone);
  await loginAs(dPage, delegatePhone); // completed delegate lands on /delegate

  // supporter joins the delegate's team, on the shared `page` (signed out after the
  // editor's signOutViaNav above)
  const supporterPhone = phase4Phone(SUPPORTER);
  await seedCompletedMember({
    phone: supporterPhone,
    firstName: "მხარდამჭერი",
    lastName: "პირველი",
    personalId: phase4PersonalId(SUPPORTER),
    delegateId,
  });
  await loginAs(page, supporterPhone);
  // the supporter's cabinet shows the applicant as their delegate
  await page.goto("/me/delegate");
  await expect(page.getByTestId("current-delegate")).toContainText("ვაჟა ფშაველა");

  // 2) supporter RSVPs, sees own state, cancels, re-RSVPs
  await page.goto("/me/events");
  const eventCard = page.locator("section", { hasText: `კრება ${RUN}` });
  await eventCard.getByRole("button", { name: "მოვალ" }).click();
  await expect(eventCard.getByText("✓ შენ მოდიხარ")).toBeVisible();
  await expect(eventCard.getByText(/სულ მოდის 1 მონაწილე/)).toBeVisible();
  await eventCard.getByRole("button", { name: "გაუქმება" }).click();
  await expect(eventCard.getByRole("button", { name: "მოვალ" })).toBeVisible();
  await expect(eventCard.getByText(/სულ მოდის 0 მონაწილე/)).toBeVisible();
  await eventCard.getByRole("button", { name: "მოვალ" }).click();
  await expect(eventCard.getByText("✓ შენ მოდიხარ")).toBeVisible();

  // DB truth: exactly ONE row for (event, member) after the toggle dance
  const db = serviceClient();
  const { data: eventRow } = await db
    .from("events")
    .select("id")
    .eq("title", `კრება ${RUN}`)
    .single();
  const { count } = await db
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventRow!.id as string);
  expect(count).toBe(1);
  await signOutViaNav(page);

  // 3) delegate sees the team overview with the supporter's name (dPage has stayed
  //    authenticated since its login above)
  await dPage.goto("/delegate");
  const overview = dPage.getByTestId("team-rsvp");
  await expect(overview.getByText(`კრება ${RUN}`)).toBeVisible();
  await expect(overview.getByText("შენი გუნდიდან მოდის 1")).toBeVisible();
  await overview.getByText("ვინ მოდის").click();
  // the supporter's own name (seedCompletedMember, above) appears in the expanded list
  await expect(overview.getByText("მხარდამჭერი პირველი")).toBeVisible();
  await delegateContext.close();

  // 4) editor cancels → public banner + cabinet lock
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/events");
  // The list page (Tasks 18–20 sibling pattern) keeps the title cell plain
  // text — only the row's own "რედაქტირება" link navigates — so open the
  // event through that link, scoped to this run's own row (never a bare
  // page-wide locator: other rows carry the same link text).
  await page
    .getByTestId("admin-events-body")
    .locator("tr", { hasText: `კრება ${RUN}` })
    .getByRole("link", { name: "რედაქტირება" })
    .click();
  await expect(page).toHaveURL(/\/admin\/content\/events\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "გაუქმება" }).click();
  await page.getByRole("button", { name: "დაადასტურე გაუქმება" }).click();
  await expect(page.getByText("ღონისძიება გაუქმებულია.")).toBeVisible();
  await signOutViaNav(page);
  const { data: slugRow } = await db
    .from("events")
    .select("slug")
    .eq("id", eventRow!.id as string)
    .single();
  await page.goto(`/events/${slugRow!.slug as string}`);
  await expect(page.getByText("ღონისძიება გაუქმებულია")).toBeVisible();

  // supporter's cabinet reflects the cancellation: pill label (lib/admin.ts
  // contentPill("cancelled").label) + RSVP lock (EventRsvp.tsx's closed branch)
  await loginAs(page, supporterPhone);
  await page.goto("/me/events");
  const cancelledCard = page.locator("section", { hasText: `კრება ${RUN}` });
  await expect(cancelledCard.getByText("გაუქმებული")).toBeVisible();
  await expect(cancelledCard.getByText("რეგისტრაცია დახურულია")).toBeVisible();
  await signOutViaNav(page);
});
