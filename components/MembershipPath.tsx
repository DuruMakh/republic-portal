import { Pebble } from "./Pebble";

export function MembershipPath({ label, steps }: { label: string; steps: readonly string[] }) {
  return (
    <div>
      <div className="text-[0.74rem] font-bold tracking-[.2em] text-teal">{label}</div>
      <ol className="relative mt-3.5 before:absolute before:top-[22px] before:bottom-[22px] before:left-[14px] before:w-0.5 before:bg-teal/35">
        {steps.map((step, i) => (
          <li
            key={step}
            className="relative grid grid-cols-[30px_minmax(0,1fr)] items-start gap-4 py-3"
          >
            <Pebble
              tone={i === steps.length - 1 ? "teal" : "teal-outline"}
              className="relative z-[1] h-[27px] w-[30px] font-serif text-[0.85rem] font-bold"
            >
              {i + 1}
            </Pebble>
            <strong className="font-serif text-[1.08rem] leading-snug font-semibold text-ink">
              {step}
            </strong>
          </li>
        ))}
      </ol>
    </div>
  );
}
