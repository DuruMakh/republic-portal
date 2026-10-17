import { PRINCIPLE_ROOTS_LABEL, type PrincipleRoot } from "@/lib/principles-copy";

/**
 * A principle's historical note: under a full-width braid, the dates and quotations
 * the principle grows from. Principle 1's note carries the 9 April tulips, floated right.
 */
export function PrinciplesRoots({
  roots,
  art = false,
  className = "",
}: {
  roots: readonly PrincipleRoot[];
  art?: boolean;
  className?: string;
}) {
  return (
    <aside aria-label={PRINCIPLE_ROOTS_LABEL} className={`flow-root ${className}`}>
      <span
        aria-hidden="true"
        className="block h-3 w-full bg-[url(/unity/ornament-wine.svg)] bg-size-[auto_12px] bg-left bg-repeat-x"
      />
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative vector drawing
        <img
          src="/unity/tulips.svg"
          alt=""
          width={196}
          height={200}
          className="float-right mt-3.5 mb-1.5 ml-3 h-auto w-[46px]"
        />
      ) : null}
      {roots.map((root, i) => {
        const gap = i === 0 ? "mt-3" : root.kind === "note" ? "mt-3" : "mt-4";
        switch (root.kind) {
          case "event":
            return (
              <p
                key={root.date}
                className={`${gap} text-[15px] leading-[1.55] text-prose sm:text-[15.5px]`}
              >
                <strong className="block font-bold text-ink">{root.date}</strong>
                {root.text}
              </p>
            );
          case "quote":
            return (
              <figure key={root.text} className={`${gap} m-0`}>
                <blockquote className="m-0">
                  <p className="font-serif text-[16px] leading-[1.5] font-medium text-ink sm:text-[16.5px]">
                    {root.text}
                  </p>
                </blockquote>
                <figcaption className="mt-1.5 text-[12.5px] leading-[1.45] text-secondary">
                  {root.author ? (
                    <>
                      <span className="font-bold text-prose">{root.author}</span>,{" "}
                    </>
                  ) : null}
                  {root.source}
                </figcaption>
              </figure>
            );
          case "script":
            return (
              <p
                key={root.sample}
                className={`${gap} font-serif text-[34px] leading-none tracking-[.04em] text-brand`}
              >
                <span aria-hidden="true">{root.sample}</span>
                <span className="sr-only">{root.label}</span>
              </p>
            );
          case "note":
            return (
              <p key={root.text} className={`${gap} text-[14.5px] leading-[1.55] text-prose`}>
                {root.text}
              </p>
            );
        }
      })}
    </aside>
  );
}
