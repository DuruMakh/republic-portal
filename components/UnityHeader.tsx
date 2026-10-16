"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useChromePathname } from "@/components/ChromePathname";
import { useSignedIn } from "@/components/useSignedIn";
import { mtavruli } from "@/lib/mtavruli";

type NavItem = { href: string; label: string };

const JOIN = "შემოგვიერთდი";
const CABINET = "კაბინეტი";
const MENU = "მენიუ";
const CLOSE = "დახურვა";
const HOME_LABEL = "ქართული რესპუბლიკა — მთავარი";
const BRAND = "ქართული რესპუბლიკა";

/**
 * The „ერთობა“ header. On the homepage it sits on the wine hero (light logo, sand links, a
 * limestone button); everywhere else it is limestone with a hairline below. Below 900px the
 * links fold into a full-screen wine menu. The account slot follows HeaderSessionAction:
 * guests get the join door, a signed-in visitor gets the cabinet link after mount.
 */
export function UnityHeader({ navItems }: { navItems: NavItem[] }) {
  const pathname = useChromePathname();
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dark = pathname === "/";

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const action = signedIn ? { href: "/me", label: CABINET } : { href: "/join", label: JOIN };

  return (
    <header
      className={
        dark
          ? "relative z-10 border-b border-limestone/14 bg-wine text-limestone"
          : "relative z-10 border-b border-rule bg-limestone text-ink"
      }
    >
      <div className="unity-container flex h-[68px] items-center justify-between gap-6 min-[900px]:h-[88px]">
        <Link href="/" aria-label={HOME_LABEL} className="flex shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark */}
          <img
            src={dark ? "/unity/logo-light.png" : "/unity/logo.png"}
            alt={BRAND}
            width={dark ? 955 : 687}
            height={dark ? 321 : 231}
            className="block h-[38px] w-auto min-[900px]:h-[46px]"
          />
        </Link>
        <nav
          aria-label="მთავარი ნავიგაცია"
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
                {mtavruli(item.label)}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2.5">
          <Link
            href={action.href}
            className={`hidden h-11 items-center whitespace-nowrap px-5 text-[13px] font-bold tracking-[.08em] no-underline transition-colors min-[900px]:inline-flex ${
              dark
                ? "bg-limestone text-wine hover:bg-white hover:text-wine"
                : "bg-brand text-white hover:bg-brand-dark hover:text-white"
            }`}
          >
            {mtavruli(action.label)}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label={MENU}
            className="-mr-1 inline-flex h-12 w-12 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-current min-[900px]:hidden"
          >
            <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden="true" className="block">
              <path d="M0 1h24M0 8h24M0 15h24" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={MENU}
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-wine text-limestone [&_:focus-visible]:outline-limestone"
        >
          <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-limestone/14 px-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark */}
            <img
              src="/unity/logo-light.png"
              alt={BRAND}
              width={955}
              height={321}
              className="block h-[38px] w-auto"
            />
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label={CLOSE}
              className="-mr-1 inline-flex h-12 w-12 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-limestone"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="block">
                <path
                  d="M2 2 L18 18 M18 2 L2 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </button>
          </div>
          <nav aria-label={MENU} className="flex flex-col px-5 pt-3">
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
                  {mtavruli(item.label)}
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
              {mtavruli(action.label)}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
