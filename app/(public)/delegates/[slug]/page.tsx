import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import { delegateBioFallback, formatCountKa } from "@/lib/format";
import { rankDelegates } from "@/lib/ranking";
import { fetchDelegateBySlug, fetchPublicDelegates } from "@/lib/supabase/public";
import Link from "next/link";

export const revalidate = 60;

export async function generateStaticParams() {
  const delegates = await fetchPublicDelegates();
  return delegates.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const delegate = await fetchDelegateBySlug(slug);
  if (!delegate) return { title: "დელეგატი ვერ მოიძებნა — ქართული რესპუბლიკა" };
  const name = `${delegate.first_name} ${delegate.last_name}`;
  return {
    title: `${name} — ქართული რესპუბლიკა`,
    description:
      delegate.bio ?? delegateBioFallback(delegate.region_name_ka ?? "საქართველო"),
  };
}

export default async function DelegatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ranked = rankDelegates(await fetchPublicDelegates());
  const delegate = ranked.find((d) => d.slug === slug);
  if (!delegate) notFound();

  const name = `${delegate.first_name} ${delegate.last_name}`;
  const initials = `${delegate.first_name[0] ?? ""}${delegate.last_name[0] ?? ""}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/leaderboard" className="text-sm font-semibold text-brand hover:underline">
          ← უკან რეიტინგზე
        </Link>
        <Pill status="approved" />
      </div>
      <Card>
        <div className="flex items-center gap-5">
          {delegate.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote host list not configured until real photos exist (Phase 4)
            <img
              src={delegate.photo_url}
              alt={name}
              className="h-20 w-20 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-brand/10 text-2xl font-extrabold text-brand">
              {initials}
            </span>
          )}
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-brand">
              {delegate.region_name_ka}
            </div>
            <h1 className="mt-1 font-serif text-3xl font-bold text-ink">{name}</h1>
          </div>
        </div>
        <p className="mt-5 text-muted-fg">
          {delegate.bio ?? delegateBioFallback(delegate.region_name_ka ?? "საქართველო")}
        </p>
      </Card>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="აქტიური მხარდამჭერი"
          value={formatCountKa(delegate.active_supporters)}
          accent="brand"
          sub="ღია რეიტინგში"
        />
        <StatCard
          label="პოზიცია რეიტინგში"
          value={`#${delegate.rank}`}
          sub="დამტკიცებულ დელეგატებს შორის"
        />
      </div>
      <div className="mt-6">
        <Card>
          <div className="text-center">
            <h2 className="text-lg font-bold text-ink">დაუდექი მხარში {delegate.first_name}-ს</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-fg">
              გახდი მისი აქტიური მხარდამჭერი — შეავსე პროფილი და ჩართე ყოველთვიური საწევრო
              რამდენიმე წუთში.
            </p>
            <div className="mt-5">
              <ButtonLink href="/join" size="lg">
                გახდი მისი მხარდამჭერი
              </ButtonLink>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
