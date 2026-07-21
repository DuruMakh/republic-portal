import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getAuditRows,
  loginAs,
  serviceClient,
  signOutViaNav,
} from "./admin-helpers";
import { cleanupCommunityContent, registerCompletedMember } from "./community-helpers";

const MEMBER = 5; // phase4Phone(5) — reads the feed; never authors
const RUN = `e2e-news-${Date.now().toString(36)}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await cleanupPhase4Users([MEMBER]);
  await cleanupCommunityContent("e2e-news-");
});

test.afterAll(async () => {
  await cleanupCommunityContent("e2e-news-");
  await cleanupPhase4Users([MEMBER]);
});

test("editor publishes public + member-only articles; visibility holds everywhere", async ({
  page,
}) => {
  // 1) editor drafts + publishes a PUBLIC article
  await loginAs(page, ADMIN_PHONES.editor);
  // loginAs's post-OTP landing is cabinet-state-driven (/login's routeByCabinetState),
  // not role-driven — canonical admins are also completed member profiles, so they
  // land on their own cabinet first (admin-payments.spec.ts / admin-rbac.spec.ts
  // precedent: every admin-page visit explicitly goes there after loginAs).
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/content\/news$/); // editor lands on the hub
  await page.getByRole("link", { name: "ახალი სიახლე" }).click();
  await page.getByLabel("სათაური").fill(`საჯარო ${RUN}`);
  await page.getByLabel("ტექსტი").fill("პირველი აბზაცი.\n\nდეტალები: https://example.ge/x");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/news\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "გამოქვეყნება" }).click();
  await expect(page.getByText("გამოქვეყნებული")).toBeVisible();

  // audit row exists for the publish (in-transaction guarantee, viewed via service)
  const db = serviceClient();
  const { data: pubRow } = await db
    .from("news")
    .select("id, slug")
    .eq("title", `საჯარო ${RUN}`)
    .single();
  expect(pubRow?.slug).toBeTruthy();
  expect(await getAuditRows("news.publish", pubRow!.id as string)).toBe(1);

  // 2) editor publishes a MEMBER-ONLY article
  await page.goto("/admin/content/news/new");
  await page.getByLabel("სათაური").fill(`შიდა ${RUN}`);
  await page.getByLabel("წევრებისთვის").check();
  await page.getByLabel("ტექსტი").fill("მხოლოდ წევრებისთვის.");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/news\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "გამოქვეყნება" }).click();
  await expect(page.getByText("გამოქვეყნებული")).toBeVisible();
  const { data: memRow } = await db.from("news").select("slug").eq("title", `შიდა ${RUN}`).single();
  const memberSlug = memRow!.slug as string;
  await signOutViaNav(page);

  // 3) public site: public article visible with OG tags; member-only 404s
  await page.goto("/news");
  await expect(page.getByText(`საჯარო ${RUN}`)).toBeVisible();
  await expect(page.getByText(`შიდა ${RUN}`)).not.toBeVisible();
  await page.getByText(`საჯარო ${RUN}`).click();
  await expect(page.getByRole("heading", { name: `საჯარო ${RUN}` })).toBeVisible();
  await expect(page.getByRole("link", { name: "https://example.ge/x" })).toBeVisible();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    new RegExp(RUN),
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /og-default|news-images/,
  );
  const missing = await page.goto(`/news/${memberSlug}`);
  expect(missing?.status()).toBe(404);

  // 4) a completed member sees BOTH in the cabinet feed; member-only opens under /me
  await registerCompletedMember(page, MEMBER);
  await page.goto("/me/news");
  await expect(page.getByText(`საჯარო ${RUN}`)).toBeVisible();
  await expect(page.getByText(`შიდა ${RUN}`)).toBeVisible();
  await expect(page.getByText("წევრებისთვის").first()).toBeVisible();
  await page.getByText(`შიდა ${RUN}`).click();
  await expect(page).toHaveURL(`/me/news/${memberSlug}`);
  await expect(page.getByRole("heading", { name: `შიდა ${RUN}` })).toBeVisible();
  await signOutViaNav(page);

  // 5) unpublish retracts the public article
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/news");
  // The list page (Tasks 18–20 sibling pattern) keeps the title cell plain text —
  // only the row's own "რედაქტირება" link navigates — so open the article through
  // that link, scoped to this run's own row (never a bare page-wide locator: other
  // rows carry the same link text).
  await page
    .getByTestId("admin-news-body")
    .locator("tr", { hasText: `საჯარო ${RUN}` })
    .getByRole("link", { name: "რედაქტირება" })
    .click();
  await expect(page).toHaveURL(/\/admin\/content\/news\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "მოხსნა" }).click();
  await expect(page.getByText("მონახაზი")).toBeVisible();
  const gone = await page.goto(`/news/${pubRow!.slug as string}`);
  expect(gone?.status()).toBe(404);
});
