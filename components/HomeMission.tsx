import { CountUp } from "@/components/CountUp";
import { HomePebbles } from "@/components/HomePebbles";
import {
  HOME_MISSION,
  HOME_MISSION_LABEL,
  HOME_MISSION_STEPS,
  HOME_STAT_DELEGATES,
  HOME_STAT_MEMBERS,
  HOME_STAT_SUPPORTERS,
} from "@/lib/home-copy";
import { GEORGIAN_NUMERALS } from "@/lib/principles-copy";
import type { PublicStats } from "@/lib/supabase/public";

const STAT_PADDING = [
  "pr-2 sm:pr-[clamp(16px,3vw,44px)]",
  "border-l border-rule pl-3 pr-2 sm:px-[clamp(16px,3vw,44px)]",
  "border-l border-rule pl-3 sm:pl-[clamp(16px,3vw,44px)]",
] as const;

// The four markers on the desktop path, where the design's mountain art puts them (percent of
// the art box), each lighting up while its numbered label below is hovered. The hover classes
// are spelled out per step so Tailwind can see them.
const DESKTOP_MARKERS = [
  {
    at: "left-[8.333%] top-[91.25%]",
    lit: "group-has-[.home-step-1:hover]/mission:scale-125 group-has-[.home-step-1:hover]/mission:bg-brand group-has-[.home-step-1:hover]/mission:text-chalk",
  },
  {
    at: "left-[30.556%] top-[79.062%]",
    lit: "group-has-[.home-step-2:hover]/mission:scale-125 group-has-[.home-step-2:hover]/mission:bg-brand group-has-[.home-step-2:hover]/mission:text-chalk",
  },
  {
    at: "left-[52.778%] top-[62.187%]",
    lit: "group-has-[.home-step-3:hover]/mission:scale-125 group-has-[.home-step-3:hover]/mission:bg-brand group-has-[.home-step-3:hover]/mission:text-chalk",
  },
  {
    at: "left-[77.361%] top-[12.5%]",
    lit: "group-has-[.home-step-4:hover]/mission:scale-125 group-has-[.home-step-4:hover]/mission:bg-brand group-has-[.home-step-4:hover]/mission:text-chalk",
  },
] as const;

const PHONE_MARKERS = [
  "left-[11.282%] top-[94.086%]",
  "left-[33.846%] top-[84.409%]",
  "left-[54.872%] top-[70.43%]",
  "left-[81.026%] top-[20.43%]",
] as const;

const STEP_HOOKS = ["home-step-1", "home-step-2", "home-step-3", "home-step-4"] as const;

const MARKER =
  "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-chalk font-aso font-light leading-none text-brand";

/** The waving state flag on its pole; a still frame for visitors who prefer reduced motion. */
function Flag({ phone }: { phone: boolean }) {
  const pole = phone
    ? "left-[-1px] top-[-60px] h-[62px] w-[2px]"
    : "left-[-.104vw] top-[-8.611vw] h-[8.75vw] w-[.208vw]";
  const finial = phone
    ? "left-[-2.5px] top-[-62.5px] size-[5px]"
    : "left-[-.33vw] top-[-8.941vw] size-[.66vw]";
  const cloth = phone ? "left-px top-[-62px] w-[68px]" : "left-[.104vw] top-[-8.893vw] w-[8.611vw]";
  return (
    <span
      className={`absolute size-0 ${phone ? "left-[74.872%] top-[17.204%]" : "left-[75%] top-[10%]"}`}
    >
      <span className={`absolute rounded-[1px] bg-ink ${pole}`} />
      <span className={`absolute rounded-full bg-ink ${finial}`} />
      {/* Visitors who ask for less motion get the still frame instead; only one file loads. */}
      <picture>
        <source srcSet="/unity/flag-still.png" media="(prefers-reduced-motion: reduce)" />
        <img
          src="/unity/flag-wave.webp"
          alt=""
          width={264}
          height={202}
          loading="lazy"
          className={`absolute block h-auto max-w-none ${cloth}`}
        />
      </picture>
    </span>
  );
}

/**
 * The portal's purpose: the three live counters, the mission sentence, and the mountain path to
 * the flag with its four numbered stops, named on the wine band below. Hovering a name lights
 * its stop on the path.
 */
export function HomeMission({ stats }: { stats: PublicStats }) {
  const counters = [
    { label: HOME_STAT_SUPPORTERS, value: stats.registered_total, id: "stat-registered-total" },
    { label: HOME_STAT_MEMBERS, value: stats.members_total, id: "stat-members-total" },
    { label: HOME_STAT_DELEGATES, value: stats.approved_delegates, id: "stat-approved-delegates" },
  ] as const;

  return (
    <section aria-label={HOME_MISSION_LABEL} className="group/mission relative">
      <div className="unity-container relative z-[2] pt-11 sm:pt-[clamp(64px,7vw,104px)]">
        <dl className="m-0 grid grid-cols-3 border-t-2 border-teal">
          {counters.map((c, i) => (
            <div
              key={c.id}
              className={`flex min-w-0 flex-col-reverse justify-end pt-4 sm:pt-[26px] ${STAT_PADDING[i]}`}
            >
              <dt className="mt-3 flex flex-col items-start gap-2 text-[13px] font-semibold leading-[1.3] text-ink sm:mt-[18px] sm:flex-row sm:items-center sm:gap-3 sm:text-[18px]">
                <span className="flex h-[18px] items-center sm:h-6">
                  <HomePebbles count={(i + 1) as 1 | 2 | 3} tone="teal" />
                </span>
                {c.label}
              </dt>
              <dd
                data-testid={c.id}
                className="m-0 text-[40px] font-black leading-[.9] text-teal [font-stretch:62.5%] sm:text-[clamp(56px,7.2vw,104px)]"
              >
                <CountUp value={c.value} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="m-0 mt-10 font-serif text-[27px] font-medium leading-[1.26] tracking-[-.005em] text-ink [text-wrap:balance] sm:mt-[clamp(72px,8vw,120px)] sm:max-w-[17em] sm:text-[clamp(30px,3.3vw,46px)] sm:leading-[1.22]">
          {HOME_MISSION[0]} <span className="text-brand">{HOME_MISSION[1]}</span> {HOME_MISSION[2]}
        </p>
      </div>

      {/* Desktop and tablet art: the path climbs behind the end of the sentence. */}
      <div
        aria-hidden="true"
        className="relative z-[1] mt-6 hidden sm:block min-[56.25rem]:mt-[-13.889vw]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative illustration */}
        <img
          src="/unity/mountains.svg"
          alt=""
          width={1440}
          height={640}
          className="block h-auto w-full"
        />
        <Flag phone={false} />
        {DESKTOP_MARKERS.map((m, i) => (
          <span
            key={m.at}
            className={`${MARKER} ${m.at} ${m.lit} size-[clamp(24px,2.4vw,34px)] text-[clamp(14px,1.4vw,20px)] shadow-[0_0_0_2px_var(--color-brand)] transition-[scale,background-color,color] duration-200`}
          >
            {GEORGIAN_NUMERALS[i]}
          </span>
        ))}
      </div>

      {/* Phone art: its own, taller crop of the range. */}
      <div aria-hidden="true" className="relative mt-2 sm:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative illustration */}
        <img
          src="/unity/mountains-mobile.svg"
          alt=""
          width={390}
          height={372}
          className="block h-auto w-full"
        />
        <Flag phone />
        {PHONE_MARKERS.map((at, i) => (
          <span
            key={at}
            className={`${MARKER} ${at} size-7 text-[16px] shadow-[0_0_0_1.5px_var(--color-brand)]`}
          >
            {GEORGIAN_NUMERALS[i]}
          </span>
        ))}
      </div>

      <div className="-mt-px bg-wine px-5 pb-[52px] pt-1.5 sm:px-[6.944%] sm:pb-[clamp(64px,6vw,96px)] sm:pt-1">
        <ol className="m-0 list-none p-0 sm:grid sm:grid-cols-2 sm:gap-10 min-[56.25rem]:grid-cols-4">
          {HOME_MISSION_STEPS.map((step, i) => (
            <li
              key={step}
              className={`${STEP_HOOKS[i]} group/step grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-baseline gap-2.5 border-t border-sand/22 py-4 first:border-t-0 sm:flex sm:flex-col sm:items-start sm:gap-4 sm:border-t-0 sm:py-0`}
            >
              <span
                aria-hidden="true"
                className="font-aso text-[34px] font-light leading-none text-sand transition-colors duration-200 group-hover/step:text-chalk sm:text-[56px] sm:leading-[.9]"
              >
                {GEORGIAN_NUMERALS[i]}
              </span>
              <span className="font-serif text-[19px] leading-[1.45] text-limestone [text-wrap:pretty] sm:text-[clamp(19px,1.6vw,22px)] sm:leading-[1.42]">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
