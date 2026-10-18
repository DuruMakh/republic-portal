import { useCopy } from "@/lib/i18n/copy";
import Link from "@/lib/i18n/navigation";
import { UnityKicker } from "@/components/UnityKicker";
import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";

/** The design's hatched sandstone block, standing in for a missing photo. */
const PLACEHOLDER =
  "bg-sandstone bg-[repeating-linear-gradient(135deg,rgba(26,22,17,.05)_0_1px,transparent_1px_11px)]";

/**
 * A story on the „ერთობა“ news index. A tile is photo, date, serif title and a two-line excerpt;
 * the `lead` story puts a wide photo beside a bigger title on wide screens (a plain tile on
 * phones). The whole card is the link and lightens to chalk on hover.
 */
export function UnityNewsTile({
  href,
  title,
  publishedAt,
  imageUrl,
  excerptText,
  lead = false,
}: {
  href: string;
  title: string;
  publishedAt: string;
  imageUrl: string | null;
  excerptText: string;
  lead?: boolean;
}) {
  const t = useCopy();
  const photo = imageUrl ? (
    // Raw <img>, not next/image: the photo is hosted in Supabase Storage, which is not a
    // configured next/image host (same as NewsCard). The title names the link, so alt is empty.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      loading={lead ? undefined : "lazy"}
      className={`block aspect-[3/2] w-full bg-sandstone object-cover ${lead ? "sm:aspect-[2/1]" : ""}`}
    />
  ) : (
    <span
      data-news-placeholder
      aria-hidden="true"
      className={`block aspect-[3/2] ${PLACEHOLDER} ${lead ? "sm:aspect-[2/1]" : ""}`}
    />
  );

  return (
    <Link
      href={href}
      className={`group/tile flex flex-col border-b border-rule pb-6 text-ink no-underline transition-colors hover:bg-chalk hover:text-ink sm:pb-2 ${
        lead
          ? "sm:grid sm:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] sm:items-center sm:gap-[clamp(28px,3.5vw,56px)] sm:py-8"
          : "sm:border-b-0"
      }`}
    >
      {photo}
      <div className="flex min-w-0 flex-col">
        {lead ? (
          <span aria-hidden="true" className="hidden sm:block">
            <UnityKicker>{t("სიახლეები")}</UnityKicker>
          </span>
        ) : null}
        <h3
          lang="ka"
          className={`m-0 font-serif font-semibold transition-colors group-hover/tile:text-brand ${
            lead
              ? "order-2 mt-1.5 text-[21px] leading-[1.35] sm:order-none sm:mt-[18px] sm:text-[clamp(28px,2.6vw,38px)] sm:leading-[1.25]"
              : "order-2 mt-1.5 text-[21px] leading-[1.35] sm:text-[22px]"
          }`}
        >
          {title}
        </h3>
        <span
          className={`order-1 mt-[18px] text-[14px] text-secondary ${lead ? "sm:order-none sm:mt-3.5 sm:text-[15px]" : ""}`}
        >
          {publishedAt}
        </span>
        <span
          lang="ka"
          className={`order-3 mt-2 text-[15.5px] leading-[1.6] text-secondary ${
            lead
              ? "line-clamp-2 sm:order-none sm:mt-4 sm:line-clamp-none sm:font-serif sm:text-[18px] sm:leading-[1.65] sm:text-prose"
              : "line-clamp-2"
          }`}
        >
          {excerptText}
        </span>
        <OriginalLanguageNote className="order-4 mt-2 block text-[13px] leading-[1.5] text-secondary" />
      </div>
    </Link>
  );
}
