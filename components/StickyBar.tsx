import type { ReactNode } from "react";

/**
 * The one mobile bottom bar (spec §4.1). Both the public join CTA and the
 * cabinet tab bar render through this, so the bar's look and safe-area
 * handling live in exactly one place.
 *
 * This component does NOT itself prevent two bars on one route — it is a
 * stateless wrapper with no singleton guard. That guarantee comes from call
 * sites: the CTA mounts only in app/(public) and the tab bar only in
 * app/(member) and app/(delegate), which are mutually exclusive route groups.
 * Anything that mounts a second one has broken the invariant here, not below.
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
