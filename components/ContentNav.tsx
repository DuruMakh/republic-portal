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
    <nav aria-label="შიგთავსის ნავიგაცია" className="mb-6 flex flex-wrap items-center gap-1">
      {SECTIONS.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              active ? "bg-brand/10 text-brand" : "text-muted-fg hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
