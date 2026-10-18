import { getCopy, getLocale } from "@/lib/i18n/server";
import { languageAlternates } from "@/lib/i18n/metadata";
import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Caps } from "@/components/Caps";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import { UnityStat } from "@/components/UnityStat";
import { UnityTextLink } from "@/components/UnityTextLink";
import { delegateBioFallback, formatCountKa } from "@/lib/format";
import { rankDelegates } from "@/lib/ranking";
import { showRatings } from "@/lib/ratings-switch";
import { fetchDelegateBySlug, fetchPublicDelegates } from "@/lib/supabase/public";
import { generateMetadata as notFoundMetadata } from "./not-found";

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
  const t = await getCopy();
  const locale = await getLocale();
  const { slug } = await params;
  const delegate = await fetchDelegateBySlug(slug);
  if (!delegate) return notFoundMetadata();
  const name = `${delegate.first_name} ${delegate.last_name}`;
  return {
    title: `${name} — ${t("ქართული რესპუბლიკა")}`,
    description:
      delegate.bio ??
      (locale === "en"
        ? `Regional delegate for ${t(delegate.region_name_ka ?? "საქართველო")}. Represents local citizens on the platform, builds a team and is accountable to their supporters.`
        : delegateBioFallback(delegate.region_name_ka ?? "საქართველო")),
    ...languageAlternates(`/delegates/${slug}`, locale),
  };
}

// Reused byte-exact from components/Pill.tsx's STATUS_CONFIG.approved label -- spliced by
// scripts/task12-inject, never hand-retyped (georgian-quote-transcription-hazard note). The
// public profile kicker is region · status ONLY -- no approved-since date (declared
// micro-correction vs spec §4.3: PublicDelegate never carries an approval timestamp).
const APPROVED_STATUS = "დამტკიცებული";

export default async function DelegatePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getCopy();
  const locale = await getLocale();
  const { slug } = await params;
  const ranked = rankDelegates(await fetchPublicDelegates());
  const delegate = ranked.find((d) => d.slug === slug);
  if (!delegate) notFound();
  // Hidden by default (ADR-052): no member count, rank or way back to the ranking.
  const ratingsShown = showRatings();

  const name = `${delegate.first_name} ${delegate.last_name}`;
  const initials = `${delegate.first_name[0] ?? ""}${delegate.last_name[0] ?? ""}`;

  return (
    <main
      aria-labelledby="page-title"
      className="pb-16 pt-7 sm:pb-[clamp(88px,9vw,136px)] sm:pt-[clamp(56px,6vw,88px)]"
    >
      <div className="unity-container">
        <div className="mx-auto max-w-[960px]">
          {ratingsShown ? (
            <UnityTextLink href="/leaderboard" className="mb-5 inline-block text-[15px] sm:mb-7">
              {t("← უკან რეიტინგზე")}
            </UnityTextLink>
          ) : null}
          <div className="flex items-center gap-[18px] border-t border-ink pt-5 sm:gap-8 sm:pt-8">
            {delegate.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote host list not configured until real photos exist (Phase 4)
              <img
                src={delegate.photo_url}
                alt={name}
                className="size-[88px] flex-none rounded-full border border-rule bg-sandstone object-cover sm:size-[132px]"
              />
            ) : (
              <span
                lang="ka"
                className="grid size-[88px] flex-none place-items-center rounded-full border border-rule bg-sandstone font-serif text-[30px] font-semibold text-brand sm:size-[132px] sm:text-[44px]"
              >
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <p className="m-0 text-[12px] font-bold tracking-[.14em] text-brand sm:text-[13px]">
                <Caps>{`${t(delegate.region_name_ka ?? "")} · ${t(APPROVED_STATUS)}`}</Caps>
              </p>
              <h1
                id="page-title"
                lang="ka"
                className="m-0 mt-2.5 font-serif text-[32px] font-semibold leading-[1.12] sm:text-[56px]"
              >
                {name}
              </h1>
            </div>
          </div>
          <p
            lang={delegate.bio ? "ka" : undefined}
            className="m-0 mt-6 max-w-[40em] font-serif text-[18px] leading-[1.65] text-prose sm:mt-9 sm:text-[21px]"
          >
            {delegate.bio ??
              (locale === "en"
                ? `Regional delegate for ${t(delegate.region_name_ka ?? "საქართველო")}. Represents local citizens on the platform, builds a team and is accountable to their supporters.`
                : delegateBioFallback(delegate.region_name_ka ?? "საქართველო"))}
          </p>
          {delegate.bio ? <OriginalLanguageNote /> : null}
          {ratingsShown ? (
            <dl className="m-0 mt-8 grid gap-6 sm:mt-12 sm:grid-cols-2 sm:gap-10">
              <UnityStat
                large
                value={formatCountKa(delegate.members)}
                label={t("წევრი")}
                sub={t("ღია რეიტინგში")}
                red
              />
              <UnityStat
                large
                value={`#${delegate.rank}`}
                label={t("პოზიცია რეიტინგში")}
                sub={t("დამტკიცებულ დელეგატებს შორის")}
              />
            </dl>
          ) : null}
          <section
            aria-labelledby="support-title"
            className="relative mt-10 overflow-hidden bg-wine px-6 py-9 text-center text-sand [&_:focus-visible]:outline-limestone sm:mt-16 sm:p-14"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative ornament, fixed art */}
            <img
              src="/unity/knot-wine.svg"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 w-[330px] max-w-none -translate-x-1/2 -translate-y-1/2 sm:w-[560px]"
            />
            <div className="relative">
              <h2
                id="support-title"
                className="m-0 font-serif text-[26px] font-semibold leading-[1.25] text-limestone sm:text-[34px]"
              >
                {locale === "en" ? "Stand with " : "დაუდექი მხარში "}
                <span lang="ka">{delegate.first_name}</span>
                {locale === "ka" ? "-ს" : ""}
              </h2>
              <p className="mx-auto mb-0 mt-3.5 max-w-[32em] text-[15.5px] leading-[1.6] sm:text-[16.5px]">
                {t(
                  "დარეგისტრირდი და წევრობის გაფორმებისას აირჩიე ის შენს დელეგატად — მხარდაჭერა წევრობით ხდება.",
                )}
              </p>
              <UnityButtonLink
                href="/join"
                variant="cream"
                className="mt-6 w-full sm:mt-8 sm:w-auto"
              >
                {t("გახდი მისი მხარდამჭერი")}
              </UnityButtonLink>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
