import Image from "next/image";
import { ButtonLink } from "@/components/ButtonLink";
import { STRUCTURE_HREF } from "@/lib/structure-copy";

// The homepage's last section (owner request, 2026-10-13): after the About and Principles
// sections, the page ends by sending the reader to sign up. A red band, the one place red
// fills a panel, because this is the page's call to act; carved-stone rosettes edge it and the
// emblem sits beside the words. The rosettes are a lighter teal (owner's pick): the teal token
// is as dark as the red and vanishes on it. Paper focus outlines, as on the teal footer: a red
// ring on red is invisible.
const KICKER = "შემოგვიერთდი";
const HEADING = "ქართული რესპუბლიკა შენით იწყება";
const LEDE =
  "ყოველი ახალი მხარდამჭერი ჩვენს ერთობას აძლიერებს. დარეგისტრირდი და გახდი ამ ერთობის ნაწილი.";
const JOIN = "გახდი მხარდამჭერი";
const STRUCTURE = "როგორ ვართ მოწყობილი";

/** A row of four-loop rosettes, after the emblem, between two hairlines: a carved stone border. */
function Chain({ id }: { id: string }) {
  return (
    <svg aria-hidden="true" className="block h-[18px] w-full text-[#5aaba4]">
      <defs>
        <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.1">
            <circle cx="9" cy="5.6" r="2.8" />
            <circle cx="9" cy="12.4" r="2.8" />
            <circle cx="5.6" cy="9" r="2.8" />
            <circle cx="12.4" cy="9" r="2.8" />
          </g>
          <path d="M0 7.6 L1.4 9 L0 10.4 Z M18 7.6 L16.6 9 L18 10.4 Z" fill="currentColor" />
        </pattern>
      </defs>
      <line x1="0" y1="0.5" x2="100%" y2="0.5" stroke="currentColor" />
      <rect y="0" width="100%" height="18" fill={`url(#${id})`} />
      <line x1="0" y1="17.5" x2="100%" y2="17.5" stroke="currentColor" />
    </svg>
  );
}

export function HomeClosing() {
  return (
    <section aria-labelledby="home-closing-title" className="px-5 pb-12 pt-4 sm:px-10">
      <div className="bg-[linear-gradient(135deg,var(--color-brand),var(--color-brand-dark))] px-4 py-4 text-paper sm:px-6">
        <Chain id="home-closing-chain-top" />
        <div className="grid items-center gap-8 px-2 py-10 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-14">
          <Image
            src="/brand/emblem-roundel-red-notext.png"
            alt=""
            width={360}
            height={360}
            className="mx-auto w-[112px] sm:w-[150px] lg:order-last lg:w-[220px]"
          />
          <div className="text-center lg:text-left">
            <div className="text-[0.7rem] font-bold uppercase tracking-[.18em] text-paper/80">
              {KICKER}
            </div>
            <h2
              id="home-closing-title"
              className="mt-3 font-serif text-[2.1rem] font-bold leading-[1.12] [text-wrap:balance] sm:text-[3rem]"
            >
              {HEADING}
            </h2>
            <p className="mx-auto mt-4 max-w-[34em] font-serif text-[1.08rem] leading-[1.6] text-paper/90 lg:mx-0">
              {LEDE}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <ButtonLink
                href="/join"
                variant="inverse"
                size="lg"
                className="w-full focus-visible:outline-paper sm:w-auto"
              >
                {JOIN}
              </ButtonLink>
              <ButtonLink
                href={STRUCTURE_HREF}
                variant="ghost-inverse"
                size="lg"
                className="w-full focus-visible:outline-paper sm:w-auto"
              >
                {STRUCTURE}
              </ButtonLink>
            </div>
          </div>
        </div>
        <Chain id="home-closing-chain-bottom" />
      </div>
    </section>
  );
}
