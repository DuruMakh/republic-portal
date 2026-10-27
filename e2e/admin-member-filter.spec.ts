import { expect, test } from "@playwright/test";
import { ADMIN_PHONES, loginAs, serviceClient } from "./admin-helpers";
import { cleanupUsersByPhone, runCleanups } from "./cleanup-helpers";
import { cleanupCommunityContent } from "./community-helpers";
import { seedCompletedMember, seedRegisteredMember } from "./funnel-helpers";
import { clientFor, fixtureSession } from "./otp-helpers";

const MARKER = "AuditMemberFixture";
const CONTENT = "e2e-audit-staff-task2";
const phones = Array.from({ length: 55 }, (_, i) => `55008${String(i).padStart(4, "0")}`);
const members: { id: string; name: string; status: string }[] = [];
let regionId: number;
let cityId: number;
const cleanup = () =>
  runCleanups([
    () =>
      cleanupUsersByPhone(
        "audit member fixtures",
        phones.map((p) => `+995${p}`),
      ),
    () => cleanupCommunityContent(CONTENT),
  ]);
test.beforeAll(async () => {
  await cleanup();
  const db = serviceClient();
  for (let i = 0; i < 54; i++) {
    const name = `${MARKER}${String(i).padStart(2, "0")}`;
    const { id } = await seedCompletedMember({
      phone: phones[i]!,
      firstName: name,
      lastName: "Test",
      personalId: `955008${String(i).padStart(5, "0")}`,
    });
    const status = i % 2 ? "active_member" : "profile_completed";
    const { error } = await db
      .from("profiles")
      .update({ status, created_at: "2026-10-01T10:00:00Z" })
      .eq("id", id);
    if (error) throw error;
    members.push({ id, name, status });
  }
  const { data: location, error } = await db
    .from("profiles")
    .select("region_id, city_id")
    .eq("id", members[0]!.id)
    .single();
  if (error) throw error;
  regionId = location!.region_id as number;
  cityId = location!.city_id as number;
  const { data: cities } = await db.from("cities").select("id, region_id").neq("id", cityId);
  const sameRegion = cities!.find((c) => c.region_id === regionId)!;
  const otherRegion = cities!.find((c) => c.region_id !== regionId)!;
  for (const [index, city] of [
    [52, sameRegion],
    [53, otherRegion],
  ] as const) {
    const { error: updateError } = await db
      .from("profiles")
      .update({ city_id: city.id, region_id: city.region_id })
      .eq("id", members[index]!.id);
    if (updateError) throw updateError;
  }
  const phone = phones[54]!;
  const { data: auth, error: authError } = await db.auth.admin.createUser({
    phone: `+995${phone}`,
    phone_confirm: true,
  });
  if (authError) throw authError;
  const { id } = await seedRegisteredMember({
    userId: auth.user!.id,
    phone,
    firstName: `${MARKER}Supporter`,
    lastName: "Test",
    personalId: "95500800054",
  });
  const { error: supporterError } = await db
    .from("profiles")
    .update({ region_id: regionId, city_id: cityId })
    .eq("id", id);
  if (supporterError) throw supporterError;
});
test.afterAll(cleanup);

test("Member list, count and CSV agree; tied dates retain all rows across page 50", async ({
  page,
}) => {
  await loginAs(page, ADMIN_PHONES.super);
  const params = new URLSearchParams({
    status: "profile_completed",
    search: MARKER,
    regionId: String(regionId),
    cityId: String(cityId),
  });
  const expected = members.slice(0, 52).sort((a, b) => b.id.localeCompare(a.id));
  const observed: string[] = [];
  for (const pageNumber of [1, 2]) {
    await page.goto(`/admin/members?${params}&page=${pageNumber}`);
    const body = page.getByTestId("admin-members-body");
    const names = await body.locator("tr td:first-child").allTextContents();
    observed.push(...names.map((n) => n.trim().split(/\s+/)[0]!));
    await expect(body.locator("tr")).toHaveCount(pageNumber === 1 ? 50 : 2);
    await expect(
      page.getByText(pageNumber === 1 ? "ნაჩვენებია 1–50 / 52" : "ნაჩვენებია 51–52 / 52", {
        exact: true,
      }),
    ).toBeVisible();
    if (pageNumber === 1)
      await page.screenshot({
        path: "output/playwright/audit-minimal-repairs/task-2-member-filter.png",
        fullPage: true,
      });
  }
  expect(observed).toEqual(expected.map((m) => m.name));
  expect(new Set(observed).size).toBe(52);
  const csvResponse = await page.request.get(`/admin/members/export?${params}`);
  expect(csvResponse.status()).toBe(200);
  const csv = await csvResponse.text();
  const exported = csv
    .trimEnd()
    .split("\r\n")
    .slice(1)
    .map((line) => line.split(",")[0]);
  expect(exported.sort()).toEqual(expected.map((m) => m.name).sort());
  expect(csv).not.toContain("Supporter");
  params.set("status", "active_member");
  await page.goto(`/admin/members?${params}`);
  await expect(page.getByTestId("admin-members-body").locator("tr")).toHaveCount(26);
  const activeCsv = await (await page.request.get(`/admin/members/export?${params}`)).text();
  expect(
    activeCsv
      .trimEnd()
      .split("\r\n")
      .slice(1)
      .map((line) => line.split(",")[0])
      .sort(),
  ).toEqual(
    expected
      .filter((m) => m.status === "active_member")
      .map((m) => m.name)
      .sort(),
  );
  const db = serviceClient();
  const { data: audits, error } = await db
    .from("audit_log")
    .select("details")
    .eq("action", "member.export")
    .order("created_at", { ascending: false })
    .limit(2);
  expect(error).toBeNull();
  expect(audits!.map((a) => a.details)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        search: MARKER,
        regionId,
        cityId,
        status: "profile_completed",
        includeIds: false,
        rowCount: 52,
      }),
      expect.objectContaining({
        search: MARKER,
        regionId,
        cityId,
        status: "active_member",
        includeIds: false,
        rowCount: 26,
      }),
    ]),
  );
});

test("database and route retain export and personal-ID permissions", async ({ page }) => {
  const args = {
    p_search: MARKER,
    p_region_id: regionId,
    p_city_id: cityId,
    p_status: "profile_completed",
    p_include_ids: false,
  };
  const verifier = await clientFor(await fixtureSession(ADMIN_PHONES.verifier));
  expect((await verifier.rpc("admin_export_members", args)).error?.message).toContain(
    "missing_role",
  );
  await loginAs(page, ADMIN_PHONES.verifier);
  expect((await page.request.get("/admin/members/export")).status()).toBe(403);
  const finance = await clientFor(await fixtureSession(ADMIN_PHONES.finance));
  expect(
    (await finance.rpc("admin_export_members", { ...args, p_include_ids: true })).error?.message,
  ).toContain("missing_role");
  const allowed = await finance.rpc("admin_export_members", args);
  expect(allowed.error).toBeNull();
  expect(allowed.data).toHaveLength(52);
  expect(allowed.data[0]).not.toHaveProperty("personalId");
  await loginAs(page, ADMIN_PHONES.finance);
  expect((await page.request.get("/admin/members/export?includeIds=1")).status()).toBe(403);
  const admin = await clientFor(await fixtureSession(ADMIN_PHONES.super));
  const withIds = await admin.rpc("admin_export_members", { ...args, p_include_ids: true });
  expect(withIds.error).toBeNull();
  expect(withIds.data).toHaveLength(52);
  expect(withIds.data[0]).toHaveProperty("personalId");
});

test("staff save before Publish/Open keeps the displayed changes and database validation", async ({
  page,
}) => {
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto("/admin/content/news/new");
  await page.getByLabel("სათაური").fill(`${CONTENT} news`);
  await page.getByLabel("ტექსტი").fill("გამოგონილი სატესტო სიახლე.");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/news\/[0-9a-f-]{36}$/);
  const newsId = page.url().split("/").at(-1)!;
  await page.getByLabel("წევრებისთვის").check();
  await page.getByLabel("ტექსტი").fill("შენახული გამოგონილი ცვლილება.");
  await expect(page.getByRole("button", { name: "გამოქვეყნება" })).toBeDisabled();
  await expect(page.getByText("ჯერ შეინახე ცვლილებები.")).toBeVisible();
  await page.screenshot({
    path: "output/playwright/audit-minimal-repairs/task-2-news-unsaved.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByRole("button", { name: "გამოქვეყნება" })).toBeEnabled();
  await page.getByRole("button", { name: "გამოქვეყნება" }).click();
  await expect(page.getByText("გამოქვეყნებული", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "output/playwright/audit-minimal-repairs/task-2-news-published.png",
    fullPage: true,
  });
  const db = serviceClient();
  const { data: news, error: newsError } = await db
    .from("news")
    .select("visibility, body, status")
    .eq("id", newsId)
    .single();
  expect(newsError).toBeNull();
  expect(news).toMatchObject({
    visibility: "members",
    body: "შენახული გამოგონილი ცვლილება.",
    status: "published",
  });
  await page.goto("/admin/content/polls/new");
  await page.getByLabel("კითხვა").fill(`${CONTENT} poll?`);
  await page.getByLabel("პასუხი 1").fill("დიახ");
  await page.getByLabel("პასუხი 2").fill("არა");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/polls\/[0-9a-f-]{36}$/);
  const pollId = page.url().split("/").at(-1)!;
  await page.getByLabel("კითხვა").fill(`${CONTENT} saved question?`);
  await page.getByLabel("პასუხი 1").fill("შესაძლოა");
  await expect(page.getByRole("button", { name: "გახსნა", exact: true })).toBeDisabled();
  await page.screenshot({
    path: "output/playwright/audit-minimal-repairs/task-2-poll-unsaved.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByRole("button", { name: "გახსნა", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "გახსნა", exact: true }).click();
  await expect(page.getByText("ღია", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: `${CONTENT} saved question?` })).toBeVisible();
  await expect(page.getByText("შესაძლოა", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "output/playwright/audit-minimal-repairs/task-2-poll-open.png",
    fullPage: true,
  });
  const { data: poll } = await db.from("polls").select("status").eq("id", pollId).single();
  expect(poll?.status).toBe("open");
  const { data: emptyPoll, error: emptyError } = await db
    .from("polls")
    .insert({ question: `${CONTENT} empty?` })
    .select("id")
    .single();
  expect(emptyError).toBeNull();
  const editor = await clientFor(await fixtureSession(ADMIN_PHONES.editor));
  expect((await editor.rpc("admin_open_poll", { p_id: emptyPoll!.id })).error?.message).toContain(
    "invalid_options",
  );
});
