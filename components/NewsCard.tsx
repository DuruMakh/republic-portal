import Link from "@/lib/i18n/navigation";
import { useCopy } from "@/lib/i18n/copy";
import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/Eyebrow";
import { UnityKicker } from "@/components/UnityKicker";

/** Article list card — shared by /news (public) and /me/news (cabinet feed). */
export function NewsCard({
  href,
  title,
  publishedAt,
  imageUrl,
  excerptText,
  pill,
  variant = "row",
}: {
  href: string;
  title: string;
  publishedAt: string;
  imageUrl: string | null;
  excerptText: string;
  pill?: ReactNode;
  /** row = cabinet brief (default) · lead = full-width opener · tile = grid card (news index + homepage) */
  variant?: "row" | "lead" | "tile";
}) {
  const t = useCopy();
  if (variant === "row") {
    // The cabinet feed row of the „ერთობა“ redesign: wide thumbnail, red kicker, serif title.
    return (
      <Link
        href={href}
        className="group grid items-start gap-4 border-b border-rule py-6 text-ink no-underline sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-7 md:grid-cols-[240px_minmax(0,1fr)] md:gap-9 md:py-[30px]"
      >
        {imageUrl ? (
          // Raw <img>, not next/image: this is Supabase Storage-hosted
          // and not in next.config's image host allowlist (delegate-photo
          // precedent — app/(admin)/admin/verify/[id]/DelegateProfileForm.tsx);
          // next/image would throw on an unconfigured remote host.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={title} className="aspect-[3/2] w-full object-cover" />
        ) : null}
        <div className={`flex min-w-0 flex-col ${imageUrl ? "" : "sm:col-span-2"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <UnityKicker>{t("სიახლეები")}</UnityKicker>
            {pill}
          </div>
          <h3
            lang="ka"
            className="mt-3.5 mb-0 font-serif text-[20px] font-bold leading-[1.35] transition-colors group-hover:text-brand md:text-[24px]"
          >
            {title}
          </h3>
          <p className="mt-1.5 mb-0 text-[13.5px] text-secondary">{publishedAt}</p>
          <p lang="ka" className="mt-2 mb-0 text-[16px] leading-[1.6] text-prose">
            {excerptText}
          </p>
          <OriginalLanguageNote />
        </div>
      </Link>
    );
  }
  const lead = variant === "lead";
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 border-b border-hairline pb-5 no-underline"
    >
      {imageUrl ? (
        // Same raw-<img> rationale as the row thumb (Supabase host not in the
        // next/image allowlist); hairline border, bounded by ratio.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={title}
          className={`${lead ? "aspect-[2/1]" : "aspect-[3/2]"} w-full border border-hairline object-cover`}
        />
      ) : null}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>{t("სიახლეები")}</Eyebrow>
          {pill}
        </div>
        <h3
          lang="ka"
          className={`mt-1 font-serif font-bold text-ink group-hover:text-brand ${
            lead ? "text-3xl" : "text-lg"
          }`}
        >
          {title}
        </h3>
        <p className="mt-1 text-[0.74rem] text-muted-fg">{publishedAt}</p>
        <p lang="ka" className={`mt-1 text-sm text-muted-fg ${lead ? "" : "line-clamp-2"}`}>
          {excerptText}
        </p>
        <OriginalLanguageNote />
      </div>
    </Link>
  );
}
