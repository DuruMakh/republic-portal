import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCabinetState } from "@/lib/supabase/server";
import { MembershipWizard } from "./MembershipWizard";

export const metadata: Metadata = { title: "წევრობის გაფორმება — ქართული რესპუბლიკა" };

export default async function MembershipPage() {
  const state = await getCabinetState(); // (member) layout guarantees exists only
  if (state.role === "delegate") redirect("/delegate"); // members-only journey (spec §3.1)
  if (state.completed) redirect("/me/membership/done"); // already a member — nothing left to do here

  return <MembershipWizard initialState={state} />;
}
