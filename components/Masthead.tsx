"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Spliced (never hand-retyped) from prototype/kronika-d3/kronika-d3-template.html's
// <title> tag; every codepoint re-verified by script against the Georgian
// (Mkhedruli, U+10D0-U+10FF) Unicode block before commit; see
// docs/superpowers/sdd/task-5-brief.md and the georgian-quote-transcription-
// hazard note (never retype Georgian by hand). Brand name; shared alt text
// for both lockup orientations.
const WORDMARK_ALT = "ქართული რესპუბლიკა";

type NavItem = { href: string; label: string };

/**
 * The site masthead (spec Sec 3.2, unified to a single layout at the v0.9.0
 * owner checkpoint): horizontal lockup nameplate on the left, nav + session
 * slot + cta on the right, vertically centered with the logo, over a single
 * 2px rule. Same single-row layout on every page, including the homepage --
 * there is no separate homepage mode and no dateline row.
 */
export function Masthead({
  navItems,
  cta,
  sessionSlot,
}: {
  navItems: NavItem[];
  cta: ReactNode;
  sessionSlot?: ReactNode;
}) {
  const pathname = usePathname();

  const navLinks = navItems.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className="no-underline text-ink hover:text-brand aria-[current=page]:text-brand"
      aria-current={pathname === item.href ? "page" : undefined}
    >
      {item.label}
    </Link>
  ));

  return (
    <header className="flex items-center justify-between border-b-2 border-ink px-5 pb-2.5 pt-4 sm:px-10">
      <Link href="/" className="shrink-0">
        <Image
          src="/brand/lockup-horizontal-geo-red.png"
          alt={WORDMARK_ALT}
          width={172}
          height={58}
        />
      </Link>
      <nav
        aria-label="მთავარი ნავიგაცია"
        className="flex items-center gap-3 overflow-x-auto whitespace-nowrap text-[0.8rem] font-semibold sm:gap-4"
      >
        {navLinks}
        {sessionSlot}
        {cta}
      </nav>
    </header>
  );
}
