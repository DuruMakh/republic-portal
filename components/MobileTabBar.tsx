"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { MobileMoreSheet } from "@/components/MobileMoreSheet";
import { StickyBar } from "@/components/StickyBar";
import { useCloseAboveMd } from "@/components/useCloseAboveMd";
import type { CabinetNavItem } from "@/lib/cabinet";
import { showsTabBar } from "@/lib/mobile-nav";
import { activeNavHref } from "@/lib/nav-active";

// Spliced from the reference bundle's tab definitions (act: "more").
const MORE = "მეტი";
const TABBAR_LABEL = "კაბინეტის ნავიგაცია";

/**
 * The cabinet bottom bar (spec §4.6): four destinations plus „მეტი“, for every
 * role. Text only — no icons, which is what keeps it inside the Kronika
 * rules-and-type system.
 *
 * Labels arrive already shortened by mobileTabs(); this component never
 * truncates, because the 0.74rem floor in DESIGN.md §2.3 forbids solving
 * overflow with a smaller font.
 */
export function MobileTabBar({ tabs, more }: { tabs: CabinetNavItem[]; more: CabinetNavItem[] }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Route changes must close the sheet, or navigating from within it leaves
  // the overlay covering the page it just navigated to.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time close on pathname change, not a cascading loop (same idiom as MobileMenu.tsx)
    setSheetOpen(false);
  }, [pathname]);

  // Escape is handled by the sheet itself (components/useFocusTrap.ts), which is
  // mounted over exactly the same window as this state. A second listener here
  // would fire on the same keypress for the same result.
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  useCloseAboveMd(closeSheet);

  if (!showsTabBar(pathname)) return null;

  // Longest-match, shared with CabinetNav. A naive prefix test would light
  // „მთავარი“ (/me) on every registered page — owner fix #7, already fixed once.
  const activeHref = activeNavHref([...tabs, ...more], pathname);
  const moreActive = more.some((item) => item.href === activeHref);
  const slot =
    "flex flex-1 min-w-0 h-14 items-center justify-center gap-1 px-1 text-center no-underline";

  return (
    <>
      <StickyBar>
        <nav aria-label={TABBAR_LABEL} className="flex text-[0.74rem] font-semibold">
          {tabs.map((tab) => {
            const on = tab.href === activeHref;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={`${slot} border-t-2 ${
                  on ? "border-brand font-bold text-brand" : "border-transparent text-ink"
                }`}
              >
                <span className="min-w-0 break-words">{tab.label}</span>
                {tab.count ? <Badge>{tab.count}</Badge> : null}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            aria-current={moreActive ? "page" : undefined}
            className={`${slot} border-t-2 ${
              moreActive ? "border-brand font-bold text-brand" : "border-transparent text-ink"
            }`}
          >
            {MORE}
          </button>
        </nav>
      </StickyBar>
      {sheetOpen ? (
        <MobileMoreSheet items={more} activeHref={activeHref} onClose={closeSheet} />
      ) : null}
    </>
  );
}
