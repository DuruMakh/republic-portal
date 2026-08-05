"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/Badge";
import { useSignOut } from "@/components/useSignOut";
import type { CabinetNavItem } from "@/lib/cabinet";
import { activeNavHref } from "@/lib/nav-active";

export function CabinetNav({ items }: { items: CabinetNavItem[] }) {
  const pathname = usePathname();
  const signOut = useSignOut();

  // Longest matching href wins (owner fix list #7): "მთავარი" (/me) is a
  // prefix of every cabinet route, so bare prefix-matching kept it lit on
  // every page. Same rule AdminNav hardcodes for /admin, made data-driven —
  // this nav also serves the delegate chrome, whose root is /delegate.
  // Shared with MobileTabBar via lib/nav-active.ts so the rule cannot drift.
  const activeHref = activeNavHref(items, pathname);

  return (
    <nav
      aria-label="კაბინეტის ნავიგაცია"
      className="mb-8 hidden gap-5 overflow-x-auto whitespace-nowrap border-b border-hairline text-[0.78rem] font-semibold md:flex"
    >
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`no-underline inline-flex items-center gap-1.5 ${
              active ? "text-brand border-b-2 border-brand pb-1" : "text-ink hover:text-brand"
            }`}
          >
            {item.label}
            {item.count ? <Badge>{item.count}</Badge> : null}
          </Link>
        );
      })}
      <button type="button" onClick={signOut} className="ms-auto text-ink hover:text-brand">
        გასვლა
      </button>
    </nav>
  );
}
