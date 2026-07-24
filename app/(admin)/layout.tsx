import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { Masthead } from "@/components/Masthead";
import { PageSheet } from "@/components/PageSheet";
import { adminTabs } from "@/lib/admin";
import { deriveDestination } from "@/lib/cabinet";
import { createServerSupabase, getAdminRoles, getCabinetState } from "@/lib/supabase/server";

// Spliced (never hand-retyped) BYTE-EXACT from the SHIPPED components/AdminNav.tsx's own
// pre-Task-18 Eyebrow tag (git history) — same register-level wording, now the Masthead's
// `tag` (Task 15/17/18 pattern). AdminNav's own on-page Eyebrow with this text is retired
// below (redundant now that the masthead carries it), matching the member/delegate
// cabinet convention (Tasks 15/17).
const ADMIN_TAG = "ადმინისტრირება";

/**
 * Admin gate (spec §3.1): session + ≥1 admin role, server-side on every request —
 * safe because /admin has been NetworkOnly in the service worker since Phase 0.
 * Role-specific page gates live in each page; the DB re-checks everything anyway.
 *
 * Kronika chrome (spec §5.1, Task 15/17 pattern): PageSheet + a compact Masthead
 * carrying the ADMIN_TAG register tag (logo + tag only — no public nav items and
 * no session slot; every actual section link, incl. sign-out, lives in AdminNav
 * directly below, unchanged). The verify-queue nav badge (D10) is wired here: a
 * single admin_overview read for pending_delegates ONLY (the view self-gates by
 * role via has_any_admin_role — an editor-only admin simply gets no row back),
 * mapped onto the ALREADY-COMPUTED adminTabs(roles) result — adminTabs() itself
 * is not touched.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const roles = await getAdminRoles();
  if (roles.length === 0) redirect(deriveDestination(await getCabinetState()));
  // Best-effort, like the member layout's open-polls badge read: a transient
  // failure (or an editor-only admin, whom the self-gating view excludes
  // entirely — zero rows, not an error) must never take down the whole admin
  // section over a nav badge, so maybeSingle() + optional chaining just drop
  // the badge instead of throwing.
  const { data: overview } = await supabase
    .from("admin_overview")
    .select("pending_delegates")
    .maybeSingle();
  const pending = overview?.pending_delegates;
  const tabs = adminTabs(roles).map((t) =>
    t.href === "/admin/verify" ? { ...t, count: pending || undefined } : t,
  );
  return (
    <PageSheet>
      <Masthead navItems={[]} tag={ADMIN_TAG} cta={null} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <AdminNav tabs={tabs} />
        {children}
      </div>
    </PageSheet>
  );
}
