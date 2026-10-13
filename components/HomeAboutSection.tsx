import { ButtonLink } from "@/components/ButtonLink";
import { OrnamentBand, Rosette } from "@/components/Ornament";
import { ABOUT_HREF, ABOUT_TITLE, HOME_ABOUT_EXCERPT, HOME_ABOUT_LINK } from "@/lib/about-copy";

/** The homepage section below the hero: the opening of /about and a button to the full page. */
export function HomeAboutSection() {
  const [firstWord, ...rest] = ABOUT_TITLE.split(" ");

  return (
    <section aria-labelledby="home-about-title" className="px-5 pb-14 sm:px-10">
      <OrnamentBand className="text-teal" />
      <div className="grid items-center gap-8 pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-14">
        <div>
          <h2
            id="home-about-title"
            className="display-heading text-[clamp(2rem,4vw,3.1rem)] text-ink"
          >
            {firstWord} <span className="text-brand">{rest.join(" ")}</span>
          </h2>
          <p className="mt-4 max-w-[42em] font-serif text-[clamp(1.02rem,1.5vw,1.15rem)] leading-[1.75] text-prose">
            {HOME_ABOUT_EXCERPT}
          </p>
          <ButtonLink href={ABOUT_HREF} className="mt-6">
            {HOME_ABOUT_LINK}
          </ButtonLink>
        </div>
        <Rosette className="hidden w-[150px] text-teal md:block" />
      </div>
    </section>
  );
}
