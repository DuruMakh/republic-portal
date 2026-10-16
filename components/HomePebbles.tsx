const SECOND_SHAPE = "rounded-[52%_48%_45%_55%/46%_50%_50%_54%]";

const TONES = {
  /** The mission counters: teal on limestone, smaller on the phone. */
  teal: {
    gap: "gap-[3px] sm:gap-1",
    sizes: [
      "h-[9px] w-3 sm:h-3 sm:w-4",
      "h-3 w-4 sm:h-[17px] sm:w-[22px]",
      "ml-[3px] h-[15px] w-5 sm:ml-1 sm:h-[21px] sm:w-7",
    ],
    fill: "bg-teal",
    ring: "shadow-[0_0_0_2.5px_var(--color-limestone),0_0_0_3.75px_var(--color-teal)] sm:shadow-[0_0_0_3px_var(--color-limestone),0_0_0_4.5px_var(--color-teal)]",
  },
  /** The join steps: red on chalk. */
  brand: {
    gap: "gap-1",
    sizes: ["h-3 w-4", "h-[17px] w-[22px]", "h-[23px] w-[30px]"],
    fill: "bg-brand",
    ring: "shadow-[0_0_0_4px_var(--color-chalk),0_0_0_5.5px_var(--color-brand)]",
  },
} as const;

/**
 * The membership ladder drawn as pebbles: one for a supporter, two for a member, and a third,
 * ringed one for a delegate. Decorative; the label beside it carries the meaning.
 */
export function HomePebbles({ count, tone }: { count: 1 | 2 | 3; tone: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <span aria-hidden="true" className={`flex items-center ${t.gap}`}>
      {t.sizes.slice(0, count).map((size, i) => (
        <span
          key={size}
          className={`block ${size} ${t.fill} ${i === 1 ? SECOND_SHAPE : "pebble"} ${
            i === 2 ? t.ring : ""
          }`}
        />
      ))}
    </span>
  );
}
