/**
 * The /about motif: Georgian carved-stone ornament, drawn in `currentColor` so the caller picks
 * the token (teal informs, ADR-048). Both pieces are decorative (`aria-hidden`).
 */

// Eight-pointed star of two interlaced squares inside a double ring, the rosette carved on
// the stone facades of Georgian churches.
const STAR_POINTS = [0, 45].map((turn) => `rotate(${turn} 60 60)`);
const BEAD_ANGLES = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];

export function Rosette({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <circle cx="60" cy="60" r="57" />
      <circle cx="60" cy="60" r="52" />
      {STAR_POINTS.map((t) => (
        <rect key={t} x="29" y="29" width="62" height="62" transform={t} />
      ))}
      {STAR_POINTS.map((t) => (
        <rect key={`in-${t}`} x="47" y="47" width="26" height="26" transform={t} />
      ))}
      <circle cx="60" cy="60" r="22" />
      <circle cx="60" cy="60" r="3.5" fill="currentColor" />
      {BEAD_ANGLES.map((a) => (
        <circle
          key={a}
          cx="60"
          cy="14"
          r="2.5"
          fill="currentColor"
          stroke="none"
          transform={`rotate(${a} 60 60)`}
        />
      ))}
    </svg>
  );
}

/** A carved border band: a running row of lozenges between two rules (`ornament-band`). */
export function OrnamentBand({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`ornament-band h-4 ${className}`.trim()} />;
}
