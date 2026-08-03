"use client";

import Link from "next/link";
import type { CabinetNavItem } from "@/lib/cabinet";
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
  onClose,
}: {
  items: CabinetNavItem[];
  onClose: () => void;
}) {
  const signOut = useSignOut();

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
        role="dialog"
        aria-modal="true"
        aria-label={SHEET_LABEL}
        className="border-t-2 border-ink bg-paper px-5 pt-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))]"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="block border-b border-hairline py-3.5 font-serif text-[1.12rem] font-bold text-ink no-underline hover:text-brand"
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
