# Before-launch hardening (R4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four confirmed before-launch findings:
- uploaded photos publish hidden location data (M4);
- the offline cache keeps sign-in data (M3);
- destructive scripts aren't locked to staging (M6);
- approved delegates can rename themselves (M2).

**Architecture:** Three PRs.
- **R4a** (code only): image sanitizing on upload, service-worker never-cache rule plus cache clearing
  on sign-out, and a staging allow-list guard for scripts.
- **R4b** (migration only): name lock for approved delegates and an audited admin rename RPC.
- **R4c** (code, after R4b reaches production): the admin rename form, the `name_locked` message and
  the audit label.

**Tech Stack:** sharp 0.35 (runtime dependency), Serwist service worker, plpgsql, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-security-audit-fixes-design.md` (sections 1, 5, 7 D3, 8)

## Global Constraints

- TypeScript strict; zod at boundaries. Domain logic is pure functions in `lib/`.
- All user-facing text Georgian; never typographic quotes; ka-gate plus `ka:scan` on touched files.
- Gates before every push: `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `npm run ka:scan`, `npm test`, `npm run build`. CI also runs e2e against staging.
- Dependencies are recorded in DECISIONS.md (CLAUDE.md). Recheck the next ADR number before merge.
- Admin mutations write `audit_log` (CLAUDE.md). The service-role client is used only after a
  server-side role check.
- Migrations: restate live bodies verbatim apart from the stated change. Revoke before grant.
  Migration-only PR first, then the production-db dry-run and apply after the owner's yes, then the
  code PR.
- Never run `scripts/seed-staging.mjs` while implementing: staging holds the owner's real account.
- Merge = release for both sites. Check the `Vercel – georgia-republic` status on every merge commit.

---

## R4a — branch `claude/security-before-launch-code`

### Task 1: `sanitizeUploadedImage` (M4)

**Files:**
- Create: `lib/image-sanitize.ts`
- Test: `lib/image-sanitize.test.ts`
- Modify: `package.json` (move `sharp` from devDependencies to dependencies, `^0.35.5`),
  `package-lock.json`

**Interfaces:**
- Produces:
  - `sanitizeUploadedImage(bytes: ArrayBuffer, mime: UploadMime): Promise<Uint8Array>`. Re-encodes in
    the same format, applies the EXIF orientation, and drops all metadata.
  - `type UploadMime = "image/jpeg" | "image/png" | "image/webp"`.
  - `isUploadMime(value: string): value is UploadMime`.
  - It throws `ImageSanitizeError` for undecodable input.

- [ ] **Step 1: Move and upgrade sharp**

```bash
npm uninstall sharp
npm install sharp@^0.35.5
```

Expected: `package.json` lists `"sharp": "^0.35.5"` under `dependencies`.
`scripts/generate-icons.mjs` and `scripts/generate-og-default.mjs` still import it. Run
`node scripts/generate-og-default.mjs --help` or the script's dry form only if one exists. Otherwise
leave them alone, since their API calls are unchanged.

- [ ] **Step 2: Write the failing test**

```ts
// lib/image-sanitize.test.ts
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ImageSanitizeError, isUploadMime, sanitizeUploadedImage } from "./image-sanitize";

const MARKER = "AUDIT-M4-SECRET-LOCATION";

async function photoWithMetadata(format: "jpeg" | "png" | "webp"): Promise<ArrayBuffer> {
  const buf = await sharp({ create: { width: 8, height: 4, channels: 3, background: "#9f1d35" } })
    .withExif({ IFD0: { Copyright: MARKER, ImageDescription: MARKER } })
    .withMetadata({ orientation: 6 }) // "rotate 90° clockwise to display"
    .toFormat(format)
    .toBuffer();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe("sanitizeUploadedImage (security audit M4)", () => {
  it.each([
    ["image/jpeg", "jpeg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ] as const)("%s: drops every metadata block and keeps the format", async (mime, format) => {
    const input = await photoWithMetadata(format);
    expect(Buffer.from(input).includes(MARKER)).toBe(true); // the fixture really carries it

    const output = await sanitizeUploadedImage(input, mime);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe(format);
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.orientation ?? 1).toBe(1);
    expect(Buffer.from(output).includes(MARKER)).toBe(false);
  });

  it("applies the camera orientation before dropping it", async () => {
    const output = await sanitizeUploadedImage(await photoWithMetadata("jpeg"), "image/jpeg");
    const meta = await sharp(output).metadata();
    expect([meta.width, meta.height]).toEqual([4, 8]);
  });

  it("refuses bytes that are not an image", async () => {
    const junk = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
    await expect(sanitizeUploadedImage(junk, "image/jpeg")).rejects.toBeInstanceOf(
      ImageSanitizeError,
    );
  });

  it("knows exactly the three upload types", () => {
    expect(["image/jpeg", "image/png", "image/webp"].every(isUploadMime)).toBe(true);
    expect(isUploadMime("image/gif")).toBe(false);
  });
});
```

- [ ] **Step 3: Run, expect FAIL** (`Failed to resolve import "./image-sanitize"`).

Run: `npx vitest run lib/image-sanitize.test.ts`

- [ ] **Step 4: Implement**

```ts
// lib/image-sanitize.ts
import "server-only";
import sharp from "sharp";

/**
 * Uploaded photos are published as-is from public buckets, so a phone photo would carry its
 * GPS position, time and device (security audit 2026-10-08, M4). Every upload is re-encoded:
 * the EXIF orientation is applied first (otherwise phone photos would turn sideways), then the
 * image is written without any metadata. sharp drops metadata unless asked to keep it.
 */
export type UploadMime = "image/jpeg" | "image/png" | "image/webp";

export class ImageSanitizeError extends Error {
  constructor() {
    super("image could not be decoded");
  }
}

export function isUploadMime(value: string): value is UploadMime {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

export async function sanitizeUploadedImage(
  bytes: ArrayBuffer,
  mime: UploadMime,
): Promise<Uint8Array> {
  try {
    const image = sharp(Buffer.from(bytes), { failOn: "error" }).rotate();
    const encoded =
      mime === "image/jpeg"
        ? image.jpeg({ quality: 90, mozjpeg: true })
        : mime === "image/png"
          ? image.png()
          : image.webp({ quality: 90 });
    return new Uint8Array(await encoded.toBuffer());
  } catch {
    throw new ImageSanitizeError();
  }
}
```

- [ ] **Step 5: Run, expect PASS.** The fixture approach was checked on 2026-10-08 with sharp 0.33.5:
  - JPEG, PNG and WebP fixtures carry the marker and orientation 6;
  - after `rotate()` and re-encoding, each is 4×8 with no EXIF and no marker;
  - junk bytes throw "corrupt header".

  If `withExif` is missing from the installed typings, check `node_modules/sharp/lib/index.d.ts`. Do
  not cast around it.

- [ ] **Step 6: Commit**

```bash
git add lib/image-sanitize.ts lib/image-sanitize.test.ts package.json package-lock.json
git commit -m "Re-encode uploaded images without metadata (audit M4)"
```

### Task 2: Both upload paths sanitize before storing

**Files:**
- Modify: `app/(admin)/admin/verify/[id]/actions.ts:43-56`
- Modify: `app/(admin)/admin/content/news/actions.ts:128-142`
- Test: `app/(admin)/admin/verify/[id]/actions.test.ts`, the news actions test next to
  `app/(admin)/admin/content/news/actions.ts`

**Interfaces:**
- Consumes: `sanitizeUploadedImage`, `isUploadMime`, `ImageSanitizeError` (Task 1).

- [ ] **Step 1: Write the failing tests**

In both test files, add a module mock before the action import. The 3-byte fixtures are not real
images:

```ts
const sanitize = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/lib/image-sanitize", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/image-sanitize")>();
  return { ...real, sanitizeUploadedImage: sanitize.run };
});
```

In `beforeEach`, or at the top of each existing upload test:
`sanitize.run.mockResolvedValue(new Uint8Array([1, 2, 3]))`. Then add, for the delegate photo:

```ts
  it("stores the sanitized bytes, never the uploaded ones (audit M4)", async () => {
    mocks.getAdminRoles.mockResolvedValue(["verifier"]);
    sanitize.run.mockResolvedValue(new Uint8Array([9, 9, 9]));
    approvedTarget();
    await expect(updateDelegateProfileAction(form({ delegateId, photo: jpeg() }))).resolves.toEqual(
      { ok: true },
    );
    expect(sanitize.run).toHaveBeenCalledWith(expect.any(ArrayBuffer), "image/jpeg");
    const upload = admin.storageCalls.find((c) => c.method === "upload");
    expect(upload?.args[1]).toEqual(new Uint8Array([9, 9, 9]));
  });

  it("refuses an undecodable photo without uploading anything", async () => {
    mocks.getAdminRoles.mockResolvedValue(["verifier"]);
    const { ImageSanitizeError } = await import("@/lib/image-sanitize");
    sanitize.run.mockRejectedValue(new ImageSanitizeError());
    approvedTarget();
    await expect(updateDelegateProfileAction(form({ delegateId, photo: jpeg() }))).resolves.toEqual(
      { ok: false, error: "ფოტოს წაკითხვა ვერ მოხერხდა — სცადე სხვა ფაილი." },
    );
    expect(admin.storageCalls.find((c) => c.method === "upload")).toBeUndefined();
  });
```

Mirror both tests for the news cover action. Its refusal text is
`"სურათის წაკითხვა ვერ მოხერხდა — სცადე სხვა ფაილი."`.

- [ ] **Step 2: Run, expect FAIL** (raw bytes are uploaded; no refusal path).

- [ ] **Step 3: Implement (delegate photo)**

Replace the upload block in `app/(admin)/admin/verify/[id]/actions.ts`:

```ts
    const admin = createAdminClient();
    let clean: Uint8Array;
    try {
      clean = await sanitizeUploadedImage(await photo.arrayBuffer(), photo.type as UploadMime);
    } catch (caught) {
      if (caught instanceof ImageSanitizeError) {
        return { ok: false, error: "ფოტოს წაკითხვა ვერ მოხერხდა — სცადე სხვა ფაილი." };
      }
      throw caught;
    }
    // versioned filename: an updated photo must never serve stale from CDN caches
    newPath = `${parsed.data.delegateId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("delegate-photos")
      .upload(newPath, clean, { contentType: photo.type });
```

`ext` is only truthy for the three `PHOTO_TYPES`, so the type is known. Narrow it properly instead of
casting: replace `const ext = PHOTO_TYPES[photo.type]; if (!ext) ...` with

```ts
    const ext = PHOTO_TYPES[photo.type];
    if (!ext || !isUploadMime(photo.type)) {
      return { ok: false, error: "დაშვებულია მხოლოდ JPEG, PNG ან WebP ფოტო." };
    }
```

and call `sanitizeUploadedImage(await photo.arrayBuffer(), photo.type)` with no cast. Import:

```ts
import { ImageSanitizeError, isUploadMime, sanitizeUploadedImage } from "@/lib/image-sanitize";
```

Do the same in the news cover action:
- same narrowing;
- `"სურათის წაკითხვა ვერ მოხერხდა — სცადე სხვა ფაილი."` on `ImageSanitizeError`;
- upload `clean`.

The sanitize call must come after the role check and the target check: both actions already order
role → target → file.

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run "app/(admin)/admin/verify" "app/(admin)/admin/content/news"`

- [ ] **Step 5: Georgian gates, commit**

```bash
node scripts/ka-gate.mjs --diff main "app/(admin)/admin/verify/[id]/actions.ts" "app/(admin)/admin/content/news/actions.ts"
npm run ka:scan
git add "app/(admin)/admin/verify/[id]" "app/(admin)/admin/content/news"
git commit -m "Store only metadata-free photos and covers (audit M4)"
```

### Task 3: Nothing cross-origin or protected is cached; sign-out clears caches (M3)

**Files:**
- Create: `lib/sw-routes.ts`
- Test: `lib/sw-routes.test.ts`
- Modify: `app/sw.ts:20-66`, `components/useSignOut.ts`

**Interfaces:**
- Produces:
  - `PROTECTED_PREFIXES`;
  - `isNeverCached(url: URL, sameOrigin: boolean): boolean`;
  - `runtimeCachesToClear(names: readonly string[]): string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/sw-routes.test.ts
import { describe, expect, it } from "vitest";
import { isNeverCached, runtimeCachesToClear } from "./sw-routes";

const at = (href: string) => new URL(href);

describe("service-worker never-cache rule (security audit M3)", () => {
  it("never caches anything from another origin, Supabase above all", () => {
    expect(isNeverCached(at("https://abc.supabase.co/auth/v1/user"), false)).toBe(true);
    expect(isNeverCached(at("https://abc.supabase.co/rest/v1/cities?select=*"), false)).toBe(true);
    expect(
      isNeverCached(at("https://abc.supabase.co/storage/v1/object/public/x.jpg"), false),
    ).toBe(true);
  });

  it("never caches signed-in or API pages on our own origin", () => {
    for (const path of ["/me", "/me/profile", "/delegate", "/admin/members", "/api/dev/otp", "/login"])
      expect(isNeverCached(at(`https://site.test${path}`), true)).toBe(true);
  });

  it("still lets public pages be cached", () => {
    for (const path of ["/", "/leaderboard", "/delegates/nino", "/members", "/meeting"])
      expect(isNeverCached(at(`https://site.test${path}`), true)).toBe(false);
  });

  it("clears runtime caches on sign-out but keeps the offline precache", () => {
    expect(
      runtimeCachesToClear(["serwist-precache-v2-https://site.test/", "cross-origin", "pages", "apis"]),
    ).toEqual(["cross-origin", "pages", "apis"]);
  });
});
```

`/members` and `/meeting` check prefix boundaries (`/me` must not swallow them).

- [ ] **Step 2: Run, expect FAIL** (no module).

- [ ] **Step 3: Implement**

```ts
// lib/sw-routes.ts
/**
 * What the service worker must never put in Cache Storage. A cached response outlives
 * sign-out on a shared or seized phone (security audit 2026-10-08, M3).
 */
export const PROTECTED_PREFIXES = ["/me", "/delegate", "/admin", "/api", "/login"] as const;

export function isNeverCached(url: URL, sameOrigin: boolean): boolean {
  // Cross-origin = Supabase (auth, data, storage). The public site never needs it offline.
  if (!sameOrigin) return true;
  return PROTECTED_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
}

/** Runtime caches are emptied on sign-out; the precache only holds the offline shell. */
export function runtimeCachesToClear(names: readonly string[]): string[] {
  return names.filter((name) => !name.includes("precache"));
}
```

`app/sw.ts`: delete the local `PROTECTED_PREFIXES`, keep its explanatory comment above the import,
and change the matcher:

```ts
import { isNeverCached } from "@/lib/sw-routes";
```

```ts
    {
      matcher: ({ url, sameOrigin }) => isNeverCached(url, sameOrigin),
      handler: new NetworkOnly(),
    },
```

`scripts/build-sw.mjs` bundles with esbuild, which does not read tsconfig `paths` by default. Use
the relative import `../lib/sw-routes` in `app/sw.ts` if `npm run build` fails to resolve `@/`.

`components/useSignOut.ts`, inside `signOut()` before `router.push("/")`:

```ts
    try {
      if (typeof caches !== "undefined") {
        const names = runtimeCachesToClear(await caches.keys());
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch {
      // best-effort: the never-cache rule already keeps signed-in data out of these caches
    }
```

with `import { runtimeCachesToClear } from "@/lib/sw-routes";`.

- [ ] **Step 4: Run, expect PASS; build the worker**

Run: `npx vitest run lib/sw-routes.test.ts`, then `npm run build`. Expected: `public/sw.js written`.

- [ ] **Step 5: Commit**

```bash
git add lib/sw-routes.ts lib/sw-routes.test.ts app/sw.ts components/useSignOut.ts
git commit -m "Never cache cross-origin or signed-in responses; clear caches at sign-out (audit M3)"
```

### Task 4: Scripts refuse anything but staging (M6)

**Files:**
- Create: `scripts/staging-guard.mjs`
- Modify:
  - `scripts/seed-staging.mjs:26-45`
  - `scripts/verify-schema.mjs:1-6`
  - `scripts/verify-security-fixes.mjs` (right after it reads the URL)
  - `scripts/security/db.mjs:13-18`
- Test: `lib/security/staging-guard.test.ts`

**Interfaces:**
- Produces: `assertStagingTarget(url: string | undefined): void`. It exits the process with code 1
  and a message that names no project ref, unless the URL's first host label is `orcxtbedkexoclbfgvzd`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/security/staging-guard.test.ts
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The production ref on an unresolvable TLD: even a missing guard could reach nothing.
const PRODUCTION_LOOKALIKE = "https://uorvlshbrlbdnbauxsws.supabase.invalid";

function run(args: string[]) {
  return spawnSync(process.execPath, args, {
    encoding: "utf8",
    timeout: 30_000,
    env: {
      PATH: process.env.PATH ?? "",
      NEXT_PUBLIC_SUPABASE_URL: PRODUCTION_LOOKALIKE,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only",
      SUPABASE_SERVICE_ROLE_KEY: "test-only",
    },
  });
}

describe("scripts touch only staging (security audit M6)", () => {
  it.each([
    [["scripts/seed-staging.mjs", "--confirm-ref", "uorvlshbrlbdnbauxsws"]],
    [["scripts/verify-schema.mjs"]],
    [["scripts/verify-security-fixes.mjs"]],
    [["--input-type=module", "-e", "await import('./scripts/security/db.mjs')"]],
  ])("%j refuses a non-staging database and names no ref", (args) => {
    const result = run(args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("only against the staging database");
    expect(`${result.stdout}${result.stderr}`).not.toContain("uorvlshbrlbdnbauxsws");
    expect(`${result.stdout}${result.stderr}`).not.toContain("orcxtbedkexoclbfgvzd");
  });

  it("allows exactly the staging ref that lib/env.ts names", () => {
    const guard = readFileSync("scripts/staging-guard.mjs", "utf8");
    const env = readFileSync("lib/env.ts", "utf8");
    const ref = /STAGING_PROJECT_REF = "([a-z]+)"/.exec(env)?.[1];
    expect(ref).toBe("orcxtbedkexoclbfgvzd");
    expect(guard).toContain(`STAGING_PROJECT_REF = "${ref}"`);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (no guard; the seed prints the ref).

Run: `npx vitest run lib/security/staging-guard.test.ts`

- [ ] **Step 3: Implement**

```js
// scripts/staging-guard.mjs
/**
 * Destructive and probing scripts may only ever touch the STAGING project (security audit
 * 2026-10-08, M6). Allow-list, not deny-list: a missing, mistyped or production URL is refused,
 * whatever NEXT_PUBLIC_APP_ENV says. The refusal names no project ref, so there is nothing to
 * copy into a confirm flag. Keep STAGING_PROJECT_REF equal to lib/env.ts (a test checks it).
 */
export const STAGING_PROJECT_REF = "orcxtbedkexoclbfgvzd";

export function assertStagingTarget(url) {
  let ref = "";
  try {
    ref = new URL(url ?? "").hostname.split(".")[0] ?? "";
  } catch {
    ref = "";
  }
  if (ref !== STAGING_PROJECT_REF) {
    console.error("Refusing: this script runs only against the staging database.");
    process.exit(1);
  }
}
```

Call it first thing after each script reads its URL, before any `createClient`:

```js
import { assertStagingTarget } from "./staging-guard.mjs"; // "../staging-guard.mjs" from scripts/security/
assertStagingTarget(process.env.NEXT_PUBLIC_SUPABASE_URL);
```

In `seed-staging.mjs`:
- keep the `NEXT_PUBLIC_APP_ENV` check and `--confirm-ref`;
- call the guard before them;
- change the confirm message so it no longer prints the ref:
  `Refusing to seed: pass --confirm-ref <the staging project ref> to confirm the target project.`

In `scripts/security/db.mjs`, call the guard before the missing-variables `throw`, so a production URL
is refused even when keys are present.

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add scripts/staging-guard.mjs scripts/seed-staging.mjs scripts/verify-schema.mjs scripts/verify-security-fixes.mjs scripts/security/db.mjs lib/security/staging-guard.test.ts
git commit -m "Lock destructive and probing scripts to the staging project (audit M6)"
```

### Task 5: Release R4a

- [ ] **Step 1: ADR** covering:
  - sharp as a runtime dependency and why (M4), including the orientation rule;
  - cross-origin never cached and caches cleared at sign-out (M3);
  - the scripts' allow-list (M6).
- [ ] **Step 2: Gates, push, PR, bind**, plus per-task and whole-branch reviews.
- [ ] **Step 3: /qa on the demo preview**
  - As a staging verifier, upload a phone JPEG that has GPS data. Download the stored file from its
    public URL and confirm no GPS: `node -e "require('sharp')(require('fs').readFileSync(process.argv[1])).metadata().then(m=>console.log(m.exif))" file.jpg`
    prints `undefined`.
  - Confirm the photo is upright on `/delegates/<slug>`.
  - Sign in, then sign out; in DevTools → Application → Cache Storage, no `cross-origin`, `pages`
    or `apis` cache remains.
- [ ] **Step 4: Owner sign-off (plain language):**
  - "photos no longer reveal where they were taken";
  - "signing out leaves nothing about you in the phone's offline copy";
  - "the test-data tool can only ever touch the test database".

  Screenshots, preview URL; wait for the yes.
- [ ] **Step 5: Merge after `quality`, verify georgia-republic** (a delegate page still shows its photo).

---

## R4b — branch `claude/security-delegate-name-db` (migration only)

### Task 6: Name lock and audited admin rename (M2, owner decision D3)

**Files:**
- Create: `supabase/migrations/20261010100000_delegate_name_lock.sql` (use a timestamp later than
  every migration on main at implementation time)
- Modify:
  - `.github/workflows/production-db.yml` (both counts)
  - `lib/supabase/types.ts` (`Functions`: `is_approved_delegate`, `admin_update_delegate_name`)
- Test: `lib/security/delegate-name-lock.test.ts`

**Interfaces:**
- Produces:
  - `is_approved_delegate(): boolean` (auth.uid()-keyed, SECURITY DEFINER);
  - `protect_profile_columns()` raises `name_locked`;
  - `admin_update_delegate_name(p_delegate_id uuid, p_first_name text, p_last_name text) returns void`,
    for super_admin/verifier, which writes audit `delegate.update_name`.

- [ ] **Step 1: Write the failing static tests**

```ts
// lib/security/delegate-name-lock.test.ts
import { describe, expect, it } from "vitest";
import { latestDefinition, orderedMigrationSql } from "./migration-model";

describe("approved delegates' names (security audit M2)", () => {
  it("are locked against client roles through a definer helper", () => {
    const trigger = latestDefinition("protect_profile_columns");
    expect(trigger).toMatch(
      /new\.first_name is distinct from old\.first_name\s+or new\.last_name is distinct from old\.last_name\)\s+and public\.is_approved_delegate\(\)/,
    );
    expect(trigger).toContain("raise exception 'name_locked'");
    // the guarded list and value rules stay intact
    expect(trigger).toContain("new.privacy_version is distinct from old.privacy_version");
    expect(trigger).toContain("raise exception 'invalid_name'");
  });

  it("checks approval as the owner, because clients cannot read delegates", () => {
    const helper = latestDefinition("is_approved_delegate");
    expect(helper).toContain("security definer set search_path = ''");
    expect(helper).toContain("where d.id = auth.uid() and d.status = 'approved'");
  });

  it("can be corrected only by super_admin or verifier, with an audit row", () => {
    const rpc = latestDefinition("admin_update_delegate_name");
    expect(rpc).toContain("public.has_any_admin_role('super_admin', 'verifier')");
    expect(rpc).toContain("'delegate.update_name'");
    expect(rpc).toMatch(/not between 1 and 60/);
    const sql = orderedMigrationSql();
    expect(sql).toMatch(
      /revoke execute on function admin_update_delegate_name\(uuid, text, text\) from public, anon;/,
    );
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Write the migration**

The `protect_profile_columns()` body must be restated from the **live** definition: run
`latestDefinition("protect_profile_columns")` and copy it. On 2026-10-08 that was
`20261008140000_registration_privacy_consent.sql:20-54`. Add only the name-lock block.

```sql
-- Security audit 2026-10-08, M2: an approved delegate could rename themselves after vetting,
-- straight onto the public page and unaudited. Names of approved delegates now change only
-- through admin_update_delegate_name() (super_admin/verifier, audited). Owner decision D3.

-- Clients cannot SELECT delegates (20260713175043), and the trigger must run as the invoker so
-- current_user still tells clients apart. The approval check is therefore a definer helper,
-- keyed on the caller (a client only ever updates its own profile row: "own profile updatable").
create function is_approved_delegate() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.delegates d
    where d.id = auth.uid() and d.status = 'approved'
  );
$$;
revoke execute on function is_approved_delegate() from public, anon;
grant execute on function is_approved_delegate() to authenticated;

create or replace function protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.status is distinct from old.status
      or new.personal_id is distinct from old.personal_id
      or new.phone is distinct from old.phone
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
      or new.signup_ref_code is distinct from old.signup_ref_code
      or new.membership_tier is distinct from old.membership_tier
      or new.reference_code is distinct from old.reference_code
      or new.registration_completed_at is distinct from old.registration_completed_at
      or new.pending_delegate_id is distinct from old.pending_delegate_id
      or new.referral_code is distinct from old.referral_code
      or new.privacy_accepted_at is distinct from old.privacy_accepted_at
      or new.privacy_version is distinct from old.privacy_version
    then
      raise exception 'server-managed profile columns cannot be changed by client roles';
    end if;
    -- Security audit M2: an approved delegate's public name changes only through an admin.
    if (new.first_name is distinct from old.first_name
        or new.last_name is distinct from old.last_name)
       and public.is_approved_delegate() then
      raise exception 'name_locked';
    end if;
    -- Phase 3 hardening rider — keep: value rules on direct client PATCHes
    if new.first_name is distinct from old.first_name
       and length(btrim(coalesce(new.first_name, ''))) not between 1 and 60 then
      raise exception 'invalid_name';
    end if;
    if new.last_name is distinct from old.last_name
       and length(btrim(coalesce(new.last_name, ''))) not between 1 and 60 then
      raise exception 'invalid_name';
    end if;
    if new.employment is distinct from old.employment
       and length(btrim(coalesce(new.employment, ''))) not between 1 and 100 then
      raise exception 'invalid_employment';
    end if;
  end if;
  return new;
end $$;

create function admin_update_delegate_name(
  p_delegate_id uuid, p_first_name text, p_last_name text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_first text := btrim(coalesce(p_first_name, ''), E' \t\r\n');
  v_last text := btrim(coalesce(p_last_name, ''), E' \t\r\n');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  if length(v_first) not between 1 and 60 or length(v_last) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  if not exists (
    select 1 from public.delegates d where d.id = p_delegate_id and d.status = 'approved'
  ) then
    raise exception 'invalid_target';
  end if;
  select * into v_profile from public.profiles where id = p_delegate_id;

  update public.profiles set first_name = v_first, last_name = v_last where id = p_delegate_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.update_name', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'from', v_profile.first_name || ' ' || v_profile.last_name,
            'to', v_first || ' ' || v_last));
end $$;
revoke execute on function admin_update_delegate_name(uuid, text, text) from public, anon;
grant execute on function admin_update_delegate_name(uuid, text, text) to authenticated;
```

The admin RPC's own UPDATE runs as the definer, so `current_user` is not a client role and the
lock does not block it.

- [ ] **Step 4: Types and count**

`lib/supabase/types.ts` `Functions`: add

```ts
      is_approved_delegate: { Args: Record<string, never>; Returns: boolean };
      admin_update_delegate_name: {
        Args: { p_delegate_id: string; p_first_name: string; p_last_name: string };
        Returns: undefined;
      };
```

Follow the exact shape of a neighbouring entry such as `admin_update_delegate_profile`. Raise both
`EXPECTED_MIGRATION_FILE_COUNT` values to the committed count.

- [ ] **Step 5: Run tests, expect PASS; commit**

Run: `npx vitest run lib/security lib/production-db-workflow.test.ts lib/privacy.test.ts`

```bash
git add supabase/migrations/20261010100000_delegate_name_lock.sql lib/security/delegate-name-lock.test.ts lib/supabase/types.ts .github/workflows/production-db.yml
git commit -m "Lock approved delegates' names; audited admin rename (audit M2)"
```

### Task 7: Release R4b

- [ ] ADR, gates, PR, owner sign-off. Plain language: "a delegate can no longer change their public
  name after approval; admins can correct it, and the change is recorded."
- [ ] Merge, then apply to staging with the established staging push, then verify read-only:
  `select has_function_privilege('authenticated','public.admin_update_delegate_name(uuid,text,text)','EXECUTE');`
  must return `true`. As a staging test delegate (approved), a profile save that changes the name must
  fail with `name_locked`. A save that changes only the city must succeed.
- [ ] Production dry-run, owner yes, apply; then check georgia-republic.

---

## R4c — branch `claude/security-delegate-name-ui` (after R4b is applied in production)

### Task 8: Name-locked message, admin rename form, audit label

**Files:**
- Modify:
  - `lib/funnel.ts` (`ERROR_MESSAGES`)
  - `app/(member)/me/actions.ts:34-50, 57-71` (map DB errors)
  - `lib/admin.ts`, `lib/admin.test.ts` (label `delegate.update_name`, count +1)
  - `lib/admin-schemas.ts` (`delegateNameSchema`)
  - `app/(admin)/admin/verify/[id]/actions.ts` (`updateDelegateNameAction`)
  - `app/(admin)/admin/verify/[id]/page.tsx` (render the form)
- Create: `app/(admin)/admin/verify/[id]/DelegateNameForm.tsx`
- Test:
  - `app/(admin)/admin/verify/[id]/actions.test.ts`
  - `app/(admin)/admin/verify/[id]/DelegateNameForm.test.tsx`
  - `app/(member)/me/actions.test.ts` (create if missing)

**Interfaces:**
- Consumes: `admin_update_delegate_name` (Task 6).
- Produces:
  - `updateDelegateNameAction(input: unknown): Promise<SaveProfileResult>`;
  - `delegateNameSchema = z.object({ delegateId: uuid, firstName, lastName })`.

- [ ] **Step 1: Failing tests**

Append to `app/(admin)/admin/verify/[id]/actions.test.ts`. It uses the file's existing `mocks`,
`session`, `ok`, `raised` and `delegateId`. Change the dynamic import line to
`const { updateDelegateProfileAction, updateDelegateNameAction } = await import("./actions");`.

```ts
describe("updateDelegateNameAction (security audit M2)", () => {
  const input = { delegateId, firstName: "  ნინო ", lastName: " ბერიძე  " };

  it.each([[[]], [["finance", "editor"]]])("refuses roles %j before any client exists", async (roles) => {
    mocks.getAdminRoles.mockResolvedValue(roles);
    await expect(updateDelegateNameAction(input)).resolves.toEqual({
      ok: false,
      error: mapFunnelError("missing_role"),
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("renames only through the audited RPC, trimmed, then refreshes both pages", async () => {
    mocks.getAdminRoles.mockResolvedValue(["verifier"]);
    const s = session({ rpc: () => ok(), from: () => ok({ slug: "nino-beridze" }) });
    await expect(updateDelegateNameAction(input)).resolves.toEqual({ ok: true });
    expect(s.rpcCalls()).toEqual([
      {
        kind: "rpc",
        name: "admin_update_delegate_name",
        args: { p_delegate_id: delegateId, p_first_name: "ნინო", p_last_name: "ბერიძე" },
        chain: [],
      },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/verify/${delegateId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/delegates/nino-beridze");
  });

  it("maps a database refusal", async () => {
    mocks.getAdminRoles.mockResolvedValue(["super_admin"]);
    session({ rpc: () => raised("invalid_target") });
    await expect(updateDelegateNameAction(input)).resolves.toEqual({
      ok: false,
      error: mapFunnelError("invalid_target"),
    });
  });
});
```

Create `app/(member)/me/actions.test.ts` if it doesn't exist; otherwise append:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@/lib/funnel";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ update: () => ({ eq: mocks.update }) }),
  })),
}));

import { updateProfileAction, updateRegisteredNameAction } from "./actions";

describe("profile name edits of an approved delegate (security audit M2)", () => {
  beforeEach(() => mocks.update.mockResolvedValue({ error: { message: "name_locked", code: "P0001" } }));

  it("explains the lock on the full profile form", async () => {
    await expect(
      updateProfileAction({
        firstName: "ახალი",
        lastName: "სახელი",
        regionId: 1,
        cityId: 2,
        employment: "სტუდენტი",
      }),
    ).resolves.toEqual({ ok: false, error: ERROR_MESSAGES["name_locked"] });
  });

  it("explains the lock on the registered-name form", async () => {
    await expect(
      updateRegisteredNameAction({ firstName: "ახალი", lastName: "სახელი" }),
    ).resolves.toEqual({ ok: false, error: ERROR_MESSAGES["name_locked"] });
  });
});
```

Check the field names against `profileUpdateSchema` and `registeredNameUpdateSchema` in
`lib/cabinet-schemas.ts` before running. The inputs must pass those schemas.

`app/(admin)/admin/verify/[id]/DelegateNameForm.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DelegateNameForm } from "./DelegateNameForm";

describe("DelegateNameForm", () => {
  it("prefills both names and saves them together", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    render(
      <DelegateNameForm delegateId="d1" initialFirstName="ნინო" initialLastName="ბერიძე" save={save} />,
    );
    const first = screen.getByLabelText("სახელი");
    expect(first).toHaveValue("ნინო");
    fireEvent.change(first, { target: { value: "ნინა" } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    expect(await screen.findByText("სახელი განახლდა ✓")).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith({ delegateId: "d1", firstName: "ნინა", lastName: "ბერიძე" });
  });
});
```

`lib/admin.test.ts`: the list becomes 31 actions (30 after R2, plus `delegate.update_name`).

The profile schemas live in `lib/cabinet-schemas.ts` (`profileUpdateSchema`,
`registeredNameUpdateSchema`), not `lib/funnel-schemas.ts`.

- [ ] **Step 2: Implement**

`lib/funnel.ts`, after `invalid_name`:

```ts
  // Security audit M2: an approved delegate's public name changes only through the admins.
  name_locked:
    "დამტკიცებული დელეგატის სახელსა და გვარს ცვლის მხოლოდ ადმინისტრაცია — მოგვწერე მხარდაჭერის გვერდიდან.",
```

`app/(member)/me/actions.ts`, in both actions, replace the generic fallback with
`return { ok: false, error: mapFunnelError(error.message) };`. Keep the existing 23503 → `invalid_city`
branch first.

`lib/admin.ts` label:

```ts
  "delegate.update_name": "დელეგატის სახელის შესწორება",
```

`lib/admin-schemas.ts`:

```ts
const personName = z
  .string()
  .trim()
  .min(1, "შეავსე სახელი და გვარი.")
  .max(60, "მაქსიმუმ 60 სიმბოლო");

export const delegateNameSchema = z.object({
  delegateId: uuid,
  firstName: personName,
  lastName: personName,
});
```

`app/(admin)/admin/verify/[id]/actions.ts`:

```ts
export async function updateDelegateNameAction(input: unknown): Promise<SaveProfileResult> {
  const parsed = delegateNameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["verifier", "super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_update_delegate_name", {
    p_delegate_id: parsed.data.delegateId,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  const { data: row } = await supabase
    .from("admin_delegate_queue")
    .select("slug")
    .eq("id", parsed.data.delegateId)
    .single();
  revalidatePath(`/admin/verify/${parsed.data.delegateId}`);
  if (row?.slug) revalidatePath(`/delegates/${row.slug}`);
  return { ok: true };
}
```

`DelegateNameForm.tsx`:
- follow `DelegateProfileForm.tsx` exactly: client component, `Button`, `adminControlClasses`,
  `notice` state;
- two text inputs with `maxLength={60}`;
- calls `save({ delegateId, firstName, lastName })`;
- success text `სახელი განახლდა ✓`.

Render it in `page.tsx` inside the same `Card`, above `DelegateProfileForm`, only when
`delegate.status === "approved"`. Use the section rule label `სახელი და გვარი`.

- [ ] **Step 3: Run tests, ka-gate, ka:scan, commit.**
- [ ] **Step 4: Release.**
  - ADR line: the UI completes M2.
  - Gates, PR, then /qa. As a staging verifier, correct a test delegate's name. The public page shows
    it, and `/admin/audit` shows `დელეგატის სახელის შესწორება` with the old and new names. As that
    delegate, try to rename in `/me/profile` and see the locked message.
  - Owner sign-off, then merge and verify.
