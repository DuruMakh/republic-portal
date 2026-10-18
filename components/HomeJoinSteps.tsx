import { useCopy } from "@/lib/i18n/copy";
import { HomePebbles } from "@/components/HomePebbles";
import { UnityTextLink } from "@/components/UnityTextLink";
import { HOME_JOIN_STEPS, HOME_JOIN_TITLE } from "@/lib/home-copy";

// The phone's numbered pebbles: the second has its own shape, the delegate's is ringed.
const BADGE_SHAPES = [
  "pebble",
  "rounded-[52%_48%_45%_55%/46%_50%_50%_54%]",
  "pebble shadow-[0_0_0_3px_var(--color-chalk),0_0_0_4.5px_var(--color-brand)]",
] as const;

/**
 * „როგორ შემოგვიერთდები“: the three rungs of membership. Three columns headed by the pebble
 * ladder on wider screens; a numbered path joined by a red line on the phone.
 */
export function HomeJoinSteps() {
  const t = useCopy();
  return (
    <section
      aria-labelledby="home-join-title"
      className="border-y border-rule bg-chalk py-10 sm:py-[clamp(44px,4.5vw,68px)]"
    >
      <div className="unity-container">
        <h2
          id="home-join-title"
          className="m-0 font-display text-[40px] font-bold leading-[.98] sm:text-[clamp(42px,5.3vw,76px)] sm:leading-[.96]"
        >
          {t(HOME_JOIN_TITLE)}
        </h2>
        <ol className="m-0 mt-8 list-none p-0 sm:mt-[clamp(48px,5vw,72px)] sm:grid sm:grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] sm:gap-x-[clamp(24px,3vw,48px)] sm:gap-y-[clamp(40px,4vw,56px)]">
          {HOME_JOIN_STEPS.map((step, i) => (
            <li
              key={step.title}
              className="relative grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-4 pb-[30px] last:pb-0 sm:flex sm:flex-col sm:gap-0 sm:pb-0"
            >
              {i < HOME_JOIN_STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[19px] top-[30px] border-l-2 border-brand sm:hidden"
                />
              ) : null}
              <span
                aria-hidden="true"
                className={`relative flex h-[30px] w-10 items-center justify-center bg-brand text-[17px] font-black text-white [font-stretch:62.5%] sm:hidden ${BADGE_SHAPES[i]}`}
              >
                {`0${i + 1}`}
              </span>
              <div aria-hidden="true" className="hidden h-12 items-center gap-3.5 sm:flex">
                <HomePebbles count={(i + 1) as 1 | 2 | 3} tone="brand" />
                <span className="h-0.5 flex-1 bg-brand" />
                <span className="text-[30px] font-black leading-none text-brand [font-stretch:62.5%]">
                  {`0${i + 1}`}
                </span>
              </div>
              <div className="flex min-w-0 flex-col sm:flex-1">
                <h3 className="m-0 font-serif text-[25px] font-semibold leading-[1.2] sm:mt-[26px] sm:text-[clamp(28px,2.6vw,36px)] sm:leading-[1.15]">
                  {t(step.title)}
                </h3>
                <p className="m-0 mt-2 text-[16px] leading-[1.6] text-prose sm:mt-3 sm:flex-1 sm:text-[18px] sm:leading-[1.65]">
                  {t(step.text)}
                </p>
                <p className="m-0 mt-2.5 sm:mt-[22px]">
                  <UnityTextLink href={step.link.href} className="text-[16px] sm:text-[17px]">
                    {t(step.link.label)}
                  </UnityTextLink>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
