import Link from "next/link";
import type { ReactNode } from "react";

export interface IndexRowProps {
  rank: number;
  name: ReactNode;
  meta: ReactNode;
  figure: ReactNode;
  figureLabel?: string;
  href?: string;
}

export function IndexRow({ rank, name, meta, figure, figureLabel, href }: IndexRowProps) {
  return (
    <div className="flex items-baseline gap-3.5 border-b border-hairline py-3.5">
      <span
        data-testid={`rank-${rank}`}
        className={`w-7 font-serif font-bold ${rank === 1 ? "text-brand" : "text-muted-fg"}`}
      >
        {rank}.
      </span>

      <div className="flex-1">
        {href ? (
          <Link href={href} className="text-ink no-underline hover:text-brand font-serif font-bold">
            {name}
          </Link>
        ) : (
          <span className="font-serif font-bold">{name}</span>
        )}
        <div className="block text-[0.74rem] text-muted-fg tracking-[.06em] mt-0.5">{meta}</div>
      </div>

      <div className="text-right">
        <div className="font-serif font-bold">{figure}</div>
        {figureLabel && <div className="text-[0.74rem] text-muted-fg">{figureLabel}</div>}
      </div>
    </div>
  );
}
