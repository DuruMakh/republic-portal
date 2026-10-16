import { Caps } from "@/components/Caps";

/**
 * The „ერთობა“ section label: a two-part bar (red and ink, or sand and limestone on wine)
 * followed by small spaced Mtavruli capitals.
 */
export function UnityKicker({
  children,
  tone = "red",
  className = "",
}: {
  children: string;
  tone?: "red" | "light";
  className?: string;
}) {
  const light = tone === "light";
  return (
    <div
      className={`flex items-center gap-3 text-[12px] font-bold tracking-[.14em] sm:gap-3.5 sm:text-[13px] ${
        light ? "text-sand" : "text-brand"
      } ${className}`}
    >
      <span aria-hidden="true" className="flex">
        <span className={`block h-1 w-6 sm:w-[30px] ${light ? "bg-sand" : "bg-brand"}`} />
        <span className={`block h-1 w-3.5 sm:w-[18px] ${light ? "bg-limestone" : "bg-ink"}`} />
      </span>
      <span>
        <Caps>{children}</Caps>
      </span>
    </div>
  );
}
