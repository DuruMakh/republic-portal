import { useCopy } from "@/lib/i18n/copy";
import { StructurePebble } from "@/components/StructurePebble";
import { Caps } from "@/components/Caps";

type FlowItem = { href: string; letter: string; label: string; note: string };

const OUTLINE_LETTER =
  "font-serif leading-[.8] font-extrabold text-transparent transition-colors [-webkit-text-stroke:1.5px_#CFC4B3] group-hover:[-webkit-text-stroke-color:var(--color-brand)]";

// The members card's mixed crowd of pebbles (design order), wide screens only.
const CROWD = [
  "bg-[#A39684]",
  "bg-[#CFC4B3]",
  "bg-teal",
  "bg-[#CFC4B3]",
  "bg-[#A39684]",
  "bg-[#CFC4B3]",
  "bg-[#A39684]",
  "bg-[#CFC4B3]",
  "bg-teal",
  "bg-[#A39684]",
  "bg-[#CFC4B3]",
  "bg-[#A39684]",
  "bg-[#CFC4B3]",
  "bg-[#A39684]",
];
const BOARD_TILT = [
  "",
  "min-[900px]:-rotate-12",
  "min-[900px]:rotate-[18deg]",
  "min-[900px]:-rotate-6",
  "min-[900px]:rotate-[10deg]",
];

/** Each card's small illustration: a crowd, the five seats, or a vote split 5 to 3. */
function Illustration({ href }: { href: string }) {
  if (href === "#members") {
    return (
      <span aria-hidden="true" className="flex max-w-[220px] flex-wrap gap-[5px]">
        {CROWD.map((bg, i) => (
          <StructurePebble
            key={i}
            alt={i % 2 === 1}
            className={`${bg} ${i % 2 ? "h-2.5 w-3" : "h-[11px] w-3.5"}`}
          />
        ))}
      </span>
    );
  }
  if (href === "#board") {
    return (
      <span
        aria-hidden="true"
        className="flex items-center gap-1.5 min-[900px]:h-[31px] min-[900px]:gap-2"
      >
        {BOARD_TILT.map((tilt, i) => (
          <StructurePebble
            key={i}
            alt={i % 2 === 1}
            className={`h-[15px] w-5 bg-teal min-[900px]:h-5 min-[900px]:w-[26px] ${tilt}`}
          />
        ))}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="flex h-[31px] items-center gap-2.5">
      <span className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <StructurePebble key={i} alt={i % 2 === 1} className="h-[11px] w-3.5 bg-teal" />
        ))}
      </span>
      <span className="h-[22px] w-0 border-l-2 border-dashed border-[#CFC4B3]" />
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <StructurePebble key={i} alt={i % 2 === 1} className="h-[11px] w-3.5 bg-[#CFC4B3]" />
        ))}
      </span>
    </span>
  );
}

function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="flex flex-none items-center justify-center py-2 text-teal min-[900px]:min-h-14 min-[900px]:w-14 min-[900px]:py-0"
    >
      <svg width="16" height="28" viewBox="0 0 16 28" className="block min-[900px]:hidden">
        <path d="M8 0 V24 M1 16 L8 25 L15 16" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <svg width="40" height="16" viewBox="0 0 40 16" className="hidden min-[900px]:block">
        <path d="M0 8 H36 M28 1 L37 8 L28 15" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  );
}

/**
 * The strip under the hero: members → board → general vote, each card a link to its section.
 * Wide screens set the three cards in a row with the illustration under the title; phones stack
 * them with the outline letter beside the title, as the phone design does.
 */
export function StructureFlow({ label, items }: { label: string; items: readonly FlowItem[] }) {
  const t = useCopy();
  return (
    <nav
      aria-label={t(label)}
      className="border-y border-rule bg-sandstone py-8 min-[900px]:py-[clamp(48px,5vw,72px)]"
    >
      <div className="unity-container flex flex-col items-stretch min-[900px]:flex-row min-[900px]:justify-center min-[900px]:gap-3">
        {items.map((item, i) => (
          <FlowCard key={item.href} item={item} arrow={i > 0} />
        ))}
      </div>
    </nav>
  );
}

function FlowCard({ item, arrow }: { item: FlowItem; arrow: boolean }) {
  const t = useCopy();
  const board = item.href === "#board";
  // Grid areas: on phones the outline letter sits beside the title and note; on wide screens it
  // sits at the title's end and the illustration and note run full width beneath.
  return (
    <>
      {arrow ? <Arrow /> : null}
      <a
        href={item.href}
        aria-label={t(item.label)}
        className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border border-rule bg-chalk p-[18px] text-ink no-underline transition-colors motion-reduce:transition-none [grid-template-areas:'title_letter'_'ill_letter'_'note_letter'] hover:border-brand hover:text-ink min-[900px]:flex-[1_1_260px] min-[900px]:content-start min-[900px]:items-end min-[900px]:gap-y-3.5 min-[900px]:px-[26px] min-[900px]:pt-[26px] min-[900px]:pb-6 min-[900px]:[grid-template-areas:'title_letter'_'ill_ill'_'note_note']"
      >
        <span className="block text-[26px] leading-none font-black [font-stretch:62.5%] [grid-area:title] min-[900px]:text-[30px]">
          <Caps>{t(item.label)}</Caps>
        </span>
        <span
          aria-hidden="true"
          className={`self-center text-[44px] [grid-area:letter] min-[900px]:self-end min-[900px]:text-[54px] ${OUTLINE_LETTER}`}
        >
          {item.letter}
        </span>
        <span
          className={`[grid-area:ill] ${board ? "mt-2.5 min-[900px]:mt-0" : "hidden min-[900px]:block"}`}
        >
          <Illustration href={item.href} />
        </span>
        <span className="mt-2 block text-[14px] leading-normal text-prose [grid-area:note] min-[900px]:mt-0 min-[900px]:self-start min-[900px]:text-[15px] min-[900px]:leading-[1.55]">
          {t(item.note)}
        </span>
      </a>
    </>
  );
}
