import { localePath } from "@/lib/i18n/routing";

import { getCopy, getLocale } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { CabinetShell } from "@/components/CabinetShell";
import { cabinetNavItems, deriveDestination, isApprovedDelegate } from "@/lib/cabinet";
import { filterEventLinks, showEvents } from "@/lib/events-switch";
import { filterBillingLinks, showMembershipDues } from "@/lib/membership-dues";
import { mobileTabs } from "@/lib/mobile-nav";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";

// Spliced (never hand-retyped) BYTE-EXACT from the SHIPPED app/(delegate)/delegate/page.tsx's
// own on-page Eyebrow tag (line 68 pre-Task-17, commit 98900a3) — extracted programmatically
// (regex + codepoint verification, all U+10D0-U+10FF Mkhedruli Georgian) rather than typed —
// same register-level wording, now the Masthead's `tag` (Task 15/17/18 pattern). This page's
// own on-page Eyebrow with the same text is retired below (redundant now that the masthead
// carries it), matching the member/(admin) cabinet convention (Task 15).
const DELEGATE_TAG = "დელეგატის კაბინეტი";

/**
 * Delegate gate (R2): APPROVED delegates only. Pending/rejected requesters and
 * everyone else land on their derived destination — which, since R2, never
 * points a non-approved delegacy back here, so no redirect loop is possible;
 * the delegates-require-completed-member trigger removes the half-formed
 * hybrid the R1 guard defended against.
 *
 * „ერთობა“ chrome (owner redesign): CabinetShell's wine band carries the DELEGATE_TAG
 * register tag and the CabinetNav tabs (incl. sign-out); the design gives this band no
 * back-to-public link.
 */
export default async function DelegateLayout({ children }: { children: React.ReactNode }) {
  const t = await getCopy();
  const locale = await getLocale();
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(localePath("/login", locale));
  const state = await getCabinetState();
  if (!state.exists || !isApprovedDelegate(state)) {
    redirect(localePath(deriveDestination(state), locale));
  }
  // No payments tab while dues are hidden (ADR-037), no events tab while events are (ADR-042).
  const items = filterEventLinks(
    filterBillingLinks(cabinetNavItems("delegate", state.admin), showMembershipDues()),
    showEvents(),
  );
  const { tabs, more } = mobileTabs(items, "delegate");
  return (
    <CabinetShell tag={t(DELEGATE_TAG)} items={items} tabs={tabs} more={more}>
      {children}
    </CabinetShell>
  );
}
