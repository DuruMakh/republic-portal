import { expect, test } from "@playwright/test";
import {
  ADMIN_PHONES,
  cleanupPhase4Users,
  getAuditRows,
  loginAs,
  serviceClient,
} from "./admin-helpers";
import { runCleanups } from "./cleanup-helpers";
import { cleanupCommunityContent, registerCompletedMember } from "./community-helpers";

const MEMBER = 5; // phase4Phone(5) — reads the feed; never authors
const RUN = `e2e-news-${Date.now().toString(36)}`;

test.describe.configure({ mode: "serial" });

// runCleanups, not sequential awaits: a throw from one cleanup must not skip the
// other, or a content failure strands this run's users where no later run looks.
test.beforeAll(() =>
  runCleanups([() => cleanupPhase4Users([MEMBER]), () => cleanupCommunityContent("e2e-news-")]),
);

test.afterAll(() =>
  runCleanups([() => cleanupCommunityContent("e2e-news-"), () => cleanupPhase4Users([MEMBER])]),
);

test("editor publishes public + member-only articles; visibility holds everywhere", async ({
  page: anonPage,
  browser,
}) => {
  // Each actor keeps its own context and signs in once (editor, member); the default
  // `page` stays anonymous for the public-site checks.
  const editorContext = await browser.newContext();
  const memberContext = await browser.newContext();
  try {
    const page = await editorContext.newPage();
    const memberPage = await memberContext.newPage();

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
    const { data: memRow } = await db
      .from("news")
      .select("slug")
      .eq("title", `შიდა ${RUN}`)
      .single();
    const memberSlug = memRow!.slug as string;

    // 3) public site: public article visible with OG tags; member-only 404s
    await anonPage.goto("/news");
    await expect(anonPage.getByText(`საჯარო ${RUN}`)).toBeVisible();
    await expect(anonPage.getByText(`შიდა ${RUN}`)).not.toBeVisible();
    await anonPage.getByText(`საჯარო ${RUN}`).click();
    await expect(anonPage.getByRole("heading", { name: `საჯარო ${RUN}` })).toBeVisible();
    await expect(anonPage.getByRole("link", { name: "https://example.ge/x" })).toBeVisible();
    await expect(anonPage.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      new RegExp(RUN),
    );
    await expect(anonPage.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /og-default|news-images/,
    );
    const missing = await anonPage.goto(`/news/${memberSlug}`);
    expect(missing?.status()).toBe(404);

    // 4) a completed member sees BOTH in the cabinet feed; member-only opens under /me
    await registerCompletedMember(memberPage, MEMBER);
    await memberPage.goto("/me/news");
    await expect(memberPage.getByText(`საჯარო ${RUN}`)).toBeVisible();
    await expect(memberPage.getByText(`შიდა ${RUN}`)).toBeVisible();
    await expect(memberPage.getByText("წევრებისთვის").first()).toBeVisible();
    await memberPage.getByText(`შიდა ${RUN}`).click();
    await expect(memberPage).toHaveURL(`/me/news/${memberSlug}`);
    await expect(memberPage.getByRole("heading", { name: `შიდა ${RUN}` })).toBeVisible();

    // 5) unpublish retracts the public article (the editor's session is still open)
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
    const gone = await anonPage.goto(`/news/${pubRow!.slug as string}`);
    expect(gone?.status()).toBe(404);
  } finally {
    await Promise.all([editorContext.close(), memberContext.close()]);
  }
});
