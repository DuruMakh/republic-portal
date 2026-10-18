import { useCopy } from "@/lib/i18n/copy";
import { ABOUT_TIMELINE, ABOUT_TIMELINE_FLAG, ABOUT_TIMELINE_LABEL } from "@/lib/about-copy";

/** Container side padding, so the phone's swipe row can run edge to edge. */
const BLEED = "-mx-[clamp(20px,4.5vw,72px)] px-[clamp(20px,4.5vw,72px)]";

function Tulips({ className }: { className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small decorative drawing
    <img
      src="/unity/tulips.svg"
      alt=""
      width={196}
      height={200}
      className={`h-auto ${className}`}
    />
  );
}

/**
 * The 1918 — 1991 chronology. From 640px a vertical line of dates (year and day on the left,
 * a dot on the line, the event on the right); on a phone a row of cards to swipe through.
 */
export function AboutTimeline() {
  const t = useCopy();
  const last = ABOUT_TIMELINE.length - 1;
  return (
    <ol
      aria-label={t(ABOUT_TIMELINE_LABEL)}
      className={`${BLEED} m-0 mt-7 flex list-none items-stretch gap-3 overflow-x-auto py-0 [scrollbar-width:none] snap-x snap-mandatory sm:mx-0 sm:mt-2 sm:block sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden`}
    >
      {ABOUT_TIMELINE.map((entry, i) => (
        <li
          key={`${entry.year}-${entry.date}`}
          className="box-border flex-[0_0_264px] snap-start border border-rule bg-chalk px-5 pb-[22px] pt-5 sm:grid sm:grid-cols-[104px_minmax(0,1fr)] sm:gap-[26px] sm:border-0 sm:bg-transparent sm:p-0"
        >
          <span
            className={`flex items-baseline justify-between gap-2.5 sm:flex-col sm:items-end sm:justify-start sm:gap-0 sm:text-right ${
              i === last ? "" : "sm:pb-5"
            }`}
          >
            <span className="block font-display text-[34px] font-bold leading-[.95] text-brand sm:text-[30px] sm:leading-none">
              {entry.year}
            </span>
            <span className="block whitespace-nowrap text-[12px] font-semibold text-secondary sm:mt-1.5 sm:text-[12.5px] sm:leading-[1.35]">
              {t(entry.date)}
            </span>
            {entry.art === "tulips" ? <Tulips className="mt-3 hidden w-[58px] sm:block" /> : null}
          </span>
          <span
            className={`relative block min-w-0 sm:border-l-2 sm:pl-[26px] ${
              i === last ? "sm:border-transparent" : "sm:border-[#cfc4b3] sm:pb-5"
            }`}
          >
            <span
              aria-hidden="true"
              className="absolute -left-[7px] top-[7px] hidden h-3 w-3 rounded-full bg-sandstone shadow-[0_0_0_2px_var(--color-brand)] sm:block"
            />
            <span className="mt-3.5 block text-[16px] font-bold leading-[1.35] sm:mt-0 sm:text-[16.5px] sm:leading-[1.4]">
              {t(entry.title)}
            </span>
            <span className="mt-1.5 block font-serif text-[15px] leading-[1.6] text-prose sm:mt-1 sm:text-[15.5px]">
              {entry.lines.map((line, j) => (
                <span key={line}>
                  {j > 0 ? <br /> : null}
                  {t(line)}
                </span>
              ))}
              {entry.source ? (
                <>
                  {" "}
                  <span className="whitespace-nowrap">{t(entry.source)}</span>
                </>
              ) : null}
            </span>
            {entry.art === "flag" ? (
              <span className="mt-3 flex items-center gap-2.5 text-[12.5px] text-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element -- small decorative flag */}
                <img
                  src="/unity/flag-1918.svg"
                  alt=""
                  width={40}
                  height={24}
                  className="block h-5 w-[34px] shadow-[0_0_0_1px_rgba(26,22,17,.12)] sm:h-6 sm:w-10"
                />
                {t(ABOUT_TIMELINE_FLAG)}
              </span>
            ) : null}
            {entry.art === "tulips" ? <Tulips className="mt-3 block w-[46px] sm:hidden" /> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
