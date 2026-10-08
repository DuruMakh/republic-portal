"use server";

import { revalidatePath } from "next/cache";
import { hasAnyRole } from "@/lib/admin";
import {
  delegateNameSchema,
  delegateProfileSchema,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
} from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { ImageSanitizeError, isUploadMime, sanitizeUploadedImage } from "@/lib/image-sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export type SaveProfileResult = { ok: true } | { ok: false; error: string };

/**
 * The one service-role path of this phase (spec §6): the storage upload. Guarded
 * app-side by the role precheck AND paired with the in-DB re-checking RPC — the
 * URL only lands on the delegate row if admin_update_delegate_profile accepts it.
 */
export async function updateDelegateProfileAction(formData: FormData): Promise<SaveProfileResult> {
  const parsed = delegateProfileSchema.safeParse({
    delegateId: formData.get("delegateId"),
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["verifier", "super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const supabase = await createServerSupabase();

  const { data: current, error: currentError } = await supabase
    .from("admin_delegate_queue")
    .select("photo_url, slug, status")
    .eq("id", parsed.data.delegateId)
    .single();
  if (currentError || !current) return { ok: false, error: mapFunnelError("invalid_target") };
  // the RPC only accepts approved delegates — fail BEFORE the upload so a
  // rejected target never parks a file in the public bucket
  if (current.status !== "approved") return { ok: false, error: mapFunnelError("invalid_target") };

  let photoUrl = current.photo_url;
  let newPath: string | null = null;
  let oldPath: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const ext = PHOTO_TYPES[photo.type];
    if (!ext || !isUploadMime(photo.type)) {
      return { ok: false, error: "დაშვებულია მხოლოდ JPEG, PNG ან WebP ფოტო." };
    }
    if (photo.size > PHOTO_MAX_BYTES) {
      return { ok: false, error: "ფოტო არ უნდა აღემატებოდეს 5 MB-ს." };
    }
    // Security audit M4: the bucket is public — store the photo without its hidden
    // location/time/device data, upright.
    let clean: Uint8Array;
    try {
      clean = await sanitizeUploadedImage(await photo.arrayBuffer(), photo.type);
    } catch (caught) {
      if (caught instanceof ImageSanitizeError) {
        return { ok: false, error: "ფოტოს წაკითხვა ვერ მოხერხდა — სცადე სხვა ფაილი." };
      }
      throw caught;
    }
    const admin = createAdminClient();
    // versioned filename: an updated photo must never serve stale from CDN caches
    newPath = `${parsed.data.delegateId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("delegate-photos")
      .upload(newPath, clean, { contentType: photo.type });
    if (uploadError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
    photoUrl = admin.storage.from("delegate-photos").getPublicUrl(newPath).data.publicUrl;
    const marker = "/delegate-photos/";
    const idx = current.photo_url?.indexOf(marker) ?? -1;
    oldPath = idx >= 0 ? (current.photo_url as string).slice(idx + marker.length) : null;
  }

  const { error: rpcError } = await supabase.rpc("admin_update_delegate_profile", {
    p_delegate_id: parsed.data.delegateId,
    p_bio: parsed.data.bio === "" ? null : parsed.data.bio,
    p_photo_url: photoUrl,
  });
  if (rpcError) {
    if (newPath) {
      // the row never got the URL — remove the just-uploaded object so a failed
      // save cannot park an unreferenced public file (best-effort)
      await createAdminClient().storage.from("delegate-photos").remove([newPath]);
    }
    return { ok: false, error: mapFunnelError(rpcError.message) };
  }

  if (oldPath) {
    // best-effort — a stale object is harmless; the row already points at the new one
    await createAdminClient().storage.from("delegate-photos").remove([oldPath]);
  }
  revalidatePath(`/admin/verify/${parsed.data.delegateId}`);
  if (current.slug) revalidatePath(`/delegates/${current.slug}`);
  return { ok: true };
}

/**
 * Security audit M2 (decision D3): an approved delegate's public name is corrected here only —
 * the database refuses the delegate's own edit (name_locked). Role precheck first, then the
 * re-checking, audited admin_update_delegate_name RPC. No service role.
 */
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
    .maybeSingle();
  revalidatePath(`/admin/verify/${parsed.data.delegateId}`);
  if (row?.slug) revalidatePath(`/delegates/${row.slug}`);
  return { ok: true };
}
