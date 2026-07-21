import { redirect } from "next/navigation";
import { deriveDestination } from "@/lib/cabinet";
import { getCabinetState } from "@/lib/supabase/server";

/** Single cabinet entry point (header „კაბინეტი“): members → profile, delegates → panel. */
export default async function CabinetEntryPage() {
  redirect(deriveDestination(await getCabinetState()));
}
