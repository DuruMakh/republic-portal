"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CabinetNavItem } from "@/lib/cabinet";
import { useFocusTrap } from "@/components/useFocusTrap";
import { useSignOut } from "@/components/useSignOut";

// Both already ship: „გასვლა“ from components/CabinetNav.tsx, „← საჯარო“ from
// app/(member)/layout.tsx's BACK_TO_PUBLIC.
const SIGN_OUT = "გასვლა";
const BACK_TO_PUBLIC = "← საჯარო";
const SHEET_LABEL = "პირადი კაბინეტი";
// The scrim is a close affordance, so it is labelled as one — reusing
// SHEET_LABEL here would give the dialog and its dismiss button the same name.
const CLOSE = "დახურვა";

/**
 * The „მეტი“ overflow sheet (spec §4.6). Always carries „← საჯარო“ and
 * „გასვლა“ on top of any role-specific overflow — which is why registered
 * users get a „მეტი“ tab despite having exactly four destinations, and why the
 * cabinet header is a bare nameplate with no actions.
 */
export function MobileMoreSheet({
  items,
  activeHref = null,
  onClose,
}: {
  items: CabinetNavItem[];
  activeHref?: string | null;
  onClose: () => void;
}) {
  const signOut = useSignOut();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Restore focus to whatever opened the sheet (the „მეტი“ tab), so closing it
  // does not dump a keyboard user at the top of the document.
  //
  // This MUST be declared before useFocusTrap: effects run in call order, and
  // the trap's first act is to move focus into the dialog. Declared after, this
  // would capture the dialog's own first link as the "opener".
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    };
  }, []);

  // This is a real aria-modal dialog, so it owns the keyboard while open:
  // without the trap, Tab walks straight out of it into the tab bar and cabinet
  // content sitting under the opaque overlay -- reachable by keyboard and by
  // screen-reader swipe even though nothing is visible. Shared with the public
  // menu rather than copied (see components/useFocusTrap.ts). The sheet only
  // mounts while open, so `active` is unconditionally true.
  useFocusTrap({ active: true, containerRef: dialogRef, onEscape: onClose });

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      <button
        type="button"
        data-testid="more-scrim"
        aria-label={CLOSE}
        onClick={onClose}
        className="flex-1 bg-ink/40"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={SHEET_LABEL}
        className="border-t-2 border-ink bg-paper px-5 pt-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))]"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.href === activeHref ? "page" : undefined}
            onClick={onClose}
            className={`block border-b border-hairline py-3.5 font-serif text-[1.12rem] font-bold no-underline hover:text-brand ${
              item.href === activeHref ? "text-brand" : "text-ink"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/"
          onClick={onClose}
          className="block border-b border-hairline py-3.5 text-[0.86rem] font-bold text-muted-fg no-underline hover:text-brand"
        >
          {BACK_TO_PUBLIC}
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="w-full py-3.5 text-left text-[0.86rem] font-bold text-brand"
        >
          {SIGN_OUT}
        </button>
      </div>
    </div>
  );
}
