"use server";

import { revalidatePath } from "next/cache";
import { hasAnyRole } from "@/lib/admin";
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/admin-schemas";
import { contentIdSchema, newsFormSchema } from "@/lib/content-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { resolvePublishSlug } from "@/lib/publish-slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { takenSlugsFetcher } from "@/lib/supabase/slugs";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export type SaveNewsResult = { ok: true; id: string } | { ok: false; error: string };
export type NewsActionResult = { ok: true } | { ok: false; error: string };

function revalidateNews(slug: string | null) {
  revalidatePath("/news");
  revalidatePath("/me/news");
  if (slug) revalidatePath(`/news/${slug}`);
}

export async function saveNewsAction(input: unknown): Promise<SaveNewsResult> {
  const parsed = newsFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_save_news", {
    p_id: parsed.data.id ?? null,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_visibility: parsed.data.visibility,
  });
  if (error || !data) return { ok: false, error: mapFunnelError(error?.message) };
  // an edit to an already-published article must reach the live pages
  const { data: row } = await supabase.from("admin_news").select("slug").eq("id", data).single();
  revalidateNews(row?.slug ?? null);
  return { ok: true, id: data };
}

/**
 * Publish mints the permanent slug (delegate-approval pattern: server computes
 * from the taken set scoped to this title's base, RPC enforces regex+uniqueness,
 * 23505 → refetch and retry).
 */
export async function publishNewsAction(id: unknown): Promise<NewsActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();

  const { data: article, error: articleError } = await supabase
    .from("admin_news")
    .select("title, slug")
    .eq("id", parsed.data.id)
    .single();
  if (articleError || !article) {
    return { ok: false, error: mapFunnelError(articleError?.message ?? "invalid_target") };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = await resolvePublishSlug({
      title: article.title,
      fallback: "article",
      existingSlug: article.slug,
      fetchTaken: takenSlugsFetcher(supabase, "admin_news"),
    });
    if (slug === null) return { ok: false, error: GENERIC_FUNNEL_ERROR };
    const { data, error } = await supabase.rpc("admin_publish_news", {
      p_id: parsed.data.id,
      p_slug: slug,
    });
    if (!error) {
      revalidateNews((data as { slug: string }).slug);
      return { ok: true };
    }
    if (error.code !== "23505") return { ok: false, error: mapFunnelError(error.message) };
  }
  return { ok: false, error: mapFunnelError("invalid_slug") };
}

export async function unpublishNewsAction(id: unknown): Promise<NewsActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("admin_news")
    .select("slug")
    .eq("id", parsed.data.id)
    .single();
  const { error } = await supabase.rpc("admin_unpublish_news", { p_id: parsed.data.id });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidateNews(row?.slug ?? null);
  return { ok: true };
}

export async function deleteNewsAction(id: unknown): Promise<NewsActionResult> {
  const parsed = contentIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_delete_news", { p_id: parsed.data.id });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/content/news");
  return { ok: true };
}

/**
 * The ONE service-role path of this phase (spec §6): cover upload to the public
 * news-images bucket — app-side editor precheck + the re-checking audited RPC,
 * byte-for-byte the Phase 4 delegate-photo envelope.
 */
export async function setNewsCoverAction(formData: FormData): Promise<NewsActionResult> {
  const parsed = contentIdSchema.safeParse({ id: formData.get("newsId") });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["editor", "super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const supabase = await createServerSupabase();

  const { data: current, error: currentError } = await supabase
    .from("admin_news")
    .select("image_url, slug")
    .eq("id", parsed.data.id)
    .single();
  if (currentError || !current) return { ok: false, error: mapFunnelError("invalid_target") };

  const cover = formData.get("cover");
  if (!(cover instanceof File) || cover.size === 0) {
    return { ok: false, error: mapFunnelError("invalid_image") };
  }
  const ext = PHOTO_TYPES[cover.type];
  if (!ext) return { ok: false, error: "დაშვებულია მხოლოდ JPEG, PNG ან WebP სურათი." };
  if (cover.size > PHOTO_MAX_BYTES) {
    return { ok: false, error: "სურათი არ უნდა აღემატებოდეს 5 MB-ს." };
  }

  const admin = createAdminClient();
  // versioned filename — an updated cover must never serve stale from CDN caches
  const newPath = `${parsed.data.id}-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("news-images")
    .upload(newPath, await cover.arrayBuffer(), { contentType: cover.type });
  if (uploadError) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const imageUrl = admin.storage.from("news-images").getPublicUrl(newPath).data.publicUrl;

  const { error: rpcError } = await supabase.rpc("admin_set_news_image", {
    p_id: parsed.data.id,
    p_image_url: imageUrl,
  });
  if (rpcError) {
    // the row never got the URL — remove the just-uploaded object (best-effort)
    await admin.storage.from("news-images").remove([newPath]);
    return { ok: false, error: mapFunnelError(rpcError.message) };
  }

  const marker = "/news-images/";
  const idx = current.image_url?.indexOf(marker) ?? -1;
  const oldPath = idx >= 0 ? (current.image_url as string).slice(idx + marker.length) : null;
  if (oldPath) {
    // best-effort — a stale object is harmless; the row already points at the new one
    await admin.storage.from("news-images").remove([oldPath]);
  }
  revalidateNews(current.slug);
  revalidatePath(`/admin/content/news/${parsed.data.id}`);
  return { ok: true };
}
