import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/CabinetNav";
import { Masthead } from "@/components/Masthead";
import { PageSheet } from "@/components/PageSheet";
import { cabinetNavItems, deriveDestination, isApprovedDelegate } from "@/lib/cabinet";
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
 * Kronika chrome (spec §5.1, Task 15 pattern): PageSheet + a compact Masthead
 * carrying the DELEGATE_TAG register tag (logo + tag only — no public nav
 * items and no session slot; every actual section link, incl. sign-out,
 * lives in CabinetNav directly below, unchanged).
 */
export default async function DelegateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const state = await getCabinetState();
  if (!state.exists || !isApprovedDelegate(state)) {
    redirect(deriveDestination(state));
  }
  return (
    <PageSheet>
      <Masthead navItems={[]} tag={DELEGATE_TAG} cta={null} />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <CabinetNav items={cabinetNavItems("delegate", state.admin)} />
        {children}
      </div>
    </PageSheet>
  );
}
