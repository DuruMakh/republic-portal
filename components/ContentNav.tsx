"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { filterEventLinks } from "@/lib/events-switch";

const SECTIONS = [
  { href: "/admin/content/news", label: "სიახლეები" },
  { href: "/admin/content/events", label: "ღონისძიებები" },
  { href: "/admin/content/polls", label: "გამოკითხვები" },
] as const;

/** `eventsShown` is showEvents(), read by the server layout: the switch is server-only (ADR-038). */
export function ContentNav({ eventsShown }: { eventsShown: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="შიგთავსის ნავიგაცია"
      className="mb-6 flex gap-5 overflow-x-auto whitespace-nowrap border-b border-hairline text-[0.78rem] font-semibold"
    >
      {filterEventLinks(SECTIONS, eventsShown).map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`no-underline ${
              active ? "text-brand border-b-2 border-brand pb-1" : "text-ink hover:text-brand"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
