import { Caps } from "@/components/Caps";
import {
  GEORGIAN_NUMERALS,
  PRINCIPLES,
  PRINCIPLES_CONTENTS,
  PRINCIPLES_CONTENTS_ANCHOR,
  principleAnchor,
} from "@/lib/principles-copy";

/**
 * The /principles table of contents on its sandstone band: the twelve titles in up to three
 * columns, each with its numeral and linking to its principle. Phones skip it (the seal and the
 * folded rows do its job there).
 */
export function PrinciplesContents() {
  return (
    <nav
      id={PRINCIPLES_CONTENTS_ANCHOR}
      aria-labelledby="toc-title"
      className="scroll-mt-16 bg-sandstone py-[clamp(56px,6vw,88px)] max-sm:hidden min-[900px]:scroll-mt-0"
    >
      <div className="unity-container">
        <div id="toc-title" className="text-[13px] font-bold tracking-[.14em] text-brand">
          <Caps>{PRINCIPLES_CONTENTS}</Caps>
        </div>
        <ol className="mt-6 list-none columns-[3_280px] gap-x-10 border-t-2 border-ink p-0">
          {PRINCIPLES.map(({ title }, i) => (
            <li key={title} className="break-inside-avoid">
              <a
                href={`#${principleAnchor(i + 1)}`}
                className="group grid grid-cols-[40px_minmax(0,1fr)] items-baseline gap-2.5 border-b border-[#cfc4b3] py-3.5 pr-2 text-ink no-underline transition-colors"
              >
                <span
                  aria-hidden="true"
                  className="font-aso text-[22px] leading-none font-light text-brand"
                >
                  {GEORGIAN_NUMERALS[i]}
                </span>
                <span className="text-[16px] leading-[1.45] font-semibold transition-colors group-hover:text-brand">
                  {title}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
