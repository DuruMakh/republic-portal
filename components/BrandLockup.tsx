import Image from "next/image";
import Link from "@/lib/i18n/navigation";
import { useCopy } from "@/lib/i18n/copy";
import type { MouseEventHandler } from "react";

// Byte-exact extraction from the Masthead's shipped lockup. Keeping the
// accessible brand name here lets every chrome surface reuse one lockup.
const WORDMARK_ALT = "ქართული რესპუბლიკა";

export function BrandLockup({ onClick }: { onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  const t = useCopy();
  return (
    <Link href="/" onClick={onClick} className="shrink-0">
      <Image
        src="/brand/lockup-horizontal-geo-red.png"
        alt={t(WORDMARK_ALT)}
        width={172}
        height={58}
      />
    </Link>
  );
}
