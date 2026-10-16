import { mtavruli } from "@/lib/mtavruli";

/**
 * Georgian capitals on screen, ordinary letters for everyone else. The Mtavruli copy is hidden
 * from assistive technology and a visually hidden twin carries the ordinary Mkhedruli text, so
 * screen readers, accessible names (getByRole, e2e lookups) and copy-paste all see normal words.
 */
export function Caps({ children }: { children: string }) {
  return (
    <>
      <span aria-hidden="true">{mtavruli(children)}</span>
      <span className="sr-only">{children}</span>
    </>
  );
}
