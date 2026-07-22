import { redirect } from "next/navigation";

/** The delegate terms moved into the member cabinet with the R2 delegacy flow. */
export default function TermsPage() {
  redirect("/me/delegacy");
}
