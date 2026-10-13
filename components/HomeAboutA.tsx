import { ButtonLink } from "@/components/ButtonLink";
import { Braid, Rosette } from "@/components/Ornament";
import { ABOUT_HREF, ABOUT_TITLE, HOME_ABOUT_EXCERPT, HOME_ABOUT_LINK } from "@/lib/about-copy";

export function HomeAboutSection() {
  return (
    <section aria-labelledby="home-about-title" className="bg-ink text-paper">
      <Braid className="text-paper" groove="ink" />
      <div className="grid items-center gap-10 px-5 py-[clamp(40px,6vw,72px)] sm:px-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
        <div>
          <h2
            id="home-about-title"
            className="display-heading text-[clamp(2.4rem,5vw,3.8rem)] text-paper"
          >
            {ABOUT_TITLE}
          </h2>
          <div className="mt-5 h-1 w-20 bg-brand" />
          <p className="mt-5 max-w-[40em] font-serif text-[clamp(1.05rem,1.6vw,1.2rem)] leading-[1.8] text-paper">
            {HOME_ABOUT_EXCERPT}
          </p>
          <ButtonLink href={ABOUT_HREF} variant="ghost-inverse" size="lg" className="mt-8">
            {HOME_ABOUT_LINK}
          </ButtonLink>
        </div>
        <Rosette groove="ink" className="hidden w-[200px] text-paper md:block" />
      </div>
      <Braid className="text-paper" groove="ink" />
    </section>
  );
}
