import type { ButtonHTMLAttributes } from "react";
import {
  UnityButtonArrow,
  unityButtonClasses,
  type UnityButtonSize,
  type UnityButtonVariant,
} from "@/components/UnityButtonLink";
import { Caps } from "@/components/Caps";

/**
 * The <button> twin of UnityButtonLink, for forms and actions: the same variants, sizes and
 * arrow, plus the usual button props. `type` defaults to "button" so it never submits a form by
 * accident. Disabled buttons fade and stop reacting to hover.
 */
export function UnityButton({
  children,
  variant = "wine",
  size = "md",
  arrow = false,
  className = "",
  type = "button",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: string;
  variant?: UnityButtonVariant;
  size?: UnityButtonSize;
  arrow?: boolean;
}) {
  return (
    <button
      type={type}
      className={unityButtonClasses(
        variant,
        size,
        `cursor-pointer disabled:pointer-events-none disabled:opacity-50 ${className}`,
      )}
      {...rest}
    >
      <Caps>{children}</Caps>
      {arrow ? <UnityButtonArrow /> : null}
    </button>
  );
}
