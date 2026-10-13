import { ButtonLink } from "@/components/ButtonLink";
import { Eyebrow } from "@/components/Eyebrow";
import { STRUCTURE_HREF } from "@/lib/structure-copy";

// The homepage's last section (owner request, 2026-10-13): after the About and Principles
// sections, the page ends by sending the reader to sign up. It opens on the masthead's double
// rule, so the front page closes the way it opens.
const KICKER = "შემოგვიერთდი";
const HEADING = "ქართული რესპუბლიკა შენით იწყება";
const LEDE =
  "ყოველი ახალი მხარდამჭერი ჩვენს ერთობას აძლიერებს. დარეგისტრირდი და გახდი ამ ერთობის ნაწილი.";
const JOIN = "გახდი მხარდამჭერი";
const STRUCTURE = "როგორ ვართ მოწყობილი";

export function HomeClosing() {
  return (
    <section aria-labelledby="home-closing-title" className="bg-paper-bright">
      <div aria-hidden="true" className="masthead-rule" />
      <div className="mx-auto max-w-[44rem] px-5 py-14 text-center sm:px-10 sm:py-16">
        <Eyebrow>{KICKER}</Eyebrow>
        <h2
          id="home-closing-title"
          className="mt-3 font-serif text-[2rem] font-bold leading-[1.16] text-ink [text-wrap:balance] sm:text-[2.5rem]"
        >
          {HEADING}
        </h2>
        <p className="mx-auto mt-4 max-w-[34em] font-serif text-[1.06rem] leading-[1.6] text-prose">
          {LEDE}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/join" size="lg" className="w-full sm:w-auto">
            {JOIN}
          </ButtonLink>
          <ButtonLink href={STRUCTURE_HREF} variant="ghost" size="lg" className="w-full sm:w-auto">
            {STRUCTURE}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
