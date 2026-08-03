"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Spliced from the reference bundle (data-act="menu" / data-act="closeMenu").
const MENU = "მენიუ";
const CLOSE = "დახურვა";
// The dialog and the nav inside it must not share a name, or a screen reader
// announces the same label twice on entry. The nav keeps the shipped landmark
// label; the dialog is named for the control that opened it.
const MENU_NAV_LABEL = "მთავარი ნავიგაცია";
const MENU_DIALOG_LABEL = MENU;

/**
 * Focusable descendants, in tab order. `sessionSlot` and `cta` are arbitrary
 * caller-supplied nodes, so the query must exclude controls that cannot take
 * focus -- a disabled button as the last child would otherwise become a trap
 * boundary that can never be reached, silently breaking the wrap.
 */
function focusableIn(panel: HTMLElement): HTMLElement[] {
  return [
    ...panel.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => el.getAttribute("tabindex") !== "-1");
}

/**
 * The public navigation below `md` (spec §4.9): a trigger in the masthead that
 * opens a full-screen overlay listing the same destinations the desktop
 * masthead shows inline.
 *
 * The focus trap is ~20 lines of local code rather than a dependency --
 * adding one would need a DECISIONS.md entry for no real gain here.
 */
export function MobileMenu({
  navItems,
  sessionSlot,
  cta,
}: {
  navItems: { href: string; label: string }[];
  sessionSlot?: ReactNode;
  cta?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Route changes must close the overlay, or tapping a link leaves it covering
  // the page it navigated to.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time close on pathname change, not a cascading loop (same idiom as MembershipWizard.tsx's region-clear reset)
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = focusableIn(panelRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      // The trigger lives OUTSIDE the panel, so an activeElement that is
      // neither end (including the trigger itself) must be pulled back in --
      // otherwise the first Shift+Tab after opening escapes the overlay.
      if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Move focus into the panel on open, so the overlay owns the tab sequence
  // from the first keystroke rather than from the second.
  useEffect(() => {
    if (!open || !panelRef.current) return;
    focusableIn(panelRef.current)[0]?.focus({ preventScroll: true });
  }, [open]);

  // Returning focus to the trigger is what keeps keyboard users from being
  // dumped at the top of the document when the overlay closes. Guarded on a
  // real open->close transition: an unguarded effect also fires on mount, which
  // stole focus to the trigger on every mobile page load.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="inline-flex h-[34px] items-center border border-ink px-3.5 text-[0.76rem] font-bold text-ink hover:bg-ink hover:text-paper"
      >
        {MENU}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={MENU_DIALOG_LABEL}
          className="fixed inset-0 z-50 flex flex-col bg-paper"
        >
          <div className="flex items-center justify-end border-b-2 border-ink px-5 pb-2.5 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-[34px] items-center border border-ink bg-ink px-3.5 text-[0.76rem] font-bold text-paper hover:border-brand hover:bg-brand"
            >
              {CLOSE}
            </button>
          </div>

          <nav aria-label={MENU_NAV_LABEL} className="flex-1 overflow-y-auto px-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className="block border-b border-hairline py-4 font-serif text-[1.18rem] font-bold text-ink no-underline aria-[current=page]:text-brand"
              >
                {item.label}
              </Link>
            ))}
            {sessionSlot ? <div className="py-4">{sessionSlot}</div> : null}
          </nav>

          {cta ? (
            <div className="border-t-2 border-ink px-5 pt-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
              {cta}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
