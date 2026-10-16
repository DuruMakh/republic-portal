import { Caps } from "@/components/Caps";
import { UnityDocumentFan } from "@/components/UnityDocumentFan";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityOrnament } from "@/components/UnityOrnament";
import { UnityTextLink } from "@/components/UnityTextLink";
import {
  HOME_DOCUMENTS,
  HOME_DOCUMENTS_CAPTION,
  HOME_MILESTONES,
  HOME_ROOTS_BUTTON,
  HOME_ROOTS_KICKER,
  HOME_ROOTS_LINK,
  HOME_ROOTS_QUOTE,
  HOME_ROOTS_QUOTE_SOURCE,
  HOME_ROOTS_TEXT,
  HOME_ROOTS_TITLE,
} from "@/lib/home-copy";

// From 900px the text runs down the left column, centred against the document fan on the
// right: the empty first and last rows take up whatever height the fan adds.
const LEFT = "min-[56.25rem]:col-start-1";

/**
 * „პირველი რესპუბლიკა“: the 1918 republic in a quote, a line of history, the fanned archive
 * pages (each opens large) and four milestones, under a red braid on sandstone.
 */
export function HomeRoots() {
  return (
    <section aria-labelledby="home-roots-title" className="relative bg-sandstone">
      <UnityOrnament className="sm:h-[22px]! sm:bg-size-[auto_22px]!" />
      <div className="unity-container pb-10 pt-9 sm:pb-[clamp(44px,4.5vw,64px)] sm:pt-[clamp(40px,4vw,60px)]">
        <div className="flex flex-col min-[56.25rem]:grid min-[56.25rem]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[56.25rem]:grid-rows-[1fr_auto_auto_auto_auto_1fr] min-[56.25rem]:gap-x-[clamp(40px,5vw,88px)]">
          <div className={`${LEFT} min-[56.25rem]:row-start-2`}>
            <UnityKicker>{HOME_ROOTS_KICKER}</UnityKicker>
            <h2
              id="home-roots-title"
              className="m-0 mt-[18px] font-display text-[40px] font-bold leading-[.98] sm:mt-[22px] sm:text-[clamp(42px,5.3vw,76px)] sm:leading-[.96]"
            >
              <span className="block">{HOME_ROOTS_TITLE[0]}</span>{" "}
              <span className="block text-brand">{HOME_ROOTS_TITLE[1]}</span>
            </h2>
          </div>
          <UnityDocumentFan
            documents={HOME_DOCUMENTS}
            caption={HOME_DOCUMENTS_CAPTION}
            captionClassName="mx-auto max-w-[48em] sm:text-center"
            className="mt-[30px] min-[56.25rem]:col-start-2 min-[56.25rem]:row-span-6 min-[56.25rem]:row-start-1 min-[56.25rem]:mt-0 min-[56.25rem]:self-center"
          />
          <blockquote className={`m-0 mt-[30px] sm:mt-[34px] ${LEFT} min-[56.25rem]:row-start-3`}>
            <span
              aria-hidden="true"
              className="mb-3.5 block h-[3px] w-11 bg-brand sm:mb-[18px] sm:w-14"
            />
            <p className="m-0 font-serif text-[20px] font-medium leading-[1.45] text-ink [text-wrap:pretty] sm:text-[clamp(21px,1.8vw,25px)]">
              {HOME_ROOTS_QUOTE}
            </p>
            <footer className="mt-2.5 text-[12px] font-bold tracking-[.1em] text-brand sm:mt-3.5 sm:text-[13px]">
              <Caps>{HOME_ROOTS_QUOTE_SOURCE}</Caps>
            </footer>
          </blockquote>
          <p
            className={`m-0 mt-5 text-[16px] leading-[1.65] text-prose sm:mt-7 sm:max-w-[30em] sm:text-[17px] sm:leading-[1.7] ${LEFT} min-[56.25rem]:row-start-4`}
          >
            {HOME_ROOTS_TEXT}
          </p>
          <p className={`m-0 mt-[26px] hidden sm:block ${LEFT} min-[56.25rem]:row-start-5`}>
            <UnityTextLink href={HOME_ROOTS_LINK.href} className="text-[17px]">
              {HOME_ROOTS_LINK.label}
            </UnityTextLink>
          </p>
        </div>

        <ol className="m-0 mt-[30px] list-none p-0 sm:mt-[clamp(48px,5vw,72px)] sm:grid sm:grid-cols-2 sm:gap-[clamp(24px,2.6vw,40px)] min-[56.25rem]:grid-cols-4">
          {HOME_MILESTONES.map((m) => (
            <li
              key={m.year}
              className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] gap-3 border-t border-[#cfc4b3] py-[18px] first:border-ink sm:grid-cols-[auto_minmax(0,1fr)] sm:content-start sm:items-baseline sm:gap-x-3 sm:gap-y-0 sm:border-t-2 sm:border-ink sm:pb-0 sm:pt-[22px]"
            >
              <span className="font-display text-[34px] font-bold leading-[.95] text-brand sm:col-start-1 sm:row-start-1 sm:text-[clamp(40px,3.6vw,52px)] sm:leading-[.9]">
                {m.year}
              </span>
              <span className="min-w-0 sm:contents">
                <span className="block text-[12.5px] font-semibold text-secondary sm:col-start-2 sm:row-start-1 sm:justify-self-end sm:whitespace-nowrap sm:text-[13px]">
                  {m.date}
                </span>
                <span className="mt-0.5 block text-[16px] font-bold leading-[1.35] sm:col-span-2 sm:mt-4 sm:text-[17px]">
                  {m.title}
                </span>
                <span className="mt-1.5 block font-serif text-[15.5px] leading-[1.6] text-prose sm:col-span-2 sm:mt-2 sm:text-[16.5px]">
                  {m.text}
                  {m.source ? (
                    <>
                      {" "}
                      <span className="whitespace-nowrap">{m.source}</span>
                    </>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <UnityButtonLink
          href={HOME_ROOTS_LINK.href}
          variant="ghost"
          size="sm"
          className="mt-3 h-[52px]! w-full sm:hidden"
        >
          {HOME_ROOTS_BUTTON}
        </UnityButtonLink>
      </div>
    </section>
  );
}
