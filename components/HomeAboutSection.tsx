import { ButtonLink } from "@/components/ButtonLink";
import { Braid } from "@/components/Ornament";
import { ABOUT_HREF, ABOUT_TITLE, HOME_ABOUT_EXCERPT, HOME_ABOUT_LINK } from "@/lib/about-copy";

/** The homepage section below the hero: a full-bleed red band, like the one on /about. */
export function HomeAboutSection() {
  return (
    <section aria-labelledby="home-about-title" className="bg-brand text-paper">
      <Braid className="text-paper" groove="brand" />
      <div className="grid items-center gap-8 px-5 py-[clamp(40px,6vw,80px)] sm:px-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <h2
          id="home-about-title"
          className="display-heading text-[clamp(2.6rem,6vw,4.6rem)] text-paper"
        >
          {ABOUT_TITLE}
        </h2>
        <div>
          <p className="font-serif text-[clamp(1.15rem,2vw,1.45rem)] leading-[1.6]">
            {HOME_ABOUT_EXCERPT}
          </p>
          <ButtonLink href={ABOUT_HREF} variant="ghost-inverse" size="lg" className="mt-8">
            {HOME_ABOUT_LINK}
          </ButtonLink>
        </div>
      </div>
      <Braid className="text-paper" groove="brand" />
    </section>
  );
}
