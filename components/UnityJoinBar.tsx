"use client";

import Link from "next/link";

import { useSignedIn } from "@/components/useSignedIn";
import { mtavruli } from "@/lib/mtavruli";

const JOIN = "შემოგვიერთდი";
const CABINET = "ჩემი კაბინეტი →";

/**
 * The phone-width join bar of the „ერთობა“ pages: sticks to the bottom of the screen over a
 * 2px ink rule. A signed-in visitor gets the cabinet link after mount (see MobileJoinCta).
 */
export function UnityJoinBar() {
  const signedIn = useSignedIn();
  return (
    <div className="sticky bottom-0 z-30 border-t-2 border-ink bg-limestone px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 sm:hidden">
      <Link
        href={signedIn ? "/me" : "/join"}
        className="flex h-[54px] items-center justify-center bg-brand text-[14px] font-bold tracking-[.08em] text-white no-underline hover:bg-brand-dark hover:text-white"
      >
        {mtavruli(signedIn ? CABINET : JOIN)}
      </Link>
    </div>
  );
}
