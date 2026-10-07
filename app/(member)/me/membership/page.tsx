import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isApprovedDelegate } from "@/lib/cabinet";
import { getCabinetState } from "@/lib/supabase/server";
import { MembershipWizard } from "./MembershipWizard";

export const metadata: Metadata = { title: "წევრობის გაფორმება — ქართული რესპუბლიკა" };

export default async function MembershipPage() {
  const state = await getCabinetState(); // (member) layout guarantees exists only
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before the wizard reads its fields
  // approved-only: pending/rejected requesters keep their member surfaces (R2 §3.1)
  if (isApprovedDelegate(state)) redirect("/delegate");
  if (state.completed) redirect("/me/membership/done"); // already a member — nothing left to do here

  return <MembershipWizard initialState={state} />;
}
