import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getReferralCode,
  loginAs,
  phase4PersonalId,
  phase4Phone,
  serviceClient,
  signOutViaNav,
} from "./admin-helpers";
import { approveOwnDelegate, fillStep2Basics, passStep1 } from "./funnel-helpers";
import { cleanupCommunityContent } from "./community-helpers";

const DELEGATE = 6; // phase4Phone(6) — registers as delegate, service-approved
const SUPPORTER = 7; // phase4Phone(7) — joins via referral, RSVPs
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

  // 1) delegate applicant registers (delegate variant); supporter joins via
  //    referral. The registration steps mirror admin-approval.spec.ts's
  //    applicant/supporter journeys VERBATIM, parameterized by
  //    DELEGATE/SUPPORTER in place of that spec's APPLICANT_A/SUPPORTER
  //    slots — through to a COMPLETED (tier-step) supporter bound to the
  //    delegate.
  //
  //    The delegate registers in its OWN browser context (dPage), not
  //    `page`: a completed delegate's post-OTP landing is `/delegate`
  //    (lib/cabinet.ts's deriveDestination: role === "delegate" ?
  //    "/delegate" : "/me/profile"), which loginAs's shared regex
  //    (/(me\/profile|me\/delegate|admin)/, admin-helpers.ts) never
  //    matches — that helper has so far only ever been exercised against
  //    admin/member accounts (confirmed: no existing spec calls it with a
  //    delegate phone). Registering the delegate in its own context and
  //    keeping it signed in through step 3 sidesteps a second,
  //    currently-unsupported loginAs(delegate) call without touching that
  //    shared helper; the registration steps themselves are unchanged.
  const delegateContext = await browser.newContext();
  const dPage = await delegateContext.newPage();
  const delegatePhone = phase4Phone(DELEGATE);
  await dPage.goto("/join?role=delegate");
  await expect(dPage).toHaveURL(/\/join\/step-1\?role=delegate/);
  await passStep1(dPage, { phone: delegatePhone, firstName: "ვაჟა", lastName: "ფშაველა" });

  await expect(dPage).toHaveURL(/\/join\/step-2/);
  await expect(dPage.getByText("დელეგატის რეგისტრაცია").first()).toBeVisible();
  await fillStep2Basics(dPage, {
    personalId: phase4PersonalId(DELEGATE),
    regionLabel: "თბილისი",
  });
  await dPage.getByRole("checkbox").check();
  await dPage.getByRole("button", { name: "გაგრძელება →" }).click();

  await expect(dPage).toHaveURL(/\/join\/step-3/);
  await dPage.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();
  await expect(dPage).toHaveURL(/\/join\/pending/);

  // service-approve OUR OWN e2e delegate (seed untouched; teardown deletes),
  // then read the now-activated referral code.
  await approveOwnDelegate(delegatePhone);
  const referral = await getReferralCode(delegatePhone);

  // supporter registers through the delegate's referral link, on the shared
  // `page` (currently signed out, after the editor's signOutViaNav above).
  const supporterPhone = phase4Phone(SUPPORTER);
  await page.goto(`/join?ref=${encodeURIComponent(referral)}`);
  await expect(page).toHaveURL(new RegExp(`/join/step-1\\?ref=`));
  await passStep1(page, {
    phone: supporterPhone,
    firstName: "მხარდამჭერი",
    lastName: "პირველი",
  });

  await expect(page).toHaveURL(/\/join\/step-2/);
  // read-only referral card instead of the picker — the referring delegate is ours
  await expect(page.getByText("ვაჟა ფშაველა")).toBeVisible();
  await expect(page.getByText(/რეფერალური ბმულით/)).toBeVisible();
  await expect(page.getByLabel("დელეგატი")).toHaveCount(0);
  await fillStep2Basics(page, {
    personalId: phase4PersonalId(SUPPORTER),
    regionLabel: "აჭარა", // any region — referral binding is region-independent
  });
  await page.getByRole("button", { name: "გაგრძელება →" }).click();
  await expect(page).toHaveURL(/\/join\/step-3/);
  await page.getByRole("button", { name: "რეგისტრაციის დასრულება" }).click();
  await expect(page).toHaveURL(/\/join\/done$/);
  // the supporter's cabinet shows the applicant as their delegate
  await page.goto("/me/delegate");
  await expect(page.getByTestId("current-delegate")).toContainText("ვაჟა ფშაველა");

  // 2) supporter RSVPs, sees own state, cancels, re-RSVPs
  await page.goto("/me/events");
  const eventCard = page.locator("section", { hasText: `კრება ${RUN}` });
  await eventCard.getByRole("button", { name: "მოვალ" }).click();
  await expect(eventCard.getByText("✓ შენ მოდიხარ")).toBeVisible();
  await expect(eventCard.getByText(/სულ მოდის 1 წევრი/)).toBeVisible();
  await eventCard.getByRole("button", { name: "გაუქმება" }).click();
  await expect(eventCard.getByRole("button", { name: "მოვალ" })).toBeVisible();
  await expect(eventCard.getByText(/სულ მოდის 0 წევრი/)).toBeVisible();
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

  // 3) delegate sees the team overview with the supporter's name (dPage has
  //    stayed authenticated since its registration above)
  await dPage.goto("/delegate");
  const overview = dPage.getByTestId("team-rsvp");
  await expect(overview.getByText(`კრება ${RUN}`)).toBeVisible();
  await expect(overview.getByText("შენი გუნდიდან მოდის 1")).toBeVisible();
  await overview.getByText("ვინ მოდის").click();
  // the supporter's own name (passStep1, above) appears in the expanded list
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
});
