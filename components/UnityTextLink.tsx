import Link from "@/lib/i18n/navigation";
import type { ReactNode } from "react";

/**
 * The „ერთობა“ text link: underlined 1px with a wide offset. `red` on light backgrounds,
 * `light` (limestone text, sand underline, white on hover) on wine bands.
 */
export function UnityTextLink({
  href,
  children,
  tone = "red",
  className = "",
}: {
  href: string;
  children: ReactNode;
  tone?: "red" | "light";
  className?: string;
}) {
  const colours =
    tone === "light"
      ? "text-limestone decoration-sand hover:text-white hover:decoration-white"
      : "text-brand hover:text-brand-dark";
  return (
    <Link
      href={href}
      className={`font-semibold underline decoration-1 underline-offset-[6px] transition-colors ${colours} ${className}`}
    >
      {children}
    </Link>
  );
}
