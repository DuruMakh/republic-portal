import Image from "next/image";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { UnityOrnament } from "@/components/UnityOrnament";
import type { AdminTab } from "@/lib/admin";
import { Caps } from "@/components/Caps";

const HOME_LABEL = "ქართული რესპუბლიკა — მთავარი";
const ADMIN_TAG = "ადმინისტრირება";

/** The admin content width: up to 1320px including side padding that grows with the screen. */
export const ADMIN_CONTAINER = "mx-auto w-full max-w-[1320px] px-[clamp(20px,3vw,56px)]";

/** The admin area's teal header („ერთობა“ redesign): light logo, the register tag, the tabs and the ornament strip. */
export function AdminHeader({ tabs }: { tabs: AdminTab[] }) {
  return (
    <header className="bg-teal text-limestone">
      <div className={ADMIN_CONTAINER}>
        <div className="flex h-[84px] items-center gap-3 sm:gap-5">
          <Link href="/" aria-label={HOME_LABEL} className="flex shrink-0">
            <Image
              src="/unity/logo-light.png"
              alt=""
              width={131}
              height={44}
              priority
              className="h-auto w-[110px] sm:w-[131px]"
            />
          </Link>
          <span aria-hidden="true" className="h-[30px] w-px flex-none bg-limestone/30" />
          <span className="whitespace-nowrap text-[11px] font-bold tracking-[.1em] text-sand sm:text-[13px] sm:tracking-[.16em]">
            <Caps>{ADMIN_TAG}</Caps>
          </span>
        </div>
        <AdminNav tabs={tabs} />
      </div>
      <UnityOrnament tone="teal" />
    </header>
  );
}
