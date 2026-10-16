import { GEORGIAN_NUMERALS, PRINCIPLES_SEAL_LABEL, principleAnchor } from "@/lib/principles-copy";

// Where each numeral sits on the ring, clockwise from the top, as % of the seal (the design's
// table: a circle of radius 42.92% around the centre, one stop every 30°).
const RING = [
  [50, 7.08],
  [71.46, 12.83],
  [87.17, 28.54],
  [92.92, 50],
  [87.17, 71.46],
  [71.46, 87.17],
  [50, 92.92],
  [28.54, 87.17],
  [12.83, 71.46],
  [7.08, 50],
  [12.83, 28.54],
  [28.54, 12.83],
] as const;

/**
 * The /principles hero seal: the red knot inside two rings, with the twelve old-Georgian numerals
 * around it, each a link to its principle (on phones the link also opens that principle's row).
 */
export function PrinciplesSeal() {
  return (
    <nav
      aria-label={PRINCIPLES_SEAL_LABEL}
      className="flex min-w-0 flex-[1_1_360px] justify-center"
    >
      <div className="relative aspect-square w-[320px] sm:w-[min(100%,500px)]">
        <span
          aria-hidden="true"
          className="absolute inset-[7.08%] rounded-full border border-[#cfc4b3]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-[22%] rounded-full border border-dashed border-rule sm:inset-[21%]"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative vector mark */}
        <img
          src="/unity/knot-red.svg"
          alt=""
          className="absolute top-1/2 left-1/2 h-auto w-[40%] -translate-x-1/2 -translate-y-1/2 sm:w-[42%]"
        />
        {GEORGIAN_NUMERALS.map((numeral, i) => {
          const [left, top] = RING[i] ?? [50, 50];
          return (
            <a
              key={numeral}
              href={`#${principleAnchor(i + 1)}`}
              aria-label={`პრინციპი ${i + 1}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              className={`absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-brand bg-limestone font-aso leading-none font-light text-brand no-underline transition-colors hover:bg-brand hover:text-white sm:size-[52px] ${
                numeral.length > 1 ? "text-[16px] sm:text-[19px]" : "text-[18px] sm:text-[21px]"
              }`}
            >
              {numeral}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
