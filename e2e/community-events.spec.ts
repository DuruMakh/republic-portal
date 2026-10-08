import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  profileIdByPhone,
  serviceClient,
} from "./admin-helpers";
import {
  approveOwnDelegate,
  cleanupGoogleBackedTestUsers,
  JOURNEY,
  journeyPhone,
  passRegistration,
  seedCompletedMember,
  seedPendingDelegate,
} from "./funnel-helpers";
import { cleanupUsersByPhone, runCleanups } from "./cleanup-helpers";
import { cleanupCommunityContent } from "./community-helpers";
import { EVENTS_SHOWN } from "./events-switch";

// Events, RSVPs and the delegate's own panel in one journey (formerly also
// delegate-panel.spec and membership.spec's RSVP test). Every actor keeps its own
// browser context and signs in once: editor, delegate and supporter use the SMS login;
// the registered attendee signs in through the Google fixture (password, no SMS).
//
// ADR-042: events are hidden unless SHOW_EVENTS=true (CI sets nothing). The delegate
// panel is not an event feature, so its steps always run (one SMS sign-in); every event
// step -- editor, supporter RSVPs, the team-RSVP card, the registered attendee, the
// cancellation -- runs only with the switch on (three SMS sign-ins then). The events
// hidden group in public.spec.ts covers the hidden mode itself.
const DELEGATE = 6; // phase4Phone(6) -- seeded delegate, service-approved
const SUPPORTER = 7; // phase4Phone(7) -- seeded onto the delegate's team, RSVPs
// a REGISTERED (not member) attendee: the RSVP gate is registered-level (spec §4.2, D3).
// The journey slot membership.spec used for this same check before it moved here.
const ATTENDEE_PHONE = journeyPhone(JOURNEY.membRsvp);
const RUN = `e2e-event-${Date.now().toString(36)}`;

test.describe.configure({ mode: "serial" });

const cleanupAttendee = () =>
  runCleanups([
    () =>
      cleanupUsersByPhone("events attendee cleanup", [
        `+995${ATTENDEE_PHONE}`,
        `995${ATTENDEE_PHONE}`,
      ]),
    () => cleanupGoogleBackedTestUsers([ATTENDEE_PHONE]),
  ]);

// runCleanups, not sequential awaits: a throw from one cleanup must not skip the
// other, or a content failure strands this run's users where no later run looks.
test.beforeAll(() =>
  runCleanups([
    () => cleanupPhase4Users([DELEGATE, SUPPORTER]),
    cleanupAttendee,
    () => cleanupCommunityContent("e2e-event-"),
  ]),
);

test.afterAll(() =>
  runCleanups([
    () => cleanupCommunityContent("e2e-event-"),
    () => cleanupPhase4Users([DELEGATE, SUPPORTER]),
    cleanupAttendee,
  ]),
);

test("the delegate panel shows the team; with events shown, members RSVP and cancellation locks RSVPs", async ({
  page,
  browser,
}) => {
  // up to three SMS sign-ins plus a Google-fixture registration in one test; each SMS
  // sign-in may wait out an OTP resend (otp-helpers)
  test.setTimeout(300_000);
  // `page` is the supporter; every other actor gets its own context
  const editorContext = await browser.newContext();
  const delegateContext = await browser.newContext();
  const attendeeContext = await browser.newContext();
  const anonContext = await browser.newContext();
  try {
    const editorPage = await editorContext.newPage();
    const dPage = await delegateContext.newPage();
    const aPage = await attendeeContext.newPage();
    const db = serviceClient();

    // set by the editor step; read only by the other event steps
    let eventId = "";
    let eventSlug = "";

    if (EVENTS_SHOWN)
      await test.step("editor publishes a future event", async () => {
        await loginAs(editorPage, ADMIN_PHONES.editor);
        await editorPage.goto("/admin/content/events/new");
        await editorPage.getByLabel("დასახელება").fill(`კრება ${RUN}`);
        await editorPage.getByLabel("ადგილმდებარეობა").fill("თბილისი");
        const in7d = new Date(Date.now() + 7 * 86_400_000);
        const local = `${in7d.toISOString().slice(0, 10)}T19:00`;
        await editorPage.getByLabel("დაწყება").fill(local);
        await editorPage.getByLabel("აღწერა").fill("დღის წესრიგი.");
        await editorPage.getByRole("button", { name: "შენახვა" }).click();
        await expect(editorPage).toHaveURL(/\/admin\/content\/events\/[0-9a-f-]{36}$/);
        await editorPage.getByRole("button", { name: "გამოქვეყნება" }).click();
        await expect(editorPage.getByText("გამოქვეყნებული")).toBeVisible();
        const { data: eventRow } = await db
          .from("events")
          .select("id, slug")
          .eq("title", `კრება ${RUN}`)
          .single();
        eventId = eventRow!.id as string;
        eventSlug = eventRow!.slug as string;
      });

    // the delegate applicant is seeded pending and signed in (kept signed in in dPage).
    // R2 routes a non-approved delegacy through the member cabinet (spec §3.1): the
    // (delegate) layout gates on isApprovedDelegate only, so a pending requester lands on
    // /me/profile.
    const delegatePhone = phase4Phone(DELEGATE);
    const { id: delegateId } = await seedPendingDelegate({
      phone: delegatePhone,
      firstName: "ვაჟა",
      lastName: "ფშაველა",
      personalId: phase4PersonalId(DELEGATE),
    });

    await test.step("pending delegate sees the pending panel; approval opens the delegate panel", async () => {
      await loginAs(dPage, delegatePhone);
      await expect(dPage).toHaveURL(/\/me\/profile$/);
      await expect(dPage.getByText("დელეგატობის მოთხოვნა გაგზავნილია")).toBeVisible();

      // approve OUR OWN e2e delegate via service role (seed untouched; teardown deletes) --
      // isApprovedDelegate flips true, so /delegate itself is reachable now
      await approveOwnDelegate(delegatePhone);
      await dPage.goto("/delegate");
      await expect(dPage.getByText("დამტკიცებული").first()).toBeVisible();
      const url = (await dPage.getByTestId("referral-url").innerText()).trim();
      expect(url).toMatch(/\/join\?ref=/);
      await expect(dPage.getByRole("img", { name: "რეფერალური ბმულის QR კოდი" })).toBeVisible();
    });

    // the supporter joins the delegate's team. The referral REGISTRATION journey itself
    // lives in the membership spec -- here the subject is events, RSVP and the delegate's
    // team view.
    const supporterPhone = phase4Phone(SUPPORTER);
    await seedCompletedMember({
      phone: supporterPhone,
      firstName: "მხარდამჭერი",
      lastName: "პირველი",
      personalId: phase4PersonalId(SUPPORTER),
      delegateId,
    });

    if (EVENTS_SHOWN)
      await test.step("supporter RSVPs, sees own state, cancels, re-RSVPs", async () => {
        await loginAs(page, supporterPhone);
        // the supporter's cabinet shows the applicant as their delegate
        await page.goto("/me/delegate");
        await expect(page.getByTestId("current-delegate")).toContainText("ვაჟა ფშაველა");

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
        const { count } = await db
          .from("event_rsvps")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId);
        expect(count).toBe(1);
      });

    if (EVENTS_SHOWN)
      await test.step("delegate sees the team-RSVP card", async () => {
        await dPage.goto("/delegate");
        const overview = dPage.getByTestId("team-rsvp");
        await expect(overview.getByText(`კრება ${RUN}`)).toBeVisible();
        await expect(overview.getByText("შენი გუნდიდან მოდის 1")).toBeVisible();
        await overview.getByText("ვინ მოდის").click();
        // the supporter's own name (seedCompletedMember, above) appears in the expanded list
        await expect(overview.getByText("მხარდამჭერი პირველი")).toBeVisible();
      });

    await test.step("delegate sees the team page", async () => {
      // the delegate's team reflects the new member — on a phone: the delegate cabinet
      // mounts exactly one bottom tab bar, whose home tab stays current on the team page
      await dPage.setViewportSize({ width: 390, height: 844 });
      await dPage.goto("/delegate/team");
      const mobileNav = dPage.locator("div.sticky.bottom-0 nav");
      await expect(mobileNav).toBeVisible();
      await expect(dPage.locator("div.sticky.bottom-0")).toHaveCount(1);
      await expect(mobileNav.locator('a[href="/delegate"]')).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(dPage.getByTestId("team-count")).toHaveText("1");
      await expect(dPage.getByTestId("team-rows").getByText("მხარდამჭერი პირველი")).toBeVisible();
      // the row pill reads plainly as a member (TEAM_STATUS_LABELS, ADR-037); scoped to the
      // table body, since the thead carries the same word outside the team-rows tbody.
      await expect(
        dPage.getByTestId("team-rows").getByText("წევრი", { exact: true }).first(),
      ).toBeVisible();
      await dPage.getByLabel("ძებნა სახელით ან გვარით").fill("არავინა");
      await expect(dPage.getByTestId("team-no-results")).toBeVisible();
    });

    if (EVENTS_SHOWN)
      await test.step("a registered (not member) user RSVPs too", async () => {
        await passRegistration(aPage, {
          phone: ATTENDEE_PHONE,
          firstName: "ვატესტ",
          lastName: "დასწრებას",
        });
        await aPage.goto("/me/events");
        const eventCard = aPage.locator("section", { hasText: `კრება ${RUN}` });
        await eventCard.getByRole("button", { name: "მოვალ" }).click();
        await expect(eventCard.getByText("✓ შენ მოდიხარ")).toBeVisible();
        await expect(eventCard.getByText(/სულ მოდის 2 მონაწილე/)).toBeVisible();

        // state + count survive a reload
        await aPage.reload();
        await expect(eventCard.getByText("✓ შენ მოდიხარ")).toBeVisible();
        await expect(eventCard.getByText(/სულ მოდის 2 მონაწილე/)).toBeVisible();

        const attendeeId = await profileIdByPhone(db, ATTENDEE_PHONE);
        const { data: rows } = await db
          .from("event_rsvps")
          .select("status")
          .eq("event_id", eventId)
          .eq("member_id", attendeeId);
        expect(rows).toEqual([{ status: "going" }]);
      });

    if (EVENTS_SHOWN)
      await test.step("editor cancels -> public banner + cabinet lock", async () => {
        await editorPage.goto("/admin/content/events");
        // The list page keeps the title cell plain text -- only the row's own
        // "რედაქტირება" link navigates -- so open the event through that link, scoped to
        // this run's own row (never a bare page-wide locator: other rows carry the same
        // link text).
        await editorPage
          .getByTestId("admin-events-body")
          .locator("tr", { hasText: `კრება ${RUN}` })
          .getByRole("link", { name: "რედაქტირება" })
          .click();
        await expect(editorPage).toHaveURL(/\/admin\/content\/events\/[0-9a-f-]{36}$/);
        await editorPage.getByRole("button", { name: "გაუქმება" }).click();
        await editorPage.getByRole("button", { name: "დაადასტურე გაუქმება" }).click();
        await expect(editorPage.getByText("ღონისძიება გაუქმებულია.")).toBeVisible();

        const anonPage = await anonContext.newPage();
        await anonPage.goto(`/events/${eventSlug}`);
        await expect(anonPage.getByText("ღონისძიება გაუქმებულია")).toBeVisible();

        // supporter's cabinet reflects the cancellation: pill label (lib/admin.ts
        // contentPill("cancelled").label) + RSVP lock (EventRsvp.tsx's closed branch)
        await page.goto("/me/events");
        const cancelledCard = page.locator("section", { hasText: `კრება ${RUN}` });
        await expect(cancelledCard.getByText("გაუქმებული")).toBeVisible();
        await expect(cancelledCard.getByText("რეგისტრაცია დახურულია")).toBeVisible();
      });
  } finally {
    await Promise.all([
      editorContext.close(),
      delegateContext.close(),
      attendeeContext.close(),
      anonContext.close(),
    ]);
  }
});
