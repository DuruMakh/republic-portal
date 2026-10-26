import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { ADMIN_PHONES, getAuditRows, loginAs, serviceClient } from "./admin-helpers";
import { assertE2eFixtureEnvironment, cleanupUsersByPhone, runCleanups } from "./cleanup-helpers";
import { cleanupCommunityContent } from "./community-helpers";
import { approveOwnDelegate, seedPendingDelegate } from "./funnel-helpers";
import { clientFor, fixtureSession } from "./otp-helpers";

const MARKER = "e2e-audit-image-task5";
const PHONE = "550007558";
const MAX = 4_194_304;
let newsId: string;
let delegateId: string;
let original: Buffer;

async function cleanup() {
  assertE2eFixtureEnvironment();
  const db = serviceClient();
  await runCleanups([
    async () => {
      for (const [bucket, id] of [
        ["news-images", newsId],
        ["delegate-photos", delegateId],
      ] as const) {
        if (!id) continue;
        const { data, error } = await db.storage.from(bucket).list("", { search: id });
        if (error) throw error;
        if (data?.length) {
          const removed = await db.storage.from(bucket).remove(data.map((o) => o.name));
          if (removed.error) throw removed.error;
        }
      }
    },
    () => cleanupCommunityContent(MARKER),
    () => cleanupUsersByPhone("audit image fixture", [`+995${PHONE}`, `995${PHONE}`]),
  ]);
}

test.beforeAll(async () => {
  await cleanup();
  delegateId = (
    await seedPendingDelegate({
      phone: PHONE,
      firstName: "AuditImage",
      lastName: "Test",
      personalId: "95500075580",
    })
  ).id;
  await approveOwnDelegate(PHONE);
  const editor = await clientFor(await fixtureSession(ADMIN_PHONES.editor));
  const { data, error } = await editor.rpc("admin_save_news", {
    p_id: null,
    p_title: MARKER,
    p_body: "Fictional upload verification",
    p_visibility: "public",
  });
  if (error) throw error;
  newsId = data as string;
  original = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#e8ba55" } })
    .jpeg()
    .withExif({ IFD0: { Artist: MARKER, ImageDescription: "Private test metadata" } })
    .toBuffer();
  expect((await sharp(original).metadata()).exif).toBeDefined();
  console.log(`task5 original JPEG bytes=${original.length}; boundary=${MAX}; rejected=${MAX + 1}`);
});
test.afterAll(cleanup);

test("news cover: limit before sending, network failure, same-file retry, sanitized storage and render", async ({
  page,
}) => {
  await loginAs(page, ADMIN_PHONES.editor);
  await page.goto(`/admin/content/news/${newsId}`);
  const title = page.getByLabel("სათაური", { exact: true });
  await title.fill(`${MARKER} unsaved edit`);
  const input = page.locator('input[type="file"]');
  const button = page.getByRole("button", { name: "ყდის ატვირთვა" });
  let sent = 0;
  let requestBytes = 0;
  page.on("request", (request) => {
    if (request.headers()["next-action"]) {
      sent++;
      requestBytes = Math.max(requestBytes, request.postDataBuffer()?.length ?? 0);
    }
  });
  await input.setInputFiles({
    name: "too-big.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.concat([original, Buffer.alloc(MAX + 1 - original.length)]),
  });
  await button.click();
  await expect(page.locator('p[role="alert"]')).toContainText("4 MB");
  expect(sent).toBe(0);
  const boundary = Buffer.concat([original, Buffer.alloc(MAX - original.length)]);
  expect((await sharp(boundary).metadata()).width).toBe(80);
  await input.setInputFiles({ name: "boundary.jpg", mimeType: "image/jpeg", buffer: boundary });
  await page.route("**/*", async (route) => {
    if (route.request().headers()["next-action"]) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await button.click();
  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(title).toHaveValue(`${MARKER} unsaved edit`);
  expect(await input.evaluate((node: HTMLInputElement) => node.files?.[0]?.size)).toBe(MAX);
  await page.screenshot({
    path: "output/playwright/audit-minimal-repairs/task-5-news-retry.png",
    fullPage: true,
  });
  await page.unroute("**/*");
  await button.click();
  await expect
    .poll(
      async () =>
        (await serviceClient().from("news").select("image_url").eq("id", newsId).single()).data
          ?.image_url,
    )
    .toBeTruthy();
  const { data } = await serviceClient().from("news").select("image_url").eq("id", newsId).single();
  const url = data!.image_url as string;
  expect(url).toMatch(
    new RegExp(
      `^http://127\\.0\\.0\\.1:54321/storage/v1/object/public/news-images/${newsId}-[0-9]+\\.jpg$`,
    ),
  );
  const image = page.locator(`img[src="${url}"]`);
  await expect(image).toBeVisible();
  await expect(title).toHaveValue(`${MARKER} unsaved edit`);
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(80);
  const stored = await (await page.request.get(url)).body();
  const metadata = await sharp(stored).metadata();
  expect(metadata.exif).toBeUndefined();
  expect(metadata.xmp).toBeUndefined();
  expect(stored.equals(original)).toBe(false);
  expect(await getAuditRows("news.set_image", newsId)).toBe(1);
  console.log(
    `task5 news input=${boundary.length} request=${requestBytes} stored=${stored.length} dimensions=${metadata.width}x${metadata.height} exif=none`,
  );
  expect(requestBytes).toBeGreaterThan(boundary.length);
  expect(requestBytes).toBeLessThan(4_500_000);
  await page.screenshot({
    path: "output/playwright/audit-minimal-repairs/task-5-news-upload.png",
    fullPage: true,
  });
});

test("delegate photo: limit before sending, network failure, preserved bio/photo retry and sanitized render", async ({
  page,
}) => {
  await loginAs(page, ADMIN_PHONES.verifier);
  await page.goto(`/admin/verify/${delegateId}`);
  const input = page.getByLabel(/ფოტო \(JPEG/);
  const bio = page.getByLabel(/ბიოგრაფია/);
  const button = bio.locator("xpath=ancestor::form").getByRole("button", { name: "შენახვა" });
  let sent = 0;
  page.on("request", (request) => {
    if (request.headers()["next-action"]) sent++;
  });
  await input.setInputFiles({
    name: "too-big.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.concat([original, Buffer.alloc(MAX + 1 - original.length)]),
  });
  await button.click();
  await expect(page.locator('p[role="alert"]')).toContainText("4 MB");
  expect(sent).toBe(0);
  await input.setInputFiles({ name: "portrait.jpg", mimeType: "image/jpeg", buffer: original });
  await bio.fill("Fictional biography retained for retry");
  await page.route("**/*", async (route) => {
    if (route.request().headers()["next-action"]) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await button.click();
  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(bio).toHaveValue("Fictional biography retained for retry");
  expect(await input.evaluate((node: HTMLInputElement) => node.files?.[0]?.name)).toBe(
    "portrait.jpg",
  );
  await page.screenshot({
    path: "output/playwright/audit-minimal-repairs/task-5-delegate-retry.png",
    fullPage: true,
  });
  await page.unroute("**/*");
  await button.click();
  await expect(page.getByRole("status").filter({ hasText: "პროფილი განახლდა" })).toBeVisible();
  const { data } = await serviceClient()
    .from("delegates")
    .select("photo_url, bio")
    .eq("id", delegateId)
    .single();
  expect(data!.bio).toBe("Fictional biography retained for retry");
  const url = data!.photo_url as string;
  const image = page.locator(`img[src="${url}"]`);
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(80);
  const stored = await (await page.request.get(url)).body();
  const metadata = await sharp(stored).metadata();
  expect(metadata.exif).toBeUndefined();
  expect(metadata.xmp).toBeUndefined();
  expect(await getAuditRows("delegate.update_profile", delegateId)).toBe(1);
  console.log(
    `task5 delegate input=${original.length} stored=${stored.length} dimensions=${metadata.width}x${metadata.height} exif=none`,
  );
  await page.screenshot({
    path: "output/playwright/audit-minimal-repairs/task-5-delegate-upload.png",
    fullPage: true,
  });
});

test("local URL exceptions accept only the documented origin, bucket, target and filename; roles/hosted rules remain", async () => {
  const editor = await clientFor(await fixtureSession(ADMIN_PHONES.editor));
  const verifier = await clientFor(await fixtureSession(ADMIN_PHONES.verifier));
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  for (const [client, name, id, bucket, field, target, failure] of [
    [editor, "admin_set_news_image", newsId, "news-images", "p_image_url", "p_id", "invalid_image"],
    [
      verifier,
      "admin_update_delegate_profile",
      delegateId,
      "delegate-photos",
      "p_photo_url",
      "p_delegate_id",
      "invalid_target",
    ],
  ] as const) {
    const call = (url: string) =>
      client.rpc(name, {
        [target]: id,
        [field]: url,
        ...(name === "admin_update_delegate_profile" ? { p_bio: "URL contract fixture" } : {}),
      });
    const path = `/storage/v1/object/public/${bucket}/${id}-1793000000000.jpg`;
    for (const url of [
      `http://example.com:54321${path}`,
      `http://127.0.0.1:54322${path}`,
      `http://user:password@localhost:54321${path}`,
      `http://localhost:54321${path}?v=1`,
      `http://localhost:54321${path}#fragment`,
      `http://localhost:54321${path.replace(bucket, "other-bucket")}`,
      `http://localhost:54321${path.replace(id, "11111111-1111-4111-8111-111111111111")}`,
      `http://localhost:54321${path.replace("1793000000000", "bad")}`,
      `http://localhost:54321${path.replace(".jpg", ".svg")}`,
    ])
      expect((await call(url)).error?.message).toBe(failure);
    for (const origin of ["http://127.0.0.1:54321", "http://localhost:54321"])
      expect((await call(`${origin}${path}`)).error).toBeNull();
    expect((await call(`https://abcdefghijklmnopqrst.supabase.co${path}`)).error).toBeNull();
    if (name === "admin_update_delegate_profile")
      expect((await call("https://existing-host.example/portrait.jpg")).error).toBeNull();
    const unauthorized = client === editor ? verifier : editor;
    const refused = await unauthorized.rpc(name, {
      [target]: id,
      [field]: `http://localhost:54321${path}`,
      ...(name === "admin_update_delegate_profile" ? { p_bio: "" } : {}),
    });
    expect(refused.error?.message).toBe("missing_role");
    const anonymous = await anon.rpc(name, {
      [target]: id,
      [field]: `http://localhost:54321${path}`,
      ...(name === "admin_update_delegate_profile" ? { p_bio: "" } : {}),
    });
    expect(anonymous.error?.code).toBe("42501");
  }
});
