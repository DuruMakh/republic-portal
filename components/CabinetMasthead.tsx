"use client";

import Link from "@/lib/i18n/navigation";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CabinetNav } from "@/components/CabinetNav";
import { Caps } from "@/components/Caps";
import type { CabinetNavItem } from "@/lib/cabinet";
import { mobileBackTarget } from "@/lib/mobile-nav";
import { useCopy } from "@/lib/i18n/copy";
import { stripLocale } from "@/lib/i18n/routing";
import { LanguageSwitch } from "@/components/LanguageSwitch";

const HOME_LABEL = "ქართული რესპუბლიკა — მთავარი";
const BRAND = "ქართული რესპუბლიკა";
const BACK = "უკან";

function Logo({ className }: { className: string }) {
  const t = useCopy();
  return (
    <Link href="/" aria-label={t(HOME_LABEL)} className="flex shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark */}
      <img
        src="/unity/logo-light.png"
        alt={t(BRAND)}
        width={955}
        height={321}
        className={`block w-auto ${className}`}
      />
    </Link>
  );
}

/** The carved-stone strip in sand on wine that edges the cabinet band top and bottom. */
export function CabinetOrnament() {
  return (
    <span
      aria-hidden="true"
      className="block h-3 bg-wine bg-[url(/cabinet/ornament-band.svg)] bg-size-[auto_12px] bg-left bg-repeat-x md:h-[18px] md:bg-size-[auto_18px]"
    />
  );
}

/**
 * The cabinet's wine band („ერთობა“ redesign, პირადი კაბინეტი page of the owner's canvas):
 * light logo, the register tag, an optional link back to the public site, the tab row, and the
 * ornament strip. Phones get the logo and tag only, or a „← უკან“ bar on detail screens.
 */
export function CabinetMasthead({
  tag,
  items,
  backLink,
}: {
  tag: string;
  items: CabinetNavItem[];
  backLink?: ReactNode;
}) {
  const t = useCopy();
  const pathname = usePathname();
  const back = mobileBackTarget(stripLocale(pathname));

  return (
    <header className="sticky top-0 z-40 bg-wine text-limestone md:static [&_:focus-visible]:outline-limestone">
      <div className="flex h-[60px] items-center justify-between gap-4 px-5 md:hidden">
        {back ? (
          <>
            <Link
              href={back.href}
              className="-ml-0.5 inline-flex min-h-12 items-center gap-2.5 text-[15px] font-semibold text-limestone no-underline hover:text-white"
            >
              <span aria-hidden="true" className="text-[20px] leading-none">
                ←
              </span>
              {t(BACK)}
            </Link>
            <span className="text-[12px] font-bold tracking-[.14em] text-sand">
              <Caps>{t(back.label)}</Caps>
            </span>
          </>
        ) : (
          <div className="flex min-w-0 items-center gap-3.5">
            <Logo className="h-8" />
            <span aria-hidden="true" className="h-6 w-px flex-none bg-limestone/26" />
            <span className="truncate text-[12px] font-bold tracking-[.14em] text-sand">
              <Caps>{t(tag)}</Caps>
            </span>
          </div>
        )}
        <LanguageSwitch className="shrink-0 text-limestone" />
      </div>
      <div className="unity-container hidden md:block">
        <div className="flex h-[84px] items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-5">
            <Logo className="h-11" />
            <span aria-hidden="true" className="h-[30px] w-px flex-none bg-limestone/26" />
            <span className="whitespace-nowrap text-[13px] font-bold tracking-[.16em] text-sand">
              <Caps>{t(tag)}</Caps>
            </span>
          </div>
          <div className="flex items-center gap-6">
            {backLink}
            <LanguageSwitch className="text-limestone" />
          </div>
        </div>
        <CabinetNav items={items} />
      </div>
      <CabinetOrnament />
    </header>
  );
}
