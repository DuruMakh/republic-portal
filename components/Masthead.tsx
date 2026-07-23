"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Spliced (never hand-retyped) from prototype/kronika-d3/kronika-d3-template.html
// via the Task-5 brief's Step 3 node snippet (city) and the same
// file's <title> tag (wordmark) — every codepoint re-verified by script
// against the Georgian (Mkhedruli, U+10D0-U+10FF) Unicode block before commit;
// see docs/superpowers/sdd/task-5-brief.md and the georgian-quote-
// transcription-hazard note (never retype Georgian by hand).
const CITY = "თბილისი";
// Brand name; shared alt text for both lockup orientations.
const WORDMARK_ALT = "ქართული რესპუბლიკა";

type NavItem = { href: string; label: string };

/**
 * The site masthead (spec §3.2, amended at the v0.9.0 owner checkpoint) — two
 * modes. FULL on the homepage: dateline row, horizontal lockup nameplate,
 * double ink rule, nav row (no tagline). COMPACT
 * everywhere else: horizontal lockup + nav + cta over a single 2px rule. The
 * dateline is the masthead's own first row (no separate Dateline component)
 * and renders ONLY in full mode, so statically-served pages (join/login/
 * styleguide) never show a stale date — the homepage's own date staleness is
 * bounded by its 60s revalidate instead.
 */
export function Masthead({
  navItems,
  dateKa,
  cta,
  sessionSlot,
}: {
  navItems: NavItem[];
  dateKa: string;
  cta: ReactNode;
  sessionSlot?: ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";

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

  if (isHome) {
    return (
      <header className="px-5 pt-5 text-center sm:px-10 sm:pt-7">
        <div className="flex justify-between border-b border-ink pb-2 text-[0.74rem] text-muted-fg">
          <span>{dateKa}</span>
          <span>{CITY}</span>
        </div>
        <Image
          src="/brand/lockup-horizontal-geo-red.png"
          alt={WORDMARK_ALT}
          width={344}
          height={116}
          className="mx-auto mt-5 h-auto max-w-full"
          priority
        />
        <div className="mt-3.5 h-[3px] border-y border-ink border-t-2" />
        <nav
          aria-label="მთავარი ნავიგაცია"
          className="flex items-center justify-center gap-4 overflow-x-auto whitespace-nowrap border-b border-ink px-2 py-2.5 text-[0.8rem] font-semibold sm:gap-6"
        >
          {navLinks}
          {sessionSlot}
          {cta}
        </nav>
      </header>
    );
  }

  return (
    <header className="flex items-baseline justify-between border-b-2 border-ink px-5 pb-2.5 pt-4 sm:px-10">
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
