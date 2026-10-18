import { useCopy } from "@/lib/i18n/copy";
import { UnityKicker } from "@/components/UnityKicker";
import { mtavruli } from "@/lib/mtavruli";

/**
 * The /structure hero: kicker, the two-line headline with the red second line, the lede, and
 * the council ring (five teal seats inside a crowd of pebbles) captioned with the board's size.
 */
export function StructureHero({
  kicker,
  title,
  lede,
  ringTitle,
  ringCaption,
}: {
  kicker: string;
  title: string;
  lede: string;
  ringTitle: string;
  ringCaption: string;
}) {
  const t = useCopy();
  const [first, ...rest] = t(title).split(" ");
  return (
    <section
      aria-labelledby="st-title"
      className="overflow-hidden pt-10 pb-9 sm:pt-[clamp(48px,6vw,88px)] sm:pb-[clamp(40px,5vw,72px)]"
    >
      <div className="unity-container flex flex-wrap items-center gap-x-[clamp(32px,5vw,80px)] gap-y-[22px] sm:gap-y-[clamp(32px,5vw,80px)]">
        <div className="min-w-0 flex-[1.4_1_460px]">
          <UnityKicker>{t(kicker)}</UnityKicker>
          <h1
            id="st-title"
            className="mt-5 font-display text-[40px] leading-[.96] font-bold tracking-[-.005em] sm:mt-[26px] sm:text-[clamp(46px,5.8vw,84px)] sm:leading-[.92]"
          >
            <span className="block">{first}</span>{" "}
            <span className="block text-brand">{rest.join(" ")}</span>
          </h1>
          <p className="mt-5 max-w-[24em] font-serif text-[19px] leading-[1.55] text-prose sm:mt-[30px] sm:text-[clamp(21px,1.9vw,27px)] sm:leading-normal">
            {t(lede)}
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_360px] justify-center">
          <div className="relative aspect-square w-[min(100%,320px)] sm:w-[min(100%,500px)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG illustration */}
            <img
              src="/unity/council-ring.svg"
              alt=""
              className="absolute inset-0 block h-full w-full"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
            >
              <span className="text-[21px] leading-none font-black [font-stretch:62.5%] sm:text-[clamp(26px,2.6vw,38px)]">
                {mtavruli(t(ringTitle))}
              </span>
              <span className="mt-1 font-serif text-[14px] text-secondary sm:mt-1.5 sm:text-[16px]">
                {t(ringCaption)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
