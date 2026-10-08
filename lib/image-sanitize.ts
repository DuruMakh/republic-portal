import "server-only";
import sharp from "sharp";

/**
 * Uploaded photos are published as-is from public buckets, so a phone photo would carry its
 * GPS position, time and device (security audit 2026-10-08, M4). Every upload is re-encoded:
 * the EXIF orientation is applied first (otherwise phone photos would turn sideways), then the
 * image is written without any metadata — sharp drops metadata unless asked to keep it.
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
