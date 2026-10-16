import type { ReactNode } from "react";
import { CabinetMasthead, CabinetOrnament } from "@/components/CabinetMasthead";
import { MobileTabBar } from "@/components/MobileTabBar";
import type { CabinetNavItem } from "@/lib/cabinet";

/**
 * Member and delegate cabinet chrome: full-bleed limestone between the wine band and a closing
 * ornament strip, with the phone tab bar below. Pages lay themselves out in `unity-container`.
 */
export function CabinetShell({
  tag,
  items,
  tabs,
  more,
  backLink,
  children,
}: {
  tag: string;
  items: CabinetNavItem[];
  tabs: CabinetNavItem[];
  more: CabinetNavItem[];
  backLink?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="unity-fonts flex min-h-screen flex-col overflow-x-clip bg-limestone text-[17px] leading-[1.65] text-ink">
      <CabinetMasthead tag={tag} items={items} backLink={backLink} />
      <div className="flex-1">{children}</div>
      <CabinetOrnament />
      <MobileTabBar tabs={tabs} more={more} />
    </div>
  );
}
