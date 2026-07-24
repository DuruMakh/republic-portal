import Link from "next/link";
import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/CabinetNav";
import { Masthead } from "@/components/Masthead";
import { PageSheet } from "@/components/PageSheet";
import { cabinetNavItems, cabinetRole } from "@/lib/cabinet";
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
 * Kronika chrome (spec §5.1): PageSheet + a compact Masthead carrying the
 * "პირადი კაბინეტი" register tag (logo + tag only — no public nav items and
 * no session slot; every actual section link, incl. sign-out, lives in
 * CabinetNav directly below, unchanged). The open-polls nav badge (D10) is
 * wired here: a single head-count read against member_polls, mapped onto the
 * ALREADY-COMPUTED cabinetNavItems() result — cabinetNavItems() itself is not
 * touched, and the map is a no-op for the registered fallback nav (it has no
 * /me/polls item to match).
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [state, { count: openPollsCount }] = await Promise.all([
    getCabinetState(),
    // Poll openness is just the row's status column (spec: `/me/polls` itself
    // checks `poll.status === "open"` with no separate close-logic helper) —
    // a plain head-count, no row bodies. Best-effort: a transient failure here
    // must never take down the whole cabinet over a nav badge, so the count
    // (and therefore the badge) is silently dropped rather than thrown.
    supabase.from("member_polls").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  if (!state.exists) redirect("/join");
  const items = cabinetNavItems(cabinetRole(state), state.admin).map((item) =>
    item.href === "/me/polls" ? { ...item, count: openPollsCount || undefined } : item,
  );
  return (
    <PageSheet>
      <Masthead
        navItems={[]}
        tag={CABINET_TAG}
        cta={
          <Link href="/" className="text-muted-fg no-underline hover:text-brand">
            {BACK_TO_PUBLIC}
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <CabinetNav items={items} />
        {children}
      </div>
    </PageSheet>
  );
}
