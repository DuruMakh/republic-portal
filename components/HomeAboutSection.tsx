import { ButtonLink } from "@/components/ButtonLink";
import { ABOUT_HREF, ABOUT_TITLE, HOME_ABOUT_EXCERPT, HOME_ABOUT_LINK } from "@/lib/about-copy";

/** The homepage section below the hero: the opening of /about as a pull quote, and a button. */
export function HomeAboutSection() {
  const [firstWord, ...rest] = ABOUT_TITLE.split(" ");

  return (
    <section aria-labelledby="home-about-title" className="px-5 pb-12 pt-4 sm:px-10">
      <div className="grid border border-ink bg-paper-bright md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col justify-between gap-8 border-b border-ink p-[clamp(24px,4vw,48px)] md:border-b-0 md:border-r">
          <h2
            id="home-about-title"
            className="display-heading text-[clamp(2.2rem,4.5vw,3.4rem)] text-ink"
          >
            {firstWord} <span className="text-brand">{rest.join(" ")}</span>
          </h2>
          <div>
            <ButtonLink href={ABOUT_HREF} size="lg">
              {HOME_ABOUT_LINK}
            </ButtonLink>
          </div>
        </div>
        <blockquote className="relative p-[clamp(24px,4vw,48px)]">
          <div aria-hidden="true" className="h-1.5 w-16 bg-brand" />
          <p className="mt-6 font-serif text-[clamp(1.15rem,2vw,1.45rem)] leading-[1.6] text-ink">
            {HOME_ABOUT_EXCERPT}
          </p>
        </blockquote>
      </div>
    </section>
  );
}
