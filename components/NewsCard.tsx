import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/Eyebrow";

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
  /** row = cabinet/homepage brief (default) · lead = full-width opener · tile = grid card */
  variant?: "row" | "lead" | "tile";
}) {
  if (variant === "row") {
    return (
      <Link href={href} className="group flex gap-4 border-b border-hairline pb-4 no-underline">
        {imageUrl ? (
          // Raw <img>, not PhotoFigure/next-Image: this is Supabase Storage-hosted
          // and not in next.config's image host allowlist (delegate-photo
          // precedent — app/(admin)/admin/verify/[id]/DelegateProfileForm.tsx);
          // next/image would throw on an unconfigured remote host. The border
          // mirrors PhotoFigure's own dress without routing through next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="h-20 w-28 shrink-0 border border-hairline object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow>სიახლეები</Eyebrow>
            {pill}
          </div>
          <h3 className="mt-1 font-serif text-lg font-bold text-ink group-hover:text-brand">
            {title}
          </h3>
          <p className="mt-1 text-[0.74rem] text-muted-fg">{publishedAt}</p>
          <p className="mt-1 text-sm text-muted-fg">{excerptText}</p>
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
        // next/image allowlist); PhotoFigure's border dress, bounded by ratio.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={title}
          className={`${lead ? "aspect-[2/1]" : "aspect-[3/2]"} w-full border border-hairline object-cover`}
        />
      ) : null}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>სიახლეები</Eyebrow>
          {pill}
        </div>
        <h3
          className={`mt-1 font-serif font-bold text-ink group-hover:text-brand ${
            lead ? "text-3xl" : "text-lg"
          }`}
        >
          {title}
        </h3>
        <p className="mt-1 text-[0.74rem] text-muted-fg">{publishedAt}</p>
        <p className={`mt-1 text-sm text-muted-fg ${lead ? "" : "line-clamp-2"}`}>{excerptText}</p>
      </div>
    </Link>
  );
}
