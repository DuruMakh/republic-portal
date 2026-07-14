import type { Metadata } from "next";
import { DelegateDirectory } from "@/components/DelegateDirectory";
import { rankDelegates } from "@/lib/ranking";
import { fetchPublicDelegates, fetchRegions } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ჩვენი დელეგატები — ქართული რესპუბლიკა",
  description:
    "ყველა დელეგატი გადის იურიდიულ ვერიფიკაციას. ნახე, ვინ წარმოადგენს შენს რეგიონს.",
};

export default async function DelegatesPage() {
  const [delegates, regions] = await Promise.all([fetchPublicDelegates(), fetchRegions()]);
  const ranked = rankDelegates(delegates);
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-brand">
        საჯარო პორტალი
      </div>
      <h1 className="font-serif text-4xl font-bold text-ink">ჩვენი დელეგატები</h1>
      <p className="mt-3 max-w-2xl text-muted-fg">
        ყველა დელეგატი გადის იურიდიულ ვერიფიკაციას. მათი მხარდაჭერა ღიად და გამჭვირვალედ
        ლაგდება — ნახე, ვინ წარმოადგენს შენს რეგიონს.
      </p>
      <div className="mt-8">
        <DelegateDirectory delegates={ranked} regions={regions} />
      </div>
    </main>
  );
}
