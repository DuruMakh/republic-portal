"use server";

import { revalidatePath } from "next/cache";
import { approveDelegateSchema, rejectDelegateSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { resolvePublishSlug } from "@/lib/publish-slug";
import { createServerSupabase } from "@/lib/supabase/server";

export type ApproveResult = { ok: true; slug: string } | { ok: false; error: string };
export type VerifyActionResult = { ok: true } | { ok: false; error: string };
export type RevealResult = { ok: true; personalId: string | null } | { ok: false; error: string };

/**
 * Approve (spec §3.4): the server computes the slug via resolvePublishSlug over
 * the currently-taken set and retries on a concurrent duplicate (23505) — the RPC
 * stamps status/verified_at/verified_by and writes the audit row atomically.
 */
export async function approveDelegateAction(delegateId: unknown): Promise<ApproveResult> {
  const parsed = approveDelegateSchema.safeParse({ delegateId });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();

  const { data: applicant, error: applicantError } = await supabase
    .from("admin_delegate_queue")
    .select("first_name, last_name")
    .eq("id", parsed.data.delegateId)
    .single();
  if (applicantError || !applicant) {
    return { ok: false, error: mapFunnelError(applicantError?.message ?? "invalid_target") };
  }

  const fullName = `${applicant.first_name} ${applicant.last_name}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    // this action never reads the applicant's own slug (only first_name/last_name
    // is selected above) — existingSlug is always null, so every attempt mints
    // fresh against the currently-taken set, same as before this refactor. The
    // RPC's own coalesce(v_delegate.slug, p_slug) is what actually makes
    // re-approval keep an original slug (spec §3.4) — server-side, unaffected.
    const slug = await resolvePublishSlug({
      title: fullName,
      fallback: "delegati",
      existingSlug: null,
      fetchTaken: async (base) => {
        // scope the taken-set fetch to this name's base: an unscoped read silently
        // truncates at PostgREST's 1000-row cap once enough delegates hold slugs,
        // and a missed collision would burn all three retry attempts on the same slug
        const { data: taken, error: takenError } = await supabase
          .from("admin_delegate_queue")
          .select("slug")
          .like("slug", `${base}%`);
        if (takenError) return null;
        return (taken ?? []).map((t) => t.slug).filter((s): s is string => !!s);
      },
    });
    if (slug === null) return { ok: false, error: GENERIC_FUNNEL_ERROR };

    const { data, error } = await supabase.rpc("admin_approve_delegate", {
      p_delegate_id: parsed.data.delegateId,
      p_slug: slug,
    });
    if (!error) {
      const approvedSlug = (data as { slug: string }).slug;
      revalidatePath("/admin/verify");
      revalidatePath(`/delegates/${approvedSlug}`);
      return { ok: true, slug: approvedSlug };
    }
    // 23505 = a concurrent approval took this slug — refetch and retry
    if (error.code !== "23505") return { ok: false, error: mapFunnelError(error.message) };
  }
  return { ok: false, error: mapFunnelError("invalid_slug") };
}

export async function rejectDelegateAction(
  delegateId: unknown,
  note: unknown,
): Promise<VerifyActionResult> {
  // server actions are POST-reachable; non-string payloads must degrade to the Georgian generic, not zod's English default
  if (
    typeof delegateId !== "string" ||
    (note !== undefined && note !== null && typeof note !== "string")
  ) {
    return { ok: false, error: GENERIC_FUNNEL_ERROR };
  }
  const parsed = rejectDelegateSchema.safeParse({ delegateId, note: note ?? "" });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_reject_delegate", {
    p_delegate_id: parsed.data.delegateId,
    p_note: parsed.data.note === "" ? null : parsed.data.note,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/verify");
  return { ok: true };
}

/** verifier/super_admin — applicant scope only; audited by the RPC. */
export async function revealApplicantIdAction(delegateId: unknown): Promise<RevealResult> {
  const parsed = approveDelegateSchema.safeParse({ delegateId });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_reveal_applicant_personal_id", {
    p_delegate_id: parsed.data.delegateId,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  return { ok: true, personalId: data ?? null };
}
