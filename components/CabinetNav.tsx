"use client";
import { useCopy } from "@/lib/i18n/copy";

import Link from "@/lib/i18n/navigation";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Caps } from "@/components/Caps";
import { useSignOut } from "@/components/useSignOut";
import type { CabinetNavItem } from "@/lib/cabinet";
import { activeNavHref } from "@/lib/nav-active";
import { stripLocale } from "@/lib/i18n/routing";

/**
 * The cabinet's tab row on the wine band („ერთობა“ redesign): spaced capitals, the current
 * tab white with a sand underline, sign-out in sand at the far end. Desktop only; phones use
 * MobileTabBar.
 */
export function CabinetNav({ items }: { items: CabinetNavItem[] }) {
  const t = useCopy();
  const pathname = usePathname();
  const signOut = useSignOut();

  // Longest matching href wins (owner fix list #7): "მთავარი" (/me) is a
  // prefix of every cabinet route, so bare prefix-matching kept it lit on
  // every page. Same rule AdminNav hardcodes for /admin, made data-driven —
  // this nav also serves the delegate chrome, whose root is /delegate.
  // Shared with MobileTabBar via lib/nav-active.ts so the rule cannot drift.
  const activeHref = activeNavHref(items, stripLocale(pathname));
  const tab =
    "inline-flex h-14 items-center gap-2 whitespace-nowrap text-[13px] font-semibold tracking-[.08em] no-underline transition-colors";

  return (
    <nav
      aria-label={t("კაბინეტის ნავიგაცია")}
      className="hidden items-stretch gap-[clamp(22px,2.6vw,40px)] overflow-x-auto border-t border-limestone/14 md:flex"
    >
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${tab} ${
              active
                ? "text-white shadow-[inset_0_-3px_0_var(--color-sand)] hover:text-white"
                : "text-limestone/84 hover:text-white"
            }`}
          >
            <span>
              <Caps>{t(item.label)}</Caps>
            </span>
            {item.count ? <Badge tone="sand">{item.count}</Badge> : null}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={signOut}
        className={`${tab} ms-auto cursor-pointer border-0 bg-transparent p-0 text-sand hover:text-white`}
      >
        <Caps>{t("გასვლა")}</Caps>
      </button>
    </nav>
  );
}
