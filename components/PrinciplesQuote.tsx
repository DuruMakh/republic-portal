import { PRINCIPLES_QUOTE, PRINCIPLES_QUOTE_LABEL } from "@/lib/principles-copy";

/**
 * The wine pull-quote band from principle 2, with the wine knot bleeding off the left edge.
 * From tablet width up it sits after principle 2; phones keep the sentence in its original text.
 */
export function PrinciplesQuote({ className = "" }: { className?: string }) {
  return (
    <section
      aria-label={PRINCIPLES_QUOTE_LABEL}
      className={`relative overflow-hidden bg-wine text-limestone ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative vector mark */}
      <img
        src="/unity/knot-wine.svg"
        alt=""
        className="pointer-events-none absolute top-1/2 -left-[120px] h-auto w-[520px] -translate-y-1/2 max-sm:hidden"
      />
      <div className="unity-container relative flex flex-wrap gap-[clamp(20px,4vw,72px)] py-[clamp(80px,9vw,136px)] max-sm:flex-col max-sm:gap-4 max-sm:pt-14 max-sm:pb-[60px]">
        <div aria-hidden="true" className="min-w-0 sm:flex-[1_1_200px]" />
        <blockquote className="m-0 min-w-0 sm:flex-[3_1_560px]">
          <p className="font-serif text-[26px] leading-[1.28] font-medium tracking-[-.005em] text-pretty sm:text-[clamp(30px,3.6vw,54px)] sm:leading-[1.22]">
            {PRINCIPLES_QUOTE.text}
            <span className="text-sand">{PRINCIPLES_QUOTE.highlight}</span>
          </p>
        </blockquote>
      </div>
    </section>
  );
}
