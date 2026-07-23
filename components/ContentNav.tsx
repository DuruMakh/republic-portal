"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/admin/content/news", label: "სიახლეები" },
  { href: "/admin/content/events", label: "ღონისძიებები" },
  { href: "/admin/content/polls", label: "გამოკითხვები" },
] as const;

export function ContentNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="შიგთავსის ნავიგაცია"
      className="mb-6 flex gap-5 overflow-x-auto whitespace-nowrap border-b border-hairline text-[0.78rem] font-semibold"
    >
      {SECTIONS.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={
              active ? "text-brand border-b-2 border-brand pb-1" : "text-ink hover:text-brand"
            }
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
