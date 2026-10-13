import { ButtonLink } from "@/components/ButtonLink";
import { Braid } from "@/components/Ornament";
import { ABOUT_HREF, ABOUT_TITLE, HOME_ABOUT_EXCERPT, HOME_ABOUT_LINK } from "@/lib/about-copy";

export function HomeAboutSection() {
  const [firstWord, ...rest] = ABOUT_TITLE.split(" ");
  return (
    <section aria-labelledby="home-about-title" className="px-5 pb-16 sm:px-10">
      <Braid className="text-brand" />
      <div className="grid gap-8 pt-10 md:grid-cols-[1fr_1.3fr] md:gap-14">
        <h2
          id="home-about-title"
          className="display-heading text-[clamp(3.4rem,9vw,7rem)] leading-[1.02] text-ink"
        >
          {firstWord}
          <br />
          <span className="text-brand">{rest.join(" ")}</span>
        </h2>
        <div className="md:border-l-2 md:border-ink md:pl-10">
          <p className="font-serif text-[clamp(1.1rem,1.8vw,1.35rem)] leading-[1.65] text-ink">
            {HOME_ABOUT_EXCERPT}
          </p>
          <ButtonLink href={ABOUT_HREF} size="lg" className="mt-8">
            {HOME_ABOUT_LINK}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
