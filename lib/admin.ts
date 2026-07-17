/**
 * Admin vocabulary and pure helpers (spec §3.1, §4.5). Client-side role checks
 * here are UX ONLY (tab filtering, control visibility) — the database re-checks
 * every read (self-gating views) and every mutation (RPC role checks). ADR-014.
 */
import type { MemberStatusRow } from "./supabase/types";

export const ADMIN_ROLE_VALUES = ["super_admin", "verifier", "finance", "editor"] as const;
export type AdminRole = (typeof ADMIN_ROLE_VALUES)[number];

export const ROLE_LABELS_KA: Record<AdminRole, string> = {
  super_admin: "სუპერ-ადმინი",
  verifier: "ვერიფიკატორი",
  finance: "ფინანსები",
  editor: "რედაქტორი",
};

export const ROLE_DUTIES_KA: Record<AdminRole, string> = {
  super_admin: "სრული წვდომა — ადმინების მართვა, აუდიტი, პარამეტრები",
  verifier: "დელეგატების ვერიფიკაცია, პროფილები, ტრანსფერი",
  finance: "გადახდების აღრიცხვა და ექსპორტი",
  editor: "სიახლეები და ღონისძიებები (ჩაირთვება მე-5 ფაზაში)",
};

/** Overview/member-list gate: every admin role except editor (spec §4.2 „staff“). */
export function isStaff(roles: readonly AdminRole[]): boolean {
  return roles.some((r) => r === "super_admin" || r === "verifier" || r === "finance");
}

export interface AdminTab {
  href: string;
  label: string;
}

const TAB_MATRIX: { href: string; label: string; roles: readonly AdminRole[] }[] = [
  { href: "/admin", label: "მიმოხილვა", roles: ["super_admin", "verifier", "finance"] },
  { href: "/admin/members", label: "წევრები", roles: ["super_admin", "verifier", "finance"] },
  { href: "/admin/verify", label: "ვერიფიკაცია", roles: ["super_admin", "verifier"] },
  { href: "/admin/finances", label: "ფინანსები", roles: ["super_admin", "finance"] },
  { href: "/admin/transfer", label: "ტრანსფერი", roles: ["super_admin", "verifier"] },
  { href: "/admin/admins", label: "ადმინები", roles: ["super_admin"] },
  { href: "/admin/audit", label: "აუდიტი", roles: ["super_admin"] },
  { href: "/admin/settings", label: "პარამეტრები", roles: ["super_admin"] },
];

export function adminTabs(roles: readonly AdminRole[]): AdminTab[] {
  return TAB_MATRIX.filter((t) => t.roles.some((r) => roles.includes(r))).map(
    ({ href, label }) => ({ href, label }),
  );
}

/** Member list / export status vocabulary — matches Pill's status colors. */
export const MEMBER_STATUS_LABELS_KA: Record<MemberStatusRow, string> = {
  draft: "მონახაზი",
  profile_completed: "რეგისტრირებული",
  active_member: "აქტიური",
};

/** The fixed audit taxonomy (spec §4.5) → viewer labels. */
export const AUDIT_ACTION_LABELS_KA: Record<string, string> = {
  "delegate.approve": "დელეგატის დამტკიცება",
  "delegate.reject": "დელეგატის უარყოფა",
  "delegate.update_profile": "დელეგატის პროფილის რედაქტირება",
  "delegate.reveal_personal_id": "განმცხადებლის პირადი ნომრის ნახვა",
  "member.reveal_personal_id": "წევრის პირადი ნომრის ნახვა",
  "member.export": "წევრების ექსპორტი",
  "member.reassign": "წევრის გადანაწილება",
  "payment.record": "გადახდის აღრიცხვა",
  "payment.bulk_record": "გადახდების ჯგუფური აღრიცხვა",
  "payment.void": "გადახდის გაუქმება",
  "admin.grant_role": "როლის მინიჭება",
  "admin.revoke_role": "როლის მოხსნა",
  "settings.update": "პარამეტრის შეცვლა",
  "system.active_sweep": "სტატუსების ავტომატური განახლება",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS_KA[action] ?? action;
}

export const TARGET_TYPE_LABELS_KA: Record<string, string> = {
  delegate: "დელეგატი",
  profile: "წევრი",
  payment: "გადახდა",
  admin_role: "ადმინის როლი",
  setting: "პარამეტრი",
  system: "სისტემა",
};

/** Proportion-bar width (overview regions, finance tiers) — clamped, zero-safe. */
export function barPct(count: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((count / max) * 100);
}

/** Page-level gate helper (UX; the views/RPCs re-check in-DB). */
export function hasAnyRole(roles: readonly AdminRole[], allowed: readonly AdminRole[]): boolean {
  return roles.some((r) => allowed.includes(r));
}
