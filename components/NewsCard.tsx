import Link from "next/link";
import type { ReactNode } from "react";
import { cardSkin } from "@/components/Card";

/** Article list card — shared by /news (public) and /me/news (cabinet feed). */
export function NewsCard({
  href,
  title,
  publishedAt,
  imageUrl,
  excerptText,
  pill,
}: {
  href: string;
  title: string;
  publishedAt: string;
  imageUrl: string | null;
  excerptText: string;
  pill?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${cardSkin} flex gap-4 p-4 transition-colors hover:border-brand/50`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
        <img
          src={imageUrl}
          alt={title}
          className="h-20 w-28 shrink-0 rounded-lg border border-line object-cover"
        />
      ) : null}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-fg">
          <span>{publishedAt}</span>
          {pill}
        </div>
        <h3 className="mt-1 font-bold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted-fg">{excerptText}</p>
      </div>
    </Link>
  );
}
