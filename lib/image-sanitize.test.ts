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
