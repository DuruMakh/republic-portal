import { ButtonLink } from "@/components/ButtonLink";
import { Braid, Rosette } from "@/components/Ornament";
import { ABOUT_HREF, ABOUT_TITLE, HOME_ABOUT_EXCERPT, HOME_ABOUT_LINK } from "@/lib/about-copy";

export function HomeAboutSection() {
  return (
    <section aria-labelledby="home-about-title" className="px-5 pb-16 pt-4 sm:px-10">
      <div className="flex items-center gap-4">
        <Braid className="flex-1 text-brand" />
        <Rosette className="w-[80px] shrink-0 text-brand" />
        <Braid className="flex-1 text-brand" />
      </div>
      <div className="mx-auto mt-8 max-w-[780px] text-center">
        <h2
          id="home-about-title"
          className="font-serif text-[clamp(2.2rem,4.5vw,3.2rem)] leading-[1.1] font-bold text-ink"
        >
          {ABOUT_TITLE}
        </h2>
        <p className="mt-5 font-serif text-[clamp(1.05rem,1.6vw,1.2rem)] leading-[1.85] text-prose">
          {HOME_ABOUT_EXCERPT}
        </p>
        <ButtonLink href={ABOUT_HREF} size="lg" className="mt-8">
          {HOME_ABOUT_LINK}
        </ButtonLink>
      </div>
    </section>
  );
}
