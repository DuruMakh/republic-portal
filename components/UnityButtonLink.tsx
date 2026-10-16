import Link from "next/link";
import { Caps } from "@/components/Caps";

const VARIANTS = {
  /** Red fill: the default call to act on light backgrounds. */
  wine: "bg-brand text-white hover:bg-brand-dark hover:text-white",
  /** Limestone fill with wine text: the call to act on wine bands. */
  cream: "bg-limestone text-wine hover:bg-white hover:text-wine",
  /** Ink fill, turning red on hover. */
  ink: "bg-ink text-limestone hover:bg-brand hover:text-white",
  /** Ink outline, filling with ink on hover. */
  ghost: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-limestone",
} as const;

const SIZES = {
  sm: "h-11 px-5 text-[13px] gap-2.5",
  md: "h-14 px-[26px] text-[14px] gap-3",
  lg: "h-[60px] px-[30px] text-[15px] gap-3",
} as const;

export type UnityButtonVariant = keyof typeof VARIANTS;
export type UnityButtonSize = keyof typeof SIZES;

/** The „ერთობა“ button classes, shared by UnityButtonLink and UnityButton. */
export function unityButtonClasses(
  variant: UnityButtonVariant = "wine",
  size: UnityButtonSize = "md",
  extra = "",
): string {
  return `inline-flex items-center justify-center whitespace-nowrap font-bold tracking-[.08em] no-underline transition-colors ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

/** The trailing → the design puts on primary actions. */
export function UnityButtonArrow() {
  return (
    <span aria-hidden="true" className="text-[1.3em] tracking-normal">
      →
    </span>
  );
}

/**
 * The „ერთობა“ button, drawn as a link: square, bold spaced Mtavruli capitals, colour-only hover.
 * `arrow` adds the trailing → that the design puts on primary actions.
 */
export function UnityButtonLink({
  href,
  children,
  variant = "wine",
  size = "md",
  arrow = false,
  className = "",
}: {
  href: string;
  children: string;
  variant?: UnityButtonVariant;
  size?: UnityButtonSize;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={unityButtonClasses(variant, size, className)}>
      <Caps>{children}</Caps>
      {arrow ? <UnityButtonArrow /> : null}
    </Link>
  );
}
