import "server-only";
import { delegatePhotoPath } from "@/lib/account-deletion";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "delegate-photos";
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Far more than one person ever uploads: each photo change adds one object. */
const LIST_LIMIT = 1000;

type PhotoBucket = ReturnType<ReturnType<typeof createAdminClient>["storage"]["from"]>;

/** The person's own objects: uploads are named `<delegateId>-<timestamp>.<ext>`. */
async function objectsOf(bucket: PhotoBucket, prefix: string): Promise<string[]> {
  try {
    const { data, error } = await bucket.list("", { limit: LIST_LIMIT, search: prefix });
    if (error) {
      console.error("account deletion: photo listing failed", error.message);
      return [];
    }
    // the server's search is a case-insensitive pattern; keep exactly this person's names
    return (data ?? []).map((object) => object.name).filter((name) => name.startsWith(prefix));
  } catch (e) {
    console.error("account deletion: photo listing threw", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Removes an erased person's delegate photos from Storage (spec 2026-10-08 §5), for both the
 * member's own deletion and the admin's. It sweeps every object named after the person, so a
 * photo replaced earlier whose best-effort removal failed goes too, plus the path the database
 * returned if the listing missed it.
 *
 * The account is already gone when this runs, so it never throws: every failure is logged and
 * swallowed. This is the only service-role use in account deletion. Both inputs come from the
 * server, never from the client: the id is the session's own user or the zod-checked target the
 * database just erased, the URL is the database's. An id that is not a user id never becomes a
 * prefix (an empty one would match every delegate's photos).
 */
export async function removeDelegatePhotos(
  delegateId: string,
  photoUrl: string | null,
): Promise<void> {
  try {
    const bucket = createAdminClient().storage.from(BUCKET);
    const paths = new Set<string>();
    if (USER_ID.test(delegateId)) {
      for (const name of await objectsOf(bucket, `${delegateId}-`)) paths.add(name);
    } else {
      console.error("account deletion: photo sweep skipped, not a user id");
    }
    const recorded = delegatePhotoPath(photoUrl);
    if (recorded) paths.add(recorded);
    if (paths.size === 0) return;
    const { error } = await bucket.remove([...paths]);
    if (error) console.error("account deletion: photo removal failed", error.message);
  } catch (e) {
    console.error("account deletion: photo removal threw", e instanceof Error ? e.message : e);
  }
}
