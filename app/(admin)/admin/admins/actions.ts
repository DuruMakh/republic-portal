"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasAnyRole } from "@/lib/admin";
import { grantRoleSchema, revokeRoleSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export type AdminRoleActionResult = { ok: true } | { ok: false; error: string };
export type AdminCandidateResult =
  | { ok: true; candidate: { id: string; name: string; phone: string | null } | null }
  | { ok: false; error: string };

const phoneInput = z
  .string()
  .trim()
  .transform((v) => v.replaceAll(/[\s-]/g, ""))
  .refine((v) => /^(\+?995)?5\d{8}$/.test(v), "ტელეფონის ფორმატი არასწორია.");

function normalizePhone(v: string): string {
  const digits = v.replace(/^\+/, "");
  return digits.startsWith("995") ? `+${digits}` : `+995${digits}`;
}

export async function findAdminCandidateAction(phone: unknown): Promise<AdminCandidateResult> {
  const parsed = phoneInput.safeParse(phone);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR };
  }
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) {
    return { ok: false, error: mapFunnelError("missing_role") };
  }
  const canonical = normalizePhone(parsed.data);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("admin_members")
    .select("id, first_name, last_name, phone, registration_completed_at, status")
    .in("phone", [canonical, canonical.slice(1)])
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  if (!data) return { ok: true, candidate: null };
  if (data.registration_completed_at === null && data.status !== "active_member") {
    return { ok: false, error: mapFunnelError("not_completed") };
  }
  return {
    ok: true,
    candidate: { id: data.id, name: `${data.first_name} ${data.last_name}`, phone: data.phone },
  };
}

export async function grantRoleAction(
  userId: unknown,
  role: unknown,
): Promise<AdminRoleActionResult> {
  const parsed = grantRoleSchema.safeParse({ userId, role });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_grant_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/admins");
  return { ok: true };
}

export async function revokeRoleAction(
  userId: unknown,
  role: unknown,
): Promise<AdminRoleActionResult> {
  const parsed = revokeRoleSchema.safeParse({ userId, role });
  if (!parsed.success) return { ok: false, error: GENERIC_FUNNEL_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_revoke_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return { ok: false, error: mapFunnelError(error.message) };
  revalidatePath("/admin/admins");
  return { ok: true };
}
