import { localePath } from "@/lib/i18n/routing";

import { getCopy, getLocale } from "@/lib/i18n/server";
import Link from "@/lib/i18n/navigation";
import { redirect } from "next/navigation";
import { CabinetShell } from "@/components/CabinetShell";
import { cabinetNavItems, cabinetRole } from "@/lib/cabinet";
import { filterEventLinks, showEvents } from "@/lib/events-switch";
import { filterBillingLinks, showMembershipDues } from "@/lib/membership-dues";
import { mobileTabs } from "@/lib/mobile-nav";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";

// Spliced (never hand-retyped) from prototype/kronika-d3/kronika-d3-template.html's
// member-cabinet masthead row (S4); verified against the Georgian (Mkhedruli,
// U+10A0-U+10FF) Unicode block before commit — see the georgian-quote-
// transcription-hazard note. Same string already shipped as this section's own
// on-page Eyebrow (app/(member)/me/profile/page.tsx et al.); this is its first
// use as the Masthead register tag (spec §5.1, Appendix B: cabinetTag).
const CABINET_TAG = "პირადი კაბინეტი";
// Spliced (never hand-retyped) from the same mock header row (S4) — the
// muted "back to the public site" link next to the cabinet nav. New usage
// (no prior shipped occurrence); verified via codepoint escapes before commit.
const BACK_TO_PUBLIC = "← საჯარო";

/**
 * Registration gate (spec §3.2/§4.2): any registered visitor enters /me/*;
 * only a missing profile bounces to /join. Nav is standing-aware
 * (cabinetRole: registered/member/delegate) — member-only pages gate
 * themselves on state.completed. Runs server-side on every request — safe
 * because the service worker has never cached /me (NetworkOnly, app/sw.ts).
 *
 * „ერთობა“ chrome (owner redesign, პირადი კაბინეტი): CabinetShell's wine band carries the
 * "პირადი კაბინეტი" register tag, the back-to-public link and the CabinetNav tabs (incl.
 * sign-out). The open-polls nav badge (D10) is
 * wired here: a single head-count read against member_polls, mapped onto the
 * ALREADY-COMPUTED cabinetNavItems() result — cabinetNavItems() itself is not
 * touched, and the map is a no-op for the registered fallback nav (it has no
 * /me/polls item to match).
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const t = await getCopy();
  const locale = await getLocale();
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(localePath("/login", locale));
  const [state, { count: openPollsCount }] = await Promise.all([
    getCabinetState(),
    // Poll openness is just the row's status column (spec: `/me/polls` itself
    // checks `poll.status === "open"` with no separate close-logic helper) —
    // a plain head-count, no row bodies. Best-effort: a transient failure here
    // must never take down the whole cabinet over a nav badge, so the count
    // (and therefore the badge) is silently dropped rather than thrown.
    supabase.from("member_polls").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  if (!state.exists) redirect(localePath("/join", locale));
  const role = cabinetRole(state);
  // No payments tab while dues are hidden (ADR-037), no events tab while events are (ADR-042).
  const items = filterEventLinks(
    filterBillingLinks(cabinetNavItems(role, state.admin), showMembershipDues()),
    showEvents(),
  ).map((item) =>
    item.href === "/me/polls" ? { ...item, count: openPollsCount || undefined } : item,
  );
  const { tabs, more } = mobileTabs(items, role);
  return (
    <CabinetShell
      tag={t(CABINET_TAG)}
      items={items}
      tabs={tabs}
      more={more}
      backLink={
        <Link
          href="/"
          className="text-[15px] font-semibold text-limestone underline decoration-sand/60 decoration-1 underline-offset-[6px] hover:text-white hover:decoration-white"
        >
          {t(BACK_TO_PUBLIC)}
        </Link>
      }
    >
      {children}
    </CabinetShell>
  );
}
