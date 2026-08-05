"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BrandLockup } from "@/components/BrandLockup";
import { MobileBackHeader } from "@/components/MobileBackHeader";
import { MobileMenu } from "@/components/MobileMenu";
import { mobileBackTarget } from "@/lib/mobile-nav";

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
  tag,
}: {
  navItems: NavItem[];
  cta: ReactNode;
  sessionSlot?: ReactNode;
  /**
   * Page-register label (additive, Task 15): rendered right after the lockup —
   * e.g. „პირადი კაბინეტი“ for the member cabinet, „ადმინისტრირება“ for admin.
   * Omitted on the public layout, which keeps the bare lockup.
   */
  tag?: string;
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

  // The cabinet/admin/delegate chrome renders the Masthead as a bare nameplate
  // (navItems=[], cta=null) with AdminNav/CabinetNav carrying the real nav — so
  // only render the primary-nav landmark when it actually has content, never an
  // empty <nav> that a screen reader would announce as a hollow landmark.
  const hasNav = navItems.length > 0 || Boolean(sessionSlot) || Boolean(cta);

  const back = mobileBackTarget(pathname);
  const mobileSticky = pathname !== "/styleguide" && !pathname.startsWith("/admin");

  return (
    <>
      {back ? <MobileBackHeader href={back.href} label={back.label} /> : null}
      <header
        // Conditional first so the non-back case reproduces the previously
        // shipped class string byte-for-byte -- desktop output at >=768px must
        // not change at all.
        className={`${back ? "hidden md:flex" : "flex"} ${
          mobileSticky ? "sticky top-0 z-40 bg-paper md:static md:z-auto" : ""
        } items-center justify-between border-b-2 border-ink px-5 pb-2.5 pt-4 sm:px-10`}
      >
        <div className="flex items-center gap-2.5">
          <BrandLockup />
          {tag ? (
            <span className="text-[0.74rem] font-semibold tracking-[.14em] text-brand">{tag}</span>
          ) : null}
        </div>
        {hasNav ? (
          <>
            <nav
              aria-label="მთავარი ნავიგაცია"
              className="hidden items-center gap-3 overflow-x-auto whitespace-nowrap text-[0.8rem] font-semibold md:flex sm:gap-4"
            >
              {navLinks}
              {sessionSlot}
              {cta}
            </nav>
            {navItems.length > 0 ? (
              <MobileMenu navItems={navItems} sessionSlot={sessionSlot} cta={cta} />
            ) : null}
          </>
        ) : null}
      </header>
    </>
  );
}
