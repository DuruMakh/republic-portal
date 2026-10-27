import { languageAlternates, openGraphDefaults } from "@/lib/i18n/metadata";
import { getCopy, getLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import JoinForm from "./JoinForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  const locale = await getLocale();
  return {
    title: t("რეგისტრაცია — ქართული რესპუბლიკა"),
    description: t("გახდი მხარდამჭერი — მხოლოდ ძირითადი მონაცემები, დანარჩენს კაბინეტში ნახავ."),
    openGraph: { ...openGraphDefaults(locale), images: ["/og-default.png?v=civic-portal"] },
    ...languageAlternates("/join", locale),
  };
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinForm />
    </Suspense>
  );
}
