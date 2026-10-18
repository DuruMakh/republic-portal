import Link from "@/lib/i18n/navigation";
import { useCopy } from "@/lib/i18n/copy";
import { LanguageSwitch } from "@/components/LanguageSwitch";

// Spliced from scratch/mobile-strings.txt (key "back"), never hand-typed —
// see DESIGN.md's Georgian integrity gate.
const BACK = "← უკან";

/**
 * The detail-screen header (spec §4.3): a link to the declared parent on the
 * left, the section it belongs to in brand red on the right. Deliberately a
 * real link rather than router.back() — an article opened from a shared link
 * has no history behind it, and back() would leave the site (spec §4.8).
 *
 * Rendered as a sibling of Masthead and CSS-toggled: this one below `md`, the
 * Masthead from `md` up.
 */
export function MobileBackHeader({ href, label }: { href: string; label: string }) {
  const t = useCopy();
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between masthead-rule bg-paper px-5 pb-2.5 pt-4 md:hidden">
      <Link href={href} className="text-[0.82rem] font-bold text-ink no-underline hover:text-brand">
        {t(BACK)}
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-[0.74rem] font-bold tracking-[.18em] text-brand">{t(label)}</span>
        <LanguageSwitch />
      </div>
    </header>
  );
}
