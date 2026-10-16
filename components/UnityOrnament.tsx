/**
 * The carved-stone border from the 1918 Act of Independence, repeated edge to edge.
 * `wine` is the red braid on light backgrounds, `teal` the band above the footer.
 */
export function UnityOrnament({
  tone = "wine",
  className = "",
}: {
  tone?: "wine" | "teal";
  className?: string;
}) {
  const art =
    tone === "teal"
      ? "bg-teal bg-[url(/unity/ornament-teal.svg)] h-[18px] bg-size-[auto_18px] sm:h-6 sm:bg-size-[auto_24px]"
      : "bg-[url(/unity/ornament-wine.svg)] h-4 bg-size-[auto_16px]";
  return <span aria-hidden="true" className={`block bg-left bg-repeat-x ${art} ${className}`} />;
}
