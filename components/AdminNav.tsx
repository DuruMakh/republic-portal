"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Caps } from "@/components/Caps";
import type { AdminTab } from "@/lib/admin";
import { useSignOut } from "@/components/useSignOut";

/**
 * The tab row of the teal admin header („ერთობა“ redesign): spaced Mtavruli labels on teal, the
 * active tab marked by a sand underline, sign-out in sand at the far end.
 */
export function AdminNav({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname();
  // the shared sign-out: it also empties the offline caches (security audit M3)
  const signOut = useSignOut();

  return (
    <nav
      aria-label="ადმინისტრირების ნავიგაცია"
      className="relative flex items-stretch gap-[26px] overflow-x-auto whitespace-nowrap border-t border-limestone/15 text-[12.5px] font-semibold tracking-[.06em]"
    >
      {tabs.map((tab) => {
        // „მიმოხილვა“ (/admin) matches exactly; subpages match by prefix
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-14 items-center gap-2 no-underline transition-colors hover:text-white ${
              active ? "text-white shadow-[inset_0_-3px_0_var(--color-sand)]" : "text-limestone/85"
            }`}
          >
            <Caps>{tab.label}</Caps>
            {/* D10: the verify tab's pending-count badge gets the amber "needs
                attention" tone; every other counted tab keeps the default brand chip. */}
            {tab.count ? (
              <Badge tone={tab.href === "/admin/verify" ? "warn" : "brand"}>{tab.count}</Badge>
            ) : null}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={signOut}
        className="ms-auto h-14 text-sand transition-colors hover:text-white"
      >
        <Caps>გასვლა</Caps>
      </button>
    </nav>
  );
}
