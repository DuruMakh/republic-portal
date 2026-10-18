import { useCopy } from "@/lib/i18n/copy";
import { StructurePebble } from "@/components/StructurePebble";
import { Caps } from "@/components/Caps";
import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";

// The design's scatter of tilts, picked per pebble so the field looks hand-laid.
const TILTS = [
  "rotate-[4deg]",
  "-rotate-[10deg]",
  "rotate-[14deg]",
  "-rotate-[3deg]",
  "rotate-[9deg]",
  "-rotate-[16deg]",
  "rotate-[2deg]",
];
const FOR = Array.from({ length: 36 }, (_, i) => TILTS[(i * 3) % TILTS.length]);
const AGAINST = Array.from({ length: 24 }, (_, i) => TILTS[(i * 5 + 2) % TILTS.length]);
const FIELD_PEBBLE = "h-[17px] w-[22px] sm:h-[23px] sm:w-[30px]";

/**
 * The general vote drawn as a field of pebbles (more for than against) with its legend, and the
 * 1921 constitution aside that roots the idea in Georgian history.
 */
export function StructureVote({
  forLabel,
  againstLabel,
  historyLabel,
  historyText,
  historyImageAlt,
}: {
  forLabel: string;
  againstLabel: string;
  historyLabel: string;
  historyText: string;
  historyImageAlt: string;
}) {
  const t = useCopy();
  return (
    <>
      <div className="mt-7 border border-rule bg-chalk px-4 pt-[26px] pb-[18px] sm:mt-[clamp(40px,4.5vw,64px)] sm:px-[clamp(20px,3vw,40px)] sm:pt-[clamp(28px,4vw,56px)] sm:pb-7">
        <div
          aria-hidden="true"
          className="flex items-center justify-center gap-3.5 sm:flex-wrap sm:gap-x-7 sm:gap-y-[22px]"
        >
          <div className="grid grid-cols-[repeat(6,22px)] gap-x-1 gap-y-1.5 sm:grid-cols-[repeat(9,30px)] sm:gap-x-1.5 sm:gap-y-2">
            {FOR.map((tilt, i) => (
              <StructurePebble key={i} className={`${FIELD_PEBBLE} bg-teal ${tilt}`} />
            ))}
          </div>
          <span className="self-stretch border-l-2 border-dashed border-rule" />
          <div className="grid grid-cols-[repeat(4,22px)] gap-x-1 gap-y-1.5 sm:grid-cols-[repeat(6,30px)] sm:gap-x-1.5 sm:gap-y-2">
            {AGAINST.map((tilt, i) => (
              <StructurePebble key={i} alt className={`${FIELD_PEBBLE} bg-[#CFC4B3] ${tilt}`} />
            ))}
          </div>
        </div>
        <div className="mt-[22px] flex justify-between gap-4 border-t border-rule pt-3.5 text-[14px] font-semibold sm:mt-7 sm:pt-[18px] sm:text-[15px]">
          <span className="inline-flex items-center gap-2 sm:gap-2.5">
            <StructurePebble className="h-2.5 w-[13px] bg-teal sm:h-[11px] sm:w-3.5" />
            {t(forLabel)}
          </span>
          <span className="inline-flex items-center gap-2 sm:gap-2.5">
            <StructurePebble className="h-2.5 w-[13px] bg-[#CFC4B3] sm:h-[11px] sm:w-3.5" />
            {t(againstLabel)}
          </span>
        </div>
      </div>
      <aside
        aria-label={t(historyLabel)}
        className="mt-[22px] grid grid-cols-[64px_minmax(0,1fr)] items-center gap-[18px] bg-sandstone px-[18px] py-5 sm:mt-7 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-8 sm:px-9 sm:py-7"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- small archival photo, fixed size */}
        <img
          src="/unity/doc-constitution-cover.jpg"
          alt={t(historyImageAlt)}
          width={891}
          height={1275}
          loading="lazy"
          className="block h-auto w-16 -rotate-4 shadow-[0_1px_2px_rgba(26,22,17,.16),0_3px_8px_rgba(26,22,17,.08),0_28px_56px_-22px_rgba(26,22,17,.5)] outline outline-1 -outline-offset-1 outline-ink/8 sm:w-[92px]"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 text-[11.5px] font-bold tracking-[.14em] text-brand sm:text-[12px]">
            <span
              aria-hidden="true"
              className="block h-3 w-[34px] flex-none bg-[url(/unity/ornament-wine.svg)] bg-[length:auto_12px] bg-left bg-repeat-x"
            />
            <span>
              <Caps>{t(historyLabel)}</Caps>
            </span>
          </div>
          <p className="mt-3 font-serif text-[16px] leading-[1.6] text-pretty text-ink sm:text-[19px]">
            {t(historyText)}
          </p>
          <OriginalLanguageNote document />
        </div>
      </aside>
    </>
  );
}
