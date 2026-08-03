"use client";

import { useEffect, type RefObject } from "react";

/**
 * Focusable descendants, in tab order. Overlay content is caller-supplied, so
 * the query must exclude controls that cannot take focus -- a disabled button
 * as the last child would otherwise become a trap boundary that can never be
 * reached, silently breaking the wrap.
 */
export function focusableIn(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => el.getAttribute("tabindex") !== "-1");
}

/**
 * Modal-overlay keyboard behavior, shared by every `aria-modal` surface in the
 * mobile chrome (the public menu and the cabinet overflow sheet). Extracted
 * rather than copied: CLAUDE.md forbids duplicating a logic block, and the
 * first version of the sheet shipped with none of this while the menu had all
 * of it.
 *
 * While `active`:
 * - focus moves into the container, so the overlay owns the tab sequence from
 *   the first keystroke rather than the second;
 * - Tab and Shift+Tab cycle within it, and focus that has escaped the
 *   container (the trigger usually sits outside) is pulled back in;
 * - Escape calls `onEscape`;
 * - body scroll is locked, and the previous value restored on close.
 *
 * Focus RESTORATION on close is deliberately left to the caller: the menu
 * returns focus to its own trigger ref, which is more precise than recording
 * whatever happened to be focused when the overlay opened.
 */
export function useFocusTrap({
  active,
  containerRef,
  onEscape,
}: {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscape();
        return;
      }
      const container = containerRef.current;
      if (event.key !== "Tab" || !container) return;
      const focusable = focusableIn(container);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (!container.contains(document.activeElement)) {
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
  }, [active, containerRef, onEscape]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (container) focusableIn(container)[0]?.focus({ preventScroll: true });
  }, [active, containerRef]);
}
