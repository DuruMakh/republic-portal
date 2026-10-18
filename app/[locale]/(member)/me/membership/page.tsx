import { localePath } from "@/lib/i18n/routing";

import { getCopy, getLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isApprovedDelegate } from "@/lib/cabinet";
import { getCabinetState } from "@/lib/supabase/server";
import { MembershipWizard } from "./MembershipWizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return { title: t("წევრობის გაფორმება — ქართული რესპუბლიკა") };
}

export default async function MembershipPage() {
  const locale = await getLocale();
  const state = await getCabinetState(); // (member) layout guarantees exists only
  if (!state.exists) redirect(localePath("/join", locale)); // soft-nav defense: narrow before the wizard reads its fields
  // approved-only: pending/rejected requesters keep their member surfaces (R2 §3.1)
  if (isApprovedDelegate(state)) redirect(localePath("/delegate", locale));
  if (state.completed) redirect(localePath("/me/membership/done", locale)); // already a member — nothing left to do here

  return <MembershipWizard initialState={state} />;
}
