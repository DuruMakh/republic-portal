import { Caps } from "@/components/Caps";
import { ABOUT_GOAL_STEPS } from "@/lib/about-copy";

type Pebble = { cx: number; cy: number; rx: number; ry: number; rotate: number; fill: string };

const TEAL = "#235B59";
const SAND = "#CFC4B3";
const STONE = "#A39684";
const INK = "#1A1611";

// Step 1: scattered pebbles; step 2: gathered into one cluster; step 3 is drawn as one stone.
const SCATTERED: Pebble[] = [
  { cx: 20, cy: 26, rx: 9, ry: 6.5, rotate: 20, fill: SAND },
  { cx: 64, cy: 14, rx: 8, ry: 6, rotate: -15, fill: STONE },
  { cx: 118, cy: 24, rx: 9, ry: 7, rotate: 30, fill: TEAL },
  { cx: 40, cy: 66, rx: 8.5, ry: 6, rotate: -25, fill: TEAL },
  { cx: 90, cy: 56, rx: 9, ry: 6.5, rotate: 10, fill: SAND },
  { cx: 132, cy: 80, rx: 8, ry: 6, rotate: -30, fill: STONE },
  { cx: 14, cy: 96, rx: 8, ry: 6, rotate: 15, fill: STONE },
  { cx: 72, cy: 96, rx: 9, ry: 6.5, rotate: -10, fill: SAND },
  { cx: 110, cy: 102, rx: 7.5, ry: 5.5, rotate: 25, fill: INK },
];

const GATHERED: Pebble[] = [
  { cx: 75, cy: 56, rx: 11, ry: 8.5, rotate: 10, fill: TEAL },
  { cx: 97, cy: 54, rx: 10, ry: 8, rotate: -20, fill: INK },
  { cx: 53, cy: 58, rx: 10, ry: 8, rotate: 25, fill: TEAL },
  { cx: 86, cy: 36, rx: 10.5, ry: 8, rotate: -5, fill: TEAL },
  { cx: 63, cy: 38, rx: 10, ry: 7.5, rotate: 30, fill: STONE },
  { cx: 86, cy: 76, rx: 10, ry: 8, rotate: 15, fill: STONE },
  { cx: 64, cy: 77, rx: 10.5, ry: 8, rotate: -15, fill: TEAL },
  { cx: 108, cy: 36, rx: 9, ry: 7, rotate: 20, fill: SAND },
  { cx: 42, cy: 40, rx: 9, ry: 7, rotate: -20, fill: TEAL },
  { cx: 108, cy: 74, rx: 9.5, ry: 7, rotate: -25, fill: TEAL },
  { cx: 43, cy: 77, rx: 9, ry: 7, rotate: 10, fill: INK },
  { cx: 75, cy: 17, rx: 9, ry: 6.5, rotate: 5, fill: TEAL },
  { cx: 75, cy: 95, rx: 9, ry: 6.5, rotate: -10, fill: SAND },
  { cx: 120, cy: 55, rx: 8.5, ry: 6.5, rotate: 35, fill: TEAL },
  { cx: 30, cy: 58, rx: 8.5, ry: 6.5, rotate: -30, fill: STONE },
];

function Pebbles({ step }: { step: number }) {
  return (
    <svg
      viewBox="0 0 150 112"
      aria-hidden="true"
      className="block h-[72px] w-24 flex-none sm:h-[112px] sm:w-[150px]"
    >
      {step === 2 ? (
        <>
          <ellipse
            cx="75"
            cy="56"
            rx="46"
            ry="38"
            transform="rotate(-8 75 56)"
            fill="none"
            stroke={TEAL}
            strokeWidth="2"
          />
          <ellipse cx="75" cy="56" rx="34" ry="27" transform="rotate(-8 75 56)" fill={TEAL} />
        </>
      ) : (
        (step === 0 ? SCATTERED : GATHERED).map((p) => (
          <ellipse
            key={`${p.cx}-${p.cy}`}
            cx={p.cx}
            cy={p.cy}
            rx={p.rx}
            ry={p.ry}
            transform={`rotate(${p.rotate} ${p.cx} ${p.cy})`}
            fill={p.fill}
          />
        ))
      )}
    </svg>
  );
}

/**
 * „ერთობიდან გამარჯვებამდე“: three steps drawn as pebbles that gather into one stone. Side by
 * side with a dashed line running to the next step; on a phone a column with the line running
 * down between the pictures.
 */
export function AboutGoalSteps() {
  const last = ABOUT_GOAL_STEPS.length - 1;
  return (
    <ol className="m-0 mt-8 list-none p-0 sm:mt-[clamp(48px,5vw,72px)] sm:grid sm:grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] sm:gap-x-[clamp(24px,3vw,48px)] sm:gap-y-[clamp(40px,4vw,56px)]">
      {ABOUT_GOAL_STEPS.map((step, i) => (
        <li
          key={step.label}
          className={`relative grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-4 sm:flex sm:flex-col sm:gap-0 sm:pb-0 ${
            i === last ? "" : "pb-7"
          }`}
        >
          {i === last ? null : (
            <span
              aria-hidden="true"
              className="absolute bottom-1.5 left-[47px] top-[76px] border-l-2 border-dashed border-[#cfc4b3] sm:hidden"
            />
          )}
          <div aria-hidden="true" className="sm:flex sm:h-[120px] sm:items-center sm:gap-[18px]">
            <Pebbles step={i} />
            {i === last ? null : (
              <span className="hidden h-0 flex-1 border-t-2 border-dashed border-[#cfc4b3] sm:block" />
            )}
          </div>
          <div className="min-w-0 sm:mt-[22px]">
            <span className="block text-[22px] font-black leading-none text-teal [font-stretch:62.5%] sm:text-[28px]">
              {`0${i + 1} · `}
              <Caps>{step.label}</Caps>
            </span>
            <p className="m-0 mt-2.5 font-serif text-[17px] leading-[1.55] text-ink sm:mt-3.5 sm:text-[21px]">
              {step.text}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
