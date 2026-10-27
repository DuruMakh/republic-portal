"use client";

import Link from "@/lib/i18n/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCopy } from "@/lib/i18n/copy";

import { Caps } from "@/components/Caps";
import { useChromePathname } from "@/components/ChromePathname";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useFocusTrap } from "@/components/useFocusTrap";
import { useSignedIn } from "@/components/useSignedIn";
import { mobileBackTarget } from "@/lib/mobile-nav";

type NavItem = { href: string; label: string };

const JOIN = "შემოგვიერთდი";
const CABINET = "კაბინეტი";
const MENU = "მენიუ";
const CLOSE = "დახურვა";
const HOME_LABEL = "ქართული რესპუბლიკა — მთავარი";
const BRAND = "ქართული რესპუბლიკა";
const BACK = "← უკან";

/**
 * The „ერთობა“ header. On the homepage it sits on the wine hero (light logo, sand links, a
 * limestone button); everywhere else it is limestone with a hairline below. Below 900px the
 * links fold into a full-screen wine menu and the header stays pinned while the page scrolls
 * (as the Kronika masthead did on phones). The account slot follows HeaderSessionAction:
 * guests get the join door, a signed-in visitor gets the cabinet link after mount.
 *
 * On a detail page (mobileBackTarget) phones get a sticky back bar instead: „← უკან“ to the
 * declared parent on the left, the section's name in red capitals on the right. It is a sibling
 * of the header so it can stick while the page scrolls; the full header returns from 900px.
 * `eventsShown` / `ratingsShown` come from the server switches, as for Masthead.
 */
export function UnityHeader({
  navItems,
  eventsShown,
  ratingsShown,
}: {
  navItems: NavItem[];
  eventsShown: boolean;
  ratingsShown: boolean;
}) {
  const t = useCopy();
  const pathname = useChromePathname();
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dark = pathname === "/";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the persistent menu after navigation, including browser history
    setOpen(false);
  }, [pathname]);

  // Escape, the Tab cycle and the body-scroll lock come from useFocusTrap, as in MobileMenu.
  const close = useCallback(() => setOpen(false), []);
  useFocusTrap({ active: open, containerRef: panelRef, onEscape: close });

  // Back to the menu button on a real open -> close transition (not on mount).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  const action = signedIn ? { href: "/me", label: CABINET } : { href: "/join", label: JOIN };
  const back = mobileBackTarget(pathname, eventsShown, ratingsShown);

  return (
    <>
      {back ? (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-rule bg-limestone px-5 min-[900px]:hidden">
          <Link
            href={back.href}
            className="text-[15px] font-semibold text-ink no-underline hover:text-brand"
          >
            {t(BACK)}
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-bold tracking-[.14em] text-brand">
              <Caps>{t(back.label)}</Caps>
            </span>
            <LanguageSwitch />
          </div>
        </header>
      ) : null}
      <header
        className={`${back ? "hidden min-[900px]:block" : ""} ${
          dark
            ? "sticky top-0 z-40 border-b border-limestone/14 bg-wine text-limestone min-[900px]:relative min-[900px]:z-10 [&_:focus-visible]:outline-limestone"
            : "sticky top-0 z-40 border-b border-rule bg-limestone text-ink min-[900px]:relative min-[900px]:z-10"
        }`}
      >
        <div className="unity-container flex h-[68px] items-center justify-between gap-6 min-[900px]:h-[88px]">
          <Link href="/" aria-label={t(HOME_LABEL)} className="flex shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark */}
            <img
              src={dark ? "/unity/logo-light.png" : "/unity/logo.png"}
              alt={t(BRAND)}
              width={dark ? 955 : 687}
              height={dark ? 321 : 231}
              className="block h-[38px] w-auto min-[900px]:h-[46px]"
            />
          </Link>
          <nav
            aria-label={t("მთავარი ნავიგაცია")}
            className="hidden items-center gap-[clamp(18px,2.2vw,34px)] whitespace-nowrap text-[13px] font-semibold tracking-[.08em] min-[900px]:flex"
          >
            {navItems.map((item) => {
              const current = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`border-b-2 pb-1.5 pt-2 no-underline transition-colors ${
                    dark
                      ? current
                        ? "border-sand text-white hover:text-white"
                        : "border-transparent text-sand hover:text-white"
                      : current
                        ? "border-brand text-brand hover:text-brand"
                        : "border-transparent text-ink hover:text-brand"
                  }`}
                >
                  <Caps>{t(item.label)}</Caps>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2.5">
            <LanguageSwitch />
            <Link
              href={action.href}
              className={`hidden h-11 items-center whitespace-nowrap px-5 text-[13px] font-bold tracking-[.08em] no-underline transition-colors min-[900px]:inline-flex ${
                dark
                  ? "bg-limestone text-wine hover:bg-white hover:text-wine"
                  : "bg-brand text-white hover:bg-brand-dark hover:text-white"
              }`}
            >
              <Caps>{t(action.label)}</Caps>
            </Link>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-label={t(MENU)}
              className="-mr-1 inline-flex h-12 w-12 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-current min-[900px]:hidden"
            >
              <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden="true" className="block">
                <path
                  d="M0 1h24M0 8h24M0 15h24"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </button>
          </div>
        </div>

        {open ? (
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t(MENU)}
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-wine text-limestone [&_:focus-visible]:outline-limestone"
          >
            <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-limestone/14 px-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark */}
              <img
                src="/unity/logo-light.png"
                alt={t(BRAND)}
                width={955}
                height={321}
                className="block h-[38px] w-auto"
              />
              <div className="flex items-center gap-2.5">
                <LanguageSwitch onNavigate={close} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t(CLOSE)}
                  className="-mr-1 inline-flex h-12 w-12 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-limestone"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="block"
                  >
                    <path
                      d="M2 2 L18 18 M18 2 L2 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <nav aria-label={t(MENU)} className="flex flex-col px-5 pt-3">
              {navItems.map((item) => {
                const current = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={current ? "page" : undefined}
                    className={`flex min-h-16 items-center justify-between border-b border-limestone/14 text-[30px] font-black no-underline [font-stretch:62.5%] ${
                      current ? "text-white hover:text-white" : "text-limestone hover:text-white"
                    }`}
                  >
                    <Caps>{t(item.label)}</Caps>
                    {current ? (
                      <span aria-hidden="true" className="pebble block h-[11px] w-3.5 bg-sand" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto p-5">
              <Link
                href={action.href}
                onClick={() => setOpen(false)}
                className="flex h-14 items-center justify-center bg-limestone text-[14px] font-bold tracking-[.08em] text-wine no-underline hover:bg-white hover:text-wine"
              >
                <Caps>{t(action.label)}</Caps>
              </Link>
            </div>
          </div>
        ) : null}
      </header>
    </>
  );
}
