import type { ReactNode } from "react";

/**
 * The one mobile bottom bar (spec §4.1). Both the public join CTA and the
 * cabinet tab bar render through this, which is what makes two bottom bars on
 * one route structurally impossible.
 *
 * `sticky bottom-0` rather than `fixed`: a sticky element still occupies
 * layout space, so it can never occlude the end of a page and no caller needs
 * a spacer. It pins to the viewport bottom on long pages and sits at the foot
 * of the sheet on short ones, because PageSheet is min-h-screen.
 *
 * Hidden from `md` up — desktop chrome is unchanged.
 */
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-40 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
      {children}
    </div>
  );
}
