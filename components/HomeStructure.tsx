import { useCopy } from "@/lib/i18n/copy";
import { Caps } from "@/components/Caps";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityTextLink } from "@/components/UnityTextLink";
import {
  HOME_RING_SUB,
  HOME_RING_TITLE,
  HOME_STRUCTURE_KICKER,
  HOME_STRUCTURE_LINK,
  HOME_STRUCTURE_RULES,
  HOME_STRUCTURE_TITLE,
} from "@/lib/home-copy";
import { STRUCTURE_HREF, STRUCTURE_INTRO } from "@/lib/structure-copy";

// From 1024px the text runs down the left column, centred against the council ring on the
// right: the empty first and last rows take up whatever height the ring adds.
const LEFT = "lg:col-start-1";

/**
 * The structure preview on sandstone: the headline, the one-line summary, three rules of the
 * board, a link to /structure, and the board's council ring. On the phone the ring follows the
 * headline and the rules are left to the full page.
 */
export function HomeStructure() {
  const t = useCopy();
  return (
    <section
      aria-labelledby="home-structure-title"
      className="overflow-hidden bg-sandstone pb-10 pt-10 sm:py-[clamp(48px,5vw,76px)]"
    >
      <div className="unity-container flex flex-col lg:grid lg:grid-cols-[minmax(0,13fr)_minmax(0,12fr)] lg:grid-rows-[1fr_auto_auto_auto_auto_1fr] lg:gap-x-[clamp(40px,6vw,96px)]">
        <div className={`${LEFT} lg:row-start-2`}>
          <UnityKicker>{t(HOME_STRUCTURE_KICKER)}</UnityKicker>
          <h2
            id="home-structure-title"
            className="m-0 mt-[18px] font-display text-[40px] font-bold leading-[.98] sm:mt-[22px] sm:text-[clamp(42px,5.3vw,76px)] sm:leading-[.96]"
          >
            <span className="block">{t(HOME_STRUCTURE_TITLE[0])}</span>{" "}
            <span className="block text-brand">{t(HOME_STRUCTURE_TITLE[1])}</span>
          </h2>
        </div>
        <div className="relative mx-auto mt-[26px] aspect-square w-[300px] max-w-full sm:w-[min(100%,540px)] lg:col-start-2 lg:row-span-6 lg:row-start-1 lg:mt-0 lg:self-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative illustration */}
          <img
            src="/unity/council-ring.svg"
            alt=""
            width={640}
            height={640}
            loading="lazy"
            className="absolute inset-0 block size-full"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 flex flex-col items-center justify-center text-center"
          >
            <span className="text-[20px] font-black leading-none text-ink [font-stretch:62.5%] sm:text-[clamp(26px,2.6vw,38px)]">
              <Caps>{t(HOME_RING_TITLE)}</Caps>
            </span>
            <span className="mt-1 font-serif text-[14px] text-secondary sm:mt-1.5 sm:text-[16px]">
              {t(HOME_RING_SUB)}
            </span>
          </div>
        </div>
        <p
          className={`m-0 mt-[22px] font-serif text-[19px] leading-[1.55] text-prose sm:mt-7 sm:max-w-[26em] sm:text-[clamp(20px,1.7vw,24px)] ${LEFT} lg:row-start-3`}
        >
          {t(STRUCTURE_INTRO)}
        </p>
        <dl className={`m-0 mt-10 hidden border-t-2 border-ink sm:block ${LEFT} lg:row-start-4`}>
          {HOME_STRUCTURE_RULES.map((rule) => (
            <div
              key={rule.term}
              className="grid grid-cols-[minmax(0,190px)_minmax(0,1fr)] gap-5 border-b border-[#cfc4b3] py-[18px]"
            >
              <dt className="text-[26px] font-black leading-[1.15] text-teal [font-stretch:62.5%]">
                <Caps>{t(rule.term)}</Caps>
              </dt>
              <dd className="m-0 text-[17px] leading-[1.6] text-prose">{t(rule.text)}</dd>
            </div>
          ))}
        </dl>
        <p className={`m-0 mt-[18px] sm:mt-[30px] ${LEFT} lg:row-start-5`}>
          <UnityTextLink href={STRUCTURE_HREF} className="text-[16px] sm:text-[17px]">
            {t(HOME_STRUCTURE_LINK)}
          </UnityTextLink>
        </p>
      </div>
    </section>
  );
}
