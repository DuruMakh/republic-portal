import { getCopy } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import JoinForm from "./JoinForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return {
    title: t("რეგისტრაცია — ქართული რესპუბლიკა"),
    description: t("გახდი მხარდამჭერი — მხოლოდ ძირითადი მონაცემები, დანარჩენს კაბინეტში ნახავ."),
    openGraph: { images: ["/og-default.png?v=civic-portal"] },
  };
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinForm />
    </Suspense>
  );
}
