import { COUNCIL_HALF, COUNCIL_RING, councilLayout, type PebbleShape } from "@/lib/pebbles";

function Ellipse({ p, className, delay }: { p: PebbleShape; className: string; delay?: string }) {
  return (
    <ellipse
      cx={p.cx}
      cy={p.cy}
      rx={p.rx}
      ry={p.ry}
      opacity={p.opacity}
      transform={`rotate(${p.rotate} ${p.cx} ${p.cy})`}
      className={className}
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}

/**
 * Hero drawing on /structure: the board's seats on a ring, members gathered around (spec §3.1).
 * Width comes from the caller's className only: a built-in `w-full` would win over it in the
 * generated CSS order.
 */
export function PebbleCouncil({
  seats,
  centerLabel,
  className = "",
}: {
  seats: number;
  centerLabel: string;
  className?: string;
}) {
  const layout = councilLayout(seats);
  const side = COUNCIL_HALF * 2;
  return (
    <svg
      aria-hidden="true"
      viewBox={`${-COUNCIL_HALF} ${-COUNCIL_HALF} ${side} ${side}`}
      className={`block h-auto overflow-visible ${className}`}
    >
      {layout.members.map((p, i) => (
        <Ellipse key={`m${i}`} p={p} className="fill-line" />
      ))}
      <circle r={COUNCIL_RING} className="fill-none stroke-line" />
      {layout.seats.map((p, i) => (
        <Ellipse
          key={`s${i}`}
          p={p}
          className="council-seat fill-teal"
          delay={`${Math.round((0.15 + i * 0.12) * 100) / 100}s`}
        />
      ))}
      <text textAnchor="middle" y={9} fontSize={28} className="display-heading fill-ink">
        {centerLabel}
      </text>
    </svg>
  );
}
