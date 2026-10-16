/** The design's second pebble outline, the mirror of the `pebble` utility. */
export const PEBBLE_ALT = "rounded-[52%_48%_45%_55%/46%_50%_50%_54%]";

/**
 * One decorative pebble of the /structure illustrations. Size, colour and tilt come in through
 * `className`; `alt` picks the mirrored outline so neighbouring pebbles never look stamped.
 */
export function StructurePebble({
  className = "",
  alt = false,
}: {
  className?: string;
  alt?: boolean;
}) {
  return (
    <span aria-hidden="true" className={`block ${alt ? PEBBLE_ALT : "pebble"} ${className}`} />
  );
}
